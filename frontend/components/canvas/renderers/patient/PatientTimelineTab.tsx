// frontend/components/canvas/renderers/patient/PatientTimelineTab.tsx
"use client";

import { Clock, Zap, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DownloadButton } from "../tabs/roadmap/DownloadButton"; 

interface Session {
  session_number: number;
  title: string;
  date: string;
  summary: string;
  flashcards: any[]; // Changed from typed array to any[] to handle inconsistent keys
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
      
      <div className="relative border-r-2 border-border/60 mr-2 space-y-8 pl-4 pt-2">
        {sessions.map((session, idx) => (
          <div key={idx} className="relative group">
            
            <div className="absolute -right-[13px] top-5 w-3.5 h-3.5 rounded-full border-2 border-background bg-primary z-10 shadow-sm group-hover:scale-110 transition-transform" />
            
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
                      flashcards: session.flashcards
                    }} 
                    patientName={patientName} 
                  />
                </div>

                <div className="text-sm text-foreground/80 leading-relaxed bg-muted/30 p-3.5 rounded-lg border border-border/50 text-justify">
                  <FileText className="w-4 h-4 inline-block ml-2 text-muted-foreground/70 align-middle" />
                  {session.summary}
                </div>

                {session.flashcards && session.flashcards.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <h5 className="text-xs font-bold flex items-center gap-1.5 text-white bg-amber-500 w-fit px-2 py-1 rounded-md border border-amber-800">
                      <Zap className="w-3.5 h-3.5 fill-amber-600" />
                      نکات کلیدی و تکنیک‌ها
                    </h5>
                    
                    <div className="grid gap-3">
                      {session.flashcards.map((fc, i) => (
                        <div key={i} className="bg-muted-50 border border-muted-200/60 rounded-xl p-3.5 shadow-sm relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-1 h-full bg-amber-800" />
                          {/* [FIX] Handle keys */}
                          <div className="font-bold text-xs text-white-900 mb-1.5">
                            {fc.title || fc.front}
                          </div>
                          <div className="text-xs text-white-900/90 leading-relaxed">
                            {fc.content || fc.back}
                          </div>
                        </div>
                      ))}
                    </div>
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