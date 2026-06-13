"use client";

import { useState, useEffect, useRef } from "react";
import { FileText, Loader2, BrainCircuit, Expand, Save, Mic, Square, Trash2, AudioLines, Play, Pause, WandSparkles } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useAssistantRuntime } from "@assistant-ui/react";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { CaseVoiceNote } from "@/lib/types/vania";

interface PatientProfile {
  id: number;
  name: string;
  phone: string;
}

interface ProfileTabProps {
  patientProfile: PatientProfile;
  clinicalSummary: string;
  summaryVoiceNotes: CaseVoiceNote[];
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
  summaryVoiceNotes,
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
  const [voiceNotes, setVoiceNotes] = useState<CaseVoiceNote[]>(summaryVoiceNotes || []);
  const [analysis, setAnalysis] = useState(formsTestsAnalysis || "");
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingVoiceNote, setIsSavingVoiceNote] = useState(false);
  const [isDeletingVoiceNoteId, setIsDeletingVoiceNoteId] = useState<string | null>(null);
  const [isTranscribingVoiceNoteId, setIsTranscribingVoiceNoteId] = useState<string | null>(null);
  const [activeVoiceNoteId, setActiveVoiceNoteId] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [activeVoicePreviewUrl, setActiveVoicePreviewUrl] = useState<string | null>(null);
  const [isLoadingPreviewId, setIsLoadingPreviewId] = useState<string | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const {
    isRecording,
    recordingTime,
    audioBlob,
    startRecording,
    stopRecording,
    reset: resetAudioRecording,
  } = useAudioRecorder();

  useEffect(() => {
    setSummary(clinicalSummary || "");
  }, [clinicalSummary]);

  useEffect(() => {
    setAnalysis(formsTestsAnalysis || "");
  }, [formsTestsAnalysis]);

  useEffect(() => {
    setVoiceNotes(summaryVoiceNotes || []);
  }, [summaryVoiceNotes]);

  const isSummaryDirty = summary !== (clinicalSummary || "");
  const isAnalysisDirty = analysis !== (formsTestsAnalysis || "");
  const canGenerateAnalysis = showFormsTestsAnalysis && (forms?.length || 0) > 0 && (tests?.length || 0) > 0;
  const activeVoiceNote = voiceNotes.find((item) => item.id === activeVoiceNoteId) || null;

  const formatDuration = (seconds: number) => {
    const safe = Math.max(0, Math.floor(seconds || 0));
    const mins = Math.floor(safe / 60);
    const secs = safe % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const buildVoiceNoteUrl = (voiceNoteId: string) =>
    `${API_BASE_URL}/api/vania/case-profile/voice-notes/${voiceNoteId}/download/?patient_id=${patientProfile.id}&case_id=${encodeURIComponent(caseId || "")}`;

  const syncVoiceNotesFromPayload = (body: any) => {
    const notes = Array.isArray(body?.summary_voice_notes) ? body.summary_voice_notes : [];
    setVoiceNotes(notes);
    onEdit({ summary_voice_notes: notes });
  };

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
        onEdit({
          clinical_summary: body?.clinical_summary ?? summary,
          summary_voice_notes: Array.isArray(body?.summary_voice_notes) ? body.summary_voice_notes : voiceNotes,
        });
        if (Array.isArray(body?.summary_voice_notes)) {
          setVoiceNotes(body.summary_voice_notes);
        }
      }),
      {
        loading: "در حال ذخیره متن...",
        success: "متن پرونده ذخیره شد.",
        error: "خطا در ذخیره سازی.",
        finally: () => setIsSaving(false),
      }
    );
  };

  const saveRecordedVoiceNote = async (blob: Blob, durationSeconds: number) => {
    if (!blob || isLocked || !caseId || isSavingVoiceNote) return;
    setIsSavingVoiceNote(true);
    try {
      const formData = new FormData();
      formData.append("patient_id", String(patientProfile.id));
      formData.append("case_id", caseId);
      formData.append("duration_seconds", String(durationSeconds || 0));
      formData.append("file", blob, `summary-voice-note-${Date.now()}.webm`);

      const res = await fetch(`${API_BASE_URL}/api/vania/case-profile/`, {
        method: "POST",
        headers: { ...getAuthHeaders() },
        body: formData,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "خطا در ذخیره یادداشت صوتی.");

      syncVoiceNotesFromPayload(body);
      resetAudioRecording();
      toast.success("یادداشت صوتی ذخیره شد.");
    } catch (error: any) {
      toast.error(error?.message || "خطا در ذخیره یادداشت صوتی.");
    } finally {
      setIsSavingVoiceNote(false);
    }
  };

  useEffect(() => {
    if (!audioBlob || isRecording || isLocked) return;
    void saveRecordedVoiceNote(audioBlob, recordingTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioBlob, isRecording, isLocked]);

  const deleteVoiceNote = async (voiceNoteId: string) => {
    if (isLocked || !caseId || isDeletingVoiceNoteId) return;
    setIsDeletingVoiceNoteId(voiceNoteId);
    try {
      const query = new URLSearchParams({
        patient_id: String(patientProfile.id),
        case_id: String(caseId),
        voice_note_id: voiceNoteId,
      });
      const res = await fetch(`${API_BASE_URL}/api/vania/case-profile/?${query.toString()}`, {
        method: "DELETE",
        headers: { ...getAuthHeaders() },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "حذف یادداشت صوتی ناموفق بود.");

      syncVoiceNotesFromPayload(body);
      if (activeVoiceNoteId === voiceNoteId) {
        setActiveVoiceNoteId(null);
        setIsPreviewPlaying(false);
      }
      toast.success("یادداشت صوتی حذف شد.");
    } catch (error: any) {
      toast.error(error?.message || "حذف یادداشت صوتی ناموفق بود.");
    } finally {
      setIsDeletingVoiceNoteId(null);
    }
  };

  const transcribeVoiceNote = async (voiceNote: CaseVoiceNote) => {
    if (isLocked || isTranscribingVoiceNoteId) return;
    setIsTranscribingVoiceNoteId(voiceNote.id);
    try {
      const noteBlob = await fetchVoiceNoteBlob(voiceNote);

      const formData = new FormData();
      formData.append("file", noteBlob, voiceNote.file_name || "recording.webm");

      const transcribeResponse = await fetch(`${API_BASE_URL}/agent/transcribe`, {
        method: "POST",
        headers: { ...getAuthHeaders() },
        body: formData,
      });
      const transcribeBody = await transcribeResponse.json().catch(() => ({}));
      if (!transcribeResponse.ok) throw new Error(transcribeBody?.detail || "تبدیل گفتار به متن ناموفق بود.");

      const text = String(transcribeBody?.text || "").trim();
      if (!text) {
        toast.error("متنی از فایل صوتی استخراج نشد.");
        return;
      }
      setSummary((prev) => (prev?.trim() ? `${prev.trim()}\n${text}` : text));
      toast.success("متن به بخش شرح حال اضافه شد.");
    } catch (error: any) {
      toast.error(error?.message || "تبدیل گفتار به متن ناموفق بود.");
    } finally {
      setIsTranscribingVoiceNoteId(null);
    }
  };

  const fetchVoiceNoteBlob = async (voiceNote: CaseVoiceNote) => {
    const noteResponse = await fetch(buildVoiceNoteUrl(voiceNote.id), {
      headers: { ...getAuthHeaders() },
    });
    if (!noteResponse.ok) {
      const body = await noteResponse.json().catch(() => ({}));
      throw new Error(body?.error || "دریافت فایل صوتی ناموفق بود.");
    }
    return await noteResponse.blob();
  };

  const toggleVoicePreview = async (voiceNote: CaseVoiceNote) => {
    const audioEl = audioPreviewRef.current;
    if (!audioEl) return;

    if (activeVoiceNoteId === voiceNote.id) {
      if (isPreviewPlaying) {
        audioEl.pause();
      } else {
        try {
          await audioEl.play();
        } catch {
          toast.error("پخش فایل صوتی ناموفق بود.");
        }
      }
      return;
    }

    setIsLoadingPreviewId(voiceNote.id);
    try {
      const blob = await fetchVoiceNoteBlob(voiceNote);
      const nextUrl = URL.createObjectURL(blob);
      setActiveVoicePreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return nextUrl;
      });
    } catch (error: any) {
      toast.error(error?.message || "پخش فایل صوتی ناموفق بود.");
      setIsLoadingPreviewId(null);
      return;
    }
    setIsLoadingPreviewId(null);
    setActiveVoiceNoteId(voiceNote.id);
    setIsPreviewPlaying(false);
  };

  useEffect(() => {
    if (!activeVoiceNoteId || !audioPreviewRef.current || !activeVoicePreviewUrl) return;
    const audioEl = audioPreviewRef.current;
    audioEl.load();
    void audioEl.play().then(() => setIsPreviewPlaying(true)).catch(() => setIsPreviewPlaying(false));
  }, [activeVoiceNoteId, activeVoicePreviewUrl]);

  useEffect(() => {
    return () => {
      if (activeVoicePreviewUrl) URL.revokeObjectURL(activeVoicePreviewUrl);
    };
  }, [activeVoicePreviewUrl]);

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
        onEdit({
          forms_tests_analysis: body?.forms_tests_analysis ?? analysis,
          summary_voice_notes: Array.isArray(body?.summary_voice_notes) ? body.summary_voice_notes : voiceNotes,
        });
        if (Array.isArray(body?.summary_voice_notes)) {
          setVoiceNotes(body.summary_voice_notes);
        }
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

      const testsPayload = (tests || []).map((t) => {
        const attachments = Array.isArray(t.attachments)
          ? t.attachments
          : t.file_name
            ? [{
                id: "legacy-file",
                file_name: t.file_name,
                content_type: t.file_name.toLowerCase().endsWith(".pdf") ? "application/pdf" : null,
                file_uploaded_at: t.file_uploaded_at || null,
              }]
            : [];

        return {
          id: t.id,
          catalog_id: t.catalog_id ?? null,
          title: t.title || "",
          url: t.url || "",
          result_text: t.result_text || t.result_summary || "",
          attachment_count: attachments.length,
          attachments: attachments.map((attachment: any) => ({
            id: attachment.id || null,
            file_name: attachment.file_name || "",
            content_type: attachment.content_type || null,
            file_uploaded_at: attachment.file_uploaded_at || null,
          })),
        };
      });

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
        `Case ID: ${caseId || ""}`,
        "از تمام اطلاعات مراجع، فرم های تکمیل شده، خلاصه نتایج تست ها، و فایل های پیوست تست ها استفاده کن.",
        "برای هر تستی که attachment_count بزرگتر از صفر دارد، قبل از تولید تحلیل با ابزار get_test_result_details(test_id=...) محتوای فایل های آن تست را بررسی کن.",
        "اگر لازم شد فقط یک فایل مشخص را بخوانی، از get_test_attachment_details(test_id=..., attachment_id=...) استفاده کن. شناسه های test_id و attachment_id دقیقا در Tests JSON آمده اند.",
        "فقط بر اساس داده های موجود، متن های ثبت شده، و فایل هایی که ابزارها واقعا در اختیار تو قرار می دهند تحلیل بنویس؛ اگر فایلی قابل خواندن نبود، بر اساس آن حدس نزن.",
        "لطفا با توجه به فرم های تکمیل شده، خلاصه نتایج تست ها، و محتوای فایل های خوانده شده، یک تحلیل بالینی یکپارچه تولید کن.",
        "خروجی باید فارسی و حرفه ای باشد و شامل: الگوهای اصلی، فرضیه های بالینی محتاطانه، ریسک ها/حمایت ها، و پیشنهاد مسیر درمانی کوتاه باشد.",
        caseId
          ? `پس از تولید تحلیل، حتما با ابزار update_forms_tests_analysis و مقدار case_id="${caseId}" آن را ذخیره کن.`
          : "پس از تولید تحلیل، حتما با ابزار update_forms_tests_analysis آن را ذخیره کن.",
        "",
        `Patient Info JSON:\n${JSON.stringify(patientInfo, null, 2)}`,
        "",
        `Clinical Summary:\n${summary || ""}`,
        "",
        `Forms JSON:\n${JSON.stringify(formsPayload, null, 2)}`,
        "",
        `Tests JSON (summaries and attachment handles):\n${JSON.stringify(testsPayload, null, 2)}`,
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

          <div className="rounded-xl border border-border/60 bg-muted/10 p-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <AudioLines className="h-3.5 w-3.5" />
                یادداشت‌های صوتی
                <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                  {voiceNotes.length.toLocaleString("fa-IR")}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {isSavingVoiceNote ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}
                {!isRecording ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 rounded-full"
                    onClick={() => void startRecording()}
                    disabled={isLocked || isSavingVoiceNote || !!isTranscribingVoiceNoteId}
                  >
                    <Mic className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    className="h-8 w-8 rounded-full animate-pulse"
                    onClick={stopRecording}
                    disabled={isLocked}
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                  </Button>
                )}
              </div>
            </div>

            {isRecording ? (
              <div className="text-[11px] text-amber-600">در حال ضبط... {formatDuration(recordingTime)}</div>
            ) : null}

            {activeVoiceNote ? (
              <div className="rounded-lg border border-border/50 bg-background/70 p-2">
                <div className="mb-1 truncate text-[11px] text-muted-foreground">{activeVoiceNote.file_name}</div>
                <audio
                  ref={audioPreviewRef}
                  controls
                  className="w-full h-8"
                  src={activeVoicePreviewUrl || undefined}
                  onPlay={() => setIsPreviewPlaying(true)}
                  onPause={() => setIsPreviewPlaying(false)}
                  onEnded={() => setIsPreviewPlaying(false)}
                />
              </div>
            ) : (
              <audio ref={audioPreviewRef} className="hidden" />
            )}

            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
              {voiceNotes.length === 0 ? (
                <div className="text-[11px] text-muted-foreground py-2">هنوز یادداشت صوتی ثبت نشده است.</div>
              ) : (
                voiceNotes.map((voiceNote, index) => (
                  <div key={voiceNote.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-background/60 px-2 py-1.5">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium">یادداشت {voiceNotes.length - index}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {formatDuration(voiceNote.duration_seconds)} • {new Date(voiceNote.created_at).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => void toggleVoicePreview(voiceNote)}
                          >
                            {isLoadingPreviewId === voiceNote.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : activeVoiceNoteId === voiceNote.id && isPreviewPlaying ? (
                              <Pause className="h-3.5 w-3.5" />
                            ) : (
                              <Play className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{activeVoiceNoteId === voiceNote.id && isPreviewPlaying ? "توقف پخش" : "پخش"}</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => void transcribeVoiceNote(voiceNote)}
                            disabled={isLocked || !!isTranscribingVoiceNoteId}
                          >
                            {isTranscribingVoiceNoteId === voiceNote.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <WandSparkles className="h-3.5 w-3.5" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>تبدیل به متن و افزودن</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={() => void deleteVoiceNote(voiceNote.id)}
                            disabled={isLocked || !!isDeletingVoiceNoteId}
                          >
                            {isDeletingVoiceNoteId === voiceNote.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>حذف</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="شرح حال، شکایت اصلی، و مشاهدات بالینی..."
            className="min-h-[360px] resize-y text-sm leading-7"
            disabled={isLocked || isSaving || !!isTranscribingVoiceNoteId}
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
