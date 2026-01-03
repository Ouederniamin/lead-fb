// Schedule Service - Database-based schedule management
// Manages hourly schedules for Lead Gen and Message agents

import { prisma } from "@/lib/db";
import { ScheduleAgentType, ScheduleHour } from "@prisma/client";

// Default schedule configuration
const DEFAULT_LEAD_GEN_SCHEDULE = {
  description: "Scrapes posts, analyzes with AI, creates leads, posts comments",
  timezone: "Africa/Tunis",
  maxScrapesPerDay: 25,
  maxCommentsPerDay: 15,
  maxDMsPerDay: 8,
  maxFriendRequestsPerDay: 10,
  randomizationEnabled: true,
  minDelayMinutes: 5,
  maxDelayMinutes: 45,
  jitterPercent: 30,
  hours: [
    { hour: 0, enabled: false, isPeak: false, scrapes: 0, comments: 0, dms: 0, friendRequests: 0 },
    { hour: 1, enabled: false, isPeak: false, scrapes: 0, comments: 0, dms: 0, friendRequests: 0 },
    { hour: 2, enabled: false, isPeak: false, scrapes: 0, comments: 0, dms: 0, friendRequests: 0 },
    { hour: 3, enabled: false, isPeak: false, scrapes: 0, comments: 0, dms: 0, friendRequests: 0 },
    { hour: 4, enabled: false, isPeak: false, scrapes: 0, comments: 0, dms: 0, friendRequests: 0 },
    { hour: 5, enabled: false, isPeak: false, scrapes: 0, comments: 0, dms: 0, friendRequests: 0 },
    { hour: 6, enabled: false, isPeak: false, scrapes: 0, comments: 0, dms: 0, friendRequests: 0 },
    { hour: 7, enabled: false, isPeak: false, scrapes: 0, comments: 0, dms: 0, friendRequests: 0 },
    { hour: 8, enabled: true, isPeak: false, scrapes: 1, comments: 1, dms: 0, friendRequests: 0 },
    { hour: 9, enabled: true, isPeak: false, scrapes: 1, comments: 1, dms: 0, friendRequests: 0 },
    { hour: 10, enabled: true, isPeak: false, scrapes: 2, comments: 1, dms: 0, friendRequests: 0 },
    { hour: 11, enabled: true, isPeak: false, scrapes: 2, comments: 1, dms: 0, friendRequests: 0 },
    { hour: 12, enabled: true, isPeak: true, scrapes: 2, comments: 2, dms: 0, friendRequests: 0 },
    { hour: 13, enabled: true, isPeak: true, scrapes: 2, comments: 2, dms: 0, friendRequests: 0 },
    { hour: 14, enabled: true, isPeak: false, scrapes: 2, comments: 1, dms: 0, friendRequests: 0 },
    { hour: 15, enabled: true, isPeak: false, scrapes: 1, comments: 1, dms: 0, friendRequests: 0 },
    { hour: 16, enabled: true, isPeak: false, scrapes: 1, comments: 1, dms: 0, friendRequests: 0 },
    { hour: 17, enabled: true, isPeak: false, scrapes: 1, comments: 1, dms: 0, friendRequests: 0 },
    { hour: 18, enabled: true, isPeak: false, scrapes: 2, comments: 1, dms: 0, friendRequests: 0 },
    { hour: 19, enabled: true, isPeak: true, scrapes: 2, comments: 2, dms: 0, friendRequests: 0 },
    { hour: 20, enabled: true, isPeak: true, scrapes: 2, comments: 2, dms: 0, friendRequests: 0 },
    { hour: 21, enabled: true, isPeak: true, scrapes: 2, comments: 1, dms: 0, friendRequests: 0 },
    { hour: 22, enabled: true, isPeak: true, scrapes: 2, comments: 1, dms: 0, friendRequests: 0 },
    { hour: 23, enabled: true, isPeak: false, scrapes: 1, comments: 0, dms: 0, friendRequests: 0 },
  ],
};

