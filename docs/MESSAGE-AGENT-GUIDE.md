# ðŸ’¬ Message Agent - Complete Guide

## Overview

The Message Agent is an automated system that monitors Facebook Messenger conversations, detects new messages from leads, generates AI-powered replies, and ensures **no message goes unanswered**. It works hand-in-hand with the **Conversation State Machine** to track every conversation reliably.

---

## ðŸ—ï¸ Architecture

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                        SCHEDULER                                 â”‚
â”‚  Runs Message Agent on schedule (e.g., every 5 minutes)         â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                              â”‚
                              â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    STATE MACHINE                                 â”‚
â”‚  - Tracks all conversations                                      â”‚
â”‚  - Counts messages (theirs vs ours)                             â”‚
â”‚  - Detects state changes                                         â”‚
â”‚  - Persists to JSON file                                         â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                              â”‚
                              â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    MESSAGE AGENT                                 â”‚
â”‚  - Reads NEEDS_REPLY conversations                              â”‚
â”‚  - Opens each conversation                                       â”‚
â”‚  - Generates AI reply                                            â”‚
â”‚  - Sends message                                                 â”‚
â”‚  - Updates state to WAITING                                      â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## ðŸ“Š Conversation States

| State | Description | Next Action |
|-------|-------------|-------------|
| `NEW` | Just discovered, not yet analyzed | Initialize counts |
| `NEEDS_REPLY` | They sent a message, we haven't replied | **Agent sends reply** |
| `WAITING` | We replied, waiting for their response | Monitor for new messages |
| `ACTIVE` | Ongoing conversation, no immediate action needed | Monitor |
| `IDLE` | No activity for extended period | May need follow-up |
| `ENDED` | Conversation concluded (by AI decision or user) | Skip |

---

## ðŸ”„ State Transitions

```
                    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                    â”‚     NEW      â”‚
                    â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”˜
                           â”‚ initialize
                           â–¼
        â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
        â”‚                                      â”‚
        â–¼                                      â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  NEEDS_REPLY  â”‚â—„â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”‚     WAITING     â”‚
â”‚  (they sent)  â”‚    they reply      â”‚  (we replied)   â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”˜                    â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”˜
        â”‚                                      â–²
        â”‚ agent sends reply                    â”‚
        â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
        
        â”‚                                      â”‚
        â”‚ no activity (timeout)                â”‚ no activity
        â–¼                                      â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚     IDLE      â”‚                    â”‚     ENDED       â”‚
â”‚ (follow-up?)  â”‚                    â”‚  (concluded)    â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## ðŸ†• Adding New Conversations

### How New Conversations Are Detected

After initialization, new conversations (when someone messages you for the first time) are automatically detected and added:

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    SCAN ACTION FLOW                             â”‚
â”‚                                                                 â”‚
â”‚  1. Extract all conversations from sidebar                      â”‚
â”‚  2. Filter those with unread badges                             â”‚
â”‚  3. For each unread conversation:                               â”‚
â”‚     â”œâ”€ If EXISTS in states â†’ Update state to NEEDS_REPLY        â”‚
â”‚     â””â”€ If NEW (not in states):                                  â”‚
â”‚         â”œâ”€ Open the conversation                                â”‚
â”‚         â”œâ”€ Count all messages (theirs vs ours)                  â”‚
â”‚         â”œâ”€ Create new state entry with counts                   â”‚
â”‚         â””â”€ Set state to NEEDS_REPLY                             â”‚
â”‚  4. Save updated states                                         â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### What Triggers Detection

| Action | Detects New Conversations? | Counts Messages? |
|--------|---------------------------|------------------|
| `init` | âœ… Yes (all in range) | âœ… Yes (full scroll) |
| `scan` | âœ… Yes (unread only) | âœ… Yes (for new ones) |
| `count` | âŒ No (only tracked) | âœ… Yes |
| `full` | âœ… Yes (via scan) | âœ… Yes |

### Example: New Lead Messages You

```
Before scan:
  States: [Salma, Ahmed, Mohamed] - 3 conversations

Someone new "Fatma" sends a message:
  Facebook shows unread badge on "Fatma"

During scan:
  1. Sees "Fatma" has unread badge
  2. Checks: "Fatma" not in states â†’ NEW!
  3. Opens conversation, counts: 1 their message, 0 ours
  4. Creates state: { name: "Fatma", state: "NEEDS_REPLY", theirs: 1, ours: 0 }

After scan:
  States: [Salma, Ahmed, Mohamed, Fatma] - 4 conversations
  Fatma ready for Message Agent to reply!
```

---

## ðŸ§  State Machine - The Foundation

### What It Tracks

For each conversation, the State Machine stores:

```typescript
{
  id: string;                    // Unique identifier
  contactFbId: string;           // Facebook user ID
  contactName: string;           // Display name
  conversationUrl: string;       // Direct link to conversation
  state: 'NEW' | 'NEEDS_REPLY' | 'WAITING' | 'ACTIVE' | 'IDLE' | 'ENDED';
  
  // Message counts - THE KEY TO RELIABILITY
  totalMessageCount: number;     // Total messages in conversation
  theirMessageCount: number;     // Messages from the lead
  ourMessageCount: number;       // Messages from us
  
  lastTheirMessage: string;      // Last message they sent
  lastTheirMessageHash: string;  // Hash for quick comparison
  lastCheckedAt: string;         // ISO timestamp
  stateChangedAt: string;        // When state last changed
  
  conversationEnded: boolean;    // AI decided to end?
  debugInfo: string;             // Reason for current state
}
```

### Why Message Counts?

**The Problem:** Facebook's unread badges are unreliable. Messages can arrive without showing a badge.

**The Solution:** Count actual messages in the DOM.

```
Previous check:  Theirs: 5, Ours: 3
Current check:   Theirs: 7, Ours: 3
                 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Detected:        +2 new messages from them â†’ NEEDS_REPLY
```

### Message Detection Logic

```typescript
// How we detect valid messages (from message-agent)
const isValidMessage = (element) => {
  const style = getComputedStyle(element);
  const lineHeight = parseFloat(style.lineHeight);
  
  // Valid messages have lineHeight between 19.9-20.0
  return lineHeight >= 19.9 && lineHeight <= 20.0;
};

// How we detect sender
const getSender = (element) => {
  const parent = element.parentElement;
  const bgColor = getComputedStyle(parent).backgroundColor;
  
  // Gray background = their message
  if (bgColor.includes('48, 48, 48') || bgColor.includes('58, 58, 58')) {
    return 'them';
  }
  // Anything else = our message
  return 'us';
};
```

---

## ðŸ¤– Message Agent - The Responder

### Flow

```
1. Load conversation states from file
2. Filter: state === 'NEEDS_REPLY'
3. For each conversation:
   a. Navigate to conversation URL
   b. Scroll to load all messages
   c. Extract full conversation history
   d. Generate AI reply using context
   e. Send message
   f. Update state to 'WAITING'
   g. Save updated states
4. Continue monitoring...
```

### AI Reply Generation

The agent uses Azure OpenAI to generate contextual replies:

```typescript
const systemPrompt = `
Ø£Ù†Øª Ù…Ù†Ø¯ÙˆØ¨ Ù…Ø¨ÙŠØ¹Ø§Øª ÙÙŠ NextGen Coding.
ØªÙƒØªØ¨ Ø¨Ø§Ù„Ø¯Ø§Ø±Ø¬Ø© Ø§Ù„ØªÙˆÙ†Ø³ÙŠØ© ÙƒØ£Ù†Ùƒ Ø´Ø®Øµ Ø­Ù‚ÙŠÙ‚ÙŠ.

Ù‚ÙˆØ§Ø¹Ø¯:
- Ø¬Ù…Ù„ Ù‚ØµÙŠØ±Ø© (10 ÙƒÙ„Ù…Ø§Øª max)
- Ù„Ø§ ØªÙƒØ±Ø± Ø§Ù„ØªØ­ÙŠØ©
- Ù„Ø§ emoji
- Ø§Ø³Ø£Ù„ Ø¹Ù† Ø§Ø­ØªÙŠØ§Ø¬Ø§ØªÙ‡Ù…
`;

