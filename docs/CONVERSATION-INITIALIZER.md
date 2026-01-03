# 🔄 Conversation Initializer Guide

## Overview

The **Conversation Initializer** is a crucial step in the conversation tracking pipeline. It scans your Messenger inbox, matches contacts to existing Leads in the database, and creates `MessengerContact` records for tracking.

This enables the **Message Agent** to:
- Know which conversations need replies
- Track message counts (theirs vs ours)
- Maintain conversation state (NEW → NEEDS_REPLY → WAITING → ENDED)
- Link conversations back to the original Lead (post context)

---

## 📊 How It Fits in the Pipeline

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           COMPLETE FLOW                                          │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  1. SCRAPER AGENT → Creates Leads from Facebook group posts                      │
│         │                                                                        │
│         ▼                                                                        │
│  2. INITIATOR AGENT → Comments on posts + Sends initial DMs                     │
│         │                                                                        │
│         ▼                                                                        │
│  3. CONVERSATION INITIALIZER → Links Messenger contacts to Leads    ◄── YOU ARE │
│         │                                                            HERE       │
│         ▼                                                                        │
│  4. MESSAGE AGENT → Monitors conversations, sends AI replies                     │
│         │                                                                        │
│         ▼                                                                        │
│  5. LEAD STAGES → LEAD → INTERESTED → CTA_WHATSAPP → CONVERTED                  │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Models Involved

### 1. Lead (Source of Truth)

```prisma
model Lead {
  id               String   @id
  authorName       String?  // Name shown on Facebook post
  authorProfileUrl String?  // Profile URL (used for matching)
  authorFbId       String?  // Facebook ID if available
  postText         String   // Original post content
  matchedService   String?  // Which service they're looking for
  stage            LeadStage // LEAD → INTERESTED → CTA_WHATSAPP...
  
  // Relation to MessengerContact
  messengerContact MessengerContact?
}
```

### 2. MessengerContact (Conversation Tracker)

```prisma
model MessengerContact {
  id              String   @id
  
  // Account & Contact
  accountId       String   // Which FB account owns this
  contactName     String   // Display name in Messenger
  contactFbId     String?  // Facebook ID if known
  conversationUrl String   // Direct link to conversation
  
  // Link to Lead (THE KEY RELATIONSHIP!)
  leadId          String?  @unique
  lead            Lead?    @relation
  
  // State Machine
  state           ConversationStateEnum?  // NEW | NEEDS_REPLY | WAITING | ENDED
  previousState   ConversationStateEnum?
  stateChangedAt  DateTime?
  
  // Message Counts (CORE DETECTION MECHANISM)
  totalMessageCount   Int  @default(0)
  theirMessageCount   Int  @default(0)  // Messages FROM lead
  ourMessageCount     Int  @default(0)  // Messages FROM us
  
  // Last messages
  lastTheirMessage    String?
  lastTheirMessageAt  DateTime?
  lastOurReply        String?
  lastOurReplyAt      DateTime?
  
  // Status
  status              ContactStatus  // ACTIVE | OLD
  conversationEnded   Boolean @default(false)
  endReason           String?
}
```

---

## 🔄 The Initialization Process

### Step 1: Scrape Messenger Sidebar

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      MESSENGER SIDEBAR                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  📬 Salma Guizeni              │  ┌─────────────────────────────────┐  │
│     "kifash el aswaar?"       ─┼─►│  Extract:                       │  │
│                                │  │  - contactName: "Salma Guizeni" │  │
│  📬 Ahmed Ben Amor             │  │  - conversationUrl              │  │
│     "merci beaucoup"          ─┼─►│  - isUnread: true/false         │  │
│                                │  └─────────────────────────────────┘  │
│  Mohamed Trabelsi              │                                       │
│     "You: آلو؟"                │                                       │
│                                │                                       │
│  Fatma Kchouk                  │                                       │
│     "besslema"                 │                                       │
│                                │                                       │
│  ... (scroll to load more)     │                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

### Step 2: Match to Existing Leads

The initializer uses **3 matching strategies** (in order of priority):

| Priority | Method | Description |
|----------|--------|-------------|
| 1 | Exact Name | `lead.authorName === contact.contactName` |
| 2 | Partial Name | Name contains/contained in lead name |
| 3 | FB ID Match | Extract ID from URL and match to `lead.authorFbId` |

