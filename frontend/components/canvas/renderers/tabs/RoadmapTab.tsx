// frontend/components/canvas/renderers/tabs/RoadmapTab.tsx
"use client";

import { useEffect, useState } from "react";
import { 
  ArrowDown,
  ArrowUp,
  Eye,
  FileText,
  Trash2,
  X,
  Lock,
  Map,
  Play,
  Plus,
  Target 
} from "lucide-react";
import { TherapyRoadmap, RoadmapSession } from "@/lib/types/vania";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";

// --- Sub-Components ---
import { SessionDetail } from "./roadmap/SessionDetail";
import { AddSessionDialog } from "./roadmap/AddSessionDialog";

// --- Props Interface ---
interface Props {
  roadmap: TherapyRoadmap;
  activeGoals: string[]; // [NEW]
  patientId: number;
  caseId?: string;
  patientName: string;
  allSessionsHistory: any[]; 
  onEdit: (delta: any) => void;
  readOnly?: boolean;
}
/**
 * Renders the "Roadmap" (سند پشتیبان) tab, which serves as the central hub for the therapy plan.
 * It allows the doctor to:
 * - View the entire timeline of sessions.
 * - Start an active session, loading its context for the AI.
 * - View detailed, structured reports for completed sessions.
 * - Manually add new sessions to the plan.
 */
