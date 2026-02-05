// frontend/components/share/read-only-thread.tsx
"use client";

import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  ThreadPrimitive,
  MessagePrimitive,
  type ThreadMessage,
} from "@assistant-ui/react";
import { 
  ChartToolUI, 
  DataTableToolUI, 
  OptionListToolUI, 
  MediaCardToolUI 
} from "@/components/assistant-ui/tool-registry";
import { MarkdownText } from "@/components/assistant-ui/markdown-text";
import { ToolStack } from "@/components/assistant-ui/tool-stack";
import { Bot, User } from "lucide-react";

interface ReadOnlyThreadProps {
  messages: ThreadMessage[];
}

export function ReadOnlyThread({ messages }: ReadOnlyThreadProps) {
  
  // 1. Create a Static Runtime
  // useExternalStoreRuntime expects messages to have 'status' if they are assistant messages.
  const runtime = useExternalStoreRuntime({
    isRunning: false,
    messages: messages,
    // No-op handlers since this is read-only
    onNew: async () => {},
    onEdit: async () => {},
    onReload: async () => {},
    onCancel: async () => {},
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {/* Register Tool UIs so charts render */}
      <ChartToolUI />
      <DataTableToolUI />
      <OptionListToolUI />
      <MediaCardToolUI />

      <div className="w-full max-w-3xl space-y-8 pb-24">
        <ThreadPrimitive.Root className="w-full">
          <ThreadPrimitive.Messages
            components={{
              // Override components to strip actions (edit, copy, retry)
              UserMessage: PublicUserMessage,
              AssistantMessage: PublicAssistantMessage,
            }}
          />
        </ThreadPrimitive.Root>
      </div>
    </AssistantRuntimeProvider>
  );
}

// --- Sub-Components for Public View ---

const PublicUserMessage = () => (
  <MessagePrimitive.Root asChild>
    <div className="flex gap-4 items-start w-full justify-end group">
      <div className="bg-muted text-foreground px-5 py-3 rounded-2xl rounded-tr-sm max-w-[85%] text-sm leading-relaxed">
        <MessagePrimitive.Content />
      </div>
      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
        <User className="w-4 h-4 text-muted-foreground" />
      </div>
    </div>
  </MessagePrimitive.Root>
);

const PublicAssistantMessage = () => (
  <MessagePrimitive.Root asChild>
    <div className="flex gap-4 items-start w-full justify-start group">
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <Bot className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <span className="text-xs font-bold text-foreground/80 block mb-1">دستیار هوشمند</span>
        <div className="text-sm leading-relaxed text-foreground/90">
          <MessagePrimitive.Parts
            components={{
              Text: MarkdownText,
              tools: { Fallback: ToolStack }
            }}
          />
        </div>
      </div>
    </div>
  </MessagePrimitive.Root>
);