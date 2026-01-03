import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { prisma } from '@/lib/db';

const WORKER_DIR = path.join(process.cwd(), 'worker');
const PROFILES_DIR = path.join(WORKER_DIR, 'profiles');

// Track running login processes
const runningLogins = new Map<string, boolean>();

// POST - Trigger login for a specific account
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }

    // Check if already running
    if (runningLogins.get(accountId)) {
      return NextResponse.json({ 
        success: true,
        message: 'Login already in progress. Check the browser window.',
        alreadyRunning: true,
        accountId,
      });
    }

    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    if (!account.email || !account.password) {
      return NextResponse.json({ 
        error: 'Account not configured. Please add email and password first.' 
      }, { status: 400 });
    }

    // Ensure profile directory exists
    if (!fs.existsSync(PROFILES_DIR)) {
      fs.mkdirSync(PROFILES_DIR, { recursive: true });
    }

    // Mark as running
    runningLogins.set(accountId, true);

    // Create a temporary login script in worker root
    const scriptPath = path.join(WORKER_DIR, `_login_${accountId}.mjs`);
    const scriptContent = generateLoginScript({
      id: account.id,
      email: account.email,
      password: account.password!,
      name: account.name,
    });
    fs.writeFileSync(scriptPath, scriptContent, 'utf-8');

    // Run the script with node directly
    const child = spawn('node', [scriptPath], {
      cwd: WORKER_DIR,
      stdio: 'inherit',  // Show logs in terminal
      detached: false,
      windowsHide: true,
      shell: false,
    });

    // Clean up when process exits
    child.on('exit', () => {
      runningLogins.delete(accountId);
      try {
        if (fs.existsSync(scriptPath)) {
          fs.unlinkSync(scriptPath);
        }
      } catch { /* ignore */ }
    });

    // Fallback timeout cleanup
    setTimeout(() => {
      runningLogins.delete(accountId);
    }, 5 * 60 * 1000); // 5 minutes

    return NextResponse.json({ 
      success: true,
      message: 'Browser opened. Please complete the login manually if needed.',
      accountId,
    });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Failed to start login process' }, { status: 500 });
  }
}

function generateLoginScript(account: { id: string; email: string; password: string; name: string | null }) {
  return `
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Script is at worker/_login_*.mjs, so __dirname = worker/
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILES_DIR = path.join(__dirname, 'profiles');

const account = ${JSON.stringify(account)};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function humanType(page, selector, text) {
  await page.click(selector);
  await sleep(200 + Math.random() * 200);
  for (const char of text) {
    await page.keyboard.type(char, { delay: 50 + Math.random() * 100 });
  }
}

async function saveSession(context) {
  // Get session data (cookies, localStorage, etc.)
  const sessionData = await context.storageState();
  console.log('✅ Session captured');
  
  // Save session to database via API (no file storage)
  try {
    const response = await fetch('http://localhost:3000/api/accounts/login/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        accountId: account.id, 
        success: true,
        sessionData: sessionData,
      }),
    });
    
    if (response.ok) {
      console.log('✅ Session saved to database');
    } else {
      const text = await response.text();
      console.log('⚠️  Failed to save session:', response.status, text);
    }
  } catch (err) {
    console.log('⚠️  Could not save session:', err.message);
  }
}

async function checkLoggedIn(page) {
  return await page.evaluate(() => {
    return document.querySelector('[aria-label="Your profile"]') !== null ||
           document.querySelector('[aria-label="Account"]') !== null ||
           document.querySelector('[aria-label="Menu"]') !== null ||
           document.querySelector('svg[aria-label="Your profile"]') !== null ||
           (document.querySelector('div[role="banner"]') !== null && 
            !document.querySelector('input[name="email"]'));
  });
}

async function showNotification(page, message, type = 'success') {
  const color = type === 'success' ? '#22c55e' : '#f59e0b';
  await page.evaluate(([msg, col]) => {
    const div = document.createElement('div');
    div.innerHTML = msg;
    div.style.cssText = \`
      position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
      background: \${col}; color: white; padding: 16px 32px; border-radius: 12px;
      font-size: 18px; font-weight: bold; z-index: 999999; box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    \`;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 5000);
  }, [message, color]);
}

async function main() {
  console.log('\\n🔐 Opening browser for:', account.name || account.email);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const profilePath = path.join(PROFILES_DIR, account.id);
  
  // Ensure profile directory exists
  if (!fs.existsSync(profilePath)) {
    fs.mkdirSync(profilePath, { recursive: true });
  }
  
  const context = await chromium.launchPersistentContext(profilePath, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  const page = context.pages()[0] || await context.newPage();
  
  // Anti-detection
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  // Navigate to Facebook
  await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded' });
  await sleep(2000);

  // Check if already logged in
  const isLoggedIn = await checkLoggedIn(page);

  if (isLoggedIn) {
    console.log('✅ Already logged in!');
    await saveSession(context);
    await showNotification(page, '✅ Already logged in! Session saved. Closing in 3s...');
    await sleep(3000);
    await context.close();
    console.log('\\n👋 Done! Browser closed.');
    process.exit(0);
  }
  
  console.log('🔑 Not logged in. Attempting auto-login...');
  
  try {
    // Fill email
    const emailInput = await page.$('input[name="email"]');
    if (emailInput) {
      await humanType(page, 'input[name="email"]', account.email);
      await sleep(500);
      
      // Fill password
      await humanType(page, 'input[name="pass"]', account.password);
      await sleep(500);
      
      // Click login button
      await page.click('button[name="login"]');
      console.log('📨 Submitted login form...');
      
      await sleep(5000);
    }
  } catch (err) {
    console.log('⚠️  Auto-fill failed, please login manually.');
  }

  // Poll for successful login (handles 2FA)
  console.log('\\n⏳ Waiting for login to complete...');
  console.log('   Complete 2FA if prompted, then wait for auto-close.');
  
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes max wait
  
  while (attempts < maxAttempts) {
    await sleep(5000);
    attempts++;
    
    try {
      const loggedIn = await checkLoggedIn(page);
      const url = page.url();
      
      if (loggedIn && !url.includes('checkpoint') && !url.includes('login')) {
        console.log('\\n✅ Login successful!');
        await saveSession(context);
        await showNotification(page, '✅ Login successful! Session saved. Closing in 3s...');
        await sleep(3000);
        await context.close();
        console.log('👋 Done! Browser closed.');
        process.exit(0);
      }
    } catch {
      // Page might have navigated, continue polling
    }
  }
  
  // Timeout - save whatever state we have
  console.log('\\n⚠️  Timeout waiting for login. Saving current state...');
  try {
    await saveSession(context);
  } catch {}
  await context.close();
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
`;
}
