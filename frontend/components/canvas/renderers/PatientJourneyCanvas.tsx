"use client";

import { useState, useEffect } from "react";
import { LayoutDashboard, LifeBuoy, History, Library, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// --- Tab Imports ---
import { PatientHomeTab } from "./patient/PatientHomeTab";
import { PatientRescueNetTab } from "./patient/PatientRescueNetTab";
import { PatientTimelineTab } from "./patient/PatientTimelineTab";
import { PatientLibraryTab } from "./patient/PatientLibraryTab";

// --- Types ---
// Matches the structure returned by PatientDataService.get_patient_dashboard_snapshot
interface PatientState {
  greeting: string;
  current_phase: string;
  tasks: any[];
  timeline: any[];
  library: any[];
  active_goals: string[];
  // Tracks which tab is currently open (for persistence via backend sync)
  active_tab?: string; 
}

interface Props {
  data: PatientState;
  onEdit: (delta: Partial<PatientState>) => void;
  isLocked: boolean;
}

export default function PatientJourneyCanvas({ data, onEdit, isLocked }: Props) {
  // Initialize local state from props (backend source of truth)
  // Default to 'HOME' if not set
  const [activeTab, setActiveTab] = useState<string>(data?.active_tab || "HOME");

  // Sync local state if backend pushes a tab change (e.g. Agent says "Let's look at your tasks")
  useEffect(() => {
    if (data?.active_tab && data.active_tab !== activeTab) {
      setActiveTab(data.active_tab);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.active_tab]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    // Persist tab selection to backend so it survives refresh/device switch
    // and informs the Agent of the user's focus
    onEdit({ active_tab: tab });
  };

  // --- Loading / Empty State ---
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-background text-muted-foreground gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="text-sm">در حال دریافت اطلاعات پرونده...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background font-sans relative overflow-hidden" dir="rtl">
      
      {/* --- CONTENT AREA (Scrollable) --- */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 bg-muted/5 scroll-smooth">
        
        {activeTab === "HOME" && (
          <PatientHomeTab 
            greeting={data.greeting}
            currentPhase={data.current_phase}
            activeGoals={data.active_goals || []}
            onTabChange={handleTabChange}
          />
        )}

        {activeTab === "RESCUE" && (
          <PatientRescueNetTab 
            tasks={data.tasks || []}
            onEdit={onEdit}
          />
        )}

        {activeTab === "TIMELINE" && (
          <PatientTimelineTab 
            sessions={data.timeline || []}
            patientName={data.greeting.replace("سلام ", "").replace("دوست من", "")} 
          />
        )}

        {activeTab === "LIBRARY" && (
          <PatientLibraryTab 
            library={data.library || []}
            onEdit={onEdit}
          />
        )}

      </div>

      {/* --- BOTTOM NAVIGATION BAR --- */}
      {/* Fixed footer navigation for easy mobile access */}
      <div className="shrink-0 border-t border-border/40 bg-background/80 backdrop-blur-md pb-safe">
        <div className="grid grid-cols-4 gap-1 p-2">
          {[
            { id: "HOME", label: "خانه", icon: LayoutDashboard },
            { id: "RESCUE", label: "تور نجات", icon: LifeBuoy },
            { id: "TIMELINE", label: "مسیر من", icon: History },
            { id: "LIBRARY", label: "کتابخانه", icon: Library },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "flex flex-col items-center justify-center py-2.5 rounded-xl transition-all duration-300 relative overflow-hidden",
                  isActive 
                    ? "text-primary font-bold" 
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                {/* Active Indicator Background */}
                {isActive && (
                  <div className="absolute inset-0 bg-primary/10 rounded-xl animate-in zoom-in-95 duration-200" />
                )}
                
                <tab.icon className={cn("w-5 h-5 mb-1 z-10 transition-transform", isActive && "scale-110")} />
                <span className="text-[10px] z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}