export function RoadmapTab({ roadmap, activeGoals, patientId, caseId, patientName, allSessionsHistory, onEdit, readOnly = false }: Props) {
  const [selectedSession, setSelectedSession] = useState<RoadmapSession | null>(null);
  const [approachDraft, setApproachDraft] = useState("");

  useEffect(() => {
    if (!selectedSession) return;
    const nextSelectedSession = (roadmap.sessions || []).find(
      (session) => session.session_number === selectedSession.session_number
    );
    if (nextSelectedSession) {
      setSelectedSession(nextSelectedSession);
    }
  }, [roadmap.sessions, selectedSession]);

  // --- Event Handlers ---

  const handleStartSession = async (session: RoadmapSession) => {
    if (readOnly) {
      toast.error("این پرونده فقط برای مشاهده در اختیار شماست.");
      return;
    }
    const toastId = toast.loading(`در حال فعال‌سازی جلسه ${session.session_number}...`);
    try {
        // 1. Notify the backend to set this session as "active" in the roadmap state
        await fetch(`${API_BASE_URL}/api/vania/roadmap/active/`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify({ patient_id: patientId, session_number: session.session_number, case_id: caseId })
        });
        
        toast.dismiss(toastId);
        toast.success(`جلسه ${session.session_number} (${session.title}) شروع شد.`);

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

  const handleMoveSession = (index: number, direction: "up" | "down") => {
    const sessions = roadmap.sessions || [];
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= sessions.length) {
      return;
    }

    const updatedSessions = [...sessions];
    const [movedSession] = updatedSessions.splice(index, 1);
    updatedSessions.splice(targetIndex, 0, movedSession);

    onEdit({
      roadmap_data: {
        ...roadmap,
        sessions: updatedSessions,
      },
    });
  };

  const handleDeleteSession = async (session: RoadmapSession) => {
    if (readOnly) return;
    if (!confirm(`جلسه ${session.session_number} حذف شود؟`)) return;

    try {
      const query = new URLSearchParams({
        patient_id: String(patientId),
        session_number: String(session.session_number),
      });
      if (caseId) query.set("case_id", caseId);

      const res = await fetch(`${API_BASE_URL}/api/vania/roadmap/?${query.toString()}`, {
        method: "DELETE",
        headers: { ...getAuthHeaders() },
      });

      if (!res.ok) throw new Error("حذف جلسه ناموفق بود.");

      const updatedRoadmap: TherapyRoadmap = await res.json();
      onEdit({ roadmap_data: updatedRoadmap });
      toast.success("جلسه حذف شد.");
    } catch (e: any) {
      toast.error(e.message || "خطا در حذف جلسه.");
    }
  };

  const saveTreatmentApproaches = async (nextApproaches: string[]) => {
    onEdit({
      roadmap_data: {
        ...roadmap,
        treatment_approaches: nextApproaches,
      },
    });

    try {
      const res = await fetch(`${API_BASE_URL}/api/vania/roadmap/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          patient_id: patientId,
          case_id: caseId,
          treatment_approaches: nextApproaches,
        }),
      });

      if (!res.ok) throw new Error("ذخیره رویکرد درمانی ناموفق بود.");
    } catch (e: any) {
      toast.error(e.message || "خطا در ذخیره رویکرد درمانی.");
    }
  };

  const handleAddApproach = async () => {
    const value = approachDraft.trim();
    if (!value || readOnly) return;
    const nextApproaches = [...(roadmap.treatment_approaches || []), value];
    setApproachDraft("");
    await saveTreatmentApproaches(nextApproaches);
  };

  const handleRemoveApproach = async (index: number) => {
    if (readOnly) return;
    const nextApproaches = (roadmap.treatment_approaches || []).filter((_, itemIndex) => itemIndex !== index);
    await saveTreatmentApproaches(nextApproaches);
  };


if (selectedSession) {
    return (
        <SessionDetail 
            session={selectedSession}
            allSessionsHistory={allSessionsHistory}
            patientName={patientName}
            patientId={patientId} // [FIX] Pass this prop
            caseId={caseId}
            onBack={() => setSelectedSession(null)} 
            onUpdate={(data) => {
              onEdit({ roadmap_data: data.roadmap, sessions: data.history });
              const nextSelectedSession = (data?.roadmap?.sessions || []).find(
                (item: RoadmapSession) => item.session_number === selectedSession.session_number
              );
              if (nextSelectedSession) {
                setSelectedSession(nextSelectedSession);
              }
            }} 
        />
    );
}
  // 3. List View (Timeline): The default view showing all sessions
  return (
    <div className="space-y-6 pb-10 animate-in fade-in slide-in-from-right-2 duration-300">

      {/* [NEW] Active Goals Section */}
      {activeGoals && activeGoals.length > 0 && (
        <div className="bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-900 rounded-xl p-4 shadow-sm">
            <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-2 mb-3">
                <Target className="w-4 h-4"/>
                اهداف درمانی فعال (SMART Goals)
            </h3>
            <div className="grid gap-2">
                {activeGoals.map((goal, idx) => (
                    <div key={idx} className="flex items-start gap-2 bg-background p-2 rounded-lg border border-emerald-900/50 text-xs">
                        <span className="bg-emerald-900 text-emerald-200 w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold shrink-0 mt-0.5">
                            {idx + 1}
                        </span>
                        <span className="text-foreground/90 leading-relaxed">{goal}</span>
                    </div>
                ))}
            </div>
        </div>
      )}
      
      <div className="bg-card border rounded-xl p-4 shadow-sm flex flex-col gap-3">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Map className="w-4 h-4 text-primary"/>
              نقشه راه درمان
          </h3>
          {!readOnly ? <AddSessionDialog 
            patientId={patientId} 
            caseId={caseId}
            onSuccess={handleSessionAdded} // [FIX] Connect handler
            trigger={
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1.5 text-primary hover:bg-primary/10">
                    <Plus className="w-3.5 h-3.5" /> افزودن جلسه
                </Button>
            }
          /> : null}
        </div>
        <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
          {(roadmap.treatment_approaches?.length || 0) > 0 ? (
             roadmap.treatment_approaches.map((app, i) => (
                <Badge key={i} variant="secondary" className="flex items-center gap-1.5 font-normal">
                  {app}
                  {!readOnly ? (
                    <button type="button" onClick={() => handleRemoveApproach(i)} className="text-muted-foreground transition hover:text-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  ) : null}
                </Badge>
             ))
          ) : (
             <span className="text-xs text-muted-foreground italic">هنوز رویکرد درمانی ثبت نشده است.</span>
          )}
        </div>
        {!readOnly ? (
          <div className="flex flex-col gap-2 border-t border-border/50 pt-3 sm:flex-row sm:items-center">
            <Input
              value={approachDraft}
              onChange={(e) => setApproachDraft(e.target.value)}
              placeholder="مثلا: CBT یا ACT"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleAddApproach();
                }
              }}
            />
            <Button size="sm" className="gap-2 sm:w-auto" onClick={() => void handleAddApproach()} disabled={!approachDraft.trim()}>
              <Plus className="h-3.5 w-3.5" />
              افزودن رویکرد
            </Button>
          </div>
        ) : null}
      </div>

      {/* --- Session Timeline --- */}
      {(roadmap.sessions || []).length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
          هنوز جلسه‌ای به سند پشتیبان اضافه نشده است.
        </div>
      ) : (
      <div className="relative mr-1.5 space-y-6 border-r-2 border-border/60 pl-1 sm:mr-3.5 sm:space-y-8">
        {(roadmap.sessions || []).map((session, index) => (
          <div key={index} className="group relative pr-5 sm:pr-8">
            
            {/* Timeline Dot and Line */}
            <div className={cn(
                "absolute -right-[8px] top-5 z-10 h-3.5 w-3.5 rounded-full border-4 border-background shadow-sm transition-colors sm:-right-[9px] sm:h-4 sm:w-4",
                session.status === "COMPLETED" ? "bg-emerald-500" :
                session.status === "READY" ? "bg-blue-500 ring-2 ring-blue-100" :
                "bg-muted-foreground/30"
            )} />

            <Card className={cn(
                "border transition-all duration-300 shadow-sm",
                session.status === "READY" ? "border-blue-600/20 bg-blue-500/10" : "border-border/50",
                roadmap.active_session_number === session.session_number ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
            )}>
              <CardContent className="p-4">
                {/* Session Header */}
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="flex items-center gap-2 truncate font-bold text-sm text-foreground">
                      جلسه {session.session_number}: {session.title}
                    </h4>
                    {session.scheduled_date && (
                      <div className="text-[10px] text-muted-foreground mt-1">
                        تاریخ برنامه‌ریزی: {new Date(session.scheduled_date).toLocaleDateString("fa-IR")}
                      </div>
                    )}
                    <span className={cn(
                        "text-[10px] font-medium px-2 py-0.5 rounded mt-1.5 inline-block",
                        session.status === "DRAFT" && "bg-muted text-muted-foreground",
                        session.status === "READY" && "bg-blue-900 text-blue-100",
                        session.status === "COMPLETED" && "bg-emerald-900 text-emerald-200",
                    )}>
                      {session.status === "DRAFT" ? "برنامه‌ریزی شده" : 
                       session.status === "READY" ? "آماده اجرا" : "انجام شده"}
                    </span>
                  </div>
                  
                  <div className="flex shrink-0 items-center gap-1">
                    {!readOnly ? <div className="flex items-center gap-1 opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveSession(index, "up");
                        }}
                        disabled={index === 0}
                        aria-label="انتقال جلسه به بالا"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveSession(index, "down");
                        }}
                        disabled={index === roadmap.sessions.length - 1}
                        aria-label="انتقال جلسه به پایین"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDeleteSession(session);
                        }}
                        aria-label="حذف جلسه"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div> : null}

                    {/* View/Details Button */}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => setSelectedSession(session)}>
                      <Eye className="w-3.5 h-3.5" />
                    </Button>

                    {/* Start Session Button (only for non-completed sessions) */}
                    {!readOnly && session.status !== 'COMPLETED' && (
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
                  <div className="relative mt-2 border-r-2 border-amber-300 bg-amber-50/50 p-2 pl-8 text-xs dark:bg-amber-900/10">
                      <Lock className="w-3 h-3 absolute top-2 left-2 text-amber-400" />
                      <p className="line-clamp-2 opacity-70 leading-relaxed text-amber-900 dark:text-amber-100">
                        <span className="font-semibold text-amber-700">راهنما:</span> {session.doctor_instructions}
                      </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
