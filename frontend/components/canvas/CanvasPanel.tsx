// frontend/components/canvas/CanvasPanel.tsx
"use client";

import { useCanvasStore } from "@/lib/canvas/store";
import { CanvasRegistry } from "@/components/canvas/CanvasRegistry";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PanelRightClose, Lock, LockOpen, LayoutTemplate, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { DemoConfig } from "@/lib/types"; // [FIX] Import the DemoConfig type

// --- Helper: Translate Backend Tab Names ---
const translateTabName = (name: string): string => {
  const map: Record<string, string> = {
    "Data Dashboard": "داشبورد داده‌ها",
    "Analysis": "تحلیل",
    "Code": "کد",
    "Preview": "پیش‌نمایش",
    "Canvas": "بوم"
  };
  return map[name] || name;
};

// [FIX] Update props interface to accept demoConfig
interface CanvasPanelProps {
  onCollapse: () => void;
  isPreviewMode?: boolean;
  demoConfig?: DemoConfig; 
}

export function CanvasPanel({ onCollapse, isPreviewMode = false, demoConfig }: CanvasPanelProps) {
  // --- Store Selection ---
  const instances = useCanvasStore((s) => s.instances);
  const activeTabId = useCanvasStore((s) => s.activeTabId);
  const isLocked = useCanvasStore((s) => s.isLocked);
  
  const setActiveTab = useCanvasStore((s) => s.setActiveTab);
  const updateCanvas = useCanvasStore((s) => s.updateCanvas);

  // Filter instances to only show those marked visible (open tabs)
  const tabs = Object.values(instances).filter(i => i.is_visible);

  // [FIX] Logic now correctly uses the passed-in demoConfig prop
  const canvasMode = demoConfig?.canvas_mode || (isPreviewMode ? 'LOCKED' : 'OPEN');
  const shouldLock = isPreviewMode && canvasMode === 'LOCKED';
  const placeholderText = demoConfig?.canvas_placeholder_text || "برای مشاهده داشبوردهای تعاملی و استفاده از ابزارهای بصری پیشرفته، حساب خود را ارتقا دهید.";

  // --- Empty State ---
  if (tabs.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-muted/20 text-muted-foreground p-4 text-center" dir="rtl">
        <LayoutTemplate className="size-10 mb-2 opacity-20" />
        <p className="text-sm font-medium">هیچ بوم فعالی وجود ندارد</p>
        <p className="text-xs mt-1">از دستیار بخواهید داده‌ها را تحلیل کند یا سندی بنویسد.</p>
      </div>
    );
  }

  // Determine active instance
  const activeInstance = activeTabId ? instances[activeTabId] : null;

  return (
    <div className="flex h-full flex-col border-r border-border bg-background transition-all duration-300 relative overflow-hidden" dir="rtl">
      
      {/* --- Header / Tab Bar --- */}
      <div className="flex h-12 min-w-0 items-center justify-between border-b px-2 bg-muted/10 shrink-0">
        
        {/* Scrollable Tab List */}
        <div className="ml-1 min-w-0 flex-1 overflow-x-auto scrollbar-hide sm:ml-2">
          {/* <Tabs 
            value={activeTabId || undefined} 
            onValueChange={setActiveTab}
            className="w-full min-w-max"
            dir="rtl"
          >
            <TabsList className="h-8 min-w-max justify-start gap-1 bg-transparent p-0">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className={cn(
                    "h-7 shrink-0 rounded-md border border-transparent px-2.5 text-xs select-none sm:px-3",
                    "data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border-border/50",
                    "data-[state=active]:text-foreground text-muted-foreground"
                  )}
                >
                  {translateTabName(tab.name)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs> */}
        </div>

        {/* Actions Area */}
        <div className="flex shrink-0 items-center gap-1 pl-2 pr-1.5 sm:gap-1.5 sm:pl-3 sm:pr-2">
          
          {/* Lock / Sync Status Indicator */}
          <div 
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors duration-300 cursor-help",
              isLocked 
                ? "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800/50" 
                : "bg-transparent text-muted-foreground border-transparent"
            )}
            title={isLocked ? "دستیار در حال بروزرسانی بوم است. ویرایش قفل شده است." : "بوم باز است. می‌توانید ویرایش کنید."}
          >
            {isLocked ? <Lock className="size-3" /> : <LockOpen className="size-3 opacity-50" />}
            {isLocked && <span className="hidden md:inline">در حال همگام‌سازی</span>}
          </div>

          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 rounded-md hover:bg-muted" 
            onClick={onCollapse}
            title="بستن پنل" 
          >
            <PanelRightClose className="size-4" style={{ transform: "scaleX(-1)" }} />
          </Button>
        </div>
      </div>

      {/* --- Main Content Body --- */}
      <div className="relative flex-1 min-h-0 min-w-0 overflow-hidden group text-right" dir="rtl">
        {activeInstance ? (
          <CanvasRegistry
            componentKey={activeInstance.component_key}
            canvasId={activeInstance.id}
            data={activeInstance.current_state}
            onEdit={(delta) => updateCanvas(activeInstance.id, delta, false, 'USER')}
            isLocked={isLocked || shouldLock}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <span className="text-sm">یک زبانه را برای مشاهده محتوا انتخاب کنید</span>
          </div>
        )}
        
        {/* Visual Lock Overlay (Syncing) */}
        {isLocked && !shouldLock && (
          <div className="absolute inset-0 bg-background/5 z-[60] pointer-events-none transition-opacity duration-300" />
        )}
      </div>

      {/* --- PREVIEW OVERLAY --- */}
      {shouldLock && (
        <div className="absolute inset-0 z-[100] overflow-hidden">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-md select-none transition-all duration-700" />
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 duration-500 delay-100">
                
                <div className="relative group">
                    <div className="absolute inset-0 bg-amber-500/20 blur-xl rounded-full group-hover:bg-amber-500/30 transition-all duration-500" />
                    <div className="relative h-20 w-20 rounded-3xl bg-gradient-to-br from-amber-100 to-orange-50 dark:from-amber-900/40 dark:to-orange-950/40 border border-amber-200/50 dark:border-amber-700/50 flex items-center justify-center shadow-xl mb-6 transform group-hover:scale-105 transition-transform duration-300">
                        <Lock className="h-10 w-10 text-amber-600 dark:text-amber-500" />
                    </div>
                </div>
                
                <div className="space-y-3 max-w-xs">
                    <h3 className="text-2xl font-black text-foreground tracking-tight">
                        دسترسی محدود
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                        {placeholderText}
                    </p>
                </div>

                <div className="mt-8 w-full max-w-xs space-y-3">
                    <Button 
                        size="lg"
                        className="w-full h-12 text-base font-bold gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg shadow-amber-500/25 border-0 hover:scale-[1.02] transition-all duration-300" 
                        asChild
                    >
                        <Link href="/dashboard/billing">
                            <Sparkles className="h-5 w-5 fill-white/20" /> مشاهده طرح‌ها و اعتبار
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
