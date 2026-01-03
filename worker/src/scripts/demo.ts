/**
 * Interactive Demo - Single Account Testing
 * 
 * This script shows you the full workflow:
 * 1. Scraping posts from a group
 * 2. AI analyzing each post
 * 3. Commenting on high-intent posts
 * 4. Sending friend request (if not anonymous)
 * 5. Sending DM with your pitch
 * 
 * Usage: npm run demo
 */

import { chromium, Browser, BrowserContext } from 'playwright';
import type { Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSIONS_DIR = path.join(__dirname, '..', '..', 'sessions');
const PROFILES_DIR = path.join(__dirname, '..', '..', 'profiles');
const ACCOUNTS_FILE = path.join(__dirname, '..', '..', '..', 'data', 'accounts.json');

interface AccountData {
  id: string;
  name: string;
  email: string;
  password: string;
  status: string;
}

function loadAccountsFromFile(): AccountData[] {
  try {
    if (fs.existsSync(ACCOUNTS_FILE)) {
      const content = fs.readFileSync(ACCOUNTS_FILE, 'utf-8');
      const data = JSON.parse(content);
      return data.accounts || [];
    }
  } catch (error) {
    console.error('Failed to load accounts file:', error);
  }
  return [];
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(question, answer => resolve(answer.trim()));
  });
}

function getSessionPath(accountId: string): string {
  return path.join(SESSIONS_DIR, `${accountId}.json`);
}

function getProfilePath(accountId: string): string {
  return path.join(PROFILES_DIR, accountId);
}

function hasValidSession(accountId: string): boolean {
  // Check for persistent profile first
  const profilePath = getProfilePath(accountId);
  if (fs.existsSync(profilePath)) {
    return true;
  }
  // Fall back to session file
  const sessionPath = getSessionPath(accountId);
  return fs.existsSync(sessionPath);
}

function printHeader(text: string): void {
  console.log('\n' + '='.repeat(60));
  console.log('  ' + text);
  console.log('='.repeat(60));
}

function printPost(index: number, total: number, post: ScrapedPost): void {
  console.log('\n┌' + '─'.repeat(58) + '┐');
  console.log(`│ POST ${index}/${total}`.padEnd(59) + '│');
  console.log('├' + '─'.repeat(58) + '┤');
  console.log(`│ Author: ${post.authorName.substring(0, 45)}`.padEnd(59) + '│');
  console.log(`│ Anonymous: ${post.isAnonymous ? 'YES' : 'NO'}`.padEnd(59) + '│');
  console.log('├' + '─'.repeat(58) + '┤');
  
  // Split text into lines
  const text = post.postText.substring(0, 200);
  const words = text.split(' ');
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).length > 54) {
      console.log(`│ ${line}`.padEnd(59) + '│');
      line = word;
    } else {
      line = line ? line + ' ' + word : word;
    }
  }
  if (line) {
    console.log(`│ ${line}`.padEnd(59) + '│');
  }
  if (post.postText.length > 200) {
    console.log(`│ ...`.padEnd(59) + '│');
  }
  console.log('└' + '─'.repeat(58) + '┘');
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  await sleep(delay);
}

// ============== FACEBOOK FUNCTIONS ==============

interface ScrapedPost {
  postText: string;
  authorName: string;
  authorProfileUrl: string | null;
  postUrl: string;
  isAnonymous: boolean;
}

