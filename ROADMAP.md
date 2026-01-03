# FB Lead Scraper - Platform Roadmap

## 🎯 Goal
Automated AI agent that monitors Facebook groups, finds leads matching our services, engages with them (comment + DM), and follows up via Messenger to close the lead.

---

## ✅ COMPLETED FEATURES

### 1. Post Extraction
- [x] **Single Post Extraction** - Extract content, author, profile URL from a single post
- [x] **Group Posts Extraction** - Scroll through group, extract multiple posts with Share button approach
- [x] **Author Detection** - Identify post author, detect anonymous posts

### 2. Engagement Actions
- [x] **Comment on Post** - Type and submit comment with human-like delays
- [x] **Friend Request** - Send friend request from profile page
- [x] **Direct Message** - Use "New message" button, type recipient name, send DM

### 3. AI Analysis
- [x] **Post Analysis** - Analyze post text for intent, urgency, budget signals
- [x] **Service Matching** - Match posts to our configured services
- [x] **Response Generation** - Generate suggested comment/DM based on business profile

### 4. Database Schema
- [x] **Agents** - Track FB accounts with status, daily limits
- [x] **Groups** - Manage target groups with priority
- [x] **Leads** - Store scraped posts with AI analysis
- [x] **Conversations** - Track engagement (comment, DM, reply)
- [x] **Logs** - System logging

### 5. Testing Dashboard
- [x] **Single Post Test** - Test extraction on one post
- [x] **Extract Posts Test** - Test batch extraction from group
- [x] **AI Analysis Test** - Test AI on sample posts
- [x] **Engagement Test** - Test full engagement flow
- [x] **AI Reply Test** - Check Messenger, analyze with AI, generate/send reply

---

## 🚧 IN PROGRESS / TODO

### Phase 1: Message Monitoring & AI Replies ✅ PARTIALLY COMPLETE

#### 1.1 AI Reply Test Endpoint ✅ DONE
**Endpoint:** `POST /api/test/ai-reply`

**What it does:**
- Open Facebook Messenger
- Search for specific person by name
- Read conversation history
- AI analyzes if they're a lead
- Generates appropriate reply based on services.json
- Optionally sends the reply

**Usage:**
```typescript
Input: { 
  accountId: string,
  personName: string,  // Name of person to check
  sendReply: boolean   // true = send, false = preview only
}
Output: {
  success: boolean,
  personName: string,
  messagesFound: number,
  conversation: Message[],
  aiAnalysis: {
    isLead: boolean,
    leadScore: number,
    intent: string,
    reasoning: string
  },
  generatedReply: string | null,
  replySent: boolean
}
```

#### 1.2 Check Messenger Inbox (TODO)
**Endpoint:** `POST /api/test/check-inbox`

**What it does:**
- Open Facebook Messenger (facebook.com/messages)
- Find unread conversations or recent messages
- Extract message content and sender info
- Match senders to known leads in database
- Return list of conversations needing reply

**Selectors needed:**
```typescript
// Messenger inbox
'[aria-label="Chats"]'  // Chat list
'[role="row"]'          // Individual chat preview
'[aria-label="Unread"]' // Unread indicator
```

#### 1.3 Read Conversation History (PARTIALLY DONE via AI Reply)
**Endpoint:** `POST /api/test/read-conversation`

**What it does:**
- Open specific conversation by lead name/ID
- Scroll up to load full history
- Extract all messages (ours + theirs)
- Return structured conversation data

#### 1.3 AI Reply Generation
**Endpoint:** `POST /api/ai/generate-reply`

**What it does:**
- Take conversation history as input
- Use AI to generate appropriate reply
- Consider: lead's needs, our services, conversation stage
- Return reply text ready to send

**AI Prompt structure:**
```
You are a sales assistant for [BUSINESS].
Conversation so far: [MESSAGES]
Lead's original need: [POST_TEXT]
Our services: [SERVICES]
Generate a helpful, conversational reply to move towards closing.
```

#### 1.4 AI Reply ✅ COMPLETED
**Endpoint:** `POST /api/test/ai-reply`
**UI:** Testing page → AI Reply tab

**What it does:**
- Open Messenger and search for person
- Read conversation messages
- Analyze with GPT-4o-mini (lead scoring, intent detection)
- Generate contextual reply based on services.json
- Optionally send the reply
- Return analysis with isLead, leadScore, intent, reasoning

---

### Phase 2: Full Automation Loop 🟡 MEDIUM PRIORITY

