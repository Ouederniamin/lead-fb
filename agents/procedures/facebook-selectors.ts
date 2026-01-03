// Facebook Selectors - Common selectors used across procedures

// ============================================
// GROUP SELECTORS
// ============================================
export const GROUP_SELECTORS = {
  // Post containers
  postContainer: '[role="article"][aria-label]',
  postFeed: '[role="feed"]',
  
  // Post content
  postText: '[data-ad-comet-preview="message"], [data-ad-preview="message"]',
  postTextAlt: 'div[dir="auto"]:not([role])',
  
  // Author info
  authorLink: 'a[role="link"][href*="/user/"], a[role="link"][href*="/profile.php"]',
  authorName: 'strong > span, h4 > span > a > span',
  anonymousIndicator: 'span:has-text("Anonymous"), span:has-text("مجهول")',
  
  // Post metadata
  timestamp: 'a[href*="posts/"] span, abbr[data-utime]',
  postLink: 'a[href*="/groups/"][href*="/posts/"], a[href*="/groups/"][href*="permalink"]',
  
  // Engagement counts
  likeCount: '[aria-label*="like"], [aria-label*="reaction"]',
  commentCount: '[aria-label*="comment"]',
  shareCount: '[aria-label*="share"]',
  
  // Sorting
  sortDropdown: 'div[aria-label*="Sort"], span:has-text("Most relevant"), span:has-text("New posts")',
  newPostsOption: 'div[role="menuitem"]:has-text("New posts"), span:has-text("New posts")',
  
  // Comment box
  commentBox: 'div[contenteditable="true"][role="textbox"]',
  commentSubmit: 'div[aria-label="Comment"], div[aria-label*="submit"]',
};

// ============================================
// MESSENGER SELECTORS
// ============================================
export const MESSENGER_SELECTORS = {
  // Inbox tabs
  unreadTab: 'a[href*="unread"], [role="tab"]:has-text("Unread")',
  allTab: 'a[href*="t/"], [role="tab"]:has-text("All")',
  
  // Conversation list
  conversationList: '[role="grid"], [role="list"]',
  conversationItem: '[role="row"], [role="listitem"]',
  unreadConversation: '[aria-current="false"][data-testid], [role="row"]:has([aria-label*="unread"])',
  
  // Message area
  messageContainer: '[role="main"]',
  messageRow: '[role="row"]',
  messagePresentation: '[role="presentation"]',
  messageText: '[dir="auto"]',
  
  // Input
  messageInput: 'div[contenteditable="true"][role="textbox"]',
  sendButton: '[aria-label="Send"], [aria-label*="Press enter to send"]',
  
  // Contact info
  contactName: '[role="heading"]',
  contactAvatar: 'image, img[alt*="profile"], svg[role="img"]',
};

// ============================================
// PROFILE SELECTORS
// ============================================
export const PROFILE_SELECTORS = {
  // Profile page
  profileName: 'h1, [data-testid="profile_name"]',
  addFriendButton: '[aria-label*="Add friend"], [aria-label*="Add Friend"]',
  messageButton: '[aria-label*="Message"], [aria-label*="Messenger"]',
  
  // Friend status
  friendStatus: '[aria-label*="Friends"], [aria-label*="friend"]',
  pendingRequest: '[aria-label*="Pending"], [aria-label*="pending"]',
};

// ============================================
// COMMON SELECTORS
// ============================================
export const COMMON_SELECTORS = {
  // Loading indicators
  spinner: '[role="progressbar"], [aria-busy="true"]',
  skeleton: '[aria-hidden="true"][style*="animation"]',
  
  // Dialogs
  dialog: '[role="dialog"]',
  closeButton: '[aria-label="Close"], [aria-label*="close"]',
  
  // Error indicators
  errorMessage: '[role="alert"], [data-testid*="error"]',
  
  // Login check
  loginForm: 'input[name="email"], form[action*="login"]',
};

// ============================================
// HELPER FUNCTIONS
// ============================================

// Build chronological group URL
export function getChronologicalGroupUrl(groupUrl: string): string {
  let url = groupUrl.trim();
  // Remove existing sorting
  url = url.replace(/[?&]sorting_setting=[^&]*/g, '');
  // Add chronological sorting
  if (url.includes('?')) {
    url += '&sorting_setting=CHRONOLOGICAL';
  } else {
    url += '?sorting_setting=CHRONOLOGICAL';
  }
  return url;
}

