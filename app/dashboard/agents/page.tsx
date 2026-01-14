"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Server,
  Wifi,
  WifiOff,
  AlertTriangle,
  Clock,
  RefreshCcw,
  PlayCircle,
  PauseCircle,
  Eye,
  Settings2,
  Activity,
  Bot,
  MessageSquare,
  Search,
  Calendar,
  FlaskConical,
  ChevronRight,
  Zap,
  Moon,
  Rocket,
  Lock,
  Send,
  Users,
  FileSearch,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

interface Agent {
  id: string;
  name: string;
  type: string;
  accountId: string | null;
  accountEmail: string | null;
  accountName: string | null;
  status: string;
  lastHeartbeat: string | null;
  dailyComments: number;
  dailyDms: number;
  dailyScrapes: number;
  dailyFriendRequests: number;
  totalPostsScraped: number;
  totalLeadsFound: number;
  totalCommentsMade: number;
  totalDMsSent: number;
  isHealthy: boolean;
  lastError: string | null;
  _count?: {
    assignedGroups: number;
    scrapedLeads: number;
  };
}

interface ScheduleConfig {
  timezone: string;
  leadGenAgent: {
    enabled: boolean;
    schedule: Record<string, { enabled: boolean; isPeak: boolean }>;
  };
  messageAgent: {
    enabled: boolean;
    schedule: Record<string, { enabled: boolean; isPeak: boolean }>;
  };
}

interface ScheduleStatus {
  shouldRun: boolean;
  isPeak: boolean;
  reason: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Wifi }> = {
  ONLINE: { label: "Online", variant: "default", icon: Wifi },
  OFFLINE: { label: "Offline", variant: "secondary", icon: WifiOff },
  SCRAPING: { label: "Scraping", variant: "default", icon: Activity },
  ENGAGING: { label: "Engaging", variant: "default", icon: Activity },
  COOLING_DOWN: { label: "Cooling Down", variant: "outline", icon: Clock },
  RATE_LIMITED: { label: "Rate Limited", variant: "destructive", icon: AlertTriangle },
  BANNED: { label: "Banned", variant: "destructive", icon: AlertTriangle },
  INITIALIZING: { label: "Initializing", variant: "outline", icon: Activity },
};

