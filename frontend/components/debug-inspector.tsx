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
  const fullDebugData = [
    // Actual Chat History
    ...(messages || []),
  ];

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