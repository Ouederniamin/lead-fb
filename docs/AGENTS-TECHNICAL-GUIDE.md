# FB Leads - Agents Technical Guide

> Complete technical documentation for the Lead Generation Agent System

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Agents](#agents)
   - [Lead Gen Agent](#1-lead-gen-agent)
   - [First-Time Scraper](#2-first-time-scraper)
   - [Message Agent](#3-message-agent)
3. [Procedures (Core Functions)](#procedures-core-functions)
4. [Testing Dashboard](#testing-dashboard-dashboardagentstesting)
5. [API Routes](#api-routes)
6. [Database Schema](#database-schema)
7. [Configuration Files](#configuration-files)
8. [Flow Diagrams](#flow-diagrams)
9. [Known Issues & Solutions](#known-issues--solutions)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FB Leads System                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐               │
│  │  Dashboard   │    │   Testing    │    │   Schedule   │               │
│  │    (UI)      │    │    Page      │    │   Manager    │               │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘               │
│         │                   │                   │                        │
│         ▼                   ▼                   ▼                        │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │                      API Routes                              │        │
│  │  /api/agents/test/lead-gen                                   │        │
│  │  /api/agents/test/first-time-scraper                         │        │
│  │  /api/agents/test/message-agent                              │        │
│  │  /api/agents/schedule                                        │        │
│  └──────────────────────────┬──────────────────────────────────┘        │
│                             │                                            │
│                             ▼                                            │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │                        AGENTS                                │        │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │        │
│  │  │ Lead Gen    │  │ First-Time  │  │  Message    │          │        │
│  │  │   Agent     │  │  Scraper    │  │   Agent     │          │        │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │        │
│  └─────────┼────────────────┼────────────────┼─────────────────┘        │
│            │                │                │                           │
│            ▼                ▼                ▼                           │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │                      PROCEDURES                              │        │
│  │  browser.ts │ scraping.ts │ ai.ts │ human-behavior.ts       │        │
│  │  facebook-selectors.ts │ engagement.ts │ messaging.ts        │        │
│  └──────────────────────────┬──────────────────────────────────┘        │
│                             │                                            │
│                             ▼                                            │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │                 EXTERNAL SERVICES                            │        │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │        │
│  │  │ Playwright│  │  Azure   │  │  Neon    │                   │        │
│  │  │ (Browser) │  │ OpenAI   │  │ Postgres │                   │        │
│  │  └──────────┘  └──────────┘  └──────────┘                   │        │
│  └─────────────────────────────────────────────────────────────┘        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 15.1.1, React 19, TailwindCSS, shadcn/ui |
| Backend | Next.js API Routes, TypeScript |
| Browser Automation | Playwright (Chromium) |
| AI Analysis | Azure OpenAI (gpt-4o-mini) |
| Database | Neon PostgreSQL + Prisma ORM |
| Authentication | Clerk |
| Scheduling | Custom scheduler with hourly configuration |

---

## Agents

### 1. Lead Gen Agent

**File:** `agents/lead-gen-agent.ts`

**Purpose:** Scrapes Facebook groups for new posts, analyzes them with AI, and identifies potential leads (people looking for services).

#### Input Interface

```typescript
interface LeadGenInput {
  accountId: string;              // Facebook account profile ID
  groups: Array<{
    id: string;
    url: string;
    lastScrapedPostUrl: string | null;
  }>;
  headless?: boolean;             // Default: false (visible browser)
  maxPosts?: number;              // Default: 30
  autoComment?: boolean;          // Future: auto-comment on leads
  autoDM?: boolean;               // Future: auto-DM lead authors
  skipScheduleCheck?: boolean;    // For testing
}
```

#### Output Interface

```typescript
interface LeadGenResult {
  success: boolean;
  agentType: "LEAD_GEN";
  startedAt: Date;
  completedAt: Date;
  duration: number;
  logs: string[];
  errors: string[];
  stats: {
    groupsProcessed: number;
    postsScraped: number;
    postsAnalyzed: number;
    leadsCreated: number;
    commentsPosted: number;
    friendRequestsSent: number;
    dmsSent: number;
  };
  groupResults: LeadGenGroupResult[];
}
```

#### Flow

```
1. Launch Browser (with saved session)
2. Warmup Session (verify login)
3. For each group:
   a. Navigate to group (chronological sorting)
   b. PHASE 1: Scroll to load 120% of requested posts
   c. PHASE 2: Count post containers
   d. PHASE 3: Extract post links via Share → Copy Link
   e. PHASE 4: Visit each post URL to extract content
   f. Filter out notification posts
   g. Parallel AI Analysis (batches of 10)
   h. Mark leads, log results
4. Close browser
5. Return results
```

#### AI Analysis (Parallel)

```typescript
// Processes 10 posts at a time for speed
const BATCH_SIZE = 10;

// Each post analyzed in parallel
const batchResults = await Promise.all(
  batch.map(async (post) => {
    const analysis = await analyzePostForLead(post.content, log);
    return { post, analysis };
  })
);
```

#### AI Lead Criteria

The AI marks a post as a lead ONLY if:
- ✅ Person wants a PROJECT done (website, app, design, etc.)
- ✅ They are a CLIENT looking for freelancer/agency

The AI REJECTS:
- ❌ Job offers / Employment (CDI, poste, recrute)
- ❌ Internships (stage, PFE, stagiaire)
- ❌ Equity / Partnership offers
- ❌ Startup seeking team members
- ❌ Free work requests
- ❌ People offering their own services

---

### 2. First-Time Scraper

**File:** `agents/first-time-scraper.ts`

**Purpose:** Scrapes historical posts when a group is first added to the system.

#### Input Interface

```typescript
interface FirstTimeScraperInput {
  groupUrl: string;
  groupId: string;
  accountId: string;
  headless?: boolean;
}
```

#### Output Interface

```typescript
interface FirstTimeScraperResult {
  success: boolean;
  agentType: "FIRST_TIME_SCRAPER";
  startedAt: Date;
  completedAt: Date;
  duration: number;
  logs: string[];
  errors: string[];
  stats: {
    postsScraped: number;
    postsSaved: number;
  };
  lastScrapedPostUrl?: string;
}
```

#### Flow

```
1. Launch Browser
2. Warmup Session
3. Navigate to group
4. Full Scrape (up to 50 posts)
5. Save lastScrapedPostUrl for incremental scraping
6. Close browser
7. Return results
```

---

### 3. Message Agent

**File:** `agents/message-agent.ts`

**Purpose:** Handles incoming Facebook Messenger conversations with AI-generated responses.

#### Input Interface

```typescript
interface MessageAgentInput {
  accountId: string;
  maxCycles?: number;        // Default: 5
  idleTimeoutMs?: number;    // Default: 30000 (30s)
  headless?: boolean;
}
```

#### Features

- Monitors Messenger for unread conversations
- Generates AI responses based on conversation context
- Uses services knowledge base for accurate replies
- Human-like typing and response delays

---

## Procedures (Core Functions)

**Location:** `agents/procedures/`

### browser.ts

```typescript
// Launch browser with persistent session
export async function launchBrowser(config: BrowserConfig): Promise<BrowserSession>

// Warmup and verify login status
export async function warmupSession(page: Page, log: Function): Promise<boolean>

// Close browser safely
export async function closeBrowser(session: BrowserSession): Promise<void>
```

**Key Configuration:**
```typescript
{
  headless: false,              // Facebook blocks headless browsers
  viewport: { width: 1366, height: 768 },
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  permissions: ["geolocation", "clipboard-read", "clipboard-write"],
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
  // Anti-detection args...
}
```

### scraping.ts

```typescript
// Navigate to group with chronological sorting
export async function navigateToGroup(page, groupUrl, log): Promise<boolean>

// Extract posts using 3-phase approach
export async function extractPosts(page, options, log): Promise<ScrapedPost[]>

// Incremental scrape for Lead Gen
export async function incrementalScrape(page, groupUrl, lastScrapedPostUrl, maxPosts, log): Promise<ScrapeResult>

// Full scrape for First-Time Scraper
export async function fullScrape(page, groupUrl, log): Promise<ScrapeResult>
```

**3-Phase Extraction:**
```
PHASE 1: Scroll to load 120% of requested posts
         - Dynamic max scrolls: max(500, maxPosts * 5)
         - Target: ceil(maxPosts * 1.2) items
         - Stop after 10 same-height scrolls

PHASE 2: Count post containers
         - Query: [role="feed"] > div

PHASE 3: Extract links from each post
         - Click Share button
         - Click "Copy link" in menu
         - Read from clipboard
         - Retry failed posts
```

**PHASE 4: Content Extraction**
```
For each post URL:
  1. Navigate to post
  2. Close notification popups
  3. Extract content using multiple methods:
     - Method 1: [data-ad-rendering-role="story_message"]
     - Method 2: [data-ad-comet-preview="message"]
     - Method 3: [dir="auto"] divs with length > 50
     - Method 4: [class*="userContent"]
     - Method 5: Largest text block
  4. Filter out notification content
  5. Extract author info
```

### ai.ts

```typescript
// Services the AI checks for
export const SERVICES_LIST = [
  "تطوير مواقع ويب (Web Development)",
  "تطبيقات موبيل iOS & Android (Mobile Apps)",
  "متاجر إلكترونية E-commerce",
  "Marketing digital و السوشيال ميديا",
  "تصميم جرافيك و UI/UX",
  "أنظمة إدارة (Management Systems)",
  "Automation و Bots",
];

// Analyze post for lead potential
export async function analyzePostForLead(content: string, log: Function): Promise<AIAnalysisResult>

// Generate AI reply for messenger
export async function generateAIReply(fullName, conversation, log): Promise<string>
```

**AIAnalysisResult:**
```typescript
interface AIAnalysisResult {
  isLead: boolean;
  matchedService: string | null;   // Which service they need
  reason: string | null;           // 1 sentence explanation
  keywords: string[];
  suggestedComment: string | null; // Tunisian dialect comment
}
```

### human-behavior.ts

```typescript
// Random delays to appear human
export async function humanDelay(min: number, max: number): Promise<void>
export async function shortDelay(): Promise<void>   // 500-1500ms
export async function mediumDelay(): Promise<void>  // 2000-4000ms
export async function longDelay(): Promise<void>    // 5000-10000ms

// Human-like scrolling
export async function humanScroll(page: Page, amount: number): Promise<void>
```

### facebook-selectors.ts

```typescript
// Selectors for Facebook elements
export const GROUP_SELECTORS = {
  sortDropdown: '[aria-label="Sort"]',
  newPostsOption: '[role="menuitem"]:has-text("New posts")',
  postContainer: '[role="feed"] > div',
  shareButton: '[data-ad-rendering-role="share_button"]',
  // ... more selectors
};

// URL utilities
export function getChronologicalGroupUrl(url: string): string
export function extractPostId(url: string): string | null
export function extractGroupIdFromUrl(url: string): string | null
```

---

## Testing Dashboard (/dashboard/agents/testing)

**File:** `app/dashboard/agents/testing/page.tsx`

### Overview

The testing page provides a UI to manually run and test each agent without the scheduler.

### Tab Structure

```
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│ First-Time      │    Lead Gen     │    Message      │    Schedule     │
│   Scraper       │                 │     Agent       │                 │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

### Tab 1: First-Time Scraper

**Purpose:** Test initial group scraping

**UI Components:**
- Account selector dropdown
- Group URL input
- "Run Scraper" button
- Results: First 3 posts with full content

**API Call:**
```typescript
POST /api/agents/test/first-time-scraper
{
  accountId: string,
  groupUrl: string,
  headless: false
}
```

### Tab 2: Lead Gen

**Purpose:** Test lead generation workflow

**UI Components:**
- Account selector
- Group URL input
- Number of posts to scrape (5-50)
- Services list display (7 services AI checks for)
- "Run Lead Gen" button
- Results: Stats bar + Lead cards with:
  - Matched service badge
  - AI reason sentence
  - Post content
  - Suggested comment
  - Author profile link

**API Call:**
```typescript
POST /api/agents/test/lead-gen
{
  accountId: string,
  groups: [{ url, id, lastScrapedPostUrl }],
  maxPosts: number,
  headless: false
}
```

**Response:**
```typescript
{
  success: boolean,
  duration: number,
  stats: {
    groupsProcessed: number,
    postsScraped: number,
    postsAnalyzed: number,
    leadsCreated: number,
  },
  services: string[],  // SERVICES_LIST
  groupResults: [{
    posts: [{
      postUrl: string,
      content: string,
      authorName: string,
      analysis: {
        isLead: boolean,
        matchedService: string | null,
        reason: string | null,
        suggestedComment: string | null,
      }
    }]
  }]
}
```

### Tab 3: Message Agent

**Purpose:** Test messenger reply agent

**UI Components:**
- Account selector
- Max cycles input (default: 5)
- Idle timeout input (default: 30s)
- "Run Message Agent" button
- Results: Conversations handled + replies sent

**API Call:**
```typescript
POST /api/agents/test/message-agent
{
  accountId: string,
  maxCycles: number,
  idleTimeoutMs: number,
  headless: false
}
```

### Tab 4: Schedule

**Purpose:** Configure hourly agent schedule

**Features:**
- 24-hour grid (0-23)
- Peak hours toggle (13:00-18:00)
- Night mode toggle (23:00-07:00 disabled)
- Randomization toggle
- Save configuration

---

## API Routes

### /api/agents/test/lead-gen

**File:** `app/api/agents/test/lead-gen/route.ts`

```typescript
POST /api/agents/test/lead-gen

// Request
{
  accountId: string,
  groups: Array<{ url: string, id?: string, lastScrapedPostUrl?: string }>,
  headless?: boolean,    // default: false
  maxPosts?: number,     // default: 30
  autoComment?: boolean,
  autoDM?: boolean,
}

// Response
{
  success: boolean,
  duration: number,
  stats: { ... },
  services: string[],
  groupResults: [...],
  errors: string[],
}
```

### /api/agents/test/first-time-scraper

**File:** `app/api/agents/test/first-time-scraper/route.ts`

```typescript
POST /api/agents/test/first-time-scraper

// Request
{
  groupUrl: string,
  groupId?: string,
  accountId: string,
  headless?: boolean,
}

// Response
{
  success: boolean,
  logs: string[],
  errors: string[],
  stats: { postsScraped, postsSaved },
  lastScrapedPostUrl?: string,
}
```

### /api/agents/test/message-agent

**File:** `app/api/agents/test/message-agent/route.ts`

```typescript
POST /api/agents/test/message-agent

// Request
{
  accountId: string,
  maxCycles?: number,
  idleTimeoutMs?: number,
  headless?: boolean,
}

// Response
{
  success: boolean,
  stats: { repliesSent, ... },
  conversationsHandled: [...],
}
```

### /api/agents/schedule

**File:** `app/api/agents/schedule/route.ts`

```typescript
GET /api/agents/schedule
// Returns current schedule configuration

POST /api/agents/schedule
// Update schedule configuration
{
  agentType: "LEAD_GEN" | "MESSAGE_AGENT",
  enabled?: boolean,
  hours?: ScheduleHour[],
  hourConfig?: HourConfig,
}
```

---

## Database Schema

**File:** `prisma/schema.prisma`

### Key Models

```prisma
model Account {
  id              String   @id
  name            String
  fbProfileId     String?
  isActive        Boolean  @default(true)
  lastUsed        DateTime?
  createdAt       DateTime @default(now())
}

model Group {
  id               String   @id @default(cuid())
  url              String   @unique
  name             String?
  isInitialized    Boolean  @default(false)
  initializedAt    DateTime?
  lastScraped      DateTime?
  lastScrapedPostId String?
  totalPosts       Int      @default(0)
  createdAt        DateTime @default(now())
  posts            Post[]
  leads            Lead[]
}

model Post {
  id               String   @id @default(cuid())
  fbPostId         String   @unique
  groupId          String
  group            Group    @relation(fields: [groupId], references: [id])
  content          String
  authorName       String?
  authorProfileUrl String?
  isAnonymous      Boolean  @default(false)
  scrapedAt        DateTime @default(now())
  leads            Lead[]
}

model Lead {
  id              String   @id @default(cuid())
  postId          String
  post            Post     @relation(fields: [postId], references: [id])
  groupId         String
  group           Group    @relation(fields: [groupId], references: [id])
  matchedService  String
  reason          String?
  suggestedComment String?
  status          LeadStatus @default(NEW)
  createdAt       DateTime @default(now())
}

model AgentSchedule {
  id                  String   @id @default(cuid())
  agentType           AgentType
  enabled             Boolean  @default(false)
  timezone            String   @default("Africa/Tunis")
  maxScrapesPerDay    Int      @default(100)
  maxCommentsPerDay   Int      @default(20)
  randomizationEnabled Boolean @default(true)
  hours               Json     // ScheduleHour[]
  hourConfig          Json?    // HourConfig
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}

enum AgentType {
  LEAD_GEN
  MESSAGE_AGENT
  FIRST_TIME_SCRAPER
}

enum LeadStatus {
  NEW
  CONTACTED
  RESPONDED
  CONVERTED
  REJECTED
}
```

---

## Configuration Files

### data/accounts.json

```json
{
  "accounts": [
    {
      "id": "account-1234567890",
      "name": "Account Name",
      "email": "email@example.com",
      "createdAt": "2024-12-28T...",
      "lastLogin": "2024-12-28T..."
    }
  ]
}
```

### data/services.txt

```
NextGen Coding - نقدمو:
- تطوير مواقع ويب (websites)
- تطبيقات موبيل (iOS & Android)
- E-commerce و متاجر إلكترونية
- Marketing digital و إدارة السوشيال ميديا
- تصميم جرافيك و UI/UX
```

### worker/profiles/{accountId}/

Browser profile directory containing cookies, local storage, and session data for each Facebook account.

---

## Flow Diagrams

### Lead Gen Agent Complete Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         LEAD GEN AGENT FLOW                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐                                                       │
│  │   START      │                                                       │
│  └──────┬───────┘                                                       │
│         │                                                                │
│         ▼                                                                │
│  ┌──────────────┐                                                       │
│  │ Check        │──No──▶ Return "Skipped"                               │
│  │ Schedule     │                                                       │
│  └──────┬───────┘                                                       │
│         │ Yes                                                            │
│         ▼                                                                │
│  ┌──────────────┐                                                       │
│  │ Launch       │                                                       │
│  │ Browser      │                                                       │
│  └──────┬───────┘                                                       │
│         │                                                                │
│         ▼                                                                │
│  ┌──────────────┐                                                       │
│  │ Warmup       │──Fail──▶ Error "Not logged in"                        │
│  │ Session      │                                                       │
│  └──────┬───────┘                                                       │
│         │ OK                                                             │
│         ▼                                                                │
│  ┌──────────────────────────────────────────────────────┐               │
│  │                   FOR EACH GROUP                      │               │
│  │  ┌──────────────┐                                    │               │
│  │  │ Navigate to  │                                    │               │
│  │  │ Group        │                                    │               │
│  │  └──────┬───────┘                                    │               │
│  │         │                                            │               │
│  │         ▼                                            │               │
│  │  ┌──────────────┐                                    │               │
│  │  │ PHASE 1:     │ Scroll until 120% posts loaded    │               │
│  │  │ Load Posts   │ Max scrolls: max(500, posts * 5)  │               │
│  │  └──────┬───────┘                                    │               │
│  │         │                                            │               │
│  │         ▼                                            │               │
│  │  ┌──────────────┐                                    │               │
│  │  │ PHASE 2:     │ Count [role="feed"] > div         │               │
│  │  │ Count Posts  │                                    │               │
│  │  └──────┬───────┘                                    │               │
│  │         │                                            │               │
│  │         ▼                                            │               │
│  │  ┌──────────────┐                                    │               │
│  │  │ PHASE 3:     │ Share → Copy Link → Clipboard     │               │
│  │  │ Extract URLs │                                    │               │
│  │  └──────┬───────┘                                    │               │
│  │         │                                            │               │
│  │         ▼                                            │               │
│  │  ┌──────────────┐                                    │               │
│  │  │ PHASE 4:     │ Visit each URL, extract content   │               │
│  │  │ Get Content  │ Filter notification posts          │               │
│  │  └──────┬───────┘                                    │               │
│  │         │                                            │               │
│  │         ▼                                            │               │
│  │  ┌──────────────┐                                    │               │
│  │  │ AI Analysis  │ Parallel batches of 10            │               │
│  │  │ (Parallel)   │ Mark leads, log reason            │               │
│  │  └──────────────┘                                    │               │
│  └──────────────────────────────────────────────────────┘               │
│         │                                                                │
│         ▼                                                                │
│  ┌──────────────┐                                                       │
│  │ Close        │                                                       │
│  │ Browser      │                                                       │
│  └──────┬───────┘                                                       │
│         │                                                                │
│         ▼                                                                │
│  ┌──────────────┐                                                       │
│  │ Return       │                                                       │
│  │ Results      │                                                       │
│  └──────────────┘                                                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Known Issues & Solutions

### 1. Headless Mode Blocked by Facebook

**Issue:** Facebook detects and blocks headless browsers, causing timeout errors.

**Solution:** Always use `headless: false` (visible browser). This is set as default everywhere.

### 2. Clipboard Empty After "Copy Link"

**Issue:** Clicking "Copy link" but clipboard read returns empty.

**Solution:** Added clipboard permissions in browser config:
```typescript
permissions: ["geolocation", "clipboard-read", "clipboard-write"]
```

### 3. Notification Posts Extracted Instead of Content

**Issue:** When user has notifications, visiting a post URL shows notification overlay.

**Solution:** Added notification content filtering:
- Detects "mentioned you", "unread", etc.
- Skips posts marked as notifications
- Logs `⏭️ Skipping notification post`

### 4. Not Enough Posts Loaded

**Issue:** Hardcoded 200 scroll limit wasn't enough for large maxPosts values.

**Solution:** Dynamic scrolling:
```typescript
const targetLoadCount = Math.ceil(maxPosts * 1.2);  // 120% target
const maxScrolls = Math.max(500, maxPosts * 5);     // Dynamic limit
```

### 5. Parallel AI Calls Not Showing Individual Results

**Issue:** Batch AI analysis didn't show per-post results.

**Solution:** Added individual logging inside Promise.all:
```typescript
if (analysis.isLead) {
  log(`   ✅ #${postNum}: LEAD → ${analysis.matchedService}`);
} else {
  log(`   ❌ #${postNum}: Not a lead (${preview}...)`);
}
```

### 6. Session Created in Visible Mode Fails in Headless

**Issue:** Browser profiles created with visible browser don't work in headless.

**Solution:** Keep using visible browser. The anti-detection is more reliable with visible mode.

---

## Environment Variables

```bash
# Database
DATABASE_URL="postgresql://..."

# Clerk Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
CLERK_SECRET_KEY="sk_..."

# Azure OpenAI
AZURE_OPENAI_API_KEY="..."
AZURE_OPENAI_ENDPOINT="https://xxx.openai.azure.com"
AZURE_OPENAI_DEPLOYMENT="gpt-4o-mini"
AZURE_OPENAI_RESOURCE_NAME="xxx"
```

---

## Running the Project

```bash
# Install dependencies
npm install

# Setup database
npx prisma generate
npx prisma db push

# Run development server
npm run dev

# Access testing dashboard
http://localhost:3000/dashboard/agents/testing
```

---

## Future Improvements

1. **Auto-Comment on Leads** - Automatically post suggested comments
2. **Auto-DM Lead Authors** - Send personalized DMs to non-anonymous leads
3. **Lead Scoring** - Prioritize leads based on service match and content
4. **Multi-Account Rotation** - Rotate between accounts to avoid rate limits
5. **Scheduled Background Jobs** - Run agents on schedule via cron/background worker
6. **Analytics Dashboard** - Track leads, conversion rates, response times
7. **A/B Testing Comments** - Test different comment templates

---

*Last updated: December 28, 2025*