async function navigateToGroup(page: Page, groupUrl: string): Promise<boolean> {
  try {
    console.log('   Navigating to group...');
    await page.goto(groupUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(3000);
    
    // Scroll a bit to load content
    await page.evaluate(() => window.scrollBy(0, 500));
    await sleep(2000);
    
    return true;
  } catch (error) {
    console.error('   Failed to navigate:', error);
    return false;
  }
}

async function scrapePosts(page: Page, limit: number = 5): Promise<ScrapedPost[]> {
  const posts: ScrapedPost[] = [];
  
  // Scroll to load posts
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollBy(0, 800));
    await sleep(1500);
  }

  // Find all post containers
  const postElements = await page.$$('[role="article"]');
  console.log(`   Found ${postElements.length} article elements`);

  for (const element of postElements.slice(0, limit + 5)) {
    try {
      // Get post text
      const textElement = await element.$('[data-ad-preview="message"], [data-ad-comet-preview="message"]');
      let postText = '';
      if (textElement) {
        postText = await textElement.innerText();
      } else {
        // Fallback: get all text from the post
        const allText = await element.innerText();
        postText = allText.split('\n').slice(0, 5).join(' ');
      }

      if (!postText || postText.length < 20) continue;

      // Get author info
      const authorLink = await element.$('a[role="link"] strong, h3 a, h4 a');
      let authorName = 'Unknown';
      let authorProfileUrl: string | null = null;

      if (authorLink) {
        authorName = await authorLink.innerText();
        const parentLink = await authorLink.$('xpath=ancestor::a[@href]');
        if (parentLink) {
          authorProfileUrl = await parentLink.getAttribute('href');
        } else {
          // Try direct href
          const href = await authorLink.getAttribute('href');
          if (href && href.includes('facebook.com')) {
            authorProfileUrl = href;
          }
        }
      }

      // Check if anonymous
      const isAnonymous = !authorProfileUrl || 
                          authorName.toLowerCase().includes('anonymous') ||
                          authorName.toLowerCase().includes('member');

      // Get post URL (any permalink)
      let postUrl = page.url();
      const permalinks = await element.$$('a[href*="/posts/"], a[href*="/permalink/"]');
      if (permalinks.length > 0) {
        const href = await permalinks[0].getAttribute('href');
        if (href) {
          postUrl = href.startsWith('http') ? href : 'https://www.facebook.com' + href;
        }
      }

      posts.push({
        postText: postText.trim(),
        authorName,
        authorProfileUrl,
        postUrl,
        isAnonymous,
      });

      if (posts.length >= limit) break;
    } catch {
      // Skip problematic posts
      continue;
    }
  }

  return posts;
}

async function postComment(page: Page, postUrl: string, comment: string): Promise<boolean> {
  try {
    console.log('   Opening post...');
    await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(3000);

    // Find comment box
    const commentSelectors = [
      '[aria-label*="Write a comment"]',
      '[aria-label*="Scrivi un commento"]',
      '[aria-label*="comment"]',
      '[contenteditable="true"][role="textbox"]',
      'div[role="textbox"]',
    ];

    let commentBox = null;
    for (const selector of commentSelectors) {
      commentBox = await page.$(selector);
      if (commentBox) break;
    }

    if (!commentBox) {
      // Try clicking on comment area first
      const commentArea = await page.$('[aria-label*="Comment"], [data-testid="UFI2CommentComposer"]');
      if (commentArea) {
        await commentArea.click();
        await sleep(1000);
        for (const selector of commentSelectors) {
          commentBox = await page.$(selector);
          if (commentBox) break;
        }
      }
    }

    if (!commentBox) {
      console.log('   Could not find comment box');
      return false;
    }

    console.log('   Typing comment...');
    await commentBox.click();
    await sleep(500);
    
    // Type like a human
    for (const char of comment) {
      await page.keyboard.type(char, { delay: 50 + Math.random() * 100 });
    }
    
    await sleep(1000);

    // Submit
    console.log('   Submitting...');
    await page.keyboard.press('Enter');
    await sleep(2000);

    return true;
  } catch (error) {
    console.error('   Comment error:', error);
    return false;
  }
}

