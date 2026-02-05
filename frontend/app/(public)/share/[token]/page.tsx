// frontend/app/(public)/share/[token]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, AlertTriangle, Calendar } from "lucide-react";
import { ReadOnlyThread } from "@/components/share/read-only-thread";
import { API_BASE_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function SharedChatPage() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Public endpoint, no auth headers needed
        const res = await fetch(`${API_BASE_URL}/agent/share/${token}`);
        
        if (!res.ok) {
          if (res.status === 404) throw new Error("این لینک منقضی شده یا وجود ندارد.");
          throw new Error("خطا در بارگذاری گفتگو.");
        }

        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">در حال بارگذاری...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center max-w-md">
        <div className="bg-destructive/10 text-destructive p-4 rounded-full mb-4">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-bold mb-2">لینک نامعتبر</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button asChild>
          <Link href="/">بازگشت به خانه</Link>
        </Button>
      </div>
    );
  }

  // Convert Backend API format to assistant-ui ThreadMessage format
  const adaptedMessages = (data.chat_history || []).map((msg: any, index: number) => {
    // Generate a stable ID
    const id = `msg-${index}-${msg.created_at}`;
    const role = msg.role === 'model' ? 'assistant' : msg.role;
    
    // Construct Content Parts
    const content = [];
    
    // 1. Text Content
    if (msg.content) {
      let text = msg.content;
      if (typeof text !== 'string') text = JSON.stringify(text);
      content.push({ type: "text", text });
    }

    // 2. Tool Calls (Assistant side)
    if (role === 'assistant' && msg.tool_calls) {
      msg.tool_calls.forEach((tc: any) => {
        content.push({
          type: "tool-call",
          toolCallId: tc.id || tc.tool_call_id || `call-${index}`,
          toolName: tc.function?.name || tc.tool_name || "unknown",
          argsText: JSON.stringify(tc.function?.arguments || {}),
          args: tc.function?.arguments || {}
        });
      });
    }

    const baseMessage = {
      id,
      role,
      content,
      createdAt: new Date(msg.created_at * 1000),
    };

    // [FIX] Add required metadata fields to avoid Runtime TypeError
    if (role === 'assistant') {
      return {
        ...baseMessage,
        status: { type: "complete", reason: "unknown" } as const,
        metadata: {
          unstable_annotations: [],
          unstable_data: [],
          steps: [],
          custom: {},
        }
      };
    }

    // User Message
    return {
      ...baseMessage,
      metadata: { custom: {} }
    };

  }).reduce((acc: any[], curr: any) => {
    // Merge Tool Results back into the previous Assistant Message
    if (curr.role === 'tool') {
      const lastMsg = acc[acc.length - 1];
      
      if (lastMsg && lastMsg.role === 'assistant') {
        // Find tool call part without result
        const part = lastMsg.content.find((p: any) => p.type === 'tool-call' && !p.result);
        if (part) {
           part.result = curr.content[0]?.text; 
        }
      }
      return acc;
    }
    
    acc.push(curr);
    return acc;
  }, []);

  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Info */}
      <div className="text-center mb-10 space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {data.title || "گفتگوی به اشتراک گذاشته شده"}
        </h1>
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>{new Date(data.created_at).toLocaleDateString('fa-IR')}</span>
          <span>•</span>
          <span className="font-mono bg-muted px-1.5 rounded">{data.agent_slug}</span>
        </div>
      </div>

      {/* Chat Content */}
      <ReadOnlyThread messages={adaptedMessages} />
    </div>
  );
}