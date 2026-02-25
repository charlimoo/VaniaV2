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
            requiresVisitorSelector={service.requires_visitor_selector ?? false}
        />
      </div>
      
    </div>
  );
}
// end of frontend/components/chat/ChatPanel.tsx
