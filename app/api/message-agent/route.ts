import { NextRequest, NextResponse } from "next/server";
import { chromium, Page } from "playwright";
import path from "path";
import { prisma } from "@/lib/db";
import { ContactStatus, ConversationStateEnum, MessengerContact, LeadStage, LeadStatus } from "@prisma/client";

// ============================================
// MESSAGE AGENT - Prisma-based conversation tracking
// No JSON files - everything in PostgreSQL
// Links to Leads and updates Lead stages automatically
// ============================================

// Stealth script
const STEALTH_SCRIPT = `
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
Object.defineProperty(navigator, 'languages', { get: () => ['it-IT', 'it', 'en-US', 'en'] });
window.chrome = { runtime: {} };
`;

// Human-like delay
async function humanDelay(min: number, max: number): Promise<void> {
  const delay = min + Math.random() * (max - min);
  await new Promise(resolve => setTimeout(resolve, delay));
}

// ============================================
// TYPES
// ============================================

interface ConversationSummary {
  contactFbId: string;
  contactName: string;
  conversationUrl: string;
  hasUnreadBadge: boolean;
  lastMessagePreview: string;
}

interface MessageCount {
  total: number;
  theirs: number;
  ours: number;
  lastMessageIsTheirs: boolean;
  lastMessageText: string;
  lastMessageHash: string;
  allMessages: Array<{ sender: 'them' | 'us'; text: string }>;
}

interface ActionResult {
  success: boolean;
  action: string;
  stats: {
    totalActive: number;
    totalOld: number;
    needsReply: number;
    new: number;
    returning: number;
  };
  logs: string[];
  errors: string[];
}

// ============================================
// BROWSER MANAGEMENT
// ============================================

async function getBrowserPage(accountId: string): Promise<{ page: Page; cleanup: () => Promise<void> }> {
  const profilesDir = path.join(process.cwd(), "worker", "profiles", accountId);
  
  // Get account with session data from database
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { sessionData: true, userAgent: true },
  });
  
  if (!account?.sessionData) {
    throw new Error(`No session found for account ${accountId}. Please login first.`);
  }
  
  const sessionData = account.sessionData as { cookies?: any[]; origins?: any[] };
  
  const browser = await chromium.launchPersistentContext(profilesDir, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    userAgent: account.userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "it-IT",
    timezoneId: "Europe/Rome",
    args: ["--disable-blink-features=AutomationControlled"],
  });
  
  const page = await browser.newPage();
  await page.addInitScript(STEALTH_SCRIPT);
  
  // Restore cookies from database session data
  if (sessionData.cookies && sessionData.cookies.length > 0) {
    await browser.addCookies(sessionData.cookies);
  }
  
  return {
    page,
    cleanup: async () => {
      await page.close();
      await browser.close();
    },
  };
}

// ============================================
// CONFIG MANAGEMENT
// ============================================

async function getOrCreateConfig(accountId: string) {
  let config = await prisma.messageAgentConfig.findUnique({
    where: { accountId },
  });
  
  if (!config) {
    config = await prisma.messageAgentConfig.create({
      data: {
        accountId,
        inactiveDays: 7,
        refreshOldDays: 7,
        forceFullCheckHours: 24,
        scanIntervalMinutes: 15,
      },
    });
  }
  
  return config;
}

// ============================================
// LEAD LINKING & STAGE UPDATES
// ============================================

/**
 * Try to find and link a Lead to a MessengerContact by matching name or FB ID
 */
async function tryLinkContactToLead(
  contactId: string,
  contactName: string,
  contactFbId: string | null,
  log: (msg: string) => void
): Promise<string | null> {
  // First try to match by authorFbId (exact match)
  if (contactFbId) {
    const leadByFbId = await prisma.lead.findFirst({
      where: { authorFbId: contactFbId },
    });
    if (leadByFbId) {
      await prisma.messengerContact.update({
        where: { id: contactId },
        data: { 
          leadId: leadByFbId.id,
          leadStage: leadByFbId.stage,
          leadStageUpdatedAt: new Date(),
        },
      });
      log(`   🔗 Linked to lead by FB ID: ${leadByFbId.authorName || leadByFbId.id}`);
      return leadByFbId.id;
    }
  }
  
  // Try to match by name (partial match)
  const leadByName = await prisma.lead.findFirst({
    where: {
      authorName: {
        contains: contactName,
        mode: 'insensitive',
      },
    },
  });
  
  if (leadByName) {
    await prisma.messengerContact.update({
      where: { id: contactId },
      data: { 
        leadId: leadByName.id,
        leadStage: leadByName.stage,
        leadStageUpdatedAt: new Date(),
      },
    });
    log(`   🔗 Linked to lead by name: ${leadByName.authorName}`);
    return leadByName.id;
  }
  
  return null;
}

/**
 * Map ConversationStateEnum to LeadStage
 * - NEEDS_REPLY, WAITING, ACTIVE → INTERESTED (they're engaged)
 * - ENDED → depends on outcome
 */
