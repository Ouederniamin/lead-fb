import { prisma } from "@/lib/db";
import { formatDistanceToNow } from "date-fns";
import { 
  Flame, 
  ExternalLink, 
  MessageSquare,
  Send,
  Copy,
  Zap,
  Clock
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

async function getHighIntentLeads() {
  return prisma.lead.findMany({
    where: {
      intentScore: { gte: 4 },
      status: { in: ['NEW', 'COMMENTED'] },
    },
    orderBy: [
      { intentScore: 'desc' },
      { createdAt: 'desc' },
    ],
    include: { 
      group: true,
      conversation: true,
    },
    take: 50,
  });
}

export default async function HighIntentPage() {
  const leads = await getHighIntentLeads();

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Flame className="h-6 w-6 text-orange-500" />
            High Intent Leads
          </h1>
          <p className="text-muted-foreground mt-1">
            Priority leads with intent score 4-5. Review AI responses and approve engagement.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-orange-500">{leads.length}</p>
                  <p className="text-sm text-muted-foreground">Pending Review</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <Flame className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-500">
                    {leads.filter(l => l.intentScore === 5).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Very High (5/5)</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                  <Flame className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-500">
                    {leads.filter(l => l.intentScore === 4).length}
                  </p>
                  <p className="text-sm text-muted-foreground">High (4/5)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lead Cards */}
        <div className="space-y-4">
          {leads.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Flame className="h-12 w-12 text-muted-foreground mb-4" />
                <CardTitle className="mb-2">No High Intent Leads</CardTitle>
                <CardDescription>
                  High intent leads (score 4-5) will appear here for review.
                </CardDescription>
              </CardContent>
            </Card>
          ) : (
            leads.map((lead) => {
              const aiAnalysis = lead.aiAnalysis as Record<string, unknown> | null;
              const suggestedResponse = aiAnalysis?.suggested_response as string || '';
              const needType = aiAnalysis?.need_type as string || 'Unknown';
              const urgency = aiAnalysis?.urgency as number || 0;
              
              return (
                <Card key={lead.id} className="overflow-hidden">
                  {/* Header */}
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Badge 
                          variant={lead.intentScore === 5 ? "destructive" : "default"}
                          className="flex items-center gap-1"
                        >
                          <Flame className="h-3 w-3" />
                          {lead.intentScore}/5
                        </Badge>
                        <div>
                          <CardTitle className="text-base">
                            {lead.authorName || 'Unknown User'}
                          </CardTitle>
                          <CardDescription>{lead.group?.name}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true })}
                        </span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" asChild>
                              <a
                                href={lead.postUrl}
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
                  </CardHeader>

                  <Separator />

                  {/* Content */}
                  <CardContent className="pt-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Original Post */}
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">
                          Original Post
                        </h4>
                        <div className="bg-muted rounded-lg p-4 text-sm">
                          {lead.postText}
                        </div>
                        <div className="mt-3 flex gap-2 flex-wrap">
                          <Badge variant="secondary">{needType}</Badge>
                          {urgency >= 4 && (
                            <Badge variant="destructive">Urgent</Badge>
                          )}
                        </div>
                      </div>

                      {/* AI Response */}
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">
                          AI Suggested Response
                        </h4>
                        <Textarea
                          defaultValue={suggestedResponse}
                          className="h-32 resize-none"
                        />
                        <div className="mt-3 flex gap-2">
                          <Button className="flex-1">
                            <Send className="h-4 w-4 mr-2" />
                            Post Comment
                          </Button>
                          <Button variant="secondary" className="flex-1">
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Send DM
                          </Button>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="outline" size="icon">
                                <Copy className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copy Response</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
