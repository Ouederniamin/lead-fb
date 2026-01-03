import { NextRequest, NextResponse } from "next/server";
import { chromium, BrowserContext } from "playwright";
import path from "path";
import { prisma } from "@/lib/db";

const WORKER_PATH = process.env.WORKER_PATH || path.join(process.cwd(), "worker");

// Stealth script to avoid detection
const STEALTH_SCRIPT = `
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
  window.chrome = { runtime: {} };
`;

// Human-like delay
function humanDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

interface ConversationPreview {
  contactName: string;
  contactUrl: string | null;
  conversationUrl: string | null;
  lastMessage: string;
  timestamp: string;
  isUnread: boolean;
}

interface InitResult {
  success: boolean;
  accountId: string;
  totalScraped: number;
  matchedToLeads: number;
  alreadyExisted: number;
  created: number;
  unmatched: number;
  errors: string[];
  logs: string[];
  conversations: {
    contactName: string;
    contactUrl: string | null;
    matched: boolean;
    leadId: string | null;
    authorName: string | null;
    status: "created" | "existed" | "unmatched";
  }[];
}

export async function POST(request: NextRequest) {
  const logs: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logs.push(`[${new Date().toISOString().substring(11, 19)}] ${msg}`);
  };

  const result: InitResult = {
    success: false,
    accountId: "",
    totalScraped: 0,
    matchedToLeads: 0,
    alreadyExisted: 0,
    created: 0,
    unmatched: 0,
    errors: [],
    logs: [],
    conversations: [],
  };

  let browser: BrowserContext | null = null;

  try {
    const body = await request.json();
    const { accountId, maxConversations = 50, scrollCount = 3 } = body;

    if (!accountId) {
      return NextResponse.json({ error: "accountId is required" }, { status: 400 });
    }

    result.accountId = accountId;

    // Verify account exists
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Check for session data in database
    if (!account.sessionData) {
      return NextResponse.json({ 
        error: "No session data found for this account. Please login first." 
      }, { status: 400 });
    }

    log(`🚀 Starting conversation initialization for account: ${account.name}`);

    const profilePath = path.join(WORKER_PATH, "profiles", `account-${accountId}`);

    log(`📂 Using profile: ${profilePath}`);

    // Launch browser with persistent context
    browser = await chromium.launchPersistentContext(profilePath, {
      headless: false,
      viewport: { width: 1280, height: 900 },
      locale: "en-US",
      timezoneId: "Europe/Rome",
      userAgent: account.userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      args: [
        "--disable-blink-features=AutomationControlled",
        "--disable-dev-shm-usage",
      ],
      ignoreDefaultArgs: ["--enable-automation"],
    });

    const pages = browser.pages();
    const page = pages.length > 0 ? pages[0] : await browser.newPage();
    await page.addInitScript(STEALTH_SCRIPT);

    // Restore cookies from database session
    const sessionData = account.sessionData as { cookies?: any[] };
    if (sessionData.cookies && sessionData.cookies.length > 0) {
      await browser.addCookies(sessionData.cookies);
    }

    // Navigate to Messenger
    log(`📬 Opening Messenger...`);
    await page.goto("https://www.facebook.com/messages/t/", { waitUntil: "load", timeout: 30000 });
    await humanDelay(3000, 4000);

    // Scroll to load more conversations
    log(`📜 Scrolling to load conversations (${scrollCount} scrolls)...`);
    for (let i = 0; i < scrollCount; i++) {
      await page.evaluate(() => {
        const chatList = document.querySelector('[aria-label="Chats"]') || 
                        document.querySelector('[role="navigation"]') ||
                        document.querySelector('[data-pagelet="MWThreadList"]');
        if (chatList) {
          chatList.scrollTop = chatList.scrollHeight;
        }
      });
      await humanDelay(1500, 2500);
    }

    log(`⏳ Waiting for conversations to load...`);
    await humanDelay(2000, 3000);

    // Extract conversations from the sidebar
    log(`📋 Extracting conversation list...`);
    
    const conversations = await page.evaluate((maxConvs: number) => {
      const convos: ConversationPreview[] = [];
      
      // Get all links to conversations
      const allLinks = document.querySelectorAll('a[href*="/messages/t/"]');
      
      allLinks.forEach((link, index) => {
        if (index >= maxConvs) return;
        
        const href = link.getAttribute('href') || '';
        const parent = link.closest('[role="row"], [role="listitem"], div');
        
        // Get contact name - look for the main text in the link
        let name = '';
        const nameSpan = link.querySelector('span[dir="auto"]');
        if (nameSpan) {
          name = nameSpan.textContent?.trim() || '';
        }
        if (!name) {
          name = link.textContent?.trim() || '';
        }
        
        // Clean up the name - take just the first reasonable part
        if (name.length > 100) {
          const parts = name.split('\n');
          name = parts[0]?.trim() || name.substring(0, 50);
        }
        
        // Get message preview
        let lastMessage = '';
        const textNodes = parent?.querySelectorAll('span[dir="auto"]');
        textNodes?.forEach(node => {
          const text = node.textContent?.trim() || '';
          if (text.length > lastMessage.length && text !== name && text.length < 300) {
            lastMessage = text;
          }
        });
        
        // Check for unread indicator
        const hasUnread = parent?.querySelector('[aria-label*="unread"], [aria-label*="Unread"]') !== null ||
                         parent?.classList.contains('unread') ||
                         (parent?.querySelector('span[style*="font-weight: bold"]') !== null);
        
        if (name && name.length > 0 && name.length < 100) {
          // Extract FB ID from URL if possible
          const fbIdMatch = href.match(/\/messages\/t\/(\d+)/);
          const fbId = fbIdMatch ? fbIdMatch[1] : null;
          
          // Try to get profile URL
          let profileUrl: string | null = null;
          if (fbId) {
            profileUrl = `https://www.facebook.com/profile.php?id=${fbId}`;
          }
          
          convos.push({
            contactName: name,
            contactUrl: profileUrl,
            conversationUrl: href.startsWith('http') ? href : `https://www.facebook.com${href}`,
            lastMessage: lastMessage.substring(0, 200),
            timestamp: '',
            isUnread: hasUnread,
          });
        }
      });
      
      return convos;
    }, maxConversations);

    // Dedupe by name
    const uniqueConversations = conversations.filter((conv, index, self) => 
      index === self.findIndex(c => c.contactName === conv.contactName)
    );

    result.totalScraped = uniqueConversations.length;
    log(`✅ Found ${result.totalScraped} unique conversations`);

    // Get all leads for matching
    const allLeads = await prisma.lead.findMany({
      select: {
        id: true,
        authorName: true,
        authorProfileUrl: true,
        authorFbId: true,
        postText: true,
      },
    });

    log(`📊 Loaded ${allLeads.length} leads for matching`);

    // Get existing MessengerContacts for this account
    const existingContacts = await prisma.messengerContact.findMany({
      where: { accountId },
      select: { contactName: true, leadId: true },
    });

    const existingContactNames = new Set(existingContacts.map(c => c.contactName.toLowerCase()));
    log(`📌 Found ${existingContacts.length} existing contacts`);

    // Process each conversation
    for (const conv of uniqueConversations) {
      const convResult = {
        contactName: conv.contactName,
        contactUrl: conv.contactUrl,
        matched: false,
        leadId: null as string | null,
        authorName: null as string | null,
        status: "unmatched" as "created" | "existed" | "unmatched",
      };

      // Check if already exists
      if (existingContactNames.has(conv.contactName.toLowerCase())) {
        convResult.status = "existed";
        convResult.matched = true;
        const existing = existingContacts.find(c => c.contactName.toLowerCase() === conv.contactName.toLowerCase());
        convResult.leadId = existing?.leadId || null;
        result.alreadyExisted++;
        log(`  ⏭️ "${conv.contactName}" - already exists`);
        result.conversations.push(convResult);
        continue;
      }

      // Try to match to a lead
      let matchedLead = null;

      // 1. Match by exact name
      matchedLead = allLeads.find(lead => 
        lead.authorName && 
        lead.authorName.toLowerCase().trim() === conv.contactName.toLowerCase().trim()
      );

      // 2. Match by partial name (name contains or contained in)
      if (!matchedLead) {
        matchedLead = allLeads.find(lead => {
          if (!lead.authorName) return false;
          const leadName = lead.authorName.toLowerCase().trim();
          const contactName = conv.contactName.toLowerCase().trim();
          return leadName.includes(contactName) || contactName.includes(leadName);
        });
      }

      // 3. Match by FB ID in URL
      if (!matchedLead && conv.contactUrl) {
        const fbIdMatch = conv.contactUrl.match(/id=(\d+)/);
        if (fbIdMatch) {
          const fbId = fbIdMatch[1];
          matchedLead = allLeads.find(lead => 
            lead.authorFbId === fbId || 
            (lead.authorProfileUrl && lead.authorProfileUrl.includes(fbId))
          );
        }
      }

      if (matchedLead) {
        // Check if lead already has a MessengerContact
        const leadHasContact = existingContacts.find(c => c.leadId === matchedLead!.id);
        if (leadHasContact) {
          convResult.status = "existed";
          convResult.matched = true;
          convResult.leadId = matchedLead.id;
          convResult.authorName = matchedLead.authorName;
          result.alreadyExisted++;
          log(`  ⏭️ "${conv.contactName}" - lead already has contact`);
        } else {
          // Create new MessengerContact
          try {
            await prisma.messengerContact.create({
              data: {
                accountId,
                contactName: conv.contactName,
                conversationUrl: conv.conversationUrl || `https://www.facebook.com/messages/t/`,
                leadId: matchedLead.id,
                status: "ACTIVE",
                state: "NEW",
                lastActivityAt: new Date(),
              },
            });
            convResult.status = "created";
            convResult.matched = true;
            convResult.leadId = matchedLead.id;
            convResult.authorName = matchedLead.authorName;
            result.created++;
            result.matchedToLeads++;
            log(`  ✅ "${conv.contactName}" → Lead: ${matchedLead.authorName} (${matchedLead.id})`);
          } catch (error) {
            result.errors.push(`Failed to create contact for ${conv.contactName}: ${error}`);
            log(`  ❌ Failed to create contact for "${conv.contactName}"`);
          }
        }
      } else {
        // No match found
        convResult.status = "unmatched";
        result.unmatched++;
        log(`  ⚪ "${conv.contactName}" - no matching lead`);
      }

      result.conversations.push(convResult);
    }

    result.logs = logs;
    result.success = true;

    log(`\n📊 Summary:`);
    log(`  Total scraped: ${result.totalScraped}`);
    log(`  Matched & created: ${result.created}`);
    log(`  Already existed: ${result.alreadyExisted}`);
    log(`  Unmatched: ${result.unmatched}`);

    // Keep browser open for verification
    log(`\n🔍 Browser stays open for verification`);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Init conversations error:", error);
    result.errors.push(error instanceof Error ? error.message : "Unknown error");
    result.logs = logs;
    return NextResponse.json(result, { status: 500 });
  }
}
