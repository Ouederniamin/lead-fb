import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { chromium, BrowserContext, Page } from "playwright";
import * as path from "path";
import * as fs from "fs";
import { prisma } from "@/lib/db";
import { ConversationStateEnum, ContactStatus } from "@prisma/client";
import * as crypto from "crypto";

// ============================================
// CONVERSATION TRACKING TEST
// Uses database for accounts and MessengerContact states
// ============================================

// Stealth script
const STEALTH_SCRIPT = `
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
Object.defineProperty(navigator, 'languages', { get: () => ['it-IT', 'it', 'en-US', 'en'] });
window.chrome = { runtime: {} };
`;

// Human-like delay
async function humanDelay(min: number, max: number): Promise<void> {
  const delay = min + Math.random() * (max - min);
  await new Promise(resolve => setTimeout(resolve, delay));
}

// Generate hash for quick check
function generateHash(text: string): string {
  return crypto.createHash("md5").update(text).digest("hex").substring(0, 16);
}

// ============================================
// TYPES
// ============================================

interface ConversationSummary {
  contactFbId: string;
  contactName: string;
  conversationUrl: string;
  hasUnreadBadge: boolean;
  lastMessagePreview: string;
  lastMessageIsOurs?: boolean;
}

interface MessageCount {
  total: number;
  theirs: number;
  ours: number;
  lastMessageText?: string;
  lastMessageHash?: string;
  lastMessageIsTheirs: boolean;
  last3MessagesHash?: string;
}

interface StateChange {
  contact: string;
  from: string;
  to: string;
  reason: string;
}

interface TestResult {
  success: boolean;
  action: string;
  states: Array<{
    id: string;
    contactName: string;
    contactFbId: string | null;
    conversationUrl: string;
    state: string | null;
    totalMessageCount: number;
    theirMessageCount: number;
    ourMessageCount: number;
    quickCheckHash: string | null;
    lastTheirMessage: string | null;
    lastCheckedAt: string | null;
    conversationEnded: boolean;
    lastMessageIsOurs?: boolean;
  }>;
  changes: StateChange[];
  logs: string[];
  errors: string[];
}

// ============================================
// BROWSER HELPERS
// ============================================

// Dismiss popups like notification permission and PIN dialogs
async function dismissPopups(page: Page, log: (msg: string) => void, conversationPin?: string | null): Promise<boolean> {
  let pinEntered = false;

  // Dismiss notification permission popup - click "Block"
  try {
    const blockBtn = await page.$('button:has-text("Block"), [aria-label*="Block"], [aria-label*="Blocca"]');
    if (blockBtn) {
      await blockBtn.click();
      log("   🔕 Dismissed notification permission popup");
      await humanDelay(500, 800);
    }
  } catch {
    // Ignore
  }

  // Handle E2EE PIN restore dialog - enter PIN if available, otherwise close
  try {
    // Check if PIN dialog is visible - look for single input with aria-label="PIN", autocomplete="one-time-code", and maxlength="6"
    const pinInput = await page.$('[role="dialog"] input[aria-label="PIN"][autocomplete="one-time-code"][maxlength="6"]');
    
    if (pinInput) {
      // PIN dialog is open
      if (conversationPin && conversationPin.length === 6) {
        log("   🔐 Entering conversation PIN...");
        
        // Focus the input directly using JavaScript to bypass any overlay
        await pinInput.evaluate((el: HTMLInputElement) => el.focus());
        await humanDelay(200, 300);
        
        // Clear any existing value and type the PIN
        await pinInput.evaluate((el: HTMLInputElement) => el.value = '');
        await pinInput.type(conversationPin, { delay: 80 });
        
        log("   ✅ PIN entered successfully");
        pinEntered = true;
        await humanDelay(1000, 1500);
        
        // Wait for dialog to close or check for error
        await humanDelay(1500, 2000);
        
        // Check if still visible (wrong PIN)
        const stillVisible = await page.$('[role="dialog"]:has-text("PIN")');
        if (stillVisible) {
          const errorText = await page.$('text=Incorrect PIN');
          if (errorText) {
            log("   ⚠️ Incorrect PIN - closing dialog");
            // Close the dialog
            const closeBtn = await page.$('[role="dialog"] [aria-label*="Close"], [role="dialog"] [aria-label*="Chiudi"]');
            if (closeBtn) {
              await closeBtn.click();
              await humanDelay(500, 800);
            }
            pinEntered = false;
          }
        }
      } else {
        // No PIN available, close the dialog
        log("   ⚠️ PIN dialog detected but no PIN configured - closing");
        const closeBtn = await page.$('[role="dialog"] [aria-label*="Close"], [role="dialog"] [aria-label*="Chiudi"]');
        if (closeBtn) {
          await closeBtn.click();
          await humanDelay(500, 800);
        }
      }
    }
  } catch (e) {
    log(`   ⚠️ Error handling PIN dialog: ${e}`);
  }

  // Generic: try to close any visible dialogs with an X button
  // BUT skip if it's the PIN dialog (we want to keep that open for PIN entry)
  try {
    // First check if PIN dialog is still open - don't close it
    const pinDialogStillOpen = await page.$('[role="dialog"] input[aria-label="PIN"][autocomplete="one-time-code"][maxlength="6"]');
    
    if (!pinDialogStillOpen) {
      // Safe to close other dialogs
      const dialogCloseButtons = await page.$$('[role="dialog"] [aria-label*="Close"], [role="dialog"] [aria-label*="Chiudi"]');
      for (const btn of dialogCloseButtons) {
        if (await btn.isVisible()) {
          await btn.click();
          log("   ❌ Closed a dialog");
          await humanDelay(300, 500);
          break;
        }
      }
    }
  } catch {
    // Ignore
  }

  return pinEntered;
}

