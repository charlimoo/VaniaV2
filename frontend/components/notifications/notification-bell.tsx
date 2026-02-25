"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { 
  Bell, 
  CheckCheck, 
  UserPlus, 
  ClipboardList, 
  Info, 
  Loader2, 
  MessageSquare,
  Layers
} from "lucide-react";
import { toast } from "sonner";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { cn } from "@/lib/utils";

// Types
interface NotificationPayload {
  url?: string;
  [key: string]: any;
}

interface Notification {
  id: number;
  title: string;
  message: string;
  type: 'CONNECTION_REQUEST' | 'TASK_ASSIGNED' | 'SYSTEM' | 'FORM_REQUEST' | 'NEW_MESSAGE';
  payload: NotificationPayload;
  is_read: boolean;
  created_at: string;
}

interface NotificationGroup {
  id: string;
  latest: Notification;
  items: Notification[];
  count: number;
}

export function NotificationBell() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  
  const toastedIds = useRef(new Set<number>());
  // [NEW] Ref to track if this is the first fetch after a page load.
  const isInitialLoad = useRef(true);

  // --- GROUPING LOGIC ---
  const groupedNotifications = useMemo(() => {
    const groups: Record<string, Notification[]> = {};
    
    notifications.forEach(n => {
      if (n.type === 'NEW_MESSAGE' && n.payload?.url) {
        const key = n.payload.url;
        if (!groups[key]) groups[key] = [];
        groups[key].push(n);
      } else {
        groups[`misc_${n.id}`] = [n];
      }
    });

    return Object.entries(groups)
      .map(([key, items]) => ({
        id: key,
        latest: items[0],
        items: items,
        count: items.length
      }))
      .sort((a, b) => new Date(b.latest.created_at).getTime() - new Date(a.latest.created_at).getTime());
  }, [notifications]);

  // --- HANDLERS ---

  const handleGroupClick = useCallback(async (group: NotificationGroup) => {
    const { latest, items } = group;

    const itemIds = new Set(items.map(i => i.id));
    setNotifications(prev => prev.map(n => 
        itemIds.has(n.id) ? { ...n, is_read: true } : n
    ));

    setOpen(false);
    if (latest.payload?.url) {
        router.push(latest.payload.url);
    }
    
    const unreadItems = items.filter(n => !n.is_read);
    
    for (const item of unreadItems) {
        try {
            fetch(`${API_BASE_URL}/api/vania/notifications/${item.id}/read/`, {
                method: "POST",
                headers: getAuthHeaders()
            });
        } catch (err) {
            console.error("Failed to mark notification as read", err);
        }
    }
  }, [router]);

  const fetchNotifications = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      if (!headers.Authorization) {
          setLoading(false);
          return;
      }

      const res = await fetch(`${API_BASE_URL}/api/vania/notifications/`, { headers });
      if (res.ok) {
        const data = await res.json();
        const freshNotifications: Notification[] = Array.isArray(data) ? data : data.results || [];
        
        // --- [UPDATED TOAST LOGIC] ---
        if (isInitialLoad.current) {
            // On the very first load, we don't show any toasts.
            // We just populate our "seen" list with all existing unread notifications.
            freshNotifications.forEach(n => {
                if (!n.is_read) {
                    toastedIds.current.add(n.id);
                }
            });
            // Mark the initial load as complete.
            isInitialLoad.current = false;
        } else {
            // On subsequent polls, we check for genuinely new unread items.
            const newUnseen = freshNotifications.filter(n => 
              !n.is_read && !toastedIds.current.has(n.id)
            );

            // Show toasts only for these new items.
            newUnseen.forEach(n => {
              if (n.type === 'NEW_MESSAGE') {
                 const notificationUrl = n.payload?.url || "";
                 if (pathname === '/dashboard/messages') {
                    const urlMatch = notificationUrl.match(/userId=(\d+)/);
                    const targetUserId = urlMatch ? urlMatch[1] : null;
                    const currentUserId = searchParams.get('userId');

                    if (targetUserId && currentUserId === targetUserId) {
                        toastedIds.current.add(n.id); 
                        return; // Suppress toast for active chat
                    }
                 }

                 toast.info(n.title, {
                  description: n.message,
                  action: {
                    label: "مشاهده",
                    onClick: () => handleGroupClick({ id: 'toast', latest: n, items: [n], count: 1 }),
                  },
                });
              }
              // Mark this new item as toasted so it doesn't appear again.
              toastedIds.current.add(n.id);
            });
        }
        
        setNotifications(freshNotifications);
      }
    } catch (error) {
      console.error("Notification sync failed", error);
    } finally {
      setLoading(false);
    }
  }, [handleGroupClick, pathname, searchParams]);

  useEffect(() => {
    fetchNotifications(); 
    const interval = setInterval(fetchNotifications, 60000); 
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    try {
      await fetch(`${API_BASE_URL}/api/vania/notifications/read-all/`, {
        method: "POST",
        headers: getAuthHeaders()
      });
    } catch (e) {
      fetchNotifications();
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
        case 'CONNECTION_REQUEST': return <UserPlus className="h-4 w-4 text-blue-500" />;
        case 'TASK_ASSIGNED': return <ClipboardList className="h-4 w-4 text-emerald-500" />;
        case 'FORM_REQUEST': return <MessageSquare className="h-4 w-4 text-purple-500" />;
        case 'NEW_MESSAGE': return <MessageSquare className="h-4 w-4 text-indigo-500" />;
        default: return <Info className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-background animate-in zoom-in" />
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent align="end" className="w-80 p-0 text-right" dir="rtl" style={{ direction: 'rtl' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 bg-muted/10 border-b">
            <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">اعلان‌ها</span>
                {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
            {unreadCount > 0 && (
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 text-[10px] text-muted-foreground hover:text-primary px-2"
                    onClick={handleMarkAllRead}
                >
                    <CheckCheck className="h-3 w-3 ml-1" />
                    خواندم
                </Button>
            )}
        </div>

        {/* List Container */}
        <ScrollArea className="h-[300px]" dir="rtl">
            {loading && notifications.length === 0 ? (
                <div className="flex items-center justify-center h-20">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
            ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground opacity-50">
                    <Bell className="h-8 w-8 mb-2" />
                    <span className="text-xs">هیچ اعلان جدیدی ندارید</span>
                </div>
            ) : (
                <div className="divide-y divide-border/50">
                    {groupedNotifications.map((group) => {
                        const { latest, count, items } = group;
                        const hasUnread = items.some(i => !i.is_read);

                        return (
                            <button
                                key={group.id}
                                className={cn(
                                    "w-full p-3 hover:bg-muted/40 transition-colors flex gap-3 relative group items-start text-right", 
                                    hasUnread && "bg-primary/5 hover:bg-primary/10"
                                )}
                                onClick={() => handleGroupClick(group)}
                            >
                                {hasUnread && <span className="absolute top-4 left-3 h-2 w-2 rounded-full bg-blue-500" />}
                                
                                <div className="relative mt-0.5">
                                    <div className="h-9 w-9 rounded-full bg-background border flex items-center justify-center shrink-0 shadow-sm">
                                        {count > 1 ? (
                                            <Layers className="h-4.5 w-4.5 text-foreground/70" />
                                        ) : (
                                            getIcon(latest.type)
                                        )}
                                    </div>
                                    
                                    {count > 1 && (
                                        <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground shadow-sm ring-2 ring-background z-10">
                                            {count}
                                        </span>
                                    )}
                                 </div>
                                <div className="flex-1 min-w-0 space-y-1">
                                    <div className="flex justify-between items-start gap-2">
                                        <p className={cn("text-xs font-medium leading-none truncate", hasUnread && "text-foreground font-semibold")}>
                                            {latest.title}
                                        </p>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                                        {count > 1 
                                            ? `${count} پیام جدید در این گفتگو` 
                                            : latest.message
                                        }
                                    </p>
                                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                                        {new Date(latest.created_at).toLocaleDateString('fa-IR', { 
                                            hour: '2-digit', minute: '2-digit' 
                                        })}
                                    </p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}