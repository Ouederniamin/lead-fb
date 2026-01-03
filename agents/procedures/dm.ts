// P11: Direct Message Procedure
// Navigate to profile and send initial DM

import { Page } from "playwright";
import { humanDelay, humanType, humanScroll, humanClick } from "./human-behavior";
import { PROFILE_SELECTORS, MESSENGER_SELECTORS, COMMON_SELECTORS } from "./facebook-selectors";

// DM-specific selectors
export const DM_SELECTORS = {
  // Profile page message button
  messageButton: [
    '[aria-label="Message"][role="button"]',
    '[aria-label*="Message"][role="link"]',
    'a[href*="/messages/t/"]',
    '[data-testid="profile-message-button"]',
    'div[aria-label*="Messenger"]',
  ],
  
  // Messenger popup/modal
  messengerPopup: [
    '[role="dialog"][aria-label*="Messenger"]',
    '[role="dialog"][aria-label*="Chat"]',
    'div[aria-label*="Messenger"]',
  ],
  
  // Message input in modal
  messageInput: [
    'div[contenteditable="true"][role="textbox"]',
    'div[aria-label*="Message"][contenteditable="true"]',
    'div[data-lexical-editor="true"]',
  ],
  
  // Send button
  sendButton: [
    '[aria-label="Press enter to send"]',
    '[aria-label="Send"]',
    'div[role="button"][aria-label*="send" i]',
  ],
};

export interface DMResult {
  success: boolean;
  messageText: string;
  profileUrl: string;
  conversationUrl: string | null;
  contactName: string | null;
  error?: string;
}

/**
 * Navigate to a Facebook profile page
 */
