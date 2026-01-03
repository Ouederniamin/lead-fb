import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { chromium, BrowserContext } from "playwright";
import * as path from "path";
import * as fs from "fs";
import { prisma } from "@/lib/db";

// ============================================
// CONVERSATION PIN TEST
// Test PIN entry for E2EE encrypted messages
// ============================================

const STEALTH_SCRIPT = `
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
Object.defineProperty(navigator, 'languages', { get: () => ['it-IT', 'it', 'en-US', 'en'] });
window.chrome = { runtime: {} };
`;

async function humanDelay(min: number, max: number): Promise<void> {
  const delay = min + Math.random() * (max - min);
  await new Promise(resolve => setTimeout(resolve, delay));
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let browser: BrowserContext | null = null;
  const result = {
    success: false,
    pinEntered: false,
    pinCorrect: false,
    hasPin: false,
    logs: [] as string[],
    errors: [] as string[],
  };

  const log = (msg: string) => {
    console.log(`[PinTest] ${msg}`);
    result.logs.push(msg);
  };

  try {
    const body = await request.json();
    const { accountId, action = "test", newPin } = body;

    if (!accountId) {
      return NextResponse.json({ error: "accountId is required" }, { status: 400 });
    }

    // Get account from database
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // ACTION: SAVE PIN
    if (action === "save") {
      if (!newPin || newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
        return NextResponse.json({ error: "PIN must be exactly 6 digits" }, { status: 400 });
      }

      await prisma.account.update({
        where: { id: accountId },
        data: { conversationPin: newPin },
      });

      log(`✅ PIN saved for account ${account.name || account.email}`);
      result.success = true;
      return NextResponse.json(result);
    }

    // ACTION: GET PIN STATUS
    if (action === "status") {
      result.hasPin = !!account.conversationPin;
      result.success = true;
      log(`PIN status: ${result.hasPin ? "configured" : "not configured"}`);
      return NextResponse.json(result);
    }

    // ACTION: TEST PIN
    log(`🔐 Testing PIN for account: ${account.name || account.email}`);

    if (!account.conversationPin) {
      log("⚠️ No PIN configured for this account");
      result.hasPin = false;
      return NextResponse.json(result);
    }

    result.hasPin = true;

    // Check profile exists
    const profilePath = path.join(process.cwd(), "worker", "profiles", accountId);
    if (!fs.existsSync(profilePath)) {
      return NextResponse.json({ error: "No saved session for account" }, { status: 400 });
    }

    // Launch browser
    browser = await chromium.launchPersistentContext(profilePath, {
      headless: false,
      viewport: { width: 1366, height: 768 },
      locale: "it-IT",
      timezoneId: "Europe/Rome",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      args: ["--disable-blink-features=AutomationControlled", "--disable-dev-shm-usage", "--disable-notifications"],
      ignoreDefaultArgs: ["--enable-automation"],
      permissions: [],
    });

    const pages = browser.pages();
    const page = pages.length > 0 ? pages[0] : await browser.newPage();
    await page.addInitScript(STEALTH_SCRIPT);

    // Prevent any automatic dialog dismissal
    page.on('dialog', async (dialog) => {
      log(`   ⚠️ Browser dialog appeared: ${dialog.type()} - ${dialog.message()}`);
      // Don't auto-dismiss - let it stay
    });

    // Navigate to Messenger
    log("📬 Navigating to Messenger...");
    await page.goto("https://www.facebook.com/messages/t/", { waitUntil: "domcontentloaded" });
    await humanDelay(2000, 3000);

    // First check if PIN dialog already appeared (from previous session)
    let pinInput = await page.$('[role="dialog"] input[aria-label="PIN"][autocomplete="one-time-code"][maxlength="6"]');
    
    if (!pinInput) {
      // No PIN dialog yet - click on any E2EE conversation to trigger it
      log("🔍 Looking for E2EE conversation to trigger PIN dialog...");
      const e2eeLink = await page.$('a[href*="/messages/e2ee/t/"]');
      
      if (e2eeLink) {
        await e2eeLink.click({ force: true });
        log("   Clicked E2EE conversation");
        await humanDelay(2000, 3000);
      } else {
        log("   No E2EE conversations found, trying first conversation...");
        const anyConv = await page.$('a[href*="/messages/t/"]');
        if (anyConv) {
          await anyConv.click({ force: true });
          await humanDelay(2000, 3000);
        }
      }

      // Check for PIN dialog again
      await humanDelay(1500, 2000);
      pinInput = await page.$('[role="dialog"] input[aria-label="PIN"][autocomplete="one-time-code"][maxlength="6"]');
    } else {
      log("🔐 PIN dialog already open from previous session");
    }
    
    if (pinInput) {
      log("🔐 PIN dialog detected! Entering PIN...");
      result.pinEntered = true;

      // Focus the input directly using JavaScript to bypass any overlay
      await pinInput.evaluate((el: HTMLInputElement) => el.focus());
      await humanDelay(200, 300);
      
      // Clear any existing value and type the PIN
      await pinInput.evaluate((el: HTMLInputElement) => el.value = '');
      await pinInput.type(account.conversationPin!, { delay: 80 });
      await humanDelay(500, 800);

      log("   PIN entered, waiting for validation...");
      await humanDelay(3000, 4000);

      // Check if dialog closed (PIN correct) or still visible (wrong PIN)
      const stillVisible = await page.$('[role="dialog"] input[aria-label="PIN"][autocomplete="one-time-code"][maxlength="6"]');
      const errorText = await page.$('text=Incorrect PIN');

      if (errorText) {
        log("❌ Incorrect PIN!");
        result.pinCorrect = false;
      } else if (!stillVisible) {
        log("✅ Dialog closed! Reloading to verify PIN is saved...");
        
        // Reload the page to verify PIN was accepted
        await page.reload({ waitUntil: "domcontentloaded" });
        await humanDelay(2000, 3000);
        
        // Click on E2EE conversation again
        const e2eeLink2 = await page.$('a[href*="/messages/e2ee/t/"]');
        if (e2eeLink2) {
          await e2eeLink2.click({ force: true });
          await humanDelay(2000, 3000);
        }
        
        // Check if PIN dialog appears again
        const pinDialogAfterReload = await page.$('[role="dialog"] input[aria-label="PIN"][autocomplete="one-time-code"][maxlength="6"]');
        
        if (!pinDialogAfterReload) {
          log("✅ PIN verified! No dialog after reload - PIN is saved.");
          result.pinCorrect = true;
          result.success = true;
        } else {
          log("⚠️ PIN dialog appeared again after reload - PIN may not be saved");
          result.pinCorrect = false;
        }
      } else {
        // Dialog still visible but no error - might be processing
        log("⚠️ PIN status unclear - dialog still visible");
        result.pinCorrect = false;
      }
    } else {
      log("ℹ️ No PIN dialog appeared - messages may not be encrypted or PIN already entered");
      result.success = true;
      result.pinCorrect = true; // Assume OK if no dialog
    }

    log("🔓 Browser will stay open - close it manually when done");

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log(`❌ Error: ${errorMsg}`);
    result.errors.push(errorMsg);
  }
  // Don't close browser - let user inspect manually

  return NextResponse.json(result);
}
