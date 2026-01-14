"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Play,
  Loader2,
  MessageSquare,
  Search,
  CheckCircle,
  RefreshCw,
  Zap,
  Database,
  User,
  MessageCircle,
  Send,
  Eye,
  Sparkles,
  AlertCircle,
  UserX,
  ArrowRight,
  Copy,
  Clock,
  Target,
  Bot,
  ExternalLink,
  StopCircle,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface Account {
  id: string;
  name: string;
  email: string;
}

interface Group {
  id: string;
  url: string;
  name: string;
  isInitialized: boolean;
}

interface Lead {
  id: string;
  postUrl: string;
  authorName: string | null;
  authorProfileUrl: string | null;
  postText: string;
  matchedService: string | null;
  status: string;
  intentScore: number;
  isAnonymous: boolean;
  createdAt: string;
}

interface AIPreview {
  leadId: string;
  comment: string;
  dm: string | null;
  canDM: boolean;
  loading: boolean;
}

export default function AgentTestingPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  // Group Initializer inputs
  const [selectedGroupForInit, setSelectedGroupForInit] = useState<string>("");
  const [initializerMaxPosts, setInitializerMaxPosts] = useState(400);

  // Conversation Init inputs
  const [convInitMaxConversations, setConvInitMaxConversations] = useState(50);
  const [convInitScrollCount, setConvInitScrollCount] = useState(3);
  const [convInitResult, setConvInitResult] = useState<{
    success: boolean;
    totalScraped: number;
    matchedToLeads: number;
    alreadyExisted: number;
    created: number;
    unmatched: number;
    conversations: {
      contactName: string;
      contactUrl: string | null;
      matched: boolean;
      leadId: string | null;
      authorName: string | null;
      status: "created" | "existed" | "unmatched";
    }[];
    logs: string[];
  } | null>(null);

  // Scraper Agent inputs
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  // Initiator Agent inputs
  const [initiatorMaxLeads, setInitiatorMaxLeads] = useState(5);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [aiPreviews, setAiPreviews] = useState<Map<string, AIPreview>>(new Map());
  const [previewingLead, setPreviewingLead] = useState<string | null>(null);
  const [executionProgress, setExecutionProgress] = useState(0);
  const [currentLeadName, setCurrentLeadName] = useState<string>("");

  // Message Agent inputs
  const [idleTimeoutUnread, setIdleTimeoutUnread] = useState(120);
  const [idleTimeoutConversation, setIdleTimeoutConversation] = useState(60);

  // Running agent tracking - prevents navigation when agent is active
  const [runningAgent, setRunningAgent] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("initializer");
  const [showNavigationWarning, setShowNavigationWarning] = useState(false);
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const router = useRouter();

  // Block browser navigation (refresh, close, back) when agent is running
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (runningAgent) {
        e.preventDefault();
        e.returnValue = "An agent is currently running. Are you sure you want to leave?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [runningAgent]);

  // Handle tab change - block if agent is running
  const handleTabChange = useCallback((newTab: string) => {
    if (runningAgent && newTab !== activeTab) {
      setPendingTab(newTab);
      setShowNavigationWarning(true);
      return;
    }
    setActiveTab(newTab);
  }, [runningAgent, activeTab]);

  // Force stop current agent (placeholder - agents don't support abort yet)
  const forceStopAgent = useCallback(() => {
    toast.warning("Agent will stop after current operation completes. Browser may still be open.");
    setRunningAgent(null);
    setLoading(false);
    setShowNavigationWarning(false);
    if (pendingTab) {
      setActiveTab(pendingTab);
      setPendingTab(null);
    }
  }, [pendingTab]);

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

  // Load groups
  useEffect(() => {
    async function loadGroups() {
      try {
        const res = await fetch("/api/groups");
        if (res.ok) {
          const data = await res.json();
          setGroups(data.groups || []);
        }
      } catch {
        console.error("Failed to load groups");
      }
    }
    loadGroups();
  }, []);

  // Load leads with more details
  async function loadLeads() {
    try {
      const res = await fetch("/api/leads?status=NEW&limit=50");
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
        setSelectedLeadIds([]); // Reset selection
        setAiPreviews(new Map()); // Reset previews
      }
    } catch {
      console.error("Failed to load leads");
    }
  }

  // Generate AI preview for a single lead
  async function generateAIPreview(lead: Lead) {
    setPreviewingLead(lead.id);
    
    // Smart anonymous detection: if we have a real name AND profile URL, not anonymous
    const hasRealAuthor = lead.authorName && 
      lead.authorName !== 'Anonymous' && 
      lead.authorName.trim() !== '' && 
      lead.authorProfileUrl;
    
    const preview: AIPreview = {
      leadId: lead.id,
      comment: "",
      dm: null,
      canDM: hasRealAuthor || (!lead.isAnonymous && !!lead.authorProfileUrl),
      loading: true,
    };
    
    setAiPreviews(prev => new Map(prev).set(lead.id, preview));

    try {
      // Generate comment
      const commentRes = await fetch("/api/ai/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          postText: lead.postText,
          matchedService: lead.matchedService,
        }),
      });
      const commentData = await commentRes.json();
      preview.comment = commentData.comment || "فشل في التوليد";

      // Generate DM if possible
      if (preview.canDM) {
        const dmRes = await fetch("/api/ai/first-dm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "generate",
            authorName: lead.authorName || "صديق",
            postText: lead.postText,
            matchedService: lead.matchedService,
          }),
        });
        const dmData = await dmRes.json();
        preview.dm = dmData.message || "فشل في التوليد";
      }

      preview.loading = false;
      setAiPreviews(prev => new Map(prev).set(lead.id, { ...preview }));
    } catch (error) {
      preview.loading = false;
      preview.comment = "خطأ في التوليد";
      setAiPreviews(prev => new Map(prev).set(lead.id, { ...preview }));
      toast.error("فشل في توليد المعاينة");
    } finally {
      setPreviewingLead(null);
    }
  }

  // Generate previews for all selected leads
  async function generateAllPreviews() {
    const leadsToPreview = selectedLeadIds.length > 0 
      ? leads.filter(l => selectedLeadIds.includes(l.id))
      : leads.slice(0, initiatorMaxLeads);
    
    for (const lead of leadsToPreview) {
      await generateAIPreview(lead);
    }
    toast.success(`تم توليد ${leadsToPreview.length} معاينة`);
  }

  // Run Group Initializer (First-Time Scraper)
  async function runGroupInitializer() {
    if (!selectedGroupForInit) {
      toast.error("Select a group to initialize");
      return;
    }

    const group = groups.find(g => g.id === selectedGroupForInit);
    if (!group) {
      toast.error("Group not found");
      return;
    }

    if (!selectedAccount) {
      toast.error("Select an account first");
      return;
    }

    setLoading(true);
    setRunningAgent("Group Initializer");
    setLogs([]);
    setResult(null);

    try {
      toast.info(`Initializing ${group.name} - scraping ${initializerMaxPosts} historical posts...`);
      const res = await fetch("/api/agents/test/first-time-scraper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: selectedAccount,
          groupUrl: group.url,
          maxPosts: initializerMaxPosts,
          headless: false,
        }),
      });

      const data = await res.json();
      setResult(data);
      setLogs(data.logs || []);

      if (data.success) {
        toast.success(`Initialized group with ${data.stats?.postsScraped || 0} posts, created ${data.stats?.leadsCreated || 0} leads`);
        // Refresh groups to update isInitialized status
        const groupsRes = await fetch("/api/groups");
        if (groupsRes.ok) {
          const groupsData = await groupsRes.json();
          setGroups(groupsData.groups || []);
        }
        setSelectedGroupForInit(""); // Clear selection after success
      } else {
        toast.error(data.error || "Group initialization failed");
      }
    } catch (error) {
      toast.error("Failed to initialize group");
      console.error(error);
    } finally {
      setLoading(false);
      setRunningAgent(null);
    }
  }

  // Run Scraper Agent
  async function runScraperAgent() {
    if (!selectedAccount) {
      toast.error("Select an account");
      return;
    }

    setLoading(true);
    setRunningAgent("Scraper Agent");
    setLogs([]);
    setResult(null);

    try {
      toast.info("Starting Scraper Agent...");
      const res = await fetch("/api/agents/test/scraper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: selectedAccount,
          groupIds: selectedGroupIds.length > 0 ? selectedGroupIds : undefined,
          headless: false,
        }),
      });

      const data = await res.json();
      setResult(data);
      setLogs(data.logs || []);

      if (data.success) {
        toast.success(`Scraped ${data.stats?.postsScraped || 0} posts, created ${data.stats?.leadsCreated || 0} leads`);
      } else {
        toast.error(data.error || "Scraper Agent failed");
      }
    } catch (error) {
      toast.error("Failed to run Scraper Agent");
      console.error(error);
    } finally {
      setLoading(false);
      setRunningAgent(null);
    }
  }

  // Run Initiator Agent - ALWAYS comment + DM when available
  async function runInitiatorAgent() {
    if (!selectedAccount) {
      toast.error("Select an account");
      return;
    }

    const leadsToProcess = selectedLeadIds.length > 0 
      ? selectedLeadIds 
      : leads.slice(0, initiatorMaxLeads).map(l => l.id);

    if (leadsToProcess.length === 0) {
      toast.error("لا يوجد leads للمعالجة");
      return;
    }

    setLoading(true);
    setRunningAgent("Initiator Agent");
    setLogs([]);
    setResult(null);
    setExecutionProgress(0);

    try {
      toast.info(`🚀 بدء Initiator Agent - ${leadsToProcess.length} leads...`);
      
      const res = await fetch("/api/agents/test/initiator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: selectedAccount,
          maxLeads: leadsToProcess.length,
          leadIds: leadsToProcess,
          commentOnly: false, // Always try both
          dmOnly: false,      // Always try both
          headless: false,
        }),
      });

      const data = await res.json();
      setResult(data);
      setLogs(data.logs || []);
      setExecutionProgress(100);

      if (data.success) {
        const stats = data.stats || {};
        toast.success(
          `✅ تم! ${stats.leadsProcessed || 0} leads - ${stats.commentsPosted || 0} تعليق - ${stats.dmsSent || 0} DM`
        );
        // Refresh leads list
        loadLeads();
      } else {
        toast.error(data.error || data.suggestion || "Initiator Agent فشل");
      }
    } catch (error) {
      toast.error("فشل في تشغيل Initiator Agent");
      console.error(error);
    } finally {
      setLoading(false);
      setRunningAgent(null);
    }
  }

  // Run Message Agent
  async function runMessageAgent() {
    if (!selectedAccount) {
      toast.error("Select an account");
      return;
    }

    setLoading(true);
    setRunningAgent("Message Agent");
    setLogs([]);
    setResult(null);

    try {
      toast.info("Starting Message Agent...");
      const res = await fetch("/api/agents/test/message-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: selectedAccount,
          idleTimeoutMs: idleTimeoutUnread * 1000,
          conversationTimeoutMs: idleTimeoutConversation * 1000,
          headless: false,
        }),
      });

      const data = await res.json();
      setResult(data);
      setLogs(data.logs || []);

      if (data.success) {
        toast.success(`Handled ${data.conversationsHandled?.length || 0} conversations, sent ${data.stats?.repliesSent || 0} replies`);
      } else {
        toast.error(data.error || "Message Agent failed");
      }
    } catch (error) {
      toast.error("Failed to run Message Agent");
      console.error(error);
    } finally {
      setLoading(false);
      setRunningAgent(null);
    }
  }

  // Run Conversation Initialization
  async function runConvInit() {
    if (!selectedAccount) {
      toast.error("Select an account");
      return;
    }

    setLoading(true);
    setRunningAgent("Conversation Init");
    setLogs([]);
    setConvInitResult(null);

    try {
      toast.info("Initializing conversations from Messenger...");
      const res = await fetch("/api/test/init-conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: selectedAccount,
          maxConversations: convInitMaxConversations,
          scrollCount: convInitScrollCount,
        }),
      });

      const data = await res.json();
      setConvInitResult(data);
      setLogs(data.logs || []);

      if (data.success) {
        toast.success(`Initialized ${data.created} new conversations, ${data.alreadyExisted} already existed`);
      } else {
        toast.error(data.errors?.[0] || "Conversation init failed");
      }
    } catch (error) {
      toast.error("Failed to initialize conversations");
      console.error(error);
    } finally {
      setLoading(false);
      setRunningAgent(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Navigation Warning Dialog */}
      <AlertDialog open={showNavigationWarning} onOpenChange={setShowNavigationWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-yellow-600">
              <AlertTriangle className="w-5 h-5" />
              Agent Running
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                <strong>{runningAgent}</strong> is currently running. 
                Navigating away may leave the browser open or cause issues.
              </p>
              <p className="text-yellow-600">
                Please wait for the agent to finish or stop it before switching tabs.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingTab(null)}>
              Stay Here
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={forceStopAgent}
              className="bg-red-600 hover:bg-red-700"
            >
              <StopCircle className="w-4 h-4 mr-2" />
              Stop Agent & Navigate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Running Agent Banner */}
      {runningAgent && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-yellow-600" />
            <div>
              <p className="font-medium text-yellow-600">{runningAgent} is running...</p>
              <p className="text-sm text-muted-foreground">
                Do not close this page or switch tabs until the agent finishes.
              </p>
            </div>
          </div>
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={forceStopAgent}
          >
            <StopCircle className="w-4 h-4 mr-2" />
            Force Stop
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Agent Testing</h1>
          <p className="text-muted-foreground">
            Test the 3-agent architecture: Scraper → Initiator → Message
          </p>
        </div>
        <Link href="/dashboard/agents/testing/conversation">
          <Button variant="outline" className="gap-2">
            <MessageSquare className="w-4 h-4" />
            Conversation Testing
            <ExternalLink className="w-3 h-3" />
          </Button>
        </Link>
      </div>

      {/* Account Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Select Account</CardTitle>
          <CardDescription>Choose a Facebook account to run agents with</CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      {/* Agent Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="flex w-full h-10">
          <TabsTrigger value="initializer" className="flex-1" disabled={loading}>
            <Database className="w-4 h-4 mr-2" />
            Group Init
          </TabsTrigger>
          <TabsTrigger value="conv-init" className="flex-1" disabled={loading}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Conv Init
          </TabsTrigger>
          <TabsTrigger value="scraper" className="flex-1" disabled={loading}>
            <Search className="w-4 h-4 mr-2" />
            Scraper
          </TabsTrigger>
          <TabsTrigger value="initiator" className="flex-1" disabled={loading} onClick={() => !loading && loadLeads()}>
            <Zap className="w-4 h-4 mr-2" />
            Initiator
          </TabsTrigger>
          <TabsTrigger value="message" className="flex-1" disabled={loading}>
            <MessageSquare className="w-4 h-4 mr-2" />
            Message
          </TabsTrigger>
        </TabsList>

        {/* ===== GROUP INITIALIZER ===== */}
        <TabsContent value="initializer">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-orange-500" />
                  🆕 Group Initializer
                </CardTitle>
                <CardDescription>
                  Initialize a NEW group by scraping historical posts.
                  This creates the initial set of Leads for a group. Run this ONCE per new group.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Groups Not Initialized */}
                <div className="space-y-2">
                  <Label>Select Group to Initialize</Label>
                  <p className="text-xs text-muted-foreground">
                    Choose an existing group that hasn&apos;t been initialized yet
                  </p>
                  <Select value={selectedGroupForInit} onValueChange={setSelectedGroupForInit}>
                    <SelectTrigger className="w-full max-w-md">
                      <SelectValue placeholder="Select a group to initialize" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.filter(g => !g.isInitialized).length === 0 ? (
                        <SelectItem value="none" disabled>
                          All groups are already initialized
                        </SelectItem>
                      ) : (
                        groups.filter(g => !g.isInitialized).map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {groups.filter(g => !g.isInitialized).length === 0 && (
                    <p className="text-sm text-green-600 mt-2">
                      ✓ All groups are initialized! Add new groups from the Groups page.
                    </p>
                  )}
                </div>

                {/* Target Posts Count */}
                <div className="space-y-2">
                  <Label htmlFor="initMaxPosts">Target Posts to Collect</Label>
                  <p className="text-xs text-muted-foreground">
                    Number of historical posts to scrape during initialization
                  </p>
                  <Input
                    id="initMaxPosts"
                    type="number"
                    min={50}
                    max={1000}
                    value={initializerMaxPosts}
                    onChange={(e) => setInitializerMaxPosts(Number(e.target.value))}
                    className="w-32"
                  />
                </div>

                <Button 
                  onClick={runGroupInitializer} 
                  disabled={loading || !selectedAccount || !selectedGroupForInit}
                >
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                  Initialize Group
                </Button>
              </CardContent>
            </Card>

            {/* Results Card */}
            {result && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    Initialization Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <p className="text-3xl font-bold text-primary">
                        {(result as { stats?: { postsScraped?: number } }).stats?.postsScraped || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Posts Scraped</p>
                    </div>
                    <div className="text-center p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                      <p className="text-3xl font-bold text-green-600">
                        {(result as { stats?: { leadsCreated?: number } }).stats?.leadsCreated || 0}
                      </p>
                      <p className="text-xs text-green-600 font-medium">Leads Created</p>
                    </div>
                    <div className="text-center p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                      <p className="text-3xl font-bold text-blue-600">
                        {(result as { stats?: { withAuthors?: number } }).stats?.withAuthors || 0}
                      </p>
                      <p className="text-xs text-blue-600 font-medium">With Authors</p>
                    </div>
                    <div className="text-center p-4 bg-orange-500/10 rounded-lg border border-orange-500/30">
                      <p className="text-3xl font-bold text-orange-600">
                        {(result as { stats?: { anonymous?: number } }).stats?.anonymous || 0}
                      </p>
                      <p className="text-xs text-orange-600 font-medium">Anonymous</p>
                    </div>
                  </div>

                  {logs.length > 0 && (
                    <div className="mt-4">
                      <Label className="mb-2">Logs</Label>
                      <ScrollArea className="h-48 border rounded-lg p-2">
                        <div className="font-mono text-xs space-y-1">
                          {logs.slice(-50).map((log, i) => (
                            <div key={i} className="hover:bg-muted p-1 rounded">{log}</div>
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

        {/* ===== CONVERSATION INIT ===== */}
        <TabsContent value="conv-init">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-cyan-500" />
                  🔄 Conversation Initializer
                </CardTitle>
                <CardDescription>
                  Scan Messenger for all conversations and match them to existing Leads.
                  Creates MessengerContact records for tracking.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 max-w-md">
                  <div className="space-y-2">
                    <Label>Max Conversations</Label>
                    <p className="text-xs text-muted-foreground">How many to scan</p>
                    <Input
                      type="number"
                      min={10}
                      max={200}
                      value={convInitMaxConversations}
                      onChange={(e) => setConvInitMaxConversations(parseInt(e.target.value) || 50)}
                      className="w-24"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Scroll Count</Label>
                    <p className="text-xs text-muted-foreground">How many times to scroll</p>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={convInitScrollCount}
                      onChange={(e) => setConvInitScrollCount(parseInt(e.target.value) || 3)}
                      className="w-24"
                    />
                  </div>
                </div>
                <Button onClick={runConvInit} disabled={loading || !selectedAccount} size="lg">
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  Initialize Conversations
                </Button>
              </CardContent>
            </Card>

            {convInitResult && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    Initialization Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <p className="text-3xl font-bold text-primary">
                        {convInitResult.totalScraped}
                      </p>
                      <p className="text-xs text-muted-foreground">Total Scraped</p>
                    </div>
                    <div className="text-center p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                      <p className="text-3xl font-bold text-green-600">
                        {convInitResult.created}
                      </p>
                      <p className="text-xs text-green-600 font-medium">Created</p>
                    </div>
                    <div className="text-center p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                      <p className="text-3xl font-bold text-blue-600">
                        {convInitResult.matchedToLeads}
                      </p>
                      <p className="text-xs text-blue-600 font-medium">Matched</p>
                    </div>
                    <div className="text-center p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                      <p className="text-3xl font-bold text-yellow-600">
                        {convInitResult.alreadyExisted}
                      </p>
                      <p className="text-xs text-yellow-600 font-medium">Already Existed</p>
                    </div>
                    <div className="text-center p-4 bg-gray-500/10 rounded-lg border border-gray-500/30">
                      <p className="text-3xl font-bold text-gray-600">
                        {convInitResult.unmatched}
                      </p>
                      <p className="text-xs text-gray-600 font-medium">Unmatched</p>
                    </div>
                  </div>

                  {/* Conversation List */}
                  <div className="space-y-2 mb-4">
                    <Label>Conversations</Label>
                    <ScrollArea className="h-64 border rounded-lg p-2">
                      <div className="space-y-2">
                        {convInitResult.conversations.map((conv, i) => (
                          <div key={i} className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-2 min-w-[200px]">
                              {conv.status === "created" ? (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              ) : conv.status === "existed" ? (
                                <Eye className="w-4 h-4 text-blue-500" />
                              ) : (
                                <AlertCircle className="w-4 h-4 text-gray-400" />
                              )}
                              <span className="font-medium text-sm truncate max-w-[180px]">
                                {conv.contactName}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {conv.status === "created" ? (
                                <Badge className="bg-green-500 text-white">
                                  ✅ Created
                                </Badge>
                              ) : conv.status === "existed" ? (
                                <Badge variant="secondary" className="text-blue-500">
                                  ⏭️ Existed
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-gray-500">
                                  ⚪ No Match
                                </Badge>
                              )}
                              {conv.authorName && (
                                <span className="text-xs text-muted-foreground">
                                  → {conv.authorName}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>

                  {logs.length > 0 && (
                    <div className="mt-4">
                      <Label className="mb-2">Logs</Label>
                      <ScrollArea className="h-48 border rounded-lg p-2">
                        <div className="font-mono text-xs space-y-1">
                          {logs.slice(-50).map((log, i) => (
                            <div key={i} className="hover:bg-muted p-1 rounded">{log}</div>
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

        {/* ===== SCRAPER AGENT ===== */}
        <TabsContent value="scraper">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="w-5 h-5 text-blue-500" />
                  🔍 Scraper Agent
                </CardTitle>
                <CardDescription>
                  Scrapes ALL groups, analyzes posts with AI, and creates Leads in database.
                  Uses ONE account to scrape everything.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Groups Selection */}
                <div className="space-y-2">
                  <Label>Groups to Scrape</Label>
                  <p className="text-xs text-muted-foreground">
                    Leave empty to scrape all active groups, or select specific groups
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {groups.map((group) => (
                      <Badge
                        key={group.id}
                        variant={selectedGroupIds.includes(group.id) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => {
                          if (selectedGroupIds.includes(group.id)) {
                            setSelectedGroupIds(selectedGroupIds.filter(id => id !== group.id));
                          } else {
                            setSelectedGroupIds([...selectedGroupIds, group.id]);
                          }
                        }}
                      >
                        {group.name || group.url.substring(0, 30)}
                        {group.isInitialized && <CheckCircle className="w-3 h-3 ml-1" />}
                      </Badge>
                    ))}
                  </div>
                  {groups.length === 0 && (
                    <p className="text-sm text-orange-500">No groups found. Add groups first!</p>
                  )}
                </div>

                <Button onClick={runScraperAgent} disabled={loading || !selectedAccount} size="lg">
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                  Run Scraper Agent
                </Button>
              </CardContent>
            </Card>

            {/* Scraper Results */}
            {result && (result as { stats?: { postsScraped?: number } }).stats && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    Scraper Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <p className="text-3xl font-bold text-primary">
                        {(result as { stats?: { groupsProcessed?: number } }).stats?.groupsProcessed || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Groups</p>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <p className="text-3xl font-bold text-blue-600">
                        {(result as { stats?: { postsScraped?: number } }).stats?.postsScraped || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Posts Scraped</p>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <p className="text-3xl font-bold text-purple-600">
                        {(result as { stats?: { postsAnalyzed?: number } }).stats?.postsAnalyzed || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">AI Analyzed</p>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <p className="text-3xl font-bold text-orange-600">
                        {(result as { stats?: { groupPostsCreated?: number } }).stats?.groupPostsCreated || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Posts Saved</p>
                    </div>
                    <div className="text-center p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                      <p className="text-3xl font-bold text-green-600">
                        {(result as { stats?: { leadsCreated?: number } }).stats?.leadsCreated || 0}
                      </p>
                      <p className="text-xs text-green-600 font-medium">Leads Created</p>
                    </div>
                  </div>

                  {logs.length > 0 && (
                    <div className="mt-4">
                      <Label className="mb-2">Logs</Label>
                      <ScrollArea className="h-48 border rounded-lg p-2">
                        <div className="font-mono text-xs space-y-1">
                          {logs.slice(-50).map((log, i) => (
                            <div key={i} className="hover:bg-muted p-1 rounded">{log}</div>
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

        {/* ===== INITIATOR AGENT ===== */}
        <TabsContent value="initiator">
          <div className="space-y-4">
            {/* Header Card */}
            <Card className="border-yellow-500/30 bg-gradient-to-r from-yellow-500/5 to-orange-500/5">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600 shadow-lg">
                      <Zap className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">⚡ Initiator Agent</CardTitle>
                      <CardDescription className="text-sm">
                        Comments on posts + sends DM to non-anonymous authors
                      </CardDescription>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={loadLeads} disabled={loading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-blue-500" />
                    <span className="text-muted-foreground">New Leads:</span>
                    <Badge variant="secondary">{leads.length}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-green-500" />
                    <span className="text-muted-foreground">Can DM:</span>
                    <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                      {leads.filter(l => {
                        const hasRealAuthor = l.authorName && l.authorName !== 'Anonymous' && l.authorName.trim() !== '' && l.authorProfileUrl;
                        return hasRealAuthor || (!l.isAnonymous && l.authorProfileUrl);
                      }).length}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <UserX className="w-4 h-4 text-orange-500" />
                    <span className="text-muted-foreground">Anonymous (comment only):</span>
                    <Badge variant="secondary" className="bg-orange-500/10 text-orange-600">
                      {leads.filter(l => {
                        const hasRealAuthor = l.authorName && l.authorName !== 'Anonymous' && l.authorName.trim() !== '' && l.authorProfileUrl;
                        return !(hasRealAuthor || (!l.isAnonymous && l.authorProfileUrl));
                      }).length}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Left: Lead Selection */}
              <div className="lg:col-span-2 space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Target className="w-5 h-5 text-blue-500" />
                        Select Leads
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {selectedLeadIds.length > 0 
                            ? `${selectedLeadIds.length} selected` 
                            : `first ${initiatorMaxLeads} leads`}
                        </span>
                        <Input
                          type="number"
                          min={1}
                          max={20}
                          value={initiatorMaxLeads}
                          onChange={(e) => setInitiatorMaxLeads(parseInt(e.target.value) || 5)}
                          className="w-16 h-8 text-center"
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px] pr-3">
                      {leads.length === 0 ? (
                        <div className="text-center py-12">
                          <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                          <h3 className="font-medium">No NEW Leads Available</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            Run Scraper Agent first!
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {leads.map((lead, idx) => {
                            const isSelected = selectedLeadIds.includes(lead.id);
                            const willProcess = isSelected || (selectedLeadIds.length === 0 && idx < initiatorMaxLeads);
                            // Smart anonymous detection: if we have a real name AND profile URL, not anonymous
                            const hasRealAuthor = lead.authorName && 
                              lead.authorName !== 'Anonymous' && 
                              lead.authorName.trim() !== '' && 
                              lead.authorProfileUrl;
                            const canDM = hasRealAuthor || (!lead.isAnonymous && lead.authorProfileUrl);
                            const preview = aiPreviews.get(lead.id);
                            
                            return (
                              <Collapsible key={lead.id}>
                                <div
                                  className={`p-3 rounded-lg border transition-all ${
                                    willProcess
                                      ? 'bg-primary/5 border-primary/30 shadow-sm'
                                      : 'hover:bg-muted/50 border-transparent'
                                  }`}
                                >
                                  <div className="flex items-start gap-3">
                                    {/* Checkbox area */}
                                    <div 
                                      className="pt-1 cursor-pointer"
                                      onClick={() => {
                                        if (isSelected) {
                                          setSelectedLeadIds(prev => prev.filter(id => id !== lead.id));
                                        } else {
                                          setSelectedLeadIds(prev => [...prev, lead.id]);
                                        }
                                      }}
                                    >
                                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                        willProcess 
                                          ? 'bg-primary border-primary text-primary-foreground' 
                                          : 'border-muted-foreground/30'
                                      }`}>
                                        {willProcess && <CheckCircle className="w-3 h-3" />}
                                      </div>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        {/* Author */}
                                        <span className="font-medium text-sm">
                                          {lead.authorName || "Anonymous"}
                                        </span>
                                        
                                        {/* Service badge */}
                                        {lead.matchedService && (
                                          <Badge variant="outline" className="text-xs">
                                            {lead.matchedService}
                                          </Badge>
                                        )}
                                        
                                        {/* Intent score */}
                                        <Badge 
                                          variant="secondary" 
                                          className={`text-xs ${
                                            lead.intentScore >= 70 ? 'bg-green-500/10 text-green-600' :
                                            lead.intentScore >= 40 ? 'bg-yellow-500/10 text-yellow-600' :
                                            'bg-gray-500/10'
                                          }`}
                                        >
                                          {lead.intentScore}%
                                        </Badge>

                                        {/* Action indicators */}
                                        <div className="flex items-center gap-1 mr-auto">
                                          <Badge variant="secondary" className="text-xs bg-blue-500/10 text-blue-600">
                                            <MessageCircle className="w-3 h-3 mr-1" />
                                            Comment
                                          </Badge>
                                          {canDM ? (
                                            <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600">
                                              <Send className="w-3 h-3 mr-1" />
                                              DM
                                            </Badge>
                                          ) : (
                                            <Badge variant="secondary" className="text-xs bg-orange-500/10 text-orange-600">
                                              <UserX className="w-3 h-3 mr-1" />
                                              Anonymous
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                      
                                      {/* Post text preview */}
                                      <p className="text-xs text-muted-foreground line-clamp-2" dir="rtl">
                                        {lead.postText}
                                      </p>
                                    </div>

                                    {/* Preview button */}
                                    <CollapsibleTrigger asChild>
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="shrink-0"
                                        onClick={() => {
                                          if (!preview) {
                                            generateAIPreview(lead);
                                          }
                                        }}
                                        disabled={previewingLead === lead.id}
                                      >
                                        {previewingLead === lead.id ? (
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : preview ? (
                                          <Eye className="w-4 h-4" />
                                        ) : (
                                          <Sparkles className="w-4 h-4" />
                                        )}
                                      </Button>
                                    </CollapsibleTrigger>
                                  </div>

                                  {/* AI Preview */}
                                  <CollapsibleContent>
                                    {preview && !preview.loading && (
                                      <div className="mt-3 pt-3 border-t space-y-3" dir="ltr">
                                        {/* Comment preview */}
                                        <div className="space-y-1">
                                          <div className="flex items-center gap-2">
                                            <MessageCircle className="w-4 h-4 text-blue-500" />
                                            <span className="text-xs font-medium">Comment:</span>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 px-2"
                                              onClick={() => {
                                                navigator.clipboard.writeText(preview.comment);
                                                toast.success("Copied!");
                                              }}
                                            >
                                              <Copy className="w-3 h-3" />
                                            </Button>
                                          </div>
                                          <div className="bg-blue-500/10 rounded-lg p-2 text-sm">
                                            {preview.comment}
                                          </div>
                                        </div>

                                        {/* DM preview */}
                                        {preview.canDM && preview.dm && (
                                          <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                              <Send className="w-4 h-4 text-green-500" />
                                              <span className="text-xs font-medium">First DM:</span>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 px-2"
                                                onClick={() => {
                                                  navigator.clipboard.writeText(preview.dm!);
                                                  toast.success("Copied!");
                                                }}
                                              >
                                                <Copy className="w-3 h-3" />
                                              </Button>
                                            </div>
                                            <div className="bg-green-500/10 rounded-lg p-2 text-sm">
                                              {preview.dm}
                                            </div>
                                          </div>
                                        )}

                                        {!preview.canDM && (
                                          <div className="flex items-center gap-2 text-xs text-orange-600 bg-orange-500/10 rounded-lg p-2">
                                            <UserX className="w-4 h-4" />
                                            No DM will be sent - Author is anonymous
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </CollapsibleContent>
                                </div>
                              </Collapsible>
                            );
                          })}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              {/* Right: Controls & Execution */}
              <div className="space-y-4">
                {/* Execution Summary */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Bot className="w-5 h-5 text-purple-500" />
                      Execution Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {(() => {
                      const toProcess = selectedLeadIds.length > 0 
                        ? leads.filter(l => selectedLeadIds.includes(l.id))
                        : leads.slice(0, initiatorMaxLeads);
                      const commentCount = toProcess.length;
                      
                      // Smart check: if we have real author name + profile URL, can DM
                      const canDMCheck = (l: Lead) => {
                        const hasRealAuthor = l.authorName && 
                          l.authorName !== 'Anonymous' && 
                          l.authorName.trim() !== '' && 
                          l.authorProfileUrl;
                        return hasRealAuthor || (!l.isAnonymous && l.authorProfileUrl);
                      };
                      
                      const dmCount = toProcess.filter(canDMCheck).length;
                      const anonymousCount = toProcess.filter(l => !canDMCheck(l)).length;
                      
                      return (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="text-center p-3 bg-muted rounded-lg">
                              <p className="text-2xl font-bold text-primary">{toProcess.length}</p>
                              <p className="text-xs text-muted-foreground">Leads</p>
                            </div>
                            <div className="text-center p-3 bg-blue-500/10 rounded-lg">
                              <p className="text-2xl font-bold text-blue-600">{commentCount}</p>
                              <p className="text-xs text-blue-600">Comments</p>
                            </div>
                            <div className="text-center p-3 bg-green-500/10 rounded-lg">
                              <p className="text-2xl font-bold text-green-600">{dmCount}</p>
                              <p className="text-xs text-green-600">DM</p>
                            </div>
                            <div className="text-center p-3 bg-orange-500/10 rounded-lg">
                              <p className="text-2xl font-bold text-orange-600">{anonymousCount}</p>
                              <p className="text-xs text-orange-600">Anonymous</p>
                            </div>
                          </div>

                          <Separator />

                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                              <ArrowRight className="w-4 h-4 text-muted-foreground" />
                              <span>Will comment on <strong>{commentCount}</strong> posts</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <ArrowRight className="w-4 h-4 text-muted-foreground" />
                              <span>Will send DM to <strong>{dmCount}</strong> people</span>
                            </div>
                            {anonymousCount > 0 && (
                              <div className="flex items-center gap-2 text-orange-600">
                                <AlertCircle className="w-4 h-4" />
                                <span><strong>{anonymousCount}</strong> anonymous = comment only</span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 p-2 bg-muted rounded-lg text-xs text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            <span>Estimated time: ~{Math.ceil(toProcess.length * 1.5)} min</span>
                          </div>
                        </>
                      );
                    })()}
                  </CardContent>
                </Card>

                {/* Action Buttons */}
                <Card>
                  <CardContent className="pt-4 space-y-3">
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={generateAllPreviews}
                      disabled={loading || leads.length === 0}
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Preview AI for All
                    </Button>

                    <Button 
                      className="w-full h-12 text-lg bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700"
                      onClick={runInitiatorAgent}
                      disabled={loading || !selectedAccount || leads.length === 0}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Running...
                        </>
                      ) : (
                        <>
                          <Play className="w-5 h-5 mr-2" />
                          Run Initiator Agent
                        </>
                      )}
                    </Button>

                    {loading && (
                      <div className="space-y-2">
                        <Progress value={executionProgress} className="h-2" />
                        <p className="text-xs text-center text-muted-foreground">
                          {currentLeadName ? `Processing: ${currentLeadName}` : 'Preparing...'}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Logs */}
                {logs.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Logs</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-48">
                        <div className="font-mono text-xs space-y-1" dir="ltr">
                          {logs.slice(-30).map((log, i) => (
                            <div key={i} className={`p-1 rounded ${
                              log.includes('✅') ? 'bg-green-500/10 text-green-600' :
                              log.includes('❌') ? 'bg-red-500/10 text-red-600' :
                              log.includes('⏭️') ? 'bg-orange-500/10 text-orange-600' :
                              'hover:bg-muted'
                            }`}>
                              {log.split('] ')[1] || log}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {/* Results Card */}
            {result && (result as { stats?: { leadsProcessed?: number } }).stats && (
              <Card className="border-green-500/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    Initiator Agent Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <p className="text-3xl font-bold text-primary">
                        {(result as { stats?: { leadsProcessed?: number } }).stats?.leadsProcessed || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Leads Processed</p>
                    </div>
                    <div className="text-center p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                      <p className="text-3xl font-bold text-blue-600">
                        {(result as { stats?: { commentsPosted?: number } }).stats?.commentsPosted || 0}
                      </p>
                      <p className="text-xs text-blue-600 font-medium">Comments</p>
                    </div>
                    <div className="text-center p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                      <p className="text-3xl font-bold text-green-600">
                        {(result as { stats?: { dmsSent?: number } }).stats?.dmsSent || 0}
                      </p>
                      <p className="text-xs text-green-600 font-medium">DMs</p>
                    </div>
                    <div className="text-center p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
                      <p className="text-3xl font-bold text-purple-600">
                        {(result as { stats?: { contactsCreated?: number } }).stats?.contactsCreated || 0}
                      </p>
                      <p className="text-xs text-purple-600 font-medium">Contacts</p>
                    </div>
                    <div className="text-center p-4 bg-orange-500/10 rounded-lg border border-orange-500/30">
                      <p className="text-3xl font-bold text-orange-600">
                        {(result as { stats?: { conversationsCreated?: number } }).stats?.conversationsCreated || 0}
                      </p>
                      <p className="text-xs text-orange-600 font-medium">Conversations</p>
                    </div>
                  </div>

                  {(result as { leadResults?: Array<{ leadId: string; authorName: string | null; isAnonymous: boolean; commented: boolean; dmSent: boolean; commentError?: string; dmError?: string }> }).leadResults && (
                    <div className="space-y-2">
                      <Label>Lead Details</Label>
                      <div className="grid gap-2">
                        {((result as { leadResults?: Array<{ leadId: string; authorName: string | null; isAnonymous: boolean; commented: boolean; dmSent: boolean; commentError?: string; dmError?: string }> }).leadResults || []).map((lr, i) => (
                          <div key={i} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-2 min-w-[150px]">
                              {lr.isAnonymous ? (
                                <UserX className="w-4 h-4 text-orange-500" />
                              ) : (
                                <User className="w-4 h-4 text-green-500" />
                              )}
                              <span className="font-medium text-sm">{lr.authorName || "Anonymous"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {lr.commented ? (
                                <Badge className="bg-blue-500 text-white">
                                  <MessageCircle className="w-3 h-3 mr-1" />
                                  ✅ Commented
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-red-500">
                                  ❌ {lr.commentError?.substring(0, 20) || "Failed"}
                                </Badge>
                              )}
                              {!lr.isAnonymous && (
                                lr.dmSent ? (
                                  <Badge className="bg-green-500 text-white">
                                    <Send className="w-3 h-3 mr-1" />
                                    ✅ DM
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-red-500">
                                    ❌ {lr.dmError?.substring(0, 20) || "Failed"}
                                  </Badge>
                                )
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ===== MESSAGE AGENT ===== */}
        <TabsContent value="message">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-purple-500" />
                  💬 Message Agent
                </CardTitle>
                <CardDescription>
                  Monitors Messenger for replies, generates AI responses with full lead context,
                  and extracts contact info (phone/WhatsApp).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-6">
                  <div className="space-y-2">
                    <Label>Idle Timeout - Unread (seconds)</Label>
                    <p className="text-xs text-muted-foreground">Stop if no unread messages for this long</p>
                    <Input
                      type="number"
                      min={30}
                      max={600}
                      value={idleTimeoutUnread}
                      onChange={(e) => setIdleTimeoutUnread(parseInt(e.target.value) || 120)}
                      className="w-24"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Wait Time - Conversation (seconds)</Label>
                    <p className="text-xs text-muted-foreground">How long to wait for reply in each conversation</p>
                    <Input
                      type="number"
                      min={30}
                      max={300}
                      value={idleTimeoutConversation}
                      onChange={(e) => setIdleTimeoutConversation(parseInt(e.target.value) || 60)}
                      className="w-24"
                    />
                  </div>
                </div>
                <Button onClick={runMessageAgent} disabled={loading || !selectedAccount} size="lg">
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                  Run Message Agent
                </Button>
              </CardContent>
            </Card>

            {result && (result as { conversationsHandled?: unknown[] }).conversationsHandled && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    Message Agent Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <p className="text-3xl font-bold text-primary">
                        {(result as { stats?: { cyclesCompleted?: number } }).stats?.cyclesCompleted || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Cycles</p>
                    </div>
                    <div className="text-center p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                      <p className="text-3xl font-bold text-blue-600">
                        {(result as { stats?: { conversationsProcessed?: number } }).stats?.conversationsProcessed || 0}
                      </p>
                      <p className="text-xs text-blue-600 font-medium">Conversations</p>
                    </div>
                    <div className="text-center p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                      <p className="text-3xl font-bold text-green-600">
                        {(result as { stats?: { repliesSent?: number } }).stats?.repliesSent || 0}
                      </p>
                      <p className="text-xs text-green-600 font-medium">Replies Sent</p>
                    </div>
                    <div className="text-center p-4 bg-orange-500/10 rounded-lg border border-orange-500/30">
                      <p className="text-3xl font-bold text-orange-600">
                        {(result as { stats?: { contactsExtracted?: number } }).stats?.contactsExtracted || 0}
                      </p>
                      <p className="text-xs text-orange-600 font-medium">Contacts Extracted</p>
                    </div>
                  </div>

                  {logs.length > 0 && (
                    <div className="mt-4">
                      <Label className="mb-2">Logs</Label>
                      <ScrollArea className="h-48 border rounded-lg p-2">
                        <div className="font-mono text-xs space-y-1">
                          {logs.slice(-50).map((log, i) => (
                            <div key={i} className="hover:bg-muted p-1 rounded">{log}</div>
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


      </Tabs>
    </div>
  );
}
