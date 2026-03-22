// frontend/components/debug-inspector.tsx
"use client";

import { useState, useEffect } from "react";
import { useThread } from "@assistant-ui/react";
import { AgentService } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bug, Copy, Check, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface DebugInspectorProps {
  service: AgentService | undefined;
}

const TOTAL_CONTEXT_LIMIT = 250_000;

type TokenUsageSummary = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  contextPercentage: number;
  usageSources: number;
  estimationMethod: "metadata" | "estimated";
};

function parseTokenValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.round(parsed));
    }
  }

  return null;
}

function extractTokenUsage(node: unknown): { input: number; output: number; total: number } | null {
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    return null;
  }

  const record = node as Record<string, unknown>;
  const input =
    parseTokenValue(record.input_tokens) ??
    parseTokenValue(record.prompt_tokens) ??
    parseTokenValue(record.inputTokens) ??
    parseTokenValue(record.promptTokens);
  const output =
    parseTokenValue(record.output_tokens) ??
    parseTokenValue(record.completion_tokens) ??
    parseTokenValue(record.outputTokens) ??
    parseTokenValue(record.completionTokens);
  const total =
    parseTokenValue(record.total_tokens) ??
    parseTokenValue(record.totalTokens);

  if (input === null && output === null && total === null) {
    return null;
  }

  return {
    input: input ?? 0,
    output: output ?? 0,
    total: total ?? (input ?? 0) + (output ?? 0),
  };
}