const reply = await generateText({
  model: azure('gpt-4o-mini'),
  system: systemPrompt,
  prompt: conversationHistory,
});
```

### Safety Checks

Before sending any message:

```typescript
// Check for new messages BEFORE sending
const preSendCheck = await collectAllNewMessages(page, contactName, conversationState);

if (preSendCheck.length > 0) {
  // New message arrived while we were typing!
  // Abort send, re-analyze with new context
  return { sent: false, newMessagesDetected: true };
}

// Safe to send
await sendMessage(replyText);
```

---

## â° Scheduling System

### How It Works

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                       CRON SCHEDULE                             â”‚
â”‚                                                                 â”‚
â”‚  Every 5 minutes:                                               â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  â”‚ 1. State Machine: SCAN                                   â”‚   â”‚
â”‚  â”‚    - Check all conversations for unread badges           â”‚   â”‚
â”‚  â”‚    - Quick pass, finds obvious new messages              â”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â”‚                              â”‚                                  â”‚
â”‚                              â–¼                                  â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  â”‚ 2. State Machine: COUNT                                  â”‚   â”‚
â”‚  â”‚    - Open NEEDS_REPLY conversations                      â”‚   â”‚
â”‚  â”‚    - Count messages (catches missed ones)                â”‚   â”‚
â”‚  â”‚    - Update states based on counts                       â”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â”‚                              â”‚                                  â”‚
â”‚                              â–¼                                  â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  â”‚ 3. Message Agent: PROCESS                                â”‚   â”‚
â”‚  â”‚    - Get all NEEDS_REPLY states                          â”‚   â”‚
â”‚  â”‚    - Generate and send replies                           â”‚   â”‚
â”‚  â”‚    - Update states to WAITING                            â”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â”‚                                                                 â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Recommended Schedule

| Task | Frequency | Duration | Purpose |
|------|-----------|----------|---------|
| Fast Scan | Every 2 min | ~10 sec | Catch obvious unreads |
| Deep Count | Every 10 min | ~2-5 min | Ensure nothing missed |
| Message Agent | After each count | Varies | Reply to leads |
| Full Init | Daily (night) | ~30 min | Rebuild state from scratch |

### Implementation

```typescript
// schedule-service.ts
const schedules = {
  fastScan: '*/2 * * * *',      // Every 2 minutes
  deepCount: '*/10 * * * *',    // Every 10 minutes  
  fullRebuild: '0 3 * * *',     // 3 AM daily
};

async function runScheduledTasks() {
  // 1. Quick scan for unread badges
  await stateMachine.scan();
  
  // 2. Deep count on NEEDS_REPLY conversations
  await stateMachine.count();
  
  // 3. Process conversations needing reply
  const needsReply = states.filter(s => s.state === 'NEEDS_REPLY');
  
  for (const conv of needsReply) {
    await messageAgent.processConversation(conv);
  }
}
```

---

## ðŸ“ Data Storage

### File Structure

```
worker/
â”œâ”€â”€ states/
â”‚   â”œâ”€â”€ account-123.json        # State machine data
â”‚   â””â”€â”€ account-456.json
â”œâ”€â”€ profiles/
â”‚   â”œâ”€â”€ account-123/            # Browser profile
â”‚   â””â”€â”€ account-456/
â””â”€â”€ sessions/
    â”œâ”€â”€ account-123.json        # Login session
    â””â”€â”€ account-456.json
```

### State File Format

```json
{
  "states": [
    {
      "id": "conv-1703847200000-0",
      "contactFbId": "100012345678",
      "contactName": "Salma Guizeni",
      "conversationUrl": "https://facebook.com/messages/t/100012345678",
      "state": "NEEDS_REPLY",
      "totalMessageCount": 15,
      "theirMessageCount": 8,
      "ourMessageCount": 7,
      "lastTheirMessage": "ÙƒÙŠÙØ§Ø´ Ø§Ù„Ø£Ø³Ø¹Ø§Ø±ØŸ",
      "lastCheckedAt": "2024-12-29T10:30:00.000Z",
      "stateChangedAt": "2024-12-29T10:25:00.000Z"
    }
  ],
  "lastUpdated": "2024-12-29T10:30:00.000Z"
}
```

---

## ðŸ”§ API Endpoints

### State Machine Actions

```http
POST /api/test/state-machine
Content-Type: application/json

{
  "accountId": "account-123",
  "action": "init" | "scan" | "count" | "full",
  "startFromContact": "Salma Guizeni"  // Optional: process until this contact
}
```

| Action | Description |
|--------|-------------|
| `init` | Full initialization - scroll through all conversations, count messages |
| `scan` | Fast scan - check unread badges only |
| `count` | Deep count - open tracked conversations, recount messages |
| `full` | Combined: scan + count on NEEDS_REPLY + process |

### Message Agent

```http
POST /api/test/message-agent
Content-Type: application/json

{
  "accountId": "account-123"
}
```

---

## ðŸŽ¯ Best Practices

### 1. Initialize Properly

Before running the agent in production:

```
1. Run INIT with "End at" set to your oldest active lead
2. Verify message counts look correct
3. Check that theirs/ours split makes sense
4. Run a few test replies manually
```

### 2. Handle Edge Cases

```typescript
// Conversation ended by AI
if (reply.includes('[END_CONVERSATION]')) {
  state.conversationEnded = true;
  state.state = 'ENDED';
  // Don't process this conversation again
}

// No messages found (deleted conversation?)
if (counts.total === 0) {
  state.state = 'ENDED';
  state.debugInfo = 'Conversation may have been deleted';
}
```

### 3. Monitor Health

Track these metrics:
- Conversations processed per hour
- Average reply time
- Failed sends (and reasons)
- State distribution over time

### 4. Respect Limits

```typescript
// Don't spam - wait between messages
await humanDelay(500, 1000);

// Limit conversations per run
const MAX_CONVERSATIONS_PER_RUN = 20;

// Back off on errors
if (consecutiveErrors > 3) {
  await sleep(60000); // Wait 1 minute
}
```

---

## ðŸš¨ Error Handling

### Common Issues

| Error | Cause | Solution |
|-------|-------|----------|
| "Could not find message input" | DOM changed or page not loaded | Increase wait time, check selectors |
| "0 messages found" | Scroll didn't work or wrong lineHeight | Verify scroll logic, check CSS values |
| "All messages show as theirs" | Background color detection failed | Check if FB changed their colors |
| "Rate limited" | Too many requests | Increase delays between actions |

### Recovery Strategy

```typescript
try {
  await processConversation(conv);
} catch (error) {
  // Log the error
  log(`âŒ Failed: ${conv.contactName} - ${error.message}`);
  
  // Mark for retry
  conv.debugInfo = `Error: ${error.message}`;
  conv.lastCheckedAt = new Date().toISOString();
  
  // Don't change state - will retry next cycle
  saveStates();
  
  // Continue with next conversation
  continue;
}
```

---

## ðŸ“ˆ Metrics Dashboard

The UI shows:

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                   MESSAGE TOTALS                         â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚     164       â”‚      98       â”‚          66             â”‚
â”‚    Total      â”‚    Theirs     â”‚         Ours            â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                    STATE SUMMARY                         â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  17   â”‚     5     â”‚    8    â”‚   3    â”‚   0   â”‚    1    â”‚
â”‚ Total â”‚ Needs     â”‚ Waiting â”‚ Active â”‚ Idle  â”‚ Ended   â”‚
â”‚       â”‚ Reply     â”‚         â”‚        â”‚       â”‚         â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## ï¿½ PROPOSED: Quick Check Optimization

> **STATUS: Under Discussion** - This section describes a proposed optimization to make conversation monitoring much faster.

### The Problem

Currently, checking each conversation for changes requires:
1. Navigate to conversation URL
2. Scroll UP 20 times to reach top
3. Scroll DOWN 25 times while collecting messages
4. Parse and count all messages

**Time per conversation: ~60 seconds**

With 50 conversations, a full check takes **50+ minutes** - way too slow!

### The Solution: Quick Check

Instead of counting every message, we just read the **last 3 messages** visible at the bottom (no scrolling needed). If they match what we saw last time â†’ no changes â†’ skip full count.

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    QUICK CHECK FLOW                             â”‚
â”‚                                                                 â”‚
â”‚  1. Navigate to conversation (no scrolling)                     â”‚
â”‚  2. Extract last 3 visible messages                             â”‚
â”‚  3. Create hash: "them:Hello|us:Hi|them:How are you"           â”‚
â”‚  4. Compare with stored quickCheckHash                          â”‚
â”‚     â”œâ”€ MATCH â†’ No changes, skip to next conversation           â”‚
â”‚     â””â”€ DIFFERENT â†’ Do full message count                        â”‚
â”‚  5. Save new hash for next time                                 â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

**Time per conversation: ~5 seconds** (if no changes)

### Time Comparison

| Scenario | Old Method | Quick Check | Savings |
|----------|------------|-------------|---------|
| 50 conversations, 0 changes | 50 min | 4 min | **92%** |
| 50 conversations, 5 changes | 50 min | 9 min | **82%** |
| 50 conversations, 50 changes | 50 min | 50 min | 0% |

### New State Fields

```typescript
interface ConversationState {
  // ... existing fields ...
  
