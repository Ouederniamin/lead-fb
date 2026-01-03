// Procedure P1 & P2: Browser Launch and Stealth Injection

import { chromium, BrowserContext, Page } from "playwright";
import path from "path";
import fs from "fs";
import { BrowserConfig, BrowserSession } from "../types";

// ============================================
// P2: STEALTH SCRIPT
// ============================================
export const STEALTH_SCRIPT = `
// Hide webdriver property
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

// Set realistic languages
Object.defineProperty(navigator, 'languages', { get: () => ['it-IT', 'it', 'en-US', 'en'] });

// Add realistic plugins
Object.defineProperty(navigator, 'plugins', {
  get: () => {
    const plugins = [
      { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
      { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
      { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
    ];
    plugins.length = 3;
    return plugins;
  }
});

// Add chrome runtime
window.chrome = { runtime: {} };

// Override permissions query
const originalQuery = window.navigator.permissions.query;
window.navigator.permissions.query = (parameters) => (
  parameters.name === 'notifications' ?
    Promise.resolve({ state: Notification.permission }) :
    originalQuery(parameters)
);

// WebGL vendor spoofing
const getParameterProxyHandler = {
  apply: function(target, thisArg, argumentsList) {
    const param = argumentsList[0];
    if (param === 37445) return 'Intel Inc.';
    if (param === 37446) return 'Intel Iris OpenGL Engine';
    return Reflect.apply(target, thisArg, argumentsList);
  }
};

try {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (gl) {
    const getParameter = gl.getParameter.bind(gl);
    gl.getParameter = new Proxy(getParameter, getParameterProxyHandler);
  }
} catch (e) {}

// Prevent toString detection
const originalToString = Function.prototype.toString;
Function.prototype.toString = function() {
  if (this === navigator.permissions.query) {
    return 'function query() { [native code] }';
  }
  return originalToString.call(this);
};
`;

// ============================================
// P1: BROWSER LAUNCH
// ============================================
export async function launchBrowser(config: BrowserConfig): Promise<BrowserSession> {
  const { accountId, headless = false } = config;
  
  // Determine profile path
  const profilePath = config.profilePath || 
    path.join(process.cwd(), "worker", "profiles", accountId);
  
  // Check if profile exists
  if (!fs.existsSync(profilePath)) {
    throw new Error(`Profile not found for account ${accountId}. Please log in first.`);
  }

  // Launch browser with persistent context
  const context = await chromium.launchPersistentContext(profilePath, {
    headless,
    viewport: { width: 1366, height: 768 },
    locale: "it-IT",
    timezoneId: "Europe/Rome",
    geolocation: { latitude: 41.9028, longitude: 12.4964 },
    permissions: ["geolocation", "clipboard-read", "clipboard-write"],
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process",
      "--disable-site-isolation-trials",
      "--disable-web-security",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
      "--window-size=1366,768",
      "--start-maximized",
    ],
    ignoreDefaultArgs: ["--enable-automation"],
    bypassCSP: true,
  });

  // Get or create page
  const pages = context.pages();
  const page = pages.length > 0 ? pages[0] : await context.newPage();

  // Inject stealth script (P2)
  await page.addInitScript(STEALTH_SCRIPT);
  
  // Additional anti-detection
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    delete (window as unknown as Record<string, unknown>).__playwright;
    delete (window as unknown as Record<string, unknown>).__puppeteer;
  });

  return {
    context,
    page,
    accountId,
  };
}

// ============================================
// SESSION WARMUP
// ============================================
export async function warmupSession(page: Page, log: (msg: string) => void): Promise<boolean> {
  log("🔥 Warming up session...");
  
  try {
    // Visit Facebook homepage
    await page.goto("https://www.facebook.com", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Human-like wait
    await page.waitForTimeout(2000 + Math.random() * 2000);

    // Check if logged in
    const loginForm = await page.$('input[name="email"], form[action*="login"]');
    if (loginForm) {
      log("❌ Not logged in - login form detected");
      return false;
    }

    // Scroll a bit like a human
    await page.evaluate(() => window.scrollBy(0, 200 + Math.random() * 200));
    await page.waitForTimeout(1000 + Math.random() * 1000);

    log("✅ Session warmed up - logged in");
    return true;
  } catch (error) {
    log(`❌ Warmup failed: ${error}`);
    return false;
  }
}

// ============================================
// CLOSE BROWSER
// ============================================
export async function closeBrowser(session: BrowserSession): Promise<void> {
  try {
    await session.context.close();
  } catch (error) {
    console.error("Error closing browser:", error);
  }
}
