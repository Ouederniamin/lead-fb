"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  MessageSquare,
  ArrowLeft,
  RefreshCcw,
  Save,
  Shuffle,
  Clock,
  Zap,
  Moon,
  Sun,
  Settings2,
  UserPlus,
  Mail,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

interface ScheduleHour {
  id: string;
  hour: number;
  enabled: boolean;
  isPeak: boolean;
  scheduledTimes: string[];
}

interface HourConfig {
  peakDMs: number;
  peakFriendRequests: number;
  normalDMs: number;
  normalFriendRequests: number;
}

interface AgentSchedule {
  id: string;
  enabled: boolean;
  timezone: string;
  maxDMsPerDay: number;
  maxFriendRequestsPerDay: number;
  randomizationEnabled: boolean;
  hours: ScheduleHour[];
  hourConfig: HourConfig;
}

export default function MessageAgentSchedulePage() {
  const [schedule, setSchedule] = useState<AgentSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [currentHour, setCurrentHour] = useState<{ hour: number; isPeak: boolean; isNight: boolean } | null>(null);

  // Hour configuration (peak vs normal limits)
  const [hourConfig, setHourConfig] = useState<HourConfig>({
    peakDMs: 3,
    peakFriendRequests: 2,
    normalDMs: 1,
    normalFriendRequests: 1,
  });

  const fetchSchedule = useCallback(async () => {
    try {
      const res = await fetch("/api/agents/schedule");
      if (!res.ok) throw new Error("Failed to fetch schedule");
      const data = await res.json();
      
      const messageSchedule = data.schedules.messageAgent;
      setSchedule(messageSchedule);
      
      // Load hour config from the schedule or use defaults
      if (messageSchedule.hourConfig) {
        setHourConfig(messageSchedule.hourConfig);
      }
      
      // Set current hour info
      const now = new Date();
      const hour = parseInt(new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: "Africa/Tunis",
      }).format(now));
      
      const currentHourData = messageSchedule.hours.find((h: ScheduleHour) => h.hour === hour);
      setCurrentHour({
        hour,
        isPeak: currentHourData?.isPeak || false,
        isNight: hour >= 22 || hour < 6,
      });
    } catch {
      toast.error("Failed to load schedule");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const toggleAgent = async () => {
    if (!schedule) return;
    try {
      const res = await fetch("/api/agents/schedule", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle",
          agentType: "MESSAGE_AGENT",
          enabled: !schedule.enabled,
        }),
      });
      if (!res.ok) throw new Error("Failed to toggle agent");
      setSchedule({ ...schedule, enabled: !schedule.enabled });
      toast.success(`Message Agent ${!schedule.enabled ? "enabled" : "disabled"}`);
    } catch {
      toast.error("Failed to toggle agent");
    }
  };

  const updateHour = (hour: number, updates: Partial<ScheduleHour>) => {
    if (!schedule) return;
    setSchedule({
      ...schedule,
      hours: schedule.hours.map((h) =>
        h.hour === hour ? { ...h, ...updates } : h
      ),
    });
    setHasChanges(true);
  };

  const updateHourConfig = (field: keyof HourConfig, value: number) => {
    setHourConfig((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const saveChanges = async () => {
    if (!schedule) return;
    setSaving(true);
    try {
      // Save hour config
      await fetch("/api/agents/schedule", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateHourConfig",
          agentType: "MESSAGE_AGENT",
          hourConfig,
        }),
      });

      // Save each hour's enabled/peak status
      for (const hour of schedule.hours) {
        await fetch("/api/agents/schedule", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "updateHour",
            agentType: "MESSAGE_AGENT",
            hour: hour.hour,
            updates: {
              enabled: hour.enabled,
              isPeak: hour.isPeak,
            },
          }),
        });
      }

      setHasChanges(false);
      toast.success("Schedule saved successfully");
    } catch {
      toast.error("Failed to save schedule");
    } finally {
      setSaving(false);
    }
  };

  const randomizeTimes = async () => {
    try {
      const res = await fetch("/api/agents/schedule", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "regenerateTimes",
          agentType: "MESSAGE_AGENT",
        }),
      });
      if (!res.ok) throw new Error("Failed to randomize times");
      await fetchSchedule();
      toast.success("Scheduled times randomized");
    } catch {
      toast.error("Failed to randomize times");
    }
  };

  const setAllHours = (enabled: boolean, isPeak?: boolean) => {
    if (!schedule) return;
    setSchedule({
      ...schedule,
      hours: schedule.hours.map((h) => ({
        ...h,
        enabled,
        ...(isPeak !== undefined ? { isPeak } : {}),
      })),
    });
    setHasChanges(true);
  };

  const setWorkingHours = () => {
    if (!schedule) return;
    setSchedule({
      ...schedule,
      hours: schedule.hours.map((h) => ({
        ...h,
        enabled: h.hour >= 8 && h.hour <= 22,
        isPeak: (h.hour >= 9 && h.hour <= 12) || (h.hour >= 18 && h.hour <= 21),
      })),
    });
    setHasChanges(true);
    toast.success("Set to working hours (8:00-22:00) with peak at 9-12 & 18-21");
  };

  // Calculate daily totals based on config
  const calculateTotals = () => {
    if (!schedule) return { dms: 0, friendRequests: 0 };
    let dms = 0;
    let friendRequests = 0;
    
    for (const hour of schedule.hours) {
      if (hour.enabled) {
        if (hour.isPeak) {
          dms += hourConfig.peakDMs;
          friendRequests += hourConfig.peakFriendRequests;
        } else {
          dms += hourConfig.normalDMs;
          friendRequests += hourConfig.normalFriendRequests;
        }
      }
    }
    
    return { dms, friendRequests };
  };

  const totals = calculateTotals();
  const enabledHours = schedule?.hours.filter((h) => h.enabled).length || 0;
  const peakHours = schedule?.hours.filter((h) => h.enabled && h.isPeak).length || 0;

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Failed to load schedule</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/dashboard/agents">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div className="p-2 rounded-lg bg-purple-500/10">
                <MessageSquare className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Message Agent Schedule</h1>
                <p className="text-sm text-muted-foreground">
                  Configure DMs and friend requests timing
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasChanges && (
                <Badge variant="outline" className="text-orange-500 border-orange-500">
                  Unsaved Changes
                </Badge>
              )}
              <Button variant="outline" onClick={randomizeTimes}>
                <Shuffle className="h-4 w-4 mr-2" />
                Randomize Times
              </Button>
              <Button variant="outline" onClick={() => fetchSchedule()}>
                <RefreshCcw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={saveChanges} disabled={saving || !hasChanges}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>

          {/* Agent Toggle & Current Hour */}
          <div className="flex items-center gap-4">
            {currentHour && (
              <Badge variant="outline" className="gap-1">
                {currentHour.isNight ? (
                  <Moon className="w-3 h-3" />
                ) : currentHour.isPeak ? (
                  <Zap className="w-3 h-3 text-orange-500" />
                ) : (
                  <Sun className="w-3 h-3" />
                )}
                {currentHour.hour}:00 TN
              </Badge>
            )}
            <div className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-lg bg-card">
              <span className="text-sm font-medium">Agent</span>
              <Button
                size="sm"
                onClick={toggleAgent}
                className="font-medium"
                style={{
                  backgroundColor: schedule.enabled ? "#16a34a" : "#dc2626",
                  color: "white",
                  borderColor: schedule.enabled ? "#16a34a" : "#dc2626",
                }}
              >
                {schedule.enabled ? "ON" : "OFF"}
              </Button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{enabledHours}</p>
                  <p className="text-xs text-muted-foreground">Active Hours</p>
                </div>
                <Clock className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-orange-500">{peakHours}</p>
                  <p className="text-xs text-muted-foreground">Peak Hours</p>
                </div>
                <Zap className="h-8 w-8 text-orange-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-purple-500">{totals.dms}</p>
                  <p className="text-xs text-muted-foreground">Daily DMs</p>
                </div>
                <Mail className="h-8 w-8 text-purple-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-blue-500">{totals.friendRequests}</p>
                  <p className="text-xs text-muted-foreground">Daily Friend Requests</p>
                </div>
                <UserPlus className="h-8 w-8 text-blue-500/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Hour Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Hour Configuration
            </CardTitle>
            <CardDescription>
              Set limits for peak and normal hours. The schedule below determines which hours are peak.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Peak Hours Config */}
              <div className="space-y-4 p-4 rounded-lg border border-orange-500/30 bg-orange-500/5">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-orange-500" />
                  <h3 className="font-semibold text-orange-500">Peak Hours</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="peakDMs" className="text-sm">DMs per hour</Label>
                    <Input
                      id="peakDMs"
                      type="number"
                      min={0}
                      max={10}
                      value={hourConfig.peakDMs}
                      onChange={(e) => updateHourConfig("peakDMs", parseInt(e.target.value) || 0)}
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="peakFriends" className="text-sm">Friend Requests per hour</Label>
                    <Input
                      id="peakFriends"
                      type="number"
                      min={0}
                      max={10}
                      value={hourConfig.peakFriendRequests}
                      onChange={(e) => updateHourConfig("peakFriendRequests", parseInt(e.target.value) || 0)}
                      className="bg-background"
                    />
                  </div>
                </div>
              </div>

              {/* Normal Hours Config */}
              <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">Normal Hours</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="normalDMs" className="text-sm">DMs per hour</Label>
                    <Input
                      id="normalDMs"
                      type="number"
                      min={0}
                      max={10}
                      value={hourConfig.normalDMs}
                      onChange={(e) => updateHourConfig("normalDMs", parseInt(e.target.value) || 0)}
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="normalFriends" className="text-sm">Friend Requests per hour</Label>
                    <Input
                      id="normalFriends"
                      type="number"
                      min={0}
                      max={10}
                      value={hourConfig.normalFriendRequests}
                      onChange={(e) => updateHourConfig("normalFriendRequests", parseInt(e.target.value) || 0)}
                      className="bg-background"
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAllHours(true)}>
            Enable All
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAllHours(false)}>
            Disable All
          </Button>
          <Button variant="outline" size="sm" onClick={setWorkingHours}>
            Working Hours Preset
          </Button>
        </div>

        {/* Hourly Schedule */}
        <Card>
          <CardHeader>
            <CardTitle>Hourly Schedule</CardTitle>
            <CardDescription>
              Toggle hours on/off and mark peak hours. Times are in Tunisia timezone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="w-24">Hour</TableHead>
                    <TableHead className="w-20">Active</TableHead>
                    <TableHead className="w-20">Peak</TableHead>
                    <TableHead className="w-24">DMs</TableHead>
                    <TableHead className="w-24">Friends</TableHead>
                    <TableHead>Scheduled Times</TableHead>
                    <TableHead className="w-20 text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedule.hours.map((hour) => {
                    const isNow = currentHour?.hour === hour.hour;
                    const isNight = hour.hour >= 22 || hour.hour < 6;
                    const dmsForHour = hour.enabled ? (hour.isPeak ? hourConfig.peakDMs : hourConfig.normalDMs) : 0;
                    const friendsForHour = hour.enabled ? (hour.isPeak ? hourConfig.peakFriendRequests : hourConfig.normalFriendRequests) : 0;

                    return (
                      <TableRow
                        key={hour.hour}
                        className={`border-border ${isNow ? "bg-purple-500/10" : ""} ${isNight ? "opacity-60" : ""}`}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2 font-mono">
                            {isNight ? (
                              <Moon className="h-3 w-3 text-muted-foreground" />
                            ) : hour.isPeak && hour.enabled ? (
                              <Zap className="h-3 w-3 text-orange-500" />
                            ) : (
                              <Clock className="h-3 w-3 text-muted-foreground" />
                            )}
                            {hour.hour.toString().padStart(2, "0")}:00
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => updateHour(hour.hour, { enabled: !hour.enabled })}
                            className="h-7 px-3 font-medium"
                            style={{
                              backgroundColor: hour.enabled ? "#16a34a" : "#dc2626",
                              color: "white",
                              borderColor: hour.enabled ? "#16a34a" : "#dc2626",
                            }}
                          >
                            {hour.enabled ? "On" : "Off"}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => updateHour(hour.hour, { isPeak: !hour.isPeak })}
                            disabled={!hour.enabled}
                            className="h-7 px-3 font-medium disabled:opacity-50"
                            style={{
                              backgroundColor: hour.isPeak ? "#f97316" : "#2563eb",
                              color: "white",
                              borderColor: hour.isPeak ? "#f97316" : "#2563eb",
                            }}
                          >
                            {hour.isPeak ? "Peak" : "Normal"}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Badge variant={hour.enabled ? "default" : "secondary"} className="font-mono">
                            {dmsForHour}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={hour.enabled ? "default" : "secondary"} className="font-mono">
                            {friendsForHour}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {hour.scheduledTimes.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {hour.scheduledTimes.map((time, i) => (
                                <Badge key={i} variant="outline" className="text-xs font-mono">
                                  {time}
                                </Badge>
                              ))}
                            </div>
                          ) : hour.enabled ? (
                            <span className="text-xs text-muted-foreground">Click &apos;Randomize Times&apos;</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Disabled</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isNow ? (
                            <Badge className="bg-purple-500">Now</Badge>
                          ) : hour.enabled ? (
                            <span className="text-xs text-green-500">●</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Off</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