  // Quick Check (NEW)
  quickCheckHash?: string;     // Hash of last 3 messages
  lastFullCheckAt?: string;    // When we last did a full count
}
```

### Implementation Options

#### Option A: Quick Check First, Full Count on Change âœ… SELECTED
```
For each conversation:
  1. Quick check (5 sec)
  2. If hash changed â†’ full count (60 sec)
  3. If hash same â†’ skip, move to next
```
**Pros:** Simple, reliable
**Cons:** Still slow when many conversations have changes

---

### ðŸ“‹ Option A - Detailed Agent Workflow

#### Before (Current Flow)

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    CURRENT WORKFLOW (SLOW)                       â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                                                  â”‚
â”‚  For EACH conversation (50 total):                               â”‚
â”‚    1. Navigate to URL                          (2 sec)           â”‚
â”‚    2. Wait for load                            (2 sec)           â”‚
â”‚    3. Scroll UP 20x to reach top               (25 sec)          â”‚
â”‚    4. Scroll DOWN 25x collecting messages      (30 sec)          â”‚
â”‚    5. Parse all messages, count theirs/ours    (1 sec)           â”‚
â”‚    6. Compare with stored counts               (instant)         â”‚
â”‚    7. Update state if changed                  (instant)         â”‚
â”‚                                                                  â”‚
â”‚  Total per conversation: ~60 seconds                             â”‚
â”‚  Total for 50 conversations: ~50 MINUTES                         â”‚
â”‚                                                                  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

#### After (With Quick Check)

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    NEW WORKFLOW (FAST)                           â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                                                  â”‚
â”‚  PHASE 1: QUICK SCAN (for all conversations)                     â”‚
â”‚  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€                       â”‚
â”‚  For EACH conversation (50 total):                               â”‚
â”‚    1. Navigate to URL                          (2 sec)           â”‚
â”‚    2. Wait for load (NO scrolling!)            (2 sec)           â”‚
â”‚    3. Extract last 3 visible messages          (1 sec)           â”‚
â”‚    4. Create hash of last 3 messages           (instant)         â”‚
â”‚    5. Compare with stored quickCheckHash       (instant)         â”‚
â”‚       â”œâ”€ MATCH â†’ Mark as "no-change"                             â”‚
â”‚       â””â”€ DIFFERENT â†’ Mark as "needs-full-count"                  â”‚
â”‚                                                                  â”‚
â”‚  Time per conversation: ~5 seconds                               â”‚
â”‚  Time for 50 conversations: ~4 MINUTES                           â”‚
â”‚                                                                  â”‚
â”‚  PHASE 2: FULL COUNT (only changed conversations)                â”‚
â”‚  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€                â”‚
â”‚  For EACH "needs-full-count" conversation:                       â”‚
â”‚    1. Navigate to URL                          (2 sec)           â”‚
â”‚    2. Wait for load                            (2 sec)           â”‚
â”‚    3. Scroll UP 20x to reach top               (25 sec)          â”‚
â”‚    4. Scroll DOWN 25x collecting messages      (30 sec)          â”‚
â”‚    5. Parse all messages, count theirs/ours   (1 sec)           â”‚
â”‚    6. Update state with new counts             (instant)         â”‚
â”‚    7. Store new quickCheckHash                 (instant)         â”‚
â”‚                                                                  â”‚
â”‚  Time per changed conversation: ~60 seconds                      â”‚
â”‚  Typical: 5 changed out of 50 = 5 MINUTES                        â”‚
â”‚                                                                  â”‚
â”‚  TOTAL TIME: ~9 MINUTES (vs 50 minutes before!)                  â”‚
â”‚                                                                  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

#### State Machine Actions - What Changes

| Action | Before | After |
|--------|--------|-------|
| `init` | Full count all conversations | Same (no hash yet) |
| `scan` | Check sidebar for unread badges | Same + store hashes for new convs |
| `count` | Full count all tracked conversations | **Quick check first â†’ full count only if changed** |
| `full` | Scan + full count NEEDS_REPLY | **Scan + quick check â†’ full count if changed** |

#### New Action: `quick` (Optional)

We could add a new action that ONLY does quick checks without any full counts:

```
action: 'quick'
  - Quick check all conversations
  - Mark which ones have changes
  - DO NOT do full count
  - Return list of changed conversations for review

Use case: Fast monitoring to see activity without waiting for full counts
```

#### Code Changes Summary

```typescript
// 1. NEW FUNCTION: quickCheckConversation()
async function quickCheckConversation(
  page: Page,
  conversationUrl: string,
  contactName: string,
  log: (msg: string) => void
): Promise<{
  hash: string;
  last3: Array<{ sender: 'them' | 'us'; text: string }>;
  lastMessageIsTheirs: boolean;
}>

// 2. MODIFIED: count action
// Before:
for (const conv of states) {
  await countMessagesInConversation(...);  // 60 sec each
}

// After:
const needsFullCount: ConversationState[] = [];

// Phase 1: Quick check all
for (const conv of states) {
  const { hash } = await quickCheckConversation(...);  // 5 sec each
  if (hash !== conv.quickCheckHash) {
    needsFullCount.push(conv);
  }
}

// Phase 2: Full count only changed
for (const conv of needsFullCount) {
  const counts = await countMessagesInConversation(...);  // 60 sec each
  conv.quickCheckHash = counts.lastMessageHash;  // Update hash
}
```

#### Flowchart: Quick Check Decision

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Start Check     â”‚
â”‚  Conversation    â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
         â”‚
         â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Quick Check     â”‚
â”‚  (read last 3)   â”‚
â”‚  ~5 seconds      â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
         â”‚
         â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”     NO      â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Hash Changed?   â”‚â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¶â”‚  Skip - No       â”‚
â”‚                  â”‚             â”‚  Changes         â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜             â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
         â”‚ YES
         â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Full Count      â”‚
â”‚  (scroll all)    â”‚
â”‚  ~60 seconds     â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
         â”‚
         â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Update State    â”‚
â”‚  + New Hash      â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

#### Edge Cases Handled

| Edge Case | How Handled |
|-----------|-------------|
| First time (no hash) | Always do full count, store hash |
| Deleted messages | Hash changes â†’ full count catches it |
| Same last 3 but different earlier | Missed! But rare. Force full check every 24h |
| Very short conversation (<3 msgs) | Use available messages for hash |
| Slow load | Wait for messages to appear before extracting |

#### Reliability Guarantee

To ensure we never miss messages long-term:

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    SAFETY NET                                    â”‚
â”‚                                                                  â”‚
â”‚  Force full count if:                                            â”‚
â”‚    1. No hash stored (first time)                                â”‚
â”‚    2. lastFullCheckAt > 24 hours ago                             â”‚
â”‚    3. Unread badge detected (definitely new message)             â”‚
â”‚    4. Quick check fails/errors                                   â”‚
â”‚                                                                  â”‚
â”‚  This ensures every conversation gets a full verification        â”‚
â”‚  at least once per day, catching any edge cases.                 â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

#### Option B: Quick Check + Incremental Detection
```
For each conversation:
  1. Quick check (5 sec)
  2. If hash changed:
     - Compare last 3 messages
     - Detect how many new messages
     - Update counts without full scroll
