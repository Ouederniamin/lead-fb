import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { 
  Flame, 
  Zap, 
  Shield, 
  BarChart3, 
  Bot,
  MessageSquare,
  ArrowRight,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const features = [
  {
    icon: Bot,
    title: "Smart Scraping",
    description: "Human-like automation that browses groups safely without triggering bans"
  },
  {
    icon: Zap,
    title: "AI Qualification",
    description: "GPT-4o analyzes each post for intent, urgency, and generates perfect responses"
  },
  {
    icon: MessageSquare,
    title: "Auto Engagement",
    description: "Comment and DM leads automatically with your WhatsApp contact info"
  },
  {
    icon: Shield,
    title: "Anti-Ban System",
    description: "4-account rotation, random jitter, and session warming to protect your accounts"
  },
  {
    icon: BarChart3,
    title: "Real-time Analytics",
    description: "Track leads, conversions, and agent health from a beautiful dashboard"
  },
  {
    icon: Flame,
    title: "High-Intent Focus",
    description: "Prioritize leads most likely to convert with AI intent scoring"
  }
];

const steps = [
  { step: "1", title: "Add Target Groups", desc: "Enter the Facebook group URLs you want to monitor for leads" },
  { step: "2", title: "Configure Agents", desc: "Set up your aged Facebook accounts on Italian VMs" },
  { step: "3", title: "AI Takes Over", desc: "Our agents scrape, analyze, and engage leads 24/7 automatically" },
  { step: "4", title: "Close Deals", desc: "Review high-intent leads and connect via WhatsApp to close" }
];

const stats = [
  { value: "14-20", label: "Scrapes/day/group" },
  { value: "4", label: "Account rotation" },
  { value: "99%", label: "Uptime target" },
  { value: "0", label: "Bans guaranteed" }
];

export default async function LandingPage() {
  const { userId } = await auth();
  
  // If logged in, redirect to dashboard
  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-linear-to-br from-primary to-purple-600 flex items-center justify-center">
              <Flame className="h-6 w-6 text-white" />
            </div>
            <span className="font-bold text-xl">Lead Scraper</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link href="/sign-in">Sign In</Link>
            </Button>
            <Button asChild>
              <Link href="/sign-up">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <Badge variant="outline" className="mb-8 px-4 py-2 text-primary border-primary/30">
            <Zap className="h-4 w-4 mr-2" />
            AI-Powered Lead Generation
          </Badge>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-linear-to-r from-foreground via-muted-foreground to-muted-foreground bg-clip-text text-transparent">
            Find & Engage Leads<br />on Autopilot
          </h1>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Automatically scrape Facebook groups, qualify leads with AI, and engage with 
            contextual responses. All while you sleep.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-lg px-8" asChild>
              <Link href="/sign-up">
                Start Free Trial
                <ArrowRight className="h-5 w-5 ml-2" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8" asChild>
              <Link href="/sign-in">Sign In to Dashboard</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Everything You Need</h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            A complete solution for automated lead generation from social media groups
          </p>
          
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <Card key={i} className="transition-colors hover:border-primary/50">
                <CardHeader>
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20 px-6 border-t border-border bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          
          <div className="space-y-8">
            {steps.map((item, i) => (
              <div key={i} className="flex gap-6 items-start">
                <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center font-bold text-lg shrink-0 text-primary-foreground">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-1">{item.title}</h3>
                  <p className="text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map((stat, i) => (
            <div key={i}>
              <div className="text-4xl font-bold text-primary mb-2">{stat.value}</div>
              <div className="text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Automate Your Lead Gen?</h2>
          <p className="text-muted-foreground mb-8">
            Start finding high-quality leads from Facebook groups today
          </p>
          <Button size="lg" className="text-lg px-8" asChild>
            <Link href="/sign-up">
              Get Started Now
              <ArrowRight className="h-5 w-5 ml-2" />
            </Link>
          </Button>
          <div className="mt-6 flex items-center justify-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              No credit card required
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Free trial included
            </span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-linear-to-br from-primary to-purple-600 flex items-center justify-center">
              <Flame className="h-5 w-5 text-white" />
            </div>
            <span className="font-semibold">Lead Scraper</span>
          </div>
          <p className="text-muted-foreground text-sm">
            © 2024 Lead Scraper. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
