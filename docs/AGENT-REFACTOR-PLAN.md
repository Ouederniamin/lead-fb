# Agent Refactor Plan

## Overview

Restructure agents into 3 clear responsibilities:

| Agent | Account | Role | Schedule |
|-------|---------|------|----------|
| **Scraper Agent** | Single dedicated account | Scrapes ALL groups, AI filters leads, saves to DB | Scheduled (hourly/daily) |
| **Initiator Agent** | Multiple accounts | Comments on posts, DMs non-anonymous authors, creates contacts | Scheduled (spread across day) |
| **Message Agent** | Same accounts as Initiator | Monitors Messenger, replies with AI, links conversations to original posts | Continuous monitoring |

---

## Current State vs Target State

### Current Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  First-Time Scraper      Lead Gen Agent        Message Agent        │
│  ─────────────────       ──────────────        ─────────────        │
│  • One-time group init   • Scrapes groups      • Monitors Messenger │
│  • Full scrape           • AI analysis         • AI replies         │
│  • AI analysis           • Creates leads       • Stage detection    │
│  • Creates leads         • (autoComment flag)  • Contact info       │
│                          • (autoDM flag)       • DB updates         │
│                          • NOT IMPLEMENTED     • Links by NAME      │
└─────────────────────────────────────────────────────────────────────┘
```

**Problems:**
1. Lead Gen Agent has `autoComment`/`autoDM` flags but they're NOT implemented
2. No procedure for commenting on posts
3. No procedure for sending initial DMs (only reply DMs)
4. Message Agent links contacts to leads by NAME only (fragile)
5. No way to connect a conversation back to the SPECIFIC POST it originated from

### Target Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    SCRAPER AGENT                              │  │
│  │                    (1 Account)                                │  │
│  │                                                               │  │
│  │   • Scrapes ALL groups on schedule                           │  │
│  │   • Creates GroupPost records for EVERY post                 │  │
│  │   • Runs AI analysis on posts                                │  │
│  │   • Creates Lead records for qualified leads                 │  │
│  │   • Links GroupPost → Lead (1:1)                             │  │
│  │   • Updates Group.lastScrapedPostId                          │  │
│  │                                                               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                              ▼                                      │
│                         [Leads Table]                               │
│                     - stage: LEAD (new)                             │
│                     - postUrl, postText                             │
│                     - authorName, authorFbId                        │
│                     - isAnonymous                                   │
│                              │                                      │
│                              ▼                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                   INITIATOR AGENT                             │  │
│  │               (Multiple Accounts)                             │  │
│  │                                                               │  │
│  │   • Queries leads with stage=LEAD, status=NEW                │  │
│  │   • For each lead:                                           │  │
│  │     1. Navigate to post URL                                  │  │
│  │     2. Post AI-generated comment                             │  │
│  │     3. If NOT anonymous:                                     │  │
│  │        - Navigate to author profile                          │  │
│  │        - Click Message button                                │  │
│  │        - Send initial DM                                     │  │
│  │     4. Update lead: status=COMMENTED or DM_SENT              │  │
│  │     5. Create Conversation record                            │  │
│  │     6. Create MessengerContact record (linked to Lead)       │  │
│  │                                                               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                              ▼                                      │
│              [MessengerContact Table]                               │
│            - leadId → Lead (DIRECT LINK)                            │
│            - accountId → which account sent DM                      │
│            - conversationUrl                                        │
│                              │                                      │
│                              ▼                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    MESSAGE AGENT                              │  │
│  │                (Same as Initiator)                            │  │
│  │                                                               │  │
│  │   • Monitors Messenger for all contacts                      │  │
│  │   • When reply received:                                     │  │
│  │     1. Find MessengerContact by conversationUrl              │  │
│  │     2. Get linked Lead → Get original post context           │  │
│  │     3. Generate AI reply WITH FULL CONTEXT:                  │  │
│  │        - Original post text                                  │  │
│  │        - Matched service                                     │  │
│  │        - Previous conversation                               │  │
│  │     4. Use AI tools to update stage                          │  │
│  │     5. Send reply                                            │  │
│  │                                                               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Database Changes Required

### 1. Enhance Conversation Model

Currently `Conversation` is minimal. Enhance it:

```prisma
model Conversation {
  id              String   @id @default(cuid())
  
  // Link to Lead (required now)
  leadId          String   @map("lead_id")
  lead            Lead     @relation(fields: [leadId], references: [id])
  
  // Link to MessengerContact
  messengerContactId String? @unique @map("messenger_contact_id")
  messengerContact   MessengerContact? @relation(fields: [messengerContactId], references: [id])
  
  // Account that initiated
  accountId       String   @map("account_id")
  
  // Our initial engagement
  commentText     String?  @map("comment_text")
  commentPostedAt DateTime? @map("comment_posted_at")
  initialDmText   String?  @map("initial_dm_text")
  initialDmSentAt DateTime? @map("initial_dm_sent_at")
  
  // Full message history (JSON array)
  messageHistory  Json     @default("[]") @map("message_history")
  
  // Tracking
  leadReplied     Boolean  @default(false) @map("lead_replied")
  replyCount      Int      @default(0) @map("reply_count")
  
  lastActivity    DateTime @default(now()) @map("last_activity")
  createdAt       DateTime @default(now()) @map("created_at")
}
```

### 2. Add Conversation Relation to MessengerContact

```prisma
model MessengerContact {
  // ... existing fields ...
  
  // Add conversation relation
  conversation    Conversation?
}
```

### 3. Track Which Account Engaged Each Lead

Add to Lead model:
```prisma
model Lead {
  // ... existing fields ...
  
  // Engagement tracking
  engagedByAccountId  String?  @map("engaged_by_account_id")
  commentedAt         DateTime? @map("commented_at")
  initialDmSentAt     DateTime? @map("initial_dm_sent_at")
}
```

---

## New Procedures Required

### P10: Comment on Post

**File:** `agents/procedures/commenting.ts`

```typescript
interface CommentResult {
  success: boolean;
  commentText: string;
  error?: string;
}