async function extractConversationList(
  page: Page,
  log: (msg: string) => void,
  conversationPin?: string | null
): Promise<ConversationSummary[]> {
  log("📬 Navigating to Messenger...");
  await page.goto("https://www.facebook.com/messages/t/", { waitUntil: "domcontentloaded" });
  await humanDelay(2000, 3000);

  // Dismiss any popups
  await dismissPopups(page, log, conversationPin);

  // Scroll to load conversations
  log("📜 Scrolling to load conversations...");
  
  let previousCount = 0;
  let sameCountStreak = 0;
  const maxScrollAttempts = 10;

  for (let i = 0; i < maxScrollAttempts; i++) {
    const currentCount = await page.evaluate(() => {
      const links = document.querySelectorAll('a[href*="/messages/e2ee/t/"], a[href*="/messages/t/"]');
      const uniqueIds = new Set<string>();
      links.forEach(link => {
        const href = link.getAttribute('href') || '';
        const match = href.match(/\/messages\/(?:e2ee\/)?t\/(\d+)/);
        if (match) uniqueIds.add(match[1]);
      });
      return uniqueIds.size;
    });

    log(`   Scroll ${i + 1}: Found ${currentCount} conversations`);

    if (currentCount === previousCount) {
      sameCountStreak++;
      if (sameCountStreak >= 3) {
        log(`   ✓ No more conversations loading`);
        break;
      }
    } else {
      sameCountStreak = 0;
    }
    previousCount = currentCount;

    // Scroll
    await page.evaluate(() => {
      const conversationLink = document.querySelector('a[href*="/messages/t/"]');
      if (conversationLink) {
        let parent = conversationLink.parentElement;
        while (parent) {
          const style = window.getComputedStyle(parent);
          const isScrollable = (
            parent.scrollHeight > parent.clientHeight &&
            (style.overflowY === 'auto' || style.overflowY === 'scroll')
          );
          if (isScrollable && parent.clientHeight > 100) {
            parent.scrollTop = parent.scrollHeight;
            return;
          }
          parent = parent.parentElement;
        }
      }
    });

    await humanDelay(1000, 1500);
  }

  // Extract conversations from sidebar with aria-label="Chats" and role="grid"
  log("📋 Extracting conversation details from sidebar...");

  const conversations = await page.evaluate(() => {
    const results: ConversationSummary[] = [];
    
    // Find the sidebar grid with role="grid" and aria-label="Chats"
    const sidebar = document.querySelector('[role="grid"][aria-label="Chats"], [role="grid"][aria-label="Chat"]');
    if (!sidebar) {
      // Fallback: try to find conversation rows directly
      console.log('Sidebar not found, using fallback');
    }
    
    // Get all row elements (conversation items)
    const rows = sidebar 
      ? sidebar.querySelectorAll('[role="row"]')
      : document.querySelectorAll('[role="row"]');

    for (const row of Array.from(rows)) {
      const link = row.querySelector('a[href*="/messages/e2ee/t/"], a[href*="/messages/t/"]') as HTMLAnchorElement;
      if (!link) continue;

      const href = link.getAttribute('href') || '';
      const match = href.match(/\/messages\/(?:e2ee\/)?t\/(\d+)/);
      if (!match) continue;

      const contactFbId = match[1];
      const conversationUrl = `https://www.facebook.com${href}`;

      // Find name - it's the first span[dir="auto"] > span in the conversation item
      let contactName = '';
      const nameContainer = row.querySelector('span[dir="auto"]');
      if (nameContainer) {
        const nameSpan = nameContainer.querySelector('span');
        if (nameSpan && nameSpan.textContent) {
          contactName = nameSpan.textContent.trim();
        }
      }
      
      // Fallback for name: look for bold/semibold text
      if (!contactName) {
        const spans = row.querySelectorAll('span');
        for (const span of Array.from(spans)) {
          const style = window.getComputedStyle(span);
          const fw = parseInt(style.fontWeight);
          if (fw >= 600 && span.textContent && span.textContent.trim().length > 1) {
            const text = span.textContent.trim();
            if (!text.includes('•') && !text.match(/^\d+[smhd]?$/) && !text.includes('Reply')) {
              contactName = text;
              break;
            }
          }
        }
      }

      if (!contactName) continue;

      // Find last message - it's in the div after the height:8px spacer
      let lastMessagePreview = '';
      const spacer = row.querySelector('div[style="height: 8px;"]');
      if (spacer && spacer.nextElementSibling) {
        const messageRow = spacer.nextElementSibling;
        // Get the first span with dir="auto" which contains the message
        const messageSpan = messageRow.querySelector('span[dir="auto"] > span');
        if (messageSpan && messageSpan.textContent) {
          let msgText = messageSpan.textContent.trim();
          // Clean up: remove time/date markers and "Reply?" suffix
          if (!msgText.match(/^\d+[smhd]?$/) && msgText !== 'Reply?') {
            lastMessagePreview = msgText;
          }
        }
      }
      
      // Fallback for message preview
      if (!lastMessagePreview) {
        const allDirAuto = row.querySelectorAll('span[dir="auto"] > span');
        for (let i = 1; i < allDirAuto.length; i++) { // Skip first (name)
          const span = allDirAuto[i];
          const text = span.textContent?.trim() || '';
          if (text.length > 2 && !text.match(/^\d+[smhd]?$/) && text !== 'Reply?' && !text.includes('·')) {
            lastMessagePreview = text;
            break;
          }
        }
      }

      // Check if last message is from us (starts with "You:")
      let lastMessageIsOurs = false;
      if (lastMessagePreview.startsWith('You:') || lastMessagePreview.startsWith('Tu:')) {
        lastMessageIsOurs = true;
        // Remove the "You:" prefix for cleaner display
        lastMessagePreview = lastMessagePreview.replace(/^(You:|Tu:)\s*/, '');
      }

      // Check for Facebook system messages - skip these conversations
      const isSystemMessage = 
        lastMessagePreview.includes("You're now friends with") ||
        lastMessagePreview.includes("You are now connected on Messenger") ||
        lastMessagePreview.includes("Messages and calls are secured with end-to-end") ||
        lastMessagePreview === "Message unavailable" ||
        contactName === "Facebook user" ||
        contactName === "Meta Business Support";

      if (isSystemMessage) continue;

      // Check for unread badge
      const hasUnreadBadge = row.querySelector('[aria-label*="unread"], [aria-label*="non letti"], [aria-label*="non letto"]') !== null;

      results.push({
        contactFbId,
        contactName,
        conversationUrl,
        hasUnreadBadge,
        lastMessagePreview,
        lastMessageIsOurs,
      });
    }

    return results;
  });

  log(`   ✅ Found ${conversations.length} conversations`);
  return conversations;
}

