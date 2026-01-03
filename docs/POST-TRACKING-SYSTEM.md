# Post Tracking System Design

## Problem Statement

Currently, the **Group Initializer** and **Scraper Agent** have no way to know which posts have already been scraped. This leads to:
- Re-scraping the same posts multiple times
- Wasted API calls to AI for analysis
- Duplicate lead detection overhead
- Inefficient use of scraping time

## Solution Overview

Implement a **Post Tracking System** that:
1. **Stores ALL scraped post URLs** immediately when found (before content extraction)
2. **Stops scrolling in Scraper when hitting a known post URL** (already in DB)
3. **Auto-cleans posts older than 7 days** to keep the database lean

---

## Database Schema Changes

### New `Post` Model

```prisma
model Post {
  id              String   @id @default(cuid())
  
  // Primary identifier - the post URL
  postUrl         String   @unique @map("post_url")
  
  // Content (filled in after initial creation)
  postText        String?  @map("post_text") @db.Text
  authorName      String?  @map("author_name")
  authorProfileUrl String? @map("author_profile_url")
  
  // Status
  hasContent      Boolean  @default(false) @map("has_content")  // True after content extracted
  
  // Timestamps
  postedAt        DateTime? @map("posted_at")          // When the post was made on FB
  scrapedAt       DateTime  @default(now()) @map("scraped_at")
  
  // Relationship
  groupId         String    @map("group_id")
  group           Group     @relation(fields: [groupId], references: [id], onDelete: Cascade)
  
  // Lead reference (if this post became a lead)
  leadId          String?   @unique @map("lead_id")
  lead            Lead?     @relation(fields: [leadId], references: [id], onDelete: SetNull)
  
  // Analysis result
  isLead          Boolean   @default(false) @map("is_lead")
  matchedService  String?   @map("matched_service")
  
  @@index([groupId])
  @@index([scrapedAt])
  @@index([postUrl])
  @@map("posts")
}
```

### Update `Group` Model

```prisma
model Group {
  // ... existing fields ...
  
  // New relation
  posts           Post[]
  
  // Track scraping progress
  lastScrapedPostId String?  @map("last_scraped_post_id")  // Already exists
  totalPosts        Int      @default(0) @map("total_posts")
}
```

### Update `Lead` Model

```prisma
model Lead {
  // ... existing fields ...
  
  // New relation - link back to the original post
  post            Post?
}
```

---

## How It Works

### 1. Scraper Agent (Regular Scraping) - DETAILED

**Purpose:** Scrape ONLY NEW posts from initialized groups. Stops scrolling when hitting a known post URL.

#### Optimized Approach: Pre-fetch Last 10 Posts

**Why this is better:**
- ❌ OLD: Query DB for EACH URL while scrolling (many DB calls)
- ✅ NEW: Fetch last 10 post URLs ONCE, check in-memory (1 DB call)

Since Facebook groups show posts in **chronological order** (newest first), we only need to check against the most recent posts we have. If we hit ANY of the last 10 known posts, we've caught up!

**Step-by-Step Flow:**

```
BEFORE SCROLLING: Fetch last 10 known posts (1 DB query)
═══════════════════════════════════════════════════════════

const recentPosts = await prisma.post.findMany({
  where: { groupId },
  orderBy: { scrapedAt: 'desc' },
  take: 10,
  select: { postUrl: true }
});

const knownUrls = new Set(recentPosts.map(p => p.postUrl));
// Now we have a Set of 10 URLs to check against (O(1) lookup)


SCROLL PHASE: Check against Set (in-memory, no DB calls)
═══════════════════════════════════════════════════════════

1. Navigate to group
2. Start scrolling and collecting post URLs
3. For EACH URL found:
   └── Check if URL is in knownUrls Set:
       
       if (knownUrls.has(url)) {
         // We've caught up to posts we already have!
         STOP SCROLLING
       }
       
       // Otherwise, it's a new post
       newUrls.push(url);
         
4. Every 10 NEW URLs collected:
   └── INSERT into DB (empty content)
   └── Log: "💾 Saved 10 new post URLs"


CONTENT PHASE: Extract content (batch updates)
═══════════════════════════════════════════════════════════

1. Query new posts where hasContent=false
2. For each post:
   a. Navigate to post URL
   b. Extract: postText, authorName, authorProfileUrl, postedAt
   c. Add to batch buffer
3. Every 10 posts → batch UPDATE in DB
4. Continue until all new posts have content


ANALYSIS PHASE: AI analysis (batch processing)
═══════════════════════════════════════════════════════════

1. Query posts where hasContent=true AND isLead IS NULL
2. Send to AI in batches of 10
3. For each match:
   - UPDATE post.isLead = true
   - CREATE Lead record
   - UPDATE post.leadId = new_lead.id
4. Update group.lastScrapedAt
```

