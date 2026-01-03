// API Route: Schedule Management (Database-based)
// GET /api/agents/schedule - Get all schedules
// PATCH /api/agents/schedule - Update schedule

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ScheduleAgentType } from "@prisma/client";
import {
  getAllSchedules,
  getOrCreateSchedule,
  updateScheduleHour,
  toggleSchedule,
  updateScheduleSettings,
  regenerateScheduledTimes,
  shouldAgentRun,
  getCurrentTimeInfo,
  getScheduleSummary,
  calculateDailyTotals,
} from "@/lib/schedule-service";

// GET - Get all schedules with status
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { leadGen, messageAgent } = await getAllSchedules();
    const currentTime = getCurrentTimeInfo(leadGen.timezone);
    
    const leadGenStatus = await shouldAgentRun("LEAD_GEN");
    const messageAgentStatus = await shouldAgentRun("MESSAGE_AGENT");

    const leadGenSummary = getScheduleSummary(leadGen.hours);
    const messageAgentSummary = getScheduleSummary(messageAgent.hours);

    const leadGenTotals = calculateDailyTotals(leadGen.hours);
    const messageAgentTotals = calculateDailyTotals(messageAgent.hours);

    return NextResponse.json({
      currentHour: currentTime,
      schedules: {
        leadGen: {
          ...leadGen,
          summary: leadGenSummary,
          dailyTotals: leadGenTotals,
          hourConfig: {
            peakScrapes: leadGen.peakScrapes,
            peakComments: leadGen.peakComments,
            normalScrapes: leadGen.normalScrapes,
            normalComments: leadGen.normalComments,
          },
        },
        messageAgent: {
          ...messageAgent,
          summary: messageAgentSummary,
          dailyTotals: messageAgentTotals,
          hourConfig: {
            peakDMs: messageAgent.peakDMs,
            peakFriendRequests: messageAgent.peakFriendRequests,
            normalDMs: messageAgent.normalDMs,
            normalFriendRequests: messageAgent.normalFriendRequests,
          },
        },
      },
      status: {
        leadGen: leadGenStatus,
        messageAgent: messageAgentStatus,
      },
    });
  } catch (error) {
    console.error("[Schedule] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// PATCH - Update schedule
export async function PATCH(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const agentType: ScheduleAgentType = body.agentType === "leadGen" || body.agentType === "LEAD_GEN" 
      ? "LEAD_GEN" 
      : "MESSAGE_AGENT";

    // Option 1: Toggle entire agent
    if (body.action === "toggle") {
      const result = await toggleSchedule(agentType, body.enabled);
      return NextResponse.json({
        success: true,
        message: `${agentType} ${body.enabled ? "enabled" : "disabled"}`,
        schedule: result,
      });
    }

    // Option 2: Update single hour
    if (body.action === "updateHour" && body.hour !== undefined) {
      const result = await updateScheduleHour(agentType, body.hour, {
        enabled: body.enabled,
        isPeak: body.isPeak,
        scrapes: body.scrapes,
        comments: body.comments,
        dms: body.dms,
        friendRequests: body.friendRequests,
      });
      return NextResponse.json({
        success: true,
        message: `Hour ${body.hour} updated`,
        hour: result,
      });
    }

    // Option 3: Update schedule settings (limits, randomization)
    if (body.action === "updateSettings") {
      const result = await updateScheduleSettings(agentType, {
        maxScrapesPerDay: body.maxScrapesPerDay,
        maxCommentsPerDay: body.maxCommentsPerDay,
        maxDMsPerDay: body.maxDMsPerDay,
        maxFriendRequestsPerDay: body.maxFriendRequestsPerDay,
        randomizationEnabled: body.randomizationEnabled,
        minDelayMinutes: body.minDelayMinutes,
        maxDelayMinutes: body.maxDelayMinutes,
        jitterPercent: body.jitterPercent,
      });
      return NextResponse.json({
        success: true,
        message: "Settings updated",
        schedule: result,
      });
    }

    // Option 4: Update hour config (peak vs normal limits)
    if (body.action === "updateHourConfig") {
      const result = await updateScheduleSettings(agentType, {
        peakScrapes: body.hourConfig?.peakScrapes,
        peakComments: body.hourConfig?.peakComments,
        normalScrapes: body.hourConfig?.normalScrapes,
        normalComments: body.hourConfig?.normalComments,
        peakDMs: body.hourConfig?.peakDMs,
        peakFriendRequests: body.hourConfig?.peakFriendRequests,
        normalDMs: body.hourConfig?.normalDMs,
        normalFriendRequests: body.hourConfig?.normalFriendRequests,
      });
      return NextResponse.json({
        success: true,
        message: "Hour config updated",
        schedule: result,
      });
    }

    // Option 5: Regenerate randomized times
    if (body.action === "regenerateTimes") {
      const result = await regenerateScheduledTimes(agentType);
      return NextResponse.json({
        success: true,
        message: "Scheduled times regenerated",
        schedule: result,
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Use: toggle, updateHour, updateSettings, or regenerateTimes" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[Schedule] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
