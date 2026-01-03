# Messenger Conversation Tracking System

> **Simplified sidebar-based message tracking for AI-powered replies**

---

## 📋 Overview

The Messenger tracking system monitors Facebook Messenger conversations and enables AI-powered replies. Instead of complex hash comparisons, it uses **direct sidebar scanning** to detect new messages efficiently.

### Key Improvements

- ✅ **Sidebar-based tracking** - Fast and reliable
- ✅ **No hash comparisons** - Simplified logic
- ✅ **Real-time message previews** - See last message directly
- ✅ **Smart filtering** - Ignores system messages
- ✅ **"You replied" detection** - Knows when you were last sender

---

## 🔄 How It Works

### Phase 1: Initial Setup (One-Time)

**Purpose:** Build complete conversation history for ALL contacts to enable AI context-aware replies.

#### What Happens:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 1: SCAN SIDEBAR (Get all contact names first)                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. Launch browser with account session                                 │
│  2. Navigate to Messenger (facebook.com/messages/t/)                    │
│  3. 🔐 CHECK FOR E2EE PIN DIALOG (FIRST TIME!)                          │
│     └─ If PIN dialog appears: Auto-enter 6-digit PIN                    │
│     └─ Wait for unlock before proceeding                               │
│  4. Scroll sidebar to load ALL conversations                            │
│  5. For EACH conversation, extract from sidebar:                        │
│     ├─ Contact name                                                     │
│     ├─ Contact FB ID (from URL)                                         │
│     ├─ Conversation URL                                                 │
│     └─ Last message preview                                             │
│                                                                         │
│  6. Filter out system messages:                                         │
│     ├─ "You're now friends with..."                                     │
│     ├─ "Messages and calls are secured..."                              │
│     ├─ "Message unavailable"                                            │
│     └─ Meta Business Support / Facebook user                            │
│                                                                         │
│  📦 Result: List of all valid contacts with URLs                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 2: OPEN EACH CONVERSATION (Save full history for AI)             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  For EACH contact in the list:                                          │
│                                                                         │
│  1. Click on conversation in sidebar (or navigate to URL)              │
│  2. Wait for messages to load                                           │
│  3. Scroll up to load older messages (if needed)                        │
│  4. Extract ALL messages:                                               │
│     ├─ Message text                                                     │
│     ├─ Sender (them or us)                                              │
│     ├─ Timestamp                                                        │
│     └─ Message order/sequence                                           │
│                                                                         │
│  5. Save to database:                                                   │
│     ├─ MessengerContact record (contact info)                           │
│     └─ MessengerMessage records (full conversation history)             │
│                                                                         │
│  6. Move to next contact                                                │
│                                                                         │
│  ✅ Note: No per-conversation PIN check needed!                         │
│     PIN is already unlocked from Step 1                                 │
│                                                                         │
│  ⏱️ Note: This is slow but only happens ONCE                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Database Records Created:

```typescript
// 1. Contact Record
await prisma.messengerContact.create({
  data: {
    // Identity
    accountId: "account_123",
    contactName: "Salma Guizeni",
    contactFbId: "123456789",
    conversationUrl: "https://facebook.com/messages/t/123456789",
    
    // Baseline: Current last message from sidebar
    lastTheirMessage: "tkolich makech rajel...",
    lastMessageIsOurs: false,
    
    // Initial State
    state: "INITIALIZED",
    status: "ACTIVE",
    
    // Timestamps
    lastCheckedAt: new Date(),
    lastActivityAt: new Date(),
  }
});

// 2. Message Records (Full conversation history for AI)
await prisma.messengerMessage.createMany({
  data: [
    {
      contactId: contact.id,
      content: "Hello, I saw your post about web design",
      sender: "THEM",
      timestamp: new Date("2026-01-01T10:00:00"),
      messageOrder: 1,
    },
    {
      contactId: contact.id,
      content: "Hi! Yes, I offer web design services. What do you need?",
      sender: "US",
      timestamp: new Date("2026-01-01T10:05:00"),
      messageOrder: 2,
    },
    {
      contactId: contact.id,
      content: "I need a landing page for my business",
      sender: "THEM",
      timestamp: new Date("2026-01-01T10:10:00"),
      messageOrder: 3,
    },
    // ... all messages saved
  ]
});
```

