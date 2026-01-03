/**
 * Session management for Facebook accounts
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import config, { AccountConfig } from '../config.js';
import { getRandomUserAgent } from '../utils/random.js';
import logger from '../utils/logger.js';

export interface Session {
  account: AccountConfig;
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

/**
 * Get session file path for an account
 */
export function getSessionPath(accountId: string): string {
  return path.join(config.sessionsDir, `${accountId}.json`);
}

/**
 * Check if session exists for account
 */
export function sessionExists(accountId: string): boolean {
  return fs.existsSync(getSessionPath(accountId));
}

/**
 * Create browser context with session
 */
export async function createSession(account: AccountConfig): Promise<Session> {
  const sessionPath = getSessionPath(account.id);
  const hasSession = fs.existsSync(sessionPath);

  logger.info('Session', `Creating session for ${account.name}`, { hasSession });

  // Ensure sessions directory exists
  if (!fs.existsSync(config.sessionsDir)) {
    fs.mkdirSync(config.sessionsDir, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: config.headless,
    slowMo: config.slowMo,
  });

  const contextOptions: Parameters<Browser['newContext']>[0] = {
    userAgent: getRandomUserAgent(),
    viewport: { width: 1920, height: 1080 },
    locale: 'fr-TN', // French Tunisia locale
    timezoneId: config.timezone,
    geolocation: { latitude: 36.8065, longitude: 10.1815 }, // Tunis
    permissions: ['geolocation'],
  };

  // Load existing session if available
  if (hasSession) {
    contextOptions.storageState = sessionPath;
    logger.info('Session', `Loaded existing session for ${account.name}`);
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  return { account, browser, context, page };
}

/**
 * Save session state
 */
export async function saveSession(session: Session): Promise<void> {
  const sessionPath = getSessionPath(session.account.id);
  await session.context.storageState({ path: sessionPath });
  logger.info('Session', `Saved session for ${session.account.name}`);
}

/**
 * Close session
 */
export async function closeSession(session: Session): Promise<void> {
  await saveSession(session);
  await session.browser.close();
  logger.info('Session', `Closed session for ${session.account.name}`);
}

/**
 * Check if logged in to Facebook
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle', timeout: 30000 });
    
    // Check for login form (means not logged in)
    const loginForm = await page.$('form[action*="login"]');
    if (loginForm) return false;

    // Check for main navigation (means logged in)
    const nav = await page.$('[role="navigation"]');
    return !!nav;
  } catch {
    return false;
  }
}

/**
 * Get all configured accounts
 */
export function getAccounts(): AccountConfig[] {
  return config.accounts;
}

/**
 * Get accounts with valid sessions
 */
export function getAccountsWithSessions(): AccountConfig[] {
  return config.accounts.filter(acc => sessionExists(acc.id));
}
