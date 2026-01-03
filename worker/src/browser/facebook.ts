/**
 * Facebook-specific scraping logic
 */

import { Page } from 'playwright';
import { humanScroll, humanClick, simulateReading } from './humanize.js';
import { randomDelay } from '../utils/random.js';
import logger from '../utils/logger.js';
import config from '../config.js';

export interface ScrapedPost {
  postUrl: string;
  authorName: string;
  authorProfileUrl: string;
  authorFbId?: string;
  postText: string;
  postDate?: string;
  isAnonymous: boolean;
}

/**
 * Extract Facebook user ID from profile URL
 */
function extractFbId(profileUrl: string): string | undefined {
  // Handle /profile.php?id=123456789
  const idMatch = profileUrl.match(/profile\.php\?id=(\d+)/);
  if (idMatch) return idMatch[1];
  
  // Handle /username format
  const usernameMatch = profileUrl.match(/facebook\.com\/([^/?]+)/);
  if (usernameMatch && !['groups', 'pages', 'events'].includes(usernameMatch[1])) {
    return usernameMatch[1];
  }
  
  return undefined;
}

/**
 * Navigate to a Facebook group
 */
export async function navigateToGroup(page: Page, groupUrl: string): Promise<boolean> {
  try {
    logger.info('Facebook', `Navigating to group: ${groupUrl}`);
    
    await page.goto(groupUrl, { waitUntil: 'networkidle', timeout: 60000 });
    await randomDelay(2000, 4000);

    // Check if we're on the group page
    const groupHeader = await page.$('[role="main"]');
    if (!groupHeader) {
      logger.warn('Facebook', 'Could not find group content');
      return false;
    }

    // Scroll to load content
    await humanScroll(page, 3);
    
    return true;
  } catch (error) {
    logger.error('Facebook', 'Failed to navigate to group', error);
    return false;
  }
}

/**
 * Scrape posts from current group page
 */
export async function scrapePosts(page: Page, limit: number = 10): Promise<ScrapedPost[]> {
  const posts: ScrapedPost[] = [];
  
  try {
    // Scroll to load more posts
    await humanScroll(page, 5);
    
    // Find post containers - Facebook uses role="article" for posts
    const postElements = await page.$$('[role="article"]');
    
    logger.info('Facebook', `Found ${postElements.length} post elements`);

    for (const postEl of postElements.slice(0, limit)) {
      try {
        // Extract post URL
        const linkEl = await postEl.$('a[href*="/posts/"], a[href*="/permalink/"], a[href*="?story_fbid"]');
        const postUrl = linkEl ? await linkEl.getAttribute('href') : null;
        
        if (!postUrl) continue;

        // Make URL absolute
        const fullUrl = postUrl.startsWith('http') 
          ? postUrl 
          : `https://www.facebook.com${postUrl}`;

        // Extract author info
        const authorEl = await postEl.$('strong a, h4 a, [data-ad-preview="headline"] a');
        const authorName = authorEl ? await authorEl.textContent() : null;
        const authorProfileUrl = authorEl ? await authorEl.getAttribute('href') : '';
        
        // Check if anonymous (no author link or name)
        const isAnonymous = !authorName || authorName.trim() === '' || !authorProfileUrl;

        // Extract Facebook ID from profile URL
        const authorFbId = authorProfileUrl ? extractFbId(authorProfileUrl) : undefined;

        // Extract post text
        const textEl = await postEl.$('[data-ad-preview="message"], [data-ad-comet-preview="message"], div[dir="auto"]');
        let postText = '';
        
        if (textEl) {
          postText = await textEl.textContent() || '';
        } else {
          // Fallback: get all text from post
          const allText = await postEl.textContent();
          postText = allText?.substring(0, 1000) || '';
        }

        // Clean up text
        postText = postText.trim();
        
        // Skip if no meaningful text
        if (postText.length < 20) continue;

        // Extract date if available
        const dateEl = await postEl.$('abbr, span[id*="jsc"] > span');
        const postDate = dateEl ? (await dateEl.getAttribute('title')) ?? undefined : undefined;

        posts.push({
          postUrl: fullUrl,
          authorName: authorName?.trim() || 'Anonymous',
          authorProfileUrl: authorProfileUrl 
            ? (authorProfileUrl.startsWith('http') ? authorProfileUrl : `https://www.facebook.com${authorProfileUrl}`)
            : '',
          authorFbId,
          postText,
          postDate,
          isAnonymous,
        });

        // Simulate reading each post
        await simulateReading(postText.length);
        
      } catch (postError) {
        logger.debug('Facebook', 'Failed to parse post', postError);
      }
    }

    logger.info('Facebook', `Scraped ${posts.length} posts`);
    return posts;
    
  } catch (error) {
    logger.error('Facebook', 'Failed to scrape posts', error);
    return posts;
  }
}

/**
 * Post a comment on a Facebook post
 */
