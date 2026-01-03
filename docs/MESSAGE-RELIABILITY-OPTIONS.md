# Message Reliability Analysis & Solutions

## Current Problem Statement

The current message agent has several reliability issues that make it unsuitable for production:

1. **Message Detection Gaps**: The Unread tab click-based approach can miss messages
2. **Race Conditions**: New messages can arrive between checking and responding
3. **No Persistence**: Agent loses all state on restart
4. **No Verification**: We don't verify if replies were actually sent
5. **Hash Fragility**: DOM-based hashing can change unexpectedly
6. **No Audit Trail**: No record of what was processed vs missed

---

## Option 1: Database-Backed Message Tracking (RECOMMENDED)

### Concept
Store every message we see in the database with a unique identifier. Track processing status for each message.

### Implementation

```
┌─────────────────────────────────────────────────────────────┐
│                    Message Tracking Table                    │
├─────────────────────────────────────────────────────────────┤
│ id | contact_id | message_text | message_hash | status      │
│ 1  | john_123   | "Hello..."   | abc123       | REPLIED     │
│ 2  | john_123   | "Thanks!"    | def456       | PENDING     │
│ 3  | mary_456   | "Hi there"   | ghi789       | REPLIED     │
└─────────────────────────────────────────────────────────────┘
```

### Schema Addition
```prisma
model Message {
  id              String   @id @default(cuid())
  contactId       String   // FB user ID or profile URL
  contactName     String
  messageText     String
  messageHash     String   // Hash of text + timestamp approximation
  direction       String   // INBOUND | OUTBOUND
  status          String   // PENDING | PROCESSING | REPLIED | FAILED | SKIPPED
  detectedAt      DateTime @default(now())
  processedAt     DateTime?
  replyText       String?
  errorMessage    String?
  accountId       String
  
  @@unique([contactId, messageHash])
  @@index([status, accountId])
}
```

### Workflow
1. **Full Scan**: Periodically scan ALL conversations (not just unread)
2. **Hash Each Message**: Create unique hash for each inbound message
3. **Check Database**: If hash exists → already processed, skip
4. **Process New**: If hash doesn't exist → insert as PENDING, process, update to REPLIED
5. **Reconciliation**: Periodic job compares DB vs actual conversations

### Pros
- ✅ Survives restarts
- ✅ Complete audit trail
- ✅ Can detect missed messages via reconciliation
- ✅ Enables analytics and reporting
- ✅ Can resume from exact state

### Cons
- ❌ More complex implementation
- ❌ Database dependency
- ❌ Need to handle hash collisions

### Reliability: ⭐⭐⭐⭐⭐ (95%+)

---

## Option 2: Full Conversation State Machine

### Concept
Instead of tracking individual messages, track the entire conversation state.

### Implementation

```
┌──────────────────────────────────────────────────────────────┐
│                 Conversation State Machine                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   [NEW] ──► [NEEDS_REPLY] ──► [WAITING] ──► [NEEDS_REPLY]   │
│              │                    │              │           │
│              ▼                    ▼              ▼           │
│          [ENDED]             [IDLE]         [ENDED]          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Schema
```prisma
model ConversationState {
  id                String   @id @default(cuid())
  contactId         String   @unique
  contactName       String
  state             String   // NEW | NEEDS_REPLY | WAITING | IDLE | ENDED
  lastMessageHash   String   // Hash of last message we saw
  lastMessageCount  Int      // Total messages in conversation
  lastTheirMessage  String?  // Text of their last message
  lastOurReply      String?  // Text of our last reply
  lastCheckedAt     DateTime
  updatedAt         DateTime @updatedAt
  accountId         String
  
  @@index([state, accountId])
}
```

### Workflow
1. **Extract All Conversations**: Get list of all conversations with message counts
2. **Compare to Stored State**: For each conversation, compare current vs stored
3. **Detect Changes**:
   - Message count increased + last message is theirs → NEEDS_REPLY
   - Message count same → no action needed
4. **Process**: Reply to NEEDS_REPLY, update state to WAITING
5. **Timeout**: After X minutes of WAITING with no change → IDLE

### Pros
- ✅ Simpler than per-message tracking
- ✅ Can detect changes via message count (not just unread badge)
- ✅ Natural state transitions
- ✅ Easy to debug and understand

### Cons
- ❌ Edited messages might not increase count
- ❌ Deleted messages could cause confusion
- ❌ Need to handle reactions (don't increase count)

### Reliability: ⭐⭐⭐⭐ (85-90%)

---

## Option 3: Dual-Loop Architecture

### Concept
Run two independent loops that cross-verify each other.

### Implementation

```
┌─────────────────────────────────────────────────────────────┐
│                    DUAL LOOP ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐       ┌──────────────────┐           │
│  │   FAST LOOP      │       │   SLOW LOOP      │           │
│  │   (Unread Tab)   │       │   (Full Scan)    │           │
│  │   Every 30s      │       │   Every 5 min    │           │
│  └────────┬─────────┘       └────────┬─────────┘           │
│           │                          │                      │
│           ▼                          ▼                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              SHARED MESSAGE QUEUE                     │  │
│  │   - Deduplicates via hash                            │  │
│  │   - Ensures nothing is missed                        │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                  │
│                          ▼                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              SINGLE PROCESSOR                         │  │
│  │   - Processes one conversation at a time             │  │
│  │   - Marks as done in DB                              │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Workflow
- **Fast Loop**: Check unread tab every 30 seconds, add to queue
- **Slow Loop**: Full scan every 5 minutes, add any missed to queue
- **Processor**: Single worker processes queue, marks complete

