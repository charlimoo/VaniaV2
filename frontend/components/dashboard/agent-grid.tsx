"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Bot, Lock, Zap, ArrowLeft, Clock
} from "lucide-react";

import { Card } from "@/components/ui/card"; // Removing CardContent to control padding manually
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge"; 
import { AgentService } from "@/lib/types";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { APP_CONFIG } from "@/lib/config";
import { cn } from "@/lib/utils";

export function AgentGrid() {
  const router = useRouter();
  const [services, setServices] = useState<AgentService[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchServices = async () => {
      const headers = getAuthHeaders();
      try {
        const res = await fetch(`${API_BASE_URL}/api/services/`, { headers });
        if (res.ok) {
          const data = await res.json();
          setServices(data);
        }
      } catch (e) {
        console.error("Failed to load agents", e);
      } finally {
        setLoading(false);
      }
    };
    fetchServices();
  }, []);

  const handleAction = (agent: AgentService) => {
    const draftId = `local-${crypto.randomUUID()}`;
    router.push(`/chat/${agent.slug}/${draftId}`);
  };

  if (loading) return <AgentsListSkeleton />;

  return (
    <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 animate-in fade-in slide-in-from-bottom-4">
      {services.map((agent) => {
        const status = agent.access_status;
        const isOwned = status === 'OWNED' || status === 'FREE';
        const isLocked = !isOwned;
        const multiplier = parseFloat(agent.cost_multiplier);

        return (
          <Card 
            key={agent.id} 
            onClick={() => handleAction(agent)}
            className={cn(
              "relative overflow-hidden transition-all duration-300 ease-out group flex flex-col justify-between h-full min-h-[200px] cursor-pointer border shadow-sm p-5 py-8",
              isOwned
                ? "bg-card border-border/60 hover:border-primary/50 hover:shadow-lg hover:-translate-y-1 hover:shadow-primary/5" 
                : "bg-muted/15 border-dashed border-muted/30 hover:border-muted opacity-100"
            )}
          >
            {/* --- TOP SECTION: Title & Description --- */}
            <div className="flex flex-col relative z-10 mb-4">
                <div className="flex justify-between items-start">
                    <h3 className={cn("font-bold text-lg leading-tight mb-3 transition-colors", isOwned ? "group-hover:text-primary" : "text-muted-foreground")}>
                        {agent.name}
                    </h3>
                    
                    {/* Optional: Arrow appears top-left on hover for effect */}
                    {isOwned && (
                        <ArrowLeft className="w-5 h-5 text-primary opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 ease-out" />
                    )}
                </div>
                
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                    {agent.description || APP_CONFIG.TEXT.AGENT_FALLBACK_DESC}
                </p>
            </div>

            {/* --- BOTTOM SECTION: Icon, Tags, Date & Badges --- */}
            <div className="flex items-end justify-between relative z-10 pt-4 border-t border-border/40 mt-auto">
                
                {/* Right Side (RTL): Icon + Info */}
                <div className="flex items-center gap-3.5">
                    {/* Icon Box */}
                    <div className={cn(
                        "h-12 w-12 shrink-0 rounded-2xl flex items-center justify-center shadow-sm transition-all duration-300 border",
                        isOwned 
                            ? "bg-primary/10 text-primary border-primary/20 group-hover:scale-110 group-hover:rotate-3 group-hover:bg-primary/15" 
                            : "bg-muted text-muted-foreground border-border grayscale"
                    )}>
                        {isLocked ? <Lock className="h-5 w-5" /> : <Bot className="h-6 w-6" />}
                    </div>

                    {/* Tags & Expiry */}
                    <div className="flex flex-col gap-1.5">
                        {/* Tags - Increased font size */}
                        <div className="flex flex-wrap gap-1.5">
                            {agent.tags?.slice(0, 2).map(tag => (
                                <span key={tag} className="text-[11px] font-medium text-muted-foreground/80 bg-secondary/80 border border-border/50 px-2 py-0.5 rounded-md whitespace-nowrap">
                                    {tag}
                                </span>
                            ))}
                        </div>

                        {/* Expiry Date - Increased font size */}
                        {agent.license_expires_at && isOwned && (
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70 font-medium">
                                <Clock className="w-3 h-3" />
                                <span><span className="font-mono">{new Date(agent.license_expires_at).toLocaleDateString('fa-IR')}</span></span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Left Side (RTL): Status Badges */}
                <div className="flex flex-col items-end gap-2 shrink-0 pl-1">
                    {isOwned ? (
                        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-500/20 gap-1.5 shadow-none px-2.5 py-0.5 text-[11px] rounded">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                            </span>
                            فعال
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="bg-background/50 border-muted-200 text-muted-700 dark:border-muted-800 dark:text-muted-500 gap-1 text-[10px] rounded">
                            <Lock className="w-3 h-3" /> {APP_CONFIG.TEXT.BUY_PLAN_TITLE}
                        </Badge>
                    )}
                    
                    {multiplier > 1.0 && (
                        <Badge className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded border border-border/50 flex items-center gap-1">
                            <Zap className="w-3 h-3 text-amber-500 fill-amber-500" /> {multiplier}x
                        </Badge>
                    )}
                </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function AgentsListSkeleton() {
  return (
    <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div 
          key={i} 
          className="relative flex flex-col justify-between h-full min-h-[220px] p-6 rounded-xl border border-border/50 bg-card/50 shadow-sm"
        >
          {/* Top Section: Title & Text */}
          <div className="space-y-4">
            {/* Title & Arrow placeholder */}
            <div className="flex justify-between items-start">
              <Skeleton className="h-6 w-1/3 rounded-lg bg-primary/10" />
            </div>
            
            {/* Description Lines */}
            <div className="space-y-2">
              <Skeleton className="h-3 w-full rounded-full" />
              <Skeleton className="h-3 w-4/5 rounded-full" />
            </div>
          </div>

          {/* Bottom Section: Icon & Badges */}
          <div className="flex items-end justify-between pt-6 mt-auto">
            
            {/* Right Side (Icon + Meta) */}
            <div className="flex items-center gap-3">
              {/* Icon Box */}
              <Skeleton className="h-12 w-12 rounded-2xl bg-muted" />
              
              {/* Meta Lines */}
              <div className="flex flex-col gap-2">
                <Skeleton className="h-3 w-16 rounded-md" />
                <Skeleton className="h-3 w-24 rounded-md" />
              </div>
            </div>

            {/* Left Side (Status Badge) */}
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}