const DEFAULT_MESSAGE_AGENT_SCHEDULE = {
  description: "Monitors inbox, sends AI replies, collects contact info",
  timezone: "Africa/Tunis",
  maxScrapesPerDay: 0,
  maxCommentsPerDay: 0,
  maxDMsPerDay: 8,
  maxFriendRequestsPerDay: 10,
  randomizationEnabled: true,
  minDelayMinutes: 5,
  maxDelayMinutes: 45,
  jitterPercent: 30,
  hours: [
    { hour: 0, enabled: false, isPeak: false, scrapes: 0, comments: 0, dms: 0, friendRequests: 0 },
    { hour: 1, enabled: false, isPeak: false, scrapes: 0, comments: 0, dms: 0, friendRequests: 0 },
    { hour: 2, enabled: false, isPeak: false, scrapes: 0, comments: 0, dms: 0, friendRequests: 0 },
    { hour: 3, enabled: false, isPeak: false, scrapes: 0, comments: 0, dms: 0, friendRequests: 0 },
    { hour: 4, enabled: false, isPeak: false, scrapes: 0, comments: 0, dms: 0, friendRequests: 0 },
    { hour: 5, enabled: false, isPeak: false, scrapes: 0, comments: 0, dms: 0, friendRequests: 0 },
    { hour: 6, enabled: false, isPeak: false, scrapes: 0, comments: 0, dms: 0, friendRequests: 0 },
    { hour: 7, enabled: false, isPeak: false, scrapes: 0, comments: 0, dms: 0, friendRequests: 0 },
    { hour: 8, enabled: true, isPeak: false, scrapes: 0, comments: 0, dms: 0, friendRequests: 1 },
    { hour: 9, enabled: true, isPeak: false, scrapes: 0, comments: 0, dms: 1, friendRequests: 0 },
    { hour: 10, enabled: true, isPeak: false, scrapes: 0, comments: 0, dms: 0, friendRequests: 1 },
    { hour: 11, enabled: true, isPeak: false, scrapes: 0, comments: 0, dms: 1, friendRequests: 0 },
    { hour: 12, enabled: true, isPeak: true, scrapes: 0, comments: 0, dms: 1, friendRequests: 1 },
    { hour: 13, enabled: true, isPeak: true, scrapes: 0, comments: 0, dms: 1, friendRequests: 1 },
    { hour: 14, enabled: true, isPeak: false, scrapes: 0, comments: 0, dms: 0, friendRequests: 1 },
    { hour: 15, enabled: true, isPeak: false, scrapes: 0, comments: 0, dms: 1, friendRequests: 0 },
    { hour: 16, enabled: true, isPeak: false, scrapes: 0, comments: 0, dms: 0, friendRequests: 1 },
    { hour: 17, enabled: true, isPeak: false, scrapes: 0, comments: 0, dms: 0, friendRequests: 0 },
    { hour: 18, enabled: true, isPeak: false, scrapes: 0, comments: 0, dms: 1, friendRequests: 1 },
    { hour: 19, enabled: true, isPeak: true, scrapes: 0, comments: 0, dms: 1, friendRequests: 1 },
    { hour: 20, enabled: true, isPeak: true, scrapes: 0, comments: 0, dms: 1, friendRequests: 1 },
    { hour: 21, enabled: true, isPeak: true, scrapes: 0, comments: 0, dms: 0, friendRequests: 1 },
    { hour: 22, enabled: true, isPeak: true, scrapes: 0, comments: 0, dms: 0, friendRequests: 0 },
    { hour: 23, enabled: true, isPeak: false, scrapes: 0, comments: 0, dms: 0, friendRequests: 0 },
  ],
};

// Get current hour in timezone
export function getCurrentHour(timezone: string = "Africa/Tunis"): number {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  });
  return parseInt(formatter.format(now));
}

// Get current time info
export function getCurrentTimeInfo(timezone: string = "Africa/Tunis") {
  const now = new Date();
  const hour = getCurrentHour(timezone);
  const isNight = hour >= 0 && hour < 8;
  
  return {
    hour: hour.toString().padStart(2, "0"),
    isPeak: [12, 13, 19, 20, 21, 22].includes(hour),
    isNight,
    timezone,
  };
}