### Pros
- ✅ Redundancy catches missed messages
- ✅ Fast response for most messages
- ✅ Full scan catches edge cases
- ✅ Queue ensures no duplicates

### Cons
- ❌ More resource intensive
- ❌ Complex coordination
- ❌ Potential for race conditions between loops

### Reliability: ⭐⭐⭐⭐⭐ (95%+)

---

## Option 4: Webhook + Graph API (If Available)

### Concept
Use Facebook's official APIs instead of scraping.

### Prerequisites
- Facebook Business account
- App approval for Messenger API
- Webhook endpoint

### Implementation
```
┌─────────────────────────────────────────────────────────────┐
│                    WEBHOOK ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Facebook ──webhook──► Your Server ──► Database ──► Reply  │
│                                                             │
│  Benefits:                                                  │
│  - Real-time notifications                                  │
│  - Official API = reliable                                  │
│  - No scraping needed                                       │
│  - Delivery receipts                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Pros
- ✅ Most reliable option (official API)
- ✅ Real-time delivery
- ✅ No browser automation needed
- ✅ Delivery/read receipts

### Cons
- ❌ Requires Facebook Business verification
- ❌ Limited to Page conversations (not personal Messenger)
- ❌ Approval process can take weeks
- ❌ Rate limits and restrictions
- ❌ **NOT AVAILABLE FOR PERSONAL ACCOUNTS**

### Reliability: ⭐⭐⭐⭐⭐ (99%+ when available)

---

## Option 5: Screenshot-Based Verification

### Concept
Take screenshots and use OCR/image comparison to verify message state.

### Implementation
```
┌─────────────────────────────────────────────────────────────┐
│                 SCREENSHOT VERIFICATION                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Take screenshot of conversation list                    │
│  2. OCR extract all visible messages                        │
│  3. Compare with previous screenshot                        │
│  4. Detect new messages visually                            │
│  5. After reply, screenshot again to verify sent            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Pros
- ✅ Visual verification = what user sees
- ✅ Catches any UI state changes
- ✅ Can detect "seen" status visually
- ✅ Evidence/audit trail with images

### Cons
- ❌ Slow (OCR processing)
- ❌ Resource intensive
- ❌ OCR errors possible
- ❌ Complex implementation
- ❌ Storage for screenshots

### Reliability: ⭐⭐⭐ (70-80%)

---

## Option 6: Message ID Extraction

### Concept
Extract Facebook's internal message IDs from the DOM and track those.

### Implementation
```javascript
// Facebook embeds message IDs in data attributes
const messageElements = document.querySelectorAll('[data-message-id]');

// Or in the HTML structure
// <div data-scope="messages_table" data-messageid="m_xxxxx">
```

### Schema
```prisma
model TrackedMessage {
  id            String   @id @default(cuid())
  fbMessageId   String   @unique  // Facebook's internal ID
  contactId     String
  direction     String   // INBOUND | OUTBOUND
  processed     Boolean  @default(false)
  processedAt   DateTime?
  
  @@index([processed, contactId])
}
```