**Visual Flow:**

```
┌─────────────────────────────────────────────────────────────────┐
│                      SCRAPER AGENT FLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  STEP 0: Pre-fetch (1 DB query)                                 │
│  ┌─────────────────────────────────────┐                        │
│  │ SELECT postUrl FROM posts           │                        │
│  │ WHERE groupId = ?                   │                        │
│  │ ORDER BY scrapedAt DESC             │                        │
│  │ LIMIT 10                            │                        │
│  └──────────────┬──────────────────────┘                        │
│                 │                                                │
│                 ▼                                                │
│  ┌─────────────────────────────────────┐                        │
│  │ knownUrls = Set([url1, url2, ...])  │  ← In-memory Set       │
│  └─────────────────────────────────────┘                        │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  SCROLL PHASE (check against Set - no DB calls!)                │
│                                                                  │
│  ┌──────────────┐                                               │
│  │ Post URL 1   │ → knownUrls.has() → FALSE → Buffer           │
│  │ Post URL 2   │ → knownUrls.has() → FALSE → Buffer           │
│  │ Post URL 3   │ → knownUrls.has() → FALSE → Buffer           │
│  │ ...          │                                               │
│  │ Post URL 7   │ → knownUrls.has() → FALSE → Buffer           │
│  │ Post URL 8   │ → knownUrls.has() → ⚠️ TRUE → STOP!          │
│  └──────────────┘                                               │
│                                                                  │
│  Result: 7 new posts to process (0 DB queries during scroll!)  │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  CONTENT PHASE (batch updates every 10)                         │
│  ┌─────────┐    ┌─────────┐                                     │
│  │ Post 1  │    │ text    │                                     │
│  │ Post 2  │ →  │ author  │ → UPDATE 7 posts (with content)     │
│  │ ...     │    │ profile │                                     │
│  │ Post 7  │    │ date    │                                     │
│  └─────────┘    └─────────┘                                     │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ANALYSIS PHASE (AI in batches of 10)                           │
│  ┌─────────┐         ┌─────────┐                                │
│  │ 7 posts │ → AI →  │ 2 Leads │ → CREATE Lead records          │
│  │         │         │ 5 Skip  │ → UPDATE isLead=true/false     │
│  └─────────┘         └─────────┘                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Code Structure:**

```typescript
// lead-gen-agent.ts (Scraper)

