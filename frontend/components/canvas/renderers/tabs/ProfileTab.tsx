"use client";

import { useState, useEffect } from "react";
import { FileText, Save, Loader2, CheckCircle, BrainCircuit } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PatientManagerState } from "@/lib/types/vania";
import { useAssistantRuntime } from "@assistant-ui/react";

interface PatientProfile {
  id: number;
  name: string;
  phone: string;
}

interface ProfileTabProps {
  patientProfile: PatientProfile;
  clinicalSummary: string;
  formsTestsAnalysis: string;
  forms: any[];
  tests: any[];
  onEdit: (delta: Partial<PatientManagerState>) => void;
  isLocked: boolean;
}

export function ProfileTab({
  patientProfile,
  clinicalSummary,
  formsTestsAnalysis,
  forms,
  tests,
  onEdit,
  isLocked,
}: ProfileTabProps) {
  const runtime = useAssistantRuntime();

  const [summary, setSummary] = useState(clinicalSummary || "");
  const [analysis, setAnalysis] = useState(formsTestsAnalysis || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    setSummary(clinicalSummary || "");
  }, [clinicalSummary]);

  useEffect(() => {
    setAnalysis(formsTestsAnalysis || "");
  }, [formsTestsAnalysis]);

  const isSummaryDirty = summary !== (clinicalSummary || "");
  const isAnalysisDirty = analysis !== (formsTestsAnalysis || "");
  const isDirty = isSummaryDirty || isAnalysisDirty;

  const canGenerateAnalysis = (forms?.length || 0) > 0 && (tests?.length || 0) > 0;

  const handleSave = () => {
    if (!isDirty || isLocked) return;

    setIsSaving(true);
    const updatePayload: Partial<PatientManagerState> = {};

    if (isSummaryDirty) {
      updatePayload.clinical_summary = summary;
    }
    if (isAnalysisDirty) {
      updatePayload.forms_tests_analysis = analysis;
    }

    toast.promise(
      new Promise<void>((resolve) => {
        onEdit(updatePayload);
        setTimeout(() => resolve(), 700);
      }),
      {
        loading: "در حال ذخیره تغییرات...",
        success: "پرونده بیمار با موفقیت به روزرسانی شد.",
        error: "خطا در ذخیره سازی.",
        finally: () => setIsSaving(false),
      }
    );
  };

  const handleGenerateAnalysisByAgent = async () => {
    if (!canGenerateAnalysis || isLocked || isGenerating) return;

    setIsGenerating(true);
    try {
      const baseProfileCandidates = (forms || []).filter((f) => {
        const fk = f?.form_key || f?.data?.form_key;
        return fk === "BASE_PROFILE_V1";
      });
      const latestBaseProfile = [...baseProfileCandidates].sort((a, b) => {
        const ad = new Date(a?.date || 0).getTime();
        const bd = new Date(b?.date || 0).getTime();
        return bd - ad;
      })[0];
      const baseProfileData = latestBaseProfile?.data || {};

      const formsPayload = (forms || []).map((f) => ({
        form_key: f.form_key || f?.data?.form_key || null,
        form_title: f.data?.form_title || f.type,
        date: f.date || null,
        data: f.data || {},
      }));

      const testsPayload = (tests || []).map((t) => ({
        id: t.id,
        catalog_id: t.catalog_id ?? null,
        title: t.title || "",
        url: t.url || "",
        result_summary: t.result_summary || "",
      }));

      const patientInfo = {
        patient_profile: {
          id: patientProfile?.id ?? null,
          name: patientProfile?.name || "",
          phone: patientProfile?.phone || "",
        },
        base_profile_form: baseProfileData,
      };

      const prompt = [
        "[SYSTEM: GENERATE_FORMS_TESTS_ANALYSIS]",
        `Patient: ${patientProfile.name} (${patientProfile.id})`,
        "از تمام اطلاعات بیمار، فرم های تکمیل شده، و خلاصه نتایج تست ها استفاده کن.",
        "فایل PDF را مستقیما تحلیل نکن و فقط بر اساس متن/خلاصه های موجود تحلیل تولید کن.",
        "لطفا با توجه به فرم های تکمیل شده و خلاصه نتایج تست ها، یک تحلیل بالینی یکپارچه تولید کن.",
        "خروجی باید فارسی و حرفه ای باشد و شامل: الگوهای اصلی، فرضیه های بالینی محتاطانه، ریسک ها/حمایت ها، و پیشنهاد مسیر درمانی کوتاه باشد.",
        "پس از تولید تحلیل، حتما با ابزار update_forms_tests_analysis آن را ذخیره کن.",
        "",
        `Patient Info JSON:\n${JSON.stringify(patientInfo, null, 2)}`,
        "",
        `Clinical Summary:\n${summary || ""}`,
        "",
        `Forms JSON:\n${JSON.stringify(formsPayload, null, 2)}`,
        "",
        `Tests JSON (summaries only):\n${JSON.stringify(testsPayload, null, 2)}`,
      ].join("\n");

      await runtime.thread.append({
        role: "user",
        content: [{ type: "text", text: prompt }],
      });

      toast.success("درخواست تحلیل به دستیار ارسال شد.");
    } catch {
      toast.error("ارسال درخواست تحلیل به دستیار ناموفق بود.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-right-2 duration-300 sm:pb-10">
      <section>
        <div className="grid gap-2">
          <Label htmlFor="clinical-summary" className="text-xs font-bold text-muted-foreground flex items-center gap-2">
            <FileText className="w-4 h-4" /> خلاصه بالینی و مشاهدات
          </Label>

          <Textarea
            id="clinical-summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="شرح حال، شکایت اصلی، مشاهدات و فرمول بندی مشکل را در اینجا وارد کنید..."
            className="min-h-[220px] text-sm leading-relaxed"
            disabled={isLocked || isSaving}
          />
        </div>
      </section>

      <section>
        <div className="grid gap-2">
          <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
            <Label htmlFor="forms-tests-analysis" className="text-xs font-bold text-muted-foreground flex items-center gap-2">
              <BrainCircuit className="w-4 h-4" /> تحلیل بالینی تست ها و فرم ها
            </Label>
            <Button
              type="button"
              variant="outline"
              className="h-8 w-full text-xs gap-1.5 sm:w-auto"
              onClick={handleGenerateAnalysisByAgent}
              disabled={!canGenerateAnalysis || isLocked || isGenerating}
            >
              {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BrainCircuit className="w-3.5 h-3.5" />}
              تولید تحلیل با هوش مصنوعی
            </Button>
          </div>

          <Textarea
            id="forms-tests-analysis"
            value={analysis}
            onChange={(e) => setAnalysis(e.target.value)}
            placeholder={
              canGenerateAnalysis
                ? "تحلیل بالینی ترکیبی فرم ها و تست ها در اینجا ذخیره می شود..."
                : "برای تولید تحلیل، حداقل یک فرم و یک تست لازم است."
            }
            className="min-h-[200px] text-sm leading-relaxed"
            disabled={isLocked || isSaving}
          />
        </div>
      </section>

      <div className="sticky bottom-0 z-10 -mx-3 flex flex-wrap items-center justify-between gap-2 border-t bg-background/90 px-3 py-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] backdrop-blur-sm sm:-mx-6 sm:gap-3 sm:px-6">
        <div
          className={cn(
            "flex items-center gap-1.5 text-xs transition-opacity duration-300",
            isDirty ? "text-amber-600" : "text-emerald-600",
            isLocked && "opacity-50"
          )}
        >
          {isDirty ? <>تغییرات ذخیره نشده</> : <><CheckCircle className="w-3.5 h-3.5" /> ذخیره شده</>}
        </div>

        <Button className="h-9 w-full text-xs gap-1.5 sm:w-auto" onClick={handleSave} disabled={isSaving || isLocked || !isDirty}>
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          ذخیره تغییرات
        </Button>
      </div>
    </div>
  );
}
