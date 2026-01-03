# FB Leads - Agent System Documentation

> **Complete guide to understanding how agents work, from group discovery to closed deals**

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [The Complete Flow](#the-complete-flow)
3. [Agent 1: First-Time Scraper](#agent-1-first-time-scraper)
4. [Agent 2: Lead Gen Agent](#agent-2-lead-gen-agent)
5. [Agent 3: Message Agent](#agent-3-message-agent)
6. [Procedures Library](#procedures-library)
7. [Testing Coverage](#testing-coverage)
8. [Database Models](#database-models)
9. [Schedule System](#schedule-system)
10. [API Endpoints Reference](#api-endpoints-reference)

---

## Overview

FB Leads uses **3 main agents** that work together to automate the entire Facebook lead generation pipeline:

| Agent | Purpose | Runs When | Storage |
|-------|---------|-----------|---------|
| **First-Time Scraper** | Initial group scrape | Group first added | PostgreSQL |
| **Lead Gen Agent** | Monitor groups, create qualified leads | Scheduled (hourly) | PostgreSQL |
| **Message Agent** | Messenger monitoring & AI replies | Scheduled (configurable) | PostgreSQL |

> **All agents are fully PostgreSQL-backed via Prisma ORM.** Data persists across restarts.

### How They Work Together

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FB LEADS PIPELINE                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────────────┐ │
│  │    GROUPS    │ ──▶ │    POSTS     │ ──▶ │         LEADS            │ │
│  │  (monitored) │     │  (scraped)   │     │ (AI-analyzed, scored)    │ │
│  └──────────────┘     └──────────────┘     └──────────────────────────┘ │
│         │                    │                        │                  │
│         ▼                    ▼                        ▼                  │
│  First-Time Scraper   Lead Gen Agent           Lead Gen Agent           │
│  (initial scrape)     (incremental)            (AI analysis)            │
│                                                       │                  │
│                                                       ▼                  │
│                              ┌──────────────────────────────────────────┤
│                              │        ENGAGEMENT ACTIONS                │
│                              ├──────────────────────────────────────────┤
│                              │  • Comment on post                       │
│                              │  • Send friend request                   │
│                              │  • Send initial DM                       │
│                              └──────────────────────────────────────────┤
│                                                       │                  │
│                                                       ▼                  │
│  ┌──────────────────────────────────────────────────────────────────────┤
│  │                     MESSENGER CONVERSATIONS                          │
│  ├──────────────────────────────────────────────────────────────────────┤
│  │                                                                       │
│  │   Message Agent monitors Messenger:                                   │
│  │   • Detects new messages (NEEDS_REPLY)                               │
│  │   • Generates AI replies in Tunisian Arabic                          │
│  │   • Tracks conversation states                                        │
│  │   • Links contacts to leads                                          │
│  │   • Updates lead stages automatically                                │
│  │                                                                       │
│  └──────────────────────────────────────────────────────────────────────┤
│                                                       │                  │
│                                                       ▼                  │
│  ┌──────────────────────────────────────────────────────────────────────┤
│  │                          DEAL CLOSED! 🎉                              │
│  │                                                                       │
│  │   Lead stages: NEW → COMMENTED → DM_SENT → REPLIED → INTERESTED →    │
│  │                NEGOTIATING → WON / LOST                              │
│  └──────────────────────────────────────────────────────────────────────┘
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## The Complete Flow

### Stage 1: Group Discovery & Setup

1. **Admin adds a Facebook group** via `/dashboard/groups`
2. **First-Time Scraper** runs automatically to get historical posts
3. Posts are stored in database for AI analysis

### Stage 2: Continuous Monitoring

1. **Lead Gen Agent** runs on schedule (configurable, default hourly)
2. Agent opens each active group in browser
3. **Incremental scrape** - only fetches new posts since last check
4. **AI Analysis** runs on each new post in parallel (batches of 10)
5. High-intent posts become **Leads** with:
   - Intent score (1-5)
   - Urgency level (1-5)
   - Need type (home automation, security, etc.)
   - Matched services
   - Suggested response

### Stage 3: Engagement

When a lead is created with high intent (4-5), the agent can:

1. **Comment** on the original post with helpful response
2. **Visit author's profile** (if not anonymous)
3. **Send friend request**
4. **Send DM** with personalized message

### Stage 4: Messenger Conversations

1. **Message Agent** monitors Messenger sidebar
2. Detects conversations that need replies
3. **AI generates responses** in perfect Tunisian Arabic dialect
4. Sends replies automatically
5. **Links contacts to leads** by name matching
6. **Updates lead stages** automatically:
   - When we send DM → `DM_SENT`
   - When they reply → `REPLIED`
   - When interested → `INTERESTED`
   - When negotiating → `NEGOTIATING`
   - When closed → `WON` or `LOST`

### Stage 5: Deal Closure

Manual step by human after AI qualifies the lead:
- Schedule consultation
- Provide quote
- Close deal
- Mark as `WON` or `LOST`

---

## Agent 1: First-Time Scraper

**Location:** `agents/first-time-scraper.ts`

### Purpose

Initializes a group when first added - scrapes historical posts, analyzes with AI, and creates leads. This is **identical to Lead Gen Agent** but runs once for initial setup.

### What It Does

1. **Scrapes** configurable number of historical posts
2. **Analyzes posts with AI** in parallel (batches of 10)
3. **Creates leads** for qualified posts (`isLead=true`)
4. **Saves leads** to PostgreSQL database
5. **Updates group** `lastScrapedPostUrl` for future incremental scrapes

### How It Works

```typescript
export async function runFirstTimeScraper(config: FirstTimeScraperInput): Promise<FirstTimeScraperResult>
```

1. **Launches browser** with persistent session (P1)
2. **Applies stealth** measures to avoid detection (P2)
3. **Navigates** to the group URL (P5)
4. **Full scrape** - scrolls and extracts posts up to `maxPosts` (P6)
5. **Parallel AI analysis** - batches of 10 posts (P8)
6. **Creates leads** in PostgreSQL for qualified posts
7. **Updates group** in database
8. **Returns** results with leads created

### Configuration

```typescript
interface FirstTimeScraperInput {
  groupUrl: string;        // Group URL to scrape
  groupId: string;         // Group ID in database
  accountId: string;       // FB account to use
  maxPosts?: number;       // Number of posts to scrape (default: 50)
  headless?: boolean;      // Run headless (default: false)
  analyzeWithAI?: boolean; // Run AI analysis (default: true)
  createLeads?: boolean;   // Create leads in DB (default: true)
  autoComment?: boolean;   // Comment on high-intent posts
  autoDM?: boolean;        // DM high-intent authors
}
```

### Returns

```typescript
interface FirstTimeScraperResult {
  success: boolean;
  stats: {
    postsScraped: number;
    postsAnalyzed: number;
    leadsCreated: number;
    commentsPosted: number;
    dmsSent: number;
  };
  postResults: FirstTimeScraperPostResult[];
  lastScrapedPostUrl: string;
  logs: string[];
  errors: string[];
}
```

### Procedures Used

| Procedure | Purpose |
|-----------|---------|
| P1 `launchBrowser` | Open browser with persistent session |
| P2 `applyStealth` | Avoid bot detection |
| P5 `navigateToGroup` | Go to group page |
| P6 `fullScrape` | Extract posts with configurable limit |
| P8 `analyzePostForLead` | AI analysis for lead qualification |

### Key Features

- **Parallel AI Analysis**: Processes 10 posts simultaneously for speed
- **PostgreSQL Storage**: Leads saved directly to database
- **Lead Qualification**: Uses same criteria as Lead Gen Agent (see [Lead Qualification](#what-is-a-lead-))
- **Group Update**: Sets `lastScrapedPostUrl` for future incremental scrapes

---

## Agent 2: Lead Gen Agent

**Location:** `agents/lead-gen-agent.ts`

### Purpose

The **main workhorse** of the system. Runs on schedule to:
1. Monitor all active groups for new posts
2. Analyze posts with AI for **qualified lead potential**
3. **Filter out** job offers, internships, equity requests, free work
4. Create leads for genuine project requests
5. Optionally engage with high-intent leads

### Our Services (What We Look For)

The AI matches posts against these services:

1. 🌐 **تطوير مواقع ويب** (Web Development)
2. 📱 **تطبيقات موبيل iOS & Android** (Mobile Apps)
3. 🛒 **متاجر إلكترونية E-commerce**
4. 📣 **Marketing digital و السوشيال ميديا**
5. 🎨 **تصميم جرافيك و UI/UX**
6. 🏢 **أنظمة إدارة** (Management Systems)
7. 🤖 **Automation و Bots**

### How It Works

```typescript
export async function runLeadGenAgent(config: LeadGenAgentConfig): Promise<LeadGenResult>
```

1. **Checks schedule** - respects configured run times
2. **Fetches active groups** from database
3. For each group:
   - **Launches browser** with account session
   - **Incremental scrape** - only new posts since `lastScrapedAt`
   - **Parallel AI analysis** - processes 10 posts at a time
   - **Creates leads** for high-intent posts (score ≥ 3)
4. **Engagement** (if enabled):
   - Comments on post
   - Visits profile
   - Sends friend request
   - Sends DM
5. **Updates group** `lastScrapedAt` timestamp

### Configuration

```typescript
interface LeadGenAgentConfig {
  accountId: string;        // FB account to use
  groupIds?: string[];      // Specific groups (or all active)
  maxPostsPerGroup?: number; // Limit per group (default: 50)
  analyzeWithAI?: boolean;  // Run AI analysis (default: true)
  engageHighIntent?: boolean; // Auto-engage (default: false)
  headless?: boolean;       // Run headless (default: true)
}
```

### Returns

```typescript
interface LeadGenResult {
  success: boolean;
  groupResults: {
    groupId: string;
    groupName: string;
    postsFound: number;
    postsAnalyzed: number;
    leadsCreated: number;
  }[];
  totalLeadsCreated: number;
  logs: string[];
  errors: string[];
}
```

### AI Analysis

Each post is analyzed with Azure OpenAI (gpt-4o-mini):

```typescript
interface AIAnalysis {
  isLead: boolean;           // Is this a qualified lead?
  matchedService: string;    // Which service they need
  reason: string;            // What project they need
  keywords: string[];        // Keywords from post
  suggestedComment: string;  // Tunisian dialect response
}
```

### What Is A Lead ✅

Someone who needs a **PROJECT done** - website, app, design, marketing, etc.

**Examples of valid leads:**
- "نحب نعمل موقع" (I want to make a website)
- "نلقى شكون يخدملي تطبيق" (Looking for someone to make me an app)
- "محتاج شكون يعملي" (I need someone to make me...)
- "أبحث عن مطور يعملي" (Looking for a developer to make...)

### Absolutely Reject These ❌

| Category | Keywords to Reject |
|----------|--------------------|
| **Job Offers / Employment** | "offre d'emploi", "we are hiring", "permanent position", "CDI", "poste", "recrute" |
| **Internships** | "stage", "stagiaire", "PFE", "offre de stage", "stage académique" |
| **Equity / Partnership** | "equity", "parts", "co-founder", "partenaire", "associé", "% of company" |
| **Startup Seeking Team** | "looking for collaborators", "cherche associé", "join our team", "rejoindre notre équipe" |
| **Free Work Requests** | "gratuit", "bénévole", "volunteer", "free", "sans paiement", "بلاش", "مجاني" |
| **Freelancers Promoting** | People offering their own services |

### Lead Qualification Rules

1. If the post mentions **stage/internship/PFE** = ❌ NOT A LEAD
2. If the post offers **employment/job/position** = ❌ NOT A LEAD  
3. If the post offers **equity/partnership** instead of payment = ❌ NOT A LEAD
4. If they want someone to **JOIN their team** = ❌ NOT A LEAD
5. We want **CLIENTS who need a PROJECT**, not employers hiring staff

### Procedures Used

| Procedure | Purpose |
|-----------|---------|
| P1 `launchBrowser` | Open browser with persistent session |
| P2 `applyStealth` | Avoid bot detection |
| P3 `humanDelay` | Random delays between actions |
| P4 `simulateTyping` | Type like a human |
| P5 `navigateToGroup` | Go to group page |
| P6 `scrapeGroupPosts` | Extract posts |
| P7 `extractPostContent` | Get full post details |
| P8 `analyzePostWithAI` | AI intent scoring |
| P9 `generateAIReply` | Create response text |
| P10 `postComment` | Comment on post |
| P11 `visitProfile` | Navigate to author profile |
| P12 `sendFriendRequest` | Add as friend |
| P13 `sendDirectMessage` | Send DM |

### Parallel Processing

AI analysis is done in parallel batches:

```typescript
// Process 10 posts at a time
const batchSize = 10;
for (let i = 0; i < posts.length; i += batchSize) {
  const batch = posts.slice(i, i + batchSize);
  const results = await Promise.all(
    batch.map(post => analyzePostWithAI(post))
  );
  // Process results...
}
```

---

## Agent 3: Message Agent

**Location:** `agents/message-agent.ts`

### Purpose

Monitors Facebook Messenger and handles conversations with potential clients. Uses AI to generate replies in **Tunisian Arabic dialect**.

### Architecture

**Fully PostgreSQL-backed** via Prisma ORM.

**Location:** `app/api/message-agent/route.ts`

**Database Features:**
- ✅ Stores all contacts in PostgreSQL (`MessengerContact` model)
- ✅ Persists across restarts
- ✅ Links contacts to leads by name matching
- ✅ Automatically updates lead stages
- ✅ Tracks message counts (theirs vs ours)
- ✅ Stores last message from them
- ✅ Records first seen and last activity timestamps

### Actions

| Action | Purpose | Speed |
|--------|---------|-------|
| `init` | Full sidebar scan, discovers all contacts | Slow (30s+) |
| `scan` | Smart boundary scan, detects changes | Fast (5-10s) |
| `reply` | Send AI replies to NEEDS_REPLY contacts | Medium |
| `maintenance` | Archive inactive contacts (7+ days) | Fast |

### Conversation States

```
┌─────────┐     ┌────────────────┐     ┌───────────┐
│   NEW   │ ──▶ │  NEEDS_REPLY   │ ──▶ │  WAITING  │
└─────────┘     └────────────────┘     └───────────┘
                       │                     │
                       │                     ▼
                       │              ┌───────────┐
                       └──────────────│  ACTIVE   │
                                      └───────────┘
                                           │
                              ┌────────────┴────────────┐
                              ▼                         ▼
                        ┌──────────┐              ┌──────────┐
                        │   IDLE   │              │  ENDED   │
                        └──────────┘              └──────────┘
```

| State | Meaning |
|-------|---------|
| `NEW` | Just discovered, never interacted |
| `NEEDS_REPLY` | They sent message, we need to respond |
| `WAITING` | We sent message, waiting for their reply |
| `ACTIVE` | Active back-and-forth conversation |
| `IDLE` | No activity for 3-7 days |
| `ENDED` | Conversation concluded or archived |

### How It Works

```typescript
export async function runMessageAgent(config: MessageAgentConfig): Promise<MessageAgentResult>
```

1. **Opens Messenger** in browser
2. **Scans sidebar** for conversations with unread indicators
3. For each conversation needing reply:
   - **Opens conversation**
   - **Reads messages** to understand context
   - **Generates AI reply** using Azure OpenAI
   - **Types and sends** with human-like delays
4. **Updates database** with new states
5. **Links to leads** by name matching

### AI Reply Generation

The AI generates replies in **Tunisian Arabic dialect**:

```
System Prompt:
أنت مساعد محترف في مجال المنازل الذكية والأمن. تتحدث بالدارجة التونسية 
(أحرف عربية، مش لاتينية). هدفك تفهم احتياجات العميل وتقترح خدماتنا.

قواعد مهمة:
- استعمل دارجة تونسية طبيعية: عسلامة، شنوة، كيفاش، برشا، إلخ
- كون مهذب ومحترف
- حاول تفهم شنو يحتاج العميل
- اقترح حلول من خدماتنا
```

### Lead Stage Updates

When Message Agent interacts, it updates lead stages:

| Trigger | Stage Update |
|---------|--------------|
| We send first DM | `NEW` → `DM_SENT` |
| They reply | `DM_SENT` → `REPLIED` |
| They show interest | → `INTERESTED` |
| Negotiating details | → `NEGOTIATING` |
| Deal closed | → `WON` |
| Deal lost | → `LOST` |

### Procedures Used

| Procedure | Purpose |
|-----------|---------|
| P1 `launchBrowser` | Open browser |
| P2 `applyStealth` | Avoid detection |
| P9 `generateAIReply` | Create Tunisian response |
| P14 `openMessenger` | Navigate to Messenger |
| P15 `scanSidebar` | Check for unread messages |
| P16 `openConversation` | Click on conversation |
| P17 `readMessages` | Extract message history |
| P18 `sendMessage` | Type and send reply |

---

## Procedures Library

**Location:** `agents/procedures/`

Reusable procedures organized by category:

### Browser (`browser.ts`)

| Procedure | Function | Description |
|-----------|----------|-------------|
| P1 | `launchBrowser()` | Launch Chromium with persistent session |
| P2 | `applyStealth()` | Apply anti-detection measures |
| | `warmupBrowser()` | Gentle activity to appear human |
| | `closeBrowser()` | Clean shutdown |

### Human Behavior (`human-behavior.ts`)

| Procedure | Function | Description |
|-----------|----------|-------------|
| P3 | `humanDelay()` | Random delay (1-3s default) |
| P4 | `simulateTyping()` | Type with random speed/pauses |
| | `randomScroll()` | Scroll randomly like human |
| | `moveMouse()` | Natural mouse movements |

### Scraping (`scraping.ts`)

| Procedure | Function | Description |
|-----------|----------|-------------|
| P5 | `navigateToGroup()` | Go to group URL |
| P6 | `scrapeGroupPosts()` | Extract posts from feed |
| P7 | `extractPostContent()` | Get full post details |
| | `getPostUrl()` | Extract permalink |
| | `getAuthorInfo()` | Get author name/profile |

### AI (`ai.ts`)

| Procedure | Function | Description |
|-----------|----------|-------------|
| P8 | `analyzePostWithAI()` | Score post for intent |
| P9 | `generateAIReply()` | Generate Tunisian response |

### Messenger (`messenger.ts`)

| Procedure | Function | Description |
|-----------|----------|-------------|
| P14 | `openMessenger()` | Navigate to Messenger |
| P15 | `scanSidebar()` | Check for unread badges |
| P16 | `openConversation()` | Click conversation by name |
| P17 | `readMessages()` | Extract message history |
| P18 | `sendMessage()` | Type and send message |

### Facebook Selectors (`facebook-selectors.ts`)

DOM selectors for Facebook elements - regularly updated as FB changes their UI.

---

## Testing Coverage

**Dashboard:** `/dashboard/agents/testing`

### Testing Tabs Overview

| Tab | What It Tests | API Endpoint | Uses Database? |
|-----|---------------|--------------|----------------|
| **Single Post** | Extract content from single post URL | `/api/test/single-post` | ❌ No |
| **Extract Posts** | Scrape multiple posts from group | `/api/test/extract-posts` | ❌ No |
| **AI Analysis** | Test AI scoring on sample posts | `/api/test/ai` | ❌ No |
| **Engagement** | Test comment, friend request, DM | `/api/test/engage` | ❌ No |
| **AI Reply** | Test Tunisian AI chat | `/api/test/ai-reply` | ❌ No |
| **Message Agent** | Production DB-backed agent | `/api/message-agent` | ✅ PostgreSQL |
| **Debug Messages** | Raw message extraction debug | `/api/test/debug-messages` | ❌ No |
| **State Machine** | JSON-based conversation tracking | `/api/test/state-machine` | 📁 Local JSON |

### All Test Endpoints

| Endpoint | Purpose | Description |
|----------|---------|-------------|
| `/api/test/single-post` | Single post extraction | Opens post dialog, extracts content and author |
| `/api/test/extract-posts` | Multi-post extraction | Scrolls group feed, extracts N posts with permalinks |
| `/api/test/ai` | AI post analysis | Sends post text to Azure OpenAI, returns intent score |
| `/api/test/engage` | Full engagement flow | Comment → Visit profile → Friend request → DM |
| `/api/test/find-profiles` | Profile extraction | Find author profile URLs from posts |
| `/api/test/scrape` | Group scraping | Full scrape with scroll and post extraction |
| `/api/test/ai-reply` | AI conversation | Multi-turn Tunisian AI chat |
| `/api/test/debug-messages` | Message debugging | Extract raw message elements with styles |
| `/api/test/check-messages` | Read messages | Extract conversation message list |
| `/api/test/read-conversation` | Full conversation | Complete conversation extraction |
| `/api/test/send-reply` | Send message | Send a message to conversation |
| `/api/test/state-machine` | State tracking | JSON-based state machine (testing only) |
| `/api/test/message-agent` | Test agent | Testing endpoint (use production `/api/message-agent`) |
| `/api/test/ai-tune` | AI prompt tuning | Test custom AI prompts |

### Production Message Agent Endpoints

| Endpoint | Method | Action | Description |
|----------|--------|--------|-------------|
| `/api/message-agent` | POST | `init` | Full sidebar scan, discovers all contacts |
| `/api/message-agent` | POST | `scan` | Smart boundary scan, detects new/returning |
| `/api/message-agent` | POST | `reply` | Send AI replies to NEEDS_REPLY contacts |
| `/api/message-agent` | POST | `maintenance` | Archive inactive contacts (7+ days) |
| `/api/message-agent/contacts` | GET | - | List all contacts for account |
| `/api/message-agent/contacts` | POST | - | Create/update contact |
| `/api/message-agent/contacts` | DELETE | - | Delete contact |
| `/api/message-agent/config` | GET | - | Get agent configuration |
| `/api/message-agent/config` | PUT | - | Update configuration |
| `/api/message-agent/stats` | GET | - | Get dashboard statistics |
| `/api/message-agent/run` | POST | - | Scheduled execution (cron) |

### What's Fully Tested ✅

1. **Post Extraction**
   - ✅ Single post content extraction
   - ✅ Multiple posts from group
   - ✅ Author profile extraction
   - ✅ Post URL/permalink extraction
   - ✅ Anonymous post handling

2. **AI Analysis**
   - ✅ Intent scoring (1-5)
   - ✅ Need type detection
   - ✅ Service matching
   - ✅ Response generation
   - ✅ Tunisian dialect replies

3. **Engagement Actions**
   - ✅ Commenting on posts
   - ✅ Visiting profiles
   - ✅ Sending friend requests
   - ✅ Sending DMs

4. **Messenger Operations**
   - ✅ Opening Messenger
   - ✅ Scanning sidebar for unread
   - ✅ Opening conversations by name
   - ✅ Reading messages (with sender detection)
   - ✅ Sending messages with human-like typing
   - ✅ AI reply generation in Tunisian

5. **Database Operations**
   - ✅ Contact creation/update
   - ✅ State transitions
   - ✅ Lead linking by name
   - ✅ Stage updates
   - ✅ Statistics aggregation

### What Needs Manual Testing ⚠️

1. **Full Lead Gen Agent run** - Complex multi-group operation
2. **Scheduled execution** - Cron job verification
3. **Multi-account rotation** - Account switching logic
4. **Rate limiting** - Avoid FB detection
5. **Long-running sessions** - Browser stability

---

## Database Models

### Prisma Schema

```prisma
// Core Lead Model
model Lead {
  id              String    @id @default(cuid())
  name            String    
  status          String    @default("new")
  stage           String    @default("NEW")
  intentScore     Int       @default(0)
  urgency         Int       @default(0)
  needType        String?
  matchedServices String[]
  budgetSignals   String[]
  reasoning       String?
  suggestedResponse String?
  postUrl         String?
  postContent     String?
  profileUrl      String?
  groupId         String?
  accountId       String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  // Relations
  group           Group?    @relation(fields: [groupId], references: [id])
  messengerContacts MessengerContact[]
}

// Messenger Contact Model
model MessengerContact {
  id                String    @id @default(cuid())
  accountId         String
  contactFbId       String
  name              String
  conversationUrl   String
  state             String    @default("NEW")
  theirMessageCount Int       @default(0)
  ourMessageCount   Int       @default(0)
  lastTheirMessage  String?
  leadId            String?
  leadStage         String?
  firstSeenAt       DateTime  @default(now())
  lastActivityAt    DateTime  @default(now())
  
  // Relations
  lead              Lead?     @relation(fields: [leadId], references: [id])
  
  @@unique([accountId, contactFbId])
}

// Message Agent Config
model MessageAgentConfig {
  id                String    @id @default(cuid())
  accountId         String    @unique
  isEnabled         Boolean   @default(true)
  maxRepliesPerRun  Int       @default(5)
  replyDelaySeconds Int       @default(30)
  idleTimeoutDays   Int       @default(7)
  lastRunAt         DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
}

// Schedule Execution Log
model ScheduleExecution {
  id          String   @id @default(cuid())
  agentType   String   // "lead-gen" or "message-agent"
  accountId   String
  action      String?
  startedAt   DateTime @default(now())
  completedAt DateTime?
  success     Boolean?
  result      Json?
  error       String?
}
```

### Lead Stages

```typescript
const LEAD_STAGES = [
  'NEW',           // Just created from post
  'COMMENTED',     // We commented on their post
  'DM_SENT',       // We sent first DM
  'REPLIED',       // They replied to us
  'INTERESTED',    // Showed interest in services
  'NEGOTIATING',   // Discussing details/pricing
  'WON',           // Deal closed successfully
  'LOST',          // Deal lost
] as const;
```

### Messenger Contact States

```typescript
const CONTACT_STATES = [
  'NEW',           // Just discovered
  'NEEDS_REPLY',   // They messaged, awaiting our reply
  'WAITING',       // We replied, awaiting their response
  'ACTIVE',        // Active back-and-forth
  'IDLE',          // Inactive 3-7 days
  'ENDED',         // Conversation concluded
] as const;
```

---

## Schedule System

**Location:** `lib/schedule-service.ts`

### Configuration

```typescript
interface ScheduleConfig {
  leadGen: {
    enabled: boolean;
    interval: number;        // Minutes between runs
    startHour: number;       // Start time (24h)
    endHour: number;         // End time (24h)
    daysOfWeek: number[];    // 0=Sun, 1=Mon, etc.
  };
  messageAgent: {
    enabled: boolean;
    interval: number;
    startHour: number;
    endHour: number;
    daysOfWeek: number[];
  };
}
```

### Default Schedule

```typescript
const defaultSchedule = {
  leadGen: {
    enabled: true,
    interval: 60,           // Every hour
    startHour: 8,           // 8 AM
    endHour: 22,            // 10 PM
    daysOfWeek: [1,2,3,4,5,6], // Mon-Sat
  },
  messageAgent: {
    enabled: true,
    interval: 30,           // Every 30 min
    startHour: 8,
    endHour: 22,
    daysOfWeek: [1,2,3,4,5,6],
  },
};
```

### Peak Hours

During peak hours (12-14, 19-22), agents run more frequently:
- Normal: Every 60 minutes
- Peak: Every 30 minutes

---

## API Endpoints Reference

### Agent Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agents` | List available agents |
| POST | `/api/agents` | Run agent manually |
| GET | `/api/agents/schedule` | Get schedule config |
| PUT | `/api/agents/schedule` | Update schedule |
| POST | `/api/agents/heartbeat` | Health check |

### Leads

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/leads` | List all leads |
| POST | `/api/leads` | Create lead |
| GET | `/api/leads/[id]` | Get lead details |
| PUT | `/api/leads/[id]` | Update lead |
| DELETE | `/api/leads/[id]` | Delete lead |
| PUT | `/api/leads/stage` | Update lead stage |

### Groups

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/groups` | List groups |
| POST | `/api/groups` | Add group |
| PUT | `/api/groups/[id]` | Update group |
| DELETE | `/api/groups/[id]` | Remove group |

### Accounts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/accounts` | List FB accounts |
| POST | `/api/accounts` | Add account |
| POST | `/api/accounts/login` | Login to FB |

---

## Quick Reference

### Running Agents Manually

```bash
# Run Lead Gen Agent
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{"agent": "lead-gen", "accountId": "account-1"}'

# Message Agent - Scan for new messages
curl -X POST http://localhost:3000/api/message-agent \
  -H "Content-Type: application/json" \
  -d '{"accountId": "account-1", "action": "scan"}'

# Message Agent - Send AI replies
curl -X POST http://localhost:3000/api/message-agent \
  -H "Content-Type: application/json" \
  -d '{"accountId": "account-1", "action": "reply", "maxReplies": 5}'
```

### Checking Status

```bash
# Health check
curl http://localhost:3000/api/agents/heartbeat

# Message agent stats
curl "http://localhost:3000/api/message-agent/stats?accountId=account-1"

# List contacts
curl "http://localhost:3000/api/message-agent/contacts?accountId=account-1"
```

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Browser won't launch | Missing session | Re-login via `/dashboard/accounts` |
| Posts not extracted | Facebook UI changed | Update selectors in `facebook-selectors.ts` |
| AI not responding | API quota exceeded | Check Azure OpenAI limits |
| Messages not detected | Unread badge hidden | Use `init` action to full scan |
| Lead not linked | Name mismatch | Manually link in dashboard |
| Contact stuck in WAITING | They never replied | Run `maintenance` to archive |

### Debug Mode

Enable debug logging in agent config:

```typescript
const config = {
  // ...
  debug: true,
  headless: false,  // Show browser window
};
```

### Checking Logs

1. **Testing Dashboard**: View logs in real-time
2. **Database**: Check `ScheduleExecution` table
3. **Browser Console**: Playwright logs

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                        FB LEADS SYSTEM                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │   NEXT.JS   │    │   PRISMA    │    │     PLAYWRIGHT      │ │
│  │   Frontend  │◄──▶│   Database  │◄──▶│   Browser Control   │ │
│  │   + API     │    │  PostgreSQL │    │   (Chromium)        │ │
│  └─────────────┘    └─────────────┘    └─────────────────────┘ │
│         │                  │                    │               │
│         │                  │                    │               │
│         ▼                  ▼                    ▼               │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                      AGENTS LAYER                           ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ ││
│  │  │  First-Time  │ │  Lead Gen    │ │    Message Agent     │ ││
│  │  │   Scraper    │ │   Agent      │ │   (PostgreSQL)       │ ││
│  │  └──────────────┘ └──────────────┘ └──────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                   PROCEDURES LIBRARY                        ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │  Browser │ Human │ Scraping │ AI │ Messenger │ Selectors   ││
│  │   P1-P2  │ P3-P4 │  P5-P7   │P8-9│  P14-P18  │   Utils     ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    EXTERNAL SERVICES                        ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │     Facebook      │     Azure OpenAI     │      Neon       ││
│  │   (Groups, DMs)   │   (AI Analysis)      │   (PostgreSQL)  ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Future Improvements

See [ROADMAP.md](../ROADMAP.md) for planned features:

- [ ] Multi-account rotation with load balancing
- [ ] AI conversation memory across sessions
- [ ] WhatsApp integration
- [ ] Advanced analytics dashboard
- [ ] A/B testing for AI responses
- [ ] Auto-scheduling optimization based on engagement

---

*Last updated: Comprehensive documentation for FB Leads Agent System*
