'use client';

import { useState, useEffect } from 'react';
import { 
  FlaskConical, 
  Play, 
  Bot, 
  Globe,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Flame,
  MessageSquare,
  Zap,
  UserPlus,
  Send,
  Heart,
  Users,
  ExternalLink,
  MessageCircle,
  Database,
  RefreshCw,
  Trash2,
  Activity,
  Eye,
  Clock,
  Hash,
  User,
  MessageSquareText,
  ArrowRightLeft,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

interface AIAnalysisResult {
  intent_score: number;
  need_type: string;
  urgency: number;
  budget_signals: string[];
  suggested_response: string;
  reasoning: string;
  matched_services?: string[];
}

interface ScrapeResult {
  success: boolean;
  postsFound: number;
  posts: Array<{
    authorName: string;
    postText: string;
    postDate?: string;
  }>;
  error?: string;
}

interface EngageResult {
  success: boolean;
  steps: {
    postOpened: boolean;
    commentPosted: boolean;
    profileFound: boolean;
    friendRequestSent: boolean;
    dmSent: boolean;
  };
  authorName: string;
  authorProfileUrl: string | null;
  isAnonymous: boolean;
  logs: string[];
  errors: string[];
}

interface ProfileResult {
  authorName: string;
  profileUrl: string;
  postPreview: string;
  foundWith: string;
}

interface FindProfilesResult {
  success: boolean;
  profilesFound: ProfileResult[];
  postsChecked: number;
  anonymousPosts: number;
  logs: string[];
  errors: string[];
}

interface ExtractedPost {
  index: number;
  content: string;
  postUrl: string | null;
  authorName: string;
  authorProfileUrl: string | null;
  isAnonymous: boolean;
}

interface ExtractPostsResult {
  success: boolean;
  posts: ExtractedPost[];
  logs: string[];
  errors: string[];
}

interface SinglePostResult {
  success: boolean;
  postUrl: string;
  content: string;
  authorName: string;
  authorProfileUrl: string | null;
  isAnonymous: boolean;
  hasDialog: boolean;
  logs: string[];
  errors: string[];
}

interface AIReplyResult {
  success: boolean;
  personName: string;
  messagesFound: number;
  conversation: Array<{ sender: 'them' | 'us'; text: string }>;
  messagesSent: string[];
  totalRepliesSent: number;
  logs: string[];
  errors: string[];
}

interface ConversationProcessed {
  contactName: string;
  messagesRead: number;
  replySent: boolean;
  replyText: string;
  extractedPhone?: string;
  extractedWhatsApp?: string;
}

// Production Message Agent result types
interface MessengerContact {
  id: string;
  name: string;
  state: string;
  status: string;
  lastMessageAt: string | null;
  messagesReceived: number;
  messagesSent: number;
  leadId?: string | null;
  leadStage?: string | null;
}

interface MessageAgentStats {
  summary: {
    total: number;
    active: number;
    old: number;
    needsReply: number;
    waiting: number;
    linkedToLead: number;
  };
  byState: Record<string, number>;
  needsReplyContacts: MessengerContact[];
  recentActivity: MessengerContact[];
}

interface MessageAgentActionResult {
  success: boolean;
  action: string;
  stats: {
    new: number;
    returning: number;
    unchanged: number;
    total: number;
    needsReply: number;
    archived?: number;
  };
  logs: string[];
  error?: string;
}

export default function TestingPage() {
  // AI Testing State
  const [postText, setPostText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Scrape Testing State
  const [groupUrl, setGroupUrl] = useState('');
  const [accountId, setAccountId] = useState('');
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null);
  const [scrapeError, setScrapeError] = useState<string | null>(null);

  // Engagement Testing State
  const [engagePostUrl, setEngagePostUrl] = useState('');
  const [engageAccountId, setEngageAccountId] = useState('');
  const [engageComment, setEngageComment] = useState('');
  const [engageDmMessage, setEngageDmMessage] = useState('');
  const [engageSendFriendRequest, setEngageSendFriendRequest] = useState(true);
  const [engageSendDm, setEngageSendDm] = useState(true);
  const [engageLoading, setEngageLoading] = useState(false);
  const [engageResult, setEngageResult] = useState<EngageResult | null>(null);
  const [engageError, setEngageError] = useState<string | null>(null);

  // Find Profiles Testing State
  const [findProfilesGroupUrl, setFindProfilesGroupUrl] = useState('');
  const [findProfilesAccountId, setFindProfilesAccountId] = useState('');
  const [findProfilesLoading, setFindProfilesLoading] = useState(false);
  const [findProfilesResult, setFindProfilesResult] = useState<FindProfilesResult | null>(null);
  const [findProfilesError, setFindProfilesError] = useState<string | null>(null);

  // Extract Posts Testing State
  const [extractGroupUrl, setExtractGroupUrl] = useState('');
  const [extractAccountId, setExtractAccountId] = useState('');
  const [extractMaxPosts, setExtractMaxPosts] = useState(10);
  const [extractLoading, setExtractLoading] = useState(false);
  const [extractResult, setExtractResult] = useState<ExtractPostsResult | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);

  // Single Post Testing State
  const [singlePostUrl, setSinglePostUrl] = useState('');
  const [singlePostAccountId, setSinglePostAccountId] = useState('');
  const [singlePostLoading, setSinglePostLoading] = useState(false);
  const [singlePostResult, setSinglePostResult] = useState<SinglePostResult | null>(null);
  const [singlePostError, setSinglePostError] = useState<string | null>(null);

  // AI Reply Testing State
  const [aiReplyPersonName, setAiReplyPersonName] = useState('');
  const [aiReplyAccountId, setAiReplyAccountId] = useState('');
  const [aiReplyMaxMessages, setAiReplyMaxMessages] = useState(3);
  const [aiReplyLoading, setAiReplyLoading] = useState(false);
  const [aiReplyResult, setAiReplyResult] = useState<AIReplyResult | null>(null);
  const [aiReplyError, setAiReplyError] = useState<string | null>(null);

  // Message Agent Testing State (Production DB-backed)
  const [msgAgentAccountId, setMsgAgentAccountId] = useState('');
  const [msgAgentAction, setMsgAgentAction] = useState<'init' | 'scan' | 'reply' | 'maintenance'>('scan');
  const [msgAgentMaxReplies, setMsgAgentMaxReplies] = useState(3);
  const [msgAgentLoading, setMsgAgentLoading] = useState(false);
  const [msgAgentResult, setMsgAgentResult] = useState<MessageAgentActionResult | null>(null);
  const [msgAgentStats, setMsgAgentStats] = useState<MessageAgentStats | null>(null);
  const [msgAgentError, setMsgAgentError] = useState<string | null>(null);
  const [msgAgentLogs, setMsgAgentLogs] = useState<string[]>([]);

  // Debug Messages Testing State
  const [debugAccountId, setDebugAccountId] = useState('');
  const [debugConvoName, setDebugConvoName] = useState('');
  const [debugLoading, setDebugLoading] = useState(false);
  const [debugResult, setDebugResult] = useState<{
    success: boolean;
    account: string;
    conversationName: string;
    totalRows: number;
    totalDirAuto: number;
    messages: Array<{
      index: number;
      text: string;
      bgColor: string;
      boundingLeft: number;
      containerCenter: number;
      isRightSide: boolean;
      isOutgoing: boolean;
      fontSize?: string;
      fontWeight?: string;
      fontFamily?: string;
      lineHeight?: string;
      color?: string;
    }>;
  } | null>(null);
  const [debugError, setDebugError] = useState<string | null>(null);

  // State Machine Testing State
  const [smAccountId, setSmAccountId] = useState('');
  const [smAction, setSmAction] = useState<'init' | 'scan' | 'count' | 'full'>('scan');
  const [smStartFromContact, setSmStartFromContact] = useState('');
  const [smLoading, setSmLoading] = useState(false);
  const [smLogs, setSmLogs] = useState<string[]>([]);
  const [smStates, setSmStates] = useState<Array<{
    id: string;
    contactFbId: string;
    contactName: string;
    conversationUrl: string;
    state: string;
    totalMessageCount: number;
    theirMessageCount: number;
    ourMessageCount: number;
    lastTheirMessage?: string;
    lastCheckedAt: string;
    debugInfo?: string;
  }>>([]);
  const [smChanges, setSmChanges] = useState<Array<{
    contact: string;
    from: string;
    to: string;
    reason: string;
  }>>([]);
  const [smSummary, setSmSummary] = useState<{
    total: number;
    needsReply: number;
    waiting: number;
    active: number;
    idle: number;
    ended: number;
    totalMessages: number;
    totalTheirs: number;
    totalOurs: number;
  } | null>(null);
  const [smError, setSmError] = useState<string | null>(null);
  const [smSelectedConv, setSmSelectedConv] = useState<{
    id: string;
    contactFbId: string;
    contactName: string;
    conversationUrl: string;
    state: string;
    totalMessageCount: number;
    theirMessageCount: number;
    ourMessageCount: number;
    lastTheirMessage?: string;
    lastCheckedAt: string;
    debugInfo?: string;
  } | null>(null);

  // Sample posts for quick testing
  const samplePosts = [
    {
      title: "Urgent Plumber Needed",
      text: "Ciao a tutti! Ho un'emergenza idraulica, il tubo sotto il lavandino si è rotto e c'è acqua ovunque! Qualcuno può venire oggi? Pago subito, budget non è un problema. Zona Milano centro."
    },
    {
      title: "Looking for Electrician",
      text: "Buongiorno, cerco un elettricista per installare alcune prese nuove in casa. Non è urgente, magari la prossima settimana. Qualcuno mi può fare un preventivo? Grazie!"
    },
    {
      title: "Home Renovation Help",
      text: "Stiamo ristrutturando casa e abbiamo bisogno di un tuttofare per piccoli lavori: montare mensole, sistemare una porta, pitturare una stanza. Chi è disponibile? Budget circa 500€."
    },
    {
      title: "AC Repair Needed",
      text: "Il mio condizionatore non funziona più, fa un rumore strano e non raffredda. Qualcuno conosce un buon tecnico per riparazioni climatizzatori? Preferirei entro questa settimana."
    }
  ];

  // Load accounts on mount
  useEffect(() => {
    fetch('/api/accounts')
      .then(res => res.json())
      .then(data => {
        // API returns { accounts: [...] }
        const accountsList = data.accounts || data;
        if (Array.isArray(accountsList)) {
          setAccounts(accountsList.map((a: { id: string; name: string }) => ({ id: a.id, name: a.name })));
          if (accountsList.length > 0) {
            setAccountId(accountsList[0].id);
            setEngageAccountId(accountsList[0].id);
            setFindProfilesAccountId(accountsList[0].id);
            setExtractAccountId(accountsList[0].id);
            setSinglePostAccountId(accountsList[0].id);
            setAiReplyAccountId(accountsList[0].id);
            setMsgAgentAccountId(accountsList[0].id);
            setDebugAccountId(accountsList[0].id);
            setSmAccountId(accountsList[0].id);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load accounts:', err);
      });
  }, []);

  const testAI = async () => {
    if (!postText.trim()) {
      toast.error('Please enter post text to analyze');
      return;
    }

    setAiLoading(true);
    setAiResult(null);
    setAiError(null);

    try {
      const response = await fetch('/api/test/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postText: postText.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze post');
      }

      setAiResult(data);
      toast.success('AI analysis complete!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setAiError(message);
      toast.error(message);
    } finally {
      setAiLoading(false);
    }
  };

  const testScrape = async () => {
    if (!groupUrl.trim()) {
      toast.error('Please enter a Facebook group URL');
      return;
    }

    if (!accountId) {
      toast.error('Please select an account to use');
      return;
    }

    setScrapeLoading(true);
    setScrapeResult(null);
    setScrapeError(null);

    try {
      const response = await fetch('/api/test/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          groupUrl: groupUrl.trim(),
          accountId 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to scrape group');
      }

      setScrapeResult(data);
      toast.success(`Found ${data.postsFound} posts!`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setScrapeError(message);
      toast.error(message);
    } finally {
      setScrapeLoading(false);
    }
  };

  const testEngage = async () => {
    if (!engagePostUrl.trim()) {
      toast.error('Please enter a Facebook post URL');
      return;
    }

    if (!engageAccountId) {
      toast.error('Please select an account to use');
      return;
    }

    setEngageLoading(true);
    setEngageResult(null);
    setEngageError(null);

    try {
      const response = await fetch('/api/test/engage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          postUrl: engagePostUrl.trim(),
          accountId: engageAccountId,
          comment: engageComment.trim() || undefined,
          dmMessage: engageDmMessage.trim() || undefined,
        }),
      });

      const data = await response.json();

      setEngageResult(data);
      
      if (data.success) {
        toast.success('Engagement test completed!');
      } else if (data.errors?.length > 0) {
        toast.error(data.errors[0]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setEngageError(message);
      toast.error(message);
    } finally {
      setEngageLoading(false);
    }
  };

  const testFindProfiles = async () => {
    if (!findProfilesGroupUrl.trim()) {
      toast.error('Please enter a Facebook group URL');
      return;
    }

    if (!findProfilesAccountId) {
      toast.error('Please select an account to use');
      return;
    }

    setFindProfilesLoading(true);
    setFindProfilesResult(null);
    setFindProfilesError(null);

    try {
      const response = await fetch('/api/test/find-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          groupUrl: findProfilesGroupUrl.trim(),
          accountId: findProfilesAccountId,
          maxProfiles: 3,
        }),
      });

      const data = await response.json();

      setFindProfilesResult(data);
      
      if (data.success) {
        toast.success(`Found ${data.profilesFound.length} profiles!`);
      } else if (data.errors?.length > 0) {
        toast.error(data.errors[0]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setFindProfilesError(message);
      toast.error(message);
    } finally {
      setFindProfilesLoading(false);
    }
  };

  const testExtractPosts = async () => {
    if (!extractGroupUrl.trim()) {
      toast.error('Please enter a Facebook group URL');
      return;
    }

    if (!extractAccountId) {
      toast.error('Please select an account to use');
      return;
    }

    setExtractLoading(true);
    setExtractResult(null);
    setExtractError(null);

    try {
      const response = await fetch('/api/test/extract-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          groupUrl: extractGroupUrl.trim(),
          accountId: extractAccountId,
          maxPosts: extractMaxPosts,
        }),
      });

      const data = await response.json();

      setExtractResult(data);
      
      if (data.success) {
        toast.success(`Extracted ${data.posts.length} posts!`);
      } else if (data.errors?.length > 0) {
        toast.error(data.errors[0]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setExtractError(message);
      toast.error(message);
    } finally {
      setExtractLoading(false);
    }
  };

  const testSinglePost = async () => {
    if (!singlePostUrl.trim()) {
      toast.error('Please enter a Facebook post URL');
      return;
    }

    if (!singlePostAccountId) {
      toast.error('Please select an account to use');
      return;
    }

    setSinglePostLoading(true);
    setSinglePostResult(null);
    setSinglePostError(null);

    try {
      const response = await fetch('/api/test/single-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          postUrl: singlePostUrl.trim(),
          accountId: singlePostAccountId,
        }),
      });

      const data = await response.json();

      setSinglePostResult(data);
      
      if (data.success) {
        toast.success('Post content extracted!');
      } else if (data.errors?.length > 0) {
        toast.error(data.errors[0]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setSinglePostError(message);
      toast.error(message);
    } finally {
      setSinglePostLoading(false);
    }
  };

  const testAiReply = async () => {
    if (!aiReplyPersonName.trim()) {
      toast.error('Please enter a person name to check messages with');
      return;
    }

    if (!aiReplyAccountId) {
      toast.error('Please select an account to use');
      return;
    }

    setAiReplyLoading(true);
    setAiReplyResult(null);
    setAiReplyError(null);

    try {
      const response = await fetch('/api/test/ai-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          personName: aiReplyPersonName.trim(),
          accountId: aiReplyAccountId,
          maxMessages: aiReplyMaxMessages,
          waitTimeout: 60000, // 1 minute wait for each reply
        }),
      });

      const data = await response.json();

      setAiReplyResult(data);
      
      if (data.success) {
        toast.success(`Sent ${data.totalRepliesSent} messages in Tunisian!`);
      } else if (data.errors?.length > 0) {
        toast.error(data.errors[0]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setAiReplyError(message);
      toast.error(message);
    } finally {
      setAiReplyLoading(false);
    }
  };

  // Fetch Message Agent stats
  const fetchMsgAgentStats = async (accId: string) => {
    try {
      const response = await fetch(`/api/message-agent/stats?accountId=${accId}`);
      const data = await response.json();
      setMsgAgentStats(data);
    } catch (err) {
      console.error('Failed to fetch message agent stats:', err);
    }
  };

  const startMessageAgent = async () => {
    if (!msgAgentAccountId) {
      toast.error('Please select an account to use');
      return;
    }

    setMsgAgentLoading(true);
    setMsgAgentResult(null);
    setMsgAgentError(null);
    setMsgAgentLogs([]);

    try {
      const actionName = msgAgentAction === 'init' ? 'Init (Full Scan)' :
                         msgAgentAction === 'scan' ? 'Scan (Smart Boundary)' :
                         msgAgentAction === 'reply' ? 'Reply (Send AI Messages)' :
                         'Maintenance (Archive Old)';
      toast.info(`Starting ${actionName}... Browser will open.`);
      
      const response = await fetch('/api/message-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          accountId: msgAgentAccountId,
          action: msgAgentAction,
          maxReplies: msgAgentMaxReplies,
        }),
      });

      const data = await response.json();
      setMsgAgentResult(data);
      
      if (data.logs) {
        setMsgAgentLogs(data.logs);
      }
      
      if (data.success) {
        const stats = data.stats || {};
        toast.success(`${actionName} completed! New: ${stats.new || 0}, Returning: ${stats.returning || 0}`);
        // Refresh stats after action
        await fetchMsgAgentStats(msgAgentAccountId);
      } else if (data.error) {
        toast.error(data.error);
        setMsgAgentError(data.error);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setMsgAgentError(message);
      toast.error(message);
    } finally {
      setMsgAgentLoading(false);
    }
  };

  // Fetch stats when account changes
  useEffect(() => {
    if (msgAgentAccountId) {
      fetchMsgAgentStats(msgAgentAccountId);
    }
  }, [msgAgentAccountId]);

  const testDebugMessages = async () => {
    if (!debugAccountId || !debugConvoName.trim()) {
      toast.error('Please select an account and enter a conversation name');
      return;
    }

    setDebugLoading(true);
    setDebugResult(null);
    setDebugError(null);

    try {
      toast.info('Extracting message elements... Browser will open.');
      
      const response = await fetch('/api/test/debug-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          accountId: debugAccountId,
          conversationName: debugConvoName.trim(),
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setDebugResult(data);
        toast.success(`Extracted ${data.totalDirAuto} messages from ${data.totalRows} rows`);
      } else {
        setDebugError(data.error || 'Unknown error');
        toast.error(data.error || 'Failed to extract messages');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setDebugError(message);
      toast.error(message);
    } finally {
      setDebugLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const getIntentColor = (score: number) => {
    if (score >= 5) return 'text-red-500';
    if (score >= 4) return 'text-orange-500';
    if (score >= 3) return 'text-yellow-500';
    return 'text-muted-foreground';
  };

  const getIntentBadge = (score: number) => {
    if (score >= 5) return 'destructive';
    if (score >= 4) return 'default';
    return 'secondary';
  };

  // State Machine Functions
  const loadSmStates = async () => {
    if (!smAccountId) return;
    
    try {
      const res = await fetch(`/api/test/state-machine?accountId=${smAccountId}`);
      if (res.ok) {
        const data = await res.json();
        setSmStates(data.states || []);
        setSmSummary(data.summary || null);
      }
    } catch (error) {
      console.error("Failed to load states:", error);
    }
  };

  const runStateMachine = async () => {
    if (!smAccountId) {
      toast.error("Please select an account");
      return;
    }

    setSmLoading(true);
    setSmLogs([]);
    setSmChanges([]);
    setSmError(null);

    try {
      toast.info(`Running State Machine: ${smAction}...`);
      const res = await fetch("/api/test/state-machine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: smAccountId,
          action: smAction,
          startFromContact: smAction === 'init' ? smStartFromContact : undefined,
        }),
      });

      const data = await res.json();
      setSmLogs(data.logs || []);
      setSmStates(data.states || []);
      setSmChanges(data.changes || []);
      
      const states = data.states || [];
      const totalMessages = states.reduce((sum: number, s: { totalMessageCount: number }) => sum + (s.totalMessageCount || 0), 0);
      const totalTheirs = states.reduce((sum: number, s: { theirMessageCount: number }) => sum + (s.theirMessageCount || 0), 0);
      const totalOurs = states.reduce((sum: number, s: { ourMessageCount: number }) => sum + (s.ourMessageCount || 0), 0);
      
      setSmSummary({
        total: states.length,
        needsReply: states.filter((s: { state: string }) => s.state === 'NEEDS_REPLY').length,
        waiting: states.filter((s: { state: string }) => s.state === 'WAITING').length,
        active: states.filter((s: { state: string }) => s.state === 'ACTIVE').length,
        idle: states.filter((s: { state: string }) => s.state === 'IDLE').length,
        ended: states.filter((s: { state: string }) => s.state === 'ENDED').length,
        totalMessages,
        totalTheirs,
        totalOurs,
      });

      if (data.success) {
        toast.success(`Processed ${states.length} conversations, ${data.changes?.length || 0} changes`);
      } else {
        setSmError(data.error || "State Machine failed");
        toast.error(data.error || "State Machine failed");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setSmError(message);
      toast.error(message);
    } finally {
      setSmLoading(false);
    }
  };

  const resetStateMachine = async () => {
    if (!smAccountId) return;
    
    if (!confirm("Are you sure you want to reset all conversation states?")) return;

    try {
      const res = await fetch(`/api/test/state-machine?accountId=${smAccountId}`, {
        method: "DELETE",
      });
      
      if (res.ok) {
        setSmStates([]);
        setSmSummary(null);
        setSmChanges([]);
        toast.success("States reset successfully");
      }
    } catch (error) {
      toast.error("Failed to reset states");
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FlaskConical className="h-6 w-6 text-primary" />
            Testing & Demo
          </h1>
          <p className="text-muted-foreground mt-1">
            Test AI analysis, scraping, and engagement functionality before going live
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="single-post" className="space-y-6">
          <TabsList className="h-auto flex flex-wrap gap-1">
            <TabsTrigger value="single-post" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Single Post
            </TabsTrigger>
            <TabsTrigger value="extract-posts" className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              Extract Posts
            </TabsTrigger>
            <TabsTrigger value="ai" className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              AI Analysis
            </TabsTrigger>
            <TabsTrigger value="engage" className="flex items-center gap-2">
              <Heart className="h-4 w-4" />
              Engagement
            </TabsTrigger>
            <TabsTrigger value="ai-reply" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              AI Reply
            </TabsTrigger>
            <TabsTrigger value="message-agent" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Message Agent
            </TabsTrigger>
            <TabsTrigger value="debug-messages" className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4" />
              Debug Messages
            </TabsTrigger>
            <TabsTrigger value="state-machine" className="flex items-center gap-2" onClick={() => loadSmStates()}>
              <Database className="h-4 w-4" />
              State Machine
            </TabsTrigger>
          </TabsList>

          {/* Single Post Tab */}
          <TabsContent value="single-post" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Input Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Zap className="h-5 w-5 text-amber-500" />
                    Test Single Post
                  </CardTitle>
                  <CardDescription>
                    Test content extraction from a single Facebook post URL.
                    Opens the post in a dialog and extracts the story message.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Post URL</Label>
                    <Input
                      value={singlePostUrl}
                      onChange={(e) => setSinglePostUrl(e.target.value)}
                      placeholder="https://www.facebook.com/groups/.../posts/..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Account to Use</Label>
                    <Select value={singlePostAccountId} onValueChange={setSinglePostAccountId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button 
                    className="w-full" 
                    onClick={testSinglePost}
                    disabled={singlePostLoading || !singlePostUrl.trim() || !singlePostAccountId}
                  >
                    {singlePostLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Extracting...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Test Extraction
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Result Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Result</CardTitle>
                </CardHeader>
                <CardContent>
                  {singlePostLoading && (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  )}

                  {singlePostError && (
                    <div className="flex items-center gap-2 text-red-500">
                      <AlertCircle className="h-5 w-5" />
                      <span>{singlePostError}</span>
                    </div>
                  )}

                  {singlePostResult && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        {singlePostResult.success ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-red-500" />
                        )}
                        <span className="font-medium">
                          {singlePostResult.success ? 'Extraction Successful' : 'Extraction Failed'}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={singlePostResult.hasDialog ? 'default' : 'secondary'}>
                            Dialog: {singlePostResult.hasDialog ? 'Found' : 'Not Found'}
                          </Badge>
                          {singlePostResult.isAnonymous ? (
                            <Badge variant="secondary">👤 Anonymous</Badge>
                          ) : singlePostResult.authorName && (
                            <Badge variant="outline">👤 {singlePostResult.authorName}</Badge>
                          )}
                        </div>

                        {/* Author Profile Link */}
                        {!singlePostResult.isAnonymous && singlePostResult.authorProfileUrl && (
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Author Profile:</Label>
                            <div className="flex items-center gap-2">
                              <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                                {singlePostResult.authorProfileUrl}
                              </code>
                              <a 
                                href={singlePostResult.authorProfileUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:underline flex items-center gap-1 text-xs"
                              >
                                Open <ExternalLink className="h-3 w-3" />
                              </a>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => copyToClipboard(singlePostResult.authorProfileUrl!)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        )}

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Content:</Label>
                          <div className="p-3 bg-muted rounded-lg text-sm max-h-64 overflow-y-auto whitespace-pre-wrap">
                            {singlePostResult.content || '(empty)'}
                          </div>
                        </div>

                        {singlePostResult.logs.length > 0 && (
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Logs:</Label>
                            <div className="p-2 bg-muted/50 rounded text-xs font-mono max-h-32 overflow-y-auto">
                              {singlePostResult.logs.map((log, i) => (
                                <div key={i}>{log}</div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {!singlePostLoading && !singlePostError && !singlePostResult && (
                    <div className="text-center text-muted-foreground py-8">
                      Enter a post URL and click Test Extraction
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Extract Posts Tab */}
          <TabsContent value="extract-posts" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Input Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ExternalLink className="h-5 w-5 text-violet-500" />
                    Extract Posts
                  </CardTitle>
                  <CardDescription>
                    Extract posts from a group with their content and direct links.
                    Gets post URL by finding the permalink.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Group URL</Label>
                    <Input
                      value={extractGroupUrl}
                      onChange={(e) => setExtractGroupUrl(e.target.value)}
                      placeholder="https://www.facebook.com/groups/..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Number of Posts</Label>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={extractMaxPosts}
                      onChange={(e) => setExtractMaxPosts(Math.min(50, Math.max(1, parseInt(e.target.value) || 10)))}
                      placeholder="10"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Account to Use</Label>
                    <Select value={extractAccountId} onValueChange={setExtractAccountId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.length === 0 ? (
                          <SelectItem value="none" disabled>No accounts configured</SelectItem>
                        ) : (
                          accounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="p-3 bg-violet-500/10 border border-violet-500/30 rounded-lg">
                    <p className="text-xs text-violet-500">
                      ℹ️ Extracts up to {extractMaxPosts} recent posts. Returns content and direct post URL for each.
                      A visible browser will open.
                    </p>
                  </div>

                  <Button 
                    onClick={testExtractPosts} 
                    disabled={extractLoading || !extractGroupUrl.trim() || !extractAccountId}
                    className="w-full"
                  >
                    {extractLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    {extractLoading ? 'Extracting Posts...' : 'Extract Posts'}
                  </Button>
                </CardContent>
              </Card>

              {/* Results Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    Extracted Posts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!extractResult && !extractError && !extractLoading && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <ExternalLink className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        Enter a group URL and click &quot;Extract Posts&quot; to start
                      </p>
                    </div>
                  )}

                  {extractLoading && (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                      <p className="text-muted-foreground">Extracting posts...</p>
                      <p className="text-xs text-muted-foreground mt-2">Watch the browser window</p>
                    </div>
                  )}

                  {extractError && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                      <p className="text-destructive font-medium mb-2">Error</p>
                      <p className="text-muted-foreground text-sm">{extractError}</p>
                    </div>
                  )}

                  {extractResult && (
                    <div className="space-y-4">
                      {/* Stats */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-muted rounded-lg text-center">
                          <p className="text-2xl font-bold">{extractResult.posts.length}</p>
                          <p className="text-xs text-muted-foreground">Posts Extracted</p>
                        </div>
                        <div className="p-3 bg-muted rounded-lg text-center">
                          <p className="text-2xl font-bold text-green-500">
                            {extractResult.posts.filter(p => p.postUrl).length}
                          </p>
                          <p className="text-xs text-muted-foreground">With URLs</p>
                        </div>
                      </div>

                      <Separator />

                      {/* Posts List */}
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Posts</Label>
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                          {extractResult.posts.map((post, i) => (
                            <div key={i} className="p-3 bg-muted rounded-lg space-y-2">
                              <div className="flex items-center justify-between">
                                <Badge variant="outline">Post {post.index}</Badge>
                                {post.postUrl ? (
                                  <a 
                                    href={post.postUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-blue-500 hover:underline flex items-center gap-1 text-xs"
                                  >
                                    Open Post <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : (
                                  <span className="text-xs text-muted-foreground">No URL</span>
                                )}
                              </div>

                              {/* Author Info */}
                              <div className="flex items-center gap-2">
                                {post.isAnonymous ? (
                                  <Badge variant="secondary" className="text-xs">
                                    👤 Anonymous
                                  </Badge>
                                ) : (
                                  <>
                                    <span className="text-xs font-medium">{post.authorName}</span>
                                    {post.authorProfileUrl && (
                                      <a 
                                        href={post.authorProfileUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-blue-500 hover:underline flex items-center gap-1 text-xs"
                                      >
                                        Profile <ExternalLink className="h-3 w-3" />
                                      </a>
                                    )}
                                  </>
                                )}
                              </div>
                              
                              <p className="text-sm">
                                {post.content.substring(0, 200)}
                                {post.content.length > 200 && '...'}
                              </p>
                              
                              {post.postUrl && (
                                <div className="flex items-center gap-2">
                                  <code className="text-xs bg-background px-2 py-1 rounded flex-1 truncate">
                                    {post.postUrl}
                                  </code>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => copyToClipboard(post.postUrl!)}
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}

                              {!post.isAnonymous && post.authorProfileUrl && (
                                <div className="flex items-center gap-2">
                                  <code className="text-xs bg-background px-2 py-1 rounded flex-1 truncate">
                                    {post.authorProfileUrl}
                                  </code>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => copyToClipboard(post.authorProfileUrl!)}
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <Separator />

                      {/* Logs */}
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Activity Log</Label>
                        <div className="bg-background p-3 rounded-lg max-h-48 overflow-y-auto">
                          {extractResult.logs.map((log, i) => (
                            <p key={i} className="text-xs font-mono text-muted-foreground">
                              {log}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* AI Testing Tab */}
          <TabsContent value="ai" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Input Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    Test Post
                  </CardTitle>
                  <CardDescription>
                    Enter a Facebook post to analyze with AI. The AI will score intent, 
                    detect the type of need, and generate a suggested response.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Post Text</Label>
                    <Textarea
                      value={postText}
                      onChange={(e) => setPostText(e.target.value)}
                      placeholder="Paste or type a Facebook post here..."
                      className="min-h-40 resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Quick Samples</Label>
                    <div className="flex flex-wrap gap-2">
                      {samplePosts.map((sample, i) => (
                        <Button
                          key={i}
                          variant="outline"
                          size="sm"
                          onClick={() => setPostText(sample.text)}
                        >
                          {sample.title}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <Button 
                    onClick={testAI} 
                    disabled={aiLoading || !postText.trim()}
                    className="w-full"
                  >
                    {aiLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4 mr-2" />
                    )}
                    {aiLoading ? 'Analyzing...' : 'Analyze with AI'}
                  </Button>
                </CardContent>
              </Card>

              {/* Results Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Bot className="h-5 w-5 text-purple-500" />
                    AI Analysis Result
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!aiResult && !aiError && !aiLoading && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Bot className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        Enter a post and click &quot;Analyze with AI&quot; to see results
                      </p>
                    </div>
                  )}

                  {aiLoading && (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                      <p className="text-muted-foreground">Analyzing post with Azure OpenAI...</p>
                    </div>
                  )}

                  {aiError && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                      <p className="text-destructive font-medium mb-2">Analysis Failed</p>
                      <p className="text-muted-foreground text-sm">{aiError}</p>
                    </div>
                  )}

                  {aiResult && (
                    <div className="space-y-4">
                      {/* Scores */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-muted rounded-lg text-center">
                          <div className={`text-3xl font-bold flex items-center justify-center gap-1 ${getIntentColor(aiResult.intent_score)}`}>
                            {aiResult.intent_score >= 4 && <Flame className="h-6 w-6" />}
                            {aiResult.intent_score}/5
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Intent Score</p>
                        </div>
                        <div className="p-4 bg-muted rounded-lg text-center">
                          <div className={`text-3xl font-bold ${getIntentColor(aiResult.urgency)}`}>
                            {aiResult.urgency}/5
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Urgency</p>
                        </div>
                      </div>

                      {/* Need Type & Matched Services */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={getIntentBadge(aiResult.intent_score)}>
                            {aiResult.need_type}
                          </Badge>
                          {aiResult.matched_services?.map((service, i) => (
                            <Badge key={i} variant="outline" className="text-green-500 border-green-500/50">
                              {service}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Budget Signals */}
                      {aiResult.budget_signals && aiResult.budget_signals.length > 0 && (
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Budget Signals</Label>
                          <div className="flex flex-wrap gap-1">
                            {aiResult.budget_signals.map((signal, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {signal}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <Separator />

                      {/* Reasoning */}
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">AI Reasoning</Label>
                        <p className="text-sm bg-muted p-3 rounded-lg">{aiResult.reasoning}</p>
                      </div>

                      {/* Suggested Response */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground">Suggested Response</Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6"
                                onClick={() => copyToClipboard(aiResult.suggested_response)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copy response</TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="bg-primary/10 border border-primary/30 p-3 rounded-lg">
                          <p className="text-sm">{aiResult.suggested_response}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Analysis completed successfully
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Engagement Testing Tab */}
          <TabsContent value="engage" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Input Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Heart className="h-5 w-5 text-pink-500" />
                    Test Engagement
                  </CardTitle>
                  <CardDescription>
                    Test commenting on a single post, sending friend request, and DM.
                    Opens a visible browser so you can watch the actions.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Post URL</Label>
                    <Input
                      value={engagePostUrl}
                      onChange={(e) => setEngagePostUrl(e.target.value)}
                      placeholder="https://www.facebook.com/groups/.../posts/..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Paste a direct link to a Facebook post
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Account to Use</Label>
                    <Select value={engageAccountId} onValueChange={setEngageAccountId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.length === 0 ? (
                          <SelectItem value="none" disabled>No accounts configured</SelectItem>
                        ) : (
                          accounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label>Comment to Post</Label>
                    <Textarea
                      value={engageComment}
                      onChange={(e) => setEngageComment(e.target.value)}
                      placeholder="Ciao! Posso aiutarti con questo..."
                      className="min-h-20"
                    />
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={engageSendFriendRequest}
                        onChange={(e) => setEngageSendFriendRequest(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm flex items-center gap-1">
                        <UserPlus className="h-4 w-4" />
                        Send Friend Request
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={engageSendDm}
                        onChange={(e) => setEngageSendDm(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm flex items-center gap-1">
                        <Send className="h-4 w-4" />
                        Send DM
                      </span>
                    </label>
                  </div>

                  {engageSendDm && (
                    <div className="space-y-2">
                      <Label>DM Message</Label>
                      <Textarea
                        value={engageDmMessage}
                        onChange={(e) => setEngageDmMessage(e.target.value)}
                        placeholder="Ciao! Ho visto il tuo post nel gruppo..."
                        className="min-h-20"
                      />
                    </div>
                  )}

                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <p className="text-xs text-yellow-500">
                      ⚠️ This will perform REAL actions on Facebook. If the post author is not anonymous, 
                      it will also go to their profile to send friend request and DM. A visible browser will open.
                    </p>
                  </div>

                  <Button 
                    onClick={testEngage} 
                    disabled={engageLoading || !engagePostUrl.trim() || !engageAccountId}
                    className="w-full"
                  >
                    {engageLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    {engageLoading ? 'Testing Engagement...' : 'Test Engagement'}
                  </Button>
                </CardContent>
              </Card>

              {/* Results Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    Engagement Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!engageResult && !engageError && !engageLoading && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Heart className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        Enter a post URL and click &quot;Test Engagement&quot; to start
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Will comment, then visit profile for friend request and DM
                      </p>
                    </div>
                  )}

                  {engageLoading && (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                      <p className="text-muted-foreground">Performing engagement actions...</p>
                      <p className="text-xs text-muted-foreground mt-2">Watch the browser window</p>
                    </div>
                  )}

                  {engageError && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                      <p className="text-destructive font-medium mb-2">Engagement Failed</p>
                      <p className="text-muted-foreground text-sm">{engageError}</p>
                    </div>
                  )}

                  {engageResult && (
                    <div className="space-y-4">
                      {/* Status Banner */}
                      <div className={`p-3 rounded-lg ${engageResult.success ? 'bg-green-500/10 border border-green-500/30' : 'bg-yellow-500/10 border border-yellow-500/30'}`}>
                        <div className="flex items-center gap-2">
                          {engageResult.success ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-yellow-500" />
                          )}
                          <span className={`font-medium ${engageResult.success ? 'text-green-500' : 'text-yellow-500'}`}>
                            {engageResult.success ? '🎉 Engagement Complete!' : 'Engagement Incomplete'}
                          </span>
                        </div>
                      </div>

                      {/* Author Info */}
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm font-medium">Author: {engageResult.authorName}</p>
                        {engageResult.authorProfileUrl && (
                          <a 
                            href={engageResult.authorProfileUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-blue-500 hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            View Profile
                          </a>
                        )}
                        {engageResult.isAnonymous && (
                          <Badge variant="outline" className="mt-2">Anonymous Post</Badge>
                        )}
                      </div>

                      {/* Steps Completed */}
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Steps Completed</Label>
                        <div className="grid grid-cols-1 gap-2">
                          <div className={`p-2 rounded-lg flex items-center gap-2 ${engageResult.steps.postOpened ? 'bg-green-500/10' : 'bg-muted'}`}>
                            {engageResult.steps.postOpened ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <AlertCircle className="h-4 w-4 text-muted-foreground" />}
                            <span className="text-sm">Post Opened</span>
                          </div>
                          <div className={`p-2 rounded-lg flex items-center gap-2 ${engageResult.steps.commentPosted ? 'bg-green-500/10' : 'bg-muted'}`}>
                            {engageResult.steps.commentPosted ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <AlertCircle className="h-4 w-4 text-muted-foreground" />}
                            <span className="text-sm">Comment Posted</span>
                          </div>
                          <div className={`p-2 rounded-lg flex items-center gap-2 ${engageResult.steps.profileFound ? 'bg-green-500/10' : 'bg-muted'}`}>
                            {engageResult.steps.profileFound ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <AlertCircle className="h-4 w-4 text-muted-foreground" />}
                            <span className="text-sm">Profile Found</span>
                          </div>
                          <div className={`p-2 rounded-lg flex items-center gap-2 ${engageResult.steps.friendRequestSent ? 'bg-green-500/10' : 'bg-muted'}`}>
                            {engageResult.steps.friendRequestSent ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <AlertCircle className="h-4 w-4 text-muted-foreground" />}
                            <span className="text-sm">Friend Request Sent</span>
                          </div>
                          <div className={`p-2 rounded-lg flex items-center gap-2 ${engageResult.steps.dmSent ? 'bg-green-500/10' : 'bg-muted'}`}>
                            {engageResult.steps.dmSent ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <AlertCircle className="h-4 w-4 text-muted-foreground" />}
                            <span className="text-sm">DM Sent</span>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Logs */}
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Activity Log</Label>
                        <div className="bg-muted p-3 rounded-lg max-h-64 overflow-y-auto">
                          {engageResult.logs.map((log, i) => (
                            <p key={i} className="text-xs font-mono text-muted-foreground">
                              {log}
                            </p>
                          ))}
                        </div>
                      </div>

                      {/* Errors */}
                      {engageResult.errors.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-xs text-red-500">Notes</Label>
                          <div className="bg-yellow-500/10 p-3 rounded-lg">
                            {engageResult.errors.map((err, i) => (
                              <p key={i} className="text-xs text-yellow-600">
                                {err}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* AI Reply Testing Tab */}
          <TabsContent value="ai-reply" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Input Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageCircle className="h-5 w-5 text-blue-500" />
                    Test Tunisian AI Chat
                  </CardTitle>
                  <CardDescription>
                    Chat with a person in perfect Tunisian dialect (Arabic letters).
                    AI will send up to 3 messages trying to close them on our services.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Person Name</Label>
                    <Input
                      value={aiReplyPersonName}
                      onChange={(e) => setAiReplyPersonName(e.target.value)}
                      placeholder="Enter the person's name to chat with"
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter the exact name as it appears on Facebook Messenger
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Account to Use</Label>
                    <Select value={aiReplyAccountId} onValueChange={setAiReplyAccountId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.length === 0 ? (
                          <SelectItem value="none" disabled>No accounts configured</SelectItem>
                        ) : (
                          accounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Max Messages to Send</Label>
                    <Select value={String(aiReplyMaxMessages)} onValueChange={(v) => setAiReplyMaxMessages(Number(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 message</SelectItem>
                        <SelectItem value="2">2 messages</SelectItem>
                        <SelectItem value="3">3 messages (recommended)</SelectItem>
                        <SelectItem value="5">5 messages</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Closes chat &amp; browser when no reply for 1 minute
                    </p>
                  </div>

                  <Separator />

                  <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <p className="text-xs text-green-500">
                      🇹🇳 الرسائل باش تكون بالتونسي الدارج - عسلامة، شنوة، كيفاش، إلخ
                    </p>
                  </div>

                  <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <p className="text-xs text-blue-500">
                      💡 Sends messages FAST • Keeps going while they reply • Closes when no reply for 1 min
                    </p>
                  </div>

                  <Button 
                    onClick={testAiReply} 
                    disabled={aiReplyLoading || !aiReplyPersonName.trim() || !aiReplyAccountId}
                    className="w-full"
                  >
                    {aiReplyLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    {aiReplyLoading ? 'Chatting in Tunisian...' : 'Start Tunisian Chat'}
                  </Button>
                </CardContent>
              </Card>

              {/* Results Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Bot className="h-5 w-5 text-purple-500" />
                    Chat Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!aiReplyResult && !aiReplyError && !aiReplyLoading && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        Enter a person name and click &quot;Start Tunisian Chat&quot;
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        AI will chat with them in perfect Tunisian dialect
                      </p>
                    </div>
                  )}

                  {aiReplyLoading && (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                      <p className="text-muted-foreground">Chatting in Tunisian...</p>
                      <p className="text-xs text-muted-foreground mt-2">Watch the browser window</p>
                    </div>
                  )}

                  {aiReplyError && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                      <p className="text-destructive font-medium mb-2">Chat Failed</p>
                      <p className="text-muted-foreground text-sm">{aiReplyError}</p>
                    </div>
                  )}

                  {aiReplyResult && (
                    <div className="space-y-4">
                      {/* Status Banner */}
                      <div className={`p-3 rounded-lg ${aiReplyResult.success ? 'bg-green-500/10 border border-green-500/30' : 'bg-yellow-500/10 border border-yellow-500/30'}`}>
                        <div className="flex items-center gap-2">
                          {aiReplyResult.success ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-yellow-500" />
                          )}
                          <span className={`font-medium ${aiReplyResult.success ? 'text-green-500' : 'text-yellow-500'}`}>
                            {aiReplyResult.success ? `✅ Sent ${aiReplyResult.totalRepliesSent} messages!` : 'Chat incomplete'}
                          </span>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 bg-muted rounded-lg text-center">
                          <p className="text-2xl font-bold text-blue-500">{aiReplyResult.totalRepliesSent}</p>
                          <p className="text-xs text-muted-foreground">Messages Sent</p>
                        </div>
                        <div className="p-3 bg-muted rounded-lg text-center">
                          <p className="text-2xl font-bold text-green-500">{aiReplyResult.messagesFound}</p>
                          <p className="text-xs text-muted-foreground">Initial Messages</p>
                        </div>
                        <div className="p-3 bg-muted rounded-lg text-center">
                          <p className="text-2xl font-bold text-purple-500">{aiReplyResult.conversation.length}</p>
                          <p className="text-xs text-muted-foreground">Total Messages</p>
                        </div>
                      </div>

                      {/* Messages We Sent */}
                      {aiReplyResult.messagesSent.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-xs text-green-500">🇹🇳 Messages We Sent (Tunisian)</Label>
                          <div className="space-y-2">
                            {aiReplyResult.messagesSent.map((msg, i) => (
                              <div key={i} className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                                <p className="text-sm" dir="rtl">{msg}</p>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyToClipboard(msg)}
                                  className="mt-2"
                                >
                                  <Copy className="h-3 w-3 mr-1" />
                                  Copy
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Conversation Preview */}
                      {aiReplyResult.conversation.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Full Conversation</Label>
                          <div className="bg-muted p-3 rounded-lg max-h-64 overflow-y-auto space-y-2">
                            {aiReplyResult.conversation.map((msg, i) => (
                              <div key={i} className={`text-xs p-2 rounded ${msg.sender === 'us' ? 'bg-blue-500/20 ml-4 text-right' : 'bg-gray-500/20 mr-4'}`} dir={msg.sender === 'us' ? 'rtl' : 'auto'}>
                                <span className="font-medium">{msg.sender === 'us' ? 'أنت' : 'هو'}:</span> {msg.text}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <Separator />

                      {/* Logs */}
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Activity Log</Label>
                        <div className="bg-muted p-3 rounded-lg max-h-48 overflow-y-auto">
                          {aiReplyResult.logs.map((log, i) => (
                            <p key={i} className="text-xs font-mono text-muted-foreground">
                              {log}
                            </p>
                          ))}
                        </div>
                      </div>

                      {/* Errors */}
                      {aiReplyResult.errors.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-xs text-red-500">Errors</Label>
                          <div className="bg-red-500/10 p-3 rounded-lg">
                            {aiReplyResult.errors.map((err, i) => (
                              <p key={i} className="text-xs text-red-500">
                                {err}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Message Agent Tab */}
          <TabsContent value="message-agent" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Configuration Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Database className="h-5 w-5 text-indigo-500" />
                    Message Agent (Production)
                  </CardTitle>
                  <CardDescription>
                    Production database-backed message agent. Tracks contacts in PostgreSQL,
                    links to leads, and updates lead stages automatically.
                    <span className="block mt-1 text-green-500 font-medium">
                      ✅ Uses real database - changes persist!
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Account to Use</Label>
                    <Select value={msgAgentAccountId} onValueChange={setMsgAgentAccountId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an account..." />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map(account => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label>Action to Run</Label>
                    <Select value={msgAgentAction} onValueChange={(v) => setMsgAgentAction(v as typeof msgAgentAction)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="init">🔄 Init - Full sidebar scan (discovers all contacts)</SelectItem>
                        <SelectItem value="scan">📡 Scan - Smart boundary scan (detects changes)</SelectItem>
                        <SelectItem value="reply">💬 Reply - Send AI replies to NEEDS_REPLY contacts</SelectItem>
                        <SelectItem value="maintenance">🧹 Maintenance - Archive inactive contacts</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {msgAgentAction === 'reply' && (
                    <div className="space-y-2">
                      <Label>Max Replies to Send</Label>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={msgAgentMaxReplies}
                        onChange={(e) => setMsgAgentMaxReplies(Number(e.target.value))}
                      />
                      <p className="text-xs text-muted-foreground">
                        Limit how many replies to send in this run
                      </p>
                    </div>
                  )}

                  <Separator />

                  <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                    <h4 className="font-medium text-sm">Action Details:</h4>
                    {msgAgentAction === 'init' && (
                      <ul className="text-xs text-muted-foreground space-y-1">
                        <li>• Scrolls through entire Messenger sidebar</li>
                        <li>• Creates/updates all contacts in database</li>
                        <li>• Links contacts to existing leads by name</li>
                        <li>• Use this first time or to reset state</li>
                      </ul>
                    )}
                    {msgAgentAction === 'scan' && (
                      <ul className="text-xs text-muted-foreground space-y-1">
                        <li>• Smart scan - stops at first known contact</li>
                        <li>• Detects new messages (NEEDS_REPLY)</li>
                        <li>• Detects returning contacts (OLD→ACTIVE)</li>
                        <li>• Fast - use for regular monitoring</li>
                      </ul>
                    )}
                    {msgAgentAction === 'reply' && (
                      <ul className="text-xs text-muted-foreground space-y-1">
                        <li>• Opens conversations with NEEDS_REPLY state</li>
                        <li>• Generates AI reply using Azure OpenAI</li>
                        <li>• Types and sends message with human-like delays</li>
                        <li>• Updates lead status to DM_SENT</li>
                      </ul>
                    )}
                    {msgAgentAction === 'maintenance' && (
                      <ul className="text-xs text-muted-foreground space-y-1">
                        <li>• Archives contacts inactive for 7+ days</li>
                        <li>• Moves ACTIVE→OLD, WAITING→ENDED</li>
                        <li>• Keeps database clean</li>
                        <li>• Run daily for best results</li>
                      </ul>
                    )}
                  </div>

                  <Button
                    onClick={startMessageAgent}
                    disabled={msgAgentLoading || !msgAgentAccountId}
                    className="w-full"
                    size="lg"
                  >
                    {msgAgentLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Running {msgAgentAction}...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Run {msgAgentAction.charAt(0).toUpperCase() + msgAgentAction.slice(1)}
                      </>
                    )}
                  </Button>

                  {msgAgentError && (
                    <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm">
                      {msgAgentError}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Stats & Results Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Activity className="h-5 w-5 text-green-500" />
                    Database Stats & Results
                  </CardTitle>
                  <CardDescription>
                    {msgAgentStats 
                      ? `${msgAgentStats.summary.active} active contacts, ${msgAgentStats.summary.needsReply} need reply`
                      : 'Select an account to load stats'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Stats Grid */}
                  {msgAgentStats && (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 bg-muted rounded-lg text-center">
                        <p className="text-2xl font-bold text-blue-500">
                          {msgAgentStats.summary.active}
                        </p>
                        <p className="text-xs text-muted-foreground">Active</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg text-center">
                        <p className="text-2xl font-bold text-orange-500">
                          {msgAgentStats.summary.needsReply}
                        </p>
                        <p className="text-xs text-muted-foreground">Needs Reply</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg text-center">
                        <p className="text-2xl font-bold text-green-500">
                          {msgAgentStats.summary.linkedToLead}
                        </p>
                        <p className="text-xs text-muted-foreground">Linked to Lead</p>
                      </div>
                    </div>
                  )}

                  {/* State breakdown */}
                  {msgAgentStats?.byState && Object.keys(msgAgentStats.byState).length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">By State</Label>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(msgAgentStats.byState).map(([state, count]) => (
                          <Badge 
                            key={state} 
                            variant="outline"
                            className={
                              state === 'NEEDS_REPLY' ? 'border-orange-500 text-orange-500' :
                              state === 'WAITING' ? 'border-yellow-500 text-yellow-500' :
                              state === 'ACTIVE' ? 'border-green-500 text-green-500' :
                              state === 'NEW' ? 'border-blue-500 text-blue-500' :
                              state === 'IDLE' ? 'border-gray-500 text-gray-500' :
                              'border-red-500 text-red-500'
                            }
                          >
                            {state}: {count}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Action Result */}
                  {msgAgentResult && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        {msgAgentResult.success ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-red-500" />
                        )}
                        <span className="font-medium">
                          {msgAgentResult.action} {msgAgentResult.success ? 'completed' : 'failed'}
                        </span>
                      </div>
                      
                      {msgAgentResult.stats && (
                        <div className="grid grid-cols-4 gap-2 text-center">
                          <div className="p-2 bg-blue-500/10 rounded">
                            <p className="text-lg font-bold text-blue-500">{msgAgentResult.stats.new}</p>
                            <p className="text-xs">New</p>
                          </div>
                          <div className="p-2 bg-yellow-500/10 rounded">
                            <p className="text-lg font-bold text-yellow-500">{msgAgentResult.stats.returning}</p>
                            <p className="text-xs">Returning</p>
                          </div>
                          <div className="p-2 bg-gray-500/10 rounded">
                            <p className="text-lg font-bold text-gray-500">{msgAgentResult.stats.unchanged}</p>
                            <p className="text-xs">Unchanged</p>
                          </div>
                          <div className="p-2 bg-orange-500/10 rounded">
                            <p className="text-lg font-bold text-orange-500">{msgAgentResult.stats.needsReply}</p>
                            <p className="text-xs">Needs Reply</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Needs Reply Contacts */}
                  {msgAgentStats?.needsReplyContacts && msgAgentStats.needsReplyContacts.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">
                        Contacts Needing Reply ({msgAgentStats.needsReplyContacts.length})
                      </Label>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {msgAgentStats.needsReplyContacts.slice(0, 5).map((contact) => (
                          <div 
                            key={contact.id}
                            className="p-2 bg-muted rounded-lg flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-orange-500/20 flex items-center justify-center text-sm font-medium">
                                {contact.name.charAt(0)}
                              </div>
                              <div>
                                <p className="text-sm font-medium">{contact.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {contact.messagesReceived} in · {contact.messagesSent} out
                                </p>
                              </div>
                            </div>
                            {contact.leadStage && (
                              <Badge variant="outline" className="text-xs">
                                {contact.leadStage}
                              </Badge>
                            )}
                          </div>
                        ))}
                        {msgAgentStats.needsReplyContacts.length > 5 && (
                          <p className="text-xs text-muted-foreground text-center">
                            +{msgAgentStats.needsReplyContacts.length - 5} more...
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Activity Log */}
                  {msgAgentLogs.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Activity Log</Label>
                      <div className="bg-black/90 text-green-400 p-3 rounded-lg max-h-48 overflow-y-auto font-mono text-xs">
                        {msgAgentLogs.map((log, i) => (
                          <p key={i} className="py-0.5">{log}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty state */}
                  {!msgAgentStats && !msgAgentResult && (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Database className="h-12 w-12 text-muted-foreground/30 mb-4" />
                      <p className="text-muted-foreground">
                        Select an account to view stats and run actions
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Debug Messages Tab */}
          <TabsContent value="debug-messages" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FlaskConical className="h-5 w-5" />
                  Debug Message Extraction
                </CardTitle>
                <CardDescription>
                  Test message extraction from a conversation - copy results to share for debugging
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Simple inputs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Account</Label>
                    <Select value={debugAccountId} onValueChange={setDebugAccountId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Conversation Name</Label>
                    <Input
                      value={debugConvoName}
                      onChange={(e) => setDebugConvoName(e.target.value)}
                      placeholder="e.g. Ahmed Mohamed"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>&nbsp;</Label>
                    <Button
                      onClick={testDebugMessages}
                      disabled={debugLoading || !debugAccountId || !debugConvoName.trim()}
                      className="w-full"
                    >
                      {debugLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Extracting...
                        </>
                      ) : (
                        <>
                          <FlaskConical className="h-4 w-4 mr-2" />
                          Run Debug
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {debugError && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-sm">
                    {debugError}
                  </div>
                )}

                {debugResult && (
                  <>
                    <Separator />
                    
                    {/* Conversation Preview */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">Conversation Preview ({debugResult.messages.length} messages)</h3>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const preview = debugResult.messages.map(m => 
                              `[${m.isRightSide ? 'RIGHT/OURS' : 'LEFT/THEIRS'}] ${m.text}`
                            ).join('\n');
                            navigator.clipboard.writeText(preview);
                            toast.success('Copied conversation preview!');
                          }}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Preview
                        </Button>
                      </div>
                      
                      <div className="text-xs text-muted-foreground mb-2">
                        🔵 Blue = AI/Us (transparent bg) | ⚫ Gray = Client/Them (rgb 48,48,48)
                      </div>
                      
                      <div className="bg-muted/50 rounded-lg p-4 max-h-[300px] overflow-y-auto space-y-2">
                        {debugResult.messages.map((msg, i) => (
                          <div 
                            key={i} 
                            className={`flex ${msg.isOutgoing ? 'justify-end' : 'justify-start'}`}
                          >
                            <div 
                              className={`max-w-[70%] p-2 rounded-lg text-sm ${
                                msg.isOutgoing 
                                  ? 'bg-blue-500 text-white' 
                                  : 'bg-gray-600 text-white'
                              }`}
                            >
                              <span className="text-xs opacity-70 mr-1">{msg.isOutgoing ? '🤖' : '👤'}</span>
                              {msg.text}
                            </div>
                          </div>
                        ))}
                        {debugResult.messages.length === 0 && (
                          <p className="text-center text-muted-foreground">No messages extracted</p>
                        )}
                      </div>
                    </div>

                    <Separator />

                    {/* AI-Ready Conversation Summary */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">Conversation Transcript (share with AI)</h3>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => {
                            const ourMessages = debugResult.messages.filter(m => m.isOutgoing);
                            const theirMessages = debugResult.messages.filter(m => !m.isOutgoing);
                            
                            const transcript = `=== CONVERSATION ANALYSIS ===
Contact: ${debugResult.conversationName}
Total Messages: ${debugResult.messages.length}
Our Messages (AI/Business): ${ourMessages.length}
Their Messages (Client): ${theirMessages.length}

=== FULL CONVERSATION ===
${debugResult.messages.map((m, i) => 
  `[${i + 1}] ${m.isOutgoing ? '🤖 US:' : '👤 THEM:'} ${m.text}`
).join('\n')}

=== THEIR MESSAGES ONLY ===
${theirMessages.map((m, i) => `${i + 1}. ${m.text}`).join('\n')}

=== OUR MESSAGES ONLY ===
${ourMessages.map((m, i) => `${i + 1}. ${m.text}`).join('\n')}

=== ANALYSIS QUESTIONS ===
1. What is the client asking for?
2. What is their intent/interest level?
3. Did they provide contact info (phone/WhatsApp)?
4. Is the conversation going well?
5. What should be our next response?`;
                            
                            navigator.clipboard.writeText(transcript);
                            toast.success('Copied AI-ready transcript!');
                          }}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copy for AI
                        </Button>
                      </div>
                      
                      <div className="text-xs text-muted-foreground">
                        Clean transcript format ready to paste into ChatGPT or any AI for analysis
                      </div>
                      
                      <pre className="bg-black rounded-lg p-4 text-xs text-green-400 overflow-x-auto max-h-[400px] overflow-y-auto whitespace-pre-wrap">
{`=== CONVERSATION ANALYSIS ===
Contact: ${debugResult.conversationName}
Total Messages: ${debugResult.messages.length}
Our Messages (AI/Business): ${debugResult.messages.filter(m => m.isOutgoing).length}
Their Messages (Client): ${debugResult.messages.filter(m => !m.isOutgoing).length}

=== FULL CONVERSATION ===
${debugResult.messages.map((m, i) => 
  `[${i + 1}] ${m.isOutgoing ? '🤖 US:' : '👤 THEM:'} ${m.text}`
).join('\n')}
`}
                      </pre>
                    </div>

                    <Separator />

                    {/* Technical Debug Data (collapsible) */}
                    <details className="space-y-3">
                      <summary className="cursor-pointer font-semibold text-muted-foreground hover:text-foreground">
                        🔧 Technical Debug Data (click to expand)
                      </summary>
                      <div className="mt-3 space-y-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const debugData = {
                              conversationName: debugResult.conversationName,
                              totalRows: debugResult.totalRows,
                              messages: debugResult.messages.map(m => ({
                                text: m.text,
                                isOutgoing: m.isOutgoing,
                                bgColor: m.bgColor,
                                boundingLeft: m.boundingLeft,
                                fontSize: m.fontSize,
                                fontWeight: m.fontWeight,
                                fontFamily: m.fontFamily,
                                lineHeight: m.lineHeight,
                                color: m.color
                              }))
                            };
                            navigator.clipboard.writeText(JSON.stringify(debugData, null, 2));
                            toast.success('Copied technical debug data!');
                          }}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Technical JSON
                        </Button>
                        
                        <pre className="bg-gray-900 rounded-lg p-4 text-xs text-gray-400 overflow-x-auto max-h-[300px] overflow-y-auto">
{JSON.stringify({
  conversationName: debugResult.conversationName,
  totalRows: debugResult.totalRows,
  messages: debugResult.messages.map(m => ({
    text: m.text,
    isOutgoing: m.isOutgoing,
    bgColor: m.bgColor,
    lineHeight: m.lineHeight
  }))
}, null, 2)}
                        </pre>
                      </div>
                    </details>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* State Machine Tab */}
          <TabsContent value="state-machine" className="space-y-6">
            {/* Controls Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  🧠 Conversation State Machine
                </CardTitle>
                <CardDescription>
                  Track conversation states reliably using message counts. No message slips through!
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Account Selector */}
                <div className="space-y-2">
                  <Label>Account</Label>
                  <Select value={smAccountId} onValueChange={setSmAccountId}>
                    <SelectTrigger className="w-full max-w-md">
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.name || acc.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Action Selector */}
                <div className="space-y-2">
                  <Label>Action</Label>
                  <Select value={smAction} onValueChange={(v) => setSmAction(v as typeof smAction)}>
                    <SelectTrigger className="w-full max-w-md">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="init">
                        🔄 Initialize - Full scan, count all messages (slow)
                      </SelectItem>
                      <SelectItem value="scan">
                        ⚡ Fast Scan - Check unread badges only (fast)
                      </SelectItem>
                      <SelectItem value="count">
                        🔍 Deep Count - Count messages in active conversations
                      </SelectItem>
                      <SelectItem value="full">
                        🔄 Full Cycle - Scan → Count → Process
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Action Description */}
                <div className="p-3 bg-muted/50 dark:bg-muted/20 rounded-lg text-sm border border-border/50">
                  {smAction === 'init' && (
                    <div className="space-y-2">
                      <p className="text-foreground">
                        <strong className="text-primary">Initialize:</strong> Scans ALL conversations, opens each one, and counts messages. 
                        Creates the initial state for tracking. Use this FIRST TIME or to rebuild state.
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Label htmlFor="smStartFromContact" className="whitespace-nowrap text-foreground">End at:</Label>
                        <Input 
                          id="smStartFromContact"
                          placeholder="Contact name (leave empty for all)"
                          value={smStartFromContact}
                          onChange={(e) => setSmStartFromContact(e.target.value)}
                          className="max-w-xs"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Enter a contact name to stop at. Processes from first conversation until this contact (inclusive).
                      </p>
                    </div>
                  )}
                  {smAction === 'scan' && (
                    <p className="text-foreground">
                      <strong className="text-primary">Fast Scan:</strong> Only checks the conversation list for unread badges.
                      Very fast but may miss messages if badge doesn&apos;t appear.
                    </p>
                  )}
                  {smAction === 'count' && (
                    <p className="text-foreground">
                      <strong className="text-primary">Deep Count:</strong> Opens each tracked conversation and counts messages.
                      Detects new messages even if unread badge is missing!
                    </p>
                  )}
                  {smAction === 'full' && (
                    <p className="text-foreground">
                      <strong className="text-primary">Full Cycle:</strong> Does fast scan first, then deep counts NEEDS_REPLY conversations.
                      Best for production - catches everything.
                    </p>
                  )}
                </div>

                {/* Buttons */}
                <div className="flex items-center gap-3">
                  <Button onClick={runStateMachine} disabled={smLoading || !smAccountId}>
                    {smLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                    Run {smAction.charAt(0).toUpperCase() + smAction.slice(1)}
                  </Button>
                  <Button variant="outline" onClick={loadSmStates} disabled={smLoading || !smAccountId}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                  <Button variant="destructive" onClick={resetStateMachine} disabled={smLoading || !smAccountId}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Reset All
                  </Button>
                </div>

                {smError && (
                  <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                    <p className="text-sm text-destructive">{smError}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Summary Card */}
            {smSummary && (
              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Activity className="w-5 h-5 text-primary" />
                    State Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Message Totals - Big Numbers */}
                  <div className="grid grid-cols-3 gap-4 p-4 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-green-500/10 dark:from-blue-500/20 dark:via-purple-500/20 dark:to-green-500/20 rounded-xl border border-border/50">
                    <div className="text-center">
                      <p className="text-4xl font-bold text-foreground">{smSummary.totalMessages}</p>
                      <p className="text-sm text-muted-foreground">Total Messages</p>
                    </div>
                    <div className="text-center border-x border-border/50">
                      <p className="text-4xl font-bold text-blue-500">{smSummary.totalTheirs}</p>
                      <p className="text-sm text-blue-600 dark:text-blue-400">Their Messages</p>
                    </div>
                    <div className="text-center">
                      <p className="text-4xl font-bold text-green-500">{smSummary.totalOurs}</p>
                      <p className="text-sm text-green-600 dark:text-green-400">Our Messages</p>
                    </div>
                  </div>
                  
                  {/* State Counts */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="text-center p-4 bg-muted/50 dark:bg-muted/20 rounded-xl border border-border/50 transition-all hover:scale-105">
                      <p className="text-3xl font-bold text-foreground">{smSummary.total}</p>
                      <p className="text-xs text-muted-foreground font-medium">Total</p>
                    </div>
                    <div className="text-center p-4 bg-red-500/10 dark:bg-red-500/20 rounded-xl border border-red-500/30 transition-all hover:scale-105">
                      <p className="text-3xl font-bold text-red-500 dark:text-red-400">{smSummary.needsReply}</p>
                      <p className="text-xs text-red-600 dark:text-red-400 font-medium">Needs Reply</p>
                    </div>
                    <div className="text-center p-4 bg-yellow-500/10 dark:bg-yellow-500/20 rounded-xl border border-yellow-500/30 transition-all hover:scale-105">
                      <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{smSummary.waiting}</p>
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">Waiting</p>
                    </div>
                    <div className="text-center p-4 bg-green-500/10 dark:bg-green-500/20 rounded-xl border border-green-500/30 transition-all hover:scale-105">
                      <p className="text-3xl font-bold text-green-600 dark:text-green-400">{smSummary.active}</p>
                      <p className="text-xs text-green-600 dark:text-green-400 font-medium">Active</p>
                    </div>
                    <div className="text-center p-4 bg-slate-500/10 dark:bg-slate-500/20 rounded-xl border border-slate-500/30 transition-all hover:scale-105">
                      <p className="text-3xl font-bold text-slate-500 dark:text-slate-400">{smSummary.idle}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">Idle</p>
                    </div>
                    <div className="text-center p-4 bg-blue-500/10 dark:bg-blue-500/20 rounded-xl border border-blue-500/30 transition-all hover:scale-105">
                      <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{smSummary.ended}</p>
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Ended</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Changes Card */}
            {smChanges.length > 0 && (
              <Card className="border-primary/30 bg-primary/5 dark:bg-primary/10">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ArrowRightLeft className="w-5 h-5 text-primary" />
                    State Changes
                    <Badge variant="secondary" className="ml-2">{smChanges.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {smChanges.map((change, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-background/80 dark:bg-background/40 rounded-lg border border-border/50 transition-all hover:bg-background">
                        <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="font-medium text-sm text-foreground truncate max-w-[150px]">{change.contact}</span>
                        <Badge variant="outline" className="flex-shrink-0">{change.from}</Badge>
                        <ArrowRightLeft className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        <Badge 
                          variant={change.to === 'NEEDS_REPLY' ? 'destructive' : 'default'}
                          className="flex-shrink-0"
                        >
                          {change.to}
                        </Badge>
                        <span className="text-xs text-muted-foreground ml-auto italic">{change.reason}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Conversations Table */}
            {smStates.length > 0 && (
              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-primary" />
                    Conversation States
                    <Badge variant="secondary" className="ml-2">{smStates.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[500px] overflow-y-auto space-y-3 pr-2">
                    {smStates.map((conv) => (
                      <div 
                        key={conv.id} 
                        className={`p-4 rounded-xl border-2 transition-all hover:shadow-md ${
                          conv.state === 'NEEDS_REPLY' 
                            ? 'bg-red-500/5 dark:bg-red-500/10 border-red-500/40 hover:border-red-500/60' 
                            : conv.state === 'WAITING'
                            ? 'bg-yellow-500/5 dark:bg-yellow-500/10 border-yellow-500/40 hover:border-yellow-500/60'
                            : conv.state === 'ACTIVE'
                            ? 'bg-green-500/5 dark:bg-green-500/10 border-green-500/40 hover:border-green-500/60'
                            : 'bg-muted/30 dark:bg-muted/10 border-border/50 hover:border-border'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            {/* Header Row */}
                            <div className="flex items-center gap-2 mb-2">
                              <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              <span className="font-semibold text-foreground truncate">{conv.contactName}</span>
                              <Badge 
                                className={`flex-shrink-0 ${
                                  conv.state === 'NEEDS_REPLY' 
                                    ? 'bg-red-500 hover:bg-red-600 text-white' 
                                    : conv.state === 'WAITING'
                                    ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                                    : conv.state === 'ACTIVE'
                                    ? 'bg-green-500 hover:bg-green-600 text-white'
                                    : conv.state === 'ENDED'
                                    ? 'bg-blue-500 hover:bg-blue-600 text-white'
                                    : ''
                                }`}
                                variant={conv.state === 'IDLE' || conv.state === 'NEW' ? 'secondary' : 'default'}
                              >
                                {conv.state}
                              </Badge>
                            </div>
                            
                            {/* Stats Row */}
                            <div className="flex items-center gap-4 text-xs mb-2">
                              <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/50 dark:bg-muted/30 rounded-md">
                                <Hash className="w-3 h-3 text-muted-foreground" />
                                <span className="text-foreground font-medium">{conv.totalMessageCount}</span>
                                <span className="text-muted-foreground">total</span>
                              </div>
                              <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-500/10 dark:bg-blue-500/20 rounded-md">
                                <MessageSquareText className="w-3 h-3 text-blue-500" />
                                <span className="text-blue-600 dark:text-blue-400 font-medium">{conv.theirMessageCount}</span>
                                <span className="text-blue-600/70 dark:text-blue-400/70">theirs</span>
                              </div>
                              <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 dark:bg-green-500/20 rounded-md">
                                <Send className="w-3 h-3 text-green-500" />
                                <span className="text-green-600 dark:text-green-400 font-medium">{conv.ourMessageCount}</span>
                                <span className="text-green-600/70 dark:text-green-400/70">ours</span>
                              </div>
                            </div>
                            
                            {/* Last Message */}
                            {conv.lastTheirMessage && (
                              <div className="mt-2 p-3 bg-background/80 dark:bg-background/40 rounded-lg border border-border/30">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <MessageSquare className="w-3 h-3 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground font-medium">Last from them:</span>
                                </div>
                                <p className="text-sm text-foreground/90 italic line-clamp-2">
                                  &quot;{conv.lastTheirMessage}&quot;
                                </p>
                              </div>
                            )}
                            
                            {/* Debug Info */}
                            {conv.debugInfo && (
                              <div className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                                <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                <span>{conv.debugInfo}</span>
                              </div>
                            )}
                          </div>
                          
                          {/* Actions Column */}
                          <div className="flex flex-col items-end gap-2 flex-shrink-0">
                            <Button 
                              variant="secondary" 
                              size="sm"
                              onClick={() => setSmSelectedConv(conv)}
                              className="w-full"
                            >
                              <Eye className="h-3 w-3 mr-1.5" />
                              Details
                            </Button>
                            <a 
                              href={conv.conversationUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="w-full"
                            >
                              <Button variant="outline" size="sm" className="w-full">
                                <ExternalLink className="h-3 w-3 mr-1.5" />
                                Open
                              </Button>
                            </a>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              <span>{new Date(conv.lastCheckedAt).toLocaleTimeString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Logs Card */}
            {smLogs.length > 0 && (
              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Activity className="w-5 h-5 text-primary" />
                    Execution Logs
                    <Badge variant="secondary" className="ml-2">{smLogs.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[300px] overflow-y-auto bg-muted/30 dark:bg-muted/10 rounded-lg border border-border/30 p-3">
                    <div className="font-mono text-xs space-y-1">
                      {smLogs.map((log, i) => (
                        <div 
                          key={i} 
                          className={`p-1.5 rounded transition-colors ${
                            log.includes('Error') || log.includes('error') 
                              ? 'bg-red-500/10 text-red-600 dark:text-red-400' 
                              : log.includes('Success') || log.includes('✓')
                              ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                              : log.includes('→') || log.includes('changed')
                              ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                              : 'hover:bg-muted/50 text-foreground/80'
                          }`}
                        >
                          {log}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Conversation Detail Dialog */}
            <Dialog open={!!smSelectedConv} onOpenChange={(open) => !open && setSmSelectedConv(null)}>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    {smSelectedConv?.contactName}
                    {smSelectedConv && (
                      <Badge 
                        className={`ml-2 ${
                          smSelectedConv.state === 'NEEDS_REPLY' 
                            ? 'bg-red-500 text-white' 
                            : smSelectedConv.state === 'WAITING'
                            ? 'bg-yellow-500 text-white'
                            : smSelectedConv.state === 'ACTIVE'
                            ? 'bg-green-500 text-white'
                            : smSelectedConv.state === 'ENDED'
                            ? 'bg-blue-500 text-white'
                            : ''
                        }`}
                        variant={smSelectedConv.state === 'IDLE' || smSelectedConv.state === 'NEW' ? 'secondary' : 'default'}
                      >
                        {smSelectedConv.state}
                      </Badge>
                    )}
                  </DialogTitle>
                  <DialogDescription>
                    Full conversation state and debug information
                  </DialogDescription>
                </DialogHeader>

                {smSelectedConv && (
                  <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                    {/* Visual Stats */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center p-4 bg-muted/50 dark:bg-muted/20 rounded-xl border border-border/50">
                        <Hash className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                        <p className="text-2xl font-bold text-foreground">{smSelectedConv.totalMessageCount}</p>
                        <p className="text-xs text-muted-foreground">Total Messages</p>
                      </div>
                      <div className="text-center p-4 bg-blue-500/10 dark:bg-blue-500/20 rounded-xl border border-blue-500/30">
                        <MessageSquareText className="w-5 h-5 mx-auto mb-1 text-blue-500" />
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{smSelectedConv.theirMessageCount}</p>
                        <p className="text-xs text-blue-600 dark:text-blue-400">Their Messages</p>
                      </div>
                      <div className="text-center p-4 bg-green-500/10 dark:bg-green-500/20 rounded-xl border border-green-500/30">
                        <Send className="w-5 h-5 mx-auto mb-1 text-green-500" />
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">{smSelectedConv.ourMessageCount}</p>
                        <p className="text-xs text-green-600 dark:text-green-400">Our Messages</p>
                      </div>
                    </div>

                    {/* Message Balance Visual */}
                    <div className="p-4 bg-muted/30 dark:bg-muted/10 rounded-xl border border-border/30">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-foreground">Message Balance</span>
                        <span className="text-xs text-muted-foreground">
                          {smSelectedConv.theirMessageCount > smSelectedConv.ourMessageCount 
                            ? `+${smSelectedConv.theirMessageCount - smSelectedConv.ourMessageCount} unanswered`
                            : smSelectedConv.theirMessageCount < smSelectedConv.ourMessageCount
                            ? `We're ahead by ${smSelectedConv.ourMessageCount - smSelectedConv.theirMessageCount}`
                            : 'Balanced'}
                        </span>
                      </div>
                      <div className="h-3 bg-muted rounded-full overflow-hidden flex">
                        {smSelectedConv.totalMessageCount > 0 && (
                          <>
                            <div 
                              className="bg-blue-500 h-full transition-all"
                              style={{ width: `${(smSelectedConv.theirMessageCount / smSelectedConv.totalMessageCount) * 100}%` }}
                            />
                            <div 
                              className="bg-green-500 h-full transition-all"
                              style={{ width: `${(smSelectedConv.ourMessageCount / smSelectedConv.totalMessageCount) * 100}%` }}
                            />
                          </>
                        )}
                      </div>
                      <div className="flex justify-between mt-1 text-xs">
                        <span className="text-blue-600 dark:text-blue-400">Theirs ({smSelectedConv.theirMessageCount})</span>
                        <span className="text-green-600 dark:text-green-400">Ours ({smSelectedConv.ourMessageCount})</span>
                      </div>
                    </div>

                    {/* Last Message */}
                    {smSelectedConv.lastTheirMessage && (
                      <div className="p-4 bg-background border border-border/50 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <MessageSquare className="w-4 h-4 text-blue-500" />
                          <span className="text-sm font-medium text-foreground">Last Message From Them</span>
                        </div>
                        <p className="text-sm text-foreground/90 italic bg-muted/30 dark:bg-muted/20 p-3 rounded-lg">
                          &quot;{smSelectedConv.lastTheirMessage}&quot;
                        </p>
                      </div>
                    )}

                    {/* Debug Info */}
                    {smSelectedConv.debugInfo && (
                      <div className="p-4 bg-yellow-500/5 dark:bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="w-4 h-4 text-yellow-500" />
                          <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">Debug Info</span>
                        </div>
                        <p className="text-sm text-foreground/80">{smSelectedConv.debugInfo}</p>
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="p-4 bg-muted/30 dark:bg-muted/10 rounded-xl border border-border/30">
                      <div className="flex items-center gap-2 mb-3">
                        <Activity className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">Metadata</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-muted-foreground">Contact FB ID:</span>
                          <p className="font-mono text-foreground mt-0.5">{smSelectedConv.contactFbId}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Internal ID:</span>
                          <p className="font-mono text-foreground mt-0.5">{smSelectedConv.id}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Last Checked:</span>
                          <p className="text-foreground mt-0.5">{new Date(smSelectedConv.lastCheckedAt).toLocaleString()}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Conversation URL:</span>
                          <a 
                            href={smSelectedConv.conversationUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline mt-0.5 block truncate"
                          >
                            {smSelectedConv.conversationUrl}
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Raw JSON */}
                    <div className="p-4 bg-slate-950 dark:bg-slate-900 rounded-xl border border-slate-800">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Database className="w-4 h-4 text-slate-400" />
                          <span className="text-sm font-medium text-slate-300">Raw JSON</span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                          onClick={() => {
                            navigator.clipboard.writeText(JSON.stringify(smSelectedConv, null, 2));
                          }}
                        >
                          <Copy className="w-3 h-3 mr-1.5" />
                          Copy
                        </Button>
                      </div>
                      <pre className="text-xs text-slate-300 overflow-x-auto font-mono bg-slate-900/50 p-3 rounded-lg max-h-[200px] overflow-y-auto">
                        {JSON.stringify(smSelectedConv, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