#### Why Save Full History:

| Reason | Benefit |
|--------|---------|
| 🤖 **AI Context** | AI can understand the full conversation before replying |
| 📊 **Lead Qualification** | Analyze conversation to determine lead quality |
| 🔄 **Continuity** | Know what was discussed, offers made, etc. |
| 📈 **Analytics** | Track response patterns, common questions |

#### The Detection Logic (Future Scans):

```typescript
// On each scheduled scan (sidebar only, fast!):
const sidebarMessage = conv.lastMessagePreview;  // From sidebar
const storedMessage = existing.lastTheirMessage;  // From database

// NEW MESSAGE DETECTED if:
if (sidebarMessage !== storedMessage && !conv.lastMessageIsOurs) {
  // → They sent a NEW message!
  // → Open conversation to read new message
  // → Save new message to MessengerMessage table
  // → Use full history for AI context
  // → Generate and send reply
}
```

#### Result Summary:

```
┌────────────────────────────────────────────────────────────┐
│            INITIALIZATION COMPLETE                          │
├────────────────────────────────────────────────────────────┤
│  📊 Sidebar Conversations Found:   17                       │
│  🔍 After Filtering System Msgs:   12                       │
│  ✅ Contacts Saved to Database:    12                       │
│  💬 Total Messages Saved:          156                      │
│                                                             │
│  📝 Each contact has:                                       │
│     ├─ Contact info (name, FB ID, URL)                      │
│     ├─ Last message baseline (for detection)                │
│     └─ FULL conversation history (for AI)                   │
│                                                             │
│  ⏱️ Time taken: ~5 minutes (one-time only)                  │
└────────────────────────────────────────────────────────────┘
```

Now future scans are FAST (sidebar only) but AI has FULL context!

---

### Phase 2: Continuous Monitoring (Scheduled)

Every X minutes (configurable):

```
┌─────────────────────────────────────────────────────────────┐
│  1. LOAD FROM DATABASE (One query, in-memory)                │
│     - Get last 40 contacts with recent activity              │
│     - Only fetch: contactFbId, lastTheirMessage              │
│     - Store in Map for O(1) lookup                           │
│                                                              │
│  2. OPEN MESSENGER & CHECK E2EE PIN                          │
│     - Navigate to Messenger                                  │
│     - 🔐 Check for PIN dialog (every time!)                  │
│     - Auto-enter PIN if dialog appears                       │
│                                                              │
│  3. SCAN SIDEBAR (Fast - ~5 seconds)                         │
│     - Load Messenger sidebar                                 │
│     - Extract all conversations (name + last message)        │
│     - Filter out system messages                             │
│                                                              │
│  4. COMPARE IN MEMORY (No DB queries per conversation!)      │
│     For each sidebar conversation:                           │
│       ┌─────────────────────────────────────────────────┐    │
│       │  sidebarMessage = conv.lastMessagePreview       │    │
│       │  storedMessage  = dbMap.get(conv.contactFbId)   │    │
│       │                                                 │    │
│       │  if (sidebarMessage !== storedMessage           │    │
│       │      && !conv.lastMessageIsOurs) {              │    │
│       │    → NEW MESSAGE DETECTED!                      │    │
│       │    → Add to needsReply array                    │    │
│       │  }                                              │    │
│       └─────────────────────────────────────────────────┘    │
│                                                              │
│  5. BATCH UPDATE DATABASE                                    │
│     - Update all changed contacts in one transaction         │
│     - Set state → NEEDS_REPLY                                │
│     - Save new lastTheirMessage                              │
│                                                              │
│  6. AI REPLIES (For each NEEDS_REPLY)                        │
│     For each conversation needing reply:                     │
│       ┌─────────────────────────────────────────────────┐    │
│       │  1. Open conversation                           │    │
│       │  2. Read full conversation context              │    │
│       │  3. Generate AI reply based on context          │    │
│       │  4. Send reply                                  │    │
│       │  5. Update state → REPLIED                      │    │
│       │                                                 │    │
│       │  ✅ No PIN check needed per-conversation!       │    │
│       │     Already unlocked in Step 2                  │    │
│       └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Conversation States

| State | Meaning | Next Action |
|-------|---------|-------------|
| **INITIALIZED** | First time seen, no action yet | Wait for new message |
| **NEEDS_REPLY** | They sent a new message | AI should reply |
| **REPLIED** | We sent the last message | Wait for their response |
| **QUALIFIED** | Lead is qualified/interested | Continue engagement |
| **NOT_INTERESTED** | Lead declined/not interested | Archive or end |
| **ENDED** | Conversation closed | No further action |

---

## 🚀 The Agent Flow

### Agent: Message Monitor & Responder

**Runs:** Every 5-15 minutes (configurable)

**Steps:**

#### 1. Sidebar Scan (Fast Check)
```typescript
// Extract ALL conversations from sidebar
const conversations = await extractConversationList(page);