async function countMessagesInConversation(
  page: Page,
  conversationUrl: string,
  contactName: string,
  log: (msg: string) => void,
  conversationPin?: string | null
): Promise<MessageCount> {
  await page.goto(conversationUrl, { waitUntil: "domcontentloaded" });
  await humanDelay(1500, 2500);

  // Dismiss any popups (PIN dialog, etc.)
  await dismissPopups(page, log, conversationPin);

  // Count messages
  const counts = await page.evaluate((contactNameArg) => {
    const rows = document.querySelectorAll('[role="row"]');
    let theirs = 0;
    let ours = 0;
    let lastMessageText = '';
    let lastMessageIsTheirs = false;
    const last3Messages: string[] = [];

    for (const row of Array.from(rows)) {
      // Check for message content
      const messageContent = row.querySelector('[data-scope="messages_table"]');
      if (!messageContent) continue;

      // Check if it's their message or ours
      const isTheirs = row.querySelector(`[aria-label*="${contactNameArg}"]`) !== null ||
        row.querySelector('.x1n2onr6.x1ja2u2z') !== null;

      if (isTheirs) {
        theirs++;
      } else {
        // Check if it's our message (not system message)
        const textContent = messageContent.textContent?.trim() || '';
        if (textContent.length > 0) {
          ours++;
        }
      }

      // Track last messages
      const msgText = messageContent.textContent?.trim() || '';
      if (msgText) {
        last3Messages.push(msgText);
        if (last3Messages.length > 3) last3Messages.shift();
        lastMessageText = msgText;
        lastMessageIsTheirs = isTheirs;
      }
    }

    return {
      theirs,
      ours,
      total: theirs + ours,
      lastMessageText,
      lastMessageIsTheirs,
      last3Text: last3Messages.join('|||'),
    };
  }, contactName);

  return {
    total: counts.total,
    theirs: counts.theirs,
    ours: counts.ours,
    lastMessageText: counts.lastMessageText,
    lastMessageHash: counts.lastMessageText ? generateHash(counts.lastMessageText) : undefined,
    lastMessageIsTheirs: counts.lastMessageIsTheirs,
    last3MessagesHash: counts.last3Text ? generateHash(counts.last3Text) : undefined,
  };
}

