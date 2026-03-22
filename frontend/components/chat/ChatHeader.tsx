// frontend/components/chat/ChatHeader.tsx
"use client";

import { 
  PanelRightClose, 
  BrainCircuit, 
  Settings2,
  Bot,
} from "lucide-react";
import { useThread } from "@assistant-ui/react";

import { Button } from "@/components/ui/button";
import { AgentCard } from "@/components/chat/agent-card";
import { AgentService } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface ChatHeaderProps {
  service: AgentService;
  threadId: string;
  onCollapse: () => void;
  allowCollapse?: boolean;
  className?: string;
}

export function ChatHeader({ service, threadId, onCollapse, allowCollapse = true, className }: ChatHeaderProps) {
  const isRunning = useThread((t) => t.isRunning);

  const isDemo = !service.is_owned && !service.is_free;
  const isModelOverridden = isDemo && !!service.demo_config?.model_override;

  return (
    <div 
      className={cn(
        "flex h-12 min-w-0 items-center justify-between border-b px-2 sm:px-3 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0 transition-all",
        className
      )} 
      dir="rtl"
    >
      
      {/* --- LEFT SECTION: Agent Identity --- */}
      <div className="flex min-w-0 items-center gap-1 overflow-hidden sm:gap-2">
        <AgentCard 
          service={service} 
          trigger={
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground rounded-md transition-colors hidden sm:flex"
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          }
        />
        {/* [NEW] Share Button (Hidden in Demo mode) */}
        {/* {!isDemo && (
          <>
            <ShareDialog 
              threadId={threadId}
              trigger={
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground rounded-md transition-colors hidden sm:flex"
                  title="اشتراک‌گذاری گفتگو"
                >
                  <Share2 className="h-4 w-4" />
                </Button>
              }
            />
            {allowCollapse && <Separator orientation="vertical" className="h-4 mx-1 hidden sm:block" />}
          </>
        )} */}
        {isModelOverridden && (
           <Badge 
             variant="outline" 
             className="h-6 gap-1 px-1.5 text-[10px] bg-muted/80 text-primary-700 border-amber-800/80 sm:px-2 animate-in fade-in"
           >
              <Bot className="w-3 h-3" />
              <span className="hidden sm:inline">دمو</span>
           </Badge>
        )}
      </div>

      {/* --- RIGHT SECTION: Controls --- */}
      <div className="flex shrink-0 items-center gap-0.5 sm:gap-0">
        
        {isRunning && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-medium border border-emerald-500/20 animate-in fade-in zoom-in-95 duration-300">
            <BrainCircuit className="h-3 w-3 animate-pulse" />
            <span className="hidden sm:inline whitespace-nowrap">
               در حال تحلیل...
            </span>
          </div>
        )}

        {allowCollapse && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:bg-muted hover:text-foreground rounded-md transition-colors"
            onClick={onCollapse}
            title="بستن پنل گفتگو"
          >
            <PanelRightClose className="h-4 w-4" /> 
          </Button>
        )}

      </div>
    </div>
  );
}
