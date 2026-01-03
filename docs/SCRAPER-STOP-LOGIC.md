# Scraper Stop Logic - Analysis & Solution

## The Problem

### How Facebook Feed Works
```
Facebook Feed (sorted by "New Posts"):
┌─────────────────────────────────────┐
│ Post A - 5 minutes ago   (NEWEST)   │  ← Scraper starts here
│ Post B - 10 minutes ago             │
│ Post C - 1 hour ago                 │
│ Post D - 2 hours ago                │
│ Post E - 3 hours ago                │
│ Post F - 1 day ago       (OLDEST)   │  ← Scraper ends here
└─────────────────────────────────────┘
```

### How First-Time Scraper Works
```
Scrape Order:           Database scrapedAt:
1. Post A (newest)  →   scrapedAt = 10:00:00
2. Post B           →   scrapedAt = 10:00:05
3. Post C           →   scrapedAt = 10:00:10
4. Post D           →   scrapedAt = 10:00:15
5. Post E           →   scrapedAt = 10:00:20
6. Post F (oldest)  →   scrapedAt = 10:00:25  ← HIGHEST scrapedAt!
```

### The Bug
When we query `ORDER BY scrapedAt DESC LIMIT 40`:
- We get Post F, E, D, C... (the OLDEST Facebook posts)
- We should be checking against Post A, B, C... (the NEWEST)

When Scraper Agent runs later and new posts G, H appear:
```
Facebook Feed NOW:
┌─────────────────────────────────────┐
│ Post G - NEW                        │  ← Collect this
│ Post H - NEW                        │  ← Collect this
│ Post A - Already in DB              │  ← STOP HERE!
│ Post B - Already in DB              │
│ ...                                 │
└─────────────────────────────────────┘
```

We need to stop at Post A, but our query returned Post F!

---

## Solution Options

### Option 1: Query DB for Each URL ❌
```typescript
// For each collected URL, query DB
const exists = await prisma.groupPost.findFirst({
  where: { OR: [{ shareUrl: url }, { postUrl: url }] }
});
```
**Pros:** Zero memory usage
**Cons:** 
- 1 DB query per post (50-100 queries per scrape session)
- Expensive on Neon (pooled connections, latency)
- Slow (network round-trip for each check)

**Cost estimate:** 100 posts × $0.0001/query = $0.01 per group per scrape
With 50 groups × 10 scrapes/day = $5/day = **$150/month** ❌

---

### Option 2: Store Only First Post URL ❌
```typescript
// Current approach - store lastScrapedShareUrl
const shouldStop = collectedUrl === lastScrapedShareUrl;
```
**Pros:** Minimal storage, simple
**Cons:**
- Only checks ONE URL
- If that post was deleted, we never stop
- Share URLs can change/expire
- The URL we saved might not match (share vs permalink mismatch)

---

### Option 3: Load ALL URLs into Memory ✅
```typescript
// Load all URLs for this group once
const allPosts = await prisma.groupPost.findMany({
  where: { groupId },
  select: { shareUrl: true, postUrl: true }
});

const knownUrls = new Set<string>();
allPosts.forEach(p => {
  if (p.shareUrl) knownUrls.add(p.shareUrl);
  if (p.postUrl) knownUrls.add(p.postUrl);
});

// O(1) lookup
if (knownUrls.has(collectedUrl)) stop();
```

**Memory Calculation:**
```
Per URL:
- Average URL length: ~70 characters
- UTF-16 in JS: ~140 bytes per URL

Per Group (10,000 posts):
- 10,000 posts × 2 URLs = 20,000 strings
- 20,000 × 140 bytes = 2.8 MB

Per Scrape Session:
- We only process ONE group at a time
- Memory freed after each group
- Peak: ~3 MB per group ← TOTALLY FINE!
```

**Pros:**
- Single DB query per group
- O(1) lookup (instant)
- No network latency for checks
- Works with any URL format

**Cons:**
- 3 MB memory per group (negligible)

---

### Option 4: Bloom Filter ❌ (Over-engineering)
```typescript
// Probabilistic data structure - not needed
const bloom = new BloomFilter(10000, 0.01);
```
**Why not:** 
- Regular Set is fast enough
- Bloom filters have false positives
- Added complexity for minimal gain
- 3 MB is not a problem

---

## Recommended Solution: Option 3

### Implementation

```typescript
export async function prefetchKnownUrls(
  groupId: string,
  log: (msg: string) => void
): Promise<Set<string>> {
  // Single DB query - get ALL posts for this group
  const posts = await prisma.groupPost.findMany({
    where: { groupId },
    select: { shareUrl: true, postUrl: true },
  });
  
  // Build Set for O(1) lookup
  const knownUrls = new Set<string>();
  for (const post of posts) {
    if (post.shareUrl) knownUrls.add(post.shareUrl);
    if (post.postUrl) knownUrls.add(post.postUrl);
  }
  
  log(`📋 Loaded ${posts.length} posts (${knownUrls.size} URLs) - ${(knownUrls.size * 140 / 1024 / 1024).toFixed(2)} MB`);
  
  return knownUrls;
}
```

### Why This Works

1. **Single Query:** One DB call to load all URLs for the group
2. **Fast Lookup:** Set.has() is O(1) - instant check
3. **No URL Format Issues:** We store BOTH shareUrl and postUrl, so we'll match regardless of which format Facebook returns
4. **Memory Efficient:** 3 MB per group is nothing (Node.js heap is typically 512 MB - 4 GB)
5. **Automatic Cleanup:** JavaScript garbage collector frees the Set after we're done with the group

### Performance Comparison

| Approach | DB Queries | Memory | Lookup Time | Reliability |
|----------|-----------|--------|-------------|-------------|
| Query each URL | 50-100 | 0 | 50-200ms each | ✅ High |
| Single lastScrapedUrl | 1 | 0 | - | ❌ Low |
| **Load all to Set** | **1** | **3 MB** | **<0.001ms** | **✅ High** |

---

## Final Implementation

Remove the limit, load ALL posts for the group:

```typescript
export async function prefetchKnownUrls(
  groupId: string,
  log: (msg: string) => void
): Promise<Set<string>> {
  const posts = await prisma.groupPost.findMany({
    where: { groupId },
    select: { shareUrl: true, postUrl: true },
  });
  
  const knownUrls = new Set<string>();
  for (const post of posts) {
    if (post.shareUrl) knownUrls.add(post.shareUrl);
    if (post.postUrl) knownUrls.add(post.postUrl);
  }
  
  const memoryMB = (knownUrls.size * 140 / 1024 / 1024).toFixed(2);
  log(`📋 Loaded ${posts.length} posts (${knownUrls.size} URLs, ~${memoryMB} MB)`);
  
  return knownUrls;
}
```

Then in Phase 1, simply check:
```typescript
if (knownUrls.has(cleanUrl)) {
  log(`🛑 Found known post - stopping!`);
  break;
}
```

This is the **fastest, most reliable, and most cost-effective** solution.
