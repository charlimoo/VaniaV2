"use client";

import { useEffect, useState } from "react";
import { Loader2, Zap, FlaskConical } from "lucide-react";

import { useUser } from "@/hooks/use-user";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { UsageChart } from "@/components/dashboard/usage-chart";
import { AgentGrid } from "@/components/dashboard/agent-grid";
import { APP_CONFIG } from "@/lib/config";
import { Card, CardContent } from "@/components/ui/card";
import { useConfig } from "@/components/providers/config-provider";
import { MessageSummary } from "@/components/dashboard/MessageSummary";

export default function DashboardOverviewPage() {
  const { user, loading: userLoading } = useUser();
  const { config } = useConfig(); 
  const [sessions, setSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  useEffect(() => {
    const fetchSessions = async () => {
      const headers = getAuthHeaders();
      if (!headers.Authorization) return;

      try {
        const res = await fetch(`${API_BASE_URL}/agent/sessions?limit=50`, { headers });
        if (res.ok) {
          const data = await res.json();
          setSessions(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        console.error("Failed to load sessions", e);
      } finally {
        setLoadingSessions(false);
      }
    };

    if (user) fetchSessions();
  }, [user]);

  if (userLoading || loadingSessions) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const userName = user?.full_name?.split(" ")[0] || "کاربر";

  return (
    <div className="flex flex-col w-full h-full space-y-8 pb-10 max-w-6xl mx-auto pt-6" dir="rtl">
      
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">پیشخوان</h1>
        <p className="text-muted-foreground">
          {APP_CONFIG.TEXT.DASHBOARD_GREETING} {userName} جان!
        </p>
      </div>



      {/* Agents Market */}
      <div className="space-y-4">
        <AgentGrid />
      </div>

      {/* Info Banner (Dynamic from Config) */}
      {/* <Card className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/20 dark:to-blue-950/10 border-indigo-100 dark:border-indigo-900/50 shadow-sm">
        <CardContent className="p-0 px-4 flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-full text-indigo-600 dark:text-indigo-400">
                <Zap className="h-5 w-5 fill-current" />
            </div>
            <div className="text-sm">
                <span className="font-bold text-indigo-900 dark:text-indigo-200">هدیه روزانه: </span>
                <span className="text-indigo-700 dark:text-indigo-300">
                    روزانه <strong>{parseFloat(config.daily_free_credits)} {config.currency_symbol}</strong> اعتبار رایگان دریافت کنید. 
                    (بازنشانی هر شب ساعت ۰۰:۰۰)
                </span>
            </div>
        </CardContent>
      </Card> */}


      {/* Analytics */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        
        {/* Usage Chart (takes 2/3 of the width on large screens) */}
        <div className="lg:col-span-2 h-[350px]">
          <UsageChart sessions={sessions} days={7} />
        </div>
        
        {/* Message Summary (takes 1/3 of the width on large screens) */}
        <div className="lg:col-span-1 h-[350px]">
          <MessageSummary />
        </div>
        
      </div>
      
    </div>
  );
}