"use client";

import { Check, Loader2 } from "lucide-react"; 
import { getSmartLabel } from "./tool-labels"; 
import { cn } from "@/lib/utils";

// Components that render their own visual UI should be skipped by the technical log
const VISUAL_TOOLS = ["generate_chart", "show_data_table", "show_media_card", "get_featured_products", "show_option_list", "send_form"];

// [FIX 1] Update signature to accept Tool Call props
export const ToolStack = ({ toolName, argsText, result }: any) => {
  // Don't render technical logs for tools that already have visual components (charts/tables)
  if (VISUAL_TOOLS.includes(toolName)) return null;

  const isDone = result !== undefined && result !== null;
  const status = isDone ? 'completed' : 'active';
  const label = getSmartLabel(toolName, status, argsText || "{}");

  return (
    <div className="my-2 min-w-full w-full max-w-xl font-sans" dir="rtl">
      <div className={cn(
        "overflow-hidden rounded-lg border px-2 py-2 flex items-center gap-2 transition-all duration-500",
        !isDone ? "bg-primary/5 border-primary/20 shadow-sm" : "bg-muted/30 border-transparent opacity-80"
      )}>
        <div className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all",
          !isDone ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground border-transparent"
        )}>
          {!isDone ? (
            <Loader2 className="size-2 animate-spin" /> 
          ) : (
            <Check className="size-2" />
          )}
        </div>

        <span className={cn(
          "text-xs font-medium truncate",
          !isDone ? "text-primary" : "text-muted-foreground"
        )}>
          {label}
        </span>
      </div>
    </div>
  );
};