async function navigateToPost(page: Page, postUrl: string, log: Log): Promise<boolean>;
async function postComment(page: Page, commentText: string, log: Log): Promise<CommentResult>;
```

**Implementation Steps:**
1. Navigate to post URL
2. Find comment input (use existing selectors)
3. Click to focus
4. Type comment with human delay
5. Submit (Enter or click button)
6. Verify comment appeared
7. Wait for cooldown

### P11: Send Initial DM

**File:** `agents/procedures/dm.ts`

```typescript
interface DMResult {
  success: boolean;
  conversationUrl: string;
  error?: string;
}

async function navigateToProfile(page: Page, profileUrl: string, log: Log): Promise<boolean>;
async function clickMessageButton(page: Page, log: Log): Promise<boolean>;
async function sendInitialDM(page: Page, messageText: string, log: Log): Promise<DMResult>;
```

**Implementation Steps:**
1. Navigate to author profile URL
2. Find "Message" button
3. Click to open Messenger modal/page
4. Wait for conversation to load
5. Type initial message
6. Send message
7. Capture conversation URL
8. Return URL for tracking

### P12: Get Post Context for AI

**File:** Update `agents/procedures/ai.ts`

```typescript
interface PostContext {
  postText: string;
  authorName: string;
  matchedService: string | null;
  groupName: string;
  postedAt: Date | null;
}

async function generateAIReplyWithContext(
  contactName: string,
  messages: Message[],
  postContext: PostContext | null,  // NEW: Original post context
  log: Log
): Promise<AIReplyResult>;
```

---

## Agent Implementation Changes

### 1. Scraper Agent (Rename from Lead Gen Agent)

**File:** `agents/scraper-agent.ts`

**Changes:**
- Remove `autoComment` and `autoDM` flags (not its job)
- Focus ONLY on scraping and AI analysis
- Save ALL posts to GroupPost table (not just leads)
- Link GroupPost → Lead for qualified posts

**Key Logic:**
```typescript
for (const post of scrapedPosts) {
  // 1. Save to GroupPost (always)
  const groupPost = await prisma.groupPost.create({
    data: {
      fbPostId: post.fbPostId,
      postUrl: post.postUrl,
      authorName: post.authorName,
      // ... all fields
    }
  });
  
  // 2. Run AI analysis
  const analysis = await analyzePostForLead(post.content, log);
  
  // 3. Update GroupPost with analysis
  await prisma.groupPost.update({
    where: { id: groupPost.id },
    data: {
      isAnalyzed: true,
      isLead: analysis.isLead,
      intentScore: analysis.intentScore,
      aiAnalysis: analysis,
    }
  });
  
  // 4. If lead, create Lead record
  if (analysis.isLead) {
    const lead = await prisma.lead.create({
      data: {
        groupId: group.id,
        postUrl: post.postUrl,
        // ... fields ...
        status: 'NEW',
        stage: 'LEAD',
      }
    });
    
    // 5. Link GroupPost to Lead
    await prisma.groupPost.update({
      where: { id: groupPost.id },
      data: { leadId: lead.id }
    });
  }
}
```

### 2. Initiator Agent (NEW)

**File:** `agents/initiator-agent.ts`

**Purpose:**
- Query NEW leads
- Comment on posts
- Send initial DMs (if not anonymous)
- Create MessengerContact records
- Create Conversation records

**Key Logic:**
```typescript
interface InitiatorInput {
  accountId: string;
  maxLeads?: number;
  headless?: boolean;
  commentOnly?: boolean;  // Skip DMs
  dmOnly?: boolean;       // Skip comments
}

