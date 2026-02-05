// frontend/components/canvas/renderers/tabs/RoadmapTab.tsx
"use client";

import { useState } from "react";
import { 
  Eye,
  FileText,
  Lock,
  Map,
  Play,
  Plus
} from "lucide-react";
import { TherapyRoadmap, RoadmapSession } from "@/lib/types/vania";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAssistantRuntime } from "@assistant-ui/react";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";

// --- Sub-Components ---
import { SessionDetail } from "./roadmap/SessionDetail";
import { AddSessionDialog } from "./roadmap/AddSessionDialog";

// --- Props Interface ---
interface Props {
  roadmap: TherapyRoadmap;
  patientId: number;
  patientName: string;
  allSessionsHistory: any[]; // Added this
  onEdit: (delta: any) => void;
}
/**
 * Renders the "Roadmap" (سند پشتیبان) tab, which serves as the central hub for the therapy plan.
 * It allows the doctor to:
 * - View the entire timeline of sessions.
 * - Start an active session, loading its context for the AI.
 * - View detailed, structured reports for completed sessions.
 * - Manually add new sessions to the plan.
 */
export function RoadmapTab({ roadmap, patientId, patientName, allSessionsHistory, onEdit }: Props) { // [FIX] Destructure it here
  const runtime = useAssistantRuntime();
  const [selectedSession, setSelectedSession] = useState<RoadmapSession | null>(null);

  // --- Event Handlers ---

  const handleStartSession = async (session: RoadmapSession) => {
    const toastId = toast.loading(`در حال فعال‌سازی جلسه ${session.session_number}...`);
    try {
        // 1. Notify the backend to set this session as "active" in the roadmap state
        await fetch(`${API_BASE_URL}/api/vania/roadmap/active/`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify({ patient_id: patientId, session_number: session.session_number })
        });
        
        toast.dismiss(toastId);
        toast.success(`جلسه ${session.session_number} (${session.title}) شروع شد.`);
        
        // 2. Send a system message to the agent to load the context for this session
        runtime.thread.append({
            role: "user",
            content: [{ type: "text", text: `من جلسه ${session.session_number} (${session.title}) را شروع کردم. لطفاً پروتکل و راهنمایی‌های لازم را ارائه بده.` }]
        });

    } catch (e) {
        toast.dismiss(toastId);
        toast.error("خطا در فعال‌سازی جلسه.");
    }
  };

  // --- Render States ---
  
  // [FIX] New Handler for adding sessions
  const handleSessionAdded = (newSession: RoadmapSession) => {
    const updatedSessions = [...(roadmap.sessions || []), newSession];
    onEdit({ 
        roadmap_data: { 
            ...roadmap, 
            sessions: updatedSessions 
        } 
    });
  };


  if (selectedSession) {
    return (
        <SessionDetail 
            session={selectedSession}
            allSessionsHistory={allSessionsHistory}
            patientName={patientName} 
            onBack={() => setSelectedSession(null)} 
        />
    );
  }

  // Handle Empty State with Add Button
  if (!roadmap || !roadmap.sessions || roadmap.sessions.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground border-2 border-dashed rounded-xl bg-muted/10 animate-in fade-in p-6 gap-4">
            <Map className="w-10 h-10 opacity-20" />
            <div className="text-center">
                <h3 className="text-sm font-semibold">نقشه راه درمان خالی است</h3>
                <p className="text-xs opacity-70 mt-1">جلسات را دستی اضافه کنید یا از دستیار بخواهید.</p>
            </div>
            <AddSessionDialog 
                patientId={patientId} 
                onSuccess={handleSessionAdded} // [FIX] Connect handler
                trigger={
                    <Button variant="outline" className="gap-2">
                        <Plus className="w-4 h-4" /> شروع برنامه‌ریزی
                    </Button>
                }
            />
        </div>
    );
  }

  // 3. List View (Timeline): The default view showing all sessions
  return (
    <div className="space-y-6 pb-10 animate-in fade-in slide-in-from-right-2 duration-300">
      
      <div className="bg-card border rounded-xl p-4 shadow-sm flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Map className="w-4 h-4 text-primary"/>
              نقشه راه درمان
          </h3>
          <AddSessionDialog 
            patientId={patientId} 
            onSuccess={handleSessionAdded} // [FIX] Connect handler
            trigger={
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1.5 text-primary hover:bg-primary/10">
                    <Plus className="w-3.5 h-3.5" /> افزودن جلسه
                </Button>
            }
          />
        </div>
        <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
          {(roadmap.treatment_approaches?.length || 0) > 0 ? (
             roadmap.treatment_approaches.map((app, i) => (
                <Badge key={i} variant="secondary" className="font-normal">{app}</Badge>
             ))
          ) : (
             <span className="text-xs text-muted-foreground italic">رویکرد درمانی هنوز انتخاب نشده است (مربوط به فاز ۳).</span>
          )}
        </div>
      </div>

      {/* --- Session Timeline --- */}
      <div className="relative border-r-2 border-border/60 mr-3.5 space-y-8 pl-1">
        {roadmap.sessions.map((session, index) => (
          <div key={index} className="relative pr-8 group">
            
            {/* Timeline Dot and Line */}
            <div className={cn(
                "absolute -right-[9px] top-5 w-4 h-4 rounded-full border-4 border-background shadow-sm z-10 transition-colors",
                session.status === "COMPLETED" ? "bg-emerald-500" :
                session.status === "READY" ? "bg-blue-500 ring-2 ring-blue-100" :
                "bg-muted-foreground/30"
            )} />

            <Card className={cn(
                "border transition-all duration-300 shadow-sm",
                session.status === "READY" ? "border-blue-200 bg-blue-50/10" : "border-border/50",
                roadmap.active_session_number === session.session_number ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
            )}>
              <CardContent className="p-4">
                {/* Session Header */}
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                      جلسه {session.session_number}: {session.title}
                    </h4>
                    <span className={cn(
                        "text-[10px] font-medium px-2 py-0.5 rounded mt-1.5 inline-block",
                        session.status === "DRAFT" && "bg-muted text-muted-foreground",
                        session.status === "READY" && "bg-blue-100 text-blue-700",
                        session.status === "COMPLETED" && "bg-emerald-100 text-emerald-700",
                    )}>
                      {session.status === "DRAFT" ? "برنامه‌ریزی شده" : 
                       session.status === "READY" ? "آماده اجرا" : "انجام شده"}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {/* View/Details Button */}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => setSelectedSession(session)}>
                      <Eye className="w-3.5 h-3.5" />
                    </Button>

                    {/* Start Session Button (only for non-completed sessions) */}
                    {session.status !== 'COMPLETED' && (
                        <Button 
                            size="sm" 
                            variant={session.status === 'READY' ? "default" : "outline"}
                            className="h-7 text-xs gap-1 px-2"
                            onClick={(e) => { e.stopPropagation(); handleStartSession(session); }}
                            disabled={roadmap.active_session_number === session.session_number}
                        >
                          <Play className="w-3 h-3" /> 
                          {roadmap.active_session_number === session.session_number ? 'فعال' : 'شروع'}
                        </Button>
                    )}
                  </div>
                </div>

                {/* Private Doctor Instructions (Preview) */}
                {session.doctor_instructions && (
                  <div className="relative p-2 pl-8 bg-amber-50/50 dark:bg-amber-900/10 border-r-2 border-amber-300 text-xs mt-2">
                      <Lock className="w-3 h-3 absolute top-2 left-2 text-amber-400" />
                      <p className="opacity-70 leading-relaxed text-amber-900 dark:text-amber-100 truncate">
                        <span className="font-semibold text-amber-700">راهنما:</span> {session.doctor_instructions}
                      </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}