// Result:
[
  {
    contactName: "Salma Guizeni",
    contactFbId: "123456789",
    lastMessagePreview: "tkolich makech rajel...",
    lastMessageIsOurs: false, // They sent last message
  },
  {
    contactName: "Mohamed Amine",
    lastMessagePreview: "تحب نعملو مكالمة...",
    lastMessageIsOurs: true, // We sent last message - SKIP
  }
]
```

#### 2. Load DB Records (Single Query → Memory)
```typescript
// ONE database query - get last 40 active contacts
const dbContacts = await db.messengerContact.findMany({
  where: { accountId: accountId },
  orderBy: { lastActivityAt: 'desc' },
  take: 40,
  select: {
    id: true,
    contactFbId: true,
    lastTheirMessage: true,  // Only what we need for comparison
  }
});

// Build Map for O(1) lookup
const dbMap = new Map(
  dbContacts.map(c => [c.contactFbId, c])
);
```

#### 3. Compare in Memory (No DB queries in loop!)
```typescript
const needsReplyUpdates: string[] = [];

for (const conv of conversations) {
  const existing = dbMap.get(conv.contactFbId);  // O(1) lookup!
  
  if (!existing) continue; // New contact, handle separately

  // NEW MESSAGE DETECTED if:
  // 1. Last message is different
  // 2. Last sender is THEM (not us)
  if (
    existing.lastTheirMessage !== conv.lastMessagePreview &&
    !conv.lastMessageIsOurs
  ) {
    needsReplyUpdates.push(existing.id);
  }
}

// BATCH UPDATE - one query for all changes
if (needsReplyUpdates.length > 0) {
  await db.messengerContact.updateMany({
    where: { id: { in: needsReplyUpdates } },
    data: { 
      state: "NEEDS_REPLY",
      lastActivityAt: new Date() 
    }
  });
}
```

#### 3. Process Replies (For Each NEEDS_REPLY)
```typescript
const needsReply = await db.messengerContact.findMany({
  where: { state: "NEEDS_REPLY" }
});