function mapConversationStateToLeadStage(
  state: ConversationStateEnum,
  lastTheirMessage?: string | null
): LeadStage {
  // Check for WhatsApp/phone keywords in their message
  if (lastTheirMessage) {
    const lower = lastTheirMessage.toLowerCase();
    if (lower.includes('whatsapp') || lower.includes('واتساب') || lower.includes('واتس')) {
      return LeadStage.CTA_WHATSAPP;
    }
    if (/\+?\d{8,}/.test(lastTheirMessage) || lower.includes('phone') || lower.includes('call')) {
      return LeadStage.CTA_PHONE;
    }
  }
  
  switch (state) {
    case ConversationStateEnum.NEEDS_REPLY:
    case ConversationStateEnum.WAITING:
    case ConversationStateEnum.ACTIVE:
      return LeadStage.INTERESTED;
    case ConversationStateEnum.ENDED:
      return LeadStage.LOST;
    default:
      return LeadStage.LEAD;
  }
}

/**
 * Update Lead stage based on conversation state
 */
async function updateLeadStageFromConversation(
  contactId: string,
  leadId: string,
  state: ConversationStateEnum,
  lastTheirMessage?: string | null,
  log?: (msg: string) => void
): Promise<void> {
  const newStage = mapConversationStateToLeadStage(state, lastTheirMessage);
  
  // Get current lead stage
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { stage: true },
  });
  
  if (!lead) return;
  
  // Only update if stage is progressing (not going backwards)
  const stageOrder: LeadStage[] = [
    LeadStage.LEAD,
    LeadStage.INTERESTED,
    LeadStage.CTA_WHATSAPP,
    LeadStage.CTA_PHONE,
    LeadStage.CONVERTED,
  ];
  
  const currentIndex = stageOrder.indexOf(lead.stage);
  const newIndex = stageOrder.indexOf(newStage);
  
  // Allow LOST to override anything except CONVERTED
  if (newStage === LeadStage.LOST && lead.stage !== LeadStage.CONVERTED) {
    await prisma.lead.update({
      where: { id: leadId },
      data: { stage: LeadStage.LOST, stageUpdatedAt: new Date() },
    });
    await prisma.messengerContact.update({
      where: { id: contactId },
      data: { leadStage: LeadStage.LOST, leadStageUpdatedAt: new Date() },
    });
    if (log) log(`   📊 Lead stage: ${lead.stage} → LOST`);
    return;
  }
  
  // Only progress forward
  if (newIndex > currentIndex) {
    await prisma.lead.update({
      where: { id: leadId },
      data: { stage: newStage, stageUpdatedAt: new Date() },
    });
    await prisma.messengerContact.update({
      where: { id: contactId },
      data: { leadStage: newStage, leadStageUpdatedAt: new Date() },
    });
    if (log) log(`   📊 Lead stage: ${lead.stage} → ${newStage}`);
  }
}

/**
 * Update lead status based on conversation actions
 */
async function updateLeadStatus(
  leadId: string,
  action: 'dm_sent' | 'responded'
): Promise<void> {
  const statusMap = {
    dm_sent: LeadStatus.DM_SENT,
    responded: LeadStatus.RESPONDED,
  };
  
  await prisma.lead.update({
    where: { id: leadId },
    data: { status: statusMap[action], updatedAt: new Date() },
  });
}

// ============================================
// EXTRACTION FUNCTIONS
// ============================================

/**
 * Extract conversations from currently visible sidebar
 */
async function extractVisibleConversations(page: Page): Promise<ConversationSummary[]> {
  return await page.evaluate(() => {
    const conversations: ConversationSummary[] = [];
    const seenIds = new Set<string>();
    
    // Find all conversation links (both encrypted and regular)
    const links = document.querySelectorAll('a[href*="/messages/e2ee/t/"], a[href*="/messages/t/"]');
    
    for (const link of links) {
      const href = link.getAttribute('href') || '';
      const match = href.match(/\/messages\/(?:e2ee\/)?t\/(\d+)/);
      if (!match || seenIds.has(match[1])) continue;
      
      seenIds.add(match[1]);
      const fullUrl = href.startsWith('http') ? href : `https://www.facebook.com${href}`;
      
      // Find row container to get name and unread status
      let row = link.closest('[role="row"]') as HTMLElement | null;
      if (!row) continue;
      
      // Get contact name - look for bold span (font-weight 700) 
      let contactName = '';
      const spans = row.querySelectorAll('span');
      for (const span of spans) {
        const style = window.getComputedStyle(span);
        const weight = parseInt(style.fontWeight);
        const text = span.textContent?.trim() || '';
        
        if (weight >= 600 && text.length > 1 && text.length < 50) {
          // Skip common non-name text
          const lower = text.toLowerCase();
          if (['you:', 'tu:', 'facebook user', 'utente di facebook'].some(s => lower.includes(s))) continue;
          if (/^\d+$/.test(text)) continue;
          
          contactName = text;
          break;
        }
      }
      
      if (!contactName) continue;
      
      // Check for unread badge - look for aria-label with "unread"
      const hasUnread = row.querySelector('[aria-label*="unread"], [aria-label*="non letti"]') !== null ||
                       row.innerHTML.toLowerCase().includes('unread');
      
      // Get last message preview
      let preview = '';
      for (const span of spans) {
        const style = window.getComputedStyle(span);
        const weight = parseInt(style.fontWeight);
        const text = span.textContent?.trim() || '';
        
        if (weight < 600 && text.length > 5 && text.length < 200) {
          if (text !== contactName && !text.includes('Active')) {
            preview = text;
            break;
          }
        }
      }
      
      conversations.push({
        contactFbId: match[1],
        contactName,
        conversationUrl: fullUrl,
        hasUnreadBadge: hasUnread,
        lastMessagePreview: preview,
      });
    }
    
    return conversations;
  });
}