### Pros
- ✅ Uses Facebook's own unique identifiers
- ✅ No hash collision issues
- ✅ Reliable deduplication
- ✅ Can track exact messages

### Cons
- ❌ Message IDs may not always be exposed in DOM
- ❌ Facebook may obfuscate these
- ❌ Requires DOM analysis to find the pattern
- ❌ Can break with Facebook updates

### Reliability: ⭐⭐⭐⭐ (85%+ if IDs are accessible)

---

## Option 7: Conversation Diff Algorithm

### Concept
Store the full conversation text and diff it each cycle.

### Implementation
```
┌─────────────────────────────────────────────────────────────┐
│                  CONVERSATION DIFF                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Previous:                    Current:                      │
│  ┌──────────────┐            ┌──────────────┐              │
│  │ Them: Hi     │            │ Them: Hi     │              │
│  │ You: Hello   │     vs     │ You: Hello   │              │
│  │              │            │ Them: Thanks │ ◄── NEW!     │
│  └──────────────┘            └──────────────┘              │
│                                                             │
│  Diff Result: +1 new message from them                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Schema
```prisma
model ConversationSnapshot {
  id              String   @id @default(cuid())
  contactId       String
  fullText        String   // All messages concatenated
  messageHashes   String[] // Array of individual message hashes
  capturedAt      DateTime @default(now())
  accountId       String
  
  @@index([contactId, capturedAt])
}
```

### Workflow
1. Extract all messages from conversation
2. Compare with last snapshot
3. New messages = (current hashes) - (previous hashes)
4. Process only the new messages

### Pros
- ✅ Very accurate change detection
- ✅ Can handle edits/deletes
- ✅ Full history available
- ✅ Easy debugging

### Cons
- ❌ Storage intensive
- ❌ Slow for long conversations
- ❌ Need to handle conversation pagination

### Reliability: ⭐⭐⭐⭐⭐ (95%+)

---

## Recommended Architecture: Hybrid Approach

### The Best Solution: Combine Options 1 + 3 + 7

```
┌─────────────────────────────────────────────────────────────────┐
│                 PRODUCTION-READY ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    DETECTION LAYER                       │   │
│  │                                                         │   │
│  │   Fast Check (30s)      │      Full Scan (5min)        │   │
│  │   - Unread tab          │      - All conversations     │   │
│  │   - Quick response      │      - Catches misses        │   │
│  └───────────────┬─────────┴─────────────┬─────────────────┘   │
│                  │                       │                      │
│                  ▼                       ▼                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    TRACKING LAYER                        │   │
│  │                                                         │   │
│  │   ┌─────────────────────────────────────────────────┐   │   │
│  │   │              PostgreSQL Database                 │   │   │
│  │   │  - Messages table (per-message tracking)        │   │   │
│  │   │  - ConversationState table (state machine)      │   │   │
│  │   │  - AuditLog table (all actions)                 │   │   │
│  │   └─────────────────────────────────────────────────┘   │   │
│  └───────────────────────────┬─────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   PROCESSING LAYER                       │   │
│  │                                                         │   │
│  │   1. Check if message already in DB (dedupe)           │   │
│  │   2. If new → Insert as PENDING                        │   │
│  │   3. Generate AI reply                                 │   │
│  │   4. Send reply                                        │   │
│  │   5. Verify reply appeared in conversation             │   │
│  │   6. Update status to REPLIED or FAILED                │   │
│  │   7. Log everything to AuditLog                        │   │
│  └───────────────────────────┬─────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  VERIFICATION LAYER                      │   │
│  │                                                         │   │
│  │   - After sending: Check conversation has our reply    │   │
│  │   - Retry if not found within 10 seconds               │   │
│  │   - Alert if still failed after 3 retries              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Database Schema for Production