export async function navigateToProfile(
  page: Page,
  profileUrl: string,
  log: (msg: string) => void
): Promise<boolean> {
  try {
    log(`🔗 Navigating to profile: ${profileUrl}`);
    
    await page.goto(profileUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    
    await humanDelay(2000, 4000);
    
    // Check if profile loaded by looking for profile name
    const profileName = await page.$('h1, [role="heading"]');
    if (!profileName) {
      log(`⚠️ Profile page may not have loaded correctly`);
      // Still continue as selectors vary
    }
    
    // Check for common error pages
    const pageNotFound = await page.$('text="This page isn\'t available"');
    const contentNotFound = await page.$('text="This content isn\'t available"');
    
    if (pageNotFound || contentNotFound) {
      log(`❌ Profile not available or blocked`);
      return false;
    }
    
    log(`✅ Profile page loaded`);
    return true;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log(`❌ Failed to navigate to profile: ${msg}`);
    return false;
  }
}

/**
 * Extract the contact name from the profile page
 */
async function extractContactName(page: Page): Promise<string | null> {
  try {
    // Try to get the profile name from h1 or heading
    const nameElement = await page.$('h1');
    if (nameElement) {
      const name = await nameElement.textContent();
      if (name && name.length > 0 && name.length < 100) {
        return name.trim();
      }
    }
    
    // Try alternative selectors
    const altName = await page.$('[data-testid="profile_name"]');
    if (altName) {
      const name = await altName.textContent();
      if (name) return name.trim();
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Click the Message button on a profile
 */
export async function clickMessageButton(
  page: Page,
  log: (msg: string) => void
): Promise<boolean> {
  try {
    // Scroll down a bit to ensure buttons are visible
    await humanScroll(page, "down", "small");
    await humanDelay(500, 1000);
    
    // Try each message button selector
    for (const selector of DM_SELECTORS.messageButton) {
      const button = await page.$(selector);
      if (button) {
        const isVisible = await button.isVisible();
        if (isVisible) {
          log(`📧 Found Message button, clicking...`);
          await humanClick(page, selector);
          await humanDelay(1500, 3000);
          return true;
        }
      }
    }
    
    // Try finding by text content
    const messageByText = await page.$('span:has-text("Message"), div:has-text("Message")');
    if (messageByText) {
      // Make sure it's the button, not random text
      const parent = await messageByText.$('xpath=ancestor::div[@role="button" or @role="link"]');
      if (parent) {
        log(`📧 Found Message button by text, clicking...`);
        await parent.click(); // Use direct click since we have the element
        await humanDelay(1500, 3000);
        return true;
      }
    }
    
    log(`⚠️ Could not find Message button on profile`);
    return false;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log(`❌ Error clicking Message button: ${msg}`);
    return false;
  }
}

/**
 * Wait for Messenger to open (either popup or full page)
 */
async function waitForMessenger(
  page: Page,
  log: (msg: string) => void
): Promise<{ type: "popup" | "page" | null; conversationUrl: string | null }> {
  try {
    // Wait for either popup or navigation
    await humanDelay(1000, 2000);
    
    // Check if we navigated to Messenger
    const currentUrl = page.url();
    if (currentUrl.includes('/messages/t/') || currentUrl.includes('messenger.com')) {
      log(`📱 Navigated to Messenger page`);
      return { type: "page", conversationUrl: currentUrl };
    }
    
    // Check for Messenger popup/modal
    for (const selector of DM_SELECTORS.messengerPopup) {
      const popup = await page.$(selector);
      if (popup && await popup.isVisible()) {
        log(`💬 Messenger popup opened`);
        return { type: "popup", conversationUrl: currentUrl };
      }
    }
    
    // Wait a bit more and check for message input
    await humanDelay(1000, 2000);
    
    for (const selector of DM_SELECTORS.messageInput) {
      const input = await page.$(selector);
      if (input && await input.isVisible()) {
        log(`✅ Message input found`);
        return { type: "popup", conversationUrl: page.url() };
      }
    }
    
    log(`⚠️ Messenger did not open`);
    return { type: null, conversationUrl: null };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log(`❌ Error waiting for Messenger: ${msg}`);
    return { type: null, conversationUrl: null };
  }
}

/**
 * Send a message in the currently open Messenger conversation
 */
export async function sendMessage(
  page: Page,
  messageText: string,
  log: (msg: string) => void
): Promise<boolean> {
  try {
    // Find the message input
    let messageInput = null;
    for (const selector of DM_SELECTORS.messageInput) {
      messageInput = await page.$(selector);
      if (messageInput && await messageInput.isVisible()) {
        break;
      }
    }
    
    if (!messageInput) {
      // Try with Messenger selectors
      messageInput = await page.$(MESSENGER_SELECTORS.messageInput);
    }
    
    if (!messageInput) {
      log(`❌ Could not find message input`);
      return false;
    }
    
    // Click to focus
    await messageInput.click(); // Use direct click on element
    await humanDelay(300, 600);
    
    // Type the message
    log(`⌨️ Typing message: "${messageText.substring(0, 50)}..."`);
    await humanType(page, messageText);
    await humanDelay(500, 1000);
    
    // Send the message (press Enter)
    log(`📤 Sending message...`);
    await page.keyboard.press("Enter");
    await humanDelay(1500, 3000);
    
    // Verify message was sent (look for "Sent" indicator or our message)
    const sent = await page.evaluate((text) => {
      // Look for the message in the conversation
      const messages = document.querySelectorAll('[dir="auto"]');
      for (const msg of messages) {
        if (msg.textContent?.includes(text.substring(0, 20))) {
          return true;
        }
      }
      return false;
    }, messageText);
    
    if (sent) {
      log(`✅ Message sent successfully`);
      return true;
    }
    
    // Assume sent if no error
    log(`✅ Message submitted`);
    return true;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log(`❌ Error sending message: ${msg}`);
    return false;
  }
}

/**
 * Extract conversation URL from Messenger
 */
function extractConversationUrl(page: Page): string | null {
  const url = page.url();
  
  // Check if we're on a conversation page
  if (url.includes('/messages/t/')) {
    // Extract just the conversation part
    const match = url.match(/(.*\/messages\/t\/[^?/]+)/);
    return match ? match[1] : url;
  }
  
  if (url.includes('messenger.com/t/')) {
    const match = url.match(/(.*\/t\/[^?/]+)/);
    return match ? match[1] : url;
  }
  
  return null;
}

/**
 * Send an initial DM to a profile (combined operation)
 */
export async function sendInitialDM(
  page: Page,
  profileUrl: string,
  messageText: string,
  log: (msg: string) => void
): Promise<DMResult> {
  const result: DMResult = {
    success: false,
    messageText,
    profileUrl,
    conversationUrl: null,
    contactName: null,
  };
  
  try {
    // Navigate to profile
    const navigated = await navigateToProfile(page, profileUrl, log);
    if (!navigated) {
      result.error = "Failed to navigate to profile";
      return result;
    }
    
    // Extract contact name before clicking Message
    result.contactName = await extractContactName(page);
    log(`👤 Contact name: ${result.contactName || "Unknown"}`);
    
    // Click Message button
    const clicked = await clickMessageButton(page, log);
    if (!clicked) {
      result.error = "Could not find or click Message button";
      return result;
    }
    
    // Wait for Messenger to open
    const messenger = await waitForMessenger(page, log);
    if (!messenger.type) {
      result.error = "Messenger did not open";
      return result;
    }
    
    // Get conversation URL
    result.conversationUrl = extractConversationUrl(page);
    log(`🔗 Conversation URL: ${result.conversationUrl || "Not captured"}`);
    
    // Send the message
    const sent = await sendMessage(page, messageText, log);
    if (!sent) {
      result.error = "Failed to send message";
      return result;
    }
    
    // Update conversation URL after sending (in case it changed)
    result.conversationUrl = extractConversationUrl(page) || result.conversationUrl;
    result.success = true;
    
    return result;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log(`❌ Error sending initial DM: ${msg}`);
    result.error = msg;
    return result;
  }
}
