// Procedures Index - Export all procedures

// P1 & P2: Browser Launch and Stealth
export {
  launchBrowser,
  warmupSession,
  closeBrowser,
  STEALTH_SCRIPT,
} from "./browser";

// P3 & P4: Human Behavior
export {
  humanDelay,
  shortDelay,
  mediumDelay,
  longDelay,
  postActionDelay,
  humanType,
  humanTypeWithTypos,
  humanScroll,
  humanBrowseScroll,
  humanMouseMove,
  humanClick,
  randomHumanAction,
} from "./human-behavior";

// P5 & P6: Scraping
export {
  navigateToGroup,
  extractPosts,
  incrementalScrape,
  fullScrape,
  prefetchKnownPermalinkIds,
  prefetchContentSignatures,
  createContentSignature,
} from "./scraping";

// P8 & P9: AI Operations
export {
  loadServicesKnowledge,
  analyzePostForLead,
  generateAIReply,
  generateAIReplyWithTools,
  generateAIReplyWithContext,
  generateInitialDM,
  generatePostComment,
  shouldEndConversation,
  SERVICES_LIST,
  cleanAIReply,
  detectInterest,
} from "./ai";
export type { AIReplyResult, PostContext } from "./ai";

// P10: Commenting on Posts
export {
  navigateToPost,
  postComment,
  commentOnPost,
  COMMENT_SELECTORS,
} from "./commenting";
export type { CommentResult } from "./commenting";

// P11: Direct Messaging
export {
  navigateToProfile,
  clickMessageButton,
  sendMessage,
  sendInitialDM,
  DM_SELECTORS,
} from "./dm";
export type { DMResult } from "./dm";

// P14, P15, P16: Messenger Operations
export {
  checkInbox,
  clickFirstUnread,
  readConversation,
  sendReply,
  navigateToMessenger,
  extractContactInfo,
  getConversationHash,
  hasNewTheirMessage,
} from "./messenger";

// Selectors and Utilities
export {
  GROUP_SELECTORS,
  MESSENGER_SELECTORS,
  PROFILE_SELECTORS,
  COMMON_SELECTORS,
  getChronologicalGroupUrl,
  extractGroupId,
  extractPostId,
  extractProfileId,
  isArabicName,
  getDisplayName,
  MESSAGE_BLACKLIST,
  NAME_BLACKLIST,
  isValidMessage,
  isValidContactName,
} from "./facebook-selectors";
