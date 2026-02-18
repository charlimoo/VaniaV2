// frontend/components/canvas/renderers/tabs/roadmap/SessionDetail.tsx
"use client";

import { ArrowRight, Brain, Target, Zap, Lock, Pencil, FileText, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RoadmapSession } from "@/lib/types/vania";
import { DownloadButton } from "./DownloadButton";
import { ManualReportDialog } from "./ManualReportDialog";
import { cn } from "@/lib/utils";

interface Props {
  session: RoadmapSession;
  allSessionsHistory: any[]; 
  patientName: string;
  patientId: number;
  onBack: () => void;
  onUpdate: (data: any) => void;
}

export function SessionDetail({ session, allSessionsHistory, patientName, patientId, onBack, onUpdate }: Props) {
  
  // 1. Find the raw log entry
  const reportLog = session.status === 'COMPLETED' && session.doc_id
    ? allSessionsHistory.find(log => String(log.id) === String(session.doc_id))
    : null;

  // 2. Parse Data
  let structuredReport: any = null;
  let summaryText = "";
  let privateNotes = "";
  let flashcards: any[] = [];

  if (reportLog) {
      privateNotes = reportLog.private_notes || "";
      try {
          if (reportLog.summary && typeof reportLog.summary === 'string' && reportLog.summary.trim().startsWith('{')) {
              structuredReport = JSON.parse(reportLog.summary);
              summaryText = structuredReport.symptoms_analysis || structuredReport.summary || "";
              
              if (!privateNotes && structuredReport.private_notes) {
                  privateNotes = structuredReport.private_notes;
              }
              flashcards = structuredReport.flashcards || [];
          } else {
              summaryText = reportLog.summary || "";
              structuredReport = { is_simple: true };
          }
      } catch (e) {
          summaryText = reportLog.summary || "";
      }
  }

  // 3. Normalize for Edit Modal
  const initialFormState = {
    summary: summaryText,
    private_notes: privateNotes,
    flashcards: flashcards.map((fc: any) => ({
        title: fc.title || fc.front || "",
        content: fc.content || fc.back || ""
    }))
  };

  return (
    <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-4 duration-300 font-sans" dir="rtl">
      
      {/* --- HEADER --- */}
      <div className="flex items-center justify-between mb-4 border-b border-border/40 pb-3 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 -mr-2 hover:bg-muted/50">
            <ArrowRight className="w-4 h-4" />
          </Button>
          <div>
            <h3 className="font-bold text-sm text-foreground">جلسه {session.session_number}</h3>
            <span className="text-[10px] text-muted-foreground">{session.title}</span>
          </div>
        </div>
        
        <div className="flex gap-2">
            <ManualReportDialog 
                patientId={patientId}
                sessionNumber={session.session_number}
                sessionTitle={session.title}
                initialData={initialFormState}
                onSuccess={onUpdate}
                trigger={
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-2 bg-transparent border-border/50">
                        <Pencil className="w-3.5 h-3.5" />
                        {session.status === 'COMPLETED' ? "ویرایش" : "ثبت گزارش"}
                    </Button>
                }
            />

            {structuredReport && (
                <DownloadButton data={{...structuredReport, symptoms_analysis: summaryText, flashcards}} patientName={patientName} />
            )}
        </div>
      </div>

      <ScrollArea className="flex-1 pl-3 -ml-3">
        {session.status === 'COMPLETED' ? (
          <CompletedSessionView 
            report={structuredReport} 
            summary={summaryText}
            privateNotes={privateNotes}
            flashcards={initialFormState.flashcards}
          />
        ) : (
          <PlannedSessionView session={session} />
        )}
      </ScrollArea>
    </div>
  );
}