```
**Pros:** Much faster even with changes
**Cons:** Could miss messages if more than 3 new messages arrive

#### Option C: Hybrid Approach
```
For each conversation:
  1. Quick check (5 sec)
  2. If hash changed:
     - If unread badge visible â†’ full count (important!)
     - If no badge but hash changed â†’ incremental update
  3. Force full count every 24 hours for accuracy
```
**Pros:** Balance of speed and reliability
**Cons:** More complex logic

### Questions to Discuss

1. **Which option to implement?** (A, B, or C?)

2. **How to handle edge cases?**
   - What if someone deletes a message?
   - What if conversation loads slowly?
   - What if last 3 messages are identical to another conversation?

3. **Should we store actual message content?**
   - Currently we hash: `"them:Hello|us:Hi there"`
   - Alternative: Store full last 3 messages for debugging

4. **Periodic full check?**
   - Every 24 hours? Every 50 quick checks?
   - Forces accuracy verification

5. **Priority order for conversations?**
   - Check unread badge conversations first (they definitely changed)
   - Then check recent activity (last 24h)
   - Finally check older conversations

### Related: Active Window Concept

Only track conversations with recent activity:

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    ACTIVE WINDOW (7 days)                       â”‚
â”‚                                                                 â”‚
â”‚  Conversations in window:                                       â”‚
â”‚    âœ… Salma (last activity: 2 hours ago) â†’ Track               â”‚
â”‚    âœ… Ahmed (last activity: 3 days ago) â†’ Track                â”‚
â”‚    âŒ Mohamed (last activity: 14 days ago) â†’ Skip              â”‚
â”‚    âŒ Fatima (last activity: 30 days ago) â†’ Skip               â”‚
â”‚                                                                 â”‚
â”‚  If old conversation becomes active again:                      â”‚
â”‚    - Scan detects unread badge                                  â”‚
â”‚    - Re-adds to active tracking                                 â”‚
â”‚    - Resets activity timestamp                                  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

**Configurable parameters:**
- `activeDays`: 7 (default) - days of inactivity before skipping
- `maxConversations`: 50 (default) - max to track at once

### Decision Needed

Before implementing, we need to decide:

1. **Quick Check**: Option A, B, or C?
2. **Active Window**: Enable? How many days?
3. **Max Conversations**: What limit?
4. **Force Full Check**: How often?

---
## ðŸ†• CHALLENGE: Detecting New vs Returning Conversations

### The Problem

When using "End At" contact approach (not scrolling entire sidebar), we face a critical challenge:

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    THE CONFUSION PROBLEM                         â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                                                  â”‚
â”‚  SIDEBAR (sorted by most recent activity):                       â”‚
â”‚                                                                  â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                        â”‚
â”‚  â”‚ ðŸ”µ Fatima (unread)    â† WHO IS THIS? â”‚                        â”‚
â”‚  â”‚    Salma                             â”‚                        â”‚
â”‚  â”‚    Ahmed  â† "End At" boundary        â”‚                        â”‚
â”‚  â”‚ â”€ â”€ â”€ â”€ â”€ â”€ â”€ â”€ â”€ â”€ â”€ â”€ â”€ â”€ â”€ â”€ â”€ â”€ â”‚                        â”‚
â”‚  â”‚    Mohamed (not tracked)             â”‚                        â”‚
â”‚  â”‚    Layla (not tracked)               â”‚                        â”‚
â”‚  â”‚    ...hundreds more...               â”‚                        â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                        â”‚
â”‚                                                                  â”‚
â”‚  Question: Is "Fatima" with unread badge:                        â”‚
â”‚    A) A brand NEW person messaging us for first time?            â”‚
â”‚    B) An OLD contact (was below Ahmed) who messaged again?       â”‚
â”‚                                                                  â”‚
â”‚  We can't tell just by looking at the sidebar!                   â”‚
â”‚                                                                  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Why This Matters

| Scenario | What Happened | What We Should Do |
|----------|---------------|-------------------|
| New Lead | First time contact | Add to tracking, reply as new lead |
| Returning Lead | Old contact re-engaged | Add to tracking, reply with context |
| Deleted Chat | We intentionally removed | Maybe ignore, or re-add carefully |

If we confuse them, we might:
- âŒ Reply to an old contact like they're new (weird/unprofessional)
- âŒ Miss a genuinely new lead thinking they're old
- âŒ Re-add contacts we intentionally removed

### Solution Options

---

#### Option 1: Track ALL Known Contact IDs (Recommended)

Store every contact ID we've ever seen, even if not actively tracking:

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    TWO-TIER TRACKING                             â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                                                  â”‚
â”‚  TIER 1: Active States (full tracking)                           â”‚
â”‚  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€                            â”‚
â”‚  [                                                               â”‚
â”‚    { contactFbId: "111", name: "Salma", state: "WAITING", ... }, â”‚
â”‚    { contactFbId: "222", name: "Ahmed", state: "IDLE", ... },    â”‚
â”‚  ]                                                               â”‚
â”‚                                                                  â”‚
â”‚  TIER 2: Known Contacts (ID only, no active tracking)            â”‚
â”‚  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€           â”‚
â”‚  {                                                               â”‚
â”‚    "333": { name: "Mohamed", lastSeen: "2024-12-01", excluded: true },
â”‚    "444": { name: "Layla", lastSeen: "2024-11-15", excluded: true },  
â”‚    "555": { name: "Kareem", lastSeen: "2024-10-20", excluded: true }, 
â”‚  }                                                               â”‚
â”‚                                                                  â”‚
â”‚  DETECTION LOGIC:                                                â”‚
â”‚  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€                                                â”‚
â”‚  When we see "Fatima" with unread:                               â”‚
â”‚    1. Check Tier 1 (Active States) â†’ Not found                   â”‚
â”‚    2. Check Tier 2 (Known Contacts) â†’ Not found                  â”‚
â”‚    3. Conclusion: TRULY NEW CONTACT! ðŸŽ‰                          â”‚
â”‚                                                                  â”‚
â”‚  When we see "Mohamed" with unread:                              â”‚
â”‚    1. Check Tier 1 (Active States) â†’ Not found                   â”‚
â”‚    2. Check Tier 2 (Known Contacts) â†’ FOUND! (excluded)          â”‚
â”‚    3. Conclusion: RETURNING OLD CONTACT ðŸ”„                       â”‚
â”‚                                                                  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

**Implementation:**

```typescript
interface KnownContact {
  name: string;
  lastSeenAt: string;      // When we last saw them in sidebar
  excludedAt?: string;     // When we stopped tracking (if applicable)
  excludeReason?: string;  // "outside-end-at" | "manually-removed" | "inactive"
  totalMessages?: number;  // Last known message count
}

// Store in separate file: known-contacts-{accountId}.json
type KnownContacts = Record<string, KnownContact>;  // key = contactFbId
```

**Workflow:**

```
DURING INIT:
  1. Extract ALL conversations (scroll entire sidebar once)
  2. Add all to Known Contacts (Tier 2)
  3. Add only those before "End At" to Active States (Tier 1)
  4. Mark rest as excluded: "outside-end-at"

DURING SCAN:
  1. Look at visible sidebar (no scroll needed - new ones at top)
  2. For each unread conversation:
     â”œâ”€ In Tier 1? â†’ Update state to NEEDS_REPLY
     â”œâ”€ In Tier 2 (excluded)? â†’ RETURNING contact, re-add to Tier 1
     â””â”€ Not in Tier 1 or 2? â†’ TRULY NEW contact, add to both tiers
```

**Pros:**
- âœ… 100% accurate detection of new vs returning
- âœ… Can decide how to handle returning contacts
- âœ… One-time scroll during init, then never again

**Cons:**
- âš ï¸ Initial init takes longer (scroll all sidebar once)
- âš ï¸ Stores more data (all contact IDs)

---

#### Option 2: Check Message History on Detection

When we see an unknown unread contact, open the conversation and check if there's history:

```
DURING SCAN:
  1. See "Fatima" with unread, not in our states
  2. Open conversation
  3. Quick check: How many messages total?
     â”œâ”€ Only 1 message (theirs) â†’ NEW contact
     â””â”€ Multiple messages or any from us â†’ RETURNING contact
