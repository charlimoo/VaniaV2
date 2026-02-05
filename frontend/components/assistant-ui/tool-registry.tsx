"use client";

import { makeAssistantToolUI, useAssistantRuntime, useMessage, type ToolCallMessagePart  } from "@assistant-ui/react";
import { Loader2, BrainCircuit, FileText, Clock, CheckCircle2, ChevronDown, ChevronLeft  } from "lucide-react";
import { useState } from "react";
import * as m from "motion/react-m";
import { cn } from "@/lib/utils";
// --- Tool UI Components & Parsers ---
// Make sure these paths match your project structure
import { Chart, parseSerializableChart } from "@/components/tool-ui/chart";
import { DataTable, parseSerializableDataTable } from "@/components/tool-ui/data-table";
import { OptionList, parseSerializableOptionList } from "@/components/tool-ui/option-list";
import { MediaCard, parseSerializableMediaCard } from "@/components/tool-ui/media-card";
import { ProductCards } from "@/components/tool-ui/commerce/product-cards";
import { DynamicForm } from "@/components/tool-ui/form/dynamic-form"

interface CompletedFormResult {
  form_handle: string;
  title: string;
  description?: string;
  schema: { name: string; label: string; type?: string }[];
  data?: Record<string, any>; // If present, the form is submitted
}


/**
 * Helper to safely parse JSON
 */
const safeParseJSON = (input: any) => {
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      if (typeof parsed === 'string') return JSON.parse(parsed);
      return parsed;
    } catch {
      return input;
    }
  }
  return input;
};

// -----------------------------------------------------------------------------
// 1. Chart Tool (With Loading Skeleton & Validation)
// -----------------------------------------------------------------------------
export const ChartToolUI = makeAssistantToolUI({
  toolName: "generate_chart",
  render: ({ result, args, status }) => {
    // A. Loading State (While tool is running)
    // This shows up immediately when the agent decides to call the tool, before Python finishes.
    if (!result && status.type === 'running') {
      const title = args?.title || "در حال ترسیم نمودار...";
      return (
        <div className="my-4 w-full rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col gap-4 animate-pulse" dir="rtl">
          <div className="flex items-center gap-3 text-muted-foreground">
             <Loader2 className="h-5 w-5 animate-spin text-primary" />
             <span className="text-sm font-medium">نمودار رسم شد</span>
          </div>
          {/* Visual Skeleton of the chart area */}
          <div className="h-48 w-full bg-muted/50 rounded-lg" />
        </div>
      );
    }

    if (!result) return null;
    
    // B. Render State
    try {
      const parsedResult = safeParseJSON(result);
      
      // Strict Schema Check (Phase 1 Compliance)
      if (!parsedResult || !Array.isArray(parsedResult.data) || !parsedResult.xKey) {
         console.warn("[ChartTool] Invalid Schema received:", parsedResult);
      }

      const props = parseSerializableChart(parsedResult);
      return <div dir="rtl"><Chart {...props} className="my-4" /></div>;
    } catch (e: any) {
      console.error("[ChartTool] Error:", e);
      return null;
    }
  },
});