async function sendFriendRequest(page: Page, profileUrl: string): Promise<boolean> {
  try {
    console.log('   Opening profile...');
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(3000);

    // Look for Add Friend button
    const addFriendSelectors = [
      '[aria-label*="Add friend"]',
      '[aria-label*="Aggiungi"]',
      'div[aria-label*="Friend"] >> text=Add',
      'text=Add Friend',
      'text=Add friend',
    ];

    let addButton = null;
    for (const selector of addFriendSelectors) {
      try {
        addButton = await page.$(selector);
        if (addButton) break;
      } catch { /* continue */ }
    }

    if (!addButton) {
      // Check if already friends or pending
      const pendingText = await page.$('text=Pending');
      const friendsText = await page.$('text=Friends');
      
      if (pendingText) {
        console.log('   Friend request already pending');
        return true;
      }
      if (friendsText) {
        console.log('   Already friends');
        return true;
      }
      
      console.log('   Could not find Add Friend button');
      return false;
    }

    console.log('   Clicking Add Friend...');
    await addButton.click();
    await sleep(2000);

    return true;
  } catch (error) {
    console.error('   Friend request error:', error);
    return false;
  }
}

async function sendDirectMessage(page: Page, profileUrl: string, message: string): Promise<boolean> {
  try {
    console.log('   Opening profile for DM...');
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(3000);

    // Find Message button
    const messageSelectors = [
      '[aria-label*="Message"]',
      '[aria-label*="Messaggio"]',
      'text=Message',
      'text=Messaggio',
    ];

    let messageButton = null;
    for (const selector of messageSelectors) {
      try {
        messageButton = await page.$(selector);
        if (messageButton) break;
      } catch { /* continue */ }
    }

    if (!messageButton) {
      console.log('   Could not find Message button');
      return false;
    }

    console.log('   Opening message dialog...');
    await messageButton.click();
    await sleep(3000);

    // Find message input
    const inputSelectors = [
      '[aria-label*="Message"]',
      '[aria-label*="Aa"]',
      'div[role="textbox"][contenteditable="true"]',
      '[data-testid="message-input"]',
    ];

    let messageInput = null;
    for (const selector of inputSelectors) {
      messageInput = await page.$(selector);
      if (messageInput) break;
    }

    if (!messageInput) {
      console.log('   Could not find message input');
      return false;
    }

    console.log('   Typing message...');
    await messageInput.click();
    await sleep(500);

    // Type message
    for (const char of message) {
      await page.keyboard.type(char, { delay: 30 + Math.random() * 70 });
    }

    await sleep(1000);
    
    console.log('   Sending...');
    await page.keyboard.press('Enter');
    await sleep(2000);

    return true;
  } catch (error) {
    console.error('   DM error:', error);
    return false;
  }
}

// ============== AI ANALYSIS ==============

interface AnalysisResult {
  isLead: boolean;
  intentScore: number;
  suggestedResponse: string;
  matchedServices?: string[];
  needType?: string;
  urgency?: number;
}