async function runInitiatorAgent(input: InitiatorInput): Promise<InitiatorResult> {
  // 1. Query NEW leads (not yet engaged)
  const leads = await prisma.lead.findMany({
    where: {
      status: 'NEW',
      stage: 'LEAD',
      engagedByAccountId: null,
    },
    take: input.maxLeads || 10,
    orderBy: { intentScore: 'desc' },  // High intent first
  });
  
  for (const lead of leads) {
    // 2. Comment on post
    if (!input.dmOnly) {
      await navigateToPost(page, lead.postUrl, log);
      const comment = await generateComment(lead);
      await postComment(page, comment, log);
      
      // Update lead status
      await prisma.lead.update({
        where: { id: lead.id },
        data: { 
          status: 'COMMENTED',
          commentedAt: new Date(),
        }
      });
    }
    
    // 3. Send DM if not anonymous
    if (!input.commentOnly && !lead.isAnonymous && lead.authorProfileUrl) {
      await navigateToProfile(page, lead.authorProfileUrl, log);
      const dmResult = await sendInitialDM(page, initialMessage, log);
      
      if (dmResult.success) {
        // Create MessengerContact LINKED to Lead
        const contact = await prisma.messengerContact.create({
          data: {
            accountId: input.accountId,
            contactName: lead.authorName!,
            conversationUrl: dmResult.conversationUrl,
            leadId: lead.id,  // DIRECT LINK!
            status: 'ACTIVE',
            state: 'WAITING',
          }
        });
        
        // Create Conversation record
        await prisma.conversation.create({
          data: {
            leadId: lead.id,
            messengerContactId: contact.id,
            accountId: input.accountId,
            initialDmText: initialMessage,
            initialDmSentAt: new Date(),
          }
        });
        
        // Update lead
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            status: 'DM_SENT',
            engagedByAccountId: input.accountId,
            initialDmSentAt: new Date(),
          }
        });
      }
    }
    
    // Rate limit delay
    await humanDelay(30000, 60000);
  }
}
```

### 3. Message Agent (Enhanced)

**File:** `agents/message-agent.ts`

**Changes:**
1. Get lead context from MessengerContact → Lead
2. Pass original post context to AI
3. Store full conversation history

**Key Changes:**
```typescript
// When processing a conversation
const conversation = await readConversation(page, log);

