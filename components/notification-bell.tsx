"use client";

import { useState, useEffect } from "react";
import { Bell, AlertTriangle, Info, AlertCircle, XCircle, Check, ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { toast } from "sonner";

interface Notification {
  id: string;
  type: string;
  severity: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  isRead: boolean;
  createdAt: string;
  account?: {
    id: string;
    name: string;
    email: string;
  };
}

const severityConfig = {
  INFO: { icon: Info, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950" },
  WARNING: { icon: AlertTriangle, color: "text-yellow-500", bg: "bg-yellow-50 dark:bg-yellow-950" },
  ERROR: { icon: AlertCircle, color: "text-red-500", bg: "bg-red-50 dark:bg-red-950" },
  CRITICAL: { icon: XCircle, color: "text-red-600", bg: "bg-red-100 dark:bg-red-900" },
};

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const response = await fetch("/api/notifications?limit=20");
      const data = await response.json();
      
      if (data.success) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  };

  // Initial fetch and polling
  useEffect(() => {
    fetchNotifications();
    
    // Poll every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Mark as read when opening
  useEffect(() => {
    if (isOpen && unreadCount > 0) {
      // Mark visible notifications as read after a short delay
      const timer = setTimeout(async () => {
        try {
          await fetch("/api/notifications", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ markAllRead: true }),
          });
          setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
          setUnreadCount(0);
        } catch (error) {
          console.error("Failed to mark as read:", error);
        }
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen, unreadCount]);

  // Dismiss notification
  const dismissNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id], dismiss: true }),
      });
      setNotifications(prev => prev.filter(n => n.id !== id));
      toast.success("Notification dismissed");
    } catch (error) {
      toast.error("Failed to dismiss");
    }
  };

  // Format time ago
  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white animate-pulse">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={async () => {
                await fetch("/api/notifications", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ markAllRead: true }),
                });
                setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
                setUnreadCount(0);
              }}
            >
              <Check className="mr-1 h-3 w-3" />
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {notifications.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Bell className="mx-auto mb-2 h-8 w-8 opacity-50" />
            <p className="text-sm">No notifications</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            {notifications.map((notification) => {
              const config = severityConfig[notification.severity];
              const Icon = config.icon;
              
              return (
                <div
                  key={notification.id}
                  className={cn(
                    "group relative border-b p-3 transition-colors hover:bg-muted/50",
                    !notification.isRead && config.bg
                  )}
                >
                  <div className="flex gap-3">
                    <div className={cn("mt-0.5 shrink-0", config.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn(
                          "text-sm font-medium",
                          !notification.isRead && "font-semibold"
                        )}>
                          {notification.title}
                        </p>
                        <button
                          onClick={(e) => dismissNotification(notification.id, e)}
                          className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                        </button>
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
                        {notification.message}
                      </p>
                      {notification.account && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Account: <span className="font-medium">{notification.account.name || notification.account.email}</span>
                        </p>
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {timeAgo(notification.createdAt)}
                        </span>
                        {notification.actionUrl && (
                          <Link href={notification.actionUrl}>
                            <Button variant="link" size="sm" className="h-auto p-0 text-xs">
                              {notification.actionLabel || "View"}
                              <ExternalLink className="ml-1 h-3 w-3" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
