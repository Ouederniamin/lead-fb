"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Server,
  FolderKanban,
  BarChart3,
  Settings,
  UserCircle,
  Building2,
  Briefcase,
  FlaskConical,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { NotificationBell } from "@/components/notification-bell";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Accounts", href: "/dashboard/accounts", icon: UserCircle },
  { name: "Business", href: "/dashboard/business", icon: Building2 },
  { name: "Services", href: "/dashboard/services", icon: Briefcase },
  { name: "Groups", href: "/dashboard/groups", icon: FolderKanban },
  { name: "All Leads", href: "/dashboard/leads", icon: Users },
  { name: "Conversations", href: "/dashboard/conversations", icon: MessageSquare },
  { name: "Agents", href: "/dashboard/agents", icon: Server },
  { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { name: "AI Tune", href: "/dashboard/ai-tune", icon: BrainCircuit },
  { name: "Testing", href: "/dashboard/testing", icon: FlaskConical },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background text-foreground">
        {/* Sidebar */}
        <aside 
          className={cn(
            "fixed inset-y-0 left-0 z-50 border-r border-border bg-card transition-all duration-300 ease-in-out",
            collapsed ? "w-16" : "w-64"
          )}
        >
          <div className="flex h-full flex-col">
            {/* Logo */}
            <div className={cn(
              "flex h-16 items-center gap-2 border-b border-border transition-all duration-300",
              collapsed ? "justify-center px-2" : "px-6"
            )}>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 shrink-0">
                <Flame className="h-5 w-5 text-white" />
              </div>
              {!collapsed && (
                <span className="text-lg font-semibold whitespace-nowrap overflow-hidden">Lead Scraper</span>
              )}
            </div>

            {/* Navigation */}
            <ScrollArea className="flex-1 px-2 py-4">
              <nav className="space-y-1">
                {navigation.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/dashboard" && pathname.startsWith(item.href));
                  return (
                    <Tooltip key={item.name} delayDuration={0}>
                      <TooltipTrigger asChild>
                        <Link href={item.href}>
                          <Button
                            variant={isActive ? "secondary" : "ghost"}
                            className={cn(
                              "w-full gap-3 transition-all duration-200",
                              collapsed ? "justify-center px-2" : "justify-start",
                              isActive && "bg-accent"
                            )}
                          >
                            <item.icon className="h-4 w-4 shrink-0" />
                            {!collapsed && (
                              <span className="whitespace-nowrap overflow-hidden">{item.name}</span>
                            )}
                          </Button>
                        </Link>
                      </TooltipTrigger>
                      {collapsed && (
                        <TooltipContent side="right">
                          {item.name}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  );
                })}
              </nav>
            </ScrollArea>

            <Separator />

            {/* Collapse Toggle */}
            <div className={cn(
              "flex items-center border-t border-border",
              collapsed ? "justify-center p-2" : "justify-end px-3 py-2"
            )}>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCollapsed(!collapsed)}
                    className="h-8 w-8 rounded-lg hover:bg-accent"
                  >
                    {collapsed ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronLeft className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {collapsed ? "Expand sidebar" : "Collapse sidebar"}
                </TooltipContent>
              </Tooltip>
            </div>

            {/* User section */}
            <div className={cn(
              "border-t border-border transition-all duration-300",
              collapsed ? "p-2" : "p-4"
            )}>
              <div className={cn(
                "flex items-center",
                collapsed ? "justify-center" : "gap-3"
              )}>
                <UserButton afterSignOutUrl="/" />
                {!collapsed && (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">Account</p>
                      <p className="text-xs text-muted-foreground">Manage settings</p>
                    </div>
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <Link href="/dashboard/settings">
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Settings className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>Settings</TooltipContent>
                    </Tooltip>
                  </>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className={cn(
          "transition-all duration-300 ease-in-out",
          collapsed ? "pl-16" : "pl-64"
        )}>
          {/* Top Header Bar */}
          <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 max-w-7xl items-center justify-end px-8">
              <NotificationBell />
            </div>
          </header>
          <div className="container max-w-7xl p-8">{children}</div>
        </main>

        {/* Toast notifications */}
        <Toaster position="bottom-right" />
      </div>
    </TooltipProvider>
  );
}