const agentTypeInfo: Record<string, { icon: typeof Search; title: string; description: string; color: string; bgColor: string }> = {
  // New 4-Agent Architecture
  GROUP_INIT: {
    icon: FileSearch,
    title: "Group Initializer",
    description: "Initialize groups by scraping 40-50 historical posts",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
  },
  SCRAPER: {
    icon: Search,
    title: "Scraper Agent",
    description: "Scrape new posts from groups, AI analysis, create leads",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  INITIATOR: {
    icon: Zap,
    title: "Initiator Agent",
    description: "Comment on posts + send DMs with AI-generated content",
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
  },
  MESSAGE: {
    icon: MessageSquare,
    title: "Message Agent",
    description: "Monitor Messenger, AI replies, manage conversations",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  // Legacy types (for backwards compatibility)
  FIRST_TIME_SCRAPER: {
    icon: FileSearch,
    title: "First-Time Scraper",
    description: "Initialize groups with historical posts",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
  },
  LEAD_GEN: {
    icon: Bot,
    title: "Lead Gen Agent",
    description: "Legacy: Scrape + analyze + engage",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  DM_ONLY: {
    icon: MessageSquare,
    title: "DM Only Agent",
    description: "Legacy: Only handles DMs",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<ScheduleConfig | null>(null);
  const [scheduleStatus, setScheduleStatus] = useState<{
    leadGenAgent: ScheduleStatus;
    messageAgent: ScheduleStatus;
  } | null>(null);
  const [currentHour, setCurrentHour] = useState<{ hour: string; isPeak: boolean; isNight: boolean } | null>(null);

  const fetchAgents = async () => {
    try {
      const res = await fetch("/api/agents");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setAgents(Array.isArray(data) ? data : []);
    } catch {
      // Silently handle - may not have agents yet
      setAgents([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedule = async () => {
    try {
      const res = await fetch("/api/agents/schedule");
      if (res.ok) {
        const data = await res.json();
        // Handle new database-based schedule format
        if (data.schedules) {
          setSchedule({
            timezone: data.schedules.leadGen?.timezone || "Africa/Tunis",
            leadGenAgent: {
              enabled: data.schedules.leadGen?.enabled || false,
              schedule: data.schedules.leadGen?.hours?.reduce((acc: Record<string, { enabled: boolean; isPeak: boolean }>, h: { hour: number; enabled: boolean; isPeak: boolean }) => {
                acc[h.hour.toString().padStart(2, "0")] = { enabled: h.enabled, isPeak: h.isPeak };
                return acc;
              }, {}) || {},
            },
            messageAgent: {
              enabled: data.schedules.messageAgent?.enabled || false,
              schedule: data.schedules.messageAgent?.hours?.reduce((acc: Record<string, { enabled: boolean; isPeak: boolean }>, h: { hour: number; enabled: boolean; isPeak: boolean }) => {
                acc[h.hour.toString().padStart(2, "0")] = { enabled: h.enabled, isPeak: h.isPeak };
                return acc;
              }, {}) || {},
            },
          });
          setScheduleStatus({
            leadGenAgent: data.status?.leadGen || { shouldRun: false, isPeak: false, reason: "" },
            messageAgent: data.status?.messageAgent || { shouldRun: false, isPeak: false, reason: "" },
          });
        }
        setCurrentHour(data.currentHour);
      }
    } catch {
      // Schedule API may not exist yet
    }
  };

  useEffect(() => {
    fetchAgents();
    fetchSchedule();
    const agentInterval = setInterval(fetchAgents, 10000);
    const scheduleInterval = setInterval(fetchSchedule, 60000);
    return () => {
      clearInterval(agentInterval);
      clearInterval(scheduleInterval);
    };
  }, []);

  const online = agents.filter((a) => a.status === "ONLINE" || a.status === "SCRAPING" || a.status === "ENGAGING");
  const hasIssues = agents.filter((a) => a.status === "RATE_LIMITED" || a.status === "BANNED" || !a.isHealthy);

  // Calculate daily limits progress
  const dailyLimits = {
    comments: { current: agents.reduce((sum, a) => sum + a.dailyComments, 0), max: 15 },
    dms: { current: agents.reduce((sum, a) => sum + a.dailyDms, 0), max: 8 },
    scrapes: { current: agents.reduce((sum, a) => sum + a.dailyScrapes, 0), max: 25 },
    friendRequests: { current: agents.reduce((sum, a) => sum + a.dailyFriendRequests, 0), max: 10 },
  };

  if (loading) {
    return (
      <TooltipProvider>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64 mt-2" />
            </div>
            <Skeleton className="h-10 w-28" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Server className="h-8 w-8 text-primary" />
              Agents
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage your automation agents and schedules
            </p>
          </div>
          <div className="flex items-center gap-3">
            {currentHour && (
              <Badge 
                variant={currentHour.isNight ? "secondary" : currentHour.isPeak ? "default" : "outline"}
                className="px-3 py-1"
              >
                {currentHour.isNight ? (
                  <Moon className="w-3 h-3 mr-1" />
                ) : currentHour.isPeak ? (
                  <Zap className="w-3 h-3 mr-1" />
                ) : (
                  <Clock className="w-3 h-3 mr-1" />
                )}
                {currentHour.hour}:00 TN
                {currentHour.isPeak && " • Peak"}
                {currentHour.isNight && " • Night"}
              </Badge>
            )}
            <Button variant="outline" size="icon" onClick={() => { fetchAgents(); fetchSchedule(); }}>
              <RefreshCcw className="h-4 w-4" />
            </Button>
            <Link href="/dashboard/agents/testing">
              <Button>
                <FlaskConical className="h-4 w-4 mr-2" />
                Test Agents
              </Button>
            </Link>
          </div>
        </div>

        {/* 4 Agent Types Overview - Matching Testing Page */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Group Initializer */}
          <Card className="relative overflow-hidden border-orange-500/20">
            <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full -mr-8 -mt-8" />
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className={`h-12 w-12 rounded-xl ${agentTypeInfo.GROUP_INIT.bgColor} flex items-center justify-center`}>
                  <FileSearch className={`h-6 w-6 ${agentTypeInfo.GROUP_INIT.color}`} />
                </div>
                <Badge variant="outline" className="text-orange-600 border-orange-500/50">Manual</Badge>
              </div>
              <CardTitle className="mt-3 text-base">🔄 Group Initializer</CardTitle>
              <CardDescription className="text-xs">
                Initialize groups with 40-50 historical posts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Run once per new group</p>
                <p>• Scrapes historical posts</p>
                <p>• Sets baseline for incremental</p>
              </div>
              <Link href="/dashboard/agents/testing">
                <Button variant="outline" className="w-full" size="sm">
                  <FlaskConical className="h-4 w-4 mr-2" />
                  Test Initializer
                  <ChevronRight className="h-4 w-4 ml-auto" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Scraper Agent */}
          <Card className="relative overflow-hidden border-blue-500/20">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-8 -mt-8" />
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className={`h-12 w-12 rounded-xl ${agentTypeInfo.SCRAPER.bgColor} flex items-center justify-center`}>
                  <Search className={`h-6 w-6 ${agentTypeInfo.SCRAPER.color}`} />
                </div>
                <Badge variant="outline" className="text-blue-600 border-blue-500/50">Manual</Badge>
              </div>
              <CardTitle className="mt-3 text-base">🔍 Scraper Agent</CardTitle>
              <CardDescription className="text-xs">
                Scrape new posts, AI analysis, create leads
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-muted rounded-lg text-center">
                  <p className="font-bold text-lg">{dailyLimits.scrapes.current}</p>
                  <p className="text-muted-foreground">Scrapes</p>
                </div>
                <div className="p-2 bg-muted rounded-lg text-center">
                  <p className="font-bold text-lg">{agents.reduce((sum, a) => sum + a.totalLeadsFound, 0)}</p>
                  <p className="text-muted-foreground">Leads</p>
                </div>
              </div>
              <Link href="/dashboard/agents/testing?tab=scraper">
                <Button variant="outline" className="w-full" size="sm">
                  <FlaskConical className="h-4 w-4 mr-2" />
                  Test Scraper
                  <ChevronRight className="h-4 w-4 ml-auto" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Initiator Agent */}
          <Card className="relative overflow-hidden border-yellow-500/20">
            <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/5 rounded-full -mr-8 -mt-8" />
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className={`h-12 w-12 rounded-xl ${agentTypeInfo.INITIATOR.bgColor} flex items-center justify-center`}>
                  <Zap className={`h-6 w-6 ${agentTypeInfo.INITIATOR.color}`} />
                </div>
                {scheduleStatus?.leadGenAgent && (
                  <Badge variant={scheduleStatus.leadGenAgent.shouldRun ? "default" : "secondary"} className="text-xs">
                    {scheduleStatus.leadGenAgent.shouldRun 
                      ? scheduleStatus.leadGenAgent.isPeak ? "⚡ Peak" : "Active" 
                      : "Paused"}
                  </Badge>
                )}
              </div>
              <CardTitle className="mt-3 text-base">⚡ Initiator Agent</CardTitle>
              <CardDescription className="text-xs">
                Comment on posts + send DMs to leads
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-muted rounded-lg text-center">
                  <p className="font-bold text-lg">{dailyLimits.comments.current}</p>
                  <p className="text-muted-foreground">Comments</p>
                </div>
                <div className="p-2 bg-muted rounded-lg text-center">
                  <p className="font-bold text-lg">{dailyLimits.dms.current}</p>
                  <p className="text-muted-foreground">DMs</p>
                </div>
              </div>
              <Link href="/dashboard/agents/testing?tab=initiator">
                <Button variant="outline" className="w-full" size="sm">
                  <FlaskConical className="h-4 w-4 mr-2" />
                  Test Initiator
                  <ChevronRight className="h-4 w-4 ml-auto" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Message Agent */}
          <Card className="relative overflow-hidden border-purple-500/20">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full -mr-8 -mt-8" />
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className={`h-12 w-12 rounded-xl ${agentTypeInfo.MESSAGE.bgColor} flex items-center justify-center`}>
                  <MessageSquare className={`h-6 w-6 ${agentTypeInfo.MESSAGE.color}`} />
                </div>
                {scheduleStatus?.messageAgent && (
                  <Badge variant={scheduleStatus.messageAgent.shouldRun ? "default" : "secondary"} className="text-xs">
                    {scheduleStatus.messageAgent.shouldRun 
                      ? scheduleStatus.messageAgent.isPeak ? "⚡ Peak" : "Active" 
                      : "Paused"}
                  </Badge>
                )}
              </div>
              <CardTitle className="mt-3 text-base">💬 Message Agent</CardTitle>
              <CardDescription className="text-xs">
                Monitor Messenger, AI replies, manage convos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-muted rounded-lg text-center">
                  <p className="font-bold text-lg">{agents.reduce((sum, a) => sum + a.totalDMsSent, 0)}</p>
                  <p className="text-muted-foreground">Replies</p>
                </div>
                <div className="p-2 bg-muted rounded-lg text-center">
                  <p className="font-bold text-lg">{dailyLimits.friendRequests.current}</p>
                  <p className="text-muted-foreground">Friend Req</p>
                </div>
              </div>
              <Link href="/dashboard/agents/testing?tab=message">
                <Button variant="outline" className="w-full" size="sm">
                  <FlaskConical className="h-4 w-4 mr-2" />
                  Test Message
                  <ChevronRight className="h-4 w-4 ml-auto" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Workflow Overview */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Rocket className="h-5 w-5 text-primary" />
              Agent Workflow
            </CardTitle>
            <CardDescription>How the 4 agents work together</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center gap-2 flex-wrap text-sm py-4">
              <div className="flex items-center gap-2 p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                <FileSearch className="w-5 h-5 text-orange-500" />
                <div>
                  <p className="font-medium text-orange-600">1. Initializer</p>
                  <p className="text-xs text-muted-foreground">Setup groups</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
              <div className="flex items-center gap-2 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <Search className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="font-medium text-blue-600">2. Scraper</p>
                  <p className="text-xs text-muted-foreground">Find leads</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
              <div className="flex items-center gap-2 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                <Zap className="w-5 h-5 text-yellow-500" />
                <div>
                  <p className="font-medium text-yellow-600">3. Initiator</p>
                  <p className="text-xs text-muted-foreground">Comment + DM</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
              <div className="flex items-center gap-2 p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                <MessageSquare className="w-5 h-5 text-purple-500" />
                <div>
                  <p className="font-medium text-purple-600">4. Message</p>
                  <p className="text-xs text-muted-foreground">AI replies</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Schedule Overview */}
        {schedule && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-lg">Hourly Schedule</CardTitle>
                    <CardDescription>Tunisia Time ({schedule.timezone})</CardDescription>
                  </div>
                </div>
                <Link href="/dashboard/agents/testing?tab=schedule">
                  <Button variant="outline" size="sm">
                    <Settings2 className="h-4 w-4 mr-2" />
                    Edit Schedule
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Lead Gen Schedule */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Bot className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">Lead Gen Agent</span>
                  </div>
                  <div className="flex gap-1">
                    {Object.entries(schedule.leadGenAgent.schedule).map(([hour, config]) => (
                      <Tooltip key={hour}>
                        <TooltipTrigger asChild>
                          <div
                            className={`flex-1 h-6 rounded text-center text-xs flex items-center justify-center cursor-default transition-colors ${
                              config.enabled
                                ? config.isPeak
                                  ? "bg-orange-500 text-white"
                                  : "bg-green-500 text-white"
                                : "bg-muted text-muted-foreground"
                            } ${currentHour?.hour === hour ? "ring-2 ring-primary ring-offset-1" : ""}`}
                          >
                            {parseInt(hour) % 2 === 0 ? hour : ""}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {hour}:00 - {config.enabled ? (config.isPeak ? "Peak Hour" : "Active") : "Disabled"}
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </div>

                {/* Message Agent Schedule */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="h-4 w-4 text-purple-500" />
                    <span className="text-sm font-medium">Message Agent</span>
                  </div>
                  <div className="flex gap-1">
                    {Object.entries(schedule.messageAgent.schedule).map(([hour, config]) => (
                      <Tooltip key={hour}>
                        <TooltipTrigger asChild>
                          <div
                            className={`flex-1 h-6 rounded text-center text-xs flex items-center justify-center cursor-default transition-colors ${
                              config.enabled
                                ? config.isPeak
                                  ? "bg-orange-500 text-white"
                                  : "bg-purple-500 text-white"
                                : "bg-muted text-muted-foreground"
                            } ${currentHour?.hour === hour ? "ring-2 ring-primary ring-offset-1" : ""}`}
                          >
                            {parseInt(hour) % 2 === 0 ? hour : ""}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {hour}:00 - {config.enabled ? (config.isPeak ? "Peak Hour" : "Active") : "Disabled"}
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-6 text-xs text-muted-foreground pt-2">
                  <span className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-green-500 rounded" /> Active
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-orange-500 rounded" /> Peak (2x)
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-muted rounded" /> Disabled
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-3 h-3 ring-2 ring-primary rounded" /> Current Hour
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Daily Limits */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Daily Limits
            </CardTitle>
            <CardDescription>Usage resets at midnight Tunisia time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Group Scrapes</span>
                  <span className="font-medium">{dailyLimits.scrapes.current} / {dailyLimits.scrapes.max}</span>
                </div>
                <Progress value={(dailyLimits.scrapes.current / dailyLimits.scrapes.max) * 100} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Comments</span>
                  <span className="font-medium">{dailyLimits.comments.current} / {dailyLimits.comments.max}</span>
                </div>
                <Progress value={(dailyLimits.comments.current / dailyLimits.comments.max) * 100} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Friend Requests</span>
                  <span className="font-medium">{dailyLimits.friendRequests.current} / {dailyLimits.friendRequests.max}</span>
                </div>
                <Progress value={(dailyLimits.friendRequests.current / dailyLimits.friendRequests.max) * 100} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Direct Messages</span>
                  <span className="font-medium">{dailyLimits.dms.current} / {dailyLimits.dms.max}</span>
                </div>
                <Progress value={(dailyLimits.dms.current / dailyLimits.dms.max) * 100} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Agents List (if any exist) */}
        {agents.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Active Agent Instances</CardTitle>
                <Badge variant="outline">{agents.length} agents</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {agents.map((agent) => {
                  const typeInfo = agentTypeInfo[agent.type as keyof typeof agentTypeInfo] || agentTypeInfo.LEAD_GEN;
                  const status = statusConfig[agent.status] || statusConfig.OFFLINE;
                  const StatusIcon = status.icon;
                  const TypeIcon = typeInfo.icon;

                  return (
                    <Card key={agent.id} className="bg-muted/30">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`h-10 w-10 rounded-lg ${typeInfo.bgColor} flex items-center justify-center`}>
                              <TypeIcon className={`h-5 w-5 ${typeInfo.color}`} />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{agent.name || typeInfo.title}</p>
                              <p className="text-xs text-muted-foreground">{agent.accountName || agent.accountEmail}</p>
                            </div>
                          </div>
                          <Badge variant={status.variant} className="text-xs">
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {status.label}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="p-2 bg-background rounded">
                            <p className="font-bold">{agent.totalPostsScraped}</p>
                            <p className="text-muted-foreground">Posts</p>
                          </div>
                          <div className="p-2 bg-background rounded">
                            <p className="font-bold">{agent.totalLeadsFound}</p>
                            <p className="text-muted-foreground">Leads</p>
                          </div>
                          <div className="p-2 bg-background rounded">
                            <p className="font-bold">{agent.totalDMsSent}</p>
                            <p className="text-muted-foreground">DMs</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
}
