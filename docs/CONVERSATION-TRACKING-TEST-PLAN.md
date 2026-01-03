# 🧪 Conversation Tracking Test Plan

## Overview

This document outlines the testing strategy for the **two-layer message detection system**:

1. **Layer 1: Sidebar Scan** - Quick check for unread badges in the conversation list
2. **Layer 2: Quick Check Hash** - Fast check of last 3 messages to detect changes

This dual approach ensures we catch all new messages while keeping CPU/time usage minimal.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                    TWO-LAYER MESSAGE DETECTION                                   │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │  LAYER 1: SIDEBAR SCAN (Fast, ~5 seconds)                                   │ │
│  │  ───────────────────────────────────────────────────────                    │ │
│  │  • Check conversation list for unread badges                                │ │
│  │  • Blue dot or bold text = new message                                      │ │
│  │  • If found: Mark contact as NEEDS_REPLY                                    │ │
│  │  • Run every 30 seconds                                                     │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                              │                                                   │
│                              ▼                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │  LAYER 2: QUICK CHECK HASH (Medium, ~10 seconds per conversation)          │ │
│  │  ─────────────────────────────────────────────────────────────              │ │
│  │  • Open conversation (no scroll)                                            │ │
│  │  • Read last 3 visible messages                                             │ │
│  │  • Create hash: "them:msg1|us:msg2|them:msg3"                               │ │
│  │  • Compare to stored hash                                                   │ │
│  │  • If changed: Something happened, check further                            │ │
│  │  • Run every 5 minutes on ACTIVE conversations                              │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                              │                                                   │
│                              ▼                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │  FULL COUNT (Slow, ~60 seconds per conversation)                            │ │
│  │  ─────────────────────────────────────────────────────                      │ │
│  │  • Only when quick check detects change                                     │ │
│  │  • Scroll entire conversation                                               │ │
│  │  • Count all messages (theirs vs ours)                                      │ │
│  │  • Compare counts to detect exact changes                                   │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Database Fields Used

From `MessengerContact` model:

```prisma
model MessengerContact {
  // Message Counts (THE KEY!)
  totalMessageCount   Int @default(0)
  theirMessageCount   Int @default(0)  // Messages FROM lead
  ourMessageCount     Int @default(0)  // Messages FROM us
  
  // Quick Check hash (last 3 messages)
  quickCheckHash      String?  // e.g., "dGhlbTpoZWxsb3x1czpo..."
  
  // Last messages
  lastTheirMessage    String?
  lastTheirMessageAt  DateTime?
  lastOurReply        String?
  lastOurReplyAt      DateTime?
  
  // State
  state               ConversationStateEnum?  // NEW | NEEDS_REPLY | WAITING | ENDED
  lastCheckedAt       DateTime?
  lastFullCheckAt     DateTime?  // Last time we did full scroll count
}
```

---

## 🧪 Test Scenarios

### Test 1: Sidebar Unread Detection

**Goal**: Verify we can detect unread badges in the Messenger sidebar

**Setup**:
1. Have a conversation with no unread messages
2. Ask someone to send a new message

**Steps**:
1. Run sidebar scan API
2. Check if the conversation shows `hasUnreadBadge: true`

**API Call**:
```http
POST /api/test/state-machine
{
  "accountId": "your-account-id",
  "action": "scan"
}
```

**Expected Result**:
```json
{
  "changes": [
    {
      "contact": "Salma Guizeni",
      "from": "WAITING",
      "to": "NEEDS_REPLY",
      "reason": "Unread badge detected"
    }
  ]
}
```

---

### Test 2: Quick Check Hash Change Detection

**Goal**: Verify the hash-based detection catches new messages

**Setup**:
1. Initialize a conversation with known state
2. Note the `quickCheckHash` value

**Steps**:
1. Ask someone to send a new message
2. Run quick check on that conversation
3. Compare new hash to stored hash

**API Call**:
```http
POST /api/test/state-machine
{
  "accountId": "your-account-id",
  "action": "count",
  "onlyContact": "Salma Guizeni"
}
```