```

**Detection Heuristic:**

```typescript
async function isNewContact(page: Page, conversationUrl: string): Promise<boolean> {
  await page.goto(conversationUrl);
  
  // Quick scan without scrolling
  const quickInfo = await page.evaluate(() => {
    const messages = document.querySelectorAll('[role="row"] [role="presentation"]');
    let theirCount = 0;
    let ourCount = 0;
    
    // Just check visible messages (bottom portion)
    for (const msg of messages) {
      // ... sender detection logic ...
      if (isTheirs) theirCount++;
      else ourCount++;
    }
    
    return { theirCount, ourCount, total: theirCount + ourCount };
  });
  
  // Heuristic: New contact = only their messages, no ours, very few total
  if (quickInfo.ourCount === 0 && quickInfo.total <= 3) {
    return true;  // Likely new
  }
  return false;  // Has history = returning
}
```

**Pros:**
- âœ… No need to store all contact IDs
- âœ… Works without initial full sidebar scroll

**Cons:**
- âš ï¸ Requires opening each unknown conversation (slower)
- âš ï¸ Not 100% reliable (what if we never replied to them before?)
- âš ï¸ Edge case: Old contact we never replied to looks like new

---

#### Option 3: Sidebar Position Heuristic

If a contact appears ABOVE our "End At" boundary, they must have had recent activity:

```
SIDEBAR BEFORE SCAN:
  Salma (tracked)
  Ahmed (tracked, "End At")
  ---boundary---
  Mohamed (not tracked)

SIDEBAR AFTER SCAN (someone messages):
  ðŸ”µ Fatima (unread) â† Above Ahmed, recent activity
  Salma
  Ahmed ("End At")
  ---boundary---
  Mohamed (not tracked, still below)
```

**Logic:** Anyone who appears above "End At" contact either:
- Was already tracked (check states)
- Is new/returning (needs investigation)

**Cons:**
- âš ï¸ Doesn't distinguish new from returning
- âš ï¸ "End At" contact position can change

---

### Recommended Approach: Option 1 + Quick Check

Combine the best of both:

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    RECOMMENDED WORKFLOW                          â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                                                  â”‚
â”‚  ONE-TIME SETUP (During first init):                             â”‚
â”‚  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€                            â”‚
â”‚  1. Scroll entire sidebar ONCE to collect all contact IDs        â”‚
â”‚  2. Store in known-contacts-{accountId}.json                     â”‚
â”‚  3. Mark active vs excluded based on "End At"                    â”‚
â”‚  4. Time: ~5 minutes, done only once                             â”‚
â”‚                                                                  â”‚
â”‚  ONGOING SCANS (Every 5-15 minutes):                             â”‚
â”‚  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€                             â”‚
â”‚  1. Look at visible sidebar (no scrolling needed)                â”‚
â”‚  2. New messages appear at TOP with unread badge                 â”‚
â”‚  3. For each unread:                                             â”‚
â”‚     â”œâ”€ Known (Tier 1 or 2)? â†’ Handle appropriately               â”‚
â”‚     â””â”€ Unknown? â†’ Truly new! Rare case, add to tracking          â”‚
â”‚  4. Time: ~30 seconds                                            â”‚
â”‚                                                                  â”‚
â”‚  HANDLING RETURNING CONTACTS:                                    â”‚
â”‚  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€                                   â”‚
â”‚  When excluded contact messages again:                           â”‚
â”‚    Option A: Auto re-add to active tracking (recommended)        â”‚
â”‚    Option B: Flag for manual review                              â”‚
â”‚    Option C: Ignore if excluded reason was "manually-removed"    â”‚
â”‚                                                                  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### State File Structure

```typescript
// File: conversation-states-{accountId}.json (existing)
// Contains: Active states with full tracking

// File: known-contacts-{accountId}.json (NEW)
{
  "contacts": {
    "111111111": {
      "name": "Mohamed Hassan",
      "lastSeenAt": "2024-12-20T10:30:00Z",
      "excludedAt": "2024-12-21T08:00:00Z",
      "excludeReason": "outside-end-at",
      "wasActive": true,
      "lastMessageCount": 47
    },
    "222222222": {
      "name": "Layla Ahmed", 
      "lastSeenAt": "2024-12-15T14:20:00Z",
      "excludedAt": "2024-12-21T08:00:00Z",
      "excludeReason": "inactive-7-days",
      "wasActive": true,
      "lastMessageCount": 12
    }
  },
  "lastFullSidebarScan": "2024-12-21T08:00:00Z",
  "totalKnown": 156
}
```

### Detection Summary

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    CONTACT DETECTION MATRIX                     â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ In Tier 1?  â”‚ In Tier 2?   â”‚ Conclusion    â”‚ Action            â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ âœ… Yes      â”‚ -            â”‚ Active contactâ”‚ Update state      â”‚
â”‚ âŒ No       â”‚ âœ… Yes       â”‚ Returning     â”‚ Re-add to Tier 1  â”‚
â”‚ âŒ No       â”‚ âŒ No        â”‚ Brand new!    â”‚ Add to both tiers â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Questions to Decide

1. **Full sidebar scan during init?**
   - Yes: Accurate but takes 5 min once
   - No: Risk confusing new vs returning

2. **How to handle returning excluded contacts?**
   - Auto re-add to active tracking?
   - Flag for review first?
   - Depends on exclude reason?

3. **Should we refresh Known Contacts periodically?**
   - Weekly full sidebar scan?
   - Only on manual trigger?

4. **Maximum Known Contacts to store?**
   - Store all (could be 1000+)?
   - Prune contacts not seen in 90 days?

---

## 🚀 BETTER APPROACH: OLD Contacts as Boundary Markers

> **STATUS:** This replaces the "End At" approach with a smarter, automatic system.

### The Concept

Instead of manually specifying "End At contact X", we use OLD contacts as **natural boundary markers**. When scrolling sidebar, STOP when we hit first OLD contact without unread = done scanning.

### Two Lists

- **ACTIVE**: Conversations we're tracking (respond to)
- **OLD**: Known contacts we're NOT tracking (use as boundary markers)

### How It Works

1. **Initial Setup (one-time):** Scroll entire sidebar, split contacts into ACTIVE vs OLD
2. **Ongoing Scans:** Scroll sidebar until we hit an OLD contact without unread = STOP

### Scenarios

| Situation | Detection | Action |
|-----------|-----------|--------|
| Contact in ACTIVE | Known, tracked | Quick check for changes |
| Contact in OLD + no unread | Boundary marker | **STOP scanning!** |
| Contact in OLD + has unread | Returning old contact | Re-add to ACTIVE |
| Contact not in either | Brand NEW person! | Add to ACTIVE |

### Why Better Than "End At"

| Feature | End At | Smart Boundary |
|---------|--------|----------------|
| Manual config | Required | Automatic |
| Boundary drift | Problem | No issue (ID-based) |
| New detection | Uncertain | 100% accurate |
| Returning old | Impossible | 100% accurate |

### Auto-Archive

Contacts in ACTIVE with no activity for X days get moved to OLD automatically.

### ✅ DECISIONS MADE

| Question | Decision |
|----------|----------|
| 1. Full sidebar scroll? | **Only on `init`** - one-time cost to build OLD list |
| 2. Auto-archive after? | **7 days** (configurable param: `inactiveDays`) |
| 3. Re-add returning OLD? | **Yes** - if they have unread badge, auto re-add to ACTIVE |
| 4. Refresh OLD list? | **Every 7 days** - periodic full sidebar scan |

### Configuration Parameters

```typescript
interface AgentConfig {
  // Smart Boundary settings
  inactiveDays: number;        // Default: 7 - days before ACTIVE → OLD
  refreshOldListDays: number;  // Default: 7 - days between full sidebar scans
  
