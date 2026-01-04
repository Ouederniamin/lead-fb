import { NextRequest, NextResponse } from "next/server";
import { chromium, Browser, Page } from "playwright";
import prisma from "@/lib/db";
import { ConversationStateEnum } from "@prisma/client";
import { generateObject } from "ai";
import { model } from "@/lib/ai";
import { z } from "zod";
import fs from 'fs/promises';
import path from 'path';

// E2EE PIN selectors - matches the working version from conversation-pin
const PIN_DIALOG_SELECTOR = '[role="dialog"] input[aria-label="PIN"][autocomplete="one-time-code"][maxlength="6"]';

// Business data file path
const BUSINESS_FILE = path.join(process.cwd(), 'data', 'business.json');

// Reply schema for AI generation - now returns array of messages
const ReplySchema = z.object({
  messages: z.array(z.string()).describe("Array of short messages to send consecutively. Each message should be 1-2 sentences max. Split your reply into multiple natural messages like a real chat conversation."),
  intent: z.enum(['greeting', 'qualify', 'propose', 'close', 'follow_up', 'objection_handling']).describe("The intent of this reply"),
  reasoning: z.string().describe("Why this reply was chosen"),
});

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
  
  // Cumulative stats for continuous mode
  let totalChecked = 0;
  const allNewMessages: { contactName: string; message: string; contactId: string }[] = [];
  const allRepliesSent: { contactName: string; reply: string }[] = [];
  let cycleCount = 0;

  function log(msg: string) {
    logs.push(msg);
    console.log(`[AGENT] ${msg}`);
  }

  try {
    const body = await request.json();
    const { accountId, idleTimeout = 0 } = body; // 0 = single cycle, >0 = continuous monitoring

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

    // Check for session data in database
    if (!account.sessionData) {
      return NextResponse.json({ 
        success: false, 
        errors: ["No session data found for this account. Please login first."] 
      }, { status: 400 });
    }

    log(idleTimeout > 0 
      ? `Starting CONTINUOUS monitoring (idle timeout: ${idleTimeout}s)...` 
      : "Starting SINGLE cycle...");
    
    log("Step 1: Launching browser & checking E2EE PIN...");
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

    // Dismiss any notification popups (like push notification requests)
    log("  Checking for notification popups to dismiss...");
    await dismissNotificationPopup(page, log);

    // Continuous monitoring loop
    let lastActivityTime = Date.now();
    const checkInterval = 30000; // 30 seconds between checks
    const isContinuousMode = idleTimeout > 0;

    do {
      cycleCount++;
      log(`\n═══ Cycle ${cycleCount} ═══`);

      // Step 2: Load contacts from database (refresh each cycle for up-to-date data)
      log("Loading contacts from database...");
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

      // Step 3: Scan sidebar
      log("Scanning sidebar...");
      const sidebarConversations = await extractSidebarConversations(page, log);
      log(`  Found ${sidebarConversations.length} conversations`);
      totalChecked += sidebarConversations.length;

      // Step 4: Compare in memory
      log("Comparing with database...");
      const cycleNewMessages: { contactName: string; message: string; contactId: string }[] = [];
      const needsReplyIds: string[] = [];

      for (const conv of sidebarConversations) {
        const existing = dbMap.get(conv.contactName);
        
        if (!existing) {
          continue; // Skip contacts not in DB
        }

        // Skip if last message is from us
        if (conv.lastMessageIsOurs) {
          continue;
        }

        // Compare sidebar message with stored message
        if (existing.lastTheirMessage !== conv.lastMessage && !conv.lastMessageIsOurs) {
          log(`  📨 NEW: ${conv.contactName}: "${conv.lastMessage.substring(0, 40)}..."`);
          
          cycleNewMessages.push({
            contactName: conv.contactName,
            message: conv.lastMessage,
            contactId: existing.id,
          });
          needsReplyIds.push(existing.id);
        }
      }

      log(`  Detected ${cycleNewMessages.length} new messages this cycle`);

      // Update activity time if we found new messages
      if (cycleNewMessages.length > 0) {
        lastActivityTime = Date.now();
        allNewMessages.push(...cycleNewMessages);
      }

      // Step 5: Batch update database
      if (needsReplyIds.length > 0) {
        log("Updating database...");
        await prisma.messengerContact.updateMany({
          where: { id: { in: needsReplyIds } },
          data: {
            state: "NEEDS_REPLY",
            lastActivityAt: new Date(),
          },
        });

        // Update each contact's lastTheirMessage
        for (const msg of cycleNewMessages) {
          await prisma.messengerContact.update({
            where: { id: msg.contactId },
            data: { lastTheirMessage: msg.message },
          });
        }
      }

      // Step 6: Generate and send AI replies for new messages
      if (cycleNewMessages.length > 0) {
        log("Generating and sending AI replies...");
        
        for (const msg of cycleNewMessages) {
          try {
            // Get full contact info including FB ID and messages
            const contact = await prisma.messengerContact.findUnique({
              where: { id: msg.contactId },
              include: { 
                lead: true,
                messages: {
                  orderBy: { createdAt: 'asc' },
                  // Get all messages for full conversation context
                },
              },
            });

            if (!contact) {
              log(`  ⚠️ Contact not found: ${msg.contactId}`);
              continue;
            }

            // Open conversation using contactFbId (like conversation-init does)
            log(`  Opening: ${msg.contactName} (FB ID: ${contact.contactFbId})...`);
            
            // Try regular URL first
            let convLink = page.locator(`a[href*="/messages/t/${contact.contactFbId}"]`).first();
            let linkVisible = await convLink.isVisible({ timeout: 2000 }).catch(() => false);
            
            // Try E2EE URL if regular not found
            if (!linkVisible) {
              log(`    Regular link not found, trying E2EE...`);
              convLink = page.locator(`a[href*="/messages/e2ee/t/${contact.contactFbId}"]`).first();
              linkVisible = await convLink.isVisible({ timeout: 2000 }).catch(() => false);
            }
            
            // Fallback: try by name if FB ID didn't work
            if (!linkVisible) {
              log(`    E2EE link not found, trying by name...`);
              convLink = page.locator(`a[href*="/messages/"]`).filter({ hasText: msg.contactName }).first();
              linkVisible = await convLink.isVisible({ timeout: 2000 }).catch(() => false);
            }
            
            if (!linkVisible) {
              log(`  ⚠️ Could not find conversation link for ${msg.contactName}`);
              continue;
            }

            await convLink.click({ force: true });
            log(`    Clicked conversation link`);
            await page.waitForTimeout(2500);

            // ========================================
            // WAIT FOR MORE MESSAGES PATTERN
            // Wait 10s after last message before generating AI reply
            // If new message arrives during wait, reset timer
            // ========================================
            const MESSAGE_WAIT_TIME = 10000; // 10 seconds
            const CHECK_INTERVAL = 2000; // Check every 2 seconds
            let allCollectedMessages: { sender: 'THEM' | 'US'; content: string }[] = [];
            let lastMessageCount = 0;
            let waitStartTime = Date.now();
            
            log(`    ⏳ Waiting for more messages (${MESSAGE_WAIT_TIME/1000}s timeout)...`);
            
            // Initial extraction
            let recentMessages = await extractRecentMessages(page, msg.contactName);
            const existingContents = new Set(contact.messages.map(m => m.content));
            
            // Find initial new messages
            for (const rm of recentMessages) {
              if (!existingContents.has(rm.content) && rm.sender === 'THEM') {
                allCollectedMessages.push(rm);
              }
            }
            lastMessageCount = allCollectedMessages.length;
            log(`    Found ${lastMessageCount} new message(s) initially`);
            
            // Keep checking for more messages until 10s of silence
            while (true) {
              await page.waitForTimeout(CHECK_INTERVAL);
              
              // Re-extract messages
              recentMessages = await extractRecentMessages(page, msg.contactName);
              
              // Find NEW messages not in DB and not already collected
              const collectedContents = new Set(allCollectedMessages.map(m => m.content));
              let newMessagesThisCheck = 0;
              
              for (const rm of recentMessages) {
                if (!existingContents.has(rm.content) && !collectedContents.has(rm.content) && rm.sender === 'THEM') {
                  allCollectedMessages.push(rm);
                  newMessagesThisCheck++;
                  log(`    📩 New message detected: "${rm.content.substring(0, 30)}..."`);
                }
              }
              
              if (newMessagesThisCheck > 0) {
                // Reset timer - user is still typing
                waitStartTime = Date.now();
                lastMessageCount = allCollectedMessages.length;
                log(`    ⏳ New message! Resetting 10s timer... (${allCollectedMessages.length} total)`);
              }
              
              // Check if 10 seconds passed since last message
              const elapsed = Date.now() - waitStartTime;
              if (elapsed >= MESSAGE_WAIT_TIME) {
                log(`    ✅ 10s silence - user finished typing. Total: ${allCollectedMessages.length} message(s)`);
                break;
              }
              
              // Safety: max 60 seconds total wait
              if (allCollectedMessages.length > 0 && elapsed >= 60000) {
                log(`    ⏰ Max wait time reached (60s). Proceeding...`);
                break;
              }
            }
            
            // If no new messages found after waiting, skip
            if (allCollectedMessages.length === 0) {
              log(`    No new messages to respond to, skipping...`);
              continue;
            }
            
            log(`    ${allCollectedMessages.length} new messages to save and respond to`);
            
            // Save all new incoming messages to database
            for (const newMsg of allCollectedMessages) {
              await prisma.messengerMessage.create({
                data: {
                  contactId: msg.contactId,
                  content: newMsg.content,
                  sender: newMsg.sender,
                },
              });
              log(`    💾 Saved: [${newMsg.sender}] "${newMsg.content.substring(0, 30)}..."`);
            }

            // Build conversation history from stored messages + new ones
            const conversationHistory = contact.messages.map(m => ({
              sender: m.sender === 'US' ? 'us' : (m.sender === 'THEM' ? 'them' : 'unknown'),
              text: m.content,
            }));
            
            // Add new messages to history
            for (const newMsg of allCollectedMessages) {
              conversationHistory.push({
                sender: newMsg.sender === 'US' ? 'us' : 'them',
                text: newMsg.content,
              });
            }

            log(`    Conversation history: ${conversationHistory.length} messages total`);
            if (conversationHistory.length > 0) {
              const lastMsgs = conversationHistory.slice(-3);
              log(`    Last 3 msgs:`);
              for (const lm of lastMsgs) {
                log(`      [${lm.sender}] "${lm.text.substring(0, 40)}..."`);
              }
            }

            log(`    Calling AI to generate reply...`);

            // Generate AI reply with proper conversation history
            const replies = await generateAIReply(
              msg.contactName,
              conversationHistory,
              contact.lead,
            );

            if (!replies || replies.length === 0) {
              log(`  ⚠️ AI returned no reply for ${msg.contactName}`);
              continue;
            }
            
            log(`    AI generated ${replies.length} messages to send`);

            // Find message input
            const messageInput = page.locator('[role="textbox"][aria-label*="Message"]').first();
            if (await messageInput.isVisible({ timeout: 3000 }).catch(() => false)) {
              
              // Send each message consecutively
              for (let i = 0; i < replies.length; i++) {
                const replyText = replies[i];
                log(`    📤 Sending message ${i + 1}/${replies.length}: "${replyText.substring(0, 40)}..."`);
                
                await messageInput.click();
                await page.waitForTimeout(200);
                await messageInput.fill(replyText);
                await page.waitForTimeout(300);

                // Send message
                await page.keyboard.press("Enter");
                
                // Wait between messages (human-like delay)
                const delay = 800 + Math.random() * 700; // 800-1500ms
                await page.waitForTimeout(delay);

                // Save each message to database
                await prisma.messengerMessage.create({
                  data: {
                    contactId: msg.contactId,
                    content: replyText,
                    sender: 'US',
                  },
                });
              }

              log(`  ✅ Sent ${replies.length} messages to ${msg.contactName}`);
              allRepliesSent.push({ contactName: msg.contactName, reply: replies.join(' | ') });

              // Update state to WAITING (we sent, waiting for their reply)
              await prisma.messengerContact.update({
                where: { id: msg.contactId },
                data: {
                  state: ConversationStateEnum.WAITING,
                  lastMessageIsOurs: true,
                },
              });
            } else {
              log(`  ⚠️ Message input not visible for ${msg.contactName}`);
            }
          } catch (err) {
            log(`  ❌ Error replying to ${msg.contactName}: ${err}`);
            errors.push(`${msg.contactName}: ${err}`);
          }
        }
      }

      // Check if we should continue in continuous mode
      if (isContinuousMode) {
        const idleMs = Date.now() - lastActivityTime;
        const idleTimeoutMs = idleTimeout * 1000;
        
        if (idleMs >= idleTimeoutMs) {
          log(`\n⏱️ Idle timeout reached (${Math.round(idleMs / 1000)}s with no new messages)`);
          break;
        }

        const remainingIdle = Math.round((idleTimeoutMs - idleMs) / 1000);
        log(`  Waiting ${checkInterval / 1000}s before next check... (${remainingIdle}s until idle timeout)`);
        
        // Scroll sidebar slightly to refresh
        await page.evaluate(() => {
          const sidebar = document.querySelector('[role="navigation"] [role="list"]');
          if (sidebar) {
            sidebar.scrollTop = 0;
          }
        });
        
        await page.waitForTimeout(checkInterval);
      }

    } while (isContinuousMode);

    // Close browser
    log("\nClosing browser...");
    await browser.close();
    browser = null;

    return NextResponse.json({
      success: true,
      pinEntered,
      checked: totalChecked,
      cycleCount,
      newMessages: allNewMessages.map(m => ({ contactName: m.contactName, message: m.message })),
      repliesSent: allRepliesSent,
      logs,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    errors.push(errMsg);
    console.error("[AGENT ERROR]", error);

    return NextResponse.json({
      success: false,
      checked: totalChecked,
      cycleCount,
      newMessages: allNewMessages.map(m => ({ contactName: m.contactName, message: m.message })),
      repliesSent: allRepliesSent,
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

// Extract recent messages from an open conversation
async function extractRecentMessages(page: Page, contactName: string): Promise<Array<{ sender: 'THEM' | 'US'; content: string }>> {
  try {
    // Wait for messages to load
    await page.waitForTimeout(1000);
    
    const messages = await page.evaluate((contactNameArg) => {
      const result: Array<{ sender: 'THEM' | 'US'; content: string }> = [];
      
      const main = document.querySelector('[role="main"]');
      if (!main) return result;
      
      const rows = main.querySelectorAll('[role="row"]');
      const contactFirstName = contactNameArg.split(' ')[0].toLowerCase();
      const contactLower = contactNameArg.toLowerCase();
      
      for (const row of rows) {
        const presentations = row.querySelectorAll('[role="presentation"]');
        
        for (const pres of presentations) {
          const textEls = pres.querySelectorAll('[dir="auto"]');
          
          for (const el of textEls) {
            const htmlEl = el as HTMLElement;
            const text = htmlEl.textContent?.trim() || '';
            const lowerText = text.toLowerCase();
            
            // Skip empty or too short
            if (!text || text.length < 2) continue;
            
            // Skip timestamps
            if (/^\d{1,2}:\d{2}\s*(AM|PM)?$/i.test(text)) continue;
            if (/^(yesterday|today)\s*at\s*\d/i.test(text)) continue;
            if (/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*at\s*\d/i.test(text)) continue;
            if (/^(December|January|February|March|April|May|June|July|August|September|October|November)\s+\d/i.test(text)) continue;
            
            // Skip system messages
            if (lowerText === 'messages and calls are secured with end-to-end encryption. learn more.') continue;
            if (lowerText.includes("you're now friends on facebook")) continue;
            if (lowerText === 'say hi to your new facebook friend.') continue;
            if (lowerText === 'get started') continue;
            if (lowerText === 'enter') continue;
            
            // Skip exact contact name
            if (lowerText === contactLower) continue;
            if (lowerText === contactFirstName && text.length < 20) continue;
            
            // Skip UI elements and buttons
            if (lowerText === 'plus' || lowerText === 'more') continue;
            if (lowerText === 'répondre' || lowerText === 'reply') continue;
            
            // Check line height - messages typically have 15-25px line height
            const computedStyle = window.getComputedStyle(htmlEl);
            const lineHeight = parseFloat(computedStyle.lineHeight);
            // Skip if line height is way off (but allow NaN as some messages don't have explicit line-height)
            if (!isNaN(lineHeight) && (lineHeight < 15 || lineHeight > 30)) continue;
            
            // Determine sender by checking for gray background
            let isTheirs = false;
            let parent: HTMLElement | null = htmlEl.parentElement;
            for (let i = 0; i < 8 && parent; i++) {
              const bg = window.getComputedStyle(parent).backgroundColor;
              
              // Gray = THEIR message
              if (bg.includes('48, 48, 48') || 
                  bg.includes('58, 58, 58') || 
                  bg.includes('36, 37, 38') ||
                  bg.includes('36, 36, 36') ||
                  bg.includes('38, 38, 38') ||
                  bg.includes('228, 230, 235') || 
                  bg.includes('240, 240, 240')) {
                isTheirs = true;
                break;
              }
              parent = parent.parentElement;
            }
            
            result.push({
              sender: isTheirs ? 'THEM' : 'US',
              content: text,
            });
          }
        }
      }
      
      return result;
    }, contactName);
    
    // Remove duplicates while preserving order
    const seen = new Set<string>();
    const unique: Array<{ sender: 'THEM' | 'US'; content: string }> = [];
    for (const msg of messages) {
      if (!seen.has(msg.content)) {
        seen.add(msg.content);
        unique.push(msg);
      }
    }
    
    return unique;
    
  } catch (err) {
    console.error('Error extracting recent messages:', err);
    return [];
  }
}

// Load business data from file
async function getBusinessData(): Promise<{ business: any; services: any[] }> {
  try {
    const data = await fs.readFile(BUSINESS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {
      business: {
        name: 'Our Business',
        description: 'We provide professional services',
        location: 'Tunisia',
        whatsapp: '',
        website: '',
        languages: ['French', 'Arabic'],
        targetAudience: '',
        uniqueSellingPoints: [],
      },
      services: [],
    };
  }
}

// Generate AI reply using conversation history - DIRECT AI call (no HTTP)
// Returns array of messages to send consecutively
async function generateAIReply(
  contactName: string,
  conversationHistory: { sender: string; text: string }[],
  lead: any,
): Promise<string[] | null> {
  try {
    console.log(`[AI] Generating reply for ${contactName} with ${conversationHistory.length} messages`);
    
    // Load business data from DB
    const business = await prisma.business.findFirst();
    const services = await prisma.service.findMany({ where: { isActive: true } });
    
    // Load custom prompt from DB (from ai-tune page)
    const customPromptSetting = await prisma.setting.findUnique({
      where: { key: "ai_conversation_prompt" }
    });
    const customPrompt = customPromptSetting?.value || null;

    // Format conversation with contact name
    const formattedConversation = conversationHistory.map(msg => {
      const sender = msg.sender === 'us' ? 'Us' : contactName;
      return `${sender}: ${msg.text}`;
    }).join('\n');

    // Log only last 5 messages for brevity
    const last5Messages = conversationHistory.slice(-5).map(msg => {
      const sender = msg.sender === 'us' ? 'Us' : contactName;
      return `${sender}: ${msg.text}`;
    }).join('\n');
    console.log(`[AI] Conversation (${conversationHistory.length} total, showing last 5):\n${last5Messages}`);

    // Check if we already introduced ourselves
    const weAlreadyIntroduced = conversationHistory.some(m => m.sender === 'us');
    
    // Build services info for prompt
    const servicesInfo = services.map(s => 
      `- ${s.nameArabic || s.name}: ${s.descriptionArabic || s.description || ''} ${s.priceRange ? `(${s.priceRange})` : ''}`
    ).join('\n');

    // Build system prompt - use custom from DB if available, else default
    let systemPrompt: string;
    
    if (customPrompt) {
      // Use custom prompt from ai-tune page + append conversation context
      systemPrompt = `${customPrompt}

=== معلومات الشركة ===
اسم الشركة: ${business?.name || 'Creator Labs'}
الوصف: ${business?.description || ''}
الموقع: ${business?.location || 'تونس'}
واتساب: ${business?.whatsapp || ''}

=== الخدمات ===
${servicesInfo || '- خدمات متنوعة'}

=== المحادثة مع: ${contactName} ===
${weAlreadyIntroduced ? '⚠️ هذه محادثة مستمرة - عرفنا روحنا من قبل. ما تعاودش تعرف روحك. كمل المحادثة بشكل طبيعي.' : '⚠️ هذه محادثة جديدة - عرف روحك باختصار.'}

${formattedConversation}

=== قواعد إضافية للمحادثة ===
1. ما تستعملش إيموجي
2. كل رسالة جملة قصيرة
3. قسم الرد ل 2-3 رسائل قصار
4. ${weAlreadyIntroduced ? 'ما تعاودش تعرف روحك - كمل المحادثة طبيعي' : 'عرف روحك باختصار في أول رسالة'}`;
    } else {
      // Default prompt if no custom prompt saved
      systemPrompt = `انت SDR محترف تخدم في ${business?.name || 'Creator Labs'}. تحكي كيف إنسان حقيقي - قصير، طبيعي، بلا تكلف.

=== معلومات الشركة ===
اسم: ${business?.name || 'Creator Labs'}
الوصف: ${business?.description || ''}
الموقع: ${business?.location || 'تونس'}
واتساب: ${business?.whatsapp || ''}

=== الخدمات ===
${servicesInfo || '- خدمات متنوعة'}

=== المحادثة مع: ${contactName} ===
${weAlreadyIntroduced ? '⚠️ هذه محادثة مستمرة - عرفنا روحنا من قبل. ما تعاودش تعرف روحك.' : '⚠️ هذه محادثة جديدة - عرف روحك باختصار.'}

${formattedConversation}

=== القواعد ===
1. ما تستعملش إيموجي أبدا
2. احكي بنفس لغة الكليان (تونسي، فرنساوي، انجليزي)
3. كل رسالة جملة قصيرة
4. كيف إنسان يكتب - طبيعي، كاجوال
5. قسم الرد ل 2-3 رسائل قصار
6. سؤال واحد في كل رد
7. ما تكونش formal - كون طبيعي
8. ${weAlreadyIntroduced ? 'ما تعاودش تعرف روحك' : 'عرف روحك في أول رسالة'}`;
    }
    
    console.log(`[AI] Using ${customPrompt ? 'CUSTOM' : 'DEFAULT'} prompt from ai-tune`);

    const result = await generateObject({
      model,
      schema: ReplySchema,
      system: systemPrompt,
      prompt: `بناء على المحادثة أعلاه مع ${contactName}، اعطيني رسائل قصار متتالية كـ array.`,
    });

    console.log(`[AI] Generated ${result.object.messages.length} messages:`);
    result.object.messages.forEach((m, i) => console.log(`  ${i+1}. "${m}"`));
    console.log(`[AI] Intent: ${result.object.intent}, Reasoning: ${result.object.reasoning}`);
    
    return result.object.messages;

  } catch (err) {
    console.error("[AI] Error generating reply:", err);
    return null;
  }
}

// Dismiss notification popups (like E2EE notice with "Close" button, push notification requests)
async function dismissNotificationPopup(page: Page, log: (msg: string) => void): Promise<void> {
  try {
    // Wait a bit for any popup to fully appear
    await page.waitForTimeout(500);
    
    // Direct approach: Find and click the Close button inside alertdialog
    const dismissed = await page.evaluate(() => {
      const results: string[] = [];
      
      // Look for the push notifications alertdialog specifically
      const alertDialog = document.querySelector('[role="alertdialog"]');
      const pushNotifDialog = document.querySelector('[aria-label="Push notifications request"]');
      
      results.push(`alertdialog: ${alertDialog ? 'found' : 'not found'}`);
      results.push(`pushNotifDialog: ${pushNotifDialog ? 'found' : 'not found'}`);
      
      const dialogToUse = alertDialog || pushNotifDialog;
      
      if (dialogToUse) {
        // Find the button inside (it's a plain <button> element)
        const closeBtn = dialogToUse.querySelector('button');
        if (closeBtn) {
          results.push(`button text: "${closeBtn.textContent?.trim()}"`);
          closeBtn.click();
          return { clicked: 'alertdialog button', results };
        }
      }
      
      // Also check for any standalone Close button
      const allButtons = document.querySelectorAll('button');
      results.push(`total buttons found: ${allButtons.length}`);
      
      for (const btn of allButtons) {
        const text = btn.textContent?.trim().toLowerCase();
        if (text === 'close') {
          btn.click();
          return { clicked: 'standalone close button', results };
        }
      }
      
      // Check role="button" divs with Close text
      const roleButtons = document.querySelectorAll('[role="button"]');
      results.push(`total role=button found: ${roleButtons.length}`);
      
      for (const btn of roleButtons) {
        const text = btn.textContent?.trim().toLowerCase();
        if (text === 'close') {
          (btn as HTMLElement).click();
          return { clicked: 'role button close', results };
        }
      }
      
      return { clicked: null, results };
    });

    // Log what we found
    if (dismissed.results) {
      dismissed.results.forEach((r: string) => log(`    ${r}`));
    }
    
    if (dismissed.clicked) {
      log(`  ✅ Dismissed popup: ${dismissed.clicked}`);
      await page.waitForTimeout(500);
    } else {
      log(`  ℹ️ No popup to dismiss`);
    }
    
    // Fallback: Try pressing Escape key to close any modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    
  } catch (err) {
    // Silently ignore - no popup to dismiss
    log(`  ⚠️ Popup dismiss error: ${err}`);
  }
}
