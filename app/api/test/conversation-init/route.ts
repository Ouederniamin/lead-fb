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

// Helper function to create notifications
async function createSessionNotification(
  accountId: string, 
  type: "SESSION_EXPIRED" | "SESSION_NEEDS_LOGIN" | "ACCOUNT_BANNED",
  message: string
) {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { name: true, email: true },
  });

  const accountName = account?.name || account?.email || "Unknown";
  
  const notificationData = {
    SESSION_EXPIRED: {
      title: "Session Expired",
      severity: "WARNING" as const,
      sessionStatus: "EXPIRED" as const,
    },
    SESSION_NEEDS_LOGIN: {
      title: "Re-login Required",
      severity: "ERROR" as const,
      sessionStatus: "NEEDS_PASSWORD" as const,
    },
    ACCOUNT_BANNED: {
      title: "Account Banned",
      severity: "CRITICAL" as const,
      sessionStatus: "BANNED" as const,
    },
  };

  const config = notificationData[type];

  // Update account status
  await prisma.account.update({
    where: { id: accountId },
    data: {
      sessionStatus: config.sessionStatus,
      sessionError: message,
      sessionExpiredAt: new Date(),
      isLoggedIn: false,
    },
  });

  // Create notification
  await prisma.notification.create({
    data: {
      type,
      severity: config.severity,
      title: `${config.title}: ${accountName}`,
      message,
      accountId,
      actionUrl: "/dashboard/accounts",
      actionLabel: "Fix Account",
    },
  });
}