  // Quick Check settings  
  forceFullCheckHours: number; // Default: 24 - force full count every X hours
}
```

### Complete Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMPLETE AGENT WORKFLOW                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  INIT (one-time or every 7 days refresh):                        │
│  ─────────────────────────────────────────                       │
│  1. Scroll entire sidebar                                        │
│  2. Collect ALL contact IDs                                      │
│  3. Split into ACTIVE (recent) and OLD (inactive)               │
│  4. Save both lists                                              │
│  5. Full count for all ACTIVE conversations                      │
│                                                                  │
│  SCAN (every 5-15 minutes):                                      │
│  ──────────────────────────                                      │
│  1. Go to top of sidebar                                         │
│  2. For each visible contact:                                    │
│     ├─ In OLD + no unread? → STOP! Boundary reached             │
│     ├─ In OLD + unread? → Re-add to ACTIVE (returning!)         │
│     ├─ In ACTIVE + unread? → Mark NEEDS_REPLY                   │
│     ├─ In ACTIVE + no unread? → Quick check (hash compare)      │
│     └─ Not in either? → NEW! Add to ACTIVE                      │
│  3. Scroll down if needed (until boundary)                       │
│                                                                  │
│  DAILY MAINTENANCE:                                              │
│  ─────────────────                                               │
│  1. Check ACTIVE contacts for inactivity                         │
│  2. If lastActivity > 7 days AND state not NEEDS_REPLY           │
│     → Move to OLD list                                           │
│  3. If lastFullScan > 7 days                                     │
│     → Trigger full sidebar refresh                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### File Structure

```
data/
  conversation-states-{accountId}.json    # ACTIVE list (full tracking)
  known-contacts-{accountId}.json         # OLD list (IDs only)
```

**ACTIVE State File:**
```typescript
interface ConversationState {
  contactFbId: string;
  contactName: string;
  conversationUrl: string;
  state: 'NEW' | 'NEEDS_REPLY' | 'WAITING' | 'ACTIVE' | 'IDLE' | 'ENDED';
  totalMessageCount: number;
  theirMessageCount: number;
  ourMessageCount: number;
  quickCheckHash?: string;
  lastCheckedAt: string;
  lastFullCheckAt?: string;
  // ... other tracking fields
}
```

**OLD Contacts File:**
```typescript
interface KnownContacts {
  contacts: {
    [contactFbId: string]: {
      name: string;
      addedAt: string;
      lastSeenAt: string;
      reason: 'initial-setup' | 'inactive' | 'manually-excluded';
    }
  };
  lastFullScan: string;
  totalKnown: number;
}
```

---

## 🗄️ DATABASE SCHEMA (Prisma)

> **IMPORTANT:** All data is stored in PostgreSQL via Prisma. NO JSON files.

### New Models Required

Add these to `prisma/schema.prisma`:

```prisma
// ============================================
// MESSENGER CONTACTS - All known contacts (ACTIVE + OLD)
// ============================================
model MessengerContact {
  id              String   @id @default(cuid())
  
  // Account relation
  accountId       String   @map("account_id")
  account         Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  
  // Contact identification - MATCH BY NAME (like testing)
  contactName     String   @map("contact_name")  // Primary identifier
  contactFbId     String?  @map("contact_fb_id") // Optional FB ID
  conversationUrl String   @map("conversation_url")
  
  // Status: ACTIVE (tracking) or OLD (boundary marker)
  status          ContactStatus @default(ACTIVE)
  
  // State Machine (only for ACTIVE contacts)
  state           ConversationStateEnum?
  previousState   ConversationStateEnum? @map("previous_state")
  stateChangedAt  DateTime? @map("state_changed_at")
  
  // Message Counts (THE KEY!)
  totalMessageCount   Int @default(0) @map("total_message_count")
  theirMessageCount   Int @default(0) @map("their_message_count")
  ourMessageCount     Int @default(0) @map("our_message_count")
  
  // Quick Check hash (last 3 messages)
  quickCheckHash  String?  @map("quick_check_hash")
  
  // Last messages
  lastTheirMessage    String?  @map("last_their_message")
  lastTheirMessageAt  DateTime? @map("last_their_message_at")
  lastOurReply        String?  @map("last_our_reply")
  lastOurReplyAt      DateTime? @map("last_our_reply_at")
  
  // Timestamps
  lastCheckedAt   DateTime? @map("last_checked_at")
  lastFullCheckAt DateTime? @map("last_full_check_at")
  lastActivityAt  DateTime? @map("last_activity_at")
  
  // For OLD contacts - why they were archived
  archivedAt      DateTime? @map("archived_at")
  archiveReason   String?   @map("archive_reason") // 'inactive' | 'manually-excluded'
  
  // Conversation ended?
  conversationEnded Boolean @default(false) @map("conversation_ended")
  endReason       String?  @map("end_reason")
  
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  
  // Unique per account + contact name
  @@unique([accountId, contactName])
  @@index([accountId, status])
  @@index([accountId, state])
  @@index([lastActivityAt(sort: Desc)])
  @@map("messenger_contacts")
}

enum ContactStatus {
  ACTIVE  // Currently tracking
  OLD     // Boundary marker (not tracking)
}

enum ConversationStateEnum {
  NEW
  NEEDS_REPLY
  WAITING
  ACTIVE
  IDLE
  ENDED
}

// ============================================
// MESSAGE AGENT CONFIG - Per-account settings
// ============================================
model MessageAgentConfig {
  id              String   @id @default(cuid())
  
  accountId       String   @unique @map("account_id")
  account         Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  
  // Smart Boundary settings
  inactiveDays    Int      @default(7) @map("inactive_days")      // Days before ACTIVE → OLD
  refreshOldDays  Int      @default(7) @map("refresh_old_days")   // Days between full sidebar scans
  
  // Quick Check settings
  forceFullCheckHours Int  @default(24) @map("force_full_check_hours")
  
  // Scan frequency
  scanIntervalMinutes Int  @default(15) @map("scan_interval_minutes")
  
  // Last operations
  lastFullSidebarScan DateTime? @map("last_full_sidebar_scan")
  lastScanAt          DateTime? @map("last_scan_at")
  lastMaintenanceAt   DateTime? @map("last_maintenance_at")
  
  // Stats
  totalActiveContacts Int  @default(0) @map("total_active_contacts")
  totalOldContacts    Int  @default(0) @map("total_old_contacts")
  
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  
  @@map("message_agent_configs")
}
```

### Update Account Model

Add relation to Account model:

```prisma
model Account {
  // ... existing fields ...
  
  // Relations
  agents              Agent[]
  messengerContacts   MessengerContact[]
  messageAgentConfig  MessageAgentConfig?
}
```

---

## 🔄 Database Operations

### Matching Contacts by Name

Like in testing, we match conversations by **contact name** (not FB ID):

```typescript
import { db } from '@/lib/db';

// Find contact by name (case-insensitive partial match)
async function findContactByName(accountId: string, contactName: string) {
  return db.messengerContact.findFirst({
    where: {
      accountId,
      contactName: {
        contains: contactName,
        mode: 'insensitive',
      },
    },
  });
}