// Generate random execution times within an hour
export function generateRandomTimes(
  hour: number,
  count: number,
  minDelay: number = 5,
  maxDelay: number = 45,
  jitterPercent: number = 30
): string[] {
  if (count <= 0) return [];
  
  const times: string[] = [];
  const hourStr = hour.toString().padStart(2, "0");
  
  // Divide the hour into segments
  const segmentSize = Math.floor(60 / count);
  
  for (let i = 0; i < count; i++) {
    // Base minute for this segment
    const segmentStart = i * segmentSize;
    const segmentEnd = Math.min(segmentStart + segmentSize - 1, 59);
    
    // Add jitter
    const jitter = Math.floor((segmentEnd - segmentStart) * (jitterPercent / 100));
    const minMinute = Math.max(segmentStart + minDelay, segmentStart);
    const maxMinute = Math.min(segmentEnd - jitter, 59);
    
    // Random minute within the segment
    const minute = Math.floor(Math.random() * (maxMinute - minMinute + 1)) + minMinute;
    times.push(`${hourStr}:${minute.toString().padStart(2, "0")}`);
  }
  
  return times.sort();
}

// Initialize or get schedule for an agent type
export async function getOrCreateSchedule(agentType: ScheduleAgentType) {
  let schedule = await prisma.agentSchedule.findUnique({
    where: { agentType },
    include: { hours: { orderBy: { hour: "asc" } } },
  });

  if (!schedule) {
    const defaults = agentType === "LEAD_GEN" 
      ? DEFAULT_LEAD_GEN_SCHEDULE 
      : DEFAULT_MESSAGE_AGENT_SCHEDULE;

    schedule = await prisma.agentSchedule.create({
      data: {
        agentType,
        enabled: true,
        description: defaults.description,
        timezone: defaults.timezone,
        maxScrapesPerDay: defaults.maxScrapesPerDay,
        maxCommentsPerDay: defaults.maxCommentsPerDay,
        maxDMsPerDay: defaults.maxDMsPerDay,
        maxFriendRequestsPerDay: defaults.maxFriendRequestsPerDay,
        randomizationEnabled: defaults.randomizationEnabled,
        minDelayMinutes: defaults.minDelayMinutes,
        maxDelayMinutes: defaults.maxDelayMinutes,
        jitterPercent: defaults.jitterPercent,
        hours: {
          create: defaults.hours.map((h) => ({
            hour: h.hour,
            enabled: h.enabled,
            isPeak: h.isPeak,
            scrapes: h.scrapes,
            comments: h.comments,
            dms: h.dms,
            friendRequests: h.friendRequests,
            scheduledTimes: [],
          })),
        },
      },
      include: { hours: { orderBy: { hour: "asc" } } },
    });
  }

  return schedule;
}

// Get both schedules
export async function getAllSchedules() {
  const [leadGen, messageAgent] = await Promise.all([
    getOrCreateSchedule("LEAD_GEN"),
    getOrCreateSchedule("MESSAGE_AGENT"),
  ]);

  return { leadGen, messageAgent };
}

// Update a specific hour's configuration
export async function updateScheduleHour(
  agentType: ScheduleAgentType,
  hour: number,
  updates: {
    enabled?: boolean;
    isPeak?: boolean;
    scrapes?: number;
    comments?: number;
    dms?: number;
    friendRequests?: number;
  }
) {
  const schedule = await getOrCreateSchedule(agentType);
  
  const hourRecord = schedule.hours.find((h) => h.hour === hour);
  if (!hourRecord) {
    throw new Error(`Hour ${hour} not found in schedule`);
  }

  return prisma.scheduleHour.update({
    where: { id: hourRecord.id },
    data: updates,
  });
}

// Toggle agent enabled/disabled
export async function toggleSchedule(agentType: ScheduleAgentType, enabled: boolean) {
  const schedule = await getOrCreateSchedule(agentType);
  
  return prisma.agentSchedule.update({
    where: { id: schedule.id },
    data: { enabled },
  });
}

// Update schedule settings
export async function updateScheduleSettings(
  agentType: ScheduleAgentType,
  updates: {
    maxScrapesPerDay?: number;
    maxCommentsPerDay?: number;
    maxDMsPerDay?: number;
    maxFriendRequestsPerDay?: number;
    randomizationEnabled?: boolean;
    minDelayMinutes?: number;
    maxDelayMinutes?: number;
    jitterPercent?: number;
    // Hour config (peak vs normal limits)
    peakScrapes?: number;
    peakComments?: number;
    normalScrapes?: number;
    normalComments?: number;
    peakDMs?: number;
    peakFriendRequests?: number;
    normalDMs?: number;
    normalFriendRequests?: number;
  }
) {
  const schedule = await getOrCreateSchedule(agentType);
  
  // Filter out undefined values
  const filteredUpdates = Object.fromEntries(
    Object.entries(updates).filter(([, v]) => v !== undefined)
  );
  
  return prisma.agentSchedule.update({
    where: { id: schedule.id },
    data: filteredUpdates,
    include: { hours: { orderBy: { hour: "asc" } } },
  });
}

