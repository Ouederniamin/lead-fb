// Procedures P14, P15, P16: Messenger Operations

import { Page } from "playwright";
import { Message, Conversation } from "../types";
import { humanDelay, humanType, shortDelay } from "./human-behavior";
import { MESSENGER_SELECTORS, isValidMessage, isValidContactName, getDisplayName, NAME_BLACKLIST } from "./facebook-selectors";

// ============================================
// P14: CHECK INBOX FOR UNREAD
// ============================================
export async function checkInbox(
  page: Page,
  log: (msg: string) => void
): Promise<{ hasUnread: boolean; unreadCount: number; conversationNames: string[] }> {
  log("📬 Checking inbox for unread messages...");

  try {
    // Navigate to messages first
    await page.goto("https://www.facebook.com/messages/t/", { waitUntil: "load", timeout: 30000 });
    await humanDelay(2000, 2500);
    
    // Always use click method for Unread tab (most reliable)
    let clickedUnread = false;
    
    // Method 1: Try Playwright locator with proper waiting
    try {
      const unreadTab = page.locator('span:text-is("Unread")').first();
      await unreadTab.waitFor({ state: 'visible', timeout: 5000 });
      
      // Find clickable parent (a, button, or tab role)
      const clickableParent = page.locator('span:text-is("Unread")').locator('xpath=ancestor::*[self::a or self::button or @role="tab" or @role="button"][1]').first();
      const parentExists = await clickableParent.count() > 0;
      
      if (parentExists) {
        await clickableParent.click();
        clickedUnread = true;
        log("✅ Clicked Unread tab (via parent)");
      } else {
        await unreadTab.click();
        clickedUnread = true;
        log("✅ Clicked Unread tab (direct)");
      }
    } catch (e) {
      log(`⚠️ Click method 1 failed: ${e}`);
    }

    // Method 2: Find via evaluate and click with mouse
    if (!clickedUnread) {
      const tabCoords = await page.evaluate(() => {
        const spans = document.querySelectorAll('span');
        for (const span of spans) {
          if (span.textContent?.trim() === 'Unread') {
            const clickable = span.closest('a, button, [role="tab"], [role="button"]') || span;
            const rect = clickable.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
            }
          }
        }
        return null;
      });

      if (tabCoords) {
        await page.mouse.click(tabCoords.x, tabCoords.y);
        clickedUnread = true;
        log("✅ Clicked Unread tab (via coordinates)");
      }
    }

    // Method 3: Last resort - find all spans and click
    if (!clickedUnread) {
      const allSpans = page.locator('span');
      const count = await allSpans.count();
      for (let i = 0; i < count; i++) {
        const span = allSpans.nth(i);
        const text = await span.textContent().catch(() => '');
        if (text?.trim() === 'Unread') {
          await span.click();
          clickedUnread = true;
          log("✅ Clicked Unread tab (via span iteration)");
          break;
        }
      }
    }

    if (!clickedUnread) {
      log("⚠️ Could not find Unread tab, checking current view...");
    } else {
      // Wait for tab content to load after clicking
      await humanDelay(2500, 3000);
    }

    // Check for unread conversations
    const unreadConversations = await page.evaluate((blacklist: string[]) => {
      const pageText = document.body.innerText || '';
      if (pageText.includes('No unread chats')) {
        return [];
      }
      
      const results: { name: string }[] = [];
      const seenNames = new Set<string>();
      
      const rows = document.querySelectorAll('[role="row"]');
      rows.forEach((row) => {
        const spans = row.querySelectorAll('span');
        for (const span of spans) {
          const text = span.textContent?.trim() || '';
          const lowerText = text.toLowerCase();
          
          // Skip blacklisted names
          if (blacklist.some(b => lowerText === b || lowerText.includes(b))) continue;
          if (seenNames.has(lowerText)) continue;
          if (lowerText.includes('no unread') || lowerText.includes('unread chats')) continue;
          
          // Valid name: starts with capital, 3-50 chars, only letters/spaces
          if (text.length >= 3 && text.length <= 50 && 
              /^[A-ZÀ-ÿ\u0600-\u06FF]/.test(text) &&
              /^[A-Za-zÀ-ÿ\u0600-\u06FF\s'-]+$/.test(text) &&
              !lowerText.match(/^(enter|aa|ok|yes|no|hi|hey|hello|when|you|have|see|them|here)$/i)) {
            seenNames.add(lowerText);
            results.push({ name: text });
            break; // Only take first name from each row
          }
        }
      });
      
      return results;
    }, NAME_BLACKLIST);

    const conversationNames = unreadConversations.map(c => c.name);
    const unreadCount = unreadConversations.length;

    log(`📊 Found ${unreadCount} unread conversations: ${conversationNames.join(', ') || '(none)'}`);
    
    return {
      hasUnread: unreadCount > 0,
      unreadCount,
      conversationNames,
    };
  } catch (error) {
    log(`❌ Error checking inbox: ${error}`);
    return { hasUnread: false, unreadCount: 0, conversationNames: [] };
  }
}