function estimateTokenCount(text: string): number {
  const normalized = text.trim();
  if (!normalized) return 0;

  const latinWordCount = (normalized.match(/[A-Za-z0-9_]+/g) || []).length;
  const nonLatinCharCount = (normalized.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []).length;
  const symbolCount = (normalized.match(/[^\sA-Za-z0-9_\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []).length;

  return Math.max(
    1,
    Math.ceil(latinWordCount * 1.3 + nonLatinCharCount / 2 + symbolCount / 2),
  );
}

function stringifyUnknown(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function estimateMessageTokens(message: unknown): { input: number; output: number } {
  if (!message || typeof message !== "object") {
    return { input: 0, output: 0 };
  }

  const record = message as Record<string, unknown>;
  const role = typeof record.role === "string" ? record.role : "unknown";
  const contentParts = Array.isArray(record.content) ? record.content : [];

  let tokenCount = 0;
  for (const part of contentParts) {
    if (!part || typeof part !== "object") continue;
    const partRecord = part as Record<string, unknown>;
    const partType = typeof partRecord.type === "string" ? partRecord.type : "unknown";

    if (partType === "text") {
      tokenCount += estimateTokenCount(stringifyUnknown(partRecord.text));
      continue;
    }

    if (partType === "tool-call") {
      tokenCount += estimateTokenCount(stringifyUnknown(partRecord.toolName || partRecord.toolCallName));
      tokenCount += estimateTokenCount(stringifyUnknown(partRecord.argsText || partRecord.args));
      tokenCount += estimateTokenCount(stringifyUnknown(partRecord.result));
      continue;
    }

    tokenCount += estimateTokenCount(stringifyUnknown(partRecord));
  }

  if (role === "assistant") {
    return { input: 0, output: tokenCount };
  }

  return { input: tokenCount, output: 0 };
}

function summarizeTokenUsage(messages: readonly unknown[]): TokenUsageSummary {
  const summary: TokenUsageSummary = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    contextPercentage: 0,
    usageSources: 0,
    estimationMethod: "metadata",
  };

  const visited = new WeakSet<object>();

  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (visited.has(value as object)) return;
    visited.add(value as object);

    const usage = extractTokenUsage(value);
    if (usage) {
      summary.inputTokens += usage.input;
      summary.outputTokens += usage.output;
      summary.totalTokens += usage.total;
      summary.usageSources += 1;
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    Object.values(value).forEach(visit);
  };

  messages.forEach(visit);

  if (summary.totalTokens === 0) {
    summary.estimationMethod = "estimated";
    for (const message of messages) {
      const estimated = estimateMessageTokens(message);
      summary.inputTokens += estimated.input;
      summary.outputTokens += estimated.output;
    }
    summary.totalTokens = summary.inputTokens + summary.outputTokens;
  }

  summary.contextPercentage = Number(
    ((summary.totalTokens / TOTAL_CONTEXT_LIMIT) * 100).toFixed(2),
  );

  return summary;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function DebugInspector({ service }: DebugInspectorProps) {
  const messages = useThread((t) => t.messages);
  const [copied, setCopied] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // [NEW] Check if running on Localhost
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hostname = window.location.hostname;
      // Check for standard localhost addresses
      const isLocal = 
        hostname === "localhost" || 
        hostname === "127.0.0.1" || 
        hostname.startsWith("192.168."); // Optional: Allow local network debugging

      setIsVisible(isLocal);
    }
  }, []);

  // [NEW] Don't render anything if not on localhost
  if (!isVisible) return null;

  // 1. Construct the Full Context
  const tokenUsage = summarizeTokenUsage(messages || []);
  const fullDebugData = {
    service: service
      ? {
          id: service.id,
          slug: service.slug,
          name: service.name,
          model_id: service.model_id,
        }
      : null,
    context_usage: {
      input_tokens: tokenUsage.inputTokens,
      output_tokens: tokenUsage.outputTokens,
      total_tokens: tokenUsage.totalTokens,
      total_context_limit: TOTAL_CONTEXT_LIMIT,
      context_percentage: tokenUsage.contextPercentage,
      usage_sources: tokenUsage.usageSources,
      estimation_method: tokenUsage.estimationMethod,
    },
    messages: [...(messages || [])],
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(fullDebugData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
          title="Debug Context"
        >
          <Bug className="size-4" />
        </Button>
      </DialogTrigger>
      
      <DialogContent 
        className="max-w-4xl flex flex-col p-0 gap-0 sm:rounded-xl overflow-hidden" 
        dir="ltr"
        style={{ height: '85vh' }}
      >
        <DialogHeader className="px-6 py-4 border-b border-border/50 shrink-0 bg-background/95 backdrop-blur">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <DialogTitle className="flex items-center gap-2">
                <Bug className="size-5 text-primary" /> Debug Context
                <span className="text-[10px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded border border-amber-500/20">Localhost Only</span>
              </DialogTitle>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="gap-2 h-8 text-xs font-mono"
            >
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
              {copied ? "Copied" : "Copy JSON"}
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto bg-[#1e1e1e] text-[#d4d4d4] font-mono text-xs p-4 selection:bg-blue-500/30">
          <div className="mb-4 grid gap-3 md:grid-cols-4">
            <UsageCard
              label="Input Tokens"
              value={formatNumber(tokenUsage.inputTokens)}
            />
            <UsageCard
              label="Output Tokens"
              value={formatNumber(tokenUsage.outputTokens)}
            />
            <UsageCard
              label="Total Tokens"
              value={formatNumber(tokenUsage.totalTokens)}
            />
            <UsageCard
              label="Context Usage"
              value={`${tokenUsage.contextPercentage}%`}
              subValue={`${formatNumber(tokenUsage.totalTokens)} / ${formatNumber(TOTAL_CONTEXT_LIMIT)} (${tokenUsage.estimationMethod})`}
            />
          </div>

          <InteractiveJsonNode 
            data={fullDebugData} 
            name="root" 
            isLast={true} 
            defaultOpen={true} 
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function UsageCard({ label, value, subValue }: { label: string; value: string; subValue?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-zinc-400">{label}</div>
      <div className="mt-1 text-base font-semibold text-white">{value}</div>
      {subValue ? <div className="mt-1 text-[10px] text-zinc-500">{subValue}</div> : null}
    </div>
  );
}

// --- Recursive JSON Viewer (Unchanged) ---

interface JsonNodeProps {
  data: any;
  name?: string | number;
  isLast: boolean;
  defaultOpen?: boolean;
}

function InteractiveJsonNode({ data, name, isLast, defaultOpen = false }: JsonNodeProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // 1. Primitives
  if (data === null) return <PrimitiveRow name={name} value="null" color="text-gray-500" isLast={isLast} />;
  if (typeof data === "boolean") return <PrimitiveRow name={name} value={data.toString()} color="text-blue-400" isLast={isLast} />;
  if (typeof data === "number") return <PrimitiveRow name={name} value={data.toString()} color="text-green-400" isLast={isLast} />;
  if (typeof data === "string") return <PrimitiveRow name={name} value={`"${data}"`} color="text-orange-300" isLast={isLast} />;

  // 2. Objects & Arrays
  const isArray = Array.isArray(data);
  const keys = Object.keys(data);
  const isEmpty = keys.length === 0;
  const bracketOpen = isArray ? "[" : "{";
  const bracketClose = isArray ? "]" : "}";
  const typeLabel = isArray ? `Array(${keys.length})` : "Object";

  if (isEmpty) {
    return (
      <div className="pl-4">
        {name !== undefined && <span className="text-purple-400 mr-1">{name}:</span>}
        <span className="text-zinc-500">{bracketOpen}{bracketClose}</span>
        {!isLast && <span className="text-zinc-500">,</span>}
      </div>
    );
  }

  return (
    <div className="group">
      <div 
        className="flex items-start cursor-pointer hover:bg-white/10 rounded-sm px-1 -ml-1 select-none transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="mt-0.5 mr-1 text-zinc-500 opacity-70">
          {isOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        </span>
        
        {name !== undefined && (
          <span className="text-purple-400 mr-2">{name}:</span>
        )}

        <span className="text-yellow-500">{bracketOpen}</span>
        
        {!isOpen && (
          <span className="text-zinc-500 italic ml-2 text-[10px]">{typeLabel} ...</span>
        )}
        
        {!isOpen && <span className="text-yellow-500">{bracketClose}</span>}
        {!isOpen && !isLast && <span className="text-zinc-500">,</span>}
      </div>

      {isOpen && (
        <div className="border-l border-white/10 ml-2.5 pl-4">
          {keys.map((key, index) => (
            <InteractiveJsonNode
              key={key}
              name={isArray ? undefined : key}
              data={data[key]}
              isLast={index === keys.length - 1}
              defaultOpen={false} 
            />
          ))}
          <div className="text-yellow-500">
            {bracketClose}
            {!isLast && <span className="text-zinc-500">,</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function PrimitiveRow({ name, value, color, isLast }: { name?: string | number; value: string; color: string; isLast: boolean }) {
  return (
    <div className="pl-6 hover:bg-white/10 rounded-sm px-1 -ml-1 flex items-start">
      {name !== undefined && <span className="text-purple-400 mr-2 shrink-0">{name}:</span>}
      <span className={cn(color, "break-all whitespace-pre-wrap")}>{value}</span>
      {!isLast && <span className="text-zinc-500">,</span>}
    </div>
  );
}