/**
 * Scroll sidebar and extract ALL conversations
 */
async function scrollAndExtractAllContacts(
  page: Page,
  log: (msg: string) => void
): Promise<ConversationSummary[]> {
  const allConversations = new Map<string, ConversationSummary>();
  
  // Navigate to Messenger first
  await page.goto("https://www.facebook.com/messages/t/", { waitUntil: "domcontentloaded" });
  await humanDelay(3000, 4000);
  
  let previousCount = 0;
  let sameCountStreak = 0;
  const maxScrolls = 30;
  
  for (let i = 0; i < maxScrolls; i++) {
    // Extract from current view
    const visible = await extractVisibleConversations(page);
    for (const conv of visible) {
      if (!allConversations.has(conv.contactName)) {
        allConversations.set(conv.contactName, conv);
      }
    }
    
    const currentCount = allConversations.size;
    log(`   Scroll ${i + 1}: ${currentCount} unique conversations found`);
    
    if (currentCount === previousCount) {
      sameCountStreak++;
      if (sameCountStreak >= 3) {
        log(`   ✓ Reached end of sidebar after ${i + 1} scrolls`);
        break;
      }
    } else {
      sameCountStreak = 0;
    }
    previousCount = currentCount;
    
    // Scroll sidebar
    await page.evaluate(() => {
      const link = document.querySelector('a[href*="/messages/t/"]');
      if (link) {
        let parent = link.parentElement;
        while (parent) {
          if (parent.scrollHeight > parent.clientHeight) {
            parent.scrollTop = parent.scrollHeight;
            return;
          }
          parent = parent.parentElement;
        }
      }
    });
    
    await page.mouse.wheel(0, 500);
    await humanDelay(800, 1200);
  }
  
  return Array.from(allConversations.values());
}

/**
 * Count messages in a conversation (full scroll)
 */
async function countMessagesInConversation(
  page: Page,
  conversationUrl: string,
  contactName: string,
  log: (msg: string) => void
): Promise<MessageCount> {
  log(`   📖 Counting messages for: ${contactName}`);
  
  await page.goto(conversationUrl, { waitUntil: "domcontentloaded" });
  await humanDelay(2500, 3500);
  
  // Click to focus
  const mainArea = await page.$('[role="main"]');
  if (mainArea) {
    const box = await mainArea.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await humanDelay(300, 500);
    }
  }
  
  const extractMessages = async () => {
    return await page.evaluate(({ contactName }: { contactName: string }) => {
      const messages: Array<{ sender: 'them' | 'us'; text: string }> = [];
      const seenTexts = new Set<string>();
      const contactFirstName = contactName.split(' ')[0].toLowerCase();
      const contactNameLower = contactName.toLowerCase();
      
      const main = document.querySelector('[role="main"]');
      if (!main) return messages;
      
      const rows = main.querySelectorAll('[role="row"]');
      
      for (const row of rows) {
        const presentations = row.querySelectorAll('[role="presentation"]');
        
        for (const pres of presentations) {
          const textEls = pres.querySelectorAll('[dir="auto"]');
          
          for (const el of textEls) {
            const htmlEl = el as HTMLElement;
            const text = htmlEl.textContent?.trim() || '';
            const lowerText = text.toLowerCase();
            
            if (!text || text.length < 2 || text.length > 2000) continue;
            if (seenTexts.has(text)) continue;
            
            // Skip timestamps and system messages
            if (/^\d{1,2}:\d{2}/.test(text)) continue;
            if (/\d{1,2}:\d{2}\s*(AM|PM)/i.test(text)) continue;
            if (/yesterday|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday/i.test(text)) continue;
            if (lowerText === contactNameLower || lowerText === contactFirstName) continue;
            if (lowerText === 'enter') continue;
            if (lowerText.includes('end-to-end')) continue;
            if (lowerText.includes('messages and calls')) continue;
            if (lowerText.includes('you can now message')) continue;
            if (lowerText.includes('seen') || lowerText.includes('delivered')) continue;
            
            // Check line height - 19.9-20.0 is a message
            const style = window.getComputedStyle(htmlEl);
            const lineHeight = parseFloat(style.lineHeight);
            if (lineHeight < 19.9 || lineHeight > 20.0) continue;
            
            // Gray background = their message
            const parent = htmlEl.parentElement;
            const parentStyle = parent ? window.getComputedStyle(parent) : null;
            const bgColor = parentStyle ? parentStyle.backgroundColor : '';
            const isTheirs = bgColor.includes('48, 48, 48') || bgColor.includes('58, 58, 58');
            
            seenTexts.add(text);
            messages.push({ sender: isTheirs ? 'them' : 'us', text });
            break;
          }
        }
      }
      
      return messages;
    }, { contactName });
  };
  
  const allMessages = new Map<string, { sender: 'them' | 'us'; text: string }>();
  
  // Scroll UP to load history
  for (let i = 0; i < 20; i++) {
    if (mainArea) {
      const box = await mainArea.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.wheel(0, -2000);
      }
    }
    await humanDelay(300, 500);
    if ((i + 1) % 5 === 0) await humanDelay(800, 1000);
  }
  
  await humanDelay(1000, 1500);
  
  // Scroll DOWN and collect
  for (let i = 0; i < 25; i++) {
    const current = await extractMessages();
    for (const msg of current) {
      if (!allMessages.has(msg.text)) {
        allMessages.set(msg.text, msg);
      }
    }
    
    if (mainArea) {
      const box = await mainArea.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.wheel(0, 800);
      }
    }
    await humanDelay(200, 350);
  }
  
  // Final collection
  const finalMsgs = await extractMessages();
  for (const msg of finalMsgs) {
    if (!allMessages.has(msg.text)) {
      allMessages.set(msg.text, msg);
    }
  }
  
  const messages = Array.from(allMessages.values());
  let theirs = 0, ours = 0;
  for (const msg of messages) {
    if (msg.sender === 'them') theirs++;
    else ours++;
  }
  
  const lastMessage = messages[messages.length - 1];
  const lastText = lastMessage?.text || '';
  const hash = Buffer.from(lastText.slice(0, 50)).toString('base64').slice(0, 16);
  
  log(`   📊 ${contactName}: ${theirs + ours} total (Theirs: ${theirs}, Ours: ${ours})`);
  
  return {
    total: theirs + ours,
    theirs,
    ours,
    lastMessageIsTheirs: lastMessage?.sender === 'them',
    lastMessageText: lastText,
    lastMessageHash: hash,
    allMessages: messages,
  };
}