// ============================================
// CLICK FIRST UNREAD CONVERSATION
// ============================================
export async function clickFirstUnread(
  page: Page,
  log: (msg: string) => void,
  targetName?: string
): Promise<{ clicked: boolean; contactName: string | null }> {
  log("👆 Clicking first unread conversation...");

  try {
    // If targetName is provided, click specifically on that one
    const nameToClick = targetName;

    const result = await page.evaluate((name: string | undefined) => {
      const rows = document.querySelectorAll('[role="row"]');
      
      for (const row of rows) {
        const text = row.textContent?.toLowerCase() || '';
        
        // If we have a target name, match it; otherwise click first row
        if (name) {
          if (!text.includes(name.toLowerCase())) continue;
        }
        
        const link = row.querySelector('a');
        if (link) {
          link.click();
          return { clicked: true, contactName: name || null };
        }
        
        (row as HTMLElement).click();
        return { clicked: true, contactName: name || null };
      }
      
      return { clicked: false, contactName: null };
    }, nameToClick);

    if (result.clicked) {
      await humanDelay(2000, 2500);
      log(`✅ Clicked conversation${result.contactName ? `: ${result.contactName}` : ''}`);
      return result;
    }

    log("⚠️ No conversation to click");
    return { clicked: false, contactName: null };
  } catch (error) {
    log(`❌ Error clicking conversation: ${error}`);
    return { clicked: false, contactName: null };
  }
}

// ============================================
// P15: READ CONVERSATION
// ============================================
export async function readConversation(
  page: Page,
  log: (msg: string) => void
): Promise<Conversation | null> {
  log("📖 Reading conversation...");

  try {
    const result = await page.evaluate(() => {
      const messages: Array<{ sender: 'them' | 'us'; text: string }> = [];
      const seenTexts = new Set<string>();
      
      // Get contact name from header
      const header = document.querySelector('[role="main"] [role="heading"]');
      let contactName = header?.textContent?.trim() || "Unknown";
      
      // Clean up contact name
      contactName = contactName.split('\n')[0].trim();
      
      // Find message container
      const main = document.querySelector('[role="main"]');
      if (!main) return null;
      
      // Get all message rows
      const rows = main.querySelectorAll('[role="row"]');
      
      for (const row of rows) {
        const presentations = row.querySelectorAll('[role="presentation"]');
        
        for (const pres of presentations) {
          const textEls = pres.querySelectorAll('[dir="auto"]');
          
          for (const el of textEls) {
            const htmlEl = el as HTMLElement;
            const text = htmlEl.textContent?.trim() || '';
            const lowerText = text.toLowerCase();
            
            // Skip invalid messages
            if (!text || text.length < 2) continue;
            if (seenTexts.has(text)) continue;
            
            // Skip timestamps
            if (/^\d{1,2}:\d{2}/.test(text)) continue;
            if (/\d{1,2}:\d{2}\s*(AM|PM)/i.test(text)) continue;
            if (/yesterday|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday/i.test(text)) continue;
            
            // Skip system messages
            if (lowerText.includes('you sent') || 
                lowerText.includes('messages and calls are secured') ||
                lowerText.includes('end-to-end encryption') ||
                lowerText === 'enter' ||
                lowerText === contactName.toLowerCase() ||
                lowerText === contactName.split(' ')[0].toLowerCase()) {
              continue;
            }
            
            // Determine sender by checking computed style (bubble color)
            const computedStyle = window.getComputedStyle(htmlEl);
            const lineHeight = parseFloat(computedStyle.lineHeight);
            
            // Check for "our" message indicators
            let isOurs = false;
            
            // Check parent chain for blue background (our messages)
            let parent: HTMLElement | null = htmlEl;
            for (let i = 0; i < 5 && parent; i++) {
              const bg = window.getComputedStyle(parent).backgroundColor;
              // Blue backgrounds indicate our messages
              if (bg.includes('0, 132, 255') || bg.includes('rgb(0, 132, 255)')) {
                isOurs = true;
                break;
              }
              parent = parent.parentElement;
            }
            
            // Valid message with proper line height
            if (lineHeight >= 19.5 && lineHeight <= 20.5) {
              seenTexts.add(text);
              messages.push({
                sender: isOurs ? 'us' : 'them',
                text,
              });
            }
          }
        }
      }
      
      return {
        contactName,
        messages,
      };
    });

    if (!result) {
      log("❌ Could not read conversation");
      return null;
    }

    log(`✅ Read ${result.messages.length} messages from ${result.contactName}`);
    
    return {
      contactName: result.contactName,
      messages: result.messages,
      isUnread: true,
    };
  } catch (error) {
    log(`❌ Error reading conversation: ${error}`);
    return null;
  }
}

