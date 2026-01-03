import { prisma } from "@/lib/db";
import { formatDistanceToNow } from "date-fns";
import { 
  MessageSquare, 
  CheckCircle2,
  Clock,
  ExternalLink,
  Phone,
  Users,
  Reply,
  PenLine
} from "lucide-react";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

async function getConversations() {
  return prisma.conversation.findMany({
    orderBy: { lastActivity: 'desc' },
    include: {
      lead: {
        include: { group: true }
      }
    },
    take: 100,
  });
}

export default async function ConversationsPage() {
  const conversations = await getConversations();
  
  const replied = conversations.filter(c => c.leadReplied);
  const pending = conversations.filter(c => !c.leadReplied);

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            Conversations
          </h1>
          <p className="text-muted-foreground mt-1">
            Track engagement and responses from leads
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{conversations.length}</p>
                  <p className="text-sm text-muted-foreground">Total Engaged</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <Reply className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-500">{replied.length}</p>
                  <p className="text-sm text-muted-foreground">Replied</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-500">{pending.length}</p>
                  <p className="text-sm text-muted-foreground">Awaiting Reply</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Phone className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-500">
                    {conversations.filter(c => c.whatsappShared).length}
                  </p>
                  <p className="text-sm text-muted-foreground">WhatsApp Connected</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All ({conversations.length})</TabsTrigger>
            <TabsTrigger value="replied">Replied ({replied.length})</TabsTrigger>
            <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4 space-y-4">
            {conversations.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                  <CardTitle className="mb-2">No Conversations Yet</CardTitle>
                  <CardDescription>
                    When you engage with leads, conversations will appear here.
                  </CardDescription>
                </CardContent>
              </Card>
            ) : (
              conversations.map((conv) => (
                <ConversationCard key={conv.id} conv={conv} />
              ))
            )}
          </TabsContent>

          <TabsContent value="replied" className="mt-4 space-y-4">
            {replied.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Reply className="h-12 w-12 text-muted-foreground mb-4" />
                  <CardTitle className="mb-2">No Replies Yet</CardTitle>
                  <CardDescription>
                    Leads who have replied will appear here.
                  </CardDescription>
                </CardContent>
              </Card>
            ) : (
              replied.map((conv) => (
                <ConversationCard key={conv.id} conv={conv} />
              ))
            )}
          </TabsContent>

          <TabsContent value="pending" className="mt-4 space-y-4">
            {pending.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                  <CardTitle className="mb-2">No Pending Conversations</CardTitle>
                  <CardDescription>
                    All leads have responded!
                  </CardDescription>
                </CardContent>
              </Card>
            ) : (
              pending.map((conv) => (
                <ConversationCard key={conv.id} conv={conv} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}

interface ConversationCardProps {
  conv: {
    id: string;
    leadReplied: boolean;
    whatsappShared: boolean;
    lastActivity: Date;
    commentText: string | null;
    dmText: string | null;
    replyText: string | null;
    lead: {
      authorName: string | null;
      postUrl: string;
      group: { name: string } | null;
    };
  };
}

function ConversationCard({ conv }: ConversationCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
              conv.leadReplied ? 'bg-green-500/20' : 'bg-muted'
            }`}>
              {conv.leadReplied ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <Clock className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="font-medium">{conv.lead.authorName || 'Unknown'}</p>
              <p className="text-sm text-muted-foreground">{conv.lead.group?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {conv.whatsappShared && (
              <Badge variant="outline" className="text-emerald-500 border-emerald-500/50">
                <Phone className="h-3 w-3 mr-1" />
                WhatsApp
              </Badge>
            )}
            <span className="text-sm text-muted-foreground">
              {formatDistanceToNow(new Date(conv.lastActivity), { addSuffix: true })}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" asChild>
                  <a
                    href={conv.lead.postUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent>View Post</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Messages */}
        <div className="space-y-3">
          {conv.commentText && (
            <div className="flex gap-3">
              <div className="w-1 bg-primary rounded-full" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Your Comment</p>
                <p className="text-sm bg-muted rounded-lg p-3">{conv.commentText}</p>
              </div>
            </div>
          )}
          {conv.dmText && (
            <div className="flex gap-3">
              <div className="w-1 bg-purple-500 rounded-full" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Your DM</p>
                <p className="text-sm bg-muted rounded-lg p-3">{conv.dmText}</p>
              </div>
            </div>
          )}
          {conv.leadReplied && conv.replyText && (
            <div className="flex gap-3">
              <div className="w-1 bg-green-500 rounded-full" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Their Reply</p>
                <p className="text-sm bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                  {conv.replyText}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-4 pt-4 border-t flex gap-2">
          <Button variant="outline" size="sm">
            <PenLine className="h-4 w-4 mr-1" />
            Add Note
          </Button>
          {!conv.whatsappShared && (
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
              <Phone className="h-4 w-4 mr-1" />
              Mark WhatsApp Connected
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
