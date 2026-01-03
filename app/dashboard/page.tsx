import { prisma } from "@/lib/db";
import { 
  Users, 
  MessageSquare, 
  Server,
  TrendingUp,
  Clock
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

async function getStats() {
  const [
    totalLeads,
    conversations,
    activeAgents,
    todayLeads,
  ] = await Promise.all([
    prisma.lead.count(),
    prisma.conversation.count({ where: { leadReplied: true } }),
    prisma.agent.count({ where: { status: { in: ['ONLINE', 'SCRAPING', 'ENGAGING'] } } }),
    prisma.lead.count({
      where: {
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),
  ]);

  return { totalLeads, conversations, activeAgents, todayLeads };
}

async function getRecentLeads() {
  return prisma.lead.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: { group: true },
  });
}

async function getAgentStatus() {
  return prisma.agent.findMany({
    orderBy: { lastHeartbeat: 'desc' },
  });
}

export default async function DashboardPage() {
  const [stats, recentLeads, agents] = await Promise.all([
    getStats(),
    getRecentLeads(),
    getAgentStatus(),
  ]);

  const statCards = [
    { name: 'Total Leads', value: stats.totalLeads, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { name: 'Responses', value: stats.conversations, icon: MessageSquare, color: 'text-green-500', bg: 'bg-green-500/10' },
    { name: 'Active Agents', value: stats.activeAgents, icon: Server, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { name: 'Today', value: stats.todayLeads, icon: TrendingUp, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Monitor your lead scraping operations</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.name}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription className="text-sm font-medium">{stat.name}</CardDescription>
              <div className={`rounded-lg p-2 ${stat.bg}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Leads */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              Recent Leads
            </CardTitle>
            <CardDescription>Latest leads from your groups</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {recentLeads.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Users className="h-12 w-12 text-muted-foreground/50" />
                    <p className="mt-4 text-sm text-muted-foreground">No leads yet. Start your agents!</p>
                  </div>
                ) : (
                  recentLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className="flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent/50"
                    >
                      <div className={`mt-2 h-2 w-2 rounded-full ${
                        lead.intentScore >= 4 ? 'bg-orange-500' : 
                        lead.intentScore >= 3 ? 'bg-yellow-500' : 'bg-muted-foreground'
                      }`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {lead.authorName || 'Unknown User'}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {lead.postText.substring(0, 80)}...
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {lead.group?.name} • {new Date(lead.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                      <Badge variant={
                        lead.status === 'NEW' ? 'default' :
                        lead.status === 'COMMENTED' ? 'secondary' :
                        lead.status === 'RESPONDED' ? 'outline' : 'secondary'
                      }>
                        {lead.status}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Agent Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5 text-muted-foreground" />
              Agent Status
            </CardTitle>
            <CardDescription>Your scraping agents status</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {agents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Server className="h-12 w-12 text-muted-foreground/50" />
                    <p className="mt-4 text-sm text-muted-foreground">No agents registered yet.</p>
                  </div>
                ) : (
                  agents.map((agent) => {
                    const isOnline = agent.status === 'ONLINE' || agent.status === 'SCRAPING' || agent.status === 'ENGAGING';
                    const lastSeen = agent.lastHeartbeat 
                      ? Math.floor((Date.now() - new Date(agent.lastHeartbeat).getTime()) / 60000)
                      : null;
                    
                    return (
                      <div
                        key={agent.id}
                        className="flex items-center gap-3 rounded-lg border border-border p-3"
                      >
                        <div className={`h-3 w-3 rounded-full ${
                          isOnline ? 'animate-pulse bg-green-500' : 'bg-muted-foreground'
                        }`} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{agent.accountEmail}</p>
                          <p className="text-xs text-muted-foreground">
                            {agent.vmHost} • {lastSeen !== null ? `${lastSeen}m ago` : 'Never'}
                          </p>
                        </div>
                        <div className="text-right text-xs">
                          <p className="text-muted-foreground">
                            {agent.dailyScrapes}s • {agent.dailyComments}c • {agent.dailyDms}d
                          </p>
                          <Badge variant={
                            agent.status === 'SCRAPING' ? 'default' :
                            agent.status === 'ENGAGING' ? 'outline' :
                            agent.status === 'RATE_LIMITED' ? 'destructive' : 'secondary'
                          } className="mt-1">
                            {agent.status}
                          </Badge>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