**Expected Result**:
- `quickCheckHash` should be different
- `lastTheirMessage` should be updated
- State should change to `NEEDS_REPLY`

---

### Test 3: Message Count Comparison

**Goal**: Verify count-based detection accurately tracks messages

**Setup**:
1. Know the current counts: `theirMessageCount: 5, ourMessageCount: 3`

**Steps**:
1. They send 2 new messages
2. Run full count
3. Compare counts

**Expected Result**:
```
Before: { theirs: 5, ours: 3 }
After:  { theirs: 7, ours: 3 }
Delta:  +2 their messages → NEEDS_REPLY
```

---

### Test 4: Initiator → Conversation Init Flow

**Goal**: Test the full flow from Initiator Agent to Message Agent

**Steps**:
1. **Scraper creates Lead** (Lead exists with `authorName`)
2. **Initiator sends DM** to lead
3. **Run Conversation Initializer** to link Messenger contact to Lead
4. **Verify MessengerContact** was created with:
   - `leadId` linked
   - `state: NEW` or `WAITING`
   - `ourMessageCount: 1` (we sent first DM)
5. **Lead replies**
6. **Run sidebar scan** → Should detect unread
7. **Run quick check** → Hash should change
8. **Message Agent processes** → Should reply with lead context

---

### Test 5: Edge Case - No Unread Badge but Hash Changed

**Goal**: Catch messages that Facebook doesn't mark as unread (edge case)

**Setup**:
1. Sometimes FB shows message as "read" when it wasn't
2. Hash should still catch the change

**Steps**:
1. Have someone send a message
2. FB might not show unread badge (bug/timing)
3. Quick check hash should still detect change

**Expected Result**:
- Sidebar scan: No unread detected ❌
- Quick check: Hash changed ✅
- State → NEEDS_REPLY

---

## 🔧 Test API Endpoints

### 1. Sidebar Scan

```http
POST /api/test/state-machine
{
  "accountId": "account-123",
  "action": "scan"
}
```

**What it does**:
- Opens Messenger sidebar
- Checks all conversations for unread badges
- Updates state to `NEEDS_REPLY` for any with unread
- Returns list of changes

---

### 2. Quick Check (Count Action)

```http
POST /api/test/state-machine
{
  "accountId": "account-123",
  "action": "count",
  "onlyContact": "Salma Guizeni"  // Optional: check specific contact
}
```

**What it does**:
- For each ACTIVE contact, opens conversation
- Reads last 3 messages (no scroll)
- Creates hash and compares to stored
- If hash different → runs full count
- Updates message counts and state

---

### 3. Full Initialization

```http
POST /api/test/state-machine
{
  "accountId": "account-123",
  "action": "init",
  "endAtContact": "Fatma Kchouk"  // Optional: stop at this contact
}
```

**What it does**:
- Scrolls sidebar to load all conversations
- For each conversation:
  - Opens it
  - Scrolls full history
  - Counts all messages
  - Stores initial state

---

### 4. Init Conversations (Link to Leads)

```http
POST /api/test/init-conversations
{
  "accountId": "account-123",
  "maxConversations": 50,
  "scrollCount": 3
}
```

**What it does**:
- Scrapes Messenger for all conversations
- Matches each to existing Leads (by name/URL)
- Creates `MessengerContact` records with `leadId` linked

---

## 📋 Testing Checklist

### Phase 1: Setup
- [ ] Have at least 5-10 leads in the database
- [ ] Run Initiator Agent to send initial DMs
- [ ] Run Conversation Initializer to link contacts to leads

### Phase 2: Detection Testing
- [ ] **Test 1**: Send a message, run sidebar scan, verify detection
- [ ] **Test 2**: Check hash changes when new message arrives
- [ ] **Test 3**: Verify count accuracy after multiple messages
- [ ] **Test 4**: Test full flow: Lead → DM → Reply → Detection → AI Reply

### Phase 3: State Machine Testing
- [ ] NEW → NEEDS_REPLY (they message)
- [ ] NEEDS_REPLY → WAITING (we reply)
- [ ] WAITING → NEEDS_REPLY (they reply again)
- [ ] WAITING → IDLE (no activity 30+ min)
- [ ] Any → ENDED (AI decides to end)

