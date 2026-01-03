// P10: Commenting Procedure
// Navigate to posts and post comments

import { Page } from "playwright";
import { humanDelay, humanType, humanScroll, humanClick } from "./human-behavior";
import { GROUP_SELECTORS, COMMON_SELECTORS } from "./facebook-selectors";

// Comment-specific selectors
export const COMMENT_SELECTORS = {
  // Comment input on post page
  commentInput: [
    'div[contenteditable="true"][role="textbox"][aria-label*="comment"]',
    'div[contenteditable="true"][role="textbox"][aria-label*="Comment"]',
    'div[contenteditable="true"][data-lexical-editor="true"]',
    'div[contenteditable="true"][role="textbox"]',
  ],
  
  // Submit button
  submitButton: [
    '[aria-label="Comment"][role="button"]',
    '[aria-label*="Post"][role="button"]',
    'div[aria-label*="submit"]',
    'form button[type="submit"]',
  ],
  
  // Comment posted indicator
  commentPosted: [
    '[role="article"][aria-label*="Comment"]',
    'div[aria-label*="commented"]',
  ],
  
  // Post page elements
  postContent: '[data-ad-comet-preview="message"], [data-ad-preview="message"]',
  commentSection: 'div[aria-label*="comment"], form[role="presentation"]',
};

export interface CommentResult {
  success: boolean;
  commentText: string;
  postUrl: string;
  error?: string;
  screenshotPath?: string;
}

/**
 * Navigate to a Facebook post page
 */
export async function navigateToPost(
  page: Page,
  postUrl: string,
  log: (msg: string) => void
): Promise<boolean> {
  try {
    log(`🔗 Navigating to post: ${postUrl}`);
    
    await page.goto(postUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    
    await humanDelay(2000, 4000);
    
    // Check if post loaded
    const postContent = await page.$(COMMENT_SELECTORS.postContent);
    if (!postContent) {
      // Try scrolling to load content
      await humanScroll(page, "down", "medium");
      await humanDelay(1000, 2000);
    }
    
    // Verify we're on the post page
    const currentUrl = page.url();
    if (!currentUrl.includes('/posts/') && !currentUrl.includes('permalink')) {
      log(`⚠️ May not be on post page. URL: ${currentUrl}`);
      return false;
    }
    
    log(`✅ Post page loaded`);
    return true;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log(`❌ Failed to navigate to post: ${msg}`);
    return false;
  }
}

/**
 * Find and click the comment input to focus it
 */
async function focusCommentInput(
  page: Page,
  log: (msg: string) => void
): Promise<boolean> {
  try {
    // First, scroll down to make comment section visible
    await humanScroll(page, "down", "large");
    await humanDelay(1000, 2000);
    
    // Look for "Write a comment" placeholder or comment box
    for (const selector of COMMENT_SELECTORS.commentInput) {
      const input = await page.$(selector);
      if (input) {
        // Check if it's visible
        const isVisible = await input.isVisible();
        if (isVisible) {
          await humanClick(page, selector);
          await humanDelay(500, 1000);
          log(`✅ Focused comment input`);
          return true;
        }
      }
    }
    
    // Try clicking on "Write a comment" text
    const writeComment = await page.$('text="Write a comment"');
    if (writeComment) {
      await humanClick(page, 'text="Write a comment"');
      await humanDelay(500, 1000);
      log(`✅ Clicked "Write a comment"`);
      return true;
    }
    
    // Try Arabic version
    const writeCommentArabic = await page.$('text="اكتب تعليقًا"');
    if (writeCommentArabic) {
      await humanClick(page, 'text="اكتب تعليقًا"');
      await humanDelay(500, 1000);
      log(`✅ Clicked Arabic comment prompt`);
      return true;
    }
    
    log(`⚠️ Could not find comment input`);
    return false;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log(`❌ Error focusing comment input: ${msg}`);
    return false;
  }
}

/**
 * Type and submit a comment
 */
export async function postComment(
  page: Page,
  commentText: string,
  log: (msg: string) => void
): Promise<CommentResult> {
  const result: CommentResult = {
    success: false,
    commentText,
    postUrl: page.url(),
  };
  
  try {
    // Focus the comment input
    const focused = await focusCommentInput(page, log);
    if (!focused) {
      result.error = "Could not focus comment input";
      return result;
    }
    
    await humanDelay(500, 1000);
    
    // Find the active/focused input
    let commentInput = await page.$('div[contenteditable="true"]:focus');
    if (!commentInput) {
      // Try finding any visible comment input
      for (const selector of COMMENT_SELECTORS.commentInput) {
        commentInput = await page.$(selector);
        if (commentInput && await commentInput.isVisible()) {
          break;
        }
      }
    }
    
    if (!commentInput) {
      result.error = "Comment input not found after focus";
      return result;
    }
    
    // Type the comment with human-like behavior
    log(`⌨️ Typing comment: "${commentText.substring(0, 50)}..."`);
    await commentInput.click(); // Focus the element first
    await humanType(page, commentText);
    await humanDelay(1000, 2000);
    
    // Submit the comment
    // Option 1: Press Enter
    log(`📤 Submitting comment...`);
    await page.keyboard.press("Enter");
    await humanDelay(2000, 4000);
    
    // Verify comment was posted
    // Look for our comment in the page
    const commentPosted = await page.evaluate((text) => {
      const comments = document.querySelectorAll('[role="article"]');
      for (const comment of comments) {
        if (comment.textContent?.includes(text.substring(0, 30))) {
          return true;
        }
      }
      return false;
    }, commentText);
    
    if (commentPosted) {
      log(`✅ Comment posted successfully`);
      result.success = true;
    } else {
      // Check if there was an error
      const errorDialog = await page.$(COMMON_SELECTORS.errorMessage);
      if (errorDialog) {
        const errorText = await errorDialog.textContent();
        result.error = errorText || "Unknown error posting comment";
        log(`❌ Comment error: ${result.error}`);
      } else {
        // Assume success if no error
        log(`✅ Comment submitted (verification pending)`);
        result.success = true;
      }
    }
    
    return result;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log(`❌ Error posting comment: ${msg}`);
    result.error = msg;
    return result;
  }
}

/**
 * Navigate to post and post a comment (combined operation)
 */
export async function commentOnPost(
  page: Page,
  postUrl: string,
  commentText: string,
  log: (msg: string) => void
): Promise<CommentResult> {
  // Navigate to post
  const navigated = await navigateToPost(page, postUrl, log);
  if (!navigated) {
    return {
      success: false,
      commentText,
      postUrl,
      error: "Failed to navigate to post",
    };
  }
  
  // Post the comment
  return await postComment(page, commentText, log);
}
