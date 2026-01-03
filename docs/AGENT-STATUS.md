# FB Leads - Agent Status & Roadmap

> **Last Updated:** December 29, 2025

---

## ✅ Agent Status Overview

| Agent | Status | Database | AI Tools | Test Route |
|-------|--------|----------|----------|------------|
| **First-Time Scraper** | ✅ Complete | ✅ PostgreSQL | ✅ Analysis | `/api/agents/test/first-time-scraper` |
| **Lead Gen Agent** | ✅ Complete | ✅ PostgreSQL | ✅ Analysis | `/api/agents/test/lead-gen` |
| **Message Agent** | ✅ Complete | ✅ PostgreSQL | ✅ Tool Calling | `/api/agents/test/message-agent` |
| **Parallel Runner** | ✅ Complete | N/A | N/A | `/api/agents/test/parallel` |

---

## 🧪 Test Routes

### 1. First-Time Scraper

**Endpoint:** `POST /api/agents/test/first-time-scraper`

```json
{
  "groupUrl": "https://www.facebook.com/groups/123456789",
  "groupId": "clxx...",
  "accountId": "account-1",
  "headless": false,
  "maxPosts": 50,
  "analyzeWithAI": true,
  "createLeads": true
}
```

**What it does:**
- Scrapes historical posts from a group
- Analyzes each post with AI (batches of 10)
- Creates leads for qualified posts in PostgreSQL
- Updates group with `isInitialized`, `lastScrapedPostId`

---

### 2. Lead Gen Agent

**Endpoint:** `POST /api/agents/test/lead-gen`

```json
{
  "accountId": "account-1",
  "groups": [
    {
      "id": "clxx...",
      "url": "https://www.facebook.com/groups/123456789",
      "lastScrapedPostUrl": null
    }
  ],
  "headless": false,
  "maxPosts": 30,
  "autoComment": false,
  "autoDM": false
}
```

**What it does:**
- Incremental scrape (only new posts since last check)
- AI analysis in parallel batches
- Creates leads in PostgreSQL
- Updates group `lastScrapedPostId` for next run

---

### 3. Message Agent

**Endpoint:** `POST /api/agents/test/message-agent`

```json
{
  "accountId": "account-1",
  "headless": false,
  "idleTimeoutMs": 60000
}
```

**What it does:**
- Monitors Messenger for unread messages
- Generates AI replies in Tunisian Arabic
- Uses **AI tool calling** to detect stages:
  - `INTERESTED` - When lead asks about prices/details
  - `CTA_WHATSAPP` - When lead shares WhatsApp number
  - `CTA_PHONE` - When lead shares phone number
- Updates lead stages in PostgreSQL automatically
- Links MessengerContact to Lead by name matching

---

### 4. Run Multiple Agents in Parallel

**Endpoint:** `POST /api/agents/test/parallel`

```json
{
  "agents": [
    {
      "type": "first-time-scraper",
      "accountId": "account-1",
      "config": {
        "groupUrl": "https://www.facebook.com/groups/...",
        "groupId": "clxx...",
        "maxPosts": 20
      }
    },
    {
      "type": "lead-gen",
      "accountId": "account-2",
      "config": {
        "groups": [{ "id": "...", "url": "..." }]
      }
    },
    {
      "type": "message-agent",
      "accountId": "account-3",
      "config": {
        "idleTimeoutMs": 60000
      }
    }
  ]
}
```

**⚠️ Important:** Each agent MUST use a different `accountId` to avoid browser conflicts!

---

## ✅ Completed Features

### All Agents
- [x] PostgreSQL database integration via Prisma
- [x] Persistent browser sessions per account
- [x] Human-like delays and typing
- [x] Stealth mode to avoid detection
- [x] Logging with timestamps
- [x] Error handling and recovery
- [x] Schedule system (hourly limits, peak hours)

### First-Time Scraper
- [x] Configurable `maxPosts` parameter
- [x] Parallel AI analysis (batches of 10)
- [x] Lead creation in database
- [x] Group initialization tracking
- [x] Duplicate post handling

### Lead Gen Agent
- [x] Incremental scraping (only new posts)
- [x] Parallel AI analysis (batches of 10)
- [x] Lead creation in database
- [x] Group stats update (`totalPosts`, `totalLeads`)
- [x] Lead qualification (reject job offers, internships, equity deals)

### Message Agent
- [x] Messenger monitoring with unread detection
- [x] AI reply generation in Tunisian Arabic
- [x] **AI Tool Calling** for stage detection
- [x] MessengerContact ↔ Lead linking by name
- [x] Lead stage auto-updates
- [x] Contact info extraction (phone, WhatsApp)
- [x] Conversation state tracking
- [x] Idle timeout (stops when no activity)

---

## 🔄 Database Connections

