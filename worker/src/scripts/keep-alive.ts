/**
 * Keep browsers open and sessions alive
 * Opens all accounts with existing sessions and keeps them running
 * 
 * Usage: npm run keep-alive
 * 
 * This is useful for:
 * - Keeping sessions warm (prevents logout)
 * - Manually checking/verifying accounts
 * - Re-authenticating if needed
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSIONS_DIR = path.join(__dirname, '..', '..', 'sessions');

interface AccountConfig {
  id: string;
  email: string;
  name: string;
}

interface OpenSession {
  account: AccountConfig;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  isLoggedIn: boolean;
}

function parseAccounts(): AccountConfig[] {
  try {
    const accountsJson = process.env.ACCOUNTS_CONFIG || '[]';
    return JSON.parse(accountsJson);
  } catch {
    return [];
  }
}

function getSessionPath(accountId: string): string {
  return path.join(SESSIONS_DIR, `${accountId}.json`);
}

const openSessions: OpenSession[] = [];
let autoSaveInterval: NodeJS.Timeout | null = null;

async function checkLoginStatus(page: Page): Promise<boolean> {
  try {
    // Check for login form (means NOT logged in)
    const loginForm = await page.$('form[action*="login"]');
    if (loginForm) return false;

    // Check for navigation (means logged in)
    const nav = await page.$('[role="navigation"]');
    return !!nav;
  } catch {
    return false;
  }
}

async function saveAllSessions(): Promise<void> {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`\n[${timestamp}] 💾 Saving sessions...`);
  
  for (const session of openSessions) {
    try {
      const sessionPath = getSessionPath(session.account.id);
      await session.context.storageState({ path: sessionPath });
      
      // Check login status
      const isLoggedIn = await checkLoginStatus(session.page);
      session.isLoggedIn = isLoggedIn;
      
      const status = isLoggedIn ? '✅' : '⚠️ ';
      console.log(`   ${status} ${session.account.name}`);
    } catch {
      console.log(`   ❌ ${session.account.name}: Browser closed`);
    }
  }
}

async function cleanup(): Promise<void> {
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
  }
  
  console.log('\n💾 Final save...');
  await saveAllSessions();
  
  console.log('\n🔒 Closing browsers...');
  for (const session of openSessions) {
    try {
      await session.browser.close();
    } catch {
      // Already closed
    }
  }
}

async function main() {
  const accounts = parseAccounts();

  if (accounts.length === 0) {
    console.log('\n❌ No accounts configured!');
    process.exit(1);
  }

  // Filter to accounts with sessions
  const accountsWithSessions = accounts.filter(acc => 
    fs.existsSync(getSessionPath(acc.id))
  );

  if (accountsWithSessions.length === 0) {
    console.log('\n❌ No accounts have sessions!');
    console.log('Run: npm run login:all');
    process.exit(1);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🔄 KEEP-ALIVE MODE');
  console.log('='.repeat(60));
  console.log(`\nOpening ${accountsWithSessions.length} browsers with saved sessions...`);
  console.log('Sessions will auto-save every 60 seconds.');
  console.log('Press Ctrl+C to stop.\n');

  // Open browsers
  for (const account of accountsWithSessions) {
    const sessionPath = getSessionPath(account.id);
    
    console.log(`🌐 Opening: ${account.name}...`);

    try {
      const browser = await chromium.launch({
        headless: false,
        slowMo: 30,
      });

      const context = await browser.newContext({
        storageState: sessionPath,
        viewport: { width: 1280, height: 800 },
        locale: 'fr-TN',
        timezoneId: 'Africa/Tunis',
      });

      const page = await context.newPage();
      await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded' });

      // Set window title
      await page.evaluate((name) => {
        document.title = `FB - ${name}`;
      }, account.name);

      const isLoggedIn = await checkLoginStatus(page);
      
      openSessions.push({ account, browser, context, page, isLoggedIn });
      
      if (isLoggedIn) {
        console.log(`   ✅ Logged in`);
      } else {
        console.log(`   ⚠️  NOT logged in - please log in manually`);
      }
    } catch (error) {
      console.log(`   ❌ Failed to open: ${error}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Status Summary:');
  for (const session of openSessions) {
    const status = session.isLoggedIn ? '✅ Logged in' : '⚠️  Need login';
    console.log(`   ${session.account.name}: ${status}`);
  }
  console.log('='.repeat(60));

  if (openSessions.some(s => !s.isLoggedIn)) {
    console.log('\n⚠️  Some accounts need login. Please log in manually.');
  }

  console.log('\n🔄 Running... Sessions auto-save every 60 seconds.');
  console.log('   Press Ctrl+C to stop.\n');

  // Auto-save every 60 seconds
  autoSaveInterval = setInterval(saveAllSessions, 60000);

  // Keep running until Ctrl+C or all browsers close
  const browserClosePromises = openSessions.map(s => 
    new Promise<void>(resolve => {
      s.browser.on('disconnected', () => {
        console.log(`\n🔒 Browser closed: ${s.account.name}`);
        resolve();
      });
    })
  );

  await Promise.all(browserClosePromises);
  
  await cleanup();
  console.log('\n✨ All browsers closed. Goodbye!\n');
  process.exit(0);
}

// Handle Ctrl+C
process.on('SIGINT', async () => {
  console.log('\n\n⚠️  Stopping...');
  await cleanup();
  console.log('\n✨ Goodbye!\n');
  process.exit(0);
});

main().catch(async (error) => {
  console.error('Error:', error);
  await cleanup();
  process.exit(1);
});
