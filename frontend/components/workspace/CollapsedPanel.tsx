"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PanelLeftOpen, PanelRightOpen, MessageSquare, LayoutTemplate } from "lucide-react";

interface CollapsedPanelProps {
  side: "right" | "left"; // RTL Context: Right=Chat, Left=Canvas
  title: string;
  onExpand: () => void;
}

export function CollapsedPanel({ side, title, onExpand }: CollapsedPanelProps) {
  const isChat = side === "right";

  return (
    <div 
      className={cn(
        "h-full w-full flex flex-col items-center py-3 bg-muted/20 hover:bg-muted/40 border-border/50 transition-colors duration-300",
        // Add specific border based on side to maintain visual separation
        side === "right" ? "border-l" : "border-r"
      )}
    >
      
      {/* Expand Button */}
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-8 w-8 mb-4 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
        onClick={onExpand}
        title={`باز کردن ${title}`}
      >
        {/* 
           RTL Icon Logic:
           - If panel is on Right (Chat) and collapsed, we want to expand it Leftward (<-|). 
             PanelRightOpen usually looks like |<- (opening from right).
           - If panel is on Left (Canvas) and collapsed, we want to expand it Rightward (|->).
             PanelLeftOpen usually looks like ->| (opening from left).
        */}
        {side === "right" ? <PanelRightOpen className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
      </Button>

      {/* Vertical Text Label Container */}
      <div 
        className="flex-1 flex items-center justify-center cursor-pointer text-muted-foreground hover:text-foreground transition-colors w-full pb-8"
        onClick={onExpand}
      >
        {/* 
           Text Rotation Strategy:
           We rotate the container -90 degrees so text reads from Bottom to Top.
           This is the standard pattern for vertical tabs/spines in UI.
           'whitespace-nowrap' ensures the text stays on one line.
        */}
        <div className="rotate-[-90deg] whitespace-nowrap flex items-center gap-2 select-none origin-center">
          
          <span className="text-xs font-medium tracking-wide">
            {title}
          </span>
          
          {/* Icon (Rotated with text to maintain orientation relative to baseline) */}
          {isChat ? (
            <MessageSquare className="h-3.5 w-3.5 opacity-70" />
          ) : (
            <LayoutTemplate className="h-3.5 w-3.5 opacity-70" />
          )}
          
        </div>
      </div>

    </div>
  );
}