// Or exact match (preferred for known contacts)
async function getContactByExactName(accountId: string, contactName: string) {
  return db.messengerContact.findUnique({
    where: {
      accountId_contactName: {
        accountId,
        contactName,
      },
    },
  });
}
```

### Get ACTIVE Contacts

```typescript
async function getActiveContacts(accountId: string) {
  return db.messengerContact.findMany({
    where: {
      accountId,
      status: 'ACTIVE',
    },
    orderBy: {
      lastActivityAt: 'desc',
    },
  });
}
```

### Get OLD Contacts (Boundary Markers)

```typescript
async function getOldContacts(accountId: string) {
  return db.messengerContact.findMany({
    where: {
      accountId,
      status: 'OLD',
    },
  });
}
```

### Check if Contact Exists (New vs Returning)

```typescript
async function checkContact(accountId: string, contactName: string) {
  const contact = await db.messengerContact.findUnique({
    where: {
      accountId_contactName: { accountId, contactName },
    },
  });
  
  if (!contact) {
    return { type: 'NEW' };  // Brand new contact!
  }
  
  if (contact.status === 'OLD') {
    return { type: 'RETURNING', contact };  // Old contact messaging again
  }
  
  return { type: 'ACTIVE', contact };  // Known active contact
}
```

### Create New Contact

```typescript
async function createContact(
  accountId: string, 
  contactName: string, 
  conversationUrl: string,
  counts: { total: number; theirs: number; ours: number }
) {
  return db.messengerContact.create({
    data: {
      accountId,
      contactName,
      conversationUrl,
      status: 'ACTIVE',
      state: 'NEEDS_REPLY',
      stateChangedAt: new Date(),
      totalMessageCount: counts.total,
      theirMessageCount: counts.theirs,
      ourMessageCount: counts.ours,
      lastActivityAt: new Date(),
      lastCheckedAt: new Date(),
    },
  });
}
```

### Re-activate OLD Contact

```typescript
async function reactivateContact(contactId: string, counts: { total: number; theirs: number; ours: number }) {
  return db.messengerContact.update({
    where: { id: contactId },
    data: {
      status: 'ACTIVE',
      state: 'NEEDS_REPLY',
      stateChangedAt: new Date(),
      totalMessageCount: counts.total,
      theirMessageCount: counts.theirs,
      ourMessageCount: counts.ours,
      lastActivityAt: new Date(),
      archivedAt: null,
      archiveReason: null,
    },
  });
}
```

### Update Contact State

```typescript
async function updateContactState(
  contactId: string,
  newState: 'NEW' | 'NEEDS_REPLY' | 'WAITING' | 'ACTIVE' | 'IDLE' | 'ENDED',
  counts?: { total: number; theirs: number; ours: number }
) {
  const contact = await db.messengerContact.findUnique({ where: { id: contactId } });
  
  const data: any = {
    previousState: contact?.state,
    state: newState,
    stateChangedAt: new Date(),
    lastCheckedAt: new Date(),
  };
  
  if (counts) {
    data.totalMessageCount = counts.total;
    data.theirMessageCount = counts.theirs;
    data.ourMessageCount = counts.ours;
  }
  
  if (newState === 'NEEDS_REPLY' || newState === 'WAITING') {
    data.lastActivityAt = new Date();
  }
  
  return db.messengerContact.update({
    where: { id: contactId },
    data,
  });
}
```

### Archive Inactive Contacts (ACTIVE → OLD)

```typescript
async function archiveInactiveContacts(accountId: string, inactiveDays: number = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);
  
  const result = await db.messengerContact.updateMany({
    where: {
      accountId,
      status: 'ACTIVE',
      state: { not: 'NEEDS_REPLY' },  // Don't archive if they need reply!
      lastActivityAt: { lt: cutoffDate },
    },
    data: {
      status: 'OLD',
      archivedAt: new Date(),
      archiveReason: 'inactive',
    },
  });
  
  return result.count;
}
```

### Get Contacts Needing Reply

```typescript
async function getContactsNeedingReply(accountId: string) {
  return db.messengerContact.findMany({
    where: {
      accountId,
      status: 'ACTIVE',
      state: 'NEEDS_REPLY',
    },
    orderBy: {
      lastTheirMessageAt: 'asc',  // Oldest first (FIFO)
    },
  });
}
```

### Get/Create Agent Config

```typescript
async function getOrCreateConfig(accountId: string) {
  let config = await db.messageAgentConfig.findUnique({
    where: { accountId },
  });
  
  if (!config) {
    config = await db.messageAgentConfig.create({
      data: {
        accountId,
        inactiveDays: 7,
        refreshOldDays: 7,
        forceFullCheckHours: 24,
        scanIntervalMinutes: 15,
      },
    });
  }
  
  return config;
}
```

---

## 🔄 Complete Workflow with Prisma

### INIT Action

```typescript
async function initAction(accountId: string, page: Page) {
  const config = await getOrCreateConfig(accountId);
  const log = (msg: string) => console.log(msg);
  
  log('🚀 INIT - Full sidebar scroll...');
  
  // Navigate to Messenger
  await page.goto('https://www.facebook.com/messages/t/');
  await humanDelay(3000, 4000);
  
  // Scroll entire sidebar and collect all contacts
  const allContacts = await scrollAndExtractAllContacts(page, log);
  
  log(`📋 Found ${allContacts.length} total contacts`);
  
  // Get existing contacts from DB
  const existingContacts = await db.messengerContact.findMany({
    where: { accountId },
    select: { contactName: true, status: true },
  });
  const existingMap = new Map(existingContacts.map(c => [c.contactName, c.status]));
  
  // Process each contact
  for (const conv of allContacts) {
    const existing = existingMap.get(conv.contactName);
    
    if (existing === 'OLD') {
      // Already OLD, skip
      continue;
    }
    
    if (existing === 'ACTIVE') {
      // Already ACTIVE, just update lastSeenAt
      await db.messengerContact.update({
        where: { accountId_contactName: { accountId, contactName: conv.contactName } },
        data: { lastCheckedAt: new Date() },
      });
      continue;
    }
    
    // NEW contact - count messages and add
    log(`  📝 New contact: ${conv.contactName}`);
    const counts = await countMessagesInConversation(page, conv.conversationUrl, conv.contactName, log);
    
    await db.messengerContact.create({
      data: {
        accountId,
        contactName: conv.contactName,
        contactFbId: conv.contactFbId,
        conversationUrl: conv.conversationUrl,
        status: 'ACTIVE',
        state: counts.lastMessageIsTheirs ? 'NEEDS_REPLY' : 'WAITING',
        stateChangedAt: new Date(),
        totalMessageCount: counts.total,
        theirMessageCount: counts.theirs,
        ourMessageCount: counts.ours,
        lastActivityAt: new Date(),
        lastCheckedAt: new Date(),
        lastFullCheckAt: new Date(),
        quickCheckHash: counts.lastMessageHash,
      },
    });
  }
  
  // Update config
  await db.messageAgentConfig.update({
    where: { accountId },
    data: {
      lastFullSidebarScan: new Date(),
      totalActiveContacts: await db.messengerContact.count({
        where: { accountId, status: 'ACTIVE' },
      }),
      totalOldContacts: await db.messengerContact.count({
        where: { accountId, status: 'OLD' },
      }),
    },
  });
  
  log('✅ INIT complete!');
}
```

### SCAN Action (Smart Boundary)

```typescript
async function scanAction(accountId: string, page: Page) {
  const config = await getOrCreateConfig(accountId);
  const log = (msg: string) => console.log(msg);
  
  log('🔍 SCAN - Smart boundary detection...');
  
  // Get OLD contacts for boundary detection
  const oldContacts = await db.messengerContact.findMany({
    where: { accountId, status: 'OLD' },
    select: { contactName: true },
  });
  const oldNames = new Set(oldContacts.map(c => c.contactName));
  
  // Get ACTIVE contacts for quick lookup
  const activeContacts = await db.messengerContact.findMany({
    where: { accountId, status: 'ACTIVE' },
  });
  const activeMap = new Map(activeContacts.map(c => [c.contactName, c]));
  
  // Navigate to Messenger
  await page.goto('https://www.facebook.com/messages/t/');
  await humanDelay(3000, 4000);
  
  let foundBoundary = false;
  const results = { new: 0, returning: 0, needsReply: 0 };
  
  while (!foundBoundary) {
    const visible = await extractVisibleConversations(page);
    
    for (const conv of visible) {
      // Check if OLD contact without unread = BOUNDARY
      if (oldNames.has(conv.contactName) && !conv.hasUnreadBadge) {
        log(`🛑 Boundary reached: ${conv.contactName}`);
        foundBoundary = true;
        break;
      }
      
      // OLD contact WITH unread = RETURNING
      if (oldNames.has(conv.contactName) && conv.hasUnreadBadge) {
        log(`🔄 Returning: ${conv.contactName}`);
        const counts = await countMessagesInConversation(page, conv.conversationUrl, conv.contactName, log);
        
        await db.messengerContact.update({
          where: { accountId_contactName: { accountId, contactName: conv.contactName } },
          data: {
            status: 'ACTIVE',
            state: 'NEEDS_REPLY',
            stateChangedAt: new Date(),
            totalMessageCount: counts.total,
            theirMessageCount: counts.theirs,
            ourMessageCount: counts.ours,
            lastActivityAt: new Date(),
            archivedAt: null,
            archiveReason: null,
          },
        });
        
        oldNames.delete(conv.contactName);
        results.returning++;
        continue;
      }
      
      // ACTIVE contact
      const active = activeMap.get(conv.contactName);
      if (active) {
        if (conv.hasUnreadBadge && active.state !== 'NEEDS_REPLY') {
          log(`📬 Needs reply: ${conv.contactName}`);
          await db.messengerContact.update({
            where: { id: active.id },
            data: {
              state: 'NEEDS_REPLY',
              previousState: active.state,
              stateChangedAt: new Date(),
              lastActivityAt: new Date(),
            },
          });
          results.needsReply++;
        }
        continue;
      }
      
      // Not in either = BRAND NEW!
      log(`🆕 New contact: ${conv.contactName}`);
      const counts = await countMessagesInConversation(page, conv.conversationUrl, conv.contactName, log);
      
      await db.messengerContact.create({
        data: {
          accountId,
          contactName: conv.contactName,
          contactFbId: conv.contactFbId,
          conversationUrl: conv.conversationUrl,
          status: 'ACTIVE',
          state: 'NEEDS_REPLY',
          stateChangedAt: new Date(),
          totalMessageCount: counts.total,
          theirMessageCount: counts.theirs,
          ourMessageCount: counts.ours,
          lastActivityAt: new Date(),
          lastCheckedAt: new Date(),
        },
      });
      
      results.new++;
    }
    
    if (!foundBoundary) {
      await page.mouse.wheel(0, 500);
      await humanDelay(500, 800);
    }
  }
  
  // Update config
  await db.messageAgentConfig.update({
    where: { accountId },
    data: { lastScanAt: new Date() },
  });
  
  log(`✅ SCAN complete: ${results.new} new, ${results.returning} returning, ${results.needsReply} needs reply`);
  return results;
}
```

### MAINTENANCE Action (Daily)

```typescript
async function maintenanceAction(accountId: string) {
  const config = await getOrCreateConfig(accountId);
  const log = (msg: string) => console.log(msg);
  
  log('🔧 MAINTENANCE - Archive inactive, refresh if needed...');
  
  // 1. Archive inactive contacts (ACTIVE → OLD)
  const archivedCount = await archiveInactiveContacts(accountId, config.inactiveDays);
  log(`  📦 Archived ${archivedCount} inactive contacts`);
  
  // 2. Check if full sidebar refresh needed
  const daysSinceFullScan = config.lastFullSidebarScan
    ? Math.floor((Date.now() - config.lastFullSidebarScan.getTime()) / (1000 * 60 * 60 * 24))
    : 999;
  
  const needsRefresh = daysSinceFullScan >= config.refreshOldDays;
  
  // 3. Update stats
  await db.messageAgentConfig.update({
    where: { accountId },
    data: {
      lastMaintenanceAt: new Date(),
      totalActiveContacts: await db.messengerContact.count({
        where: { accountId, status: 'ACTIVE' },
      }),
      totalOldContacts: await db.messengerContact.count({
        where: { accountId, status: 'OLD' },
      }),
    },
  });
  
  log(`✅ MAINTENANCE complete`);
  
  return { archivedCount, needsRefresh };
}
```

---

## 📊 API Endpoints

All Message Agent APIs are located at `/api/message-agent/`.

### Main Actions: POST /api/message-agent

Execute message agent actions.

```bash
# Initialize - Full sidebar scan, discover all contacts
curl -X POST http://localhost:3000/api/message-agent \
  -H "Content-Type: application/json" \
  -d '{"accountId": "account-123", "action": "init"}'

