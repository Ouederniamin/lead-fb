// Procedure P3 & P4: Human-like Behavior

import { Page } from "playwright";

// ============================================
// P3: HUMAN DELAY
// ============================================
export async function humanDelay(min: number, max: number): Promise<void> {
  const delay = min + Math.random() * (max - min);
  await new Promise((resolve) => setTimeout(resolve, delay));
}

// Short delay (1-3 seconds)
export async function shortDelay(): Promise<void> {
  await humanDelay(1000, 3000);
}

// Medium delay (3-8 seconds)
export async function mediumDelay(): Promise<void> {
  await humanDelay(3000, 8000);
}

// Long delay (10-30 seconds)
export async function longDelay(): Promise<void> {
  await humanDelay(10000, 30000);
}

// Post-action delay (after commenting, DMing, etc.)
export async function postActionDelay(): Promise<void> {
  await humanDelay(30000, 90000); // 30-90 seconds
}

// ============================================
// P4: HUMAN-LIKE TYPING
// ============================================
export async function humanType(page: Page, text: string): Promise<void> {
  for (const char of text) {
    // Type each character with variable delay
    await page.keyboard.type(char, { delay: 30 + Math.random() * 80 });
    
    // Occasional longer pause (thinking)
    if (Math.random() > 0.9) {
      await humanDelay(200, 600);
    }
  }
}

// Type with occasional typos and corrections (more human)
export async function humanTypeWithTypos(
  page: Page,
  text: string,
  typoRate: number = 0.02
): Promise<void> {
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    // Occasionally make a typo
    if (Math.random() < typoRate && char.match(/[a-zA-Z]/)) {
      // Type wrong character
      const wrongChar = String.fromCharCode(char.charCodeAt(0) + (Math.random() > 0.5 ? 1 : -1));
      await page.keyboard.type(wrongChar, { delay: 40 + Math.random() * 60 });
      await humanDelay(100, 300);
      
      // Backspace to correct
      await page.keyboard.press("Backspace");
      await humanDelay(50, 150);
    }
    
    // Type the correct character
    await page.keyboard.type(char, { delay: 30 + Math.random() * 80 });
    
    // Occasional pause
    if (Math.random() > 0.92) {
      await humanDelay(200, 800);
    }
  }
}

// ============================================
// HUMAN-LIKE SCROLLING
// ============================================
export async function humanScroll(
  page: Page,
  direction: "down" | "up" = "down",
  intensity: "small" | "medium" | "large" = "medium"
): Promise<void> {
  const distances = {
    small: { min: 100, max: 200 },
    medium: { min: 200, max: 400 },
    large: { min: 300, max: 500 },
  };
  
  const { min, max } = distances[intensity];
  const distance = min + Math.random() * (max - min);
  const actualDistance = direction === "down" ? distance : -distance;
  
  // Scroll in small chunks to be more careful and not skip content
  const steps = Math.ceil(Math.abs(actualDistance) / 100);
  const stepSize = actualDistance / steps;
  
  for (let i = 0; i < steps; i++) {
    await page.evaluate((dist) => {
      window.scrollBy({
        top: dist,
        behavior: "smooth",
      });
    }, stepSize);
    await page.waitForTimeout(50 + Math.random() * 50);
  }
  
  // Wait for content to load
  await page.waitForTimeout(300 + Math.random() * 500);
}

// Scroll multiple times like a human browsing
export async function humanBrowseScroll(
  page: Page,
  times: number = 3
): Promise<void> {
  for (let i = 0; i < times; i++) {
    await humanScroll(page, "down", "medium");
    await humanDelay(1000, 3000);
    
    // Occasionally scroll up a bit
    if (Math.random() > 0.7) {
      await humanScroll(page, "up", "small");
      await humanDelay(500, 1500);
    }
  }
}

// ============================================
// HUMAN-LIKE MOUSE MOVEMENT
// ============================================
export async function humanMouseMove(
  page: Page,
  x: number,
  y: number
): Promise<void> {
  // Move in steps to simulate human movement
  const steps = 10 + Math.floor(Math.random() * 10);
  
  await page.mouse.move(x, y, { steps });
  await humanDelay(50, 150);
}

// Click with human-like approach
export async function humanClick(
  page: Page,
  selector: string
): Promise<boolean> {
  try {
    const element = await page.$(selector);
    if (!element) return false;
    
    const box = await element.boundingBox();
    if (!box) return false;
    
    // Move to element with some randomness
    const x = box.x + box.width / 2 + (Math.random() - 0.5) * 10;
    const y = box.y + box.height / 2 + (Math.random() - 0.5) * 10;
    
    await humanMouseMove(page, x, y);
    await humanDelay(100, 300);
    await page.mouse.click(x, y);
    
    return true;
  } catch {
    return false;
  }
}

// ============================================
// RANDOM HUMAN ACTIONS
// ============================================
export async function randomHumanAction(page: Page): Promise<void> {
  const actions = [
    // Scroll a bit
    async () => {
      await humanScroll(page, Math.random() > 0.5 ? "down" : "up", "small");
    },
    // Move mouse randomly
    async () => {
      const x = 200 + Math.random() * 800;
      const y = 200 + Math.random() * 400;
      await humanMouseMove(page, x, y);
    },
    // Just wait
    async () => {
      await humanDelay(1000, 3000);
    },
  ];
  
  const action = actions[Math.floor(Math.random() * actions.length)];
  await action();
}