// Extract group ID from URL
export function extractGroupId(groupUrl: string): string | null {
  const match = groupUrl.match(/facebook\.com\/groups\/([^/?]+)/);
  return match ? match[1] : null;
}

// Extract post ID from URL
// Handles: /permalink/123, /posts/123, with query params like ?rdid=xxx#
export function extractPostId(postUrl: string): string | null {
  if (!postUrl) return null;
  
  // Clean URL - remove query params and hash
  const cleanUrl = postUrl.split('?')[0].split('#')[0];
  
  // Match patterns like /permalink/123 or /posts/123
  const match = cleanUrl.match(/(?:permalink|posts)\/(\d+)/);
  return match ? match[1] : null;
}

// Extract profile ID from URL
export function extractProfileId(profileUrl: string): string | null {
  const match = profileUrl.match(/user\/(\d+)|profile\.php\?id=(\d+)|facebook\.com\/(\w+)/);
  if (match) {
    return match[1] || match[2] || match[3];
  }
  return null;
}

// Check if name contains Arabic characters
export function isArabicName(name: string): boolean {
  const arabicPattern = /[\u0600-\u06FF]/;
  return arabicPattern.test(name);
}

// Get display name (first name or fallback)
export function getDisplayName(fullName: string): string {
  const firstName = fullName.split(' ')[0].trim();
  
  // If Arabic name, use it
  if (isArabicName(firstName)) {
    return firstName;
  }
  
  // If looks like a real name
  if (/^[A-Z][a-z]{1,15}$/.test(firstName)) {
    return firstName;
  }
  
  // Default fallback
  return 'أخي';
}

// ============================================
// MESSAGE PARSING HELPERS
// ============================================

// Blacklist for texts that are NOT valid messages
export const MESSAGE_BLACKLIST = [
  'you sent', 'you:', 'enter', 'reply', 'send',
  'messages and calls are secured', 'learn more', 'end-to-end encrypted',
  'active now', 'active', 'typing', 'online', 'offline',
  'delivered', 'seen', 'sent', 'read',
  'yesterday', 'today', 'just now', 'ago', 'hour', 'hours', 'minute', 'minutes',
  'am', 'pm', 'messenger', 'facebook', 'like', 'love', 'haha', 'wow', 'sad', 'angry',
  'photo', 'video', 'sticker', 'gif', 'voice message', 'audio',
  'missed call', 'video call', 'voice call',
  'unsent a message', 'removed a message', 'reacted to your message',
  'message request', 'accept', 'decline', 'block', 'report',
  'wave', 'thumbs up', '👍', '👋', 'liked a message', 'loved a message'
];

// Blacklist for conversation names
export const NAME_BLACKLIST = [
  'active now', 'active', 'you sent', 'you:', 'chat info', 'enter',
  'unread', 'all', 'groups', 'communities', 'chats', 'search',
  'message', 'messages', 'messenger', 'marketplace', 'new message',
  'see all', 'mark all', 'settings', 'archive', 'requests',
  'yesterday', 'today', 'just now', 'ago', 'hour', 'hours', 'minute', 'minutes',
  'typing', 'online', 'offline', 'delivered', 'seen', 'sent',
  'facebook user', 'messenger user'
];

// Check if text is a valid message
export function isValidMessage(text: string): boolean {
  const lower = text.toLowerCase();
  
  // Check against blacklist
  for (const blocked of MESSAGE_BLACKLIST) {
    if (lower === blocked || lower.includes(blocked)) {
      return false;
    }
  }
  
  // Check for timestamp patterns
  if (/^\d{1,2}:\d{2}/.test(text)) return false;
  if (/\d{1,2}:\d{2}\s*(AM|PM)/i.test(text)) return false;
  if (/yesterday|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday/i.test(text)) return false;
  
  return true;
}

// Check if name is valid contact name
export function isValidContactName(name: string): boolean {
  const lower = name.toLowerCase();
  
  for (const blocked of NAME_BLACKLIST) {
    if (lower === blocked || lower.includes(blocked)) {
      return false;
    }
  }
  
  return name.length >= 2 && name.length <= 100;
}
