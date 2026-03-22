"use client";

import { useState, useEffect } from "react";
import { FileText, Loader2, BrainCircuit, Expand, Save } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAssistantRuntime } from "@assistant-ui/react";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";

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
  onEdit: (delta: any) => void;
  isLocked: boolean;
  caseId?: string;
  showClinicalSummary?: boolean;
  showFormsTestsAnalysis?: boolean;
}

type ModalType = "summary" | "analysis" | null;

const previewText = (value: string, placeholder: string) => {
  const text = (value || "").trim();
  if (!text) return placeholder;
  return text.length > 180 ? `${text.slice(0, 180)}...` : text;
};

export function ProfileTab({
  patientProfile,
  clinicalSummary,
  formsTestsAnalysis,
  forms,
  tests,
  onEdit,
  isLocked,
  caseId,
  showClinicalSummary = true,
  showFormsTestsAnalysis = true,
}: ProfileTabProps) {
  const runtime = useAssistantRuntime();

  const [summary, setSummary] = useState(clinicalSummary || "");
  const [analysis, setAnalysis] = useState(formsTestsAnalysis || "");
  const [activeModal, setActiveModal] = useState<ModalType>(null);
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
  const canGenerateAnalysis = showFormsTestsAnalysis && (forms?.length || 0) > 0 && (tests?.length || 0) > 0;

  const saveSummary = () => {
    if (!isSummaryDirty || isLocked) return;
    setIsSaving(true);
    toast.promise(
      fetch(`${API_BASE_URL}/api/vania/case-profile/`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          patient_id: patientProfile.id,
          case_id: caseId,
          clinical_summary: summary,
        }),
      }).then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error || "خطا در ذخیره سازی.");
        onEdit({ clinical_summary: body?.clinical_summary ?? summary });
      }),
      {
        loading: "در حال ذخیره متن...",
        success: "متن پرونده ذخیره شد.",
        error: "خطا در ذخیره سازی.",
        finally: () => setIsSaving(false),
      }
    );
  };

  const saveAnalysis = () => {
    if (!isAnalysisDirty || isLocked) return;
    setIsSaving(true);
    toast.promise(
      fetch(`${API_BASE_URL}/api/vania/case-profile/`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          patient_id: patientProfile.id,
          case_id: caseId,
          forms_tests_analysis: analysis,
        }),
      }).then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error || "خطا در ذخیره سازی.");
        onEdit({ forms_tests_analysis: body?.forms_tests_analysis ?? analysis });
      }),
      {
        loading: "در حال ذخیره تحلیل...",
        success: "تحلیل بالینی ذخیره شد.",
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
        "از تمام اطلاعات مراجع، فرم های تکمیل شده، و خلاصه نتایج تست ها استفاده کن.",
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
    <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">خلاصه پرونده</div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Badge variant="outline">{forms?.length || 0} فرم</Badge>
          <Badge variant="outline">{tests?.length || 0} تست</Badge>
          <span>{patientProfile.name}</span>
        </div>
      </div>

      <div className={`grid gap-4 ${showClinicalSummary && showFormsTestsAnalysis ? "xl:grid-cols-2" : ""}`}>
        {showClinicalSummary ? (
        <section className="rounded-2xl border border-border/60 bg-background/70 p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                <FileText className="w-4 h-4" />
                علت مراجع و مشاهدات
              </div>
            </div>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setActiveModal("summary")}>
              <Expand className="w-3.5 h-3.5" />
              مشاهده و ویرایش
            </Button>
          </div>

          <div className="min-h-[132px] rounded-xl border border-border/50 bg-muted/10 p-4 text-sm leading-7 text-foreground/85">
            {previewText(summary, "هنوز متنی برای شرح حال و مشاهدات ثبت نشده است.")}
          </div>
        </section>
        ) : null}

        {showFormsTestsAnalysis ? (
        <section className="rounded-2xl border border-border/60 bg-background/70 p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                <BrainCircuit className="w-4 h-4" />
                تحلیل بالینی تست‌ها و فرم‌ها
              </div>
            </div>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setActiveModal("analysis")}>
              <Expand className="w-3.5 h-3.5" />
              مشاهده و ویرایش
            </Button>
          </div>

          <div className="min-h-[132px] rounded-xl border border-border/50 bg-muted/10 p-4 text-sm leading-7 text-foreground/85">
            {previewText(
              analysis,
              canGenerateAnalysis
                ? "هنوز تحلیلی ثبت نشده است."
                : "برای تولید تحلیل، حداقل یک فرم و یک تست لازم است."
            )}
          </div>
        </section>
        ) : null}
      </div>

      <Dialog open={showClinicalSummary && activeModal === "summary"} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent dir="rtl" className="w-[calc(100vw-2rem)] max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>علت مراجع و مشاهدات</DialogTitle>
            <DialogDescription>شرح حال، مشاهده‌ها، و فرمول‌بندی اولیه مسئله را در این بخش ثبت کنید.</DialogDescription>
          </DialogHeader>

          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="شرح حال، شکایت اصلی، و مشاهدات بالینی..."
            className="min-h-[360px] resize-y text-sm leading-7"
            disabled={isLocked || isSaving}
          />

          <DialogFooter>
            <Button variant="ghost" onClick={() => setActiveModal(null)}>بستن</Button>
            <Button onClick={saveSummary} disabled={!isSummaryDirty || isLocked || isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              ذخیره
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showFormsTestsAnalysis && activeModal === "analysis"} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent dir="rtl" className="w-[calc(100vw-2rem)] max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تحلیل بالینی تست‌ها و فرم‌ها</DialogTitle>
            <DialogDescription>تحلیل یکپارچه فرم‌ها و تست‌ها را در این بخش ویرایش یا با کمک هوش مصنوعی تولید کنید.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-[11px] text-muted-foreground">
              {canGenerateAnalysis ? "امکان تولید تحلیل خودکار فعال است." : "برای تولید تحلیل، حداقل یک فرم و یک تست لازم است."}
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-8 text-xs gap-1.5"
              onClick={handleGenerateAnalysisByAgent}
              disabled={!canGenerateAnalysis || isLocked || isGenerating}
            >
              {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BrainCircuit className="w-3.5 h-3.5" />}
              تولید تحلیل با هوش مصنوعی
            </Button>
          </div>

          <Textarea
            value={analysis}
            onChange={(e) => setAnalysis(e.target.value)}
            placeholder="تحلیل بالینی ترکیبی فرم‌ها و تست‌ها..."
            className="min-h-[360px] resize-y text-sm leading-7"
            disabled={isLocked || isSaving}
          />

          <DialogFooter>
            <Button variant="ghost" onClick={() => setActiveModal(null)}>بستن</Button>
            <Button onClick={saveAnalysis} disabled={!isAnalysisDirty || isLocked || isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              ذخیره
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
