import { NextRequest, NextResponse } from "next/server";
import { chromium, Browser, Page } from "playwright";
import prisma from "@/lib/db";
import { ConversationStateEnum } from "@prisma/client";

// E2EE PIN selectors - matches the working version from conversation-pin
const PIN_DIALOG_SELECTOR = '[role="dialog"] input[aria-label="PIN"][autocomplete="one-time-code"][maxlength="6"]';

// System messages to filter out
const SYSTEM_MESSAGE_PATTERNS = [
  "You're now friends",
  "Messages and calls are secured",
  "Message unavailable",
  "sent a link",
  "Say hi to your new Facebook friend",
  "Meta Business Support",
  "Facebook user",
];

export async function POST(request: NextRequest) {
  let browser: Browser | null = null;
  const logs: string[] = [];
  const errors: string[] = [];

  function log(msg: string) {
    logs.push(msg);
    console.log(`[AGENT] ${msg}`);
  }

  try {
    const body = await request.json();
    const { accountId, autoReply = false } = body;

    if (!accountId) {
      return NextResponse.json({ success: false, errors: ["accountId required"] }, { status: 400 });
    }

    // Get account with PIN
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return NextResponse.json({ success: false, errors: ["Account not found"] }, { status: 404 });
    }

    // Step 1: Load last 40 contacts from database
    log("Step 1: Loading contacts from database...");
    const dbContacts = await prisma.messengerContact.findMany({
      where: { accountId },
      orderBy: { lastActivityAt: "desc" },
      take: 40,
      select: {
        id: true,
        contactName: true,
        contactFbId: true,
        lastTheirMessage: true,
        lastMessageIsOurs: true,
        state: true,
        conversationUrl: true,
      },
    });

    // Build Map for O(1) lookup
    const dbMap = new Map(
      dbContacts.map(c => [c.contactName, c])
    );
    log(`  Loaded ${dbContacts.length} contacts into memory`);

    // Check for session data in database
    if (!account.sessionData) {
      return NextResponse.json({ 
        success: false, 
        errors: ["No session data found for this account. Please login first."] 
      }, { status: 400 });
    }

    log("Step 2: Launching browser & checking E2EE PIN...");
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
      storageState: account.sessionData as any,
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();

    // Navigate to Messenger
    await page.goto("https://www.facebook.com/messages/t/", { 
      waitUntil: "domcontentloaded",
      timeout: 30000 
    });
    await page.waitForTimeout(3000);

    // Check for E2EE PIN dialog (ALWAYS check on every browser open!)
    const pinEntered = await checkAndEnterPin(page, account.conversationPin || "", log);

    // Step 3: Scan sidebar
    log("Step 3: Scanning sidebar...");
    const sidebarConversations = await extractSidebarConversations(page, log);
    log(`  Found ${sidebarConversations.length} conversations in sidebar`);

    // Step 4: Compare in memory
    log("Step 4: Comparing with database (in memory)...");
    const newMessages: { contactName: string; message: string; contactId: string }[] = [];
    const needsReplyIds: string[] = [];

    for (const conv of sidebarConversations) {
      const existing = dbMap.get(conv.contactName);
      
      if (!existing) {
        log(`  New contact not in DB: ${conv.contactName}`);
        continue;
      }

      // Skip if last message is from us
      if (conv.lastMessageIsOurs) {
        continue;
      }

      // Compare sidebar message with stored message
      if (existing.lastTheirMessage !== conv.lastMessage && !conv.lastMessageIsOurs) {
        log(`  📨 NEW MESSAGE: ${conv.contactName}`);
        log(`     Old: "${existing.lastTheirMessage?.substring(0, 30)}..."`);
        log(`     New: "${conv.lastMessage.substring(0, 30)}..."`);
        
        newMessages.push({
          contactName: conv.contactName,
          message: conv.lastMessage,
          contactId: existing.id,
        });
        needsReplyIds.push(existing.id);
      }
    }

    log(`  Detected ${newMessages.length} new messages`);

    // Step 5: Batch update database
    if (needsReplyIds.length > 0) {
      log("Step 5: Updating database...");
      await prisma.messengerContact.updateMany({
        where: { id: { in: needsReplyIds } },
        data: {
          state: "NEEDS_REPLY",
          lastActivityAt: new Date(),
        },
      });

      // Update each contact's lastTheirMessage
      for (const msg of newMessages) {
        await prisma.messengerContact.update({
          where: { id: msg.contactId },
          data: { lastTheirMessage: msg.message },
        });
      }
      log(`  Updated ${needsReplyIds.length} contacts to NEEDS_REPLY`);
    }

    // Step 6: Process replies if autoReply is enabled
    const repliesSent: { contactName: string; reply: string }[] = [];

    if (autoReply && newMessages.length > 0) {
      log("Step 6: Generating and sending AI replies...");
      
      for (const msg of newMessages) {
        try {
          // Get full contact info
          const contact = await prisma.messengerContact.findUnique({
            where: { id: msg.contactId },
            include: { lead: true },
          });

          if (!contact) continue;

          // Open conversation
          log(`  Opening: ${msg.contactName}...`);
          const convLink = page.locator(`a[href*="/messages/t/"]`).filter({ hasText: msg.contactName }).first();
          
          if (await convLink.isVisible({ timeout: 3000 }).catch(() => false)) {
            await convLink.click({ force: true });
            await page.waitForTimeout(2000);

            // No per-conversation PIN check needed - already unlocked at browser open

            // Get business and services for AI context
            const business = await prisma.business.findFirst();
            const services = await prisma.service.findMany();

            // Generate AI reply
            const reply = await generateAIReply(
              msg.contactName,
              msg.message,
              contact.lead,
              business,
              services
            );

            if (reply) {
              // Find and type in message input
              const messageInput = page.locator('[role="textbox"][aria-label*="Message"]').first();
              if (await messageInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                await messageInput.click();
                await messageInput.fill(reply);
                await page.waitForTimeout(500);

                // Send message
                await page.keyboard.press("Enter");
                await page.waitForTimeout(1000);

                log(`  ✅ Sent reply to ${msg.contactName}`);
                repliesSent.push({ contactName: msg.contactName, reply });

                // Update state to WAITING (we sent, waiting for their reply)
                await prisma.messengerContact.update({
                  where: { id: msg.contactId },
                  data: {
                    state: ConversationStateEnum.WAITING,
                    lastMessageIsOurs: true,
                  },
                });
              }
            }
          }

        } catch (err) {
          log(`  ❌ Error replying to ${msg.contactName}: ${err}`);
          errors.push(`${msg.contactName}: ${err}`);
        }
      }
    }

    // Close browser
    await browser.close();
    browser = null;

    return NextResponse.json({
      success: true,
      pinEntered,
      checked: sidebarConversations.length,
      newMessages: newMessages.map(m => ({ contactName: m.contactName, message: m.message })),
      repliesSent,
      logs,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    errors.push(errMsg);
    console.error("[AGENT ERROR]", error);

    return NextResponse.json({
      success: false,
      checked: 0,
      newMessages: [],
      repliesSent: [],
      errors,
      logs,
    }, { status: 500 });

  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

// Check for E2EE PIN dialog and enter PIN if needed
async function checkAndEnterPin(page: Page, pin: string, log: (msg: string) => void): Promise<boolean> {
  try {
    // First check if PIN dialog already appeared
    let pinInput = await page.$(PIN_DIALOG_SELECTOR);

    if (!pinInput) {
      // No PIN dialog yet - click on any E2EE conversation to trigger it
      log("  Looking for E2EE conversation to trigger PIN dialog...");
      const e2eeLink = await page.$('a[href*="/messages/e2ee/t/"]');
      
      if (e2eeLink) {
        await e2eeLink.click({ force: true });
        log("  Clicked E2EE conversation");
        await page.waitForTimeout(2500);
      }

      // Check for PIN dialog again
      pinInput = await page.$(PIN_DIALOG_SELECTOR);
    }
    
    if (!pinInput) {
      return false;
    }

    log("  🔐 PIN dialog detected!");

    if (!pin || pin.length !== 6) {
      log("  ⚠️ No valid PIN configured (need 6 digits)");
      return false;
    }

    // Focus the input directly
    await pinInput.evaluate((el: HTMLInputElement) => el.focus());
    await page.waitForTimeout(200);
    
    // Clear any existing value and type the PIN
    await pinInput.evaluate((el: HTMLInputElement) => el.value = '');
    await pinInput.type(pin, { delay: 80 });
    
    log("  Entered 6-digit PIN, waiting for validation...");
    await page.waitForTimeout(3000);

    // Check if PIN input is gone (= PIN correct)
    const pinInputStillExists = await page.$(PIN_DIALOG_SELECTOR);
    const errorText = await page.$('text=Incorrect PIN');

    if (errorText) {
      log("  ❌ Incorrect PIN!");
      return false;
    } else if (!pinInputStillExists) {
      // Input element is gone = PIN was accepted!
      log("  ✅ PIN accepted! Input field removed.");
      return true;
    } else {
      // Input still exists but no error - might still be processing
      // Wait a bit more and check again
      await page.waitForTimeout(2000);
      const stillThere = await page.$(PIN_DIALOG_SELECTOR);
      if (!stillThere) {
        log("  ✅ PIN accepted after extra wait!");
        return true;
      }
      log("  ⚠️ PIN dialog still visible - may be incorrect");
      return false;
    }

  } catch (err) {
    log(`  PIN check error: ${err}`);
    return false;
  }
}

// Extract conversations from sidebar
async function extractSidebarConversations(page: Page, log: (msg: string) => void): Promise<any[]> {
  const conversations: any[] = [];

  try {
    // Get all conversation links (both regular and E2EE)
    const regularLinks = await page.locator('a[href*="/messages/t/"]').all();
    const e2eeLinks = await page.locator('a[href*="/messages/e2ee/t/"]').all();
    
    log(`  Found ${regularLinks.length} regular + ${e2eeLinks.length} E2EE conversation links`);
    
    // Combine all links
    const allLinks = [...regularLinks, ...e2eeLinks];

    for (const link of allLinks) {
      try {
        const href = await link.getAttribute("href");
        if (!href) continue;

        // Extract FB ID from URL (both regular and e2ee)
        const match = href.match(/\/messages\/(?:e2ee\/)?t\/(\d+)/);
        const contactFbId = match ? match[1] : null;

        // Get contact name
        const nameSpan = await link.locator('span[dir="auto"]').first();
        const contactName = await nameSpan.textContent().catch(() => null);

        if (!contactName) continue;

        // Skip system messages
        const lowerName = contactName.toLowerCase();
        if (SYSTEM_MESSAGE_PATTERNS.some(p => lowerName.includes(p.toLowerCase()))) {
          continue;
        }

        // Get last message preview
        let lastMessage = "";
        let lastMessageIsOurs = false;

        try {
          const previewSpan = await link.locator('span[dir="auto"]').nth(1);
          const preview = await previewSpan.textContent().catch(() => "");
          
          if (preview) {
            // Skip if preview contains system message patterns
            if (SYSTEM_MESSAGE_PATTERNS.some(p => preview.toLowerCase().includes(p.toLowerCase()))) {
              continue;
            }

            lastMessage = preview;
            if (preview.startsWith("You:")) {
              lastMessageIsOurs = true;
              lastMessage = preview.replace(/^You:\s*/, "");
            }
          }
        } catch {
          // Ignore preview extraction errors
        }

        conversations.push({
          contactName,
          contactFbId,
          lastMessage,
          lastMessageIsOurs,
        });

      } catch {
        // Skip this conversation
      }
    }

    // Remove duplicates
    const unique = conversations.filter((conv, index, self) =>
      index === self.findIndex(c => c.contactName === conv.contactName)
    );

    return unique;

  } catch (err) {
    log(`  Error extracting sidebar: ${err}`);
    return [];
  }
}

// Generate AI reply (simplified - you can expand this)
async function generateAIReply(
  contactName: string,
  message: string,
  lead: any,
  business: any,
  services: any[]
): Promise<string | null> {
  try {
    // Call your AI generation endpoint
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ai/generate-reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactName,
        lastMessage: message,
        lead,
        business,
        services,
      }),
    });

    if (!response.ok) {
      console.error("AI reply generation failed:", await response.text());
      return null;
    }

    const data = await response.json();
    return data.reply || null;

  } catch (err) {
    console.error("Error generating AI reply:", err);
    return null;
  }
}
