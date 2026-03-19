"use client";

import { Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  greeting: string;
  activeGoals: string[];
  clinicalSummary?: string;
  formsTestsAnalysis: string;
  forms?: any[];
  tests?: any[];
  showClinicalSummary?: boolean;
  showFormsTestsAnalysis?: boolean;
  showForms?: boolean;
  showTests?: boolean;
}

export function PatientHomeTab({
  greeting,
  activeGoals,
  clinicalSummary = "",
  formsTestsAnalysis,
  forms = [],
  tests = [],
  showClinicalSummary = false,
  showFormsTestsAnalysis = true,
  showForms = true,
  showTests = true,
}: Props) {
  const visibleForms = (forms || []).filter((form) => {
    const formKey = form?.form_key || form?.data?.form_key;
    return formKey !== "BASE_PROFILE_V1";
  });
  const visibleTests = showTests ? tests || [] : [];

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

      {showClinicalSummary && clinicalSummary?.trim() && (
        <section>
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-sm font-bold text-foreground">علت مراجع و مشاهدات</h3>
          </div>
          <Card className="border-muted-100 shadow-sm">
            <CardContent className="p-4 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
              {clinicalSummary}
            </CardContent>
          </Card>
        </section>
      )}

      {showFormsTestsAnalysis && formsTestsAnalysis?.trim() && (
        <section>
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-sm font-bold text-foreground">تحلیل بالینی تست ها و فرم ها</h3>
          </div>
          <Card className="border-muted-100 shadow-sm">
            <CardContent className="p-4 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
              {formsTestsAnalysis}
            </CardContent>
          </Card>
        </section>
      )}

      {(showForms || showTests) ? (
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-sm font-bold text-foreground">
            {showForms && showTests ? "فرم‌ها و تست‌ها" : showForms ? "فرم‌ها" : "آزمایش‌ها"}
          </h3>
          <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
            {((showForms ? visibleForms?.length : 0) || 0) + (visibleTests?.length || 0)} مورد
          </Badge>
        </div>
        <div className="grid gap-3">
          {showForms ? visibleForms.map((form, index) => (
            <Card key={`form-${form.id || index}`} className="border-muted-100 shadow-sm">
              <CardContent className="p-4">
                <div className="text-xs font-bold">{form.data?.form_title || form.type || form.form_key}</div>
                <div className="mt-2 text-[11px] text-muted-foreground whitespace-pre-wrap">
                  {Object.entries(form.data || {})
                    .filter(([key]) => !["form_key", "form_title", "handler", "submitted_by_doctor_id", "submission_timestamp", "case_id", "visibility_scope"].includes(key))
                    .slice(0, 4)
                    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join("، ") : String(value)}`)
                    .join("\n")}
                </div>
              </CardContent>
            </Card>
          )) : null}
          {visibleTests.map((test) => (
            <Card key={`test-${test.id}`} className="border-muted-100 shadow-sm">
              <CardContent className="p-4">
                <div className="text-xs font-bold">{test.title}</div>
                <div className="mt-2 text-[11px] text-muted-foreground whitespace-pre-wrap">
                  {test.result_text || test.result_summary || "متن نتیجه هنوز ثبت نشده است."}
                </div>
              </CardContent>
            </Card>
          ))}
          {((showForms ? visibleForms?.length : 0) || 0) === 0 && (visibleTests?.length || 0) === 0 && (
            <div className="flex flex-col items-center justify-center py-10 bg-muted/10 rounded-2xl border border-dashed border-muted-foreground/20 text-center">
              <p className="text-xs text-muted-foreground">
                {showForms && showTests ? "هنوز فرم یا تستی برای این بخش ثبت نشده است." : showForms ? "هنوز فرمی برای این بخش ثبت نشده است." : "هنوز آزمایشی برای این بخش ثبت نشده است."}
              </p>
            </div>
          )}
        </div>
      </section>
      ) : null}

    </div>
  );
}