```prisma
// Add to schema.prisma

model Message {
  id              String    @id @default(cuid())
  fbMessageId     String?   // Facebook's ID if available
  contactId       String    // FB user identifier
  contactName     String
  conversationUrl String?
  messageText     String    @db.Text
  messageHash     String    // SHA256(contactId + text + approxTime)
  direction       String    // INBOUND | OUTBOUND
  status          String    // PENDING | PROCESSING | REPLIED | FAILED | SKIPPED
  retryCount      Int       @default(0)
  detectedAt      DateTime  @default(now())
  processedAt     DateTime?
  replyText       String?   @db.Text
  replyHash       String?
  errorMessage    String?
  accountId       String
  account         Account   @relation(fields: [accountId], references: [id])
  
  @@unique([accountId, contactId, messageHash])
  @@index([status, accountId])
  @@index([contactId, detectedAt])
}

model ConversationState {
  id                  String   @id @default(cuid())
  contactId           String
  contactName         String
  conversationUrl     String?
  state               String   // NEW | NEEDS_REPLY | WAITING | IDLE | ENDED | ERROR
  totalMessageCount   Int      @default(0)
  theirMessageCount   Int      @default(0)
  ourReplyCount       Int      @default(0)
  lastTheirMessageAt  DateTime?
  lastOurReplyAt      DateTime?
  lastCheckedAt       DateTime @default(now())
  conversationEnded   Boolean  @default(false)
  endReason           String?  // AI_ENDED | USER_ENDED | TIMEOUT | BLOCKED
  accountId           String
  account             Account  @relation(fields: [accountId], references: [id])
  
  @@unique([accountId, contactId])
  @@index([state, accountId])
}

model AuditLog {
  id          String   @id @default(cuid())
  timestamp   DateTime @default(now())
  accountId   String
  action      String   // MESSAGE_DETECTED | REPLY_GENERATED | REPLY_SENT | REPLY_VERIFIED | ERROR
  contactId   String?
  details     Json     // Full details of the action
  success     Boolean
  errorType   String?
  
  @@index([accountId, timestamp])
  @@index([action, timestamp])
}
```

---

## Implementation Priority

### Phase 1: Basic Reliability (1-2 days)
1. Add `Message` table for tracking
2. Add deduplication by hash before processing
3. Add basic audit logging
4. Add reply verification (check it appeared)

### Phase 2: State Machine (2-3 days)
1. Add `ConversationState` table
2. Implement state transitions
3. Add conversation-level tracking
4. Implement ENDED state properly

### Phase 3: Dual Loop (1-2 days)
1. Add slow full-scan loop
2. Implement reconciliation
3. Add missed message detection
4. Add alerts for failures

### Phase 4: Hardening (1-2 days)
1. Retry logic with exponential backoff
2. Error categorization
3. Health monitoring
4. Admin dashboard for monitoring

---

## Quick Wins (Immediate Improvements)

### 1. Add Message Hashing to Current Code
```typescript
function hashMessage(contactId: string, text: string): string {
  const normalized = text.trim().toLowerCase().slice(0, 100);
  return crypto.createHash('sha256')
    .update(`${contactId}:${normalized}`)
    .digest('hex')
    .slice(0, 16);
}
```

### 2. Add Reply Verification
```typescript
async function verifyReplySent(page: Page, replyText: string): Promise<boolean> {
  await page.waitForTimeout(2000);
  const messages = await extractAllMessages(page);
  const ourReply = messages.find(m => 
    m.direction === 'outbound' && 
    m.text.includes(replyText.slice(0, 50))
  );
  return !!ourReply;
}
```

### 3. Add Simple Persistence
```typescript
// Store processed hashes in a Set, persist to file
const processedHashes = new Set<string>();

function loadProcessedHashes() {
  try {
    const data = fs.readFileSync('processed-messages.json', 'utf-8');
    JSON.parse(data).forEach((h: string) => processedHashes.add(h));
  } catch { /* ignore */ }
}

function saveProcessedHashes() {
  fs.writeFileSync('processed-messages.json', 
    JSON.stringify([...processedHashes])
  );
}
```

---

## Summary: Recommended Path

| Approach | Effort | Reliability | Recommended |
|----------|--------|-------------|-------------|
| Database Message Tracking | Medium | 95% | ✅ YES |
| Conversation State Machine | Medium | 85% | ✅ YES |
| Dual-Loop Architecture | High | 95% | ✅ Phase 2 |
| Reply Verification | Low | +10% | ✅ YES |
| Message ID Extraction | Medium | 85% | Maybe |
| Screenshot OCR | High | 70% | ❌ No |
| Facebook API | N/A | 99% | ❌ Not available |

### Final Recommendation

1. **Immediately**: Add reply verification to confirm messages sent
2. **This Week**: Implement database-backed message tracking
3. **Next Week**: Add conversation state machine
4. **Later**: Add dual-loop architecture for maximum reliability

The combination of **Database Tracking + State Machine + Reply Verification** will give you ~95% reliability, which is production-ready for most use cases.