// -----------------------------------------------------------------------------
// 2. Data Table Tool (With SQL Processing State)
// -----------------------------------------------------------------------------
export const DataTableToolUI = makeAssistantToolUI({
  toolName: "show_data_table",
  render: ({ result, args, status }) => {
    const runtime = useAssistantRuntime();

    // Contextual Loading State for SQL Queries
    if (!result && status.type === 'running') {
       return (
        <div className="my-4 w-full rounded-xl border border-border bg-card p-4 shadow-sm" dir="rtl">
          <div className="flex items-center gap-2 mb-4 text-blue-600">
             <Loader2 className="h-4 w-4 animate-spin" />
             <span className="text-xs font-medium">در حال پردازش داده‌های SQL...</span>
          </div>
          {/* Skeleton Rows */}
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 w-full animate-pulse rounded bg-muted/30" />
            ))}
          </div>
        </div>
      );
    }

    if (!result) return null;
    
    // Render State
    try {
      const parsedResult = safeParseJSON(result);
      const props = parseSerializableDataTable(parsedResult);
      
      return (
        <DataTable 
          {...props} 
          className="my-4"
          // Interaction Handler: Sends action back to LLM in Persian context
          onFooterAction={(actionId) => {
            console.log(`[DataTable] Action clicked: ${actionId}`);
            runtime.thread.append({
              role: "user",
              content: [{ type: "text", text: `گزینه "${actionId}" را از جدول انتخاب کردم.` }]
            });
          }}
        />
      );
    } catch (e) {
      console.error("[DataTable] Validation failed:", e);
      return (
        <div className="my-4 rounded-lg border border-border p-3 text-xs text-muted-foreground text-right" dir="rtl">
          خطا در نمایش جدول. داده‌ها نامعتبر هستند.
        </div>
      );
    }
  },
});

// -----------------------------------------------------------------------------
// 3. Option List Tool
// -----------------------------------------------------------------------------
export const OptionListToolUI = makeAssistantToolUI({
  toolName: "show_option_list",
  render: ({ result, addResult }) => {
    const runtime = useAssistantRuntime();

    if (!result) {
      // Simple skeleton for options
      return (
        <div className="my-4 w-full max-w-md space-y-2" dir="rtl">
          <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
          <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
        </div>
      );
    }
    
    try {
      const parsedResult = safeParseJSON(result);
      const props = parseSerializableOptionList(parsedResult);
      
      return (
        <div dir="rtl">
          <OptionList 
            {...props} 
            className="my-4"
            footerActions={{
              items: [
                { id: "cancel", label: "انصراف", variant: "ghost" },
                { id: "confirm", label: "ثبت انتخاب", variant: "default" },
              ],
              align: "left",
            }}
            onConfirm={async (selection) => {
              if (!selection) return;
              addResult({ ...parsedResult, confirmed: selection });
              const valueStr = Array.isArray(selection) ? selection.join("، ") : selection;
              await runtime.thread.append({
                role: "user",
                content: [{ type: "text", text: `من این گزینه را انتخاب کردم: ${valueStr}` }]
              });
            }}
          />
        </div>
      );
    } catch (e) {
      return null;
    }
  },
});

// -----------------------------------------------------------------------------
// 4. Media Card Tool
// -----------------------------------------------------------------------------
export const MediaCardToolUI = makeAssistantToolUI({
  toolName: "show_media_card",
  render: ({ result }) => {
    if (!result) {
      return <div className="my-4 h-64 w-full max-w-[400px] animate-pulse rounded-xl bg-muted" dir="rtl" />;
    }
    try {
      const parsedResult = safeParseJSON(result);
      const props = parseSerializableMediaCard(parsedResult);
      return <div dir="rtl"><MediaCard {...props} maxWidth="400px" className="my-4" /></div>;
    } catch (e) {
      return null;
    }
  },
});

// -----------------------------------------------------------------------------
// 5. Product Carousel
// -----------------------------------------------------------------------------
export const ProductCarouselToolUI = makeAssistantToolUI({
  toolName: "get_featured_products",
  render: ({ result }) => {
    if (!result) {
      return (
        <div className="my-4 flex gap-4 overflow-hidden" dir="rtl">
          <div className="h-64 w-48 shrink-0 animate-pulse rounded-xl bg-muted" />
          <div className="h-64 w-48 shrink-0 animate-pulse rounded-xl bg-muted" />
        </div>
      );
    }
    const parsedResult = safeParseJSON(result);
    const items = parsedResult?.items || [];
    if (!Array.isArray(items) || items.length === 0) return null;

    return <div dir="rtl"><ProductCards items={items} /></div>;
  },
});