for (const contact of needsReply) {
  // Open conversation
  await page.goto(contact.conversationUrl);
  
  // 🔐 CHECK FOR E2EE PIN DIALOG
  const pinDialog = await page.locator('[aria-label*="Enter PIN"]').first();
  const isPinVisible = await pinDialog.isVisible({ timeout: 2000 }).catch(() => false);
  
  if (isPinVisible) {
    // E2EE conversation requires PIN
    const accountPin = await db.account.findUnique({
      where: { id: contact.accountId },
      select: { messengerPin: true }
    });
    
    if (!accountPin?.messengerPin) {
      // No PIN configured - skip this conversation
      await addLog(`⚠️ E2EE PIN required for ${contact.contactName} but not configured`);
      continue;
    }
    
    // Enter PIN to unlock conversation
    await addLog(`🔓 Entering PIN for E2EE conversation: ${contact.contactName}`);
    const pinInput = await page.locator('input[type="tel"][maxlength="1"]').first();
    await pinInput.evaluate((el) => el.focus()); // Bypass overlay
    
    for (const digit of accountPin.messengerPin) {
      await page.keyboard.type(digit);
      await page.waitForTimeout(100);
    }
    
    // Wait for conversation to unlock
    await page.waitForTimeout(2000);
    
    // Verify PIN was accepted (check if dialog disappeared)
    const stillVisible = await pinDialog.isVisible({ timeout: 1000 }).catch(() => false);
    if (stillVisible) {
      await addLog(`❌ Incorrect PIN for ${contact.contactName}`);
      continue;
    }
    
    await addLog(`✅ E2EE conversation unlocked: ${contact.contactName}`);
  }
  
  // Read full conversation context
  const messages = await readConversationMessages(page);
  
  // Get business context
  const business = await db.business.findFirst();
  const services = await db.service.findMany();
  
  // Generate AI reply
  const reply = await generateAIReply({
    conversation: messages,
    business: business,
    services: services,
    leadName: contact.contactName,
  });
  
  // Send reply
  await sendMessage(page, reply);
  
  // Update state
  await db.messengerContact.update({
    where: { id: contact.id },
    data: {
      state: "REPLIED",
      ourMessageCount: contact.ourMessageCount + 1,
      lastCheckedAt: new Date(),
    }
  });
}
```

---

## 📊 Database Schema

```prisma
model MessengerContact {
  id                String   @id @default(cuid())
  accountId         String
  contactName       String
  contactFbId       String?
  conversationUrl   String
  
  // Sidebar-based tracking (THE KEY!)
  lastTheirMessage  String?    // Last message preview from sidebar
  lastMessageIsOurs Boolean?   // true = we sent last, false = they sent last
  
  // E2EE Support
  isE2EE            Boolean  @default(false)  // Is this an encrypted conversation?
  
  // State management
  state             String?    // INITIALIZED, NEEDS_REPLY, REPLIED, etc.
  previousState     String?
  stateChangedAt    DateTime?
  
  // Timestamps
  lastCheckedAt     DateTime?
  lastActivityAt    DateTime?
  conversationEnded Boolean  @default(false)
  
  // Relations
  account           Account  @relation(fields: [accountId], references: [id])
  leadId            String?
  lead              Lead?    @relation(fields: [leadId], references: [id])
}

model Account {
  id                String   @id @default(cuid())
  name              String?
  email             String
  
  // E2EE PIN for encrypted conversations
  messengerPin      String?  // 6-digit PIN for E2EE conversations
  
  // ... other fields
}
```

**Key Fields for Detection:**
- `lastTheirMessage` - Stored sidebar preview (baseline)
- `lastMessageIsOurs` - Who sent last message
- `isE2EE` - Flag for E2EE conversations requiring PIN
- `messengerPin` - 6-digit PIN stored for auto-unlock
- Compare with current sidebar → if different + not ours = NEW MESSAGE!
```

---

## 🔐 E2EE (End-to-End Encryption) Handling

### Why E2EE Matters

Facebook Messenger conversations can be **End-to-End Encrypted (E2EE)**. When opening an E2EE conversation, Facebook may show a PIN dialog to "restore chat history". The agent must handle this automatically.

### 🚨 CRITICAL: Check PIN on EVERY Browser Open

**The PIN dialog can appear:**
1. ✅ **When first opening Messenger** (most common)
2. ✅ **When opening a specific E2EE conversation**
3. ✅ **After browser session expires**
4. ✅ **Randomly as security check**

**Therefore:** The agent MUST check for the PIN dialog:
- **Immediately after navigating to Messenger** (before doing anything else)
- **Before opening any E2EE conversation**
- **After any page navigation**

### Detection Flow

```typescript
// ALWAYS check for PIN after opening Messenger
async function checkAndEnterPinIfNeeded(page, accountPin) {
  const pinDialog = await page.locator('[aria-label*="Enter PIN"]').first();
  const isPinVisible = await pinDialog.isVisible({ timeout: 2000 }).catch(() => false);

  if (isPinVisible) {
    if (!accountPin) {
      throw new Error("E2EE PIN required but not configured");
    }
    
    // Auto-enter PIN
    const pinInput = await page.locator('input[type="tel"][maxlength="1"]').first();
    await pinInput.evaluate((el) => el.focus());
    
    for (const digit of accountPin) {
      await page.keyboard.type(digit);
      await page.waitForTimeout(100);
    }
    
    // Wait for unlock
    await page.waitForTimeout(2000);
    
    // Verify unlocked
    const stillVisible = await pinDialog.isVisible({ timeout: 1000 }).catch(() => false);
    if (stillVisible) {
      throw new Error("Incorrect PIN");
    }
    
    return true; // PIN was entered
  }
  
  return false; // No PIN needed
}

// Usage in every agent cycle:
await page.goto("https://facebook.com/messages/t/");
await checkAndEnterPinIfNeeded(page, account.messengerPin); // ← ALWAYS!
// Now proceed with sidebar scan...
```