export async function POST(request: NextRequest) {
  let browser: Browser | null = null;
  const logs: string[] = [];
  const errors: string[] = [];

  function log(msg: string) {
    logs.push(msg);
    console.log(`[INIT] ${msg}`);
  }

  try {
    const body = await request.json();
    const { accountId, scrollCount = 5 } = body;

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

    log("Launching browser...");
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
      storageState: account.sessionData as any,
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();

    // Navigate to Messenger
    log("Navigating to Messenger...");
    await page.goto("https://www.facebook.com/messages/t/", { 
      waitUntil: "domcontentloaded",
      timeout: 30000 
    });
    await page.waitForTimeout(3000);

    // Check if we're on a login page (session expired)
    const currentUrl = page.url();
    const isLoginPage = currentUrl.includes('login') || currentUrl.includes('index.php');
    
    if (isLoginPage) {
      log("⚠️ Session expired - on login page");
      
      // Check if there's a saved account we can click (one-click re-login)
      const savedAccount = await page.$('[data-testid="royal_login_button"]');
      const savedAccountCard = await page.$('[role="button"][tabindex="0"]');
      
      // Try to find a clickable profile picture or name
      const accountToClick = await page.evaluate(() => {
        // Look for the saved account option (user's profile pic/name to click)
        const cards = document.querySelectorAll('[role="button"], [role="link"]');
        for (const card of cards) {
          const text = card.textContent?.toLowerCase() || '';
          // Skip "Add Account" or "Create new account"
          if (text.includes('add account') || text.includes('create new')) continue;
          
          // Look for card with a profile image
          const hasImg = card.querySelector('image, img');
          if (hasImg) {
            const rect = (card as HTMLElement).getBoundingClientRect();
            if (rect.width > 50 && rect.height > 50) {
              return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
            }
          }
        }
        return null;
      });
      
      if (accountToClick) {
        log("🔄 Found saved account, clicking to re-login...");
        await page.mouse.click(accountToClick.x, accountToClick.y);
        await page.waitForTimeout(5000);
        
        // Check if password is required
        const passwordInput = await page.$('input[type="password"]');
        if (passwordInput) {
          log("❌ Password required - session fully expired");
          await browser.close();
          
          // Create notification
          await createSessionNotification(
            accountId,
            "SESSION_NEEDS_LOGIN",
            "Session expired and password is required. Please re-login manually via the Accounts page."
          );
          
          return NextResponse.json({ 
            success: false, 
            errors: ["Session expired and password required. Please re-login via /api/accounts/login"],
            logs 
          }, { status: 401 });
        }
        
        // Wait for redirect to messenger
        await page.waitForTimeout(3000);
        const newUrl = page.url();
        if (newUrl.includes('/messages/')) {
          log("✅ Re-login successful via saved account");
          
          // Save updated session and mark as active
          const newSession = await context.storageState();
          await prisma.account.update({
            where: { id: accountId },
            data: { 
              sessionData: newSession as any,
              sessionStatus: "ACTIVE",
              sessionError: null,
              isLoggedIn: true,
            },
          });
          log("💾 Updated session saved to database");
        } else {
          log("❌ Re-login failed, still not on Messenger");
          await browser.close();
          
          // Create notification
          await createSessionNotification(
            accountId,
            "SESSION_NEEDS_LOGIN",
            "Automatic re-login failed. Please re-login manually via the Accounts page."
          );
          
          return NextResponse.json({ 
            success: false, 
            errors: ["Could not re-login automatically. Please re-login via /api/accounts/login"],
            logs 
          }, { status: 401 });
        }
      } else {
        log("❌ No saved account to click, full re-login needed");
        await browser.close();
        
        // Create notification  
        await createSessionNotification(
          accountId,
          "SESSION_NEEDS_LOGIN",
          "Session expired. Please re-login manually via the Accounts page."
        );
        
        return NextResponse.json({ 
          success: false, 
          errors: ["Session expired. Please re-login via /api/accounts/login"],
          logs 
        }, { status: 401 });
      }
    }

    // Check for E2EE PIN dialog
    let pinEntered = false;
    log("Checking for E2EE PIN dialog...");
    
    pinEntered = await checkAndEnterPin(page, account.conversationPin || "", log);
    
    // Check for and dismiss any notification popups before scrolling sidebar
    log("Checking for notification popups to dismiss...");
    await dismissNotificationPopup(page, log);
    
    // Scroll sidebar to load all conversations
    log(`Scrolling sidebar ${scrollCount} times...`);
    
    // First, click on the sidebar area to focus it
    const sidebarClicked = await page.evaluate(() => {
      const nav = document.querySelector('[role="navigation"]');
      const grid = document.querySelector('[role="grid"][aria-label="Chats"]');
      const target = grid || nav;
      
      if (target) {
        const rect = target.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, width: rect.width, height: rect.height };
      }
      return null;
    });
    
    if (sidebarClicked) {
      log(`  📍 Clicking sidebar at (${Math.round(sidebarClicked.x)}, ${Math.round(sidebarClicked.y)})`);
      await page.mouse.click(sidebarClicked.x, sidebarClicked.y);
      await page.waitForTimeout(500);
    }
    
    // Count conversations before scrolling
    const beforeCount = await page.evaluate(() => {
      return document.querySelectorAll('a[href*="/messages/t/"], a[href*="/messages/e2ee/t/"]').length;
    });
    log(`  📊 Conversations before scroll: ${beforeCount}`);
    
    // Use multiple methods to scroll
    for (let i = 0; i < scrollCount; i++) {
      // Method 1: Dispatch wheel event on the navigation/grid area
      await page.evaluate(() => {
        const nav = document.querySelector('[role="navigation"]');
        const grid = document.querySelector('[role="grid"][aria-label="Chats"]');
        const target = grid || nav;
        
        if (target) {
          // Create and dispatch a wheel event
          const wheelEvent = new WheelEvent('wheel', {
            deltaY: 500,
            deltaMode: 0,
            bubbles: true,
            cancelable: true,
          });
          target.dispatchEvent(wheelEvent);
        }
      });
      
      // Method 2: Also try mouse.wheel at the sidebar position
      if (sidebarClicked) {
        await page.mouse.move(sidebarClicked.x, sidebarClicked.y);
        await page.mouse.wheel(0, 400);
      }
      
      // Method 3: Try keyboard - End key to scroll to bottom
      await page.keyboard.press('End');
      
      await page.waitForTimeout(1500);
      
      // Check new count
      const currentCount = await page.evaluate(() => {
        return document.querySelectorAll('a[href*="/messages/t/"], a[href*="/messages/e2ee/t/"]').length;
      });
      
      log(`  Scroll ${i + 1}/${scrollCount}: ${currentCount} conversations loaded`);
      
      // If count hasn't changed in a few scrolls, we've loaded all
      if (currentCount === beforeCount && i > 3) {
        log(`  ℹ️ No new conversations loading, stopping`);
        break;
      }
    }
    
    // Final count
    const afterCount = await page.evaluate(() => {
      return document.querySelectorAll('a[href*="/messages/t/"], a[href*="/messages/e2ee/t/"]').length;
    });
    log(`  📊 Conversations after scroll: ${afterCount} (loaded ${afterCount - beforeCount} more)`);

    // Extract all conversations from sidebar
    log("Extracting conversations from sidebar...");
    const conversations = await extractSidebarConversations(page, log);
    
    // Log all conversations before filtering
    log(`\n📋 ALL CONVERSATIONS FOUND (${conversations.length}):`);
    conversations.forEach((conv, i) => {
      log(`  ${i + 1}. ${conv.contactName} - "${conv.lastMessage?.substring(0, 50)}..."`);
    });
    
    // Filter out system messages with detailed logging
    const filteredOut: { name: string; reason: string }[] = [];
    const validConversations = conversations.filter(conv => {
      const msg = conv.lastMessage?.toLowerCase() || "";
      const name = conv.contactName?.toLowerCase() || "";
      
      for (const pattern of SYSTEM_MESSAGE_PATTERNS) {
        if (msg.includes(pattern.toLowerCase())) {
          filteredOut.push({ name: conv.contactName, reason: `Message contains: "${pattern}"` });
          return false;
        }
        if (name.includes(pattern.toLowerCase())) {
          filteredOut.push({ name: conv.contactName, reason: `Name contains: "${pattern}"` });
          return false;
        }
      }
      return true;
    });

    // Log filtered out conversations
    if (filteredOut.length > 0) {
      log(`\n❌ FILTERED OUT (${filteredOut.length}):`);
      filteredOut.forEach(f => {
        log(`  - ${f.name}: ${f.reason}`);
      });
    }

    log(`\n✅ VALID CONVERSATIONS: ${validConversations.length}`);

    // Process each conversation - save to DB and get message history
    const contactResults: any[] = [];
    let totalMessages = 0;

    for (const conv of validConversations) {
      try {
        log(`Processing: ${conv.contactName}...`);

        // Check if contact already exists
        let contact = await prisma.messengerContact.findFirst({
          where: {
            accountId,
            contactName: conv.contactName,
          },
        });

        if (!contact) {
          // Create new contact
          contact = await prisma.messengerContact.create({
            data: {
              accountId,
              contactName: conv.contactName,
              contactFbId: conv.contactFbId || null,
              conversationUrl: conv.conversationUrl || `https://www.facebook.com/messages/t/${conv.contactFbId}`,
              lastTheirMessage: conv.lastMessage,
              lastMessageIsOurs: conv.lastMessageIsOurs,
              state: ConversationStateEnum.NEW,
              lastCheckedAt: new Date(),
              lastActivityAt: new Date(),
            },
          });
          log(`  Created new contact: ${conv.contactName}`);
        } else {
          // Update existing contact
          await prisma.messengerContact.update({
            where: { id: contact.id },
            data: {
              lastTheirMessage: conv.lastMessage,
              lastMessageIsOurs: conv.lastMessageIsOurs,
              lastCheckedAt: new Date(),
            },
          });
          log(`  Updated existing contact: ${conv.contactName}`);
        }

        // Click on conversation to open it
        // Try both regular and E2EE URLs
        let convLink = page.locator(`a[href*="/messages/t/${conv.contactFbId}"]`).first();
        let linkVisible = await convLink.isVisible({ timeout: 1000 }).catch(() => false);
        
        if (!linkVisible) {
          convLink = page.locator(`a[href*="/messages/e2ee/t/${conv.contactFbId}"]`).first();
          linkVisible = await convLink.isVisible({ timeout: 1000 }).catch(() => false);
        }
        
        if (linkVisible) {
          await convLink.click({ force: true });
          await page.waitForTimeout(2500);

          // Dismiss any notification popup (like E2EE notice with "Close" button)
          await dismissNotificationPopup(page, log);

          // Scroll to TOP of conversation to load all messages
          log(`  📜 Scrolling to load full conversation...`);
          await scrollConversationToTop(page, conv.contactName, log);

          // Extract messages from conversation
          const messages = await extractConversationMessages(page, conv.contactName, log);
          
          // Log the full conversation
          if (messages.length > 0) {
            log(`  ┌─────────────────────────────────────────────`);
            log(`  │ 💬 CONVERSATION: ${conv.contactName}`);
            log(`  │ Messages: ${messages.length}`);
            log(`  ├─────────────────────────────────────────────`);
            
            messages.forEach((msg, i) => {
              const sender = msg.sender === 'US' ? '📤 YOU' : msg.sender === 'THEM' ? '📥 THEM' : '❓';
              log(`  │ ${i + 1}. ${sender}: ${msg.content}`);
            });
            
            log(`  └─────────────────────────────────────────────`);
            
            // Delete existing messages for this contact (to refresh)
            await prisma.messengerMessage.deleteMany({
              where: { contactId: contact.id },
            });

            // Save new messages
            await prisma.messengerMessage.createMany({
              data: messages.map((msg, i) => ({
                contactId: contact!.id,
                content: msg.content,
                sender: msg.sender,
                timestamp: msg.timestamp || new Date(),
                messageOrder: i + 1,
              })),
            });

            totalMessages += messages.length;
            log(`  ✅ Saved ${messages.length} messages to database`);
            
            contactResults.push({
              contactName: conv.contactName,
              contactFbId: conv.contactFbId,
              state: "INITIALIZED",
              messageCount: messages.length,
              lastMessageIsOurs: conv.lastMessageIsOurs,
            });
          } else {
            log(`  ⚠️ No messages extracted for ${conv.contactName}`);
            
            contactResults.push({
              contactName: conv.contactName,
              contactFbId: conv.contactFbId,
              state: "INITIALIZED",
              messageCount: 0,
              lastMessageIsOurs: conv.lastMessageIsOurs,
            });
          }
        } else {
          log(`  ⚠️ Could not find conversation link for ${conv.contactName} (fbId: ${conv.contactFbId})`);
          
          contactResults.push({
            contactName: conv.contactName,
            contactFbId: conv.contactFbId,
            state: "NO_LINK",
            messageCount: 0,
            lastMessageIsOurs: conv.lastMessageIsOurs,
          });
        }

      } catch (err) {
        log(`  ❌ Error processing ${conv.contactName}: ${err}`);
        errors.push(`${conv.contactName}: ${err}`);
        
        contactResults.push({
          contactName: conv.contactName,
          contactFbId: conv.contactFbId,
          state: "ERROR",
          messageCount: 0,
          error: String(err),
        });
      }
    }

    // Final summary
    log(`\n${"═".repeat(50)}`);
    log(`📊 INITIALIZATION COMPLETE`);
    log(`${"═".repeat(50)}`);
    log(`📋 Total Conversations Found: ${conversations.length}`);
    log(`❌ Filtered Out: ${filteredOut.length}`);
    log(`✅ Valid Contacts: ${validConversations.length}`);
    log(`💬 Total Messages Saved: ${totalMessages}`);
    log(`⚠️ Errors: ${errors.length}`);
    log(`${"═".repeat(50)}\n`);

    // Query database to verify saved data
    log(`\n${"═".repeat(50)}`);
    log(`🔍 VERIFYING SAVED DATA FROM DATABASE`);
    log(`${"═".repeat(50)}`);
    
    const savedContacts = await prisma.messengerContact.findMany({
      where: { accountId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { lastActivityAt: 'desc' },
    });

    log(`📁 Found ${savedContacts.length} contacts in database:\n`);
    
    for (const contact of savedContacts) {
      log(`${"─".repeat(40)}`);
      log(`👤 ${contact.contactName}`);
      log(`   FB ID: ${contact.contactFbId}`);
      log(`   State: ${contact.state}`);
      log(`   Messages: ${contact.messages.length}`);
      
      if (contact.messages.length > 0) {
        log(`   📜 Conversation:`);
        for (const msg of contact.messages) {
          const sender = msg.sender === 'US' ? 'Us' : contact.contactName;
          const content = msg.content.length > 60 ? msg.content.substring(0, 60) + '...' : msg.content;
          log(`      ${sender}: ${content}`);
        }
      }
    }
    
    log(`${"═".repeat(50)}`);
    log(`✅ DATABASE VERIFICATION COMPLETE`);
    log(`${"═".repeat(50)}\n`);

    // Close browser
    await browser.close();
    browser = null;

    return NextResponse.json({
      success: true,
      pinEntered,
      totalContacts: conversations.length,
      validContacts: validConversations.length,
      totalMessages,
      contacts: contactResults,
      savedContacts: savedContacts.map(c => ({
        contactName: c.contactName,
        contactFbId: c.contactFbId,
        state: c.state,
        messageCount: c.messages.length,
        messages: c.messages.map(m => ({
          sender: m.sender,
          content: m.content.substring(0, 100),
        })),
      })),
      logs,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    errors.push(errMsg);
    console.error("[INIT ERROR]", error);

    return NextResponse.json({
      success: false,
      errors,
      logs,
    }, { status: 500 });

  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

// Dismiss notification popups (like E2EE notice with "Close" button)
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
      dismissed.results.forEach((r: string) => log(`  📋 ${r}`));
    }
    
    if (dismissed.clicked) {
      log(`  ✅ Dismissed popup: ${dismissed.clicked}`);
      await page.waitForTimeout(500);
    } else {
      log(`  ℹ️ No popup to dismiss`);
    }
    
    // Fallback: Try pressing Escape key to close any modal
    log(`  ⌨️ Pressing Escape key as fallback...`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    
  } catch (err) {
    // Silently ignore - no popup to dismiss
    log(`  ⚠️ Popup dismiss error: ${err}`);
  }
}

// Scroll conversation to TOP (until h4 with contact name visible), then scroll down slowly
// Does a DOUBLE PASS to ensure all messages are captured
async function scrollConversationToTop(page: Page, contactName: string, log: (msg: string) => void): Promise<void> {
  
  // Helper: Find scrollable container
  const getScrollable = async () => {
    return await page.evaluate(() => {
      const main = document.querySelector('[role="main"]');
      if (!main) return null;
      
      const findScrollable = (el: Element | null): Element | null => {
        while (el) {
          const style = window.getComputedStyle(el);
          if ((style.overflowY === 'scroll' || style.overflowY === 'auto') && el.scrollHeight > el.clientHeight) {
            return el;
          }
          el = el.parentElement;
        }
        return null;
      };
      
      const firstRow = main.querySelector('[role="row"]');
      return findScrollable(firstRow) ? true : false;
    });
  };
  
  // Helper: Scroll to absolute top
  const scrollToAbsoluteTop = async (): Promise<boolean> => {
    let attempts = 0;
    const maxAttempts = 150;
    
    while (attempts < maxAttempts) {
      const result = await page.evaluate(() => {
        const main = document.querySelector('[role="main"]');
        if (!main) return { done: true, scrollTop: -1 };
        
        const findScrollable = (el: Element | null): Element | null => {
          while (el) {
            const style = window.getComputedStyle(el);
            if ((style.overflowY === 'scroll' || style.overflowY === 'auto') && el.scrollHeight > el.clientHeight) {
              return el;
            }
            el = el.parentElement;
          }
          return null;
        };
        
        const firstRow = main.querySelector('[role="row"]');
        const scrollable = findScrollable(firstRow);
        
        if (scrollable) {
          const before = scrollable.scrollTop;
          // Try to scroll up by a large amount
          scrollable.scrollTop = 0;
          
          // Also try scrollIntoView on first row
          const firstRow = main.querySelector('[role="row"]');
          if (firstRow) {
            firstRow.scrollIntoView({ block: 'start', behavior: 'instant' });
          }
          
          return { 
            done: scrollable.scrollTop === 0 && before === 0,
            scrollTop: scrollable.scrollTop,
            before: before
          };
        }
        return { done: true, scrollTop: -1 };
      });
      
      if (result.scrollTop === 0) {
        // Wait for content to load, then check if more content appeared
        await page.waitForTimeout(500);
        
        // Try scrolling up once more to load any lazy content
        await page.evaluate(() => {
          const main = document.querySelector('[role="main"]');
          if (!main) return;
          const rows = main.querySelectorAll('[role="row"]');
          if (rows.length > 0) {
            rows[0].scrollIntoView({ block: 'start', behavior: 'instant' });
          }
        });
        await page.waitForTimeout(300);
        
        // Verify we're still at top
        const verifyTop = await page.evaluate(() => {
          const main = document.querySelector('[role="main"]');
          if (!main) return 0;
          const findScrollable = (el: Element | null): Element | null => {
            while (el) {
              const style = window.getComputedStyle(el);
              if ((style.overflowY === 'scroll' || style.overflowY === 'auto') && el.scrollHeight > el.clientHeight) {
                return el;
              }
              el = el.parentElement;
            }
            return null;
          };
          const firstRow = main.querySelector('[role="row"]');
          const scrollable = findScrollable(firstRow);
          return scrollable ? scrollable.scrollTop : 0;
        });
        
        if (verifyTop === 0) {
          return true;
        }
      }
      
      attempts++;
      await page.waitForTimeout(200);
    }
    
    return false;
  };
  
  // Helper: Scroll down and collect all messages row by row
  const scrollDownAndCollect = async (): Promise<{ rowCount: number; firstMsg: string | null; lastMsg: string | null }> => {
    let totalRows = 0;
    let lastScrollTop = -1;
    let samePositionCount = 0;
    const maxScrolls = 500;
    
    for (let i = 0; i < maxScrolls; i++) {
      const result = await page.evaluate(() => {
        const main = document.querySelector('[role="main"]');
        if (!main) return { rowCount: 0, scrollTop: 0, maxScroll: 0, atBottom: true };
        
        const findScrollable = (el: Element | null): Element | null => {
          while (el) {
            const style = window.getComputedStyle(el);
            if ((style.overflowY === 'scroll' || style.overflowY === 'auto') && el.scrollHeight > el.clientHeight) {
              return el;
            }
            el = el.parentElement;
          }
          return null;
        };
        
        const firstRow = main.querySelector('[role="row"]');
        const scrollable = findScrollable(firstRow);
        const rows = main.querySelectorAll('[role="row"]');
        
        if (scrollable) {
          const maxScroll = scrollable.scrollHeight - scrollable.clientHeight;
          const atBottom = Math.abs(scrollable.scrollTop - maxScroll) < 5;
          
          // Scroll down by small amount to ensure we don't miss messages
          scrollable.scrollTop = Math.min(scrollable.scrollTop + 100, maxScroll);
          
          return {
            rowCount: rows.length,
            scrollTop: scrollable.scrollTop,
            maxScroll: maxScroll,
            atBottom: atBottom
          };
        }
        
        return { rowCount: rows.length, scrollTop: 0, maxScroll: 0, atBottom: true };
      });
      
      totalRows = Math.max(totalRows, result.rowCount);
      
      // Check if we're stuck at same position
      if (result.scrollTop === lastScrollTop) {
        samePositionCount++;
      } else {
        samePositionCount = 0;
      }
      lastScrollTop = result.scrollTop;
      
      // Stop if at bottom or stuck
      if (result.atBottom || samePositionCount > 10) {
        break;
      }
      
      await page.waitForTimeout(100);
    }
    
    // Wait for final content
    await page.waitForTimeout(500);
    
    // Get first and last messages
    const msgInfo = await page.evaluate(() => {
      const main = document.querySelector('[role="main"]');
      if (!main) return { rowCount: 0, firstMsg: null, lastMsg: null };
      
      const rows = main.querySelectorAll('[role="row"]');
      
      const extractMessageText = (row: Element): string | null => {
        const dirAutoElements = row.querySelectorAll('[dir="auto"]');
        for (const el of dirAutoElements) {
          const style = window.getComputedStyle(el as HTMLElement);
          const lineHeight = parseFloat(style.lineHeight);
          if (lineHeight >= 18 && lineHeight <= 22) {
            const text = el.textContent?.trim();
            if (text && text.length > 2 && !text.match(/^\d{1,2}:\d{2}/)) return text.substring(0, 40);
          }
        }
        return null;
      };
      
      let firstMsg: string | null = null;
      for (let i = 0; i < rows.length; i++) {
        firstMsg = extractMessageText(rows[i]);
        if (firstMsg) break;
      }
      
      let lastMsg: string | null = null;
      for (let i = rows.length - 1; i >= 0; i--) {
        lastMsg = extractMessageText(rows[i]);
        if (lastMsg) break;
      }
      
      return { rowCount: rows.length, firstMsg, lastMsg };
    });
    
    return msgInfo;
  };
  
  // =============== MAIN LOGIC ===============
  
  log(`  📜 Loading full conversation...`);
  
  // Check if scrollable
  const hasScrollable = await getScrollable();
  if (!hasScrollable) {
    log(`     ⚠️ No scrollable container found`);
    return;
  }
  
  // ===== PASS 1 =====
  await scrollToAbsoluteTop();
  await page.waitForTimeout(1000);
  const pass1 = await scrollDownAndCollect();
  
  // ===== PASS 2 (Verification) =====
  await scrollToAbsoluteTop();
  await page.waitForTimeout(1000);
  const pass2 = await scrollDownAndCollect();
  
  log(`     ✅ Loaded: ${pass2.rowCount} rows | First: "${pass2.firstMsg || 'none'}" | Last: "${pass2.lastMsg || 'none'}"`);
  
  // Compare passes
  if (pass1.firstMsg !== pass2.firstMsg || pass1.lastMsg !== pass2.lastMsg) {
    log(`     ⚠️ Passes differ - some messages may have loaded late`);
  }
  
  // Final: scroll back to top so extraction starts from beginning
  await scrollToAbsoluteTop();
  await page.waitForTimeout(500);
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
      log("  No PIN dialog detected");
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

        // Get last message preview
        // The spacer div trick: find the div with height 8px, then get the next sibling
        let lastMessage = "";
        let lastMessageIsOurs = false;

        try {
          // Look for message preview in the conversation row
          const previewSpan = await link.locator('span[dir="auto"]').nth(1);
          const preview = await previewSpan.textContent().catch(() => "");
          
          if (preview) {
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
          conversationUrl: `https://www.facebook.com${href}`,
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

// Extract messages from open conversation by scrolling through and collecting all
// Uses the SAME approach as message-agent: scroll and collect, deduplicating by text
async function extractConversationMessages(page: Page, contactName: string, log: (msg: string) => void): Promise<any[]> {
  try {
    // Wait for messages to load
    await page.waitForTimeout(1000);
    
    // Helper function to extract messages from current viewport
    const extractVisible = async (): Promise<Array<{ sender: 'THEM' | 'US'; content: string }>> => {
      return await page.evaluate((contactNameArg) => {
        const messages: Array<{ sender: 'THEM' | 'US'; content: string }> = [];
        
        const main = document.querySelector('[role="main"]');
        if (!main) return messages;
        
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
              
              // Skip truly invalid
              if (!text || text.length < 2) continue;
              
              // Skip ONLY clear timestamps (not messages that might contain time)
              if (/^\d{1,2}:\d{2}\s*(AM|PM)?$/i.test(text)) continue;
              if (/^(yesterday|today)\s*at\s*\d/i.test(text)) continue;
              if (/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*at\s*\d/i.test(text)) continue;
              if (/^(December|January|February|March|April|May|June|July|August|September|October|November)\s+\d/i.test(text)) continue;
              
              // Skip ONLY exact system messages
              if (lowerText === 'messages and calls are secured with end-to-end encryption. learn more.') continue;
              if (lowerText.includes("you're now friends on facebook")) continue;
              if (lowerText === 'say hi to your new facebook friend.') continue;
              if (lowerText === 'get started') continue;
              if (lowerText === 'enter') continue;
              
              // Skip ONLY exact contact name (not messages containing it)
              if (lowerText === contactLower) continue;
              if (lowerText === contactFirstName && text.length < 20) continue;
              
              // Check line height - messages have EXACTLY 19.9-20.0px (same as message-agent)
              const computedStyle = window.getComputedStyle(htmlEl);
              const lineHeight = parseFloat(computedStyle.lineHeight);
              if (isNaN(lineHeight) || lineHeight < 19.9 || lineHeight > 20.0) continue;
              
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
              
              messages.push({
                sender: isTheirs ? 'THEM' : 'US',
                content: text,
              });
            }
          }
        }
        
        return messages;
      }, contactName);
    };
    
    // Collect all messages using Map for deduplication (preserves order)
    const allMessages = new Map<string, { sender: 'THEM' | 'US'; content: string }>();
    
    // First extraction at current position (should be at top after scrollConversationToTop)
    const initial = await extractVisible();
    for (const msg of initial) {
      if (!allMessages.has(msg.content)) {
        allMessages.set(msg.content, msg);
      }
    }
    
    // Scroll down and extract, collecting all unique messages
    let lastScrollTop = -1;
    let samePositionCount = 0;
    const maxScrolls = 300;
    
    for (let i = 0; i < maxScrolls; i++) {
      // Scroll down
      const scrollResult = await page.evaluate(() => {
        const main = document.querySelector('[role="main"]');
        if (!main) return { scrollTop: 0, atBottom: true };
        
        const findScrollable = (el: Element | null): Element | null => {
          while (el) {
            const style = window.getComputedStyle(el);
            if ((style.overflowY === 'scroll' || style.overflowY === 'auto') && el.scrollHeight > el.clientHeight) {
              return el;
            }
            el = el.parentElement;
          }
          return null;
        };
        
        const firstRow = main.querySelector('[role="row"]');
        const scrollable = findScrollable(firstRow);
        
        if (scrollable) {
          const maxScroll = scrollable.scrollHeight - scrollable.clientHeight;
          scrollable.scrollTop = Math.min(scrollable.scrollTop + 150, maxScroll);
          return {
            scrollTop: scrollable.scrollTop,
            atBottom: Math.abs(scrollable.scrollTop - maxScroll) < 5
          };
        }
        return { scrollTop: 0, atBottom: true };
      });
      
      // Extract messages from current viewport
      const visible = await extractVisible();
      let newCount = 0;
      for (const msg of visible) {
        if (!allMessages.has(msg.content)) {
          allMessages.set(msg.content, msg);
          newCount++;
        }
      }
      
      // Check if stuck
      if (scrollResult.scrollTop === lastScrollTop) {
        samePositionCount++;
      } else {
        samePositionCount = 0;
      }
      lastScrollTop = scrollResult.scrollTop;
      
      // Stop conditions
      if (scrollResult.atBottom || samePositionCount > 5) {
        break;
      }
      
      await page.waitForTimeout(50);
    }
    
    // Convert map to array (preserves insertion order)
    const messages = Array.from(allMessages.values());
    
    // Final count
    const themCount = messages.filter(m => m.sender === 'THEM').length;
    const usCount = messages.filter(m => m.sender === 'US').length;
    
    log(`  📨 Extracted ${messages.length} messages (THEM: ${themCount}, US: ${usCount})`);
    
    return messages.map((msg) => ({
      content: msg.content,
      sender: msg.sender,
      timestamp: new Date(),
    }));

  } catch (err) {
    log(`  ❌ Error extracting messages: ${err}`);
    return [];
  }
}

// DELETE - Reset all conversations for an account
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");

    if (!accountId) {
      return NextResponse.json({ success: false, error: "accountId required" }, { status: 400 });
    }

    // Get count before deletion
    const contactCount = await prisma.messengerContact.count({
      where: { accountId },
    });

    const messageCount = await prisma.messengerMessage.count({
      where: {
        contact: { accountId },
      },
    });

    // Delete all messages first (cascade should handle this, but being explicit)
    await prisma.messengerMessage.deleteMany({
      where: {
        contact: { accountId },
      },
    });

    // Delete all contacts for this account
    await prisma.messengerContact.deleteMany({
      where: { accountId },
    });

    return NextResponse.json({
      success: true,
      deleted: {
        contacts: contactCount,
        messages: messageCount,
      },
      message: `Deleted ${contactCount} contacts and ${messageCount} messages for account ${accountId}`,
    });

  } catch (error) {
    console.error("[RESET ERROR]", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}