#### 2.1 Agent Orchestrator
**File:** `app/api/agents/run/route.ts`

**What it does:**
```
LOOP (every 30 minutes):
  1. For each active account:
     a. Check assigned groups
     b. Scrape new posts
     c. Run AI analysis on each post
     d. Filter: intent_score >= 4 only
     e. Engage: comment + DM
     f. Log everything
     
  2. Check Messenger inbox
     a. Find new replies
     b. Generate AI responses
     c. Send replies
     d. Update lead status
```

#### 2.2 Rate Limiting Manager
```typescript
// Per account daily limits
MAX_COMMENTS_PER_DAY = 30
MAX_DMS_PER_DAY = 20
MAX_SCRAPES_PER_DAY = 100

// Delays
BETWEEN_ENGAGEMENTS = 5-10 minutes
BETWEEN_GROUP_SCRAPES = 15-30 minutes
COOLDOWN_AFTER_RATE_LIMIT = 2 hours
```

#### 2.3 Lead Status Flow
```
NEW → COMMENTED → DM_SENT → RESPONDED → CONVERTED
                      ↓
                  ARCHIVED (no response after 3 days)
```

---

### Phase 3: Dashboard & Management 🟢 LOWER PRIORITY

#### 3.1 Leads Dashboard
- [ ] View all leads with filters (status, score, group, date)
- [ ] Manual status updates
- [ ] View full conversation history
- [ ] Quick actions (send follow-up, archive)

#### 3.2 Conversations View
- [ ] Real-time message display
- [ ] AI reply suggestions
- [ ] One-click send
- [ ] Mark as converted

#### 3.3 Analytics
- [ ] Leads per day/week
- [ ] Conversion rate
- [ ] Response rate
- [ ] Best performing groups
- [ ] Agent performance

#### 3.4 Automation Settings
- [ ] Enable/disable auto-reply
- [ ] Set working hours (don't engage at 3am)
- [ ] Configure rate limits
- [ ] Pause specific accounts

---

## 📋 IMMEDIATE NEXT STEPS

### Step 1: Test AI Reply ✅ DONE
The `/api/test/ai-reply` endpoint is now available in the Testing dashboard.
- Opens Messenger, finds conversation by person name
- Reads messages and analyzes with AI
- Generates contextual reply based on services.json
- Can send reply if enabled

### Step 2: Check Inbox Endpoint (NEXT)
Create `/api/test/check-inbox` endpoint:
```typescript
Input: { accountId }
Output: {
  unreadCount: number,
  conversations: [{
    senderName: string,
    lastMessage: string,
    timestamp: string,
    isUnread: boolean,
    isKnownLead: boolean  // Match with database
  }]
}
```

### Step 3: Auto-Reply Loop
Create `/api/worker/process-replies` endpoint:
```typescript
// For each unread conversation from a known lead:
1. Read full conversation
2. Generate AI reply
3. Send reply
4. Update lead status
5. Log everything
```

### Step 4: Full Automation Agent
Create `/api/worker/run-agent` endpoint:
```typescript
// Master loop that runs periodically:
1. Check assigned groups for new posts
2. AI analyze posts → filter leads
3. Engage with qualified leads (comment + DM)
4. Check inbox for replies
5. AI reply to messages
6. Update all statuses
```

---

## 🔧 TECHNICAL DEBT

1. **Error Recovery** - Better handling when FB blocks actions
2. **Session Persistence** - Ensure login sessions don't expire
3. **Selector Maintenance** - FB changes UI frequently, need fallbacks
4. **Logging** - More detailed logs for debugging
5. **Queue System** - Use proper job queue (Bull/BullMQ) for automation

---

## 📊 SUCCESS METRICS

| Metric | Target |
|--------|--------|
| Posts scraped/day | 500+ |
| Leads found/day | 50+ |
| Engagement rate | 90%+ (comment + DM) |
| Response rate | 30%+ |
| Conversion rate | 10%+ |
| Account ban rate | <1% |

---

## 🚀 LAUNCH CHECKLIST

- [ ] All test endpoints working manually
- [ ] AI analysis correctly filtering leads
- [ ] Engagement flow working end-to-end
- [ ] Message checking working
- [ ] AI replies generating good responses
- [ ] Auto-send replies working
- [ ] Rate limiting in place
- [ ] Error handling robust
- [ ] 3+ FB accounts ready
- [ ] 10+ target groups configured
- [ ] Business profile & services configured