/**
 * Quick check - just last 3 messages, no scrolling (~5 sec)
 */
async function quickCheckConversation(
  page: Page,
  conversationUrl: string,
  contactName: string
): Promise<{ hash: string; lastMessageIsTheirs: boolean }> {
  await page.goto(conversationUrl, { waitUntil: "domcontentloaded" });
  await humanDelay(1500, 2000);
  
  const result = await page.evaluate(({ contactName }: { contactName: string }) => {
    const messages: Array<{ sender: 'them' | 'us'; text: string }> = [];
    const seenTexts = new Set<string>();
    const contactFirstName = contactName.split(' ')[0].toLowerCase();
    const contactNameLower = contactName.toLowerCase();
    
    const main = document.querySelector('[role="main"]');
    if (!main) return { messages: [], hash: '' };
    
    const rows = main.querySelectorAll('[role="row"]');
    
    for (const row of rows) {
      const presentations = row.querySelectorAll('[role="presentation"]');
      
      for (const pres of presentations) {
        const textEls = pres.querySelectorAll('[dir="auto"]');
        
        for (const el of textEls) {
          const htmlEl = el as HTMLElement;
          const text = htmlEl.textContent?.trim() || '';
          const lowerText = text.toLowerCase();
          
          if (!text || text.length < 2 || text.length > 2000) continue;
          if (seenTexts.has(text)) continue;
          if (/^\d{1,2}:\d{2}/.test(text)) continue;
          if (/yesterday|today|monday|tuesday/i.test(text)) continue;
          if (lowerText === contactNameLower || lowerText === contactFirstName) continue;
          if (lowerText === 'enter' || lowerText.includes('end-to-end')) continue;
          
          const style = window.getComputedStyle(htmlEl);
          const lineHeight = parseFloat(style.lineHeight);
          if (lineHeight < 19.9 || lineHeight > 20.0) continue;
          
          const parent = htmlEl.parentElement;
          const parentStyle = parent ? window.getComputedStyle(parent) : null;
          const bgColor = parentStyle ? parentStyle.backgroundColor : '';
          const isTheirs = bgColor.includes('48, 48, 48') || bgColor.includes('58, 58, 58');
          
          seenTexts.add(text);
          messages.push({ sender: isTheirs ? 'them' : 'us', text });
          break;
        }
      }
    }
    
    const last3 = messages.slice(-3);
    const hashStr = last3.map(m => `${m.sender}:${m.text.slice(0, 30)}`).join('|');
    const hash = btoa(unescape(encodeURIComponent(hashStr))).slice(0, 32);
    
    return { messages: last3, hash };
  }, { contactName });
  
  const lastMessage = result.messages[result.messages.length - 1];
  
  return {
    hash: result.hash || '',
    lastMessageIsTheirs: lastMessage?.sender === 'them',
  };
}

// ============================================
// ACTIONS
// ============================================

/**
 * INIT - Full sidebar scroll, discover all contacts
 */