### Phase 4: Edge Cases
- [ ] Multiple rapid messages (handle all)
- [ ] Message while we're typing reply
- [ ] Deleted messages (count decrease)
- [ ] Edited messages (might change hash)
- [ ] Group chats (should be filtered)

---

## 🛠️ Manual Testing Steps

### Step 1: Initialize the System

```bash
# 1. Open testing dashboard
# Dashboard → Agents → Testing

# 2. Select your Facebook account

# 3. Go to "Conv Init" tab

# 4. Click "Initialize Conversations"
# This links Messenger contacts to Leads
```

### Step 2: Simulate a Lead Message

1. Open Facebook Messenger on your phone (as a test lead)
2. Send a message to your bot account
3. Wait 10 seconds

### Step 3: Run Detection

```bash
# In testing dashboard or via API:

# 1. Run Sidebar Scan
POST /api/test/state-machine
{ "accountId": "...", "action": "scan" }

# Expected: See "NEEDS_REPLY" in the changes

# 2. Run Quick Check (if needed)
POST /api/test/state-machine
{ "accountId": "...", "action": "count" }

# Expected: Hash change detected, state updated
```

### Step 4: Run Message Agent

```bash
# In testing dashboard, "Message" tab:
# Click "Run Message Agent"

# Expected:
# 1. Opens unread conversation
# 2. Reads messages
# 3. Gets lead context (original post)
# 4. Generates AI reply
# 5. Sends message
# 6. Updates state to WAITING
```

### Step 5: Verify Database

```sql
-- Check MessengerContact state
SELECT contact_name, state, their_message_count, our_message_count, quick_check_hash
FROM messenger_contacts
WHERE account_id = 'your-account'
ORDER BY last_activity_at DESC;

-- Check Lead stage updated
SELECT l.author_name, l.stage, mc.state
FROM leads l
JOIN messenger_contacts mc ON mc.lead_id = l.id
ORDER BY l.updated_at DESC;
```

---

## 📈 Expected Results

### Successful Detection

| Scenario | Sidebar | Quick Hash | Full Count | Result |
|----------|---------|------------|------------|--------|
| New message | ✅ Unread | ✅ Changed | ✅ +1 their | NEEDS_REPLY |
| We replied | ❌ | ✅ Changed | ✅ +1 ours | WAITING |
| Multiple msgs | ✅ Unread | ✅ Changed | ✅ +N their | NEEDS_REPLY |
| No change | ❌ | ❌ Same | N/A | No action |

### State Transitions

```
Initial state: NEW
  → They message → NEEDS_REPLY
  → We reply → WAITING
  → They reply → NEEDS_REPLY
  → We reply → WAITING
  → No activity 30min → IDLE
  → AI ends conversation → ENDED
```

---

## 🐛 Debugging Tips

### Issue: Sidebar not detecting unread

1. Check if the account is logged in properly
2. Facebook might use different unread indicators (check DOM)
3. Try refreshing the page before scan

### Issue: Hash not changing

1. Verify conversation was loaded fully
2. Check if the last 3 messages are visible without scrolling
3. Look at the actual messages being extracted

### Issue: Counts are wrong

1. Check the line-height detection (must be 19.9-20.0)
2. Check the background color detection for sender
3. Verify scrolling is working properly

### Issue: Lead context not available

1. Verify `MessengerContact.leadId` is set
2. Check if Lead exists in database
3. Run Conversation Initializer again

---

## 📁 Related Files

- [app/api/test/state-machine/route.ts](../app/api/test/state-machine/route.ts) - State machine test API
- [app/api/test/init-conversations/route.ts](../app/api/test/init-conversations/route.ts) - Conversation initializer
- [agents/message-agent.ts](../agents/message-agent.ts) - Message Agent implementation
- [docs/CONVERSATION-STATE-MACHINE.md](CONVERSATION-STATE-MACHINE.md) - State machine documentation
- [docs/MESSAGE-AGENT-GUIDE.md](MESSAGE-AGENT-GUIDE.md) - Message Agent guide
