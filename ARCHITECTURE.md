# 🎯 Italian AI Lead Scraper & Control Plane

> Automated lead detection system for Facebook groups using AI-powered qualification and human-like engagement.

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Anti-Ban Strategy](#anti-ban-strategy)
4. [Account Rotation System](#account-rotation-system)
5. [Database Schema](#database-schema)
6. [Worker Agent Specification](#worker-agent-specification)
7. [AI Pipeline](#ai-pipeline)
8. [Control Plane Dashboard](#control-plane-dashboard)
9. [API Endpoints](#api-endpoints)
10. [Deployment Guide](#deployment-guide)
11. [Environment Variables](#environment-variables)
12. [KPIs & Monitoring](#kpis--monitoring)

---

## 🎯 Project Overview

### Purpose
Automatically detect potential leads from targeted Facebook groups, qualify them using Azure OpenAI, engage with contextual Italian responses containing your WhatsApp contact, and track high-intent conversations through a centralized dashboard.

### Core Flow
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Facebook       │────▶│  AI Analysis    │────▶│  Engagement     │
│  Group Scraping │     │  (Azure OpenAI) │     │  (Comment/DM)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Neon PostgreSQL Database                      │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│              Next.js Control Plane Dashboard                     │
│         (Live Feed • Agent Monitor • Conversations)              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ System Architecture

### Three-Tier Design

| Tier | Component | Technology | Location |
|------|-----------|------------|----------|
| **Edge** | Worker Agents | Node.js + Playwright | Italian VMs |
| **Brain** | Cognitive Engine | Azure OpenAI (GPT-4o) | Cloud |
| **Control** | Dashboard | Next.js + Clerk | Vercel |

### Infrastructure

```
                    ┌──────────────────────────────────────┐
                    │         Control Plane (Vercel)       │
                    │    Next.js 16 • Clerk Auth • SSE     │
                    └──────────────────┬───────────────────┘
                                       │
                    ┌──────────────────┴───────────────────┐
                    │         Neon PostgreSQL              │
                    │    Serverless • Global Sync          │
                    └──────────────────┬───────────────────┘
                                       │
        ┌──────────────┬───────────────┼───────────────┬──────────────┐
        ▼              ▼               ▼               ▼              ▼
   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
   │  VM 1   │    │  VM 2   │    │  VM 3   │    │  VM 4   │    │ Azure   │
   │ Account │    │ Account │    │ Account │    │ Account │    │ OpenAI  │
   │    A    │    │    B    │    │    C    │    │    D    │    │  GPT-4o │
   └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
        │              │               │               │
        └──────────────┴───────────────┴───────────────┘
                          Italian IPs Only
```

---

## 🛡️ Anti-Ban Strategy

### The Golden Rules

> **Goal**: Zero account suspensions through perfect human behavior simulation.

### 1. Session Management
```javascript
// Persistent login via storageState
const context = await browser.newContext({
  storageState: './sessions/account-a.json',
  locale: 'it-IT',
  timezoneId: 'Europe/Rome'
});
```
- **Never** re-authenticate daily
- Save cookies after each session
- Use Italian locale and timezone

### 2. Behavioral Mimicry

| Action | Human Delay | Implementation |
|--------|-------------|----------------|
| Page Load → First Action | 3-8 seconds | `randomDelay(3000, 8000)` |
| Between Scrolls | 1-3 seconds | `randomDelay(1000, 3000)` |
| Before Click | 0.5-1.5 seconds | `randomDelay(500, 1500)` |
| Typing Speed | 50-150ms/char | `typeWithHumanSpeed()` |
| Reading Post | 5-15 seconds | `simulateReading(postLength)` |

### 3. Session Warming
```javascript
async function warmSession(page) {
  // Visit non-target pages first (2-5 min)
  await page.goto('https://facebook.com');
  await randomDelay(30000, 60000);
  
  await page.goto('https://facebook.com/notifications');
  await simulateScroll(page, 3);
  await randomDelay(20000, 40000);
  
  // Maybe check a friend's profile
  if (Math.random() > 0.7) {
    await visitRandomFriend(page);
  }
}
```

### 4. Action Limits (Per Account/Day)

| Action Type | Safe Limit | Hard Cap |
|-------------|------------|----------|
| Group Visits | 20 | 25 |
| Post Comments | 15 | 20 |
| Direct Messages | 8 | 10 |
| Profile Views | 30 | 40 |
| Total Actions | 80 | 100 |

### 5. User-Agent Rotation
```javascript
const userAgents = [
  // Chrome on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
  // Chrome on Mac
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1) AppleWebKit/537.36 Chrome/120.0.0.0',
  // Firefox on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  // Safari on Mac
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1) AppleWebKit/605.1.15 Safari/605.1.15'
];
```

### 6. Headful Mode with xvfb
```bash
# On Ubuntu VM
sudo apt install xvfb
Xvfb :99 -screen 0 1920x1080x24 &
export DISPLAY=:99

# Launch browser in headful mode (not headless!)
```

---

## 🔄 Account Rotation System

### 4-Account Distribution

```
┌─────────────────────────────────────────────────────────────────┐
│                    GROUP ASSIGNMENT MATRIX                       │
├─────────────────┬───────────┬───────────┬───────────┬───────────┤
│     Groups      │ Account A │ Account B │ Account C │ Account D │
├─────────────────┼───────────┼───────────┼───────────┼───────────┤
│ Group 1-5       │     ●     │           │           │           │
│ Group 6-10      │           │     ●     │           │           │
│ Group 11-15     │           │           │     ●     │           │
│ Group 16-20     │           │           │           │     ●     │
├─────────────────┼───────────┼───────────┼───────────┼───────────┤
│ Max Groups/Acc  │     5     │     5     │     5     │     5     │
└─────────────────┴───────────┴───────────┴───────────┴───────────┘
```

### Weekly Rotation Strategy
```javascript
// Rotate group assignments every Monday
function getAccountForGroup(groupId, weekNumber) {
  const accounts = ['A', 'B', 'C', 'D'];
  const rotation = (groupId + weekNumber) % 4;
  return accounts[rotation];
}
```

### Load Balancing Rules
1. **Primary Assignment**: Each group has a primary account
2. **Fallback**: If primary is rate-limited, use next account in rotation
3. **Cool-down**: Account rests 2 hours if approaching limits
4. **Recovery**: Failed account excluded for 24 hours

### Per-Account Daily Schedule

| Time Slot | Account A | Account B | Account C | Account D |
|-----------|-----------|-----------|-----------|-----------|
| 08:00-12:00 | Groups 1-5 | Groups 6-10 | Groups 11-15 | Groups 16-20 |
| 12:00-14:00 | **Peak** 2x/hr | **Peak** 2x/hr | **Peak** 2x/hr | **Peak** 2x/hr |
| 14:00-19:00 | Normal 1x/hr | Normal 1x/hr | Normal 1x/hr | Normal 1x/hr |
| 19:00-22:00 | **Peak** 2x/hr | **Peak** 2x/hr | **Peak** 2x/hr | **Peak** 2x/hr |
| 22:00-00:00 | Normal 1x/hr | Normal 1x/hr | Normal 1x/hr | Normal 1x/hr |

---

## 🗄️ Database Schema

### Entity Relationship Diagram

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│    agents    │       │    groups    │       │    leads     │
├──────────────┤       ├──────────────┤       ├──────────────┤
│ id (PK)      │       │ id (PK)      │       │ id (PK)      │
│ account_email│       │ url          │◄──────│ group_id(FK) │
│ vm_host      │       │ name         │       │ post_url     │
│ status       │       │ priority     │       │ author_name  │
│ last_heartbeat│      │ assigned_acc │       │ author_id    │
│ daily_actions│       │ last_scraped │       │ post_text    │
│ is_healthy   │       │ scrapes_today│       │ ai_analysis  │
│ created_at   │       │ is_active    │       │ intent_score │
└──────────────┘       └──────────────┘       │ status       │
                                              │ created_at   │
                                              └──────────────┘
                                                     │
                                                     ▼
                              ┌──────────────────────────────────┐
                              │          conversations           │
                              ├──────────────────────────────────┤
                              │ id (PK)                          │
                              │ lead_id (FK)                     │
                              │ our_comment                      │
                              │ our_dm                           │
                              │ lead_replied                     │
                              │ reply_text                       │
                              │ is_high_intent                   │
                              │ last_activity                    │
                              └──────────────────────────────────┘
```

### Table Definitions

#### `agents`
```sql
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_email VARCHAR(255) NOT NULL UNIQUE,
  account_name VARCHAR(255),
  vm_host VARCHAR(255) NOT NULL,
  vm_ip INET,
  status VARCHAR(20) DEFAULT 'offline', -- online, offline, rate_limited, banned
  last_heartbeat TIMESTAMP WITH TIME ZONE,
  daily_comments INTEGER DEFAULT 0,
  daily_dms INTEGER DEFAULT 0,
  daily_scrapes INTEGER DEFAULT 0,
  is_healthy BOOLEAN DEFAULT true,
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### `groups`
```sql
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  member_count INTEGER,
  priority INTEGER DEFAULT 5, -- 1 (highest) to 10 (lowest)
  assigned_account_id UUID REFERENCES agents(id),
  last_scraped TIMESTAMP WITH TIME ZONE,
  scrapes_today INTEGER DEFAULT 0,
  total_leads INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### `leads`
```sql
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  post_url TEXT NOT NULL UNIQUE,
  author_name VARCHAR(255),
  author_profile_url TEXT,
  author_fb_id VARCHAR(100),
  post_text TEXT NOT NULL,
  post_date TIMESTAMP WITH TIME ZONE,
  
  -- AI Analysis (JSONB)
  ai_analysis JSONB,
  /*
    {
      "need_type": "web development",
      "urgency": 4,
      "budget_mentioned": true,
      "budget_range": "1000-5000€",
      "key_requirements": ["e-commerce", "mobile responsive"],
      "sentiment": "urgent",
      "language": "italian",
      "suggested_response": "Ciao! Ho visto il tuo post..."
    }
  */
  
  intent_score INTEGER DEFAULT 0, -- 1-5, 5 = highest intent
  status VARCHAR(20) DEFAULT 'new', -- new, commented, dm_sent, responded, converted, archived
  
  scraped_by UUID REFERENCES agents(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### `conversations`
```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) UNIQUE,
  
  -- Our engagement
  comment_text TEXT,
  comment_posted_at TIMESTAMP WITH TIME ZONE,
  dm_text TEXT,
  dm_sent_at TIMESTAMP WITH TIME ZONE,
  
  -- Lead's response
  lead_replied BOOLEAN DEFAULT false,
  reply_text TEXT,
  reply_received_at TIMESTAMP WITH TIME ZONE,
  
  -- Tracking
  whatsapp_shared BOOLEAN DEFAULT false,
  is_high_intent BOOLEAN DEFAULT false,
  notes TEXT,
  
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### `logs`
```sql
CREATE TABLE logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id),
  level VARCHAR(10) NOT NULL, -- info, warn, error, debug
  action VARCHAR(50), -- scrape, comment, dm, heartbeat, error
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 🤖 Worker Agent Specification

### Directory Structure
```
worker/
├── src/
│   ├── index.ts              # Main entry point
│   ├── scheduler/
│   │   ├── cron.ts           # Time-based scheduling
│   │   └── jitter.ts         # Random delay utilities
│   ├── scraper/
│   │   ├── browser.ts        # Playwright setup
│   │   ├── facebook.ts       # FB-specific scraping logic
│   │   ├── session.ts        # Cookie/session management
│   │   └── humanize.ts       # Human behavior simulation
│   ├── engagement/
│   │   ├── comment.ts        # Post commenting
│   │   └── dm.ts             # Direct messaging
│   ├── api/
│   │   ├── heartbeat.ts      # Send status to control plane
│   │   ├── leads.ts          # Submit leads to DB
│   │   └── ai.ts             # Request AI analysis
│   └── utils/
│       ├── logger.ts         # Structured logging
│       ├── config.ts         # Environment config
│       └── random.ts         # Randomization helpers
├── sessions/                  # storageState JSON files
│   ├── account-a.json
│   ├── account-b.json
│   ├── account-c.json
│   └── account-d.json
├── package.json
├── tsconfig.json
└── ecosystem.config.js       # PM2 configuration
```

### Scheduling Logic
```typescript
// scheduler/cron.ts
import { CronJob } from 'cron';

const ROME_TZ = 'Europe/Rome';

// Peak hours: 12-14, 19-22 (2 runs/hour)
// Normal hours: 08-12, 14-19, 22-24 (1 run/hour)
const PEAK_HOURS = [12, 13, 19, 20, 21];

function isPeakHour(hour: number): boolean {
  return PEAK_HOURS.includes(hour);
}

function scheduleNextRun() {
  const now = new Date();
  const hour = now.getHours();
  
  // Add jitter: 1-5 minutes random delay
  const jitterMs = randomBetween(60_000, 300_000);
  
  // Determine interval based on peak/normal
  const intervalMs = isPeakHour(hour) ? 30 * 60_000 : 60 * 60_000;
  
  setTimeout(() => {
    runScrapeCycle();
    scheduleNextRun();
  }, intervalMs + jitterMs);
}
```

### Human Simulation
```typescript
// scraper/humanize.ts

export async function humanScroll(page: Page) {
  const scrolls = randomBetween(3, 7);
  
  for (let i = 0; i < scrolls; i++) {
    // Random scroll distance
    const distance = randomBetween(300, 800);
    await page.mouse.wheel({ deltaY: distance });
    
    // Random pause (humans don't scroll continuously)
    await delay(randomBetween(1000, 3000));
    
    // Sometimes scroll back up a bit
    if (Math.random() > 0.7) {
      await page.mouse.wheel({ deltaY: -randomBetween(100, 200) });
      await delay(randomBetween(500, 1500));
    }
  }
}

export async function humanType(page: Page, selector: string, text: string) {
  await page.click(selector);
  await delay(randomBetween(300, 800));
  
  for (const char of text) {
    await page.keyboard.type(char);
    // Variable typing speed
    await delay(randomBetween(50, 150));
    
    // Occasional longer pause (thinking)
    if (Math.random() > 0.95) {
      await delay(randomBetween(500, 1500));
    }
  }
}

export async function moveMouseNaturally(page: Page, x: number, y: number) {
  // Get current position
  const current = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
  
  // Move in small increments with slight randomness
  const steps = randomBetween(5, 15);
  const dx = (x - current.x) / steps;
  const dy = (y - current.y) / steps;
  
  for (let i = 0; i < steps; i++) {
    await page.mouse.move(
      current.x + dx * i + randomBetween(-5, 5),
      current.y + dy * i + randomBetween(-5, 5)
    );
    await delay(randomBetween(10, 30));
  }
}
```

### PM2 Configuration
```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'fb-worker-account-a',
      script: './dist/index.js',
      env: {
        ACCOUNT_ID: 'account-a',
        NODE_ENV: 'production'
      },
      cron_restart: '0 8 * * *', // Restart daily at 8 AM
      max_memory_restart: '500M'
    },
    {
      name: 'fb-worker-account-b',
      script: './dist/index.js',
      env: {
        ACCOUNT_ID: 'account-b',
        NODE_ENV: 'production'
      },
      cron_restart: '0 8 * * *',
      max_memory_restart: '500M'
    },
    // ... accounts C and D
  ]
};
```

---

## 🧠 AI Pipeline

### Azure OpenAI Configuration
```typescript
// Using Vercel AI SDK with Azure provider
import { createAzure } from '@ai-sdk/azure';
import { generateObject } from 'ai';
import { z } from 'zod';

const azure = createAzure({
  resourceName: process.env.AZURE_OPENAI_RESOURCE_NAME,
  apiKey: process.env.AZURE_OPENAI_API_KEY,
});

const model = azure('gpt-4o'); // or 'gpt-4o-mini' for cost savings
```

### Lead Analysis Schema
```typescript
const LeadAnalysisSchema = z.object({
  need_type: z.string().describe('Type of service needed (e.g., web development, app, design)'),
  urgency: z.number().min(1).max(5).describe('1=low, 5=very urgent'),
  budget_mentioned: z.boolean(),
  budget_range: z.string().optional(),
  key_requirements: z.array(z.string()),
  sentiment: z.enum(['casual', 'interested', 'urgent', 'desperate']),
  language: z.string(),
  intent_score: z.number().min(1).max(5).describe('Overall lead quality'),
  suggested_response: z.string().describe('Natural Italian response with WhatsApp mention'),
});
```

### Analysis Prompt
```typescript
async function analyzePost(postText: string, authorName: string) {
  const result = await generateObject({
    model,
    schema: LeadAnalysisSchema,
    prompt: `
You are an Italian business development expert for a web/mobile development agency.
Analyze this Facebook group post and determine if it's a potential lead.

Post Author: ${authorName}
Post Content: "${postText}"

Instructions:
1. Identify what service they need
2. Rate urgency (1-5)
3. Note any budget mentions
4. List key requirements
5. Generate a friendly, professional Italian response that:
   - Acknowledges their specific need
   - Briefly mentions relevant experience
   - Ends with "Scrivimi su WhatsApp al [WHATSAPP_NUMBER] per parlarne!"
   - Sounds natural, not salesy

If this is NOT a lead (random post, meme, etc.), set intent_score to 1.
`,
  });

  return result.object;
}
```

### Response Templates
The AI generates contextual responses, but here are base patterns:

```typescript
const RESPONSE_PATTERNS = {
  web_development: [
    "Ciao {name}! Ho letto il tuo post riguardo {need}. Lavoro con un team di sviluppatori e abbiamo realizzato progetti simili. Scrivimi su WhatsApp al {whatsapp} per parlarne senza impegno! 👋",
    "Hey {name}! Sembra un progetto interessante. Ho esperienza con {requirements}. Se vuoi ne parliamo su WhatsApp: {whatsapp} 📱",
  ],
  app_development: [
    "Ciao {name}! Sviluppo app da anni e {need} sembra fattibile. Contattami su WhatsApp {whatsapp} per un preventivo gratuito! 💪",
  ],
  urgent: [
    "Ciao {name}! Ho visto che hai bisogno di {need} urgentemente. Posso aiutarti subito - scrivimi su WhatsApp {whatsapp} 🚀",
  ],
};
```

---

## 🖥️ Control Plane Dashboard

### Page Structure
```
app/
├── (auth)/
│   ├── sign-in/[[...sign-in]]/page.tsx
│   └── sign-up/[[...sign-up]]/page.tsx
├── (dashboard)/
│   ├── layout.tsx           # Sidebar + Header
│   ├── page.tsx             # Dashboard overview
│   ├── leads/
│   │   ├── page.tsx         # All leads table
│   │   └── [id]/page.tsx    # Lead detail view
│   ├── high-intent/
│   │   └── page.tsx         # High-intent leads only
│   ├── conversations/
│   │   └── page.tsx         # Conversation tracker
│   ├── agents/
│   │   └── page.tsx         # VM/Account monitor
│   ├── groups/
│   │   └── page.tsx         # Group management
│   └── analytics/
│       └── page.tsx         # Charts & stats
├── api/
│   ├── agents/
│   │   ├── route.ts         # GET all, POST create
│   │   ├── [id]/route.ts    # GET, PATCH, DELETE
│   │   └── heartbeat/route.ts
│   ├── leads/
│   │   ├── route.ts
│   │   └── [id]/route.ts
│   ├── groups/
│   │   └── route.ts
│   ├── conversations/
│   │   └── route.ts
│   ├── ai/
│   │   └── analyze/route.ts
│   └── stream/
│       └── route.ts         # SSE for live updates
└── layout.tsx
```

### Dashboard Features

#### 1. Live Feed (Real-time Leads)
- Server-Sent Events for instant updates
- Filter by intent score, status, group
- Quick actions: Approve comment, Send DM, Archive

#### 2. High-Intent View
- Only shows leads with `intent_score >= 4`
- AI-suggested response editable before posting
- One-click approve & send

#### 3. Agent Monitor
```
┌─────────────────────────────────────────────────────────────────┐
│  AGENT MONITOR                                      🟢 4 Online │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  🟢 Account A (mario.rossi@gmail.com)                           │
│     VM: worker-1.italy.example.com                              │
│     Last Heartbeat: 2 min ago                                   │
│     Today: 12 scrapes • 8 comments • 3 DMs                      │
│     Status: Active - Scraping Group "Sviluppatori Italiani"     │
│                                                                  │
│  🟢 Account B (luigi.verdi@gmail.com)                           │
│     VM: worker-2.italy.example.com                              │
│     Last Heartbeat: 1 min ago                                   │
│     Today: 10 scrapes • 6 comments • 2 DMs                      │
│     Status: Active - Cooling down (next run in 23 min)          │
│                                                                  │
│  🟡 Account C (anna.bianchi@gmail.com)                          │
│     VM: worker-3.italy.example.com                              │
│     Last Heartbeat: 5 min ago                                   │
│     Today: 8 scrapes • 15 comments • 5 DMs                      │
│     Status: Warning - Approaching daily comment limit           │
│                                                                  │
│  🟢 Account D (paolo.neri@gmail.com)                            │
│     VM: worker-4.italy.example.com                              │
│     Last Heartbeat: 30 sec ago                                  │
│     Today: 11 scrapes • 7 comments • 4 DMs                      │
│     Status: Active - Sending DM to lead #1847                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 4. Conversation Tracker
- View all engaged leads
- Track who replied
- Mark leads as "WhatsApp Connected"
- Add notes

#### 5. Analytics Dashboard
- Leads per hour chart
- Leads per group breakdown
- Conversion funnel: Scraped → Commented → Replied → Converted
- Best performing times/groups

---

## 🔌 API Endpoints

### Agents
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agents` | List all agents |
| POST | `/api/agents` | Register new agent |
| GET | `/api/agents/[id]` | Get agent details |
| PATCH | `/api/agents/[id]` | Update agent status |
| POST | `/api/agents/heartbeat` | Agent heartbeat (every 1 min) |

### Leads
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/leads` | List leads (with filters) |
| POST | `/api/leads` | Create new lead |
| GET | `/api/leads/[id]` | Get lead detail |
| PATCH | `/api/leads/[id]` | Update lead status |
| DELETE | `/api/leads/[id]` | Archive lead |

### Groups
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/groups` | List all groups |
| POST | `/api/groups` | Add new group |
| PATCH | `/api/groups/[id]` | Update group settings |
| DELETE | `/api/groups/[id]` | Deactivate group |

### AI
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/analyze` | Analyze post with AI |

### Real-time
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stream` | SSE stream for live updates |

---

## 🚀 Deployment Guide

### 1. Control Plane (Vercel)

```bash
# Install dependencies
npm install

# Set up environment variables in Vercel dashboard
# Deploy
vercel --prod
```

### 2. Database (Neon)

1. Create project at console.neon.tech
2. Copy connection string
3. Run migrations:
```bash
npx drizzle-kit push
```

### 3. Worker VMs (Italy)

```bash
# On each Ubuntu 22.04 VM

# Install dependencies
sudo apt update
sudo apt install -y nodejs npm xvfb

# Install Playwright browsers
npx playwright install chromium
npx playwright install-deps

# Clone worker code
git clone <repo> /opt/fb-worker
cd /opt/fb-worker

# Install PM2
npm install -g pm2

# Configure environment
cp .env.example .env
nano .env  # Add credentials

# Start workers
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 4. Session Setup (One-time per account)

```bash
# Run interactive login script
node scripts/setup-session.js --account=account-a

# This opens browser, you log in manually
# Session saved to sessions/account-a.json
```

---

## 🔐 Environment Variables

### Control Plane (.env.local)
```env
# Database
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require

# Clerk Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxx
CLERK_SECRET_KEY=sk_live_xxx
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# Azure OpenAI
AZURE_OPENAI_RESOURCE_NAME=your-resource
AZURE_OPENAI_API_KEY=xxx
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o

# WhatsApp (for response templates)
WHATSAPP_NUMBER=+39xxxxxxxxxx
```

### Worker (.env)
```env
# Control Plane API
CONTROL_PLANE_URL=https://your-app.vercel.app
CONTROL_PLANE_API_KEY=xxx

# This VM's identity
AGENT_ID=account-a
VM_HOST=worker-1.italy.example.com

# Browser
DISPLAY=:99
```

---

## 📊 KPIs & Monitoring

### Success Metrics

| KPI | Target | Measurement |
|-----|--------|-------------|
| **Uptime** | 99% during 08:00-00:00 | Heartbeat monitoring |
| **Zero Bans** | 0 account suspensions | Manual verification |
| **Scrape Volume** | 14-20 scrapes/group/day | Database count |
| **AI Accuracy** | >90% relevant analysis | Human review sample |
| **Response Rate** | >10% leads reply | Conversation tracking |
| **Conversion** | >2% to WhatsApp contact | Manual tracking |

### Alerting Rules

```typescript
// Alert conditions
const alerts = {
  // Agent offline for >10 minutes
  agentOffline: (lastHeartbeat: Date) => 
    Date.now() - lastHeartbeat.getTime() > 10 * 60 * 1000,
  
  // Approaching daily limits
  nearingLimit: (daily: number, max: number) => 
    daily >= max * 0.8,
  
  // Unusual error rate
  highErrorRate: (errors: number, total: number) =>
    total > 10 && (errors / total) > 0.2,
  
  // No new leads in 2 hours
  noLeads: (lastLead: Date) =>
    Date.now() - lastLead.getTime() > 2 * 60 * 60 * 1000,
};
```

### Daily Report (Auto-generated)
- Total leads scraped
- Leads by intent score breakdown
- Comments/DMs sent per account
- Any errors or warnings
- Top performing groups

---

## 📝 Quick Reference

### Scraping Schedule
- **08:00 - 12:00**: Normal (1x/hr)
- **12:00 - 14:00**: Peak (2x/hr)
- **14:00 - 19:00**: Normal (1x/hr)
- **19:00 - 22:00**: Peak (2x/hr)
- **22:00 - 00:00**: Normal (1x/hr)
- **00:00 - 08:00**: OFF

### Lead Status Flow
```
NEW → COMMENTED → DM_SENT → RESPONDED → CONVERTED
                                    ↓
                               ARCHIVED
```

### Intent Score Guide
| Score | Meaning | Action |
|-------|---------|--------|
| 5 | Very high intent, urgent | Immediate DM |
| 4 | High intent, clear need | Comment + DM |
| 3 | Medium intent | Comment only |
| 2 | Low intent | Skip or low priority |
| 1 | Not a lead | Ignore |

---

## 🛠️ Troubleshooting

### Common Issues

**Agent shows offline:**
- Check VM is running: `pm2 status`
- Check network: `curl https://control-plane-url/api/health`
- Check logs: `pm2 logs fb-worker-account-a`

**Session expired:**
- Re-run session setup script
- Check if account was temporarily locked

**Rate limit warning:**
- Reduce daily caps in config
- Check if one group is generating too many leads

**AI responses low quality:**
- Review and refine prompt
- Add more context to analysis request
- Consider using GPT-4o instead of mini

---

## 📞 Support Contacts

- **Technical Issues**: Check logs first, then escalate
- **Account Issues**: Manual review required
- **Database**: Neon dashboard for monitoring

---

*Last Updated: December 2024*
