/**
 * Main worker entry point
 * Runs the scheduled scraping cycles
 */

import cron from 'node-cron';
import { createSession, closeSession, isLoggedIn, getAccountsWithSessions, Session } from './browser/session.js';
import { navigateToGroup, scrapePosts, postComment } from './browser/facebook.js';
import { warmupSession } from './browser/humanize.js';
import { randomDelay, shuffleArray } from './utils/random.js';
import api from './api/client.js';
import config from './config.js';
import logger from './utils/logger.js';

// Track daily stats per account
const dailyStats: Record<string, { dailyScrapes: number; dailyComments: number; dailyDms: number }> = {};

function getStats(accountId: string) {
  if (!dailyStats[accountId]) {
    dailyStats[accountId] = { dailyScrapes: 0, dailyComments: 0, dailyDms: 0 };
  }
  return dailyStats[accountId];
}

function resetDailyStats() {
  for (const key of Object.keys(dailyStats)) {
    dailyStats[key] = { dailyScrapes: 0, dailyComments: 0, dailyDms: 0 };
  }
  logger.info('Scheduler', 'Daily stats reset');
}

/**
 * Check if current hour is within operating hours
 */
function isOperatingHour(): boolean {
  const now = new Date();
  const hour = now.getHours();
  return hour >= config.operatingHours.start && hour < config.operatingHours.end;
}

/**
 * Check if current hour is peak hour
 */
function isPeakHour(): boolean {
  const hour = new Date().getHours();
  return config.peakHours.includes(hour);
}

/**
 * Run scraping cycle for one account
 */
async function runAccountCycle(session: Session): Promise<void> {
  const { account } = session;
  const stats = getStats(account.id);

  // Check limits
  if (stats.dailyScrapes >= config.limits.maxScrapes) {
    logger.warn('Worker', `${account.name}: Daily scrape limit reached`);
    return;
  }

  try {
    // Send heartbeat
    await api.sendHeartbeat(account.id, 'SCRAPING', stats);

    // Check if logged in
    const loggedIn = await isLoggedIn(session.page);
    if (!loggedIn) {
      logger.error('Worker', `${account.name}: Not logged in!`);
      await api.sendHeartbeat(account.id, 'OFFLINE', stats, 'Not logged in');
      return;
    }

    // Warmup session
    await warmupSession(session.page);

    // Get groups for this account
    const groups = await api.getGroupsForAccount(account.id);
    
    if (groups.length === 0) {
      logger.warn('Worker', `${account.name}: No groups assigned`);
      return;
    }

    // Shuffle groups to avoid predictable patterns
    const shuffledGroups = shuffleArray(groups);
    const groupsToProcess = shuffledGroups.slice(0, config.limits.maxGroupsPerCycle);

    for (const group of groupsToProcess) {
      if (stats.dailyScrapes >= config.limits.maxScrapes) break;

      logger.info('Worker', `${account.name}: Scraping ${group.name}`);

      // Navigate to group
      const success = await navigateToGroup(session.page, group.url);
      if (!success) continue;

      // Scrape posts
      const posts = await scrapePosts(session.page, 10);
      stats.dailyScrapes++;

      // Process each post
      for (const post of posts) {
        // Analyze with AI
        const analysis = await api.analyzePost({
          postText: post.postText,
          authorName: post.authorName,
          groupName: group.name,
        }) as { intentScore?: number; isLead?: boolean; suggestedResponse?: string } | null;

        if (!analysis) continue;

        // Submit lead to database
        await api.submitLead({
          groupId: group.id,
          postUrl: post.postUrl,
          authorName: post.authorName,
          authorProfileUrl: post.authorProfileUrl,
          postText: post.postText,
          postDate: post.postDate,
          aiAnalysis: analysis,
          intentScore: analysis.intentScore || 0,
          scrapedById: account.id,
        });

        // Comment on high-intent posts (if within limits and auto-engage is enabled)
        if (
          analysis.isLead &&
          analysis.intentScore && analysis.intentScore >= 4 &&
          analysis.suggestedResponse &&
          stats.dailyComments < config.limits.maxComments
        ) {
          // Random chance to engage (don't engage every post)
          if (Math.random() > 0.7) {
            logger.info('Worker', `${account.name}: Commenting on high-intent post`);
            
            // Delay before commenting
            await randomDelay(30000, 120000); // 30 sec - 2 min
            
            const commented = await postComment(
              session.page,
              post.postUrl,
              analysis.suggestedResponse
            );
            
            if (commented) {
              stats.dailyComments++;
            }
          }
        }
      }

      // Random delay between groups
      await randomDelay(
        config.delays.betweenActions.min * 2,
        config.delays.betweenActions.max * 3
      );
    }

    // Send final heartbeat
    await api.sendHeartbeat(account.id, 'ONLINE', stats);

  } catch (error) {
    logger.error('Worker', `${account.name}: Cycle failed`, error);
    await api.sendHeartbeat(account.id, 'ONLINE', stats, String(error));
  }
}