function determineState(
  counts: MessageCount,
  existing: { theirMessageCount: number; ourMessageCount: number; state: ConversationStateEnum | null } | null,
  hasUnreadBadge: boolean
): { state: ConversationStateEnum; reason: string } {
  // If unread badge, they replied
  if (hasUnreadBadge) {
    return { state: ConversationStateEnum.NEEDS_REPLY, reason: 'Unread badge detected' };
  }

  // New conversation
  if (!existing) {
    if (counts.theirs > 0 && counts.ours === 0) {
      return { state: ConversationStateEnum.NEEDS_REPLY, reason: 'They messaged, we haven\'t replied' };
    }
    if (counts.ours > 0 && counts.theirs === 0) {
      return { state: ConversationStateEnum.WAITING, reason: 'We messaged, waiting for reply' };
    }
    if (counts.theirs > counts.ours) {
      return { state: ConversationStateEnum.NEEDS_REPLY, reason: 'More messages from them' };
    }
    if (counts.ours > counts.theirs) {
      return { state: ConversationStateEnum.WAITING, reason: 'We sent more, waiting for reply' };
    }
    return { state: ConversationStateEnum.NEW, reason: 'New balanced conversation' };
  }

  // Existing - check for changes
  const theirNew = counts.theirs - existing.theirMessageCount;
  const ourNew = counts.ours - existing.ourMessageCount;

  if (theirNew > 0) {
    return { state: ConversationStateEnum.NEEDS_REPLY, reason: `They sent ${theirNew} new message(s)` };
  }
  if (ourNew > 0) {
    return { state: ConversationStateEnum.WAITING, reason: `We sent ${ourNew} new message(s)` };
  }

  return { state: existing.state || ConversationStateEnum.ACTIVE, reason: 'No change detected' };
}

