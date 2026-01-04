// Initiator Agent
// Engages with leads by commenting on posts and sending initial DMs
// Creates MessengerContact records linked directly to Leads

import { BrowserSession } from "./types";
import {
  launchBrowser,
  warmupSession,
  closeBrowser,
  humanDelay,
} from "./procedures";
import { commentOnPost, CommentResult } from "./procedures/commenting";
import { sendInitialDM, DMResult } from "./procedures/dm";
import { generatePostComment, generateInitialDM } from "./procedures/ai";
import { shouldAgentRun } from "@/lib/schedule-service";
import { prisma } from "@/lib/db";

// Helper function to create session notifications
async function createSessionNotification(
  accountId: string, 
  type: "SESSION_EXPIRED" | "SESSION_NEEDS_LOGIN" | "ACCOUNT_BANNED" | "AGENT_ERROR",
  message: string
) {
  try {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: { name: true, email: true },
    });

    const accountName = account?.name || account?.email || "Unknown Account";
    
    const notificationData: Record<string, { title: string; severity: "WARNING" | "ERROR" | "CRITICAL"; sessionStatus: string }> = {
      SESSION_EXPIRED: { title: "Session Expired", severity: "WARNING", sessionStatus: "EXPIRED" },
      SESSION_NEEDS_LOGIN: { title: "Re-login Required", severity: "ERROR", sessionStatus: "NEEDS_PASSWORD" },
      ACCOUNT_BANNED: { title: "Account Banned", severity: "CRITICAL", sessionStatus: "BANNED" },
      AGENT_ERROR: { title: "Agent Error", severity: "ERROR", sessionStatus: "ERROR" },
    };

    const config = notificationData[type];
    if (!config) return;

    await prisma.account.update({
      where: { id: accountId },
      data: {
        sessionStatus: config.sessionStatus as any,
        sessionError: message,
        sessionExpiredAt: new Date(),
        isLoggedIn: false,
      },
    });

    await prisma.notification.create({
      data: {
        type: type as any,
        severity: config.severity as any,
        title: `${config.title}: ${accountName}`,
        message,
        accountId,
        actionUrl: "/dashboard/accounts",
        actionLabel: "Fix Account",
      },
    });
    
    console.log(`[Notification] Created: ${config.title} for ${accountName}`);
  } catch (err) {
    console.error("[Notification] Failed to create:", err);
  }
}

export interface InitiatorAgentInput {
  accountId: string;
  maxLeads?: number;
  headless?: boolean;
  commentOnly?: boolean;  // Only comment, don't DM
  dmOnly?: boolean;       // Only DM, don't comment
  skipScheduleCheck?: boolean;
  leadIds?: string[];     // Specific leads to process (optional)
}

export interface InitiatorLeadResult {
  leadId: string;
  postUrl: string;
  authorName: string | null;
  isAnonymous: boolean;
  commented: boolean;
  commentText: string | null;
  commentError?: string;
  dmSent: boolean;
  dmText: string | null;
  dmError?: string;
  messengerContactId: string | null;
  conversationId: string | null;
  conversationUrl: string | null;
}

export interface InitiatorAgentResult {
  success: boolean;
  agentType: "INITIATOR";
  startedAt: Date;
  completedAt: Date;
  duration: number;
  logs: string[];
  errors: string[];
  stats: {
    leadsProcessed: number;
    commentsPosted: number;
    dmsSent: number;
    contactsCreated: number;
    conversationsCreated: number;
  };
  leadResults: InitiatorLeadResult[];
}

// Rate limiting delays (ms) - typed as tuples for spread operator
const DELAYS = {
  betweenLeads: [30000, 60000] as [number, number],   // 30-60s between leads
  afterComment: [10000, 20000] as [number, number],   // 10-20s after commenting
  afterDM: [20000, 40000] as [number, number],        // 20-40s after DM
  beforeDM: [5000, 10000] as [number, number],        // 5-10s before DM
};