async function scrapeGroup(groupId: string) {
  const BATCH_SIZE = 10;
  
  // ═══════════════════════════════════════════
  // STEP 0: Pre-fetch last 10 known posts (1 DB query)
  // ═══════════════════════════════════════════
  
  const recentPosts = await prisma.post.findMany({
    where: { groupId },
    orderBy: { scrapedAt: 'desc' },
    take: 10,
    select: { postUrl: true },
  });
  
  const knownUrls = new Set(recentPosts.map(p => p.postUrl));
  log(`📋 Loaded ${knownUrls.size} recent post URLs to check against`);
  
  let newUrls: string[] = [];
  let totalSaved = 0;
  let hitKnownPost = false;
  
  // ═══════════════════════════════════════════
  // PHASE 1: SCROLL & CHECK (in-memory, no DB calls)
  // ═══════════════════════════════════════════
  
  while (!hitKnownPost) {
    const visibleUrls = await extractVisiblePostUrls();
    
    for (const url of visibleUrls) {
      // Check against our pre-loaded Set (O(1), no DB call!)
      if (knownUrls.has(url)) {
        log(`🛑 Hit known post! Stopping scroll.`);
        hitKnownPost = true;
        break;
      }
      
      // New post - add to buffer (avoid duplicates in current session)
      if (!newUrls.includes(url)) {
        newUrls.push(url);
      }
      
      // Save to DB every 10 URLs
      if (newUrls.length >= BATCH_SIZE) {
        await prisma.post.createMany({
          data: newUrls.map(u => ({
            postUrl: u,
            groupId: groupId,
            hasContent: false,
          })),
          skipDuplicates: true,
        });
        totalSaved += newUrls.length;
        log(`💾 Saved ${newUrls.length} new post URLs (total: ${totalSaved})`);
        newUrls = [];
      }
    }
    
    if (hitKnownPost) break;
    
    // Scroll down for more posts
    const scrolled = await scrollDown();
    if (!scrolled) break;  // No more content to load
  }
  
  // Save any remaining URLs in buffer
  if (newUrls.length > 0) {
    await prisma.post.createMany({
      data: newUrls.map(u => ({
        postUrl: u,
        groupId: groupId,
        hasContent: false,
      })),
      skipDuplicates: true,
    });
    totalSaved += newUrls.length;
    log(`💾 Saved ${newUrls.length} remaining post URLs (total: ${totalSaved})`);
  }
  
  log(`✅ Scroll phase complete: ${totalSaved} new posts found`);
  
  // ═══════════════════════════════════════════
  // PHASE 2: EXTRACT CONTENT (batch updates)
  // ═══════════════════════════════════════════
  
  const postsToProcess = await prisma.post.findMany({
    where: { groupId, hasContent: false },
  });
  
  let contentBatch: { id: string; content: PostContent }[] = [];
  
  for (const post of postsToProcess) {
    const content = await extractPostContent(post.postUrl);
    contentBatch.push({ id: post.id, content });
    
    // Every 10 posts → batch update
    if (contentBatch.length >= BATCH_SIZE) {
      await batchUpdateContent(contentBatch);
      log(`📝 Updated content for ${contentBatch.length} posts`);
      contentBatch = [];
    }
  }
  
  // Update remaining posts
  if (contentBatch.length > 0) {
    await batchUpdateContent(contentBatch);
    log(`📝 Updated content for ${contentBatch.length} posts`);
  }
  
  log(`✅ Content phase complete`);
  
  // ═══════════════════════════════════════════
  // PHASE 3: AI ANALYSIS (batch processing)
  // ═══════════════════════════════════════════
  
  const postsToAnalyze = await prisma.post.findMany({
    where: { groupId, hasContent: true, isLead: null },
  });
  
  let analysisBatch: Post[] = [];
  let totalLeads = 0;
  
  for (const post of postsToAnalyze) {
    analysisBatch.push(post);
    
    if (analysisBatch.length >= BATCH_SIZE) {
      const leads = await analyzeWithAI(analysisBatch);
      totalLeads += leads;
      log(`🎯 Analyzed ${analysisBatch.length} posts, found ${leads} leads`);
      analysisBatch = [];
    }
  }
  
  // Analyze remaining posts
  if (analysisBatch.length > 0) {
    const leads = await analyzeWithAI(analysisBatch);
    totalLeads += leads;
    log(`🎯 Analyzed ${analysisBatch.length} posts, found ${leads} leads`);
  }
  
  // Update group's last scraped timestamp
  await prisma.group.update({
    where: { id: groupId },
    data: { lastScrapedAt: new Date() },
  });
  
  log(`🏁 Scrape complete: ${totalSaved} new posts, ${totalLeads} leads`);
  
  return { newPosts: totalSaved, newLeads: totalLeads };
}

