// Agent 3: Message Agent
// Monitors Messenger, generates AI replies, extracts contact info, updates lead stages
// Runs continuously until idle timeout - no cycle limit
// NOW WITH LEAD CONTEXT: Gets original post context for better AI replies

import {
  BrowserSession,
  MessageAgentResult,
  ConversationHandled,
  Message,
} from "./types";
import {
  launchBrowser,
  warmupSession,
  closeBrowser,
  navigateToMessenger,
  checkInbox,
  clickFirstUnread,
  readConversation,
  sendReply,
  generateAIReplyWithContext,
  shouldEndConversation,
  cleanAIReply,
  extractContactInfo,
  getConversationHash,
  hasNewTheirMessage,
  detectInterest,
  humanDelay,
  shortDelay,
} from "./procedures";
import type { AIReplyResult, PostContext } from "./procedures";
import { shouldAgentRun } from "@/lib/schedule-service";
import { prisma } from "@/lib/db";
import { LeadStage, ConversationStateEnum } from "@prisma/client";

export interface MessageAgentInput {
  accountId: string;
  headless?: boolean;
  idleTimeoutMs?: number; // Exit after this many ms with no activity (default 2 min)
  skipScheduleCheck?: boolean; // For testing
}

export async function runMessageAgent(
  input: MessageAgentInput,
  onLog?: (msg: string) => void
): Promise<MessageAgentResult> {
  const logs: string[] = [];
  const errors: string[] = [];
  const startedAt = new Date();
  const conversationsHandled: ConversationHandled[] = [];

  // Track conversation states: contactName -> { hash, ended }
  const conversationStates = new Map<string, { hash: string; ended: boolean }>();

  // Track current conversation we're monitoring
  let currentConvoName: string | null = null;

  const log = (msg: string) => {
    const timestamp = new Date().toISOString();
    const logMsg = `[${timestamp}] ${msg}`;
    logs.push(logMsg);
    console.log(`[MessageAgent] ${msg}`);
    onLog?.(msg);
  };

  // Check schedule (unless skipped for testing)
  if (!input.skipScheduleCheck) {
    const scheduleCheck = await shouldAgentRun("MESSAGE_AGENT");
    if (!scheduleCheck.shouldRun) {
      log(`⏸️ Skipping: ${scheduleCheck.reason}`);
      return {
        success: true,
        agentType: "MESSAGE_AGENT",
        startedAt,
        completedAt: new Date(),
        duration: 0,
        logs,
        errors,
        stats: {
          cyclesCompleted: 0,
          conversationsProcessed: 0,
          repliesSent: 0,
          contactsExtracted: 0,
          stageUpdates: 0,
        },
        conversationsHandled: [],
        stoppedReason: "manual_stop",
      };
    }
    log(`✅ Schedule check: ${scheduleCheck.reason}`);
  }

  log("🚀 Starting Message Agent");
  log(`👤 Account: ${input.accountId}`);

  let session: BrowserSession | null = null;
  let stoppedReason: MessageAgentResult["stoppedReason"] = "no_activity_timeout";
  let running = true;

  const stats = {
    cyclesCompleted: 0,
    conversationsProcessed: 0,
    repliesSent: 0,
    contactsExtracted: 0,
    stageUpdates: 0,
  };

  const idleTimeoutMs = input.idleTimeoutMs ?? 120000; // 2 minutes default
  let lastActivityTime = Date.now();

  try {
    // P1: Launch browser
    log("🌐 Launching browser...");
    session = await launchBrowser({
      accountId: input.accountId,
      headless: input.headless ?? false,
    });

    // Warmup session
    const isLoggedIn = await warmupSession(session.page, log);
    if (!isLoggedIn) {
      throw new Error("Account is not logged in");
    }

    // Navigate to Messenger
    const onMessenger = await navigateToMessenger(session.page, log);
    if (!onMessenger) {
      throw new Error("Failed to navigate to Messenger");
    }

    // ============== MAIN LOOP - runs until timeout ==============
    while (running) {
      stats.cyclesCompleted++;

      // Check if browser is still alive
      try {
        await session.page.evaluate(() => true);
      } catch {
        log("❌ Browser closed");
        stoppedReason = "browser_closed";
        break;
      }

      // Check idle timeout
      const timeSinceActivity = Date.now() - lastActivityTime;
      if (timeSinceActivity >= idleTimeoutMs) {
        log(`⏰ No activity for ${Math.round(idleTimeoutMs / 1000)}s - stopping agent`);
        stoppedReason = "no_activity_timeout";
        break;
      }

      // ============== STEP 1: CHECK IF WE'RE IN A CONVERSATION ==============
      const currentUrl = session.page.url();
      const inConversation = currentUrl.includes('/messages/t/') && !currentUrl.endsWith('/messages/t/');

      if (inConversation && currentConvoName) {
        // We're in a conversation - check for new messages
        const conversation = await readConversation(session.page, log);
        
        if (conversation) {
          const currentHash = getConversationHash(conversation.messages);
          const inMemoryState = conversationStates.get(conversation.contactName);
          
          // Also get DB state for persistent cross-session detection
          const dbState = await getSavedContactState(input.accountId, conversation.contactName);
          
          // Check if last message is from them using both in-memory AND DB state
          const lastMessage = conversation.messages[conversation.messages.length - 1];
          
          // Use count-based comparison for efficiency
          const countCheck = hasConversationChanged(dbState, conversation.messages);
          const hashDifferent = !inMemoryState || inMemoryState.hash !== currentHash;
          const hasNewMessage = lastMessage?.sender === 'them' && 
                                (countCheck.newTheirMessage || hashDifferent);
          
          // Check if conversation is ended (from either memory or DB)
          const isEnded = inMemoryState?.ended || dbState?.conversationEnded;
          
          if (isEnded && !hasNewMessage) {
            // Conversation ended, no new message - wait
            const waitSecs = Math.floor(timeSinceActivity / 1000);
            log(`⏳ Conversation with ${conversation.contactName} ended (${waitSecs}s / ${Math.round(idleTimeoutMs / 1000)}s)`);
          } else if (!countCheck.changed && inMemoryState?.hash === currentHash) {
            // No change in counts or hash, waiting for reply
            const waitSecs = Math.floor(timeSinceActivity / 1000);
            log(`⏳ Waiting for reply from ${conversation.contactName}... (${waitSecs}s / ${Math.round(idleTimeoutMs / 1000)}s)`);
          } else if (hasNewMessage) {
            // NEW MESSAGE DETECTED!
            log(`🆕 New message from ${conversation.contactName}: "${lastMessage.text}"`);
            log(`   (Detected via: ${countCheck.newTheirMessage ? 'count increase' : 'hash change'})`);
            lastActivityTime = Date.now(); // Reset activity timer
            stats.conversationsProcessed++;

            // Collect ALL new messages (handle rapid multiple messages)
            await collectAllNewMessages(session.page, conversation, inMemoryState?.hash || '', log);
            
            // Re-read conversation to get all messages
            const updatedConvo = await readConversation(session.page, log);
            const convoToProcess = updatedConvo || conversation;

            // Get lead context for better AI replies
            const postContext = await getLeadContext(
              input.accountId,
              convoToProcess.contactName,
              log
            );

            // Generate AI reply with tool calling AND lead context
            const aiResult = await generateAIReplyWithContext(
              convoToProcess.contactName,
              convoToProcess.messages,
              postContext,
              log
            );

            // Handle AI tool calls for stage updates
            const conversationUrl = session.page.url();
            if (aiResult.toolCalls.updateStage) {
              const { stage, reason, contactInfo } = aiResult.toolCalls.updateStage;
              log(`🎯 AI detected stage update: ${stage} - ${reason}`);
              await handleAIStageUpdate(
                input.accountId,
                convoToProcess.contactName,
                conversationUrl,
                stage,
                contactInfo,
                convoToProcess.messages,
                log,
                stats
              );
            }

            // Check for end conversation (via tool call or marker)
            const shouldEnd = aiResult.toolCalls.endConversation || shouldEndConversation(aiResult.reply);
            
            if (shouldEnd) {
              log(`🏁 AI wants to end conversation with ${convoToProcess.contactName}`);
              
              const cleanedReply = cleanAIReply(aiResult.reply);
              if (cleanedReply.length > 0) {
                log(`📤 Sending final message...`);
                await sendReply(session.page, cleanedReply, log);
                stats.repliesSent++;
              }
              
              conversationStates.set(convoToProcess.contactName, { hash: currentHash, ended: true });
              
              // Mark conversation as ended in database
              await markConversationEnded(
                input.accountId,
                convoToProcess.contactName,
                aiResult.toolCalls.endConversation?.reason || 'ai_ended',
                log
              );
              
              conversationsHandled.push({
                contactName: convoToProcess.contactName,
                messagesRead: convoToProcess.messages.length,
                replySent: cleanedReply.length > 0,
                replyText: cleanedReply,
                stageUpdated: "ENDED",
              });
              
              log(`✅ Conversation ended. Checking for other unread...`);
            } else {
              // Send the reply with pre-send check
              const sendResult = await sendReplyWithCheck(session.page, aiResult.reply, convoToProcess, log);
              
              if (sendResult.sent) {
                stats.repliesSent++;
                
                // Update hash after sending
                const afterSendConvo = await readConversation(session.page, log);
                if (afterSendConvo) {
                  const newHash = getConversationHash(afterSendConvo.messages);
                  conversationStates.set(convoToProcess.contactName, { hash: newHash, ended: false });
                }
                
                // Stage already updated via AI tool call, just get the result for logging
                const stageUpdated = aiResult.toolCalls.updateStage?.stage;
                
                conversationsHandled.push({
                  contactName: convoToProcess.contactName,
                  messagesRead: convoToProcess.messages.length,
                  replySent: true,
                  replyText: aiResult.reply,
                  stageUpdated: stageUpdated,
                  extractedPhone: aiResult.toolCalls.updateStage?.stage === 'CTA_PHONE' ? aiResult.toolCalls.updateStage.contactInfo : undefined,
                  extractedWhatsApp: aiResult.toolCalls.updateStage?.stage === 'CTA_WHATSAPP' ? aiResult.toolCalls.updateStage.contactInfo : undefined,
                });
              } else if (sendResult.newMessagesDetected) {
                log(`🔄 New messages detected while sending - will process next loop`);
              }
            }
          } else if (lastMessage?.sender === 'us') {
            // Last message is from us, update hash and wait
            conversationStates.set(conversation.contactName, { 
              hash: currentHash, 
              ended: inMemoryState?.ended || dbState?.conversationEnded || false 
            });
            const waitSecs = Math.floor(timeSinceActivity / 1000);
            log(`⏳ Our last message sent. Waiting for reply... (${waitSecs}s / ${Math.round(idleTimeoutMs / 1000)}s)`);
          }
        }
      }

      // ============== STEP 2: CHECK UNREAD TAB ==============
      const inbox = await checkInbox(session.page, log);
      
      if (inbox.hasUnread) {
        log(`📬 Found ${inbox.unreadCount} unread conversation(s): ${inbox.conversationNames.join(', ')}`);
        lastActivityTime = Date.now(); // Reset activity timer
        
        // Click on first unread
        const firstUnread = inbox.conversationNames[0];
        const clickResult = await clickFirstUnread(session.page, log, firstUnread);
        
        if (clickResult.clicked) {
          currentConvoName = clickResult.contactName || firstUnread;
          log(`📨 Opened conversation with ${currentConvoName}`);
          
          // Read and process immediately
          const conversation = await readConversation(session.page, log);
          if (conversation) {
            stats.conversationsProcessed++;
            
            // Get lead context for better AI replies
            const postContext = await getLeadContext(
              input.accountId,
              conversation.contactName,
              log
            );

            // Generate AI reply with tool calling AND lead context
            const aiResult = await generateAIReplyWithContext(
              conversation.contactName,
              conversation.messages,
              postContext,
              log
            );

            // Handle AI tool calls for stage updates
            const conversationUrl = session.page.url();
            if (aiResult.toolCalls.updateStage) {
              const { stage, reason, contactInfo } = aiResult.toolCalls.updateStage;
              log(`🎯 AI detected stage update: ${stage} - ${reason}`);
              await handleAIStageUpdate(
                input.accountId,
                conversation.contactName,
                conversationUrl,
                stage,
                contactInfo,
                conversation.messages,
                log,
                stats
              );
            }

            // Check for end conversation (via tool call or marker)
            const shouldEnd = aiResult.toolCalls.endConversation || shouldEndConversation(aiResult.reply);
            
            if (shouldEnd) {
              log(`🏁 AI wants to end conversation`);
              const cleanedReply = cleanAIReply(aiResult.reply);
              if (cleanedReply.length > 0) {
                await sendReply(session.page, cleanedReply, log);
                stats.repliesSent++;
              }
              
              const currentHash = getConversationHash(conversation.messages);
              conversationStates.set(conversation.contactName, { hash: currentHash, ended: true });
              
              // Mark conversation as ended in database
              await markConversationEnded(
                input.accountId,
                conversation.contactName,
                aiResult.toolCalls.endConversation?.reason || 'ai_ended',
                log
              );
              
              conversationsHandled.push({
                contactName: conversation.contactName,
                messagesRead: conversation.messages.length,
                replySent: cleanedReply.length > 0,
                replyText: cleanedReply,
                stageUpdated: "ENDED",
              });
            } else {
              // Send reply
              const sent = await sendReply(session.page, aiResult.reply, log);
              if (sent) {
                stats.repliesSent++;
                
                // Update hash
                const updatedConvo = await readConversation(session.page, log);
                if (updatedConvo) {
                  const newHash = getConversationHash(updatedConvo.messages);
                  conversationStates.set(conversation.contactName, { hash: newHash, ended: false });
                }
                
                // Stage already updated via AI tool call
                const stageUpdated = aiResult.toolCalls.updateStage?.stage;
                
                conversationsHandled.push({
                  contactName: conversation.contactName,
                  messagesRead: conversation.messages.length,
                  replySent: true,
                  replyText: aiResult.reply,
                  stageUpdated: stageUpdated,
                  extractedPhone: aiResult.toolCalls.updateStage?.stage === 'CTA_PHONE' ? aiResult.toolCalls.updateStage.contactInfo : undefined,
                  extractedWhatsApp: aiResult.toolCalls.updateStage?.stage === 'CTA_WHATSAPP' ? aiResult.toolCalls.updateStage.contactInfo : undefined,
                });
              }
            }
          }
        }
      } else {
        // No unread - log status
        const waitSecs = Math.floor(timeSinceActivity / 1000);
        if (currentConvoName) {
          log(`📭 No unread. Monitoring ${currentConvoName} (${waitSecs}s / ${Math.round(idleTimeoutMs / 1000)}s)`);
        } else {
          log(`📭 No unread conversations (${waitSecs}s / ${Math.round(idleTimeoutMs / 1000)}s)`);
        }
      }

      // Short delay before next loop
      await humanDelay(3000, 5000);
    }

    const completedAt = new Date();

    return {
      success: true,
      agentType: "MESSAGE_AGENT",
      startedAt,
      completedAt,
      duration: completedAt.getTime() - startedAt.getTime(),
      logs,
      errors,
      stats,
      conversationsHandled,
      stoppedReason,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log(`❌ Fatal error: ${errorMsg}`);
    errors.push(errorMsg);

    const completedAt = new Date();

    return {
      success: false,
      agentType: "MESSAGE_AGENT",
      startedAt,
      completedAt,
      duration: completedAt.getTime() - startedAt.getTime(),
      logs,
      errors,
      stats,
      conversationsHandled,
      stoppedReason: "error",
    };
  } finally {
    if (session) {
      log("🔒 Closing browser...");
      await closeBrowser(session);
    }
    log("🏁 Message Agent completed");
  }
}

// Helper: Collect ALL new messages (handles rapid multiple messages)
async function collectAllNewMessages(
  page: BrowserSession["page"],
  conversation: { contactName: string; messages: Message[] },
  previousHash: string,
  log: (msg: string) => void
): Promise<Message[]> {
  const existingTexts = new Set(conversation.messages.map(m => m.text));
  const newMessages: Message[] = [];
  
  // Keep checking for 1.5 seconds to catch rapid messages
  let stableChecks = 0;
  const maxStableChecks = 3;
  
  while (stableChecks < maxStableChecks) {
    await new Promise(r => setTimeout(r, 500));
    
    // Re-read conversation
    const updated = await readConversation(page, () => {});
    
    if (updated) {
      let foundNew = false;
      for (const msg of updated.messages) {
        if (msg.sender === 'them' && !existingTexts.has(msg.text)) {
          newMessages.push(msg);
          existingTexts.add(msg.text);
          log(`📥 Collected new message: "${msg.text}"`);
          foundNew = true;
        }
      }
      
      if (!foundNew) {
        stableChecks++;
      } else {
        stableChecks = 0;
      }
    }
  }
  
  return newMessages;
}

// Helper: Send reply with pre-send check for new messages
async function sendReplyWithCheck(
  page: BrowserSession["page"],
  replyText: string,
  conversation: { contactName: string; messages: Message[] },
  log: (msg: string) => void
): Promise<{ sent: boolean; newMessagesDetected: boolean }> {
  const existingTexts = new Set(conversation.messages.map(m => m.text));
  
  // Check for new messages BEFORE sending
  const preCheck = await readConversation(page, () => {});
  
  if (preCheck) {
    for (const msg of preCheck.messages) {
      if (msg.sender === 'them' && !existingTexts.has(msg.text)) {
        log(`⚠️ New message detected before sending! Aborting send.`);
        return { sent: false, newMessagesDetected: true };
      }
    }
  }
  
  // Send the message
  const sent = await sendReply(page, replyText, log);
  
  return { sent, newMessagesDetected: false };
}

// Helper: Process contact info from messages (async for DB operations)
async function processContactInfo(
  accountId: string,
  contactName: string,
  conversationUrl: string,
  messages: Message[],
  log: (msg: string) => void,
  stats: { contactsExtracted: number; stageUpdates: number }
): Promise<{ extractedPhone?: string; extractedWhatsApp?: string; stageUpdated?: string }> {
  let extractedPhone: string | undefined;
  let extractedWhatsApp: string | undefined;
  let stageUpdated: string | undefined;
  let contactInfo: string | undefined;

  for (const msg of messages) {
    if (msg.sender === "them") {
      const extracted = extractContactInfo(msg.text);
      if (extracted.phone) {
        extractedPhone = extracted.phone;
        stageUpdated = "CTA_PHONE";
        contactInfo = extracted.phone;
        stats.contactsExtracted++;
        log(`📞 Extracted phone: ${extractedPhone}`);
      }
      if (extracted.whatsapp) {
        extractedWhatsApp = extracted.whatsapp;
        stageUpdated = "CTA_WHATSAPP";
        contactInfo = extracted.whatsapp;
        stats.contactsExtracted++;
        log(`💬 Extracted WhatsApp: ${extractedWhatsApp}`);
      }
    }
  }

  // Detect interest
  if (!stageUpdated && detectInterest(messages)) {
    stageUpdated = "INTERESTED";
    stats.stageUpdates++;
  }

  // Update database if we have a stage update
  if (stageUpdated) {
    await updateContactAndLeadStage(
      accountId,
      contactName,
      conversationUrl,
      stageUpdated as LeadStage,
      contactInfo,
      messages,
      log
    );
  }

  return { extractedPhone, extractedWhatsApp, stageUpdated };
}

// ============================================
// AI TOOL CALL HANDLER
// ============================================

/**
 * Handle stage updates from AI tool calls
 * This is called when the AI uses the updateLeadStage tool
 */
async function handleAIStageUpdate(
  accountId: string,
  contactName: string,
  conversationUrl: string,
  stage: 'INTERESTED' | 'CTA_WHATSAPP' | 'CTA_PHONE' | 'CONVERTED' | 'LOST',
  contactInfo: string | undefined,
  messages: Message[],
  log: (msg: string) => void,
  stats: { contactsExtracted: number; stageUpdates: number }
): Promise<void> {
  // Track stats
  if (contactInfo) {
    stats.contactsExtracted++;
  }
  stats.stageUpdates++;

  // Update database
  await updateContactAndLeadStage(
    accountId,
    contactName,
    conversationUrl,
    stage as LeadStage,
    contactInfo,
    messages,
    log
  );
}

// ============================================
// GET SAVED CONTACT STATE (DB-based)
// ============================================

interface SavedContactState {
  theirMessageCount: number;
  ourMessageCount: number;
  lastTheirMessage: string | null;
  conversationEnded: boolean;
  state: ConversationStateEnum | null;
}

/**
 * Get saved state from database for efficient change detection
 * This allows detecting new messages without full re-read
 */
async function getSavedContactState(
  accountId: string,
  contactName: string
): Promise<SavedContactState | null> {
  try {
    const contact = await prisma.messengerContact.findUnique({
      where: {
        accountId_contactName: {
          accountId,
          contactName,
        },
      },
      select: {
        theirMessageCount: true,
        ourMessageCount: true,
        lastTheirMessage: true,
        conversationEnded: true,
        state: true,
      },
    });

    if (!contact) return null;

    return {
      theirMessageCount: contact.theirMessageCount,
      ourMessageCount: contact.ourMessageCount,
      lastTheirMessage: contact.lastTheirMessage,
      conversationEnded: contact.conversationEnded,
      state: contact.state,
    };
  } catch {
    return null;
  }
}

/**
 * Quick check if conversation has new messages by comparing counts
 * No need to read all messages - just compare stored vs current counts
 */
function hasConversationChanged(
  savedState: SavedContactState | null,
  currentMessages: Message[]
): { changed: boolean; newTheirMessage: boolean } {
  if (!savedState) {
    // No saved state - consider it changed if there are any their messages
    const theirMsgs = currentMessages.filter(m => m.sender === 'them');
    return { changed: true, newTheirMessage: theirMsgs.length > 0 };
  }

  const currentTheirCount = currentMessages.filter(m => m.sender === 'them').length;
  const currentOurCount = currentMessages.filter(m => m.sender === 'us').length;

  // If their count increased, they sent a new message
  const newTheirMessage = currentTheirCount > savedState.theirMessageCount;
  
  // Check if our count increased (we sent a message)
  const newOurMessage = currentOurCount > savedState.ourMessageCount;

  // Also compare last message text for reliability
  const lastTheirMsg = currentMessages.filter(m => m.sender === 'them').pop();
  const lastMsgDifferent = lastTheirMsg && 
    savedState.lastTheirMessage !== null && 
    !savedState.lastTheirMessage.startsWith(lastTheirMsg.text.substring(0, 50));

  return {
    changed: newTheirMessage || newOurMessage || !!lastMsgDifferent,
    newTheirMessage: newTheirMessage || !!lastMsgDifferent,
  };
}

// ============================================
// LEAD CONTEXT LOOKUP
// ============================================

/**
 * Get the original post context for a contact
 * This allows the AI to have full context of what the lead originally wanted
 */
async function getLeadContext(
  accountId: string,
  contactName: string,
  log: (msg: string) => void
): Promise<PostContext | null> {
  try {
    // Find the MessengerContact
    const contact = await prisma.messengerContact.findFirst({
      where: {
        accountId,
        contactName,
      },
      include: {
        lead: {
          include: {
            group: true,
          },
        },
      },
    });

    if (!contact?.lead) {
      log(`ℹ️ No linked lead found for contact "${contactName}"`);
      return null;
    }

    const lead = contact.lead;
    log(`📝 Found lead context: ${lead.matchedService || "Unknown service"}`);

    return {
      postText: lead.postText,
      authorName: lead.authorName || contactName,
      matchedService: lead.matchedService,
      groupName: lead.group.name,
      postedAt: lead.postDate,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log(`⚠️ Error fetching lead context: ${msg}`);
    return null;
  }
}

// ============================================
// DATABASE HELPER FUNCTIONS
// ============================================

/**
 * Find or create a MessengerContact and link it to a Lead by name matching
 */
async function findOrCreateContact(
  accountId: string,
  contactName: string,
  conversationUrl: string,
  log: (msg: string) => void
): Promise<{ contactId: string; leadId: string | null }> {
  // Check if contact already exists
  let contact = await prisma.messengerContact.findUnique({
    where: {
      accountId_contactName: {
        accountId,
        contactName,
      },
    },
    select: { id: true, leadId: true },
  });

  if (contact) {
    return { contactId: contact.id, leadId: contact.leadId };
  }

  // Try to find a matching lead by author name
  const matchingLead = await prisma.lead.findFirst({
    where: {
      authorName: {
        equals: contactName,
        mode: 'insensitive',
      },
      messengerContact: null, // Not already linked
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, authorName: true },
  });

  // Create new contact
  contact = await prisma.messengerContact.create({
    data: {
      accountId,
      contactName,
      conversationUrl,
      leadId: matchingLead?.id || null,
      status: 'ACTIVE',
      state: 'ACTIVE',
      lastActivityAt: new Date(),
    },
    select: { id: true, leadId: true },
  });

  if (matchingLead) {
    log(`🔗 Linked contact "${contactName}" to lead "${matchingLead.authorName}"`);
  } else {
    log(`📇 Created new contact "${contactName}" (no matching lead found)`);
  }

  return { contactId: contact.id, leadId: contact.leadId };
}

/**
 * Update MessengerContact state and linked Lead stage
 */
async function updateContactAndLeadStage(
  accountId: string,
  contactName: string,
  conversationUrl: string,
  newStage: LeadStage,
  contactInfo: string | undefined,
  messages: Message[],
  log: (msg: string) => void
): Promise<void> {
  try {
    // Find or create the contact
    const { contactId, leadId } = await findOrCreateContact(
      accountId,
      contactName,
      conversationUrl,
      log
    );

    // Get last messages for storage
    const theirMessages = messages.filter(m => m.sender === 'them');
    const ourMessages = messages.filter(m => m.sender === 'us');
    const lastTheirMessage = theirMessages[theirMessages.length - 1]?.text;
    const lastOurReply = ourMessages[ourMessages.length - 1]?.text;

    // Update the contact with message counts and last messages
    await prisma.messengerContact.update({
      where: { id: contactId },
      data: {
        leadStage: newStage,
        leadStageUpdatedAt: new Date(),
        state: 'ACTIVE',
        stateChangedAt: new Date(),
        totalMessageCount: messages.length,
        theirMessageCount: theirMessages.length,
        ourMessageCount: ourMessages.length,
        lastTheirMessage: lastTheirMessage?.substring(0, 500),
        lastTheirMessageAt: lastTheirMessage ? new Date() : undefined,
        lastOurReply: lastOurReply?.substring(0, 500),
        lastOurReplyAt: lastOurReply ? new Date() : undefined,
        lastActivityAt: new Date(),
        lastCheckedAt: new Date(),
      },
    });

    log(`📊 Updated contact "${contactName}" - Stage: ${newStage}, Messages: ${messages.length}`);

    // If linked to a lead, update the lead stage too
    if (leadId) {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true, stage: true },
      });

      if (lead) {
        // Define stage progression order
        const stageOrder: LeadStage[] = [
          'LEAD',
          'INTERESTED',
          'CTA_WHATSAPP',
          'CTA_PHONE',
          'CONVERTED',
          'LOST'
        ];

        const currentIndex = stageOrder.indexOf(lead.stage);
        const newIndex = stageOrder.indexOf(newStage);

        // Only update if progressing forward (or to LOST/CONVERTED)
        const shouldUpdate = 
          newIndex > currentIndex || 
          newStage === 'LOST' || 
          newStage === 'CONVERTED';

        if (shouldUpdate) {
          await prisma.lead.update({
            where: { id: leadId },
            data: {
              stage: newStage,
              stageUpdatedAt: new Date(),
              ...(contactInfo && { contactInfo }),
            },
          });

          log(`🎯 Updated lead stage: ${lead.stage} → ${newStage}`);
        } else {
          log(`ℹ️ Lead stage not updated (${lead.stage} → ${newStage} would be regression)`);
        }
      }
    } else {
      log(`⚠️ No linked lead for contact "${contactName}" - stage saved only on contact`);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log(`❌ Database error updating stage: ${msg}`);
  }
}

/**
 * Mark a conversation as ended in the database
 */
async function markConversationEnded(
  accountId: string,
  contactName: string,
  reason: string,
  log: (msg: string) => void
): Promise<void> {
  try {
    await prisma.messengerContact.updateMany({
      where: {
        accountId,
        contactName,
      },
      data: {
        state: 'ENDED',
        conversationEnded: true,
        endReason: reason,
        stateChangedAt: new Date(),
      },
    });
    log(`🏁 Marked conversation with "${contactName}" as ended: ${reason}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log(`❌ Database error marking conversation ended: ${msg}`);
  }
}