async function initAction(accountId: string, logs: string[]): Promise<ActionResult> {
  const log = (msg: string) => { logs.push(msg); console.log(msg); };
  const errors: string[] = [];
  
  log('🚀 INIT - Full sidebar scan...');
  
  const config = await getOrCreateConfig(accountId);
  const { page, cleanup } = await getBrowserPage(accountId);
  
  try {
    // Get all existing contacts by name
    const existing = await prisma.messengerContact.findMany({
      where: { accountId },
      select: { contactName: true, status: true, id: true },
    });
    const existingMap = new Map(existing.map((c: { contactName: string; status: ContactStatus; id: string }) => [c.contactName, c]));
    
    // Scroll and extract all conversations
    const allConvs = await scrollAndExtractAllContacts(page, log);
    log(`📋 Found ${allConvs.length} conversations in sidebar`);
    
    let newCount = 0;
    
    for (const conv of allConvs) {
      const ex = existingMap.get(conv.contactName);
      
      if (ex) {
        // Already exists - just update lastCheckedAt
        await prisma.messengerContact.update({
          where: { id: ex.id },
          data: { lastCheckedAt: new Date() },
        });
        continue;
      }
      
      // NEW contact - count messages
      log(`  📝 New: ${conv.contactName}`);
      const counts = await countMessagesInConversation(page, conv.conversationUrl, conv.contactName, log);
      
      const newContact = await prisma.messengerContact.create({
        data: {
          accountId,
          contactName: conv.contactName,
          contactFbId: conv.contactFbId,
          conversationUrl: conv.conversationUrl,
          status: ContactStatus.ACTIVE,
          state: counts.lastMessageIsTheirs ? ConversationStateEnum.NEEDS_REPLY : ConversationStateEnum.WAITING,
          stateChangedAt: new Date(),
          totalMessageCount: counts.total,
          theirMessageCount: counts.theirs,
          ourMessageCount: counts.ours,
          lastActivityAt: new Date(),
          lastCheckedAt: new Date(),
          lastFullCheckAt: new Date(),
          quickCheckHash: counts.lastMessageHash,
          lastTheirMessage: counts.lastMessageIsTheirs ? counts.lastMessageText : undefined,
          lastTheirMessageAt: counts.lastMessageIsTheirs ? new Date() : undefined,
        },
      });
      
      // Try to link to existing Lead
      const leadId = await tryLinkContactToLead(newContact.id, conv.contactName, conv.contactFbId, log);
      if (leadId) {
        const state = counts.lastMessageIsTheirs ? ConversationStateEnum.NEEDS_REPLY : ConversationStateEnum.WAITING;
        await updateLeadStageFromConversation(newContact.id, leadId, state, counts.lastMessageText, log);
      }
      
      newCount++;
    }
    
    // Update config
    const activeCount = await prisma.messengerContact.count({ where: { accountId, status: ContactStatus.ACTIVE } });
    const oldCount = await prisma.messengerContact.count({ where: { accountId, status: ContactStatus.OLD } });
    const needsReplyCount = await prisma.messengerContact.count({ 
      where: { accountId, status: ContactStatus.ACTIVE, state: ConversationStateEnum.NEEDS_REPLY } 
    });
    
    await prisma.messageAgentConfig.update({
      where: { accountId },
      data: {
        lastFullSidebarScan: new Date(),
        totalActiveContacts: activeCount,
        totalOldContacts: oldCount,
      },
    });
    
    log(`✅ INIT complete: ${newCount} new contacts added`);
    
    return {
      success: true,
      action: 'init',
      stats: { totalActive: activeCount, totalOld: oldCount, needsReply: needsReplyCount, new: newCount, returning: 0 },
      logs,
      errors,
    };
  } finally {
    await cleanup();
  }
}

/**
 * SCAN - Smart boundary scan (stop at first OLD without unread)
 */