async function analyzeWithAI(post: ScrapedPost, groupName: string): Promise<AnalysisResult | null> {
  const controlPlaneUrl = process.env.CONTROL_PLANE_URL || 'http://localhost:3000';
  
  try {
    const response = await fetch(`${controlPlaneUrl}/api/ai/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postText: post.postText,
        authorName: post.authorName,
        groupName,
      }),
    });
    
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch {
    return null;
  }
}

// ============== MAIN DEMO ==============

async function main() {
  printHeader('FACEBOOK LEAD SCRAPER - INTERACTIVE DEMO');
  
  console.log('\nThis demo shows the full workflow:');
  console.log('  1. Scrape posts from a Facebook group');
  console.log('  2. AI analyzes each post');
  console.log('  3. You choose: Comment / Friend Request / DM / Skip');
  console.log('  4. Watch the browser perform the action\n');

  // Load accounts from file
  const accounts = loadAccountsFromFile();
  
  // Filter accounts that have sessions
  const accountsWithSessions = accounts.filter(acc => hasValidSession(acc.id));

  if (accounts.length === 0) {
    console.log('❌ No accounts configured!');
    console.log('   Go to http://localhost:3000/dashboard/accounts to add accounts.\n');
    process.exit(1);
  }

  if (accountsWithSessions.length === 0) {
    console.log('❌ No logged-in accounts found!');
    console.log('   Go to http://localhost:3000/dashboard/accounts and click "Login" for an account.\n');
    console.log('   Available accounts:');
    accounts.forEach((acc, i) => {
      console.log(`   ${i + 1}. ${acc.name} (${acc.email || 'no email'}) - NOT LOGGED IN`);
    });
    process.exit(1);
  }

  // Select account
  console.log('📋 Available accounts with active sessions:');
  accountsWithSessions.forEach((acc, i) => {
    console.log(`   ${i + 1}. ${acc.name}`);
  });

  let selectedAccount: AccountData;
  
  if (accountsWithSessions.length === 1) {
    selectedAccount = accountsWithSessions[0];
    console.log(`\n✅ Using account: ${selectedAccount.name}`);
  } else {
    const choice = await prompt('\nSelect account number: ');
    const index = parseInt(choice) - 1;
    if (index < 0 || index >= accountsWithSessions.length) {
      console.log('❌ Invalid selection');
      process.exit(1);
    }
    selectedAccount = accountsWithSessions[index];
    console.log(`✅ Using account: ${selectedAccount.name}`);
  }

  const profilePath = getProfilePath(selectedAccount.id);
  const sessionPath = getSessionPath(selectedAccount.id);
  const useProfile = fs.existsSync(profilePath);

  // Get group URL
  console.log('\n📍 Enter a Facebook group URL:');
  console.log('   Example: https://www.facebook.com/groups/123456789');
  const groupUrl = await prompt('\nGroup URL: ');
  
  if (!groupUrl.includes('facebook.com/groups')) {
    console.log('❌ Invalid group URL');
    process.exit(1);
  }

  const groupName = await prompt('Group name (for AI): ');

  // Launch browser
  console.log(`\n🌐 Launching browser...`);
  
  let browser: Browser | BrowserContext;
  let page: Page;

  if (useProfile) {
    // Use persistent context (same as login)
    console.log('   Using persistent profile...');
    browser = await chromium.launchPersistentContext(profilePath, {
      headless: false,
      slowMo: 50,
      viewport: { width: 1280, height: 900 },
      locale: 'en-US',
      timezoneId: 'Africa/Tunis',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
      ],
      ignoreDefaultArgs: ['--enable-automation'],
    });
    page = browser.pages()[0] || await browser.newPage();
    
    // Anti-detection
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
  } else {
    // Fall back to session-based context
    console.log('   Using session file...');
    const browserInstance = await chromium.launch({
      headless: false,
      slowMo: 50,
    });

    const context = await browserInstance.newContext({
      storageState: sessionPath,
      viewport: { width: 1280, height: 900 },
      locale: 'en-US',
      timezoneId: 'Africa/Tunis',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    page = await context.newPage();
    browser = browserInstance;
  }

  try {
    // Verify login
    console.log('   Checking login status...');
    await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle', timeout: 30000 });
    
    const loginForm = await page.$('form[action*="login"]');
    if (loginForm) {
      console.log('\n❌ Session expired! Go to dashboard and re-login.');
      await browser.close();
      process.exit(1);
    }
    
    console.log('   ✅ Logged in!\n');

    await prompt('Press ENTER to navigate to group...');

    // Navigate to group
    printHeader('STEP 1: NAVIGATE TO GROUP');
    const navOk = await navigateToGroup(page, groupUrl);
    if (!navOk) {
      console.log('❌ Failed to open group');
      await browser.close();
      process.exit(1);
    }
    console.log('   ✅ On group page');

    await prompt('\nPress ENTER to scrape posts...');

    // Scrape posts
    printHeader('STEP 2: SCRAPING POSTS');
    const posts = await scrapePosts(page, 5);
    console.log(`   Found ${posts.length} posts`);

    if (posts.length === 0) {
      console.log('❌ No posts found');
      await browser.close();
      process.exit(1);
    }

    await prompt('\nPress ENTER to analyze posts...');

    // Process each post
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      
      printHeader(`STEP 3: ANALYZING POST ${i + 1}/${posts.length}`);
      printPost(i + 1, posts.length, post);

      // AI Analysis
      console.log('\n🤖 Analyzing with AI...');
      const analysis = await analyzeWithAI(post, groupName);
      
      if (analysis) {
        console.log(`   Intent Score: ${'★'.repeat(analysis.intentScore)}${'☆'.repeat(5 - analysis.intentScore)} (${analysis.intentScore}/5)`);
        console.log(`   Is Lead: ${analysis.isLead ? '✅ YES' : '❌ No'}`);
        
        // Show matched services
        if (analysis.matchedServices && analysis.matchedServices.length > 0) {
          console.log(`   🎯 Matched Services: ${analysis.matchedServices.join(', ')}`);
        }
        
        if (analysis.needType) {
          console.log(`   📋 Need: ${analysis.needType}`);
        }
        
        if (analysis.isLead && analysis.intentScore >= 3) {
          console.log('\n💬 Suggested Response:');
          console.log(`   "${analysis.suggestedResponse.substring(0, 120)}..."\n`);
          
          // Menu
          console.log('   What to do?');
          console.log('   [c] Comment on post');
          if (!post.isAnonymous) {
            console.log('   [f] Send friend request');
            console.log('   [d] Send DM');
            console.log('   [a] All (comment + friend + DM)');
          }
          console.log('   [s] Skip');
          console.log('   [q] Quit\n');
          
          const action = await prompt('   Choice: ');
          
          if (action.toLowerCase() === 'q') {
            break;
          }
          
          if (action.toLowerCase() === 's') {
            console.log('   ⏭️ Skipped');
            continue;
          }

          const doComment = ['c', 'a'].includes(action.toLowerCase());
          const doFriend = ['f', 'a'].includes(action.toLowerCase()) && !post.isAnonymous;
          const doDM = ['d', 'a'].includes(action.toLowerCase()) && !post.isAnonymous;

          // Execute
          if (doComment) {
            console.log('\n📝 POSTING COMMENT...');
            await randomDelay(1000, 2000);
            const ok = await postComment(page, post.postUrl, analysis.suggestedResponse);
            console.log(ok ? '   ✅ Comment posted!' : '   ❌ Failed');
          }

          if (doFriend && post.authorProfileUrl) {
            console.log('\n👋 SENDING FRIEND REQUEST...');
            await randomDelay(2000, 3000);
            const ok = await sendFriendRequest(page, post.authorProfileUrl);
            console.log(ok ? '   ✅ Friend request sent!' : '   ❌ Failed');
          }

          if (doDM && post.authorProfileUrl) {
            console.log('\n✉️ SENDING DM...');
            await randomDelay(2000, 3000);
            const ok = await sendDirectMessage(page, post.authorProfileUrl, analysis.suggestedResponse);
            console.log(ok ? '   ✅ DM sent!' : '   ❌ Failed');
          }
        } else {
          console.log('   ⏭️ Low intent - skipping');
        }
      } else {
        console.log('   ⚠️ AI unavailable (is control plane running?)');
        console.log('   Tip: Run "npm run dev" in the main fb-leads folder');
      }

      if (i < posts.length - 1) {
        await prompt('\nPress ENTER for next post...');
      }
    }

    printHeader('DEMO COMPLETE!');
    console.log('\n✨ You just saw the full workflow in action!');
    console.log('   When ready, run: npm start');
    console.log('   This will run automatically on schedule.\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    const close = await prompt('Close browser? (y/n): ');
    if (close.toLowerCase() === 'y') {
      await browser.close();
    } else {
      console.log('\n🌐 Browser staying open. Close manually.');
      console.log('   Press Ctrl+C to exit.\n');
      // Just wait indefinitely - user will press Ctrl+C
      await new Promise<void>(() => {});
    }
  }

  rl.close();
  process.exit(0);
}

process.on('SIGINT', () => {
  console.log('\n\n👋 Goodbye!');
  rl.close();
  process.exit(0);
});

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
