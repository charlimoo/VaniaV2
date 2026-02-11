"use client";

import { Activity, Target, CalendarDays, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Props {
  greeting: string;
  currentPhase: string;
  activeGoals: string[];
  onTabChange: (tab: string) => void;
}

// Mapping backend Enums to user-friendly Persian labels
const PHASE_LABELS: Record<string, string> = {
  "PHASE_1_ANALYSIS": "فاز ۱: تحلیل و ارزیابی جامع",
  "PHASE_2_APPROACHES": "فاز ۲: طراحی مسیر درمان",
  "PHASE_3_SELECTION": "فاز ۳: انتخاب استراتژی",
  "PHASE_4_PROTOCOL": "فاز ۴: برنامه‌ریزی جلسات",
  "PHASE_5_EXECUTION": "فاز ۵: اجرا و تمرین (فعال)",
  "PHASE_6_APPENDIX": "فاز ۶: تثبیت و پیوست اندیشه"
};

export function PatientHomeTab({ greeting, currentPhase, activeGoals, onTabChange }: Props) {
  
  return (
    <div className="space-y-6 pb-10 animate-in fade-in slide-in-from-right-2 duration-300 font-sans">
      
      {/* --- Hero Section --- */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10 p-6 shadow-sm">
        <div className="relative z-10">
          <h2 className="text-2xl font-bold text-foreground mb-2 leading-tight">
            {greeting}
          </h2>
          <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
            به پنل همراه خوش آمدید. من اینجا هستم تا در مسیر رشد و سلامت کنار شما باشم.
          </p>
          
          <div className="mt-5 inline-flex items-center gap-2 bg-background/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-primary/10 shadow-sm">
            <Activity className="w-4 h-4 text-primary animate-pulse" />
            <span className="text-xs font-medium text-foreground">
              {PHASE_LABELS[currentPhase] || "در حال بررسی وضعیت..."}
            </span>
          </div>
        </div>
        
        {/* Abstract Background Decor */}
        <div className="absolute top-0 left-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl -translate-x-12 -translate-y-12 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl translate-x-10 translate-y-10 pointer-events-none" />
      </div>

      {/* --- Active Goals Section --- */}
      <section>
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
            <Target className="w-4 h-4 text-emerald-600" />
            اهداف فعال من
          </h3>
          <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
            {activeGoals?.length || 0} هدف
          </Badge>
        </div>

        {activeGoals && activeGoals.length > 0 ? (
          <div className="grid gap-3">
            {activeGoals.map((goal, idx) => (
              <Card key={idx} className="border-muted-100 bg-gradient-to-r from-muted to-transparent shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="mt-0.5 w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-bold shrink-0 border border-emerald-200">
                    {idx + 1}
                  </div>
                  <p className="text-sm text-foreground/90 leading-relaxed font-medium">
                    {goal}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 bg-muted/10 rounded-2xl border border-dashed border-muted-foreground/20 text-center">
            <Target className="w-8 h-8 text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">هنوز هدف مشخصی برای این مرحله ثبت نشده است.</p>
          </div>
        )}
      </section>

    </div>
  );
}