"use client";

import { useState, useEffect, useRef } from "react";
import {
  Play,
  Loader2,
  MessageSquare,
  CheckCircle,
  RefreshCw,
  Database,
  AlertCircle,
  Clock,
  User,
  Rocket,
  Bot,
  Square,
  ArrowRight,
  MessageCircle,
  Send,
  Zap,
  Lock,
  Save,
  Key,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface Account {
  id: string;
  name: string;
  email: string;
}

interface ConversationState {
  id: string;
  contactName: string;
  contactFbId: string;
  conversationUrl: string;
  state: string;
  lastTheirMessage?: string;
  lastMessageIsOurs?: boolean;
  lastCheckedAt: string;
  messageCount?: number;
}

interface InitProgress {
  phase: "idle" | "checking-pin" | "scanning" | "opening" | "complete" | "error";
  currentContact?: string;
  totalContacts: number;
  processedContacts: number;
  savedMessages: number;
  pinEntered: boolean;
  errors: string[];
}

interface AgentStatus {
  running: boolean;
  lastRun?: Date;
  nextRun?: Date;
  cycleCount: number;
  totalChecked: number;
  newMessagesDetected: number;
  repliesSent: number;
}

interface AgentCycleResult {
  success: boolean;
  checked: number;
  pinEntered?: boolean;
  newMessages: { contactName: string; message: string }[];
  repliesSent: { contactName: string; reply: string }[];
  errors: string[];
  logs: string[];
}

export default function ConversationTestingPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([]);

  // PIN State
  const [pinValue, setPinValue] = useState<string>("");
  const [pinHasPin, setPinHasPin] = useState<boolean>(false);
  const [pinSaving, setPinSaving] = useState(false);

  // Init Tab State
  const [initProgress, setInitProgress] = useState<InitProgress>({
    phase: "idle",
    totalContacts: 0,
    processedContacts: 0,
    savedMessages: 0,
    pinEntered: false,
    errors: [],
  });
  const [initContacts, setInitContacts] = useState<ConversationState[]>([]);
  const [initScrollCount, setInitScrollCount] = useState(5);
  const [initRunning, setInitRunning] = useState(false);

  // Agent Tab State
  const [agentStatus, setAgentStatus] = useState<AgentStatus>({
    running: false,
    cycleCount: 0,
    totalChecked: 0,
    newMessagesDetected: 0,
    repliesSent: 0,
  });
  const [agentInterval, setAgentInterval] = useState(60);
  const [autoReply, setAutoReply] = useState(false);
  const [agentLogs, setAgentLogs] = useState<string[]>([]);
  const [needsReply, setNeedsReply] = useState<{ contactName: string; message: string }[]>([]);
  const [agentLoading, setAgentLoading] = useState(false);
  const agentIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load accounts
  useEffect(() => {
    async function loadAccounts() {
      try {
        const res = await fetch("/api/accounts");
        if (res.ok) {
          const data = await res.json();
          setAccounts(data.accounts || []);
          if (data.accounts?.length > 0) {
            setSelectedAccount(data.accounts[0].id);
          }
        }
      } catch {
        console.error("Failed to load accounts");
      }
    }
    loadAccounts();
  }, []);

  // Check PIN status when account changes
  useEffect(() => {
    async function checkPinStatus() {
      if (!selectedAccount) return;
      try {
        const res = await fetch("/api/test/conversation-pin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId: selectedAccount, action: "status" }),
        });
        const data = await res.json();
        setPinHasPin(data.hasPin || false);
      } catch {
        console.error("Failed to check PIN status");
      }
    }
    checkPinStatus();
  }, [selectedAccount]);

  // Cleanup agent interval on unmount
  useEffect(() => {
    return () => {
      if (agentIntervalRef.current) {
        clearInterval(agentIntervalRef.current);
      }
    };
  }, []);

  // ==================== PIN FUNCTIONS ====================

  async function savePIN() {
    if (!selectedAccount) {
      toast.error("Select an account");
      return;
    }

    if (!pinValue || pinValue.length !== 6 || !/^\d{6}$/.test(pinValue)) {
      toast.error("PIN must be exactly 6 digits");
      return;
    }

    setPinSaving(true);
    try {
      const res = await fetch("/api/test/conversation-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: selectedAccount,
          action: "save",
          newPin: pinValue,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("PIN saved successfully");
        setPinHasPin(true);
        setPinValue("");
      } else {
        toast.error(data.error || "Failed to save PIN");
      }
    } catch {
      toast.error("Failed to save PIN");
    } finally {
      setPinSaving(false);
    }
  }

  // ==================== INIT TAB ====================

  async function resetConversations() {
    if (!selectedAccount) {
      toast.error("Select an account");
      return;
    }

    if (!confirm("Are you sure you want to delete ALL conversations for this account? This cannot be undone.")) {
      return;
    }

    setInitRunning(true);
    try {
      const res = await fetch(`/api/test/conversation-init?accountId=${selectedAccount}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (data.success) {
        toast.success(`Deleted ${data.deleted.contacts} contacts and ${data.deleted.messages} messages`);
        addLog(`🗑️ Reset complete: Deleted ${data.deleted.contacts} contacts and ${data.deleted.messages} messages`);
        setInitContacts([]);
        setInitProgress({
          phase: "idle",
          totalContacts: 0,
          processedContacts: 0,
          savedMessages: 0,
          pinEntered: false,
          errors: [],
        });
      } else {
        toast.error(data.error || "Failed to reset");
      }
    } catch (err) {
      toast.error("Failed to reset conversations");
    } finally {
      setInitRunning(false);
    }
  }

  async function runInit() {
    if (!selectedAccount) {
      toast.error("Select an account");
      return;
    }

    if (!pinHasPin) {
      toast.error("Please configure PIN first for E2EE conversations");
      return;
    }

    setInitRunning(true);
    setLogs([]);
    setInitContacts([]);
    setInitProgress({
      phase: "checking-pin",
      totalContacts: 0,
      processedContacts: 0,
      savedMessages: 0,
      pinEntered: false,
      errors: [],
    });

    try {
      toast.info("🚀 Starting initialization...");
      addLog("═══════════════════════════════════════════");
      addLog("🚀 INITIALIZATION STARTED");
      addLog("═══════════════════════════════════════════");

      // Call the init API which handles everything including PIN
      addLog("🔐 Step 1: Opening Messenger & checking for E2EE PIN...");
      
      const res = await fetch("/api/test/conversation-init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: selectedAccount,
          scrollCount: initScrollCount,
        }),
      });

      const data = await res.json();

      if (data.pinEntered) {
        addLog("  ✅ E2EE PIN entered successfully");
        setInitProgress((prev) => ({ ...prev, pinEntered: true }));
      } else {
        addLog("  ℹ️ No PIN dialog appeared");
      }

      if (!data.success) {
        throw new Error(data.errors?.[0] || "Init failed");
      }

      // Update progress with scanning phase
      setInitProgress((prev) => ({
        ...prev,
        phase: "scanning",
      }));
      addLog("");
      addLog("📋 Step 2: Scanning sidebar for all contacts...");
      addLog(`  ✅ Found ${data.totalContacts} conversations in sidebar`);
      addLog(`  ✅ After filtering: ${data.validContacts} valid contacts`);

      setInitContacts(data.contacts || []);
      setInitProgress((prev) => ({
        ...prev,
        phase: "opening",
        totalContacts: data.validContacts || 0,
      }));

      // If we have contacts to process
      if (data.contacts && data.contacts.length > 0) {
        addLog("");
        addLog("💬 Step 3: Saving conversation history...");
        
        for (let i = 0; i < data.contacts.length; i++) {
          const contact = data.contacts[i];
          addLog(`  → ${contact.contactName}: ${contact.messageCount || 0} messages saved`);
          setInitProgress((prev) => ({
            ...prev,
            processedContacts: i + 1,
            savedMessages: prev.savedMessages + (contact.messageCount || 0),
          }));
        }
      }

      // Complete
      setInitProgress((prev) => ({
        ...prev,
        phase: "complete",
        processedContacts: data.validContacts || 0,
        savedMessages: data.totalMessages || 0,
      }));

      addLog("");
      addLog("═══════════════════════════════════════════");
      addLog("🎉 INITIALIZATION COMPLETE!");
      addLog(`   📊 Contacts: ${data.validContacts || 0}`);
      addLog(`   💬 Messages saved: ${data.totalMessages || 0}`);
      addLog("═══════════════════════════════════════════");

      toast.success(`Init complete! ${data.validContacts || 0} contacts processed`);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      setInitProgress((prev) => ({
        ...prev,
        phase: "error",
        errors: [...prev.errors, errMsg],
      }));
      toast.error(errMsg);
      addLog(`❌ ERROR: ${errMsg}`);
    } finally {
      setInitRunning(false);
    }
  }

  // ==================== AGENT TAB ====================

  async function runAgentCycle(): Promise<AgentCycleResult> {
    addAgentLog(`[${new Date().toLocaleTimeString()}] 🔄 Starting agent cycle...`);

    try {
      const res = await fetch("/api/test/message-agent-cycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: selectedAccount,
          autoReply,
        }),
      });

      const data = await res.json();

      // Log PIN check
      if (data.pinEntered) {
        addAgentLog(`  🔐 E2EE PIN entered successfully`);
      }

      if (data.success) {
        addAgentLog(`  ✅ Checked ${data.checked} conversations`);

        if (data.newMessages?.length > 0) {
          for (const msg of data.newMessages) {
            addAgentLog(`  📨 NEW: ${msg.contactName}: "${msg.message.substring(0, 50)}..."`);
          }
          setNeedsReply(data.newMessages);
        }

        if (data.repliesSent?.length > 0) {
          for (const reply of data.repliesSent) {
            addAgentLog(`  ✉️ SENT: ${reply.contactName}: "${reply.reply.substring(0, 50)}..."`);
          }
        }

        if (data.newMessages?.length === 0 && data.repliesSent?.length === 0) {
          addAgentLog(`  📭 No new messages`);
        }
      } else {
        addAgentLog(`  ❌ Error: ${data.errors?.[0] || "Unknown"}`);
      }

      return data;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      addAgentLog(`  ❌ Error: ${errMsg}`);
      return {
        success: false,
        checked: 0,
        newMessages: [],
        repliesSent: [],
        errors: [errMsg],
        logs: [],
      };
    }
  }

  async function startAgent() {
    if (!selectedAccount) {
      toast.error("Select an account");
      return;
    }

    if (!pinHasPin) {
      toast.error("Please configure PIN first for E2EE conversations");
      return;
    }

    setAgentStatus((prev) => ({
      ...prev,
      running: true,
      lastRun: new Date(),
      nextRun: new Date(Date.now() + agentInterval * 1000),
    }));

    toast.success(`🤖 Agent started! Checking every ${agentInterval}s`);
    addAgentLog(`═══════════════════════════════════════════`);
    addAgentLog(`🤖 AGENT STARTED (interval: ${agentInterval}s)`);
    addAgentLog(`   Auto-reply: ${autoReply ? "ON" : "OFF"}`);
    addAgentLog(`═══════════════════════════════════════════`);

    // Run first cycle immediately
    const result = await runAgentCycle();
    updateAgentStats(result);

    // Start interval
    agentIntervalRef.current = setInterval(async () => {
      setAgentStatus((prev) => ({
        ...prev,
        lastRun: new Date(),
        nextRun: new Date(Date.now() + agentInterval * 1000),
        cycleCount: prev.cycleCount + 1,
      }));

      const cycleResult = await runAgentCycle();
      updateAgentStats(cycleResult);
    }, agentInterval * 1000);
  }

  function stopAgent() {
    if (agentIntervalRef.current) {
      clearInterval(agentIntervalRef.current);
      agentIntervalRef.current = null;
    }

    setAgentStatus((prev) => ({
      ...prev,
      running: false,
    }));

    toast.info("🛑 Agent stopped");
    addAgentLog(`═══════════════════════════════════════════`);
    addAgentLog(`🛑 AGENT STOPPED`);
    addAgentLog(`═══════════════════════════════════════════`);
  }

  function updateAgentStats(result: AgentCycleResult) {
    setAgentStatus((prev) => ({
      ...prev,
      totalChecked: prev.totalChecked + result.checked,
      newMessagesDetected: prev.newMessagesDetected + (result.newMessages?.length || 0),
      repliesSent: prev.repliesSent + (result.repliesSent?.length || 0),
    }));
  }

  async function runSingleCycle() {
    if (!selectedAccount) {
      toast.error("Select an account");
      return;
    }

    if (!pinHasPin) {
      toast.error("Please configure PIN first for E2EE conversations");
      return;
    }

    setAgentLoading(true);
    toast.info("Running single cycle...");

    const result = await runAgentCycle();
    updateAgentStats(result);

    if (result.success) {
      toast.success(`Checked ${result.checked} conversations`);
    } else {
      toast.error(result.errors?.[0] || "Cycle failed");
    }

    setAgentLoading(false);
  }

  // ==================== HELPERS ====================

  function addLog(msg: string) {
    setLogs((prev) => [...prev, msg]);
  }

  function addAgentLog(msg: string) {
    setAgentLogs((prev) => [...prev.slice(-100), msg]);
  }

  function renderStateBadge(state: string) {
    const colors: Record<string, string> = {
      INITIALIZED: "bg-gray-500",
      NEEDS_REPLY: "bg-red-500",
      REPLIED: "bg-green-500",
      QUALIFIED: "bg-blue-500",
      NOT_INTERESTED: "bg-yellow-500",
      ENDED: "bg-gray-400",
    };
    return (
      <Badge className={`${colors[state] || "bg-gray-500"} text-white text-xs`}>
        {state}
      </Badge>
    );
  }

  // ==================== RENDER ====================

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Message Agent Testing</h1>
          <p className="text-muted-foreground">
            Initialize conversations and run the message monitoring agent
          </p>
        </div>
      </div>

      {/* Account Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Select Account</CardTitle>
          <CardDescription>Choose a Facebook account to use</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={selectedAccount} onValueChange={setSelectedAccount}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Select a Facebook account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((acc) => (
                <SelectItem key={acc.id} value={acc.id}>
                  {acc.name || acc.email || acc.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* PIN Status & Configuration */}
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
            <Lock className="w-5 h-5 text-purple-500" />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium">E2EE PIN Status:</span>
                {pinHasPin ? (
                  <Badge className="bg-green-500 text-white">Configured ✓</Badge>
                ) : (
                  <Badge variant="outline" className="text-yellow-600 border-yellow-500">Not Set ⚠️</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Required for encrypted conversations. Agent will auto-enter PIN when needed.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="password"
                placeholder="6-digit PIN"
                value={pinValue}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setPinValue(val);
                }}
                maxLength={6}
                className="w-28 font-mono text-center"
              />
              <Button
                onClick={savePIN}
                disabled={pinSaving || pinValue.length !== 6}
                size="sm"
                variant="outline"
              >
                {pinSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs defaultValue="init" className="space-y-4">
        <TabsList className="grid w-full max-w-lg grid-cols-3 h-12">
          <TabsTrigger value="init" className="text-base">
            <Rocket className="w-4 h-4 mr-2" />
            🚀 Init
          </TabsTrigger>
          <TabsTrigger value="agent" className="text-base">
            <Bot className="w-4 h-4 mr-2" />
            🤖 Agent
          </TabsTrigger>
          <TabsTrigger value="pin" className="text-base">
            <Key className="w-4 h-4 mr-2" />
            🔐 PIN Test
          </TabsTrigger>
        </TabsList>

        {/* ===== INIT TAB ===== */}
        <TabsContent value="init">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Rocket className="w-5 h-5 text-blue-500" />
                  Phase 1: Initial Setup (One-Time)
                </CardTitle>
                <CardDescription>
                  Scan sidebar for all contacts, then open each conversation to save full message history for AI context.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Steps Explanation */}
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-muted/50 p-4 rounded-lg border-l-4 border-purple-500">
                    <p className="font-semibold text-purple-500 mb-2 flex items-center gap-2">
                      <Lock className="w-4 h-4" /> Step 1: Check E2EE PIN
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Open Messenger</li>
                      <li>• Detect PIN dialog</li>
                      <li>• Auto-enter 6-digit PIN</li>
                    </ul>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg border-l-4 border-blue-500">
                    <p className="font-semibold text-blue-500 mb-2">Step 2: Scan Sidebar</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Scroll to load all</li>
                      <li>• Extract contact names</li>
                      <li>• Filter system messages</li>
                    </ul>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg border-l-4 border-green-500">
                    <p className="font-semibold text-green-500 mb-2">Step 3: Save History</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Open each conversation</li>
                      <li>• Check PIN per E2EE conv</li>
                      <li>• Save messages to DB</li>
                    </ul>
                  </div>
                </div>

                <Separator />

                {/* Settings */}
                <div className="flex items-center gap-4">
                  <div className="space-y-1">
                    <Label>Sidebar Scrolls</Label>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={initScrollCount}
                      onChange={(e) => setInitScrollCount(parseInt(e.target.value) || 5)}
                      className="w-24"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-5">
                    More scrolls = more conversations loaded
                  </p>
                </div>

                <Button
                  onClick={runInit}
                  disabled={initRunning || !selectedAccount || !pinHasPin}
                  size="lg"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {initRunning ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Rocket className="w-4 h-4 mr-2" />
                  )}
                  Run Initialization
                </Button>

                <Button
                  onClick={resetConversations}
                  disabled={initRunning || !selectedAccount}
                  variant="destructive"
                  size="lg"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Reset All Conversations
                </Button>

                {!pinHasPin && (
                  <p className="text-sm text-yellow-600">
                    ⚠️ Please configure E2EE PIN above before running init
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Progress Card */}
            {initProgress.phase !== "idle" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {initProgress.phase === "complete" ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : initProgress.phase === "error" ? (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    ) : (
                      <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                    )}
                    {initProgress.phase === "checking-pin" && "Checking E2EE PIN..."}
                    {initProgress.phase === "scanning" && "Scanning Sidebar..."}
                    {initProgress.phase === "opening" && "Saving Conversations..."}
                    {initProgress.phase === "complete" && "Initialization Complete!"}
                    {initProgress.phase === "error" && "Error"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Progress Bar */}
                  {initProgress.phase === "opening" && initProgress.totalContacts > 0 && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Processing: {initProgress.currentContact}</span>
                        <span>
                          {initProgress.processedContacts} / {initProgress.totalContacts}
                        </span>
                      </div>
                      <Progress
                        value={(initProgress.processedContacts / initProgress.totalContacts) * 100}
                      />
                    </div>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className={`text-center p-4 rounded-lg ${initProgress.pinEntered ? "bg-green-500/10" : "bg-gray-500/10"}`}>
                      <Lock className={`w-6 h-6 mx-auto mb-1 ${initProgress.pinEntered ? "text-green-500" : "text-gray-400"}`} />
                      <p className="text-xs text-muted-foreground">
                        {initProgress.pinEntered ? "PIN Entered" : "No PIN Needed"}
                      </p>
                    </div>
                    <div className="text-center p-4 bg-blue-500/10 rounded-lg">
                      <p className="text-2xl font-bold text-blue-500">
                        {initProgress.totalContacts}
                      </p>
                      <p className="text-xs text-muted-foreground">Contacts Found</p>
                    </div>
                    <div className="text-center p-4 bg-green-500/10 rounded-lg">
                      <p className="text-2xl font-bold text-green-500">
                        {initProgress.processedContacts}
                      </p>
                      <p className="text-xs text-muted-foreground">Processed</p>
                    </div>
                    <div className="text-center p-4 bg-purple-500/10 rounded-lg">
                      <p className="text-2xl font-bold text-purple-500">
                        {initProgress.savedMessages}
                      </p>
                      <p className="text-xs text-muted-foreground">Messages Saved</p>
                    </div>
                  </div>

                  {/* Contacts List */}
                  {initContacts.length > 0 && (
                    <div>
                      <Label className="mb-2">Contacts</Label>
                      <ScrollArea className="h-48 border rounded-lg">
                        <div className="p-2 space-y-1">
                          {initContacts.map((contact, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2 p-2 bg-muted/30 rounded"
                            >
                              <User className="w-4 h-4 text-gray-400" />
                              <span className="font-medium text-sm">{contact.contactName}</span>
                              {contact.state && renderStateBadge(contact.state)}
                              {contact.lastMessageIsOurs && (
                                <Badge variant="secondary" className="text-xs">You replied</Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  {/* Logs */}
                  {logs.length > 0 && (
                    <div>
                      <Label className="mb-2">Logs</Label>
                      <ScrollArea className="h-48 border rounded-lg bg-black/5 dark:bg-white/5">
                        <div className="p-2 font-mono text-xs space-y-0.5">
                          {logs.map((log, i) => (
                            <div key={i} className={`${
                              log.includes("ERROR") || log.includes("❌") ? "text-red-500" :
                              log.includes("✅") ? "text-green-500" :
                              log.includes("═") || log.includes("🚀") || log.includes("🎉") ? "text-blue-500" :
                              log.includes("🔐") ? "text-purple-500" :
                              "text-muted-foreground"
                            }`}>
                              {log}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ===== AGENT TAB ===== */}
        <TabsContent value="agent">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-purple-500" />
                  Phase 2: Message Monitoring Agent
                </CardTitle>
                <CardDescription>
                  Continuously monitors Messenger for new messages, compares with DB, and optionally sends AI replies.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Agent Flow */}
                <div className="bg-muted/50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 flex-wrap text-sm">
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Check PIN
                    </Badge>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Database className="w-3 h-3" /> Load DB
                    </Badge>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    <Badge variant="outline" className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" /> Scan Sidebar
                    </Badge>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Zap className="w-3 h-3" /> Compare
                    </Badge>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    <Badge variant="outline" className="flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" /> Detect New
                    </Badge>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Send className="w-3 h-3" /> AI Reply
                    </Badge>
                  </div>
                </div>

                <Separator />

                {/* Settings */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Check Interval (seconds)</Label>
                    <Input
                      type="number"
                      min={30}
                      max={600}
                      value={agentInterval}
                      onChange={(e) => setAgentInterval(parseInt(e.target.value) || 60)}
                      disabled={agentStatus.running}
                      className="w-32"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={autoReply}
                      onCheckedChange={setAutoReply}
                      disabled={agentStatus.running}
                    />
                    <div>
                      <Label>Auto-Reply with AI</Label>
                      <p className="text-xs text-muted-foreground">
                        Automatically send AI-generated replies
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Controls */}
                <div className="flex gap-3">
                  {!agentStatus.running ? (
                    <Button
                      onClick={startAgent}
                      disabled={!selectedAccount || !pinHasPin}
                      size="lg"
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Start Agent
                    </Button>
                  ) : (
                    <Button
                      onClick={stopAgent}
                      size="lg"
                      variant="destructive"
                    >
                      <Square className="w-4 h-4 mr-2" />
                      Stop Agent
                    </Button>
                  )}

                  <Button
                    onClick={runSingleCycle}
                    disabled={agentLoading || !selectedAccount || agentStatus.running || !pinHasPin}
                    variant="outline"
                  >
                    {agentLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Run Single Cycle
                  </Button>
                </div>

                {!pinHasPin && (
                  <p className="text-sm text-yellow-600">
                    ⚠️ Please configure E2EE PIN above before running agent
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Agent Status Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {agentStatus.running ? (
                    <>
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                      Agent Running
                    </>
                  ) : (
                    <>
                      <div className="w-3 h-3 bg-gray-400 rounded-full" />
                      Agent Stopped
                    </>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-blue-500/10 rounded-lg">
                    <p className="text-2xl font-bold text-blue-500">
                      {agentStatus.cycleCount}
                    </p>
                    <p className="text-xs text-muted-foreground">Cycles</p>
                  </div>
                  <div className="text-center p-4 bg-gray-500/10 rounded-lg">
                    <p className="text-2xl font-bold text-gray-500">
                      {agentStatus.totalChecked}
                    </p>
                    <p className="text-xs text-muted-foreground">Checked</p>
                  </div>
                  <div className="text-center p-4 bg-orange-500/10 rounded-lg">
                    <p className="text-2xl font-bold text-orange-500">
                      {agentStatus.newMessagesDetected}
                    </p>
                    <p className="text-xs text-muted-foreground">New Messages</p>
                  </div>
                  <div className="text-center p-4 bg-green-500/10 rounded-lg">
                    <p className="text-2xl font-bold text-green-500">
                      {agentStatus.repliesSent}
                    </p>
                    <p className="text-xs text-muted-foreground">Replies Sent</p>
                  </div>
                </div>

                {/* Timing */}
                {agentStatus.running && (
                  <div className="flex gap-6 text-sm text-muted-foreground">
                    {agentStatus.lastRun && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        Last: {agentStatus.lastRun.toLocaleTimeString()}
                      </div>
                    )}
                    {agentStatus.nextRun && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        Next: {agentStatus.nextRun.toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                )}

                {/* Needs Reply */}
                {needsReply.length > 0 && (
                  <div>
                    <Label className="mb-2 text-orange-500">🔔 Needs Reply ({needsReply.length})</Label>
                    <div className="space-y-2">
                      {needsReply.map((item, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-3 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg"
                        >
                          <MessageCircle className="w-5 h-5 text-orange-500 mt-0.5" />
                          <div>
                            <p className="font-medium">{item.contactName}</p>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {item.message}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Agent Logs */}
                {agentLogs.length > 0 && (
                  <div>
                    <Label className="mb-2">Agent Logs</Label>
                    <ScrollArea className="h-64 border rounded-lg bg-black/5 dark:bg-white/5">
                      <div className="p-2 font-mono text-xs space-y-0.5">
                        {agentLogs.map((log, i) => (
                          <div
                            key={i}
                            className={`${
                              log.includes("ERROR") || log.includes("❌")
                                ? "text-red-500"
                                : log.includes("NEW") || log.includes("📨")
                                ? "text-orange-500"
                                : log.includes("SENT") || log.includes("✉️")
                                ? "text-green-500"
                                : log.includes("═") || log.includes("🤖")
                                ? "text-blue-500"
                                : log.includes("🔐")
                                ? "text-purple-500"
                                : "text-muted-foreground"
                            }`}
                          >
                            {log}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ===== PIN TEST TAB ===== */}
        <TabsContent value="pin">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-purple-500" />
                  🔐 E2EE PIN Testing
                </CardTitle>
                <CardDescription>
                  Test the PIN auto-entry for End-to-End Encrypted conversations.
                  This will open Messenger and enter the PIN if the dialog appears.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* PIN Status */}
                <div className="bg-muted/50 p-4 rounded-lg">
                  <div className="flex items-center gap-4">
                    <Lock className={`w-8 h-8 ${pinHasPin ? "text-green-500" : "text-yellow-500"}`} />
                    <div>
                      <p className="font-semibold">
                        {pinHasPin ? "✅ PIN Configured" : "⚠️ PIN Not Set"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {pinHasPin 
                          ? "The agent will auto-enter this PIN when E2EE dialog appears"
                          : "Set a 6-digit PIN above to enable E2EE auto-unlock"
                        }
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-lg">
                  <p className="text-sm">
                    <strong>When PIN is checked:</strong>
                  </p>
                  <ul className="text-sm text-muted-foreground list-disc pl-5 mt-2 space-y-1">
                    <li>✅ Every time Messenger is opened (Init & Agent cycles)</li>
                    <li>✅ Before each conversation is opened for reply</li>
                    <li>✅ After browser session expires</li>
                  </ul>
                </div>

                <Button
                  onClick={async () => {
                    if (!selectedAccount || !pinHasPin) {
                      toast.error("Configure PIN first");
                      return;
                    }
                    
                    toast.info("Testing PIN entry...");
                    try {
                      const res = await fetch("/api/test/conversation-pin", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          accountId: selectedAccount,
                          action: "test",
                        }),
                      });
                      const data = await res.json();
                      
                      if (data.pinEntered && data.pinCorrect) {
                        toast.success("✅ PIN verified successfully!");
                      } else if (data.pinEntered && !data.pinCorrect) {
                        toast.error("❌ Incorrect PIN!");
                      } else if (!data.pinDialogFound) {
                        toast.info("ℹ️ No PIN dialog appeared");
                      } else {
                        toast.warning("⚠️ Could not enter PIN");
                      }
                    } catch {
                      toast.error("Test failed");
                    }
                  }}
                  disabled={!selectedAccount || !pinHasPin}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Test PIN Entry
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