export async function postComment(
  page: Page,
  postUrl: string,
  comment: string
): Promise<boolean> {
  try {
    logger.info('Facebook', `Commenting on: ${postUrl.substring(0, 60)}...`);
    
    // Navigate to post
    await page.goto(postUrl, { waitUntil: 'networkidle', timeout: 60000 });
    await randomDelay(2000, 4000);

    // Find comment box - try multiple selectors
    const commentSelectors = [
      '[aria-label*="Write a comment"]',
      '[aria-label*="Scrivi un commento"]',
      '[aria-label*="comment"]',
      '[placeholder*="Write a comment"]',
      '[contenteditable="true"][role="textbox"]',
    ];

    let commentBox = null;
    for (const selector of commentSelectors) {
      commentBox = await page.$(selector);
      if (commentBox) break;
    }
    
    if (!commentBox) {
      logger.warn('Facebook', 'Comment box not found');
      return false;
    }

    // Click comment box
    await commentBox.click();
    await randomDelay(500, 1000);

    // Type comment slowly (human-like)
    for (const char of comment) {
      await page.keyboard.type(char);
      await randomDelay(config.delays.typingSpeed.min, config.delays.typingSpeed.max);
    }

    await randomDelay(1000, 2000);

    // Submit comment (Enter or click button)
    await page.keyboard.press('Enter');
    
    await randomDelay(3000, 5000);
    
    logger.info('Facebook', '✅ Comment posted successfully');
    return true;
    
  } catch (error) {
    logger.error('Facebook', 'Failed to post comment', error);
    return false;
  }
}

/**
 * Send a friend request to a user
 */
export async function sendFriendRequest(
  page: Page,
  profileUrl: string
): Promise<boolean> {
  try {
    logger.info('Facebook', `Sending friend request to: ${profileUrl.substring(0, 50)}...`);
    
    // Navigate to profile
    await page.goto(profileUrl, { waitUntil: 'networkidle', timeout: 60000 });
    await randomDelay(2000, 4000);

    // Find "Add Friend" button - try multiple selectors
    const addFriendSelectors = [
      '[aria-label*="Add friend"]',
      '[aria-label*="Aggiungi agli amici"]',
      '[aria-label*="Add Friend"]',
      'div[role="button"]:has-text("Add friend")',
      'div[role="button"]:has-text("Add Friend")',
    ];

    let addButton = null;
    for (const selector of addFriendSelectors) {
      try {
        addButton = await page.$(selector);
        if (addButton) break;
      } catch {
        // Selector might not be valid
      }
    }

    if (!addButton) {
      // Check if already friends or request pending
      const alreadyFriends = await page.$('[aria-label*="Friends"]');
      const requestPending = await page.$('[aria-label*="Cancel request"], [aria-label*="Pending"]');
      
      if (alreadyFriends) {
        logger.info('Facebook', 'Already friends with this user');
        return true;
      }
      if (requestPending) {
        logger.info('Facebook', 'Friend request already pending');
        return true;
      }
      
      logger.warn('Facebook', 'Add Friend button not found');
      return false;
    }

    // Click the button with human-like behavior
    await humanClick(page, addFriendSelectors.find(s => page.$(s)) || addFriendSelectors[0]);
    
    await randomDelay(2000, 4000);
    
    logger.info('Facebook', '✅ Friend request sent');
    return true;
    
  } catch (error) {
    logger.error('Facebook', 'Failed to send friend request', error);
    return false;
  }
}

/**
 * Send a direct message to a user
 */
export async function sendDirectMessage(
  page: Page,
  profileUrl: string,
  message: string
): Promise<boolean> {
  try {
    logger.info('Facebook', `Sending DM to: ${profileUrl.substring(0, 50)}...`);
    
    // Navigate to profile
    await page.goto(profileUrl, { waitUntil: 'networkidle', timeout: 60000 });
    await randomDelay(2000, 4000);

    // Find message button
    const messageSelectors = [
      '[aria-label*="Message"]',
      '[aria-label*="Messaggio"]',
      'div[role="button"]:has-text("Message")',
    ];

    let messageBtn = null;
    for (const selector of messageSelectors) {
      try {
        messageBtn = await page.$(selector);
        if (messageBtn) break;
      } catch {
        // Selector might not be valid
      }
    }
    
    if (!messageBtn) {
      logger.warn('Facebook', 'Message button not found');
      return false;
    }

    await messageBtn.click();
    await randomDelay(2000, 4000);

    // Wait for messenger to open and find the input
    const inputSelectors = [
      '[aria-label*="Message"]',
      '[aria-label*="Messaggio"]',
      '[role="textbox"]',
      '[contenteditable="true"]',
    ];

    let messageInput = null;
    for (const selector of inputSelectors) {
      try {
        messageInput = await page.waitForSelector(selector, { timeout: 5000 });
        if (messageInput) break;
      } catch {
        // Try next selector
      }
    }

    if (!messageInput) {
      logger.warn('Facebook', 'Message input not found');
      return false;
    }

    // Type message slowly
    await messageInput.click();
    await randomDelay(500, 1000);

    for (const char of message) {
      await page.keyboard.type(char);
      await randomDelay(config.delays.typingSpeed.min, config.delays.typingSpeed.max);
    }

    await randomDelay(1000, 2000);

    // Send message
    await page.keyboard.press('Enter');
    
    await randomDelay(3000, 5000);
    
    logger.info('Facebook', '✅ DM sent successfully');
    return true;
    
  } catch (error) {
    logger.error('Facebook', 'Failed to send DM', error);
    return false;
  }
}
