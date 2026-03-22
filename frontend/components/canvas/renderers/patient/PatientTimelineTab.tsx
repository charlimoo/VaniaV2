// frontend/components/canvas/renderers/patient/PatientTimelineTab.tsx
"use client";

import { Clock, Zap, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DownloadButton } from "../tabs/roadmap/DownloadButton"; 
import { normalizeFlashcards } from "@/lib/flashcards";

interface Session {
  session_number: number;
  title: string;
  date: string;
  summary: string;
  flashcards: any[]; // Changed from typed array to any[] to handle inconsistent keys
  smart_goals?: string[];
  swot_analysis?: {
    Strengths?: string[];
    Weaknesses?: string[];
    Opportunities?: string[];
    Threats?: string[];
  };
  doc_id?: string;
}

interface Props {
  sessions: Session[];
  patientName: string;
}

export function PatientTimelineTab({ sessions, patientName }: Props) {
  
  if (!sessions || sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground border-2 border-dashed rounded-xl p-8 bg-muted/5">
        <Clock className="w-12 h-12 opacity-20 mb-3" />
        <h3 className="font-semibold text-sm">تاریخچه‌ای یافت نشد</h3>
        <p className="text-xs opacity-70 mt-1">هنوز جلسه درمانی تکمیل‌شده‌ای ثبت نشده است.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10 animate-in fade-in slide-in-from-right-2 duration-300 font-sans">
      <div className="relative space-y-8 pt-2">
        {/* Shared timeline rail to keep all markers perfectly aligned */}
        <div className="pointer-events-none absolute right-4 top-0 bottom-0 w-px bg-border/60" />
        {sessions.map((session, idx) => {
          const normalizedFlashcards = normalizeFlashcards(session.flashcards);
          const sessionGoals = Array.isArray(session.smart_goals)
            ? session.smart_goals.map((goal) => String(goal).trim()).filter(Boolean)
            : [];
          const swot = session.swot_analysis;
          const hasSwot =
            !!swot?.Strengths?.length ||
            !!swot?.Weaknesses?.length ||
            !!swot?.Opportunities?.length ||
            !!swot?.Threats?.length;
          return (
            <div key={idx} className="relative group pr-10">
              <div className="absolute right-4 top-6 z-10 h-3.5 w-3.5 translate-x-1/2 rounded-full border-2 border-background bg-primary shadow-sm transition-transform group-hover:scale-110" />
              <Card className="shadow-sm border-border/60 hover:shadow-md transition-shadow">
                <CardContent className="p-5 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-base flex items-center gap-2 text-foreground">
                        جلسه {session.session_number}: {session.title}
                      </h4>
                      <span className="text-xs text-muted-foreground mt-1.5 block font-mono bg-muted/50 w-fit px-2 py-0.5 rounded">
                        {new Date(session.date).toLocaleDateString('fa-IR', { dateStyle: 'long' })}
                      </span>
                    </div>
                    
                    <DownloadButton 
                      data={{
                        session_number: session.session_number,
                        date: session.date,
                        topic: session.title,
                        symptoms_analysis: session.summary, 
                        flashcards: normalizedFlashcards,
                        swot_analysis: swot,
                        smart_goals: sessionGoals,
                      }} 
                      patientName={patientName} 
                    />
                  </div>

                  <div className="text-sm text-right text-foreground/80 leading-relaxed bg-muted/30 p-3.5 rounded-lg border border-border/50 whitespace-pre-wrap break-words" dir="rtl">
                    <FileText className="w-4 h-4 inline-block ml-2 text-muted-foreground/70 align-middle" />
                    {session.summary}
                  </div>

                  {sessionGoals.length > 0 && (
                    <div className="space-y-3 pt-1">
                      <h5 className="text-xs font-bold text-foreground">اهداف جلسه</h5>
                      <div className="space-y-2">
                        {sessionGoals.map((goal, index) => (
                          <div key={`goal-${index}`} className="rounded-lg border border-border/50 bg-muted/20 p-3 text-xs text-right text-muted-foreground" dir="rtl">
                            {goal}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {hasSwot && (
                    <div className="space-y-3 pt-1">
                      <h5 className="text-xs font-bold text-foreground">تحلیل SWOT</h5>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {swot?.Strengths?.length ? (
                          <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                            <div className="mb-2 text-xs font-semibold">نقاط قوت</div>
                            <div className="space-y-1">
                              {swot.Strengths.map((item, index) => (
                                <div key={`s-${index}`} className="text-xs text-right text-muted-foreground" dir="rtl">{item}</div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {swot?.Weaknesses?.length ? (
                          <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                            <div className="mb-2 text-xs font-semibold">نقاط ضعف</div>
                            <div className="space-y-1">
                              {swot.Weaknesses.map((item, index) => (
                                <div key={`w-${index}`} className="text-xs text-right text-muted-foreground" dir="rtl">{item}</div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {swot?.Opportunities?.length ? (
                          <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                            <div className="mb-2 text-xs font-semibold">فرصت‌ها</div>
                            <div className="space-y-1">
                              {swot.Opportunities.map((item, index) => (
                                <div key={`o-${index}`} className="text-xs text-right text-muted-foreground" dir="rtl">{item}</div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {swot?.Threats?.length ? (
                          <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                            <div className="mb-2 text-xs font-semibold">تهدیدها</div>
                            <div className="space-y-1">
                              {swot.Threats.map((item, index) => (
                                <div key={`t-${index}`} className="text-xs text-right text-muted-foreground" dir="rtl">{item}</div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )}

                  {normalizedFlashcards.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <h5 className="text-xs font-bold flex items-center gap-1.5 text-white bg-amber-500 w-fit px-2 py-1 rounded-md border border-amber-800">
                        <Zap className="w-3.5 h-3.5 fill-amber-600" />
                        نکات کلیدی و تکنیک‌ها
                      </h5>
                      
                      <div className="grid gap-3">
                        {normalizedFlashcards.map((fc, i) => (
                          <div key={i} className="bg-muted-50 border border-muted-200/60 rounded-xl p-3.5 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-1 h-full bg-amber-800" />
                            <div className="font-bold text-xs text-white-900 mb-1.5">
                              {fc.title}
                            </div>
                            <div className="text-xs text-white-900/90 leading-relaxed">
                              {fc.content}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}
