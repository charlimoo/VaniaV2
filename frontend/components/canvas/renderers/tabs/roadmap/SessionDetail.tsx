// frontend/components/canvas/renderers/tabs/roadmap/SessionDetail.tsx
"use client";

import { ArrowRight, FileDown, Target, Brain, Zap, Layers, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RoadmapSession } from "@/lib/types/vania";

// --- Sub-Component Imports ---
import { DownloadButton } from "./DownloadButton"; // A dedicated component for PDF logic

// --- Props Interface ---
interface Props {
  session: RoadmapSession;
  allSessionsHistory: any[]; // The full history of session logs to find the report data
  patientName: string;
  onBack: () => void;
}

/**
 * Renders a detailed view of a single therapy session from the Roadmap.
 * This component conditionally displays either:
 * 1. The AI-generated protocol for upcoming sessions ('DRAFT' or 'READY').
 * 2. The full structured "Session Support Document" for 'COMPLETED' sessions.
 */
export function SessionDetail({ session, allSessionsHistory, patientName, onBack }: Props) {
  
  // Find the detailed report data from the history logs if the session is completed
  const reportData = session.status === 'COMPLETED' && session.doc_id
    ? allSessionsHistory.find(log => String(log.id) === String(session.doc_id))
    : null;

  // Safely parse the report content if it's a JSON string
  const structuredReport = reportData?.data ? (
    typeof reportData.data === 'string' ? JSON.parse(reportData.data) : reportData.data
  ) : null;

  return (
    <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
      
      {/* --- HEADER --- */}
      <div className="flex items-center justify-between mb-4 border-b border-border/50 pb-3">
        <div className="flex items-center gap-2">
          {/* Back Button */}
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 -mr-2">
            <ArrowRight className="w-4 h-4" />
          </Button>
          {/* Title and Metadata */}
          <div>
            <h3 className="font-bold text-sm">جزئیات جلسه {session.session_number}</h3>
            <span className="text-[10px] text-muted-foreground">{session.title}</span>
          </div>
        </div>
        {/* Download PDF button, only shown for completed sessions with a report */}
        {structuredReport && (
          <DownloadButton data={structuredReport} patientName={patientName} />
        )}
      </div>

      <ScrollArea className="flex-1 pr-3 -mr-3">
        {session.status === 'COMPLETED' && structuredReport ? (
          // --- RENDER COMPLETED REPORT VIEW ---
          <CompletedSessionView report={structuredReport} />
        ) : (
          // --- RENDER PLANNED SESSION VIEW ---
          <PlannedSessionView session={session} />
        )}
      </ScrollArea>
    </div>
  );
}

// ==============================================================================
// == SUB-COMPONENTS FOR DIFFERENT SESSION STATES
// ==============================================================================

/** Renders the view for a completed session, displaying the structured report. */
function CompletedSessionView({ report }: { report: any }) {
  return (
    <div className="space-y-6 pb-8">
        {/* 1. Summary & Approaches */}
        <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
                {report.approaches_used?.map((tag:string, i:number) => (
                    <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
                ))}
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground bg-muted/20 p-3 rounded-lg border">
                {report.text || report.summary}
            </p>
        </div>

        {/* 2. SWOT Grid */}
        <div>
            <h4 className="text-xs font-bold text-foreground mb-3 flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-500" /> تحلیل SWOT
            </h4>
            <div className="grid grid-cols-2 gap-3">
                <SwotCard title="نقاط قوت" items={report.swot_analysis?.Strengths} color="text-green-600" bg="bg-green-50/50" />
                <SwotCard title="نقاط ضعف" items={report.swot_analysis?.Weaknesses} color="text-red-600" bg="bg-red-50/50" />
                <SwotCard title="فرصت‌ها" items={report.swot_analysis?.Opportunities} color="text-blue-600" bg="bg-blue-50/50" />
                <SwotCard title="تهدیدها" items={report.swot_analysis?.Threats} color="text-orange-600" bg="bg-orange-50/50" />
            </div>
        </div>

        {/* 3. SMART Goals */}
        <div>
            <h4 className="text-xs font-bold text-foreground mb-3 flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-500" /> اهداف هوشمند (SMART)
            </h4>
            <div className="space-y-2">
                {report.smart_goals?.map((goal: string, i: number) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-md bg-emerald-50/30 border border-emerald-100/50 text-xs text-emerald-900">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        {goal}
                    </div>
                ))}
            </div>
        </div>

        {/* 4. Patient Flashcards */}
        <div>
            <h4 className="text-xs font-bold text-foreground mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" /> فلش کارت‌ها (یادآوری بیمار)
            </h4>
            <div className="grid grid-cols-1 gap-3">
                {report.flashcards?.map((card: any, i: number) => (
                    <div key={i} className="p-3 rounded-xl bg-amber-50 border border-amber-100/80 shadow-sm">
                        <div className="font-bold text-xs text-amber-800 mb-1">{card.title}</div>
                        <div className="text-xs text-amber-700/80 leading-relaxed">{card.content}</div>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
}

/** Renders the view for a planned session, showing the doctor's private instructions. */
function PlannedSessionView({ session }: { session: RoadmapSession }) {
  return (
    <div className="space-y-4">
        <div className="p-4 bg-amber-50/80 dark:bg-amber-900/10 border border-amber-200/50 rounded-lg space-y-2">
            <h4 className="text-sm font-bold text-amber-800 dark:text-amber-200 flex items-center gap-2">
                <Lock className="w-4 h-4" />
                دستورالعمل‌های راهنما (محرمانه)
            </h4>
            <p className="text-xs text-amber-900 dark:text-amber-100 leading-relaxed whitespace-pre-wrap">
                {session.doctor_instructions || "هنوز دستورالعملی برای این جلسه توسط هوش مصنوعی تدوین نشده است. از ایجنت بخواهید فاز ۴ را اجرا کند."}
            </p>
        </div>
    </div>
  );
}

/** Helper component to render a single SWOT card. */
function SwotCard({ title, items, color, bg }: { title: string, items: string[], color: string, bg: string }) {
    if (!items?.length) return null;
    return (
        <div className={`p-3 rounded-lg border border-transparent ${bg}`}>
            <h5 className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${color}`}>{title}</h5>
            <ul className="space-y-1">
                {items.map((item: string, i: number) => (
                    <li key={i} className="text-[10px] text-foreground/80 leading-tight">• {item}</li>
                ))}
            </ul>
        </div>
    )
}