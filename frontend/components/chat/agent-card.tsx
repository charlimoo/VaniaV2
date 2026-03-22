"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { 
  Bot, 
  Settings2, 
  Zap, 
  Play, 
  Info,
  Sparkles,
} from "lucide-react";
import { useAssistantRuntime } from "@assistant-ui/react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

import { AgentService } from "@/lib/types";

interface AgentCardProps {
  service: AgentService;
  trigger?: React.ReactNode;
}

export function AgentCard({ service, trigger }: AgentCardProps) {
  const runtime = useAssistantRuntime();
  const [open, setOpen] = useState(false);
  const isFeatured = !!service.ui_config?.featured;
  const featuredLabel = service.ui_config?.featured_label || "ویژه";
  
  const handleQuickAction = (actionName: string) => {
    setOpen(false);
    runtime.thread.append({
      role: "user",
      content: [{ type: "text", text: `لطفاً ${actionName} را اجرا کن.` }]
    });
  };

  const DefaultTrigger = (
    <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
      <Settings2 className="h-5 w-5" />
    </Button>
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || DefaultTrigger}
      </SheetTrigger>
      
      <SheetContent side="left" className="w-[350px] sm:w-[400px] p-0 flex flex-col font-sans" dir="rtl">
        
        {/* --- Header: Identity --- */}
        <SheetHeader className={isFeatured ? "p-6 pb-4 text-right border-b bg-gradient-to-br from-amber-50 via-background to-orange-50 dark:from-amber-950/20 dark:via-background dark:to-orange-950/10" : "p-6 pb-4 text-right bg-muted/10 border-b"}>
          <div className="flex items-start gap-4">
            <div className={isFeatured ? "h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 border shadow-sm bg-amber-100 text-amber-700 border-amber-300/60 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/50" : "h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0 border border-primary/20 shadow-sm"}>
              <Bot className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              {isFeatured && (
                <Badge className="mb-1 gap-1 rounded-full border-amber-300/60 bg-amber-100/80 px-2.5 py-0.5 text-[10px] font-medium text-amber-800 shadow-none dark:border-amber-700/50 dark:bg-amber-900/30 dark:text-amber-300">
                  <Sparkles className="h-3 w-3" />
                  {featuredLabel}
                </Badge>
              )}
              <SheetTitle className="text-lg font-bold leading-none pt-1">
                {service.name}
              </SheetTitle>
              <div className="flex flex-wrap items-center gap-2">

                {service.tags?.map(tag => (
                  <Badge key={tag} variant="outline" className="text-[10px] h-5 px-1.5 font-normal">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <SheetDescription className="text-xs text-muted-foreground mt-2 text-right leading-relaxed">
            {service.description}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-6 p-6">
            
            {/* 
                [REMOVED] Reasoning Settings Section 
                Reasoning controls (Effort/Toggle) are now located in the Chat Header.
            */}

            {/* --- Section 1: Quick Actions (Forms) --- */}
            {service.quick_actions && service.quick_actions.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground justify-end">

                  <span>عملیات سریع</span>
                  <div className="p-1 bg-blue-100 dark:bg-blue-900/30 rounded text-blue-600 dark:text-blue-400 justify-end ">
                    <Play className="h-3.5 w-3.5" />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {service.quick_actions.map((action) => (
                    <Button
                      key={action.handle}
                      variant="outline"
                      className="justify-start h-11 px-3 bg-background hover:bg-accent hover:text-accent-foreground text-right font-normal group border shadow-sm"
                      onClick={() => handleQuickAction(action.name)}
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted group-hover:bg-background transition-colors mr-2 ml-2">
                        <Zap className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
                      </span>
                      <span className="truncate flex-1 text-xs">{action.name}</span>
                      <Play className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity ml-auto" />
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* --- Section 2: User Guide --- */}
            {service.user_guide && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground justify-end">
                  <span>راهنمای استفاده</span>
                  <div className="p-1 bg-green-100 dark:bg-green-900/30 rounded text-green-600 dark:text-green-400">
                    <Info className="h-3.5 w-3.5" />
                  </div>

                </div>
                <div className="text-right rtl prose prose-sm dark:prose-invert text-xs bg-muted/30 p-4 rounded-xl border leading-relaxed text-muted-foreground [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:p-4">
                  <ReactMarkdown>
                    {service.user_guide}
                  </ReactMarkdown>
                </div>
              </div>
            )}

          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