async function scanAction(accountId: string, logs: string[]): Promise<ActionResult> {
  const log = (msg: string) => { logs.push(msg); console.log(msg); };
  const errors: string[] = [];
  
  log('🔍 SCAN - Smart boundary detection...');
  
  await getOrCreateConfig(accountId);
  const { page, cleanup } = await getBrowserPage(accountId);
  
  try {
    // Get OLD contacts (boundary markers)
    const oldContacts = await prisma.messengerContact.findMany({
      where: { accountId, status: ContactStatus.OLD },
      select: { contactName: true, id: true },
    });
    const oldNames = new Set(oldContacts.map((c: { contactName: string }) => c.contactName));
    const oldMap = new Map(oldContacts.map((c: { contactName: string; id: string }) => [c.contactName, c.id]));
    
    // Get ACTIVE contacts
    const activeContacts = await prisma.messengerContact.findMany({
      where: { accountId, status: ContactStatus.ACTIVE },
    });
    const activeMap = new Map(activeContacts.map((c: MessengerContact) => [c.contactName, c]));
    
    // Navigate to Messenger
    await page.goto("https://www.facebook.com/messages/t/", { waitUntil: "domcontentloaded" });
    await humanDelay(3000, 4000);
    
    let foundBoundary = false;
    const results = { new: 0, returning: 0, needsReply: 0 };
    const processed = new Set<string>();
    
    while (!foundBoundary) {
      const visible = await extractVisibleConversations(page);
      
      for (const conv of visible) {
        if (processed.has(conv.contactName)) continue;
        processed.add(conv.contactName);
        
        // OLD without unread = BOUNDARY
        if (oldNames.has(conv.contactName) && !conv.hasUnreadBadge) {
          log(`🛑 Boundary: ${conv.contactName}`);
          foundBoundary = true;
          break;
        }
        
        // OLD with unread = RETURNING
        if (oldNames.has(conv.contactName) && conv.hasUnreadBadge) {
          log(`🔄 Returning: ${conv.contactName}`);
          const counts = await countMessagesInConversation(page, conv.conversationUrl, conv.contactName, log);
          
          const contactId = oldMap.get(conv.contactName)!;
          const updated = await prisma.messengerContact.update({
            where: { id: contactId },
            data: {
              status: ContactStatus.ACTIVE,
              state: ConversationStateEnum.NEEDS_REPLY,
              stateChangedAt: new Date(),
              totalMessageCount: counts.total,
              theirMessageCount: counts.theirs,
              ourMessageCount: counts.ours,
              lastActivityAt: new Date(),
              lastTheirMessage: counts.lastMessageText,
              lastTheirMessageAt: new Date(),
              archivedAt: null,
              archiveReason: null,
            },
          });
          
          // Update lead stage if linked
          if (updated.leadId) {
            await updateLeadStageFromConversation(updated.id, updated.leadId, ConversationStateEnum.NEEDS_REPLY, counts.lastMessageText, log);
          }
          
          oldNames.delete(conv.contactName);
          results.returning++;
          continue;
        }
        
        // ACTIVE contact with unread
        const active = activeMap.get(conv.contactName) as MessengerContact | undefined;
        if (active) {
          if (conv.hasUnreadBadge && active.state !== ConversationStateEnum.NEEDS_REPLY) {
            log(`📬 Needs reply: ${conv.contactName}`);
            await prisma.messengerContact.update({
              where: { id: active.id },
              data: {
                state: ConversationStateEnum.NEEDS_REPLY,
                previousState: active.state,
                stateChangedAt: new Date(),
                lastActivityAt: new Date(),
              },
            });
            
            // Update lead stage if linked
            if (active.leadId) {
              await updateLeadStageFromConversation(active.id, active.leadId, ConversationStateEnum.NEEDS_REPLY, null, log);
            }
            
            results.needsReply++;
          }
          continue;
        }
        
        // Not in either = BRAND NEW
        log(`🆕 New: ${conv.contactName}`);
        const counts = await countMessagesInConversation(page, conv.conversationUrl, conv.contactName, log);
        
        const newContact = await prisma.messengerContact.create({
          data: {
            accountId,
            contactName: conv.contactName,
            contactFbId: conv.contactFbId,
            conversationUrl: conv.conversationUrl,
            status: ContactStatus.ACTIVE,
            state: ConversationStateEnum.NEEDS_REPLY,
            stateChangedAt: new Date(),
            totalMessageCount: counts.total,
            theirMessageCount: counts.theirs,
            ourMessageCount: counts.ours,
            lastActivityAt: new Date(),
            lastCheckedAt: new Date(),
            lastTheirMessage: counts.lastMessageText,
            lastTheirMessageAt: new Date(),
          },
        });
        
        // Try to link to existing Lead
        const leadId = await tryLinkContactToLead(newContact.id, conv.contactName, conv.contactFbId, log);
        if (leadId) {
          await updateLeadStageFromConversation(newContact.id, leadId, ConversationStateEnum.NEEDS_REPLY, counts.lastMessageText, log);
        }
        
        results.new++;
      }
      
      if (!foundBoundary) {
        await page.mouse.wheel(0, 500);
        await humanDelay(600, 900);
      }
    }
    
    // Update config
    await prisma.messageAgentConfig.update({
      where: { accountId },
      data: { lastScanAt: new Date() },
    });
    
    const activeCount = await prisma.messengerContact.count({ where: { accountId, status: ContactStatus.ACTIVE } });
    const oldCount = await prisma.messengerContact.count({ where: { accountId, status: ContactStatus.OLD } });
    const needsReplyTotal = await prisma.messengerContact.count({ 
      where: { accountId, status: ContactStatus.ACTIVE, state: ConversationStateEnum.NEEDS_REPLY } 
    });
    
    log(`✅ SCAN complete: ${results.new} new, ${results.returning} returning, ${results.needsReply} need reply`);
    
    return {
      success: true,
      action: 'scan',
      stats: { totalActive: activeCount, totalOld: oldCount, needsReply: needsReplyTotal, new: results.new, returning: results.returning },
      logs,
      errors,
    };
  } finally {
    await cleanup();
  }
}

/**
 * MAINTENANCE - Archive inactive contacts
 */
