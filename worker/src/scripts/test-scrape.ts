/**
 * Test scraping script - test without committing to database
 * Usage: npm run test:scrape
 */

import { createSession, closeSession, isLoggedIn, getAccountsWithSessions } from '../browser/session.js';
import { navigateToGroup, scrapePosts } from '../browser/facebook.js';
import { warmupSession } from '../browser/humanize.js';
import api from '../api/client.js';
import logger from '../utils/logger.js';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer);
    });
  });
}

async function main() {
  const accounts = getAccountsWithSessions();

  if (accounts.length === 0) {
    console.log('\n❌ No accounts with sessions found!');
    console.log('Run: npm run login:all');
    process.exit(1);
  }

  console.log('\n🧪 Test Scraping\n');
  console.log('Available accounts:');
  accounts.forEach((acc, i) => {
    console.log(`  ${i + 1}. ${acc.name}`);
  });

  const choice = await prompt('\nSelect account number: ');
  const account = accounts[parseInt(choice) - 1];

  if (!account) {
    console.log('Invalid selection');
    process.exit(1);
  }

  // Get groups from API or use test URL
  let groups = await api.getGroups();
  
  let groupUrl: string;
  
  if (groups.length > 0) {
    console.log('\nAvailable groups:');
    groups.forEach((g, i) => {
      console.log(`  ${i + 1}. ${g.name}`);
    });
    console.log(`  ${groups.length + 1}. Enter custom URL`);
    
    const groupChoice = await prompt('\nSelect group: ');
    const groupIdx = parseInt(groupChoice) - 1;
    
    if (groupIdx === groups.length) {
      groupUrl = await prompt('Enter group URL: ');
    } else {
      groupUrl = groups[groupIdx]?.url || '';
    }
  } else {
    groupUrl = await prompt('Enter group URL to scrape: ');
  }

  if (!groupUrl) {
    console.log('No group URL provided');
    process.exit(1);
  }

  console.log(`\n🚀 Starting test scrape with ${account.name}...`);
  console.log(`   Group: ${groupUrl}\n`);

  const session = await createSession(account);

  try {
    // Check login
    console.log('Checking login status...');
    const loggedIn = await isLoggedIn(session.page);
    
    if (!loggedIn) {
      console.log('❌ Not logged in! Please run login script first.');
      await closeSession(session);
      process.exit(1);
    }
    console.log('✅ Logged in\n');

    // Warmup
    console.log('Warming up session...');
    await warmupSession(session.page);
    console.log('✅ Warmup complete\n');

    // Navigate to group
    console.log('Navigating to group...');
    const success = await navigateToGroup(session.page, groupUrl);
    
    if (!success) {
      console.log('❌ Failed to navigate to group');
      await closeSession(session);
      process.exit(1);
    }
    console.log('✅ On group page\n');

    // Scrape posts
    console.log('Scraping posts...');
    const posts = await scrapePosts(session.page, 5);
    
    console.log(`\n📋 Found ${posts.length} posts:\n`);
    
    for (const post of posts) {
      console.log(`${'─'.repeat(60)}`);
      console.log(`Author: ${post.authorName}`);
      console.log(`URL: ${post.postUrl.substring(0, 80)}...`);
      console.log(`Text: ${post.postText.substring(0, 200)}...`);
      console.log('');

      // Test AI analysis
      const analyze = await prompt('Analyze this post with AI? (y/n): ');
      
      if (analyze.toLowerCase() === 'y') {
        console.log('Analyzing...');
        const analysis = await api.analyzePost({
          postText: post.postText,
          authorName: post.authorName,
          groupName: 'Test Group',
        });
        
        if (analysis) {
          console.log('\n🤖 AI Analysis:');
          console.log(JSON.stringify(analysis, null, 2));
        } else {
          console.log('❌ Analysis failed');
        }
      }
      console.log('');
    }

  } catch (error) {
    logger.error('TestScrape', 'Test failed', error);
  } finally {
    await closeSession(session);
  }

  rl.close();
  console.log('\n✨ Test complete!\n');
}

main().catch(error => {
  logger.error('TestScrape', 'Script failed', error);
  process.exit(1);
});
