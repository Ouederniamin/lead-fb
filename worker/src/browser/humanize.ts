/**
 * Human-like behavior simulation for Playwright
 */

import { Page } from 'playwright';
import { randomBetween, randomDelay } from '../utils/random.js';
import config from '../config.js';

const { delays } = config;

/**
 * Simulate human-like scrolling
 */
export async function humanScroll(page: Page, scrollCount?: number): Promise<void> {
  const scrolls = scrollCount || randomBetween(3, 7);

  for (let i = 0; i < scrolls; i++) {
    // Random scroll distance
    const distance = randomBetween(200, 600);
    await page.mouse.wheel(0, distance);

    // Random pause between scrolls
    await randomDelay(delays.betweenScrolls.min, delays.betweenScrolls.max);

    // Sometimes scroll back up a bit (human behavior)
    if (Math.random() > 0.7) {
      const backDistance = randomBetween(50, 150);
      await page.mouse.wheel(0, -backDistance);
      await randomDelay(500, 1000);
    }

    // Sometimes pause longer (reading something)
    if (Math.random() > 0.85) {
      await randomDelay(2000, 5000);
    }
  }
}

/**
 * Simulate human-like typing
 */
export async function humanType(
  page: Page,
  selector: string,
  text: string
): Promise<void> {
  await page.click(selector);
  await randomDelay(300, 800);

  for (const char of text) {
    await page.keyboard.type(char);
    // Variable typing speed
    await randomDelay(delays.typingSpeed.min, delays.typingSpeed.max);

    // Occasional longer pause (thinking)
    if (Math.random() > 0.95) {
      await randomDelay(500, 1500);
    }
  }
}

/**
 * Move mouse naturally to element before clicking
 */
export async function humanClick(page: Page, selector: string): Promise<void> {
  const element = await page.$(selector);
  if (!element) return;

  const box = await element.boundingBox();
  if (!box) return;

  // Add some randomness to click position within element
  const x = box.x + box.width * (0.3 + Math.random() * 0.4);
  const y = box.y + box.height * (0.3 + Math.random() * 0.4);

  // Move mouse in steps
  await page.mouse.move(x, y, { steps: randomBetween(5, 15) });
  
  // Small delay before click
  await randomDelay(delays.beforeClick.min, delays.beforeClick.max);
  
  await page.mouse.click(x, y);
}

/**
 * Wait for a random time to simulate reading
 */
export async function simulateReading(textLength: number): Promise<void> {
  // Average reading speed: ~200-300 words per minute
  // Assume ~5 chars per word
  const words = textLength / 5;
  const readingTimeMs = (words / 250) * 60 * 1000;
  
  // Add some variance
  const actualTime = readingTimeMs * (0.5 + Math.random());
  
  await randomDelay(
    Math.min(actualTime, 3000),
    Math.min(actualTime * 1.5, 8000)
  );
}

/**
 * Session warmup - browse naturally before scraping
 */
export async function warmupSession(page: Page): Promise<void> {
  // Visit Facebook home
  await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle' });
  await randomDelay(delays.sessionWarmup.min, delays.sessionWarmup.max);

  // Scroll a bit on feed
  await humanScroll(page, randomBetween(2, 4));

  // Maybe check notifications
  if (Math.random() > 0.5) {
    try {
      const notifButton = await page.$('[aria-label="Notifications"]');
      if (notifButton) {
        await humanClick(page, '[aria-label="Notifications"]');
        await randomDelay(2000, 4000);
        // Close by clicking elsewhere
        await page.keyboard.press('Escape');
      }
    } catch {
      // Ignore if notifications button not found
    }
  }

  await randomDelay(2000, 5000);
}
