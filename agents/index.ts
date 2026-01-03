// Agents Index - Export all agents and utilities

// Types
export * from "./types";

// Schedule (now from lib/schedule-service)
export {
  getCurrentHour,
  getCurrentTimeInfo,
  getOrCreateSchedule,
  getAllSchedules,
  updateScheduleHour,
  toggleSchedule,
  updateScheduleSettings,
  regenerateScheduledTimes,
  shouldAgentRun,
  getScheduleSummary,
  calculateDailyTotals,
  generateRandomTimes,
} from "@/lib/schedule-service";

// Agents - NEW ARCHITECTURE
export { runScraperAgent, type ScraperAgentInput, type ScraperAgentResult, type ScraperGroupResult, type ScraperPostResult } from "./scraper-agent";
export { runInitiatorAgent, type InitiatorAgentInput, type InitiatorAgentResult, type InitiatorLeadResult } from "./initiator-agent";
export { runMessageAgent, type MessageAgentInput } from "./message-agent";

// Legacy agents (kept for backwards compatibility)
export { runFirstTimeScraper, type FirstTimeScraperInput } from "./first-time-scraper";
export { runLeadGenAgent, type LeadGenInput, type LeadGenGroupResult, type LeadGenPostResult } from "./lead-gen-agent";

// Procedures (for advanced usage)
export * from "./procedures";
