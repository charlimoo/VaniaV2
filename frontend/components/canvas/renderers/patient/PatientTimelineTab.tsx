"use client";

import { Clock, Download, Zap, MapPin, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
// We reuse the existing PDF generation button from the Doctor's roadmap
import { DownloadButton } from "../tabs/roadmap/DownloadButton"; 

// --- Types ---
interface Session {
  session_number: number;
  title: string;
  date: string;
  summary: string;
  // Flashcards are key takeaways for the patient
  flashcards: { title: string; content: string }[];
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
      
      {/* Timeline Container with vertical line */}
      <div className="relative border-r-2 border-border/60 mr-2 space-y-8 pl-4 pt-2">
        {sessions.map((session, idx) => (
          <div key={idx} className="relative group">
            
            {/* Timeline Dot */}
            <div className="absolute -right-[13px] top-5 w-3.5 h-3.5 rounded-full border-2 border-background bg-primary z-10 shadow-sm group-hover:scale-110 transition-transform" />
            
            <Card className="shadow-sm border-border/60 hover:shadow-md transition-shadow">
              <CardContent className="p-5 space-y-4">
                
                {/* 1. Header: Title, Date, Download */}
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-base flex items-center gap-2 text-foreground">
                      جلسه {session.session_number}: {session.title}
                    </h4>
                    <span className="text-xs text-muted-foreground mt-1.5 block font-mono bg-muted/50 w-fit px-2 py-0.5 rounded">
                      {new Date(session.date).toLocaleDateString('fa-IR', { dateStyle: 'long' })}
                    </span>
                  </div>
                  
                  {/* Download PDF Button */}
                  <DownloadButton 
                    data={{
                      session_number: session.session_number,
                      date: session.date,
                      topic: session.title,
                      symptoms_analysis: session.summary, // Mapping summary to analysis field for PDF
                      flashcards: session.flashcards
                    }} 
                    patientName={patientName} 
                  />
                </div>

                {/* 2. Public Summary */}
                <div className="text-sm text-foreground/80 leading-relaxed bg-muted/30 p-3.5 rounded-lg border border-border/50">
                  <FileText className="w-4 h-4 inline-block ml-2 text-muted-foreground/70 align-middle" />
                  {session.summary}
                </div>

                {/* 3. Flashcards (Key Takeaways) */}
                {session.flashcards && session.flashcards.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <h5 className="text-xs font-bold flex items-center gap-1.5 text-amber-600 bg-amber-50 w-fit px-2 py-1 rounded-md border border-amber-100">
                      <Zap className="w-3.5 h-3.5 fill-amber-600" />
                      نکات کلیدی و تکنیک‌ها
                    </h5>
                    
                    <div className="grid gap-3">
                      {session.flashcards.map((fc, i) => (
                        <div key={i} className="bg-gradient-to-br from-amber-50 to-white border border-amber-200/60 rounded-xl p-3.5 shadow-sm relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-1 h-full bg-amber-400" />
                          <div className="font-bold text-xs text-amber-900 mb-1.5">{fc.title}</div>
                          <div className="text-xs text-amber-800/90 leading-relaxed">{fc.content}</div>
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