async function maintenanceAction(accountId: string, logs: string[]): Promise<ActionResult> {
  const log = (msg: string) => { logs.push(msg); console.log(msg); };
  
  log('🔧 MAINTENANCE - Archive inactive...');
  
  const config = await getOrCreateConfig(accountId);
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - config.inactiveDays);
  
  // Archive inactive contacts (don't archive NEEDS_REPLY!)
  const result = await prisma.messengerContact.updateMany({
    where: {
      accountId,
      status: ContactStatus.ACTIVE,
      state: { not: ConversationStateEnum.NEEDS_REPLY },
      lastActivityAt: { lt: cutoffDate },
    },
    data: {
      status: ContactStatus.OLD,
      archivedAt: new Date(),
      archiveReason: 'inactive',
    },
  });
  
  log(`  📦 Archived ${result.count} inactive contacts`);
  
  // Update stats
  const activeCount = await prisma.messengerContact.count({ where: { accountId, status: ContactStatus.ACTIVE } });
  const oldCount = await prisma.messengerContact.count({ where: { accountId, status: ContactStatus.OLD } });
  const needsReply = await prisma.messengerContact.count({ 
    where: { accountId, status: ContactStatus.ACTIVE, state: ConversationStateEnum.NEEDS_REPLY } 
  });
  
  await prisma.messageAgentConfig.update({
    where: { accountId },
    data: {
      lastMaintenanceAt: new Date(),
      totalActiveContacts: activeCount,
      totalOldContacts: oldCount,
    },
  });
  
  log(`✅ MAINTENANCE complete`);
  
  return {
    success: true,
    action: 'maintenance',
    stats: { totalActive: activeCount, totalOld: oldCount, needsReply, new: 0, returning: 0 },
    logs,
    errors: [],
  };
}

/**
 * REPLY - Send AI replies to contacts needing reply
 */
async function replyAction(accountId: string, logs: string[], maxReplies: number = 3): Promise<ActionResult> {
  const log = (msg: string) => { logs.push(msg); console.log(msg); };
  const errors: string[] = [];
  
  log(`💬 REPLY - Sending AI replies (max ${maxReplies})...`);
  
  const { page, cleanup } = await getBrowserPage(accountId);
  
  try {
    // Get contacts needing reply (oldest first)
    const contactsNeedingReply = await prisma.messengerContact.findMany({
      where: {
        accountId,
        status: ContactStatus.ACTIVE,
        state: ConversationStateEnum.NEEDS_REPLY,
      },
      orderBy: { lastTheirMessageAt: 'asc' },
      take: maxReplies,
      include: { lead: true },
    });
    
    log(`  📋 Found ${contactsNeedingReply.length} contacts needing reply`);
    
    let repliesSent = 0;
    
    for (const contact of contactsNeedingReply) {
      try {
        log(`  💬 Replying to: ${contact.contactName}`);
        
        // Navigate to conversation
        await page.goto(contact.conversationUrl, { waitUntil: 'domcontentloaded' });
        await humanDelay(2000, 3000);
        
        // Read recent messages for context
        const recentMessages = await extractRecentMessages(page, contact.contactName);
        
        // Generate AI reply
        const aiReplyResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/ai/generate-reply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationHistory: recentMessages,
            contactName: contact.contactName,
            leadContext: contact.lead ? {
              postText: contact.lead.postText,
              matchedService: contact.lead.matchedService,
              intentScore: contact.lead.intentScore,
              stage: contact.lead.stage,
            } : undefined,
          }),
        });
        
        if (!aiReplyResponse.ok) {
          errors.push(`Failed to generate reply for ${contact.contactName}`);
          continue;
        }
        
        const aiData = await aiReplyResponse.json();
        const replyText = aiData.reply;
        
        if (!replyText) {
          errors.push(`Empty reply for ${contact.contactName}`);
          continue;
        }
        
        log(`     📝 Reply: "${replyText.substring(0, 50)}..."`);
        
        // Type the message
        const messageInput = await page.$('[aria-label*="Message"], [aria-label*="Messaggio"], [contenteditable="true"]');
        if (!messageInput) {
          errors.push(`Could not find message input for ${contact.contactName}`);
          continue;
        }
        
        await messageInput.click();
        await humanDelay(300, 500);
        
        // Type with human-like speed
        for (const char of replyText) {
          await page.keyboard.type(char, { delay: 30 + Math.random() * 50 });
        }
        
        await humanDelay(500, 800);
        
        // Send the message (Enter key)
        await page.keyboard.press('Enter');
        await humanDelay(1500, 2500);
        
        // Update contact state
        await prisma.messengerContact.update({
          where: { id: contact.id },
          data: {
            state: ConversationStateEnum.WAITING,
            previousState: ConversationStateEnum.NEEDS_REPLY,
            stateChangedAt: new Date(),
            lastOurReply: replyText,
            lastOurReplyAt: new Date(),
            lastActivityAt: new Date(),
            ourMessageCount: { increment: 1 },
            totalMessageCount: { increment: 1 },
          },
        });
        
        // Update lead status if linked
        if (contact.leadId) {
          await updateLeadStatus(contact.leadId, 'dm_sent');
          await updateLeadStageFromConversation(contact.id, contact.leadId, ConversationStateEnum.WAITING, null, log);
        }
        
        log(`     ✅ Reply sent!`);
        repliesSent++;
        
        // Add delay between replies
        await humanDelay(5000, 10000);
        
      } catch (err) {
        errors.push(`Error replying to ${contact.contactName}: ${err}`);
        log(`     ❌ Error: ${err}`);
      }
    }
    
    const activeCount = await prisma.messengerContact.count({ where: { accountId, status: ContactStatus.ACTIVE } });
    const oldCount = await prisma.messengerContact.count({ where: { accountId, status: ContactStatus.OLD } });
    const needsReply = await prisma.messengerContact.count({ 
      where: { accountId, status: ContactStatus.ACTIVE, state: ConversationStateEnum.NEEDS_REPLY } 
    });
    
    log(`✅ REPLY complete: ${repliesSent} replies sent`);
    
    return {
      success: errors.length === 0,
      action: 'reply',
      stats: { totalActive: activeCount, totalOld: oldCount, needsReply, new: 0, returning: repliesSent },
      logs,
      errors,
    };
  } finally {
    await cleanup();
  }
}

