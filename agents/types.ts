// Agent Types and Interfaces

import { Page, BrowserContext } from "playwright";

// ============================================
// CORE TYPES
// ============================================

export type AgentType = "FIRST_TIME_SCRAPER" | "LEAD_GEN" | "MESSAGE_AGENT";

export type AgentStatus = 
  | "IDLE"
  | "RUNNING"
  | "COMPLETED"
  | "ERROR"
  | "STOPPED";

export interface AgentResult {
  success: boolean;
  agentType: AgentType;
  startedAt: Date;
  completedAt: Date;
  duration: number; // ms
  logs: string[];
  errors: string[];
  stats: Record<string, number>;
}

// ============================================
// BROWSER PROCEDURES
// ============================================

export interface BrowserConfig {
  accountId: string;
  headless?: boolean;
  profilePath?: string;
}

export interface BrowserSession {
  context: BrowserContext;
  page: Page;
  accountId: string;
}

// ============================================
// SCRAPING TYPES
// ============================================

export interface ScrapedPost {
  postUrl: string;      // Resolved permalink (after redirect)
  shareUrl?: string;    // Original share URL (from clipboard)
  fbPostId: string;
  content: string;
  authorName: string | null;
  authorProfileUrl: string | null;
  authorFbId: string | null;
  isAnonymous: boolean;
  hasImages: boolean;
  hasVideo: boolean;
  imageUrls: string[];
  likeCount: number;
  commentCount: number;
  shareCount: number;
  scrapedAt: Date;
}

export interface ScrapeResult {
  groupId: string;
  posts: ScrapedPost[];
  stoppedAt?: string; // postUrl where we stopped
  newPostsCount: number;
  newestShareUrl?: string; // Share URL of newest post (for next comparison)
}

// ============================================
// AI ANALYSIS TYPES
// ============================================

export interface AIAnalysisResult {
  isLead: boolean;
  matchedService: string | null;
  reason: string | null; // 1 sentence explaining why this is a lead
  keywords: string[];
  suggestedComment: string | null;
  intentScore?: number; // 1-5 scale for lead quality scoring
}

// ============================================
// ENGAGEMENT TYPES
// ============================================

export interface EngagementResult {
  commented: boolean;
  friendRequestSent: boolean;
  dmSent: boolean;
  errors: string[];
}

// ============================================
// MESSAGE AGENT TYPES
// ============================================

export interface Message {
  sender: "them" | "us";
  text: string;
}

export interface Conversation {
  contactName: string;
  contactFbId?: string;
  messages: Message[];
  isUnread: boolean;
}

export interface MessageAgentResult extends AgentResult {
  stats: {
    cyclesCompleted: number;
    conversationsProcessed: number;
    repliesSent: number;
    contactsExtracted: number;
    stageUpdates: number;
  };
  conversationsHandled: ConversationHandled[];
  stoppedReason: "no_activity_timeout" | "manual_stop" | "error" | "browser_closed";
}

export interface ConversationHandled {
  contactName: string;
  messagesRead: number;
  replySent: boolean;
  replyText: string;
  extractedPhone?: string;
  extractedWhatsApp?: string;
  stageUpdated?: string;
}

// ============================================
// SCHEDULE TYPES
// ============================================

export interface HourSchedule {
  enabled: boolean;
  isPeak?: boolean;
}

export interface AgentSchedule {
  enabled: boolean;
  schedule: Record<string, HourSchedule>; // "08" -> { enabled: true, isPeak: false }
}

export interface ScheduleConfig {
  timezone: string;
  leadGenAgent: AgentSchedule;
  messageAgent: AgentSchedule;
}

// ============================================
// LEAD GEN AGENT TYPES
// ============================================

export interface LeadGenResult extends AgentResult {
  stats: {
    groupsProcessed: number;
    postsScraped: number;
    postsAnalyzed: number;
    leadsCreated: number;
    commentsPosted: number;
    friendRequestsSent: number;
    dmsSent: number;
  };
}

// ============================================
// FIRST TIME SCRAPER TYPES
// ============================================

export interface FirstTimeScraperResult extends AgentResult {
  stats: {
    postsScraped: number;
    postsSaved: number;
    postsAnalyzed: number;
    leadsCreated: number;
    commentsPosted: number;
    dmsSent: number;
  };
  lastScrapedPostUrl?: string;
}

// ============================================
// DAILY LIMITS
// ============================================

export interface DailyLimits {
  maxGroupsPerHour: number;
  maxCommentsPerDay: number;
  maxFriendRequestsPerDay: number;
  maxDmsPerDay: number;
}

export const DEFAULT_DAILY_LIMITS: DailyLimits = {
  maxGroupsPerHour: 5,
  maxCommentsPerDay: 15,
  maxFriendRequestsPerDay: 10,
  maxDmsPerDay: 8,
};