// Generate randomized times for all hours in a schedule
export async function regenerateScheduledTimes(agentType: ScheduleAgentType) {
  const schedule = await getOrCreateSchedule(agentType);
  
  const updates = schedule.hours.map(async (hourConfig) => {
    if (!hourConfig.enabled) {
      return prisma.scheduleHour.update({
        where: { id: hourConfig.id },
        data: { scheduledTimes: [], lastGenerated: new Date() },
      });
    }

    // Calculate total actions for this hour
    const totalActions = hourConfig.scrapes + hourConfig.comments + hourConfig.dms + hourConfig.friendRequests;
    
    const times = generateRandomTimes(
      hourConfig.hour,
      totalActions,
      schedule.minDelayMinutes,
      schedule.maxDelayMinutes,
      schedule.jitterPercent
    );

    return prisma.scheduleHour.update({
      where: { id: hourConfig.id },
      data: { scheduledTimes: times, lastGenerated: new Date() },
    });
  });

  await Promise.all(updates);
  
  return getOrCreateSchedule(agentType);
}

// Check if agent should run now
export async function shouldAgentRun(agentType: ScheduleAgentType): Promise<{
  shouldRun: boolean;
  isPeak: boolean;
  reason: string;
  currentHour: number;
  hourConfig: {
    enabled: boolean;
    isPeak: boolean;
    scrapes: number;
    comments: number;
    dms: number;
    friendRequests: number;
    scheduledTimes: string[];
  } | null;
}> {
  const schedule = await getOrCreateSchedule(agentType);
  const currentHour = getCurrentHour(schedule.timezone);
  const hourConfig = schedule.hours.find((h) => h.hour === currentHour);

  if (!schedule.enabled) {
    return {
      shouldRun: false,
      isPeak: false,
      reason: `${agentType} is globally disabled`,
      currentHour,
      hourConfig: null,
    };
  }

  if (!hourConfig || !hourConfig.enabled) {
    return {
      shouldRun: false,
      isPeak: false,
      reason: `Hour ${currentHour} is disabled`,
      currentHour,
      hourConfig: null,
    };
  }

  return {
    shouldRun: true,
    isPeak: hourConfig.isPeak,
    reason: hourConfig.isPeak ? "Peak hour - increased activity" : "Normal operating hour",
    currentHour,
    hourConfig: {
      enabled: hourConfig.enabled,
      isPeak: hourConfig.isPeak,
      scrapes: hourConfig.scrapes,
      comments: hourConfig.comments,
      dms: hourConfig.dms,
      friendRequests: hourConfig.friendRequests,
      scheduledTimes: hourConfig.scheduledTimes,
    },
  };
}

// Get schedule summary
export function getScheduleSummary(hours: { enabled: boolean; isPeak: boolean }[]) {
  const enabledHours = hours.filter((h) => h.enabled).length;
  const peakHours = hours.filter((h) => h.isPeak).length;
  const nightHours = hours.slice(0, 8).filter((h) => !h.enabled).length;

  return {
    totalHours: 24,
    enabledHours,
    peakHours,
    nightHours,
    activeRange: enabledHours > 0 
      ? `${hours.findIndex((h) => h.enabled)}:00 - ${23 - [...hours].reverse().findIndex((h) => h.enabled)}:00`
      : "None",
  };
}

// Calculate daily totals from schedule
export function calculateDailyTotals(hours: { scrapes: number; comments: number; dms: number; friendRequests: number; enabled: boolean }[]) {
  return hours.reduce(
    (acc, h) => {
      if (!h.enabled) return acc;
      return {
        scrapes: acc.scrapes + h.scrapes,
        comments: acc.comments + h.comments,
        dms: acc.dms + h.dms,
        friendRequests: acc.friendRequests + h.friendRequests,
      };
    },
    { scrapes: 0, comments: 0, dms: 0, friendRequests: 0 }
  );
}
