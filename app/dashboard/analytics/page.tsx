import { prisma } from "@/lib/db";
import { 
  BarChart3, 
  TrendingUp,
  TrendingDown,
  Calendar,
  MessageSquare,
  Flame,
  Target,
  Users
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

async function getAnalytics() {
  const now = new Date();
  const today = new Date(now.setHours(0, 0, 0, 0));
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalLeads,
    todayLeads,
    yesterdayLeads,
    weekLeads,
    highIntentLeads,
    conversations,
    conversionRate,
  ] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { createdAt: { gte: today } } }),
    prisma.lead.count({ 
      where: { 
        createdAt: { 
          gte: yesterday,
          lt: today 
        } 
      } 
    }),
    prisma.lead.count({ where: { createdAt: { gte: lastWeek } } }),
    prisma.lead.count({ where: { intentScore: { gte: 4 } } }),
    prisma.conversation.count({ where: { leadReplied: true } }),
    prisma.lead.count({ where: { status: 'CONVERTED' } }),
  ]);

  // Get leads by group
  const leadsByGroup = await prisma.group.findMany({
    select: {
      name: true,
      _count: {
        select: { leads: true }
      }
    },
    orderBy: {
      leads: {
        _count: 'desc'
      }
    },
    take: 5
  });

  return {
    totalLeads,
    todayLeads,
    yesterdayLeads,
    weekLeads,
    highIntentLeads,
    conversations,
    conversionRate,
    leadsByGroup,
    changePercent: yesterdayLeads > 0 
      ? Math.round(((todayLeads - yesterdayLeads) / yesterdayLeads) * 100)
      : 0
  };
}

export default async function AnalyticsPage() {
  const analytics = await getAnalytics();

  // Mock hourly data for the chart visualization
  const hourlyData = Array.from({ length: 17 }, (_, i) => ({
    hour: i + 8, // 8 AM to 12 AM
    leads: Math.floor(Math.random() * 15) + 1,
    isPeak: [12, 13, 19, 20, 21].includes(i + 8)
  }));

  const funnelSteps = [
    { label: 'Scraped', value: analytics.totalLeads, color: 'bg-primary' },
    { label: 'High Intent', value: analytics.highIntentLeads, color: 'bg-orange-500' },
    { label: 'Engaged', value: analytics.conversations + analytics.conversionRate, color: 'bg-purple-500' },
    { label: 'Responded', value: analytics.conversations, color: 'bg-green-500' },
    { label: 'Converted', value: analytics.conversionRate, color: 'bg-emerald-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          Analytics
        </h1>
        <p className="text-muted-foreground mt-1">
          Track your lead generation performance
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Today&apos;s Leads</CardDescription>
              <Badge 
                variant={analytics.changePercent >= 0 ? "default" : "destructive"}
                className="flex items-center gap-1"
              >
                {analytics.changePercent >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {analytics.changePercent}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{analytics.todayLeads}</p>
            <p className="text-xs text-muted-foreground mt-1">
              vs yesterday ({analytics.yesterdayLeads})
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>This Week</CardDescription>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{analytics.weekLeads}</p>
            <p className="text-xs text-muted-foreground mt-1">Last 7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>High Intent</CardDescription>
              <Flame className="h-4 w-4 text-orange-500" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-500">{analytics.highIntentLeads}</p>
            <p className="text-xs text-muted-foreground mt-1">Score 4-5</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Response Rate</CardDescription>
              <MessageSquare className="h-4 w-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-500">
              {analytics.totalLeads > 0 
                ? Math.round((analytics.conversations / analytics.totalLeads) * 100)
                : 0
              }%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics.conversations} responses
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Hourly Activity Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Hourly Activity (Today)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-end gap-1">
              {hourlyData.map((data, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div 
                    className={`w-full rounded-t transition-all ${
                      data.isPeak ? 'bg-primary' : 'bg-muted'
                    }`}
                    style={{ height: `${(data.leads / 15) * 100}%`, minHeight: '8px' }}
                  />
                  <span className="text-xs text-muted-foreground">{data.hour}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-primary" />
                <span className="text-muted-foreground">Peak Hours</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-muted" />
                <span className="text-muted-foreground">Normal Hours</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Groups */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Top Performing Groups
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.leadsByGroup.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No data yet</p>
                </div>
              ) : (
                analytics.leadsByGroup.map((group, i) => {
                  const maxLeads = analytics.leadsByGroup[0]?._count.leads || 1;
                  const percentage = (group._count.leads / maxLeads) * 100;
                  
                  return (
                    <div key={i} className="flex items-center gap-4">
                      <Badge 
                        variant={i === 0 ? "default" : "secondary"}
                        className={`h-8 w-8 rounded-lg justify-center ${
                          i === 0 ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30' :
                          i === 1 ? 'bg-muted text-muted-foreground' :
                          i === 2 ? 'bg-orange-500/20 text-orange-500 border-orange-500/30' :
                          ''
                        }`}
                      >
                        {i + 1}
                      </Badge>
                      <div className="flex-1">
                        <p className="font-medium text-sm mb-1">{group.name}</p>
                        <Progress value={percentage} className="h-2" />
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {group._count.leads} leads
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Conversion Funnel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Conversion Funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            {funnelSteps.map((step, i, arr) => (
              <div key={i} className="flex-1 text-center">
                <div 
                  className={`${step.color} mx-auto rounded-xl p-6 mb-3`}
                  style={{ 
                    width: `${100 - (i * 15)}%`,
                    opacity: 0.2 + (1 - i / arr.length) * 0.8
                  }}
                >
                  <p className="text-2xl font-bold">{step.value}</p>
                </div>
                <p className="text-sm text-muted-foreground">{step.label}</p>
                {i < arr.length - 1 && arr[i + 1] && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {step.value > 0 
                      ? `${Math.round((arr[i + 1].value / step.value) * 100)}%`
                      : '0%'
                    }
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
