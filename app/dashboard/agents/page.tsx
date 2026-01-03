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
  // New 3-Agent Architecture
  SCRAPER: {
    icon: Search,
    title: "Scraper Agent",
    description: "Scrapes ALL groups, AI analysis, creates Leads",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  INITIATOR: {
    icon: Zap,
    title: "Initiator Agent",
    description: "Comments on posts, sends initial DMs",
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
  },
  MESSAGE: {
    icon: MessageSquare,
    title: "Message Agent",
    description: "Monitor inbox, AI replies with lead context",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  // Legacy types
  FIRST_TIME_SCRAPER: {
    icon: Search,
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

        {/* 3 Agent Types Overview */}
        <div className="grid md:grid-cols-3 gap-4">
          {/* First-Time Scraper */}
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-8 -mt-8" />
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className={`h-12 w-12 rounded-xl ${agentTypeInfo.FIRST_TIME_SCRAPER.bgColor} flex items-center justify-center`}>
                  <Search className={`h-6 w-6 ${agentTypeInfo.FIRST_TIME_SCRAPER.color}`} />
                </div>
                <Badge variant="outline">Manual</Badge>
              </div>
              <CardTitle className="mt-3">🔄 First-Time Scraper</CardTitle>
              <CardDescription>
                Initialize groups by scraping 40-50 historical posts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-muted-foreground">
                <p>• Triggered manually per group</p>
                <p>• Sets baseline for incremental scraping</p>
                <p>• Run once per new group</p>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Procedures</span>
                <span className="font-mono text-xs">P1 → P2 → P5 → P6</span>
              </div>
              <Link href="/dashboard/agents/testing">
                <Button variant="outline" className="w-full" size="sm">
                  <FlaskConical className="h-4 w-4 mr-2" />
                  Test Scraper
                  <ChevronRight className="h-4 w-4 ml-auto" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Lead Gen Agent */}
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-full -mr-8 -mt-8" />
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className={`h-12 w-12 rounded-xl ${agentTypeInfo.LEAD_GEN.bgColor} flex items-center justify-center`}>
                  <Bot className={`h-6 w-6 ${agentTypeInfo.LEAD_GEN.color}`} />
                </div>
                {scheduleStatus?.leadGenAgent && (
                  <Badge variant={scheduleStatus.leadGenAgent.shouldRun ? "default" : "secondary"}>
                    {scheduleStatus.leadGenAgent.shouldRun 
                      ? scheduleStatus.leadGenAgent.isPeak ? "⚡ Peak" : "Active" 
                      : "Paused"}
                  </Badge>
                )}
              </div>
              <CardTitle className="mt-3">🎯 Lead Gen Agent</CardTitle>
              <CardDescription>
                Scrape posts, AI analysis, create leads, engage
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="p-2 bg-muted rounded-lg text-center">
                  <p className="font-bold text-lg">{dailyLimits.scrapes.current}</p>
                  <p className="text-xs text-muted-foreground">Scrapes Today</p>
                </div>
                <div className="p-2 bg-muted rounded-lg text-center">
                  <p className="font-bold text-lg">{dailyLimits.comments.current}</p>
                  <p className="text-xs text-muted-foreground">Comments</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Schedule</span>
                <span className="text-xs">22 runs/day (08-23h)</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Link href="/dashboard/agents/schedule/lead-gen">
                  <Button variant="outline" className="w-full" size="sm">
                    <Calendar className="h-4 w-4 mr-2" />
                    Schedule
                  </Button>
                </Link>
                <Link href="/dashboard/agents/testing?tab=lead-gen">
                  <Button variant="outline" className="w-full" size="sm">
                    <FlaskConical className="h-4 w-4 mr-2" />
                    Test
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Message Agent */}
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full -mr-8 -mt-8" />
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className={`h-12 w-12 rounded-xl ${agentTypeInfo.DM_ONLY.bgColor} flex items-center justify-center`}>
                  <MessageSquare className={`h-6 w-6 ${agentTypeInfo.DM_ONLY.color}`} />
                </div>
                {scheduleStatus?.messageAgent && (
                  <Badge variant={scheduleStatus.messageAgent.shouldRun ? "default" : "secondary"}>
                    {scheduleStatus.messageAgent.shouldRun 
                      ? scheduleStatus.messageAgent.isPeak ? "⚡ Peak" : "Active" 
                      : "Paused"}
                  </Badge>
                )}
              </div>
              <CardTitle className="mt-3">💬 Message Agent</CardTitle>
              <CardDescription>
                Monitor Messenger, AI replies, collect contacts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="p-2 bg-muted rounded-lg text-center">
                  <p className="font-bold text-lg">{dailyLimits.dms.current}</p>
                  <p className="text-xs text-muted-foreground">DMs Today</p>
                </div>
                <div className="p-2 bg-muted rounded-lg text-center">
                  <p className="font-bold text-lg">{dailyLimits.friendRequests.current}</p>
                  <p className="text-xs text-muted-foreground">Friend Req</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Schedule</span>
                <span className="text-xs">22 runs/day (08-23h)</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Link href="/dashboard/agents/schedule/message-agent">
                  <Button variant="outline" className="w-full" size="sm">
                    <Calendar className="h-4 w-4 mr-2" />
                    Schedule
                  </Button>
                </Link>
                <Link href="/dashboard/agents/testing?tab=message">
                  <Button variant="outline" className="w-full" size="sm">
                    <FlaskConical className="h-4 w-4 mr-2" />
                    Test
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

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