// ============================================
// P16: SEND REPLY
// ============================================
export async function sendReply(
  page: Page,
  replyText: string,
  log: (msg: string) => void
): Promise<boolean> {
  log(`📤 Sending reply: "${replyText.substring(0, 50)}..."`);

  try {
    // Find message input
    const input = await page.$('div[contenteditable="true"][role="textbox"]');
    if (!input) {
      log("❌ Could not find message input");
      return false;
    }

    // Click to focus
    await input.click();
    await humanDelay(300, 600);

    // Type the message with human-like timing
    await humanType(page, replyText);
    await humanDelay(500, 1000);

    // Press Enter to send
    await page.keyboard.press("Enter");
    await humanDelay(1000, 2000);

    // Verify message was sent by checking for it in the conversation
    const sent = await page.evaluate((text) => {
      const messages = document.querySelectorAll('[role="main"] [dir="auto"]');
      for (const msg of messages) {
        if (msg.textContent?.includes(text.substring(0, 20))) {
          return true;
        }
      }
      return false;
    }, replyText);

    if (sent) {
      log("✅ Reply sent successfully");
      return true;
    } else {
      log("⚠️ Reply may not have been sent");
      return true; // Assume it worked
    }
  } catch (error) {
    log(`❌ Error sending reply: ${error}`);
    return false;
  }
}

// ============================================
// NAVIGATE TO MESSENGER
// ============================================
export async function navigateToMessenger(
  page: Page,
  log: (msg: string) => void
): Promise<boolean> {
  log("📱 Navigating to Messenger...");

  try {
    await page.goto("https://www.facebook.com/messages/t/", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await page.waitForTimeout(3000);

    // Verify we're on messenger
    const isMessenger = await page.evaluate(() => {
      return window.location.href.includes('/messages');
    });

    if (isMessenger) {
      log("✅ Navigated to Messenger");
      return true;
    }

    log("❌ Not on Messenger");
    return false;
  } catch (error) {
    log(`❌ Error navigating to Messenger: ${error}`);
    return false;
  }
}

// ============================================
// EXTRACT CONTACT INFO FROM TEXT
// ============================================
export function extractContactInfo(text: string): { 
  phone?: string; 
  whatsapp?: string;
} {
  const result: { phone?: string; whatsapp?: string } = {};

  // Tunisia phone pattern: +216 XX XXX XXX or 8 digits
  const phoneMatch = text.match(/(\+?216[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{3}|\d{8})/);
  
  if (phoneMatch) {
    const cleanNumber = phoneMatch[1].replace(/[\s-]/g, '');
    
    // Check if it's specifically WhatsApp
    const lowerText = text.toLowerCase();
    if (lowerText.includes('whatsapp') || 
        lowerText.includes('واتساب') || 
        lowerText.includes('واتس') ||
        lowerText.includes('whats')) {
      result.whatsapp = cleanNumber;
    } else {
      result.phone = cleanNumber;
    }
  }

  return result;
}

// ============================================
// GET CONVERSATION HASH (for dedup)
// ============================================
export function getConversationHash(messages: Message[]): string {
  if (messages.length === 0) return '';
  
  // Hash based on last message AND count for better change detection
  const lastMsg = messages[messages.length - 1];
  const theirCount = messages.filter(m => m.sender === 'them').length;
  const ourCount = messages.filter(m => m.sender === 'us').length;
  return `${theirCount}:${ourCount}:${lastMsg.sender}:${lastMsg.text.substring(0, 50)}`;
}

// ============================================
// QUICK CHECK FOR NEW MESSAGES (compares last message only)
// ============================================
export function hasNewTheirMessage(
  currentMessages: Message[],
  savedLastTheirMessage: string | null
): boolean {
  // Get last 'them' message from current
  const theirMessages = currentMessages.filter(m => m.sender === 'them');
  if (theirMessages.length === 0) return false;
  
  const lastTheirMsg = theirMessages[theirMessages.length - 1];
  
  // If no saved message, any their message is new
  if (!savedLastTheirMessage) return true;
  
  // Compare (substring to handle truncation)
  return !savedLastTheirMessage.startsWith(lastTheirMsg.text.substring(0, 50));
}
