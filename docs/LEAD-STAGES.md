# Lead Stages System

## Overview

The Lead Stages system tracks the progression of potential customers through the sales pipeline. Each lead can be at one of the following stages, representing their current position in the customer journey.

## Stages Pipeline

```
┌─────────┐     ┌────────────┐     ┌─────────────┐     ┌───────────┐
│  NONE   │ ──▶ │    LEAD    │ ──▶ │ INTERESTED  │ ──▶ │    CTA    │
└─────────┘     └────────────┘     └─────────────┘     └─────────────┘
                                                              │
                                                              ▼
                                                   ┌─────────────────┐
                                                   │  CONVERTED  │
                                                   │     or      │
                                                   │    LOST     │
                                                   └─────────────────┘
```

## Stage Definitions

### 1. NONE (Default)
- **Description**: Initial state for newly scraped leads
- **Criteria**: Lead has been scraped but no conversation has started
- **AI Trigger**: N/A (automatic on scrape)

### 2. LEAD
- **Description**: Active conversation has started
- **Criteria**: We have exchanged more than one message with the person
- **AI Trigger**: Set automatically when lead replies to our first message

### 3. INTERESTED
- **Description**: Lead shows genuine interest in our services
- **Criteria**: 
  - Lead is asking questions about services/pricing
  - Lead is showing buying intent
  - Lead is requesting more information
- **AI Trigger**: AI detects interest signals in conversation

### 4. CTA (Call to Action)
Two sub-types:
- **CTA_WHATSAPP**: Lead agreed to share WhatsApp number
- **CTA_PHONE**: Lead agreed to share phone number

**Criteria**:
- Lead has explicitly agreed to give contact information
- Lead has shared a phone/WhatsApp number

**AI Trigger**: AI detects that lead has agreed to or shared contact info

### 5. CONVERTED
- **Description**: Lead has successfully been converted to a customer
- **Criteria**: Sale has been made or appointment has been booked
- **AI Trigger**: Manual update or AI detects successful conversion

### 6. LOST
- **Description**: Lead is no longer interested or has been disqualified
- **Criteria**:
  - Lead explicitly said they're not interested
  - Lead has stopped responding after multiple follow-ups
  - Lead is not a good fit for our services
- **AI Trigger**: AI detects rejection or conversation ends without conversion

## Stage vs Status

| Field | Purpose | Values |
|-------|---------|--------|
| **Status** | Tracks the *action* taken on the lead | NEW, COMMENTED, DM_SENT, RESPONDED, CONVERTED, ARCHIVED |
| **Stage** | Tracks the *position* in sales pipeline | NONE, LEAD, INTERESTED, CTA_WHATSAPP, CTA_PHONE, CONVERTED, LOST |

### Example Flow:

1. Lead scraped → Status: `NEW`, Stage: `NONE`
2. We send DM → Status: `DM_SENT`, Stage: `NONE`
3. Lead replies → Status: `RESPONDED`, Stage: `LEAD`
4. Lead asks about pricing → Status: `RESPONDED`, Stage: `INTERESTED`
5. Lead shares WhatsApp → Status: `RESPONDED`, Stage: `CTA_WHATSAPP`
6. Deal closed → Status: `CONVERTED`, Stage: `CONVERTED`

## AI Integration

The Message Agent (AI) will automatically update stages based on conversation analysis:

```typescript
// AI analyzes each message and can return stage updates
{
  reply: "Your AI response here...",
  stageUpdate: "INTERESTED" | "CTA_WHATSAPP" | "CTA_PHONE" | "CONVERTED" | "LOST" | null
}
```

### AI Prompt Guidelines

The AI should update stages when it detects:

1. **→ INTERESTED**
   - "كم السوم؟" (How much?)
   - "شنو الخدمات؟" (What services?)
   - "تنجم تعطيني تفاصيل؟" (Can you give me details?)

2. **→ CTA_WHATSAPP/CTA_PHONE**
   - Lead shares a number: `+216 XX XXX XXX`
   - "هاو رقمي" (Here's my number)
   - "ابعثلي على الواتس" (Send me on WhatsApp)

3. **→ CONVERTED**
   - "باهي نتفاهمو" (OK, we'll arrange it)
   - "موافق" (Agreed)
   - Explicit confirmation of deal

4. **→ LOST**
   - "لا ما نحبش" (No, I don't want)
   - "شكرا، لا" (Thanks, no)
   - No response after [END_CONVERSATION]

## Dashboard Display

Stages are displayed with color-coded badges:

| Stage | Color | Badge |
|-------|-------|-------|
| NONE | Gray | `bg-zinc-100 text-zinc-600` |
| LEAD | Blue | `bg-blue-100 text-blue-700` |
| INTERESTED | Amber | `bg-amber-100 text-amber-700` |
| CTA_WHATSAPP | Green | `bg-green-100 text-green-700` |
| CTA_PHONE | Emerald | `bg-emerald-100 text-emerald-700` |
| CONVERTED | Purple | `bg-purple-100 text-purple-700` |
| LOST | Red | `bg-red-100 text-red-700` |

## Database Schema

```prisma
enum LeadStage {
  NONE
  LEAD
  INTERESTED
  CTA_WHATSAPP
  CTA_PHONE
  CONVERTED
  LOST
}

model Lead {
  // ... existing fields ...
  stage     LeadStage @default(NONE)
  stageUpdatedAt DateTime? @map("stage_updated_at")
  contactInfo    String?  @map("contact_info") // Stores phone/WhatsApp if shared
}
```

## Metrics & Reporting

Track conversion rates between stages:

- **Lead Conversion Rate**: LEAD → INTERESTED
- **CTA Conversion Rate**: INTERESTED → CTA
- **Final Conversion Rate**: CTA → CONVERTED
- **Loss Rate**: Any stage → LOST

## Implementation Checklist

- [x] Documentation created
- [x] Prisma schema updated with LeadStage enum
- [x] Migration run
- [x] Dashboard updated with stage column
- [x] Dashboard filters for stages
- [x] Stage update API endpoint created (`/api/leads/stage`)
- [ ] Message Agent updated to return stage updates