async function batchUpdateContent(batch: { id: string; content: PostContent }[]) {
  await prisma.$transaction(
    batch.map(item => 
      prisma.post.update({
        where: { id: item.id },
        data: {
          postText: item.content.text,
          authorName: item.content.authorName,
          authorProfileUrl: item.content.authorProfileUrl,
          postedAt: item.content.postedAt,
          hasContent: true,
        },
      })
    )
  );
}

async function analyzeWithAI(posts: Post[]): Promise<number> {
  // Send posts to AI for analysis
  const results = await aiAnalyze(posts);
  
  let leadsCreated = 0;
  
  for (const result of results) {
    if (result.isLead) {
      // Create Lead record
      const lead = await prisma.lead.create({
        data: {
          name: result.authorName,
          profileUrl: result.authorProfileUrl,
          postContent: result.postText,
          matchedService: result.matchedService,
          intentScore: result.intentScore,
          groupId: result.groupId,
          // ... other lead fields
        },
      });
      
      // Link post to lead
      await prisma.post.update({
        where: { id: result.postId },
        data: { 
          isLead: true, 
          leadId: lead.id,
          matchedService: result.matchedService,
        },
      });
      
      leadsCreated++;
    } else {
      // Mark as not a lead
      await prisma.post.update({
        where: { id: result.postId },
        data: { isLead: false },
      });
    }
  }
  
  return leadsCreated;
}
```

**Why 10 Posts is Enough:**

| Scenario | What Happens |
|----------|--------------|
| Normal day (5 new posts) | Hit known post after 5 scrolls |
| Busy day (50 new posts) | Scroll more, still hit one of the 10 |
| Very old posts deleted | Still works - we'll hit another known post |
| All 10 posts deleted | Rare edge case - will scroll until end |

**Database Efficiency:**

| Approach | DB Queries During Scroll | Memory Usage |
|----------|--------------------------|--------------|
| Query per URL | N queries (1 per post) | Low |
| Pre-fetch ALL URLs | 0 (but loads 1000s of URLs) | High |
| **Pre-fetch 10 URLs** | **0** | **Very Low** |

---

### 2. Group Initializer (First-Time Scraper) - DETAILED

**Purpose:** Initialize a NEW group by scraping historical posts. No existence checks needed since it's a fresh group.

**Step-by-Step Flow:**

```
PHASE 1: SCROLL & COLLECT LINKS (with immediate DB inserts)
═══════════════════════════════════════════════════════════

1. Navigate to group
2. Start scrolling and collecting post URLs
3. Every 10 URLs collected:
   └── Immediately INSERT into DB as Post records:
       {
         postUrl: "https://facebook.com/groups/.../posts/123",
         groupId: "group-id",
         hasContent: false,    // Content not yet extracted
         postText: null,
         authorName: null,
         scrapedAt: now()
       }
   └── Log: "💾 Saved batch of 10 post URLs to DB"
   
4. Continue scrolling until:
   - Reached 400 posts, OR
   - No more posts to load
   
5. All URLs now in DB with hasContent=false

PHASE 2: EXTRACT CONTENT (with batch updates)
═══════════════════════════════════════════════════════════

1. Query all posts where hasContent=false for this group
2. For each post URL:
   a. Navigate to post
   b. Extract: postText, authorName, authorProfileUrl, postedAt
   c. Add to batch buffer
   
3. Every 10 posts extracted:
   └── Batch UPDATE in DB:
       UPDATE posts SET 
         postText = "...",
         authorName = "...",
         authorProfileUrl = "...",
         hasContent = true
       WHERE id IN (batch_ids)
   └── Log: "📝 Updated content for 10 posts"

4. Continue until all posts have content

PHASE 3: AI ANALYSIS (with batch updates)
═══════════════════════════════════════════════════════════

1. Query all posts where hasContent=true AND isLead IS NULL for this group
2. Send posts to AI in batches of 10 for analysis
3. For each analyzed batch:
   └── UPDATE posts:
       - isLead = true/false
       - matchedService = "Web Development" (if applicable)
   └── If isLead=true:
       - CREATE Lead record
       - UPDATE post.leadId = new_lead.id
   └── Log: "🎯 Analyzed 10 posts, found X leads"