```
┌─────────────────────────────────────────────────────────────────┐
│                      DATABASE FLOW                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Group ──────────────────────────────────────────────────────▶  │
│    │                                                             │
│    │ First-Time Scraper / Lead Gen Agent                        │
│    ▼                                                             │
│  Lead ◄──────────────────────────────────────────────────────── │
│    │         AI Analysis creates Lead with:                     │
│    │         - authorName, postUrl, postText                    │
│    │         - intentScore, matchedService, aiAnalysis          │
│    │         - stage: LEAD (initial)                            │
│    │                                                             │
│    │ Message Agent links by name matching                       │
│    ▼                                                             │
│  MessengerContact ◄─────────────────────────────────────────── │
│    │         - leadId: links to Lead                            │
│    │         - leadStage: synced with Lead.stage                │
│    │         - message counts, last messages                    │
│    │                                                             │
│    │ AI Tool Calling updates stages                             │
│    ▼                                                             │
│  Lead Stage Updates ──────────────────────────────────────────▶ │
│         LEAD → INTERESTED → CTA_WHATSAPP/CTA_PHONE → CONVERTED  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚧 TODO / Remaining Work

### High Priority

- [ ] **Auto-engagement** - Commenting on posts and sending DMs
  - First-Time Scraper has `autoComment`, `autoDM` flags but not implemented
  - Lead Gen Agent has flags but not implemented
  - Need: `postComment()` and `sendDM()` procedures

- [ ] **Friend Request System**
  - Schema has `friendRequestSent`, `friendRequestAccepted` on Lead
  - Need: `sendFriendRequest()` procedure
  - Track acceptance status

- [ ] **Conversation Model** - Currently unused
  - Schema has `Conversation` model for tracking engagement
  - Need to populate when commenting/DMing

### Medium Priority

- [ ] **Profile Scraping** - Visit lead profiles for more info
  - Procedures exist (`PROFILE_SELECTORS`) but not integrated
  - Could extract: phone, email, location from profile

- [ ] **GroupPost Model** - Store all scraped posts
  - Schema has `GroupPost` model
  - Currently we only store posts that become leads
  - Could store all for analytics

- [ ] **Rate Limiting Dashboard**
  - Track daily limits per account
  - Show when accounts hit limits
  - Auto-pause when approaching limits

### Low Priority

- [ ] **Multi-language AI** - Currently Tunisian Arabic only
  - Detect language from messages
  - Reply in same language

- [ ] **Sentiment Analysis** - Detect lead mood
  - Angry → Escalate to human
  - Happy → Push for conversion

- [ ] **A/B Testing** - Test different reply styles
  - Track which approaches convert better

---

## 📁 File Structure

```
agents/
├── index.ts                    # Exports all agents
├── types.ts                    # Type definitions
├── first-time-scraper.ts       # Agent 1: Initialize groups
├── lead-gen-agent.ts           # Agent 2: Monitor for new leads
├── message-agent.ts            # Agent 3: Messenger + AI replies
└── procedures/
    ├── index.ts                # Exports all procedures
    ├── browser.ts              # P1, P2: Browser launch, stealth
    ├── human-behavior.ts       # P3, P4: Human delays, typing
    ├── scraping.ts             # P5, P6: Group navigation, post extraction
    ├── ai.ts                   # P8, P9: AI analysis, reply generation + tool calling
    ├── messenger.ts            # P14-P16: Inbox, conversations, replies
    └── facebook-selectors.ts   # CSS selectors for Facebook

app/api/agents/test/
├── first-time-scraper/route.ts # Test First-Time Scraper
├── lead-gen/route.ts           # Test Lead Gen Agent
├── message-agent/route.ts      # Test Message Agent
└── parallel/route.ts           # Run multiple agents in parallel
```

---

## 🔧 Environment Variables Required

```env
# Database
DATABASE_URL="postgresql://..."

# Azure OpenAI (for AI analysis and replies)
AZURE_OPENAI_API_KEY="..."
AZURE_OPENAI_ENDPOINT="https://....openai.azure.com"
AZURE_OPENAI_DEPLOYMENT="gpt-4o-mini"

# Clerk Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="..."
CLERK_SECRET_KEY="..."

# Internal API (for lead stage updates)
INTERNAL_API_KEY="..."
```

---

## 🚀 Running Agents

### Development Testing

```bash
# Test First-Time Scraper
curl -X POST http://localhost:3000/api/agents/test/first-time-scraper \
  -H "Content-Type: application/json" \
  -d '{"groupUrl": "...", "groupId": "...", "accountId": "account-1"}'

# Test Lead Gen Agent
curl -X POST http://localhost:3000/api/agents/test/lead-gen \
  -H "Content-Type: application/json" \
  -d '{"accountId": "account-1", "groups": [{"url": "..."}]}'

# Test Message Agent
curl -X POST http://localhost:3000/api/agents/test/message-agent \
  -H "Content-Type: application/json" \
  -d '{"accountId": "account-1", "idleTimeoutMs": 60000}'

# Run multiple agents in parallel
curl -X POST http://localhost:3000/api/agents/test/parallel \
  -H "Content-Type: application/json" \
  -d '{"agents": [...]}'
```

### Production Scheduling

The schedule system (`lib/schedule-service.ts`) handles:
- Hourly limits for scrapes, comments, DMs
- Peak hours configuration
- Randomized execution times
- Daily counter resets

Agents check `shouldAgentRun()` before executing (can be skipped with `skipScheduleCheck: true` for testing).
