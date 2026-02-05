"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessageSquare, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { cn } from "@/lib/utils";

// Type for a single conversation, matching the inbox API response
interface Conversation {
  user_id: number;
  name: string;
  avatar: string | null;
  last_message: string;
  last_message_date: string;
  unread_count: number;
}

export function MessageSummary() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecentMessages = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/vania/messages/inbox/`, {
          headers: getAuthHeaders()
        });
        
        if (!res.ok) {
          throw new Error("Failed to load messages.");
        }
        
        const data = await res.json();
        // Take the top 4 most recent conversations for the summary
        setConversations(data.slice(0, 4)); 
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchRecentMessages();
  }, []);

  const totalUnread = conversations.reduce((acc, conv) => acc + conv.unread_count, 0);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="space-y-1">
          <CardTitle className="text-base">پیام‌های اخیر</CardTitle>
          <CardDescription className="text-xs">
            {totalUnread > 0 ? `${totalUnread} پیام خوانده نشده دارید` : "شما پیام جدیدی ندارید"}
          </CardDescription>
        </div>
        {totalUnread > 0 && (
            <Badge variant="destructive" className="animate-pulse">{totalUnread}</Badge>
        )}
      </CardHeader>
      <CardContent className="flex-1 p-4 pt-0">
        {loading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs">در حال بارگذاری...</span>
          </div>
        ) : error ? (
          <div className="h-full flex items-center justify-center text-destructive text-xs">
            خطا در دریافت پیام‌ها
          </div>
        ) : conversations.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground gap-2">
            <MessageSquare className="h-8 w-8 opacity-20" />
            <p className="text-sm font-medium">صندوق پیام خالی است</p>
          </div>
        ) : (
          <div className="space-y-4">
            {conversations.map((conv) => (
              <Link href={`/dashboard/messages?userId=${conv.user_id}`} key={conv.user_id} className="flex items-center gap-3 p-2 -m-2 rounded-lg hover:bg-muted/50 transition-colors">
                <Avatar className="h-9 w-9 border">
                  <AvatarImage src={conv.avatar || ""} />
                  <AvatarFallback>{conv.name.slice(0, 1)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <p className={cn("text-sm font-semibold truncate", conv.unread_count > 0 && "text-primary")}>
                      {conv.name}
                    </p>
                    {conv.unread_count > 0 && (
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{conv.last_message}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <Button asChild className="w-full gap-2" variant="outline">
          <Link href="/dashboard/messages">
            مشاهده همه پیام‌ها <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}