4. Mark group as initialized
```

**Visual Flow:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    GROUP INITIALIZER FLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  SCROLL PHASE                                                    │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐                      │
│  │ URL 1   │    │ URL 11  │    │ URL 21  │                      │
│  │ URL 2   │    │ URL 12  │    │ URL 22  │                      │
│  │ ...     │ →  │ ...     │ →  │ ...     │ → ... → 400 URLs     │
│  │ URL 10  │    │ URL 20  │    │ URL 30  │                      │
│  └────┬────┘    └────┬────┘    └────┬────┘                      │
│       │              │              │                            │
│       ▼              ▼              ▼                            │
│    INSERT 10      INSERT 10      INSERT 10                       │
│    (empty)        (empty)        (empty)                         │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  CONTENT PHASE                                                   │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐                      │
│  │ Post 1  │    │ Post 11 │    │ Post 21 │                      │
│  │ Post 2  │    │ Post 12 │    │ Post 22 │                      │
│  │ ...     │ →  │ ...     │ →  │ ...     │ → ...                │
│  │ Post 10 │    │ Post 20 │    │ Post 30 │                      │
│  └────┬────┘    └────┬────┘    └────┬────┘                      │
│       │              │              │                            │
│       ▼              ▼              ▼                            │
│    UPDATE 10      UPDATE 10      UPDATE 10                       │
│    (content)      (content)      (content)                       │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ANALYSIS PHASE                                                  │
│  ┌─────────┐         ┌─────────┐                                │
│  │ Batch 1 │ → AI →  │ 2 Leads │ → CREATE Lead records          │
│  │ (10)    │         │ 8 Skip  │ → UPDATE isLead=true/false     │
│  └─────────┘         └─────────┘                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Code Structure:**

```typescript
// first-time-scraper.ts

async function initializeGroup(groupUrl: string, groupId: string) {
  const BATCH_SIZE = 10;
  
  // ═══════════════════════════════════════════
  // PHASE 1: Scroll and collect URLs
  // ═══════════════════════════════════════════
  
  let collectedUrls: string[] = [];
  let totalSaved = 0;
  
  while (totalSaved < 400) {
    // Scroll and extract visible post URLs
    const newUrls = await extractVisiblePostUrls();
    collectedUrls.push(...newUrls);
    
    // Every 10 URLs → save to DB immediately
    while (collectedUrls.length >= BATCH_SIZE) {
      const batch = collectedUrls.splice(0, BATCH_SIZE);
      
      await prisma.post.createMany({
        data: batch.map(url => ({
          postUrl: url,
          groupId: groupId,
          hasContent: false,
        })),
        skipDuplicates: true,  // In case of duplicates
      });
      
      totalSaved += batch.length;
      log(`💾 Saved ${totalSaved} post URLs to DB`);
    }
    
    // Scroll down for more
    await scrollDown();
    
    if (noMorePosts()) break;
  }
  
  // Save any remaining URLs
  if (collectedUrls.length > 0) {
    await prisma.post.createMany({
      data: collectedUrls.map(url => ({
        postUrl: url,
        groupId: groupId,
        hasContent: false,
      })),
      skipDuplicates: true,
    });
    totalSaved += collectedUrls.length;
  }
  
  log(`✅ Phase 1 complete: ${totalSaved} URLs saved`);
  
  // ═══════════════════════════════════════════
  // PHASE 2: Extract content for each post
  // ═══════════════════════════════════════════
  
  const postsToProcess = await prisma.post.findMany({
    where: { groupId, hasContent: false },
  });
  
  let contentBatch: { id: string; content: PostContent }[] = [];
  
  for (const post of postsToProcess) {
    const content = await extractPostContent(post.postUrl);
    contentBatch.push({ id: post.id, content });
    
    // Every 10 posts → batch update
    if (contentBatch.length >= BATCH_SIZE) {
      await batchUpdateContent(contentBatch);
      log(`📝 Updated content for ${contentBatch.length} posts`);
      contentBatch = [];
    }
  }
  
  // Update remaining
  if (contentBatch.length > 0) {
    await batchUpdateContent(contentBatch);
  }
  
  log(`✅ Phase 2 complete: Content extracted for all posts`);
  
  // ═══════════════════════════════════════════
  // PHASE 3: AI Analysis
  // ═══════════════════════════════════════════
  
  const postsToAnalyze = await prisma.post.findMany({
    where: { groupId, hasContent: true, isLead: null },
  });
  
  let analysisBatch: Post[] = [];
  let totalLeads = 0;
  
  for (const post of postsToAnalyze) {
    analysisBatch.push(post);
    
    if (analysisBatch.length >= BATCH_SIZE) {
      const leads = await analyzeWithAI(analysisBatch);
      totalLeads += leads;
      log(`🎯 Analyzed ${analysisBatch.length} posts, found ${leads} leads`);
      analysisBatch = [];
    }
  }
  
  // Analyze remaining
  if (analysisBatch.length > 0) {
    const leads = await analyzeWithAI(analysisBatch);
    totalLeads += leads;
  }
  
  // Mark group as initialized
  await prisma.group.update({
    where: { id: groupId },
    data: {
      isInitialized: true,
      initializedAt: new Date(),
      totalPosts: totalSaved,
    },
  });
  
  log(`🏁 Initialization complete: ${totalSaved} posts, ${totalLeads} leads`);
}