### PIN Storage & Configuration

- **Storage:** Each Account has a `messengerPin` field (6 digits)
- **Configuration:** Admin sets PIN via UI (one-time setup)
- **Security:** PIN is stored in database (consider encryption for production)
- **Auto-entry:** Agent automatically enters PIN when E2EE dialog appears

### E2EE Workflow in Agent

```
┌──────────────────────────────────────────────────────────────┐
│  AGENT OPENS BROWSER & MESSENGER                              │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  1. Launch browser with account session                       │
│  2. Navigate to facebook.com/messages/t/                      │
│  3. 🔐 CHECK FOR PIN DIALOG (ALWAYS!)                          │
│                                                               │
│     ┌─ IF PIN DIALOG VISIBLE ────────────────────────┐        │
│     │                                                 │        │
│     │  a) Load messengerPin from Account              │        │
│     │  b) If no PIN configured:                       │        │
│     │     └─ Throw error, stop agent                  │        │
│     │  c) If PIN exists:                              │        │
│     │     ├─ Focus PIN input (bypass overlay)         │        │
│     │     ├─ Enter 6 digits one by one                │        │
│     │     ├─ Wait 2s for unlock                       │        │
│     │     └─ Verify dialog disappeared                │        │
│     │                                                 │        │
│     └─────────────────────────────────────────────────┘        │
│                                                               │
│  4. NOW proceed with sidebar scan                             │
│  5. Compare with database                                     │
│  6. For each NEEDS_REPLY:                                     │
│     a) Open conversation                                      │
│     b) 🔐 CHECK FOR PIN AGAIN (per-conversation)               │
│     c) Read messages & send reply                             │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Error Handling

| Error | Handling |
|-------|----------|
| **No PIN configured** | Skip conversation, log warning |
| **Incorrect PIN** | Skip conversation, alert admin |
| **PIN dialog timeout** | Continue (not E2EE) |
| **Unlock timeout** | Retry once, then skip |

---

## 🛠️ API Endpoints

### 1. Initialize Conversations (One-Time Setup)
```bash
POST /api/agents/message-init
{
  "accountId": "account_123"
}
```

**What it does:**
- Scans entire Messenger sidebar
- Saves ALL conversations to database
- Sets initial state: INITIALIZED

---

### 2. Monitor & Reply (Scheduled Agent)
```bash
POST /api/agents/message-monitor
{
  "accountId": "account_123"
}
```

**What it does:**
- Scans sidebar for changes
- Detects new messages
- Generates & sends AI replies
- Updates conversation states

---

### 3. Manual Test: Sidebar Scan
```bash
POST /api/test/conversation-tracking
{
  "accountId": "account_123",
  "action": "scan"
}
```

**Returns:**
```json
{
  "success": true,
  "states": [
    {
      "contactName": "Salma Guizeni",
      "lastTheirMessage": "tkolich makech rajel...",
      "state": "NEEDS_REPLY",
      "lastMessageIsOurs": false
    }
  ]
}
```

---

## 🎨 Smart Filtering

### What Gets Filtered Out

❌ **System Messages:**
- "You're now friends with..."
- "You are now connected on Messenger"
- "Messages and calls are secured with end-to-end..."
- "Message unavailable"

❌ **Meta/Facebook Official:**
- Conversations with "Facebook user"
- Conversations with "Meta Business Support"

✅ **Real Conversations Only:**
- Actual people
- Actual messages
- Conversations that need replies

---

## 🔐 E2EE & PIN Handling

For encrypted conversations (E2EE), the system:

1. Detects PIN dialog when opening conversation
2. Enters stored `conversationPin` from Account model
3. Continues with message reading/sending
4. Handles PIN errors gracefully

```typescript
// Account model includes:
{
  conversationPin: "123456" // 6-digit PIN for E2EE
}
```

---

## 🚦 Scheduling Strategy

### Recommended Schedule

| Frequency | Use Case |
|-----------|----------|
| **Every 5 min** | High-priority accounts (active sales) |
| **Every 15 min** | Standard accounts |
| **Every 30 min** | Low-priority / monitoring only |
| **Every hour** | Archive check / cleanup |

**Configure in:**
```typescript
// lib/schedule-service.ts
{
  accountId: "account_123",
  agentType: "MESSAGE_MONITOR",
  schedule: "*/15 * * * *" // Every 15 minutes
}
```

---

## 📈 Performance Benefits

### Old Approach (Opening Each Conversation)
- ❌ Had to open EVERY conversation
- ❌ Scroll to load all messages
- ❌ Count messages / calculate hashes
- ❌ Compare counts/hashes
- ⏱️ **~10 seconds per conversation**
- ⏱️ **17 conversations = ~3 minutes**

### New Approach (Sidebar-Only)
- ✅ Just scan the sidebar once
- ✅ Read preview text directly from sidebar
- ✅ Simple string comparison with database
- ✅ Check "You:" prefix for sender
- ⏱️ **~10 seconds for ALL conversations**

**Result:** 18x faster detection!

---

## 🎯 Workflow Example

### Day 1: Setup
```bash
# Initialize all conversations (one-time)
POST /api/agents/message-init
→ Scans sidebar
→ 17 conversations found
→ 12 saved to DB (5 system messages filtered)
→ Each has: name, URL, last message preview
→ All set to INITIALIZED
```

### Day 1: Scheduled Agent Runs
```
15:00 - Sidebar scan
        → Compare each sidebar message with DB
        → All match → No changes
        
