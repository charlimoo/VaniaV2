"use client";

import { Mic, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useConfig } from "@/components/providers/config-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AudioInputBillingProps {
  isRecording: boolean;
  onToggleRecord: () => void;
  disabled?: boolean;
}

export function AudioInputBilling({ isRecording, onToggleRecord, disabled }: AudioInputBillingProps) {
  const { config } = useConfig();

  // Parse cost to show clean numbers (e.g. "10" instead of "10.00" if integer)
  const costVal = parseFloat(config.transcription_cost_per_minute);
  const costDisplay = costVal % 1 === 0 ? costVal.toFixed(0) : costVal.toFixed(1);

  return (
    <div className="relative flex items-center">
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "transition-all duration-300 rounded-full h-10 w-10",
                isRecording 
                  ? "bg-red-500/10 text-red-500 hover:bg-red-500/20 animate-pulse ring-2 ring-red-500/20" 
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
              onClick={onToggleRecord}
              disabled={disabled}
            >
              <Mic className={cn("h-5 w-5", isRecording && "fill-current")} />
            </Button>
          </TooltipTrigger>
          
          <TooltipContent 
            side="top" 
            className="text-xs bg-popover border-border text-popover-foreground p-3 shadow-xl max-w-[200px]"
          >
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 border-b border-border/50 pb-1.5 mb-0.5">
                    <div className="p-1 bg-amber-500/10 rounded text-amber-600">
                        <Info className="w-3 h-3" />
                    </div>
                    <span className="font-semibold">تبدیل صدا به متن</span>
                </div>
                <div className="space-y-1">
                    <p className="opacity-90">
                        هزینه: <span className="font-bold text-amber-600 dark:text-amber-500">{costDisplay} {config.currency_name}</span> / دقیقه
                    </p>
                    <p className="opacity-60 text-[10px] leading-tight">
                        مدت زمان به سمت بالا رند می‌شود (حداقل ۱ دقیقه).
                    </p>
                </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}