# Scan - Smart boundary scan (stops at first OLD without unread)
curl -X POST http://localhost:3000/api/message-agent \
  -H "Content-Type: application/json" \
  -d '{"accountId": "account-123", "action": "scan"}'

# Maintenance - Archive inactive contacts (ACTIVE → OLD)
curl -X POST http://localhost:3000/api/message-agent \
  -H "Content-Type: application/json" \
  -d '{"accountId": "account-123", "action": "maintenance"}'
```

**Response:**
```json
{
  "success": true,
  "action": "scan",
  "stats": {
    "totalActive": 25,
    "totalOld": 142,
    "needsReply": 3,
    "new": 2,
    "returning": 1
  },
  "logs": ["🔍 SCAN - Smart boundary detection...", "..."],
  "errors": []
}
```

---

### Contacts: /api/message-agent/contacts

**GET - List contacts:**
```bash
# All active contacts
curl "http://localhost:3000/api/message-agent/contacts?accountId=account-123&status=ACTIVE"

# Contacts needing reply
curl "http://localhost:3000/api/message-agent/contacts?accountId=account-123&state=NEEDS_REPLY"

# Find by name (partial match, case-insensitive)
curl "http://localhost:3000/api/message-agent/contacts?accountId=account-123&name=Mario"

# Find by ID
curl "http://localhost:3000/api/message-agent/contacts?accountId=account-123&id=clxyz123"
```

**PATCH - Update contact:**
```bash
curl -X PATCH http://localhost:3000/api/message-agent/contacts \
  -H "Content-Type: application/json" \
  -d '{
    "id": "clxyz123",
    "state": "WAITING",
    "lastOurReply": "Thanks for your message!"
  }'
```

**DELETE - Archive contact:**
```bash
# Soft delete (move to OLD)
curl -X DELETE "http://localhost:3000/api/message-agent/contacts?id=clxyz123"

# Hard delete (remove from DB)
curl -X DELETE "http://localhost:3000/api/message-agent/contacts?id=clxyz123&hardDelete=true"
```

---

### Config: /api/message-agent/config

**GET - Get configuration:**
```bash
curl "http://localhost:3000/api/message-agent/config?accountId=account-123"
```

**Response:**
```json
{
  "config": {
    "id": "cfg123",
    "accountId": "account-123",
    "inactiveDays": 7,
    "refreshOldDays": 7,
    "forceFullCheckHours": 24,
    "scanIntervalMinutes": 15,
    "lastScanAt": "2025-12-29T10:30:00Z",
    "lastMaintenanceAt": "2025-12-29T00:00:00Z",
    "totalActiveContacts": 25,
    "totalOldContacts": 142
  }
}
```

**PATCH - Update configuration:**
```bash
curl -X PATCH http://localhost:3000/api/message-agent/config \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "account-123",
    "inactiveDays": 14,
    "scanIntervalMinutes": 10
  }'
```

---

### Stats: /api/message-agent/stats

**GET - Dashboard stats:**
```bash
curl "http://localhost:3000/api/message-agent/stats?accountId=account-123"
```

**Response:**
```json
{
  "summary": {
    "totalActive": 25,
    "totalOld": 142,
    "total": 167
  },
  "byState": {
    "needsReply": 3,
    "waiting": 8,
    "active": 10,
    "idle": 4,
    "ended": 0,
    "new": 0
  },
  "needsReplyContacts": [
    {
      "id": "clxyz123",
      "contactName": "Mario Rossi",
      "conversationUrl": "https://facebook.com/messages/t/123",
      "lastTheirMessage": "Ciao, sono interessato",
      "lastTheirMessageAt": "2025-12-29T10:15:00Z"
    }
  ],
  "recentActivity": [...]
}
```

---

## 🔮 Future Improvements

1. **Webhook Integration** - Get notified of new messages instantly
2. **Multi-Account Support** - Run agents for multiple FB accounts
3. **Conversation Routing** - Route complex queries to humans
4. **Analytics Dashboard** - Track conversion rates, response times
5. **A/B Testing** - Test different reply strategies
6. **Lead Scoring** - Prioritize high-intent leads

---

## Quick Start

```bash
# 1. Push schema to database
npx prisma db push

# 2. Generate Prisma client
npx prisma generate

# 3. Initialize message agent for an account
curl -X POST http://localhost:3000/api/message-agent \
  -H "Content-Type: application/json" \
  -d '{"accountId": "account-123", "action": "init"}'

# 4. Check stats
curl "http://localhost:3000/api/message-agent/stats?accountId=account-123"

# 5. Run scan (smart boundary)
curl -X POST http://localhost:3000/api/message-agent \
  -H "Content-Type: application/json" \
  -d '{"accountId": "account-123", "action": "scan"}'

# 6. Get contacts needing reply
curl "http://localhost:3000/api/message-agent/contacts?accountId=account-123&state=NEEDS_REPLY"

# 7. Run maintenance (archive inactive)
curl -X POST http://localhost:3000/api/message-agent \
  -H "Content-Type: application/json" \
  -d '{"accountId": "account-123", "action": "maintenance"}'
```

---

*Last updated: December 29, 2025*