async function batchUpdateContent(batch: { id: string; content: PostContent }[]) {
  // Use transaction for batch update
  await prisma.$transaction(
    batch.map(item => 
      prisma.post.update({
        where: { id: item.id },
        data: {
          postText: item.content.text,
          authorName: item.content.authorName,
          authorProfileUrl: item.content.authorProfileUrl,
          postedAt: item.content.postedAt,
          hasContent: true,
        },
      })
    )
  );
}
```

---

### 3. Post Cleanup (Cron Job)

**Schedule:** Run daily at 3 AM

```typescript
// cleanup-old-posts.ts
async function cleanupOldPosts() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  // Delete posts older than 7 days that are NOT leads
  const deleted = await prisma.post.deleteMany({
    where: {
      scrapedAt: { lt: sevenDaysAgo },
      isLead: false,  // Keep posts that became leads
    }
  });
  
  console.log(`🧹 Cleaned up ${deleted.count} old posts`);
}
```

**Note:** Posts that became leads are kept (linked to Lead record).

---

## Why Use Post URL as Unique Identifier

**We use the full `postUrl` as the unique identifier instead of extracting `fbPostId` because:**

1. **Simplicity** - No regex parsing needed, just use the URL directly
2. **Reliability** - FB post URLs are unique and persistent
3. **No edge cases** - Different URL formats all work (permalinks, story_fbid, etc.)
4. **Fast lookups** - Database index on `postUrl` for O(1) lookups

```typescript
// Simple existence check - no parsing needed
const exists = await prisma.post.findUnique({
  where: { postUrl: "https://facebook.com/groups/.../posts/123" }
});
```

---

## Implementation Steps

### Phase 1: Database Setup
1. Add `Post` model to `prisma/schema.prisma`
2. Add relation to `Lead` model
3. Run `prisma db push` and `prisma generate`

### Phase 2: Update Group Initializer
1. Modify `agents/first-time-scraper.ts`:
   - Save ALL posts to DB (not just leads)
   - Extract and store `fbPostId`
   - Stop when hitting existing post
   - Link leads to their source posts

### Phase 3: Update Scraper Agent
1. Modify `agents/lead-gen-agent.ts`:
   - Check for existing posts before analyzing
   - Stop scraping group when hitting known post
   - More efficient - only analyze truly new posts

### Phase 4: Add Cleanup Job
1. Create `lib/cleanup-posts.ts`
2. Add API endpoint `/api/cron/cleanup-posts`
3. Configure external cron (Vercel Cron, GitHub Actions, or similar)

---

## Benefits

| Metric | Before | After |
|--------|--------|-------|
| Posts analyzed per run | All visible (~20) | Only new ones (~5) |
| AI API calls | Wasteful (re-analyzing) | Minimal (new only) |
| Scraping time | ~5 min/group | ~1 min/group |
| Duplicate leads | Possible | Impossible |
| Database size | Leads only | Posts + Leads (with cleanup) |

---

## API Endpoints

### Get Posts for a Group
```
GET /api/groups/:id/posts?limit=50
```

### Manual Cleanup Trigger
```
POST /api/cron/cleanup-posts
```

### Post Stats
```
GET /api/stats/posts
Response: {
  totalPosts: 1234,
  postsLast7Days: 456,
  postsByGroup: [...]
}
```

---

## Example Flow

### Day 1: Initialize Group (Initializer)
```
[Initializer] 📍 Navigating to "Freelancers Tunisia"...
[Initializer] 🔄 Starting scroll phase...

