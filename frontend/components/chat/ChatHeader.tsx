// frontend/components/chat/ChatHeader.tsx
"use client";

import { 
  PanelRightClose, 
  BrainCircuit, 
  Zap, 
  Settings2,
  Sparkles,
  Gauge,
  Bot,
  Share2 
} from "lucide-react";
import { useThread } from "@assistant-ui/react";

import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Separator } from "@/components/ui/separator";
import { AgentCard } from "@/components/chat/agent-card";
import { useAgentSettings } from "@/lib/agent-settings-store";
import { AgentService } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ShareDialog } from "@/components/chat/share-dialog"; 

interface ChatHeaderProps {
  service: AgentService;
  threadId: string;
  onCollapse: () => void;
  allowCollapse?: boolean;
  className?: string;
}

export function ChatHeader({ service, threadId, onCollapse, allowCollapse = true, className }: ChatHeaderProps) {
  const isRunning = useThread((t) => t.isRunning);
  
  const { settingsByAgent, setReasoningEffort, setReasoningEnabled } = useAgentSettings();
  
  const settings = settingsByAgent[service.slug] || { 
    reasoningEffort: 'medium', 
    isReasoningEnabled: service.enable_reasoning 
  };

  const isDemo = !service.is_owned && !service.is_free;
  const isModelOverridden = isDemo && !!service.demo_config?.model_override;

  const isNativeReasoning = service.reasoning_type === 'NATIVE';
  const isHybridReasoning = service.reasoning_type === 'HYBRID';
  
  const showReasoningControls = service.reasoning_type !== 'NONE';

  const modelId = (service.model_id || "").toLowerCase().trim();
  const supportsNoneEffort = [
    "gpt-5.1", "gpt5.1", 
    "gpt-5.2", "gpt5.2"
  ].includes(modelId);

  const isNoneActive = settings.reasoningEffort === 'none';
  const showManualControls = !supportsNoneEffort || !isNoneActive;

  const getEffortLabel = (effort: string) => {
    switch (effort) {
      case 'low': return "سریع و بهینه"; 
      case 'medium': return "دقیق (زمان‌بر)"; 
      case 'high': return "عمیق (بسیار زمان‌بر)";
      case 'none': return ""; 
      default: return "";
    }
  };

  return (
    <div 
      className={cn(
        "flex h-12 items-center justify-between border-b px-2 sm:px-3 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0 transition-all", 
        className
      )} 
      dir="rtl"
    >
      
      {/* --- LEFT SECTION: Agent Identity --- */}
      <div className="flex items-center gap-1 sm:gap-2 overflow-hidden shrink">
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
        {!isDemo && (
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
        )}
        {isModelOverridden && (
           <Badge 
             variant="outline" 
             className="h-6 gap-1.5 text-[10px] bg-muted/80 text-primary-700 border-amber-800/80 px-2 animate-in fade-in"
           >
              <Bot className="w-3 h-3" />
              <span className="hidden sm:inline">دمو</span>
           </Badge>
        )}
      </div>

      {/* --- RIGHT SECTION: Controls --- */}
      <div className="flex items-center gap-1 sm:gap-0 shrink-0">
        
        {isRunning && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-medium border border-emerald-500/20 animate-in fade-in zoom-in-95 duration-300">
            <BrainCircuit className="h-3 w-3 animate-pulse" />
            <span className="hidden sm:inline whitespace-nowrap">
               در حال تحلیل...
            </span>
          </div>
        )}

        {isNativeReasoning && !isRunning && (
          <>
            <span className="hidden lg:block text-[10px] text-muted-foreground/80 ml-3 animate-in fade-in slide-in-from-right-1 duration-300 select-none">
               {getEffortLabel(settings.reasoningEffort)}
            </span>

            <div className="flex items-center bg-muted/50 rounded-lg p-0.5 border border-border/50 scale-90 sm:scale-100 origin-right">
              <ToggleGroup 
                type="single" 
                value={settings.reasoningEffort} 
                onValueChange={(v) => {
                    if (v) {
                        setReasoningEffort(service.slug, v as any);
                    } else if (isNoneActive) {
                        setReasoningEffort(service.slug, 'low');
                    }
                }}
                className="gap-0"
              >
                {showManualControls && (
                  <>
                    <ToggleGroupItem value="low" size="sm" className="h-6 w-8 px-0 rounded-md data-[state=on]:bg-background data-[state=on]:text-emerald-600 data-[state=on]:shadow-sm transition-all" title="سریع (Low)">
                      <Zap className="h-3.5 w-3.5" />
                    </ToggleGroupItem>
                    <ToggleGroupItem value="medium" size="sm" className="h-6 w-12 sm:w-12 mx-1 sm:mx-1 border-x border-muted rounded-md data-[state=on]:bg-background data-[state=on]:text-blue-600 data-[state=on]:shadow-sm transition-all" title="متعادل (Medium)">
                      <div className="flex gap-[1px]">
                        <Zap className="h-3.5 w-3.5" /><Zap className="h-3.5 w-3.5" />
                      </div>
                    </ToggleGroupItem>
                    <ToggleGroupItem value="high" size="sm" className="h-6 w-18 sm:w-18 px-0 rounded-md data-[state=on]:bg-background data-[state=on]:text-purple-600 data-[state=on]:shadow-sm transition-all" title="عمیق (High)">
                       <div className="flex gap-[1px]">
                        <Zap className="h-3.5 w-3.5" /><Zap className="h-3.5 w-3.5" /><Zap className="h-3.5 w-3.5" />
                      </div>
                    </ToggleGroupItem>
                  </>
                )}
                
                {supportsNoneEffort && (
                  <ToggleGroupItem 
                    value="none" 
                    size="sm" 
                    className={cn(
                        "h-6 w-6 px-0 rounded-md data-[state=on]:bg-background data-[state=on]:text-amber-500 data-[state=on]:shadow-sm transition-all",
                        showManualControls && "ml-1 border-l border-muted"
                    )}
                    title="حداقل (None)"
                  >
                    <Gauge className="h-3.5 w-3.5" />
                  </ToggleGroupItem>
                )}
              </ToggleGroup>
            </div>
            <Separator orientation="vertical" className="h-4 mx-1 hidden sm:block" />
          </>
        )}

        {showReasoningControls && isHybridReasoning && !isRunning && (
          <>
             <div 
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-md border transition-all cursor-pointer select-none",
                  settings.isReasoningEnabled 
                    ? "bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-300"
                    : "bg-transparent border-transparent text-muted-foreground hover:bg-muted"
                )}
                onClick={() => setReasoningEnabled(service.slug, !settings.isReasoningEnabled)}
                title="فعال‌سازی حالت استدلال (Reasoning)"
             >
                <Sparkles className={cn("h-3.5 w-3.5", settings.isReasoningEnabled && "fill-current")} />
                <span className="hidden sm:inline text-[10px] font-medium">
                  {settings.isReasoningEnabled ? "استدلال فعال" : "عادی"}
                </span>
             </div>
             {allowCollapse && <Separator orientation="vertical" className="h-4 mx-1 hidden sm:block" />}
          </>
        )}



        {allowCollapse && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground rounded-md transition-colors"
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