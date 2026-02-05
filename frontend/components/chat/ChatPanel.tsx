// start of frontend/components/chat/ChatPanel.tsx
"use client";

import { Thread } from "@/components/assistant-ui/thread";
import { ChatHeader } from "./ChatHeader";
import { CollapsedPanel } from "@/components/workspace/CollapsedPanel";
import { AgentService } from "@/lib/types";

interface ChatPanelProps {
  service: AgentService;
  threadId: string;
  isCollapsed: boolean;
  onCollapse: () => void;
  onExpand: () => void;
  allowCollapse?: boolean;
  
  isPreviewMode?: boolean;
  currentUsage?: number;
  capabilities?: string[]; // Optional prop if passed explicitly, though we can read from service
}

export function ChatPanel({ 
  service, 
  threadId,
  isCollapsed, 
  onCollapse, 
  onExpand, 
  allowCollapse = true,
  isPreviewMode = false,
  currentUsage = 0 
}: ChatPanelProps) {
  
  if (isCollapsed) {
    return (
      <CollapsedPanel 
        side="right" 
        title="گفتگو" 
        onExpand={onExpand}
      />
    );
  }

  // Ensure we have a valid array
  const activeCapabilities = service.capabilities || [];

  return (
    <div className="flex flex-col h-full w-full bg-background border-l border-border transition-all duration-300">
      
      <ChatHeader 
        service={service}
        threadId={threadId}
        onCollapse={onCollapse}
        allowCollapse={allowCollapse} 
      />

      <div className="flex-1 overflow-hidden relative">
        <Thread 
            suggestions={service.suggestions} 
            showVoiceInput={service.ui_config?.show_voice_input ?? true}
            isPreviewMode={isPreviewMode}
            demoConfig={service.demo_config}
            currentUsage={currentUsage}
            capabilities={activeCapabilities} // [FIX] Pass capabilities down to Thread
        />
      </div>
      
    </div>
  );
}
// end of frontend/components/chat/ChatPanel.tsx