15:15 - Sidebar scan
        → All match → No changes
        
15:30 - Sidebar scan
        → "Salma Guizeni" sidebar: "oui d'accord je suis..."
        → Database stored: "tkolich makech rajel..."
        → DIFFERENT! And not "You:" prefix
        → ✅ NEW MESSAGE DETECTED
        → State: INITIALIZED → NEEDS_REPLY
        → Open conversation, read context
        → AI generates reply
        → Send reply
        → State: REPLIED
        → Update DB: lastTheirMessage = our reply preview
        
15:45 - Sidebar scan → All match → No changes
```

### Day 2: Follow-up
```
10:00 - Sidebar scan → ✅ Salma replied back
        → State: REPLIED → NEEDS_REPLY
        → AI generates reply
        → Reply sent
        → State: REPLIED
```

---

## 🧪 Testing

### Test Sidebar Scan
Navigate to: `/dashboard/agents/testing/conversation`

**Sidebar Scan Tab:**
- Shows all conversations
- Displays last message
- Shows who sent last message
- Filters system messages
- Real-time preview

---

## 🎓 Summary

### The Simple Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  1. INIT (One-Time)                                                  │
│     └─ Scan sidebar → Save all conversations + last message to DB   │
│                                                                      │
│  2. MONITOR (Every 15 min)                                           │
│     └─ Scan sidebar → Compare with DB                                │
│         └─ If message changed + not from us = NEW MESSAGE            │
│                                                                      │
│  3. DETECT                                                           │
│     └─ sidebarMessage !== storedMessage && !isOurs                   │
│         └─ State → NEEDS_REPLY                                       │
│                                                                      │
│  4. REPLY                                                            │
│     └─ For each NEEDS_REPLY:                                         │
│         ├─ Open conversation (only now!)                             │
│         ├─ Read full context                                         │
│         ├─ Generate AI reply                                         │
│         ├─ Send reply                                                │
│         └─ State → REPLIED, update lastTheirMessage                  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Why It Works

| Feature | Benefit |
|---------|---------|
| 🚀 **Sidebar-only scanning** | 18x faster than opening each conversation |
| 💡 **Simple string comparison** | No hashes, no counting, just compare text |
| 🎯 **"You:" detection** | Know if we sent last or they sent last |
| 🔄 **Baseline in DB** | Compare current sidebar vs stored = detect changes |
| 🧹 **Auto-filter system msgs** | Only real conversations tracked |
| ⚡ **Open only when needed** | Only opens conversation to reply, not to check |

---

## 📝 Next Steps

1. ✅ Sidebar scanning implemented
2. ✅ Smart filtering added  
3. ✅ UI for testing created
4. ✅ Documentation updated
5. 🔄 **Next:** Implement scheduled message monitor agent
6. 🔄 **Next:** Connect to AI reply generation
7. 🔄 **Next:** Link to Lead qualification

---

**Last Updated:** January 2, 2026