// ----------------------------------------------------------------------------
// [NEW] Completed Form View Component
// This renders the "Minimal" read-only view of a filled form
// -----------------------------------------------------------------------------
function CompletedFormView({ result }: { result: CompletedFormResult }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { title, schema, data } = result;

  if (!data) return null;

  return (
    <div className="my-2 min-w-full w-full max-w-md font-sans" dir="rtl">
      <div className={cn(
        "overflow-hidden rounded-xl border transition-all duration-300",
        isExpanded ? "bg-background border-primary/20 shadow-sm" : "bg-muted/40 border-transparent"
      )}>
        {/* Header / Toggle */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex w-full items-center gap-3 px-4 py-3 text-start hover:bg-muted/50 transition-colors"
        >
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle2 className="size-4" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-foreground truncate">
              {title || "فرم اطلاعات"}
            </h4>
            <span className="text-[10px] text-muted-foreground block">
              تکمیل شده
            </span>
          </div>

          <div className="text-muted-foreground/50">
            {isExpanded ? <ChevronDown className="size-4" /> : <ChevronLeft className="size-4" />}
          </div>
        </button>
        
        {/* Expanded Content: Key-Value Pairs */}
        <m.div
          initial={false}
          animate={{ height: isExpanded ? "auto" : 0 }}
          className="overflow-hidden"
        >
          <div className="border-t border-border/50 bg-background/50 px-4 py-3 space-y-2">
            {Object.entries(data).map(([key, value]) => {
              // Find the human-readable label from the schema
              const fieldDef = schema?.find((f) => f.name === key);
              const label = fieldDef?.label || key;
              
              // Handle boolean values (checkboxes)
              let displayValue = String(value);
              if (typeof value === 'boolean') displayValue = value ? 'بله' : 'خیر';
              
              return (
                <div key={key} className="flex justify-between items-start text-xs group">
                  <span className="text-muted-foreground font-medium min-w-[30%]">{label}:</span>
                  <span className="text-foreground text-left font-medium break-words max-w-[65%]">
                    {displayValue}
                  </span>
                </div>
              );
            })}
          </div>
        </m.div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// [UPDATED] Dynamic Form Tool UI
// Switches between Live Form and Completed View
// -----------------------------------------------------------------------------
export const DynamicFormToolUI = makeAssistantToolUI({
  toolName: "send_form",
  render: ({ result, status, addResult }) => {
    const runtime = useAssistantRuntime();

    // 1. Loading State (Before backend responds)
    if (!result && status.type === 'running') {
      return (
        <div className="my-4 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col items-center justify-center gap-3 animate-pulse" dir="rtl">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">در حال آماده‌سازی فرم...</p>
        </div>
      );
    }

    if (!result) return null;

    // 2. Parse Result
    const payload = safeParseJSON(result) as CompletedFormResult;
    if (!payload || !payload.form_handle || !Array.isArray(payload.schema)) {
       return null;
    }

    // 4. Check if Form is Completed
    // If 'data' exists in the payload, it means it was submitted (or restored from history with data)
    const isCompleted = !!payload.data;

    if (isCompleted) {
      return <CompletedFormView result={payload} />;
    }
    const isStreaming = status.type !== 'complete';
    // 6. Render Live Form
    return (
      <div className="w-full flex justify-center my-4">
        <DynamicForm 
            formHandle={payload.form_handle}
            schema={payload.schema as any}
            prefill={payload.data || {}} // Use data as prefill if checking a draft
            title={payload.title}
            description={payload.description}
            disabled={isStreaming}
            onSuccess={(submittedData) => {
              // A. Update the Tool Result in the UI immediately
              // This switches the view to <CompletedFormView />
              addResult({
                ...payload,
                data: submittedData, // Merge the submission into the result
              });

              // B. Send the data to the Agent as a new message
              // This ensures the LLM receives the data to proceed
              runtime.thread.append({
                role: "user",
                content: [{ 
                  type: "text", 
                  // Sending JSON allows the LLM to parse it reliably
                  text: JSON.stringify(submittedData) 
                }]
              });
            }}
        />
      </div>
    );
  },
});