```typescript
// Matching logic (simplified)
function findMatchingLead(contactName: string, contactUrl: string, leads: Lead[]) {
  // 1. Exact name match
  let match = leads.find(lead => 
    lead.authorName?.toLowerCase() === contactName.toLowerCase()
  );
  
  // 2. Partial name match
  if (!match) {
    match = leads.find(lead => 
      lead.authorName?.toLowerCase().includes(contactName.toLowerCase()) ||
      contactName.toLowerCase().includes(lead.authorName?.toLowerCase() || '')
    );
  }
  
  // 3. FB ID match
  if (!match && contactUrl) {
    const fbId = extractFbId(contactUrl);
    match = leads.find(lead => 
      lead.authorFbId === fbId || lead.authorProfileUrl?.includes(fbId)
    );
  }
  
  return match;
}
```

### Step 3: Create MessengerContact Records

For each matched contact:

```typescript
await prisma.messengerContact.create({
  data: {
    accountId: accountId,
    contactName: conv.contactName,
    conversationUrl: conv.conversationUrl,
    leadId: matchedLead.id,        // Link to Lead!
    status: "ACTIVE",
    state: "NEW",
    lastActivityAt: new Date(),
  },
});
```

---

## 📈 Result Summary

After running the initializer, you'll see:

| Metric | Description |
|--------|-------------|
| **Total Scraped** | How many conversations were found in Messenger |
| **Created** | New MessengerContact records created |
| **Matched** | How many contacts were linked to Leads |
| **Already Existed** | Contacts that were already in the database |
| **Unmatched** | Contacts with no matching Lead (personal chats, etc.) |

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    INITIALIZATION RESULTS                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   📊 Total Scraped:    45                                               │
│   ✅ Created:          12  (new contacts linked to leads)               │
│   🔗 Matched:          12  (matched to Lead records)                    │
│   ⏭️ Already Existed:  8   (already tracking)                           │
│   ⚪ Unmatched:        25  (personal chats, not leads)                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Why Matching to Leads is Critical

When the **Message Agent** processes a conversation, it needs **context**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    WITH LEAD CONTEXT                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Lead's Original Post:                                                   │
│  "نحتاج موقع إلكتروني لمحل حلويات... ميزانية متوسطة"                      │
│                                                                         │
│  Matched Service: "Web Development"                                      │
│                                                                         │
│  Current Conversation:                                                   │
│  - Them: "كيفاش الأسعار؟"                                                │
│  - AI knows: They want a website, budget is moderate                     │
│  - AI replies: "للموقع البسيط 500dt، المتكامل 1200dt..."                  │
│                                                                         │
│  ✅ Contextual, relevant response!                                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                    WITHOUT LEAD CONTEXT                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Current Conversation:                                                   │
│  - Them: "كيفاش الأسعار؟"                                                │
│  - AI doesn't know: What do they want? Which service?                    │
│  - AI replies: "أهلا! شنو تحتاج بالضبط؟"                                  │
│                                                                         │
│  ❌ Generic, wastes lead's time with questions already answered          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔧 How Message Agent Uses MessengerContact

### 1. Detecting New Messages

```typescript
// Message Agent checks message counts
const dbState = await prisma.messengerContact.findUnique({
  where: { accountId_contactName: { accountId, contactName } }
});

// Compare counts
const currentTheirCount = countMessagesFrom('them', conversationDOM);
const currentOurCount = countMessagesFrom('us', conversationDOM);

if (currentTheirCount > dbState.theirMessageCount) {
  // NEW MESSAGE DETECTED!
  // Update state to NEEDS_REPLY
}
```

### 2. Getting Lead Context for AI

```typescript
// Get the linked Lead for context
const contact = await prisma.messengerContact.findUnique({
  where: { accountId_contactName: { accountId, contactName } },
  include: { lead: true }  // Include the linked Lead!
});

const postContext = {
  originalPost: contact.lead?.postText,
  matchedService: contact.lead?.matchedService,
  stage: contact.lead?.stage,
};

// AI now knows what they originally wanted!
const reply = await generateAIReply(messages, postContext);
```

### 3. Updating State After Reply

```typescript
await prisma.messengerContact.update({
  where: { id: contact.id },
  data: {
    state: 'WAITING',           // We replied, waiting for them
    previousState: 'NEEDS_REPLY',
    ourMessageCount: newOurCount,
    totalMessageCount: newTotal,
    lastOurReply: replyText,
    lastOurReplyAt: new Date(),
    lastActivityAt: new Date(),
  }
});
```