export async function runInitiatorAgent(
  input: InitiatorAgentInput,
  onLog?: (msg: string) => void
): Promise<InitiatorAgentResult> {
  const logs: string[] = [];
  const errors: string[] = [];
  const startedAt = new Date();
  const leadResults: InitiatorLeadResult[] = [];

  const log = (msg: string) => {
    const timestamp = new Date().toISOString();
    const logMsg = `[${timestamp}] ${msg}`;
    logs.push(logMsg);
    console.log(`[InitiatorAgent] ${msg}`);
    onLog?.(msg);
  };

  // Check schedule
  if (!input.skipScheduleCheck) {
    const scheduleCheck = await shouldAgentRun("LEAD_GEN");
    if (!scheduleCheck.shouldRun) {
      log(`⏸️ Skipping: ${scheduleCheck.reason}`);
      return {
        success: true,
        agentType: "INITIATOR",
        startedAt,
        completedAt: new Date(),
        duration: 0,
        logs,
        errors,
        stats: {
          leadsProcessed: 0,
          commentsPosted: 0,
          dmsSent: 0,
          contactsCreated: 0,
          conversationsCreated: 0,
        },
        leadResults: [],
      };
    }
    log(`✅ Schedule check: ${scheduleCheck.reason}`);
  }

  log("🚀 Starting Initiator Agent");
  log(`👤 Account: ${input.accountId}`);

  let session: BrowserSession | null = null;
  const maxLeads = input.maxLeads ?? 10;

  const stats = {
    leadsProcessed: 0,
    commentsPosted: 0,
    dmsSent: 0,
    contactsCreated: 0,
    conversationsCreated: 0,
  };

  try {
    // Query leads to process
    log("🔍 Querying NEW leads to process...");
    
    let leads;
    if (input.leadIds && input.leadIds.length > 0) {
      // Process specific leads
      leads = await prisma.lead.findMany({
        where: {
          id: { in: input.leadIds },
        },
        include: {
          group: true,
        },
        take: maxLeads,
      });
    } else {
      // Query NEW leads not yet engaged
      leads = await prisma.lead.findMany({
        where: {
          status: "NEW",
          stage: "LEAD",
          engagedByAccountId: null,
        },
        include: {
          group: true,
        },
        orderBy: { intentScore: "desc" },
        take: maxLeads,
      });
    }

    log(`📋 Found ${leads.length} leads to process`);

    if (leads.length === 0) {
      log("✅ No leads to process");
      const completedAt = new Date();
      return {
        success: true,
        agentType: "INITIATOR",
        startedAt,
        completedAt,
        duration: completedAt.getTime() - startedAt.getTime(),
        logs,
        errors,
        stats,
        leadResults: [],
      };
    }

    // Launch browser
    log("🌐 Launching browser...");
    session = await launchBrowser({
      accountId: input.accountId,
      headless: input.headless ?? false,
    });

    // Warmup session
    const isLoggedIn = await warmupSession(session.page, log);
    if (!isLoggedIn) {
      log("❌ Account is not logged in - creating notification");
      await createSessionNotification(
        input.accountId,
        "SESSION_NEEDS_LOGIN",
        "Facebook session expired. Please re-login manually to continue using this account."
      );
      throw new Error("Account is not logged in");
    }

    // Process each lead
    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      log(`\n📌 Processing lead ${i + 1}/${leads.length}: ${lead.authorName || "Anonymous"}`);
      log(`   Post: ${lead.postUrl}`);
      log(`   Service: ${lead.matchedService || "Unknown"}`);

      const leadResult: InitiatorLeadResult = {
        leadId: lead.id,
        postUrl: lead.postUrl,
        authorName: lead.authorName,
        isAnonymous: lead.isAnonymous,
        commented: false,
        commentText: null,
        dmSent: false,
        dmText: null,
        messengerContactId: null,
        conversationId: null,
        conversationUrl: null,
      };

      try {
        // Step 1: Comment on post (unless dmOnly)
        if (!input.dmOnly) {
          log("💬 Generating comment...");
          const commentText = await generatePostComment(
            lead.postText,
            lead.matchedService,
            log
          );

          log(`📝 Posting comment on ${lead.postUrl}...`);
          const commentResult: CommentResult = await commentOnPost(
            session.page,
            lead.postUrl,
            commentText,
            log
          );

          if (commentResult.success) {
            leadResult.commented = true;
            leadResult.commentText = commentText;
            stats.commentsPosted++;

            // Update lead status
            await prisma.lead.update({
              where: { id: lead.id },
              data: {
                status: "COMMENTED",
                commentedAt: new Date(),
              },
            });

            log(`✅ Comment posted successfully`);
          } else {
            leadResult.commentError = commentResult.error;
            log(`❌ Comment failed: ${commentResult.error}`);
          }

          // Wait after commenting
          await humanDelay(...DELAYS.afterComment);
        }

        // Step 2: Send DM if not anonymous (unless commentOnly)
        // Smart check: if we have a real author name + profile URL, we can DM
        const hasRealAuthor = lead.authorName && 
          lead.authorName !== 'Anonymous' && 
          lead.authorName.trim() !== '' && 
          lead.authorProfileUrl;
        const canDM = hasRealAuthor || (!lead.isAnonymous && lead.authorProfileUrl);
        
        if (!input.commentOnly && canDM) {
          log(`📧 Preparing to DM ${lead.authorName}...`);

          await humanDelay(...DELAYS.beforeDM);

          // Generate initial DM
          log("🧠 Generating initial DM message...");
          const dmText = await generateInitialDM(
            lead.authorName || "صديق",
            lead.postText,
            lead.matchedService,
            log
          );

          log(`📤 Sending DM to ${lead.authorProfileUrl}...`);
          const dmResult: DMResult = await sendInitialDM(
            session.page,
            lead.authorProfileUrl,
            dmText,
            log
          );

          if (dmResult.success) {
            leadResult.dmSent = true;
            leadResult.dmText = dmText;
            leadResult.conversationUrl = dmResult.conversationUrl;
            stats.dmsSent++;

            log(`✅ DM sent successfully`);

            // Create MessengerContact LINKED to Lead
            try {
              const contact = await prisma.messengerContact.create({
                data: {
                  accountId: input.accountId,
                  contactName: dmResult.contactName || lead.authorName || "Unknown",
                  conversationUrl: dmResult.conversationUrl || "",
                  leadId: lead.id, // DIRECT LINK!
                  status: "ACTIVE",
                  state: "WAITING",
                  lastActivityAt: new Date(),
                },
              });

              leadResult.messengerContactId = contact.id;
              stats.contactsCreated++;
              log(`📇 Created MessengerContact: ${contact.id}`);
            } catch (contactError) {
              // Handle duplicate contact
              if (
                contactError instanceof Error &&
                contactError.message.includes("Unique constraint")
              ) {
                log(`⚠️ Contact already exists, updating...`);
                const existing = await prisma.messengerContact.findFirst({
                  where: {
                    accountId: input.accountId,
                    contactName: dmResult.contactName || lead.authorName || "",
                  },
                });
                if (existing) {
                  leadResult.messengerContactId = existing.id;
                  // Update leadId if not set
                  if (!existing.leadId) {
                    await prisma.messengerContact.update({
                      where: { id: existing.id },
                      data: { leadId: lead.id },
                    });
                  }
                }
              } else {
                log(`❌ Error creating contact: ${contactError}`);
              }
            }

            // Create Conversation record
            try {
              const conversation = await prisma.conversation.create({
                data: {
                  leadId: lead.id,
                  accountId: input.accountId,
                  initialDmText: dmText,
                  initialDmSentAt: new Date(),
                  messageHistory: [
                    {
                      sender: "us",
                      text: dmText,
                      timestamp: new Date().toISOString(),
                    },
                  ],
                },
              });

              leadResult.conversationId = conversation.id;
              stats.conversationsCreated++;
              log(`💬 Created Conversation: ${conversation.id}`);
            } catch (convoError) {
              if (
                convoError instanceof Error &&
                convoError.message.includes("Unique constraint")
              ) {
                log(`⚠️ Conversation already exists for this lead`);
              } else {
                log(`❌ Error creating conversation: ${convoError}`);
              }
            }

            // Update lead status
            await prisma.lead.update({
              where: { id: lead.id },
              data: {
                status: "DM_SENT",
                engagedByAccountId: input.accountId,
                initialDmSentAt: new Date(),
              },
            });
          } else {
            leadResult.dmError = dmResult.error;
            log(`❌ DM failed: ${dmResult.error}`);
          }

          // Wait after DM
          await humanDelay(...DELAYS.afterDM);
        } else if (lead.isAnonymous) {
          log(`⏭️ Skipping DM - author is anonymous`);
        } else if (!lead.authorProfileUrl) {
          log(`⏭️ Skipping DM - no author profile URL`);
        }

        stats.leadsProcessed++;
        leadResults.push(leadResult);

        // Wait between leads
        if (i < leads.length - 1) {
          log("⏳ Waiting before next lead...");
          await humanDelay(...DELAYS.betweenLeads);
        }
      } catch (leadError) {
        const errorMsg =
          leadError instanceof Error ? leadError.message : String(leadError);
        log(`❌ Error processing lead ${lead.id}: ${errorMsg}`);
        errors.push(`Lead ${lead.id}: ${errorMsg}`);
        leadResults.push(leadResult);
      }
    }

    const completedAt = new Date();

    log(`\n📊 Initiator Agent Summary:`);
    log(`   Leads processed: ${stats.leadsProcessed}`);
    log(`   Comments posted: ${stats.commentsPosted}`);
    log(`   DMs sent: ${stats.dmsSent}`);
    log(`   Contacts created: ${stats.contactsCreated}`);

    return {
      success: true,
      agentType: "INITIATOR",
      startedAt,
      completedAt,
      duration: completedAt.getTime() - startedAt.getTime(),
      logs,
      errors,
      stats,
      leadResults,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log(`❌ Fatal error: ${errorMsg}`);
    errors.push(errorMsg);

    const completedAt = new Date();

    return {
      success: false,
      agentType: "INITIATOR",
      startedAt,
      completedAt,
      duration: completedAt.getTime() - startedAt.getTime(),
      logs,
      errors,
      stats,
      leadResults,
    };
  } finally {
    if (session) {
      log("🔒 Closing browser...");
      await closeBrowser(session);
    }
    log("🏁 Initiator Agent completed");
  }
}