/**
 * Run a full scraping cycle for all accounts
 */
async function runCycle(): Promise<void> {
  if (!isOperatingHour()) {
    logger.info('Scheduler', 'Outside operating hours, skipping cycle');
    return;
  }

  logger.info('Scheduler', 'Starting scraping cycle');

  const accounts = getAccountsWithSessions();
  
  if (accounts.length === 0) {
    logger.warn('Scheduler', 'No accounts with sessions found');
    return;
  }

  // Add jitter before starting
  const jitter = config.delays.jitterBeforeStart;
  const jitterTime = Math.floor(Math.random() * (jitter.max - jitter.min)) + jitter.min;
  logger.info('Scheduler', `Jitter delay: ${Math.round(jitterTime / 1000)}s`);
  await randomDelay(jitterTime, jitterTime);

  // Process accounts sequentially to avoid detection
  for (const account of accounts) {
    logger.info('Scheduler', `Processing account: ${account.name}`);
    
    const session = await createSession(account);
    
    try {
      await runAccountCycle(session);
    } catch (error) {
      logger.error('Scheduler', `Account ${account.name} failed`, error);
    } finally {
      await closeSession(session);
    }

    // Delay between accounts
    await randomDelay(60000, 180000); // 1-3 min
  }

  logger.info('Scheduler', 'Cycle complete');
}

/**
 * Main entry point
 */
async function main() {
  logger.info('Worker', '🚀 Starting Facebook Lead Scraper Worker');
  logger.info('Worker', `Configured accounts: ${config.accounts.length}`);
  logger.info('Worker', `Operating hours: ${config.operatingHours.start}:00 - ${config.operatingHours.end}:00`);
  logger.info('Worker', `Peak hours: ${config.peakHours.join(', ')}`);

  // Check for accounts with sessions
  const readyAccounts = getAccountsWithSessions();
  logger.info('Worker', `Accounts with sessions: ${readyAccounts.length}`);

  if (readyAccounts.length === 0) {
    logger.warn('Worker', 'No accounts ready! Run: npm run login:all');
  }

  // Reset stats at midnight
  cron.schedule('0 0 * * *', resetDailyStats, { timezone: config.timezone });

  // Schedule normal hours (every hour at minute 0)
  cron.schedule('0 * * * *', async () => {
    if (!isPeakHour()) {
      await runCycle();
    }
  }, { timezone: config.timezone });

  // Schedule peak hours (every 30 min - at minute 0 and 30)
  cron.schedule('0,30 * * * *', async () => {
    if (isPeakHour()) {
      await runCycle();
    }
  }, { timezone: config.timezone });

  logger.info('Worker', '⏰ Scheduler started. Waiting for next cycle...');
  logger.info('Worker', 'Press Ctrl+C to stop');

  // Run immediately if within operating hours
  if (isOperatingHour()) {
    logger.info('Worker', 'Running initial cycle...');
    await runCycle();
  }
}

main().catch(error => {
  logger.error('Worker', 'Fatal error', error);
  process.exit(1);
});