if (conversation) {
  // Find the MessengerContact
  const contact = await prisma.messengerContact.findFirst({
    where: {
      accountId: input.accountId,
      contactName: conversation.contactName,
    },
    include: {
      lead: {
        include: {
          group: true,
          groupPost: true,
        }
      }
    }
  });
  
  // Build post context for AI
  const postContext: PostContext | null = contact?.lead ? {
    postText: contact.lead.postText,
    authorName: contact.lead.authorName || '',
    matchedService: contact.lead.matchedService,
    groupName: contact.lead.group.name,
    postedAt: contact.lead.postDate,
  } : null;
  
  // Generate AI reply WITH CONTEXT
  const aiResult = await generateAIReplyWithContext(
    conversation.contactName,
    conversation.messages,
    postContext,  // NEW!
    log
  );
  
  // Rest of processing...
}
```

---

## Test Routes Required

### 1. Test Commenting
**Route:** `POST /api/agents/test/comment`

```typescript
// Body
{
  "accountId": "string",
  "postUrl": "string",
  "commentText": "string"  // Optional, will generate if not provided
}
```

### 2. Test Initial DM
**Route:** `POST /api/agents/test/initial-dm`

```typescript
// Body
{
  "accountId": "string",
  "profileUrl": "string",
  "message": "string"
}
```

### 3. Test Scraper Agent
**Route:** `POST /api/agents/test/scraper`

```typescript
// Body
{
  "accountId": "string",
  "groups": [{ "id": "string", "url": "string" }],
  "maxPosts": 20
}
```

### 4. Test Initiator Agent
**Route:** `POST /api/agents/test/initiator`

```typescript
// Body
{
  "accountId": "string",
  "maxLeads": 5,
  "commentOnly": false,
  "dmOnly": false
}
```

### 5. Test Message Agent (Existing, Enhanced)
**Route:** `POST /api/agents/test/message-agent`

Already exists, but verify it now includes lead context.

---

## Implementation Checklist

### Phase 1: Database & Procedures
- [ ] Update Prisma schema with Conversation enhancements
- [ ] Add `engagedByAccountId` field to Lead
- [ ] Run `prisma migrate dev --name add-initiator-fields`
- [ ] Create `agents/procedures/commenting.ts`
- [ ] Create `agents/procedures/dm.ts`
- [ ] Update `agents/procedures/ai.ts` with `generateAIReplyWithContext`
- [ ] Export new procedures from `agents/procedures/index.ts`

### Phase 2: Scraper Agent
- [ ] Rename `lead-gen-agent.ts` → `scraper-agent.ts`
- [ ] Remove `autoComment`/`autoDM` flags
- [ ] Implement GroupPost creation for ALL posts
- [ ] Link GroupPost → Lead for qualified leads
- [ ] Update exports in `agents/index.ts`

### Phase 3: Initiator Agent
- [ ] Create `agents/initiator-agent.ts`
- [ ] Implement comment posting
- [ ] Implement initial DM sending
- [ ] Create MessengerContact with leadId link
- [ ] Create Conversation record
- [ ] Export from `agents/index.ts`

### Phase 4: Message Agent Enhancement
- [ ] Add lead context lookup
- [ ] Update AI prompt with post context
- [ ] Store conversation history in Conversation.messageHistory
- [ ] Test context is used correctly

### Phase 5: Test Routes
- [ ] Create `/api/agents/test/comment/route.ts`
- [ ] Create `/api/agents/test/initial-dm/route.ts`
- [ ] Create `/api/agents/test/scraper/route.ts`
- [ ] Create `/api/agents/test/initiator/route.ts`
- [ ] Verify existing message-agent route

### Phase 6: Integration Testing
- [ ] Test full flow: Scrape → Initiate → Message
- [ ] Verify lead context appears in AI prompts
- [ ] Verify stage updates flow through correctly
- [ ] Test parallel execution with different accounts

---

## Rate Limiting & Safety

### Recommended Limits per Account per Day

| Action | Limit | Reason |
|--------|-------|--------|
| Comments | 10-15 | High ban risk |
| Initial DMs | 5-10 | Very high ban risk |
| Reply DMs | 30-50 | Lower risk (existing convos) |
| Profile visits | 50-100 | Medium risk |

### Built-in Delays

```typescript
// In initiator-agent.ts
const DELAYS = {
  betweenLeads: [30000, 60000],      // 30-60s between leads
  afterComment: [10000, 20000],       // 10-20s after commenting
  afterDM: [20000, 40000],            // 20-40s after DM
  beforeDM: [5000, 10000],            // 5-10s before DM
  pageLoad: [3000, 6000],             // 3-6s after navigation
};
```

---

## Facebook Selectors Needed

### Post Comment Selectors
```typescript
export const COMMENT_SELECTORS = {
  // Comment input on post page
  commentInput: '[aria-label="Write a comment"], [data-testid="UFI2CommentInput/Input"]',
  commentBox: '[aria-label="Comment"], [role="textbox"][data-lexical-text="true"]',
  submitButton: '[aria-label="Comment"], [data-testid="UFI2CommentButton"]',
  commentContainer: '[data-testid="UFI2Comment/root_depth_0"]',
};
```

### Profile DM Selectors
```typescript
export const PROFILE_SELECTORS = {
  // Message button on profile
  messageButton: '[aria-label="Message"], [data-testid="profile_message_button"]',
  messageButtonAlt: 'a[href*="/messages/t/"]',
  
  // Messenger modal/page
  messengerInput: '[aria-label="Message"], [data-testid="message-composer-input"]',
  sendButton: '[aria-label="Press enter to send"]',
};
```

---

## Summary

### Key Changes
1. **Scraper Agent** = Pure data collection (1 account for all groups)
2. **Initiator Agent** = Engagement layer (comments + DMs, multiple accounts)
3. **Message Agent** = Conversation layer (replies with full context)

### Key Benefits
1. **Clear Separation**: Each agent has ONE job
2. **Lead Traceability**: MessengerContact → Lead → GroupPost → Group
3. **Full Context AI**: AI knows what post triggered the conversation
4. **Scalable**: Different accounts can handle different leads
5. **Safe**: Rate limits per account, not global

### Next Steps
1. Review this plan
2. Start with Phase 1 (Database + Procedures)
3. Implement incrementally with tests
4. Full integration test