// ============================================
// API ROUTE
// ============================================

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let browser: BrowserContext | null = null;
  const result: TestResult = {
    success: false,
    action: 'init',
    states: [],
    changes: [],
    logs: [],
    errors: [],
  };

  const log = (msg: string) => {
    console.log(`[ConvTracking] ${msg}`);
    result.logs.push(msg);
  };

  try {
    const body = await request.json();
    const { accountId, action = 'scan', onlyContact = null, endAtContact = '' } = body;

    if (!accountId) {
      return NextResponse.json({ error: "accountId is required" }, { status: 400 });
    }

    result.action = action;

    // Find the account FROM DATABASE
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found in database" }, { status: 404 });
    }

    // Check profile exists
    const profilePath = path.join(process.cwd(), "worker", "profiles", accountId);
    if (!fs.existsSync(profilePath)) {
      return NextResponse.json({ error: "No saved session for account" }, { status: 400 });
    }

    log(`🚀 Conversation Tracking Test - Action: ${action}`);
    log(`📱 Using account: ${account.name || account.email}`);

    // Load existing states FROM DATABASE
    const existingContacts = await prisma.messengerContact.findMany({
      where: {
        accountId: accountId,
        status: ContactStatus.ACTIVE,
      },
      orderBy: { lastActivityAt: 'desc' },
    });
    log(`📂 Loaded ${existingContacts.length} existing contacts from database`);

    // Launch browser - block notifications by default
    browser = await chromium.launchPersistentContext(profilePath, {
      headless: false,
      viewport: { width: 1366, height: 768 },
      locale: "it-IT",
      timezoneId: "Europe/Rome",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      args: ["--disable-blink-features=AutomationControlled", "--disable-dev-shm-usage", "--disable-notifications"],
      ignoreDefaultArgs: ["--enable-automation"],
      permissions: [], // Block all permissions including notifications
    });

    const pages = browser.pages();
    const page = pages.length > 0 ? pages[0] : await browser.newPage();
    await page.addInitScript(STEALTH_SCRIPT);

    // ============================================
    // ACTION: INITIALIZE
    // ============================================
    if (action === 'init') {
      log("🔄 INITIALIZING - Building state for all conversations...");

      const conversations = await extractConversationList(page, log, account.conversationPin);

      // Handle endAtContact
      let endIndex = conversations.length;
      if (endAtContact && endAtContact.trim()) {
        const searchName = endAtContact.trim().toLowerCase();
        const foundIndex = conversations.findIndex(c =>
          c.contactName.toLowerCase().includes(searchName)
        );

        if (foundIndex !== -1) {
          endIndex = foundIndex + 1;
          log(`📍 Will process until contact "${conversations[foundIndex].contactName}"`);
        }
      }

      const toProcess = conversations.slice(0, Math.min(endIndex, 50));

      for (let i = 0; i < toProcess.length; i++) {
        const conv = toProcess[i];
        log(`\n📝 [${i + 1}/${toProcess.length}] ${conv.contactName}...`);

        try {
          const counts = await countMessagesInConversation(page, conv.conversationUrl, conv.contactName, log, account.conversationPin);

          const existing = existingContacts.find(c => c.contactName === conv.contactName) || null;
          const { state: newState, reason } = determineState(counts, existing, conv.hasUnreadBadge);

          // Upsert to database
          const upserted = await prisma.messengerContact.upsert({
            where: {
              accountId_contactName: {
                accountId: accountId,
                contactName: conv.contactName,
              },
            },
            update: {
              contactFbId: conv.contactFbId,
              conversationUrl: conv.conversationUrl,
              state: newState,
              totalMessageCount: counts.total,
              theirMessageCount: counts.theirs,
              ourMessageCount: counts.ours,
              quickCheckHash: counts.last3MessagesHash,
              lastTheirMessage: counts.lastMessageIsTheirs ? counts.lastMessageText : undefined,
              lastCheckedAt: new Date(),
              lastActivityAt: new Date(),
            },
            create: {
              accountId: accountId,
              contactName: conv.contactName,
              contactFbId: conv.contactFbId,
              conversationUrl: conv.conversationUrl,
              state: newState,
              status: ContactStatus.ACTIVE,
              totalMessageCount: counts.total,
              theirMessageCount: counts.theirs,
              ourMessageCount: counts.ours,
              quickCheckHash: counts.last3MessagesHash,
              lastTheirMessage: counts.lastMessageIsTheirs ? counts.lastMessageText : undefined,
              lastCheckedAt: new Date(),
              lastActivityAt: new Date(),
            },
          });

          if (!existing) {
            result.changes.push({
              contact: conv.contactName,
              from: 'NONE',
              to: newState,
              reason,
            });
          }

          log(`   ✅ ${newState} (${reason})`);
        } catch (error) {
          log(`   ❌ Error: ${error}`);
          result.errors.push(`${conv.contactName}: ${error}`);
        }

        await humanDelay(500, 1000);
      }
    }

    // ============================================
    // ACTION: SCAN (Scan all conversations in sidebar)
    // ============================================
    else if (action === 'scan') {
      log("📋 SIDEBAR SCAN - Extracting all conversations...");

      const conversations = await extractConversationList(page, log, account.conversationPin);

      log(`   Found ${conversations.length} conversations in sidebar`);

      // Return all conversations with their details
      for (const conv of conversations) {
        const existing = existingContacts.find(c => c.contactName === conv.contactName || c.contactFbId === conv.contactFbId);

        result.states.push({
          id: existing?.id || '',
          contactName: conv.contactName,
          contactFbId: conv.contactFbId,
          conversationUrl: conv.conversationUrl,
          state: existing?.state || null,
          totalMessageCount: existing?.totalMessageCount || 0,
          theirMessageCount: existing?.theirMessageCount || 0,
          ourMessageCount: existing?.ourMessageCount || 0,
          quickCheckHash: existing?.quickCheckHash || null,
          lastTheirMessage: conv.lastMessagePreview || existing?.lastTheirMessage || null,
          lastCheckedAt: existing?.lastCheckedAt?.toISOString() || null,
          conversationEnded: existing?.state === ConversationStateEnum.ENDED,
          lastMessageIsOurs: conv.lastMessageIsOurs || false,
        });

        // Log each conversation
        const status = existing ? `[${existing.state}]` : '[NEW]';
        const sender = conv.lastMessageIsOurs ? '(You)' : '';
        log(`   ${status} ${conv.contactName}: ${sender}"${conv.lastMessagePreview?.substring(0, 50) || 'No preview'}..."`);
      }
    }

    // ============================================
    // ACTION: COUNT (Deep scan - quick check hash)
    // ============================================
    else if (action === 'count') {
      log("🔍 DEEP SCAN - Quick check hash comparison...");

      // Get contacts to check
      let toCheck = existingContacts.filter(c => c.state !== ConversationStateEnum.ENDED).slice(0, 10);

      if (onlyContact) {
        toCheck = existingContacts.filter(c =>
          c.contactName.toLowerCase().includes(onlyContact.toLowerCase())
        );
      }

      log(`   Checking ${toCheck.length} conversations...`);

      for (const contact of toCheck) {
        log(`\n📝 ${contact.contactName}...`);

        try {
          const counts = await countMessagesInConversation(page, contact.conversationUrl, contact.contactName, log, account.conversationPin);

          // Compare quick check hash
          const hashChanged = contact.quickCheckHash !== counts.last3MessagesHash;
          const theirNew = counts.theirs - contact.theirMessageCount;
          const ourNew = counts.ours - contact.ourMessageCount;

          if (hashChanged || theirNew > 0 || ourNew > 0) {
            log(`   🔔 Changes detected! Hash: ${hashChanged ? 'changed' : 'same'}, Their +${theirNew}, Ours +${ourNew}`);

            const { state: newState, reason } = determineState(counts, contact, false);

            await prisma.messengerContact.update({
              where: { id: contact.id },
              data: {
                previousState: contact.state,
                state: newState,
                stateChangedAt: newState !== contact.state ? new Date() : undefined,
                totalMessageCount: counts.total,
                theirMessageCount: counts.theirs,
                ourMessageCount: counts.ours,
                quickCheckHash: counts.last3MessagesHash,
                lastTheirMessage: counts.lastMessageIsTheirs ? counts.lastMessageText : contact.lastTheirMessage,
                lastTheirMessageAt: counts.lastMessageIsTheirs ? new Date() : undefined,
                lastCheckedAt: new Date(),
                lastActivityAt: new Date(),
              },
            });

            if (newState !== contact.state) {
              result.changes.push({
                contact: contact.contactName,
                from: contact.state || 'UNKNOWN',
                to: newState,
                reason,
              });
            }
          } else {
            log(`   ✓ No changes`);

            await prisma.messengerContact.update({
              where: { id: contact.id },
              data: { lastCheckedAt: new Date() },
            });
          }
        } catch (error) {
          log(`   ❌ Error: ${error}`);
        }

        await humanDelay(500, 800);
      }
    }

    // ============================================
    // DONE - Return results
    // ============================================

    // For scan action, we already have the states populated from sidebar
    // For other actions, reload states from database
    if (action !== 'scan') {
      const finalContacts = await prisma.messengerContact.findMany({
        where: {
          accountId: accountId,
          status: ContactStatus.ACTIVE,
        },
        orderBy: { lastActivityAt: 'desc' },
        take: 50,
      });

      result.states = finalContacts.map(c => ({
        id: c.id,
        contactName: c.contactName,
        contactFbId: c.contactFbId,
        conversationUrl: c.conversationUrl,
        state: c.state,
        totalMessageCount: c.totalMessageCount,
        theirMessageCount: c.theirMessageCount,
        ourMessageCount: c.ourMessageCount,
        quickCheckHash: c.quickCheckHash,
        lastTheirMessage: c.lastTheirMessage,
        lastCheckedAt: c.lastCheckedAt?.toISOString() || null,
        conversationEnded: c.conversationEnded,
      }));
    }

    result.success = true;
    log(`\n✅ Done! ${result.changes.length} changes, ${result.states.length} conversations tracked`);

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log(`❌ Error: ${errorMsg}`);
    result.errors.push(errorMsg);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return NextResponse.json(result);
}