/**
 * Extract recent messages from current conversation view
 */
async function extractRecentMessages(page: Page, contactName: string): Promise<Array<{ sender: 'them' | 'us'; text: string }>> {
  return await page.evaluate(({ contactName }: { contactName: string }) => {
    const messages: Array<{ sender: 'them' | 'us'; text: string }> = [];
    const seenTexts = new Set<string>();
    const contactFirstName = contactName.split(' ')[0].toLowerCase();
    const contactNameLower = contactName.toLowerCase();
    
    const main = document.querySelector('[role="main"]');
    if (!main) return messages;
    
    const rows = main.querySelectorAll('[role="row"]');
    
    for (const row of rows) {
      const presentations = row.querySelectorAll('[role="presentation"]');
      
      for (const pres of presentations) {
        const textEls = pres.querySelectorAll('[dir="auto"]');
        
        for (const el of textEls) {
          const htmlEl = el as HTMLElement;
          const text = htmlEl.textContent?.trim() || '';
          const lowerText = text.toLowerCase();
          
          if (!text || text.length < 2 || text.length > 2000) continue;
          if (seenTexts.has(text)) continue;
          if (/^\d{1,2}:\d{2}/.test(text)) continue;
          if (/yesterday|today|monday|tuesday/i.test(text)) continue;
          if (lowerText === contactNameLower || lowerText === contactFirstName) continue;
          if (lowerText === 'enter' || lowerText.includes('end-to-end')) continue;
          
          const style = window.getComputedStyle(htmlEl);
          const lineHeight = parseFloat(style.lineHeight);
          if (lineHeight < 19.9 || lineHeight > 20.0) continue;
          
          const parent = htmlEl.parentElement;
          const parentStyle = parent ? window.getComputedStyle(parent) : null;
          const bgColor = parentStyle ? parentStyle.backgroundColor : '';
          const isTheirs = bgColor.includes('48, 48, 48') || bgColor.includes('58, 58, 58');
          
          seenTexts.add(text);
          messages.push({ sender: isTheirs ? 'them' : 'us', text });
          break;
        }
      }
    }
    
    // Return last 10 messages
    return messages.slice(-10);
  }, { contactName });
}

// ============================================
// API ROUTES
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const status = searchParams.get('status'); // ACTIVE, OLD, all
    const state = searchParams.get('state');   // NEEDS_REPLY, WAITING, etc
    
    if (!accountId) {
      return NextResponse.json({ error: 'accountId required' }, { status: 400 });
    }
    
    const where: any = { accountId };
    if (status && status !== 'all') where.status = status;
    if (state) where.state = state;
    
    const contacts = await prisma.messengerContact.findMany({
      where,
      orderBy: { lastActivityAt: 'desc' },
    });
    
    const config = await getOrCreateConfig(accountId);
    
    const summary = {
      total: contacts.length,
      active: contacts.filter((c: MessengerContact) => c.status === ContactStatus.ACTIVE).length,
      old: contacts.filter((c: MessengerContact) => c.status === ContactStatus.OLD).length,
      needsReply: contacts.filter((c: MessengerContact) => c.state === ConversationStateEnum.NEEDS_REPLY).length,
      waiting: contacts.filter((c: MessengerContact) => c.state === ConversationStateEnum.WAITING).length,
    };
    
    return NextResponse.json({ contacts, summary, config });
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountId, action } = body;
    
    if (!accountId) {
      return NextResponse.json({ error: 'accountId required' }, { status: 400 });
    }
    
    if (!action) {
      return NextResponse.json({ error: 'action required (init, scan, maintenance, reply)' }, { status: 400 });
    }
    
    const logs: string[] = [];
    let result: ActionResult;
    
    switch (action) {
      case 'init':
        result = await initAction(accountId, logs);
        break;
      case 'scan':
        result = await scanAction(accountId, logs);
        break;
      case 'maintenance':
        result = await maintenanceAction(accountId, logs);
        break;
      case 'reply':
        const maxReplies = body.maxReplies || 3;
        result = await replyAction(accountId, logs, maxReplies);
        break;
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json({ 
      success: false,
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