function CompletedSessionView({ report, summary, privateNotes, flashcards }: { report: any, summary: string, privateNotes: string, flashcards: any[] }) {
  return (
    <div className="space-y-8 pb-8">
        
        {/* 1. PRIVATE NOTES (Dark Mode Optimized) */}
        {privateNotes && (
            <div className="bg-red-950/10 border border-red-900/30 rounded-lg p-3 relative overflow-hidden">
                <div className="flex items-center gap-2 mb-2 border-b border-red-900/20 pb-2">
                    <ShieldAlert className="w-4 h-4 text-red-500/80" />
                    <span className="text-xs font-bold text-red-500/90">یادداشت محرمانه متخصص</span>
                    <span className="text-[9px] bg-red-950/30 px-2 py-0.5 rounded-full text-red-400/70 border border-red-900/20 mr-auto">غیرقابل نمایش برای بیمار</span>
                </div>
                <p className="text-xs text-red-200/80 leading-relaxed whitespace-pre-wrap">
                    {privateNotes}
                </p>
            </div>
        )}

        {/* 2. SUMMARY */}
        <div className="space-y-3">
            <h4 className="text-xs font-bold text-foreground/90 flex items-center gap-2 opacity-90">
                <FileText className="w-4 h-4 text-primary" /> خلاصه و تحلیل جلسه
            </h4>
            {report?.approaches_used && (
                <div className="flex flex-wrap gap-2">
                    {report.approaches_used.map((tag:string, i:number) => (
                        <Badge key={i} variant="secondary" className="text-[10px] bg-muted/50 text-muted-foreground border-border/30 hover:bg-muted font-normal">{tag}</Badge>
                    ))}
                </div>
            )}
            {summary ? (
                <p className="text-sm leading-8 text-foreground/80 bg-muted/10 p-4 rounded-xl border border-border/40 text-justify whitespace-pre-wrap shadow-sm">
                    {summary}
                </p>
            ) : (
                <p className="text-xs text-muted-foreground italic opacity-60">خلاصه‌ای ثبت نشده است.</p>
            )}
        </div>

        {/* 3. SWOT Grid (Clean Dark Look) */}
        {report?.swot_analysis && (
            <div>
                <h4 className="text-xs font-bold text-foreground/90 mb-3 flex items-center gap-2 opacity-90">
                    <Brain className="w-4 h-4 text-purple-500" /> تحلیل SWOT
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <SwotCard title="نقاط قوت" items={report.swot_analysis?.Strengths} accentColor="text-emerald-500" />
                    <SwotCard title="نقاط ضعف" items={report.swot_analysis?.Weaknesses} accentColor="text-red-500" />
                    <SwotCard title="فرصت‌ها" items={report.swot_analysis?.Opportunities} accentColor="text-blue-500" />
                    <SwotCard title="تهدیدها" items={report.swot_analysis?.Threats} accentColor="text-orange-500" />
                </div>
            </div>
        )}

        {/* 4. SMART Goals */}
        {report?.smart_goals?.length > 0 && (
            <div>
                <h4 className="text-xs font-bold text-foreground/90 mb-3 flex items-center gap-2 opacity-90">
                    <Target className="w-4 h-4 text-emerald-500" /> اهداف هوشمند (SMART)
                </h4>
                <div className="space-y-2">
                    {report.smart_goals.map((goal: string, i: number) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-emerald-950/10 border border-emerald-900/20 text-xs text-emerald-100/90">
                            <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                                {i + 1}
                            </span>
                            <span className="leading-relaxed">{goal}</span>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* 5. FLASHCARDS (Card Style) */}
        <div>
            <h4 className="text-xs font-bold text-foreground/90 mb-3 flex items-center gap-2 opacity-90">
                <Zap className="w-4 h-4 text-amber-500" /> فلش کارت‌ها (یادآوری تکنیک)
            </h4>
            
            {flashcards.length === 0 ? (
                <p className="text-xs text-muted-foreground opacity-60">فلش کارتی ثبت نشده است.</p>
            ) : (
                <div className="grid grid-cols-1 gap-3">
                    {flashcards.map((card: any, i: number) => (
                        <div key={i} className="p-4 rounded-xl bg-card border border-border/50 shadow-sm hover:border-amber-500/30 transition-colors group">
                            <div className="font-bold text-sm text-foreground/90 mb-2 border-b border-border/30 pb-2 group-hover:text-amber-500 transition-colors">
                                {card.title}
                            </div>
                            <div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                {card.content}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    </div>
  );
}

function PlannedSessionView({ session }: { session: RoadmapSession }) {
  return (
    <div className="space-y-6">
        <div className="p-4 bg-amber-950/10 border border-amber-900/20 rounded-lg space-y-2">
            <h4 className="text-sm font-bold text-amber-500 flex items-center gap-2">
                <Lock className="w-4 h-4" />
                دستورالعمل‌های راهنما (محرمانه)
            </h4>
            <p className="text-xs text-amber-200/80 leading-relaxed whitespace-pre-wrap">
                {session.doctor_instructions || "دستورالعملی موجود نیست."}
            </p>
        </div>

        <div className="text-center p-8 border border-dashed border-border/40 rounded-xl text-muted-foreground/60">
            <p className="text-xs mb-2">این جلسه هنوز نهایی نشده است.</p>
            <p className="text-[10px] opacity-70">
                می‌توانید با استفاده از دکمه «ثبت گزارش» در بالا، خلاصه جلسه و فلش‌کارت‌ها را دستی وارد کنید.
            </p>
        </div>
    </div>
  );
}

// Cleaner SWOT Card
function SwotCard({ title, items, accentColor }: { title: string, items: string[], accentColor: string }) {
    if (!items?.length) return null;
    return (
        <div className="p-3 rounded-lg border border-border/40 bg-card/50">
            <h5 className={cn("text-[10px] font-bold uppercase tracking-wider mb-2.5", accentColor)}>{title}</h5>
            <ul className="space-y-1.5">
                {items.map((item: string, i: number) => (
                    <li key={i} className="text-[11px] text-muted-foreground leading-snug flex gap-2">
                        <span className={cn("mt-1.5 w-1 h-1 rounded-full shrink-0", accentColor.replace('text-', 'bg-'))} />
                        {item}
                    </li>
                ))}
            </ul>
        </div>
    )
}