---

## 📝 State Machine Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CONVERSATION STATES                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌───────┐                                                                 │
│   │  NEW  │ ─── Initializer creates contact                                 │
│   └───┬───┘                                                                 │
│       │                                                                     │
│       │ Lead sends message (theirCount increases)                           │
│       ▼                                                                     │
│   ┌─────────────┐         We send reply         ┌───────────┐              │
│   │ NEEDS_REPLY │ ─────────────────────────────► │  WAITING  │              │
│   │  (action!)  │                               │  (wait)   │              │
│   └─────────────┘                               └─────┬─────┘              │
│         ▲                                             │                     │
│         │           They reply again                  │                     │
│         └─────────────────────────────────────────────┘                     │
│                                                                             │
│                                                                             │
│   ┌──────────┐                              ┌─────────┐                     │
│   │   IDLE   │ ◄── no activity 30+ min ─── │ WAITING │                     │
│   └────┬─────┘                              └─────────┘                     │
│        │                                                                    │
│        │ They message again                                                 │
│        └────────────────► NEEDS_REPLY                                       │
│                                                                             │
│                                                                             │
│   ┌─────────────┐    AI ends or                                            │
│   │    ENDED    │ ◄── contact info extracted ───── NEEDS_REPLY             │
│   │  (closed)   │                                                           │
│   └─────────────┘                                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 How to Use

### Via Testing Dashboard

1. Go to **Dashboard → Agents → Testing**
2. Select your Facebook account
3. Click the **"Conv Init"** tab
4. Configure:
   - **Max Conversations**: How many to scan (default 50)
   - **Scroll Count**: How many times to scroll to load more (default 3)
5. Click **"Initialize Conversations"**
6. Review results:
   - ✅ Created = New contacts now being tracked
   - ⏭️ Existed = Already tracking these
   - ⚪ No Match = Personal chats (not leads)

### Via API

```http
POST /api/test/init-conversations
Content-Type: application/json

{
  "accountId": "account-123",
  "maxConversations": 50,
  "scrollCount": 3
}
```

**Response:**
```json
{
  "success": true,
  "totalScraped": 45,
  "matchedToLeads": 12,
  "alreadyExisted": 8,
  "created": 12,
  "unmatched": 25,
  "conversations": [
    {
      "contactName": "Salma Guizeni",
      "matched": true,
      "leadId": "clx123...",
      "authorName": "Salma Guizeni",
      "status": "created"
    },
    ...
  ],
  "logs": ["[10:30:00] 🚀 Starting...", ...]
}
```

---

## ⚠️ Important Notes

### 1. Run After Initiator Agent

The Conversation Initializer should run **after** the Initiator Agent has sent DMs:
- Initiator Agent creates Leads and sends first messages
- Conversation Initializer links those conversations to Leads

### 2. Unmatched Contacts Are Normal

Not all Messenger contacts are leads:
- Personal friends
- Pages/businesses
- Old conversations
- These stay as "unmatched" and won't be tracked

### 3. Name Matching Limitations

If a lead's Facebook name is very different from their Messenger name, matching may fail.
Consider manual linking in such cases.

### 4. Re-running is Safe

Running the initializer multiple times is safe:
- Already-linked contacts are skipped ("Already Existed")
- Only new matches are created

---

## 🔗 Related Documentation

- [MESSAGE-AGENT-GUIDE.md](MESSAGE-AGENT-GUIDE.md) - How the Message Agent works
- [CONVERSATION-STATE-MACHINE.md](CONVERSATION-STATE-MACHINE.md) - Detailed state machine docs
- [LEAD-STAGES.md](LEAD-STAGES.md) - Lead stage progression
- [agents.md](agents.md) - Overview of all agents

---

## 📊 Database Queries

### Get all contacts needing reply

```sql
SELECT * FROM messenger_contacts 
WHERE account_id = 'your-account-id' 
AND state = 'NEEDS_REPLY' 
AND status = 'ACTIVE';
```

### Get contacts with their lead info

```sql
SELECT mc.contact_name, mc.state, l.post_text, l.stage, l.matched_service
FROM messenger_contacts mc
LEFT JOIN leads l ON mc.lead_id = l.id
WHERE mc.account_id = 'your-account-id'
AND mc.status = 'ACTIVE';
```

### Count by state

```sql
SELECT state, COUNT(*) 
FROM messenger_contacts 
WHERE account_id = 'your-account-id' 
GROUP BY state;
```