[Initializer] Scroll 1: Found 10 URLs
[Initializer] 💾 INSERT 10 posts (empty content)
[Initializer] Scroll 2: Found 10 URLs  
[Initializer] 💾 INSERT 10 posts (empty content)
... (continues until 400)
[Initializer] ✅ Phase 1: 400 URLs saved to DB

[Initializer] 📝 Extracting content...
[Initializer] Post 1-10: Content extracted
[Initializer] 💾 UPDATE 10 posts (with content)
[Initializer] Post 11-20: Content extracted
[Initializer] 💾 UPDATE 10 posts (with content)
... (continues for all 400)
[Initializer] ✅ Phase 2: Content extracted for 400 posts

[Initializer] 🤖 Analyzing with AI...
[Initializer] Batch 1 (10 posts): 2 leads found
[Initializer] Batch 2 (10 posts): 1 lead found
... (continues)
[Initializer] ✅ Phase 3: 15 leads created from 400 posts
[Initializer] 🏁 Group initialized!
```

### Day 2: Regular Scrape (Scraper)
```
[Scraper] 📍 Checking "Freelancers Tunisia"...
[Scraper] 🔄 Scrolling for new posts...

[Scraper] Post URL 1 → Check DB → NOT FOUND → Buffer
[Scraper] Post URL 2 → Check DB → NOT FOUND → Buffer
[Scraper] Post URL 3 → Check DB → NOT FOUND → Buffer
[Scraper] Post URL 4 → Check DB → NOT FOUND → Buffer
[Scraper] Post URL 5 → Check DB → NOT FOUND → Buffer
[Scraper] Post URL 6 → Check DB → NOT FOUND → Buffer
[Scraper] Post URL 7 → Check DB → NOT FOUND → Buffer
[Scraper] Post URL 8 → Check DB → ⚠️ FOUND! 
[Scraper] 🛑 Stopping scroll - hit known post!

[Scraper] 💾 INSERT 7 new posts (empty content)
[Scraper] 📝 Extracting content for 7 posts...
[Scraper] 💾 UPDATE 7 posts (with content)
[Scraper] 🤖 Analyzing 7 posts with AI...
[Scraper] 🎯 Found 2 leads from 7 new posts
[Scraper] ✅ Done! (Only processed 7 posts instead of 400)
```

### Day 8: Cleanup
```
[Cleanup] Running daily cleanup...
[Cleanup] Found 350 posts older than 7 days
[Cleanup] Keeping 12 posts (linked to leads)
[Cleanup] 🧹 Deleted 338 old posts
```

---

## Questions to Consider

1. **Should we store post images?** 
   - Probably not (storage cost), but could store image URLs

2. **What about comments on posts?**
   - Future enhancement: track comment counts, scrape high-engagement posts

3. **What if a post URL changes?**
   - Facebook post URLs are stable, they don't change once created

4. **Handle deleted posts?**
   - If a lead's source post is deleted on FB, the Lead remains (Post record stays)

5. **What if content extraction fails?**
   - Post remains with `hasContent=false`, can be retried later

---

## Ready to Implement?

Once approved, I'll:
1. Update the Prisma schema
2. Modify the First-Time Scraper
3. Modify the Scraper Agent  
4. Add the cleanup job
5. Update the UI to show post counts

Let me know if you want to proceed! 🚀
