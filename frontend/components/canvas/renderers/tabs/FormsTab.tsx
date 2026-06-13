"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import {
  FileText,
  Plus,
  CheckCircle2,
  Bot,
  Sparkles,
  FlaskConical,
  Upload,
  Download,
  Trash2,
  Pencil,
  Loader2,
  Search,
  ImageIcon,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { DynamicForm } from "@/components/tool-ui/form/dynamic-form";
import { FormDefinition, ClinicalTestAttachment, ClinicalTestCatalogItem, ClinicalTestEntry, InteractiveTestCatalogItem, TestMode } from "@/lib/types/vania";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { InteractiveTestResultView } from "../shared/InteractiveTestResultView";
interface Props {
  forms: any[];
  tests: ClinicalTestEntry[];
  testsCatalog: ClinicalTestCatalogItem[];
  availableForms: FormDefinition[];
  uiSignal?: { type: string; form?: FormDefinition; data?: any };
  onEdit: (delta: any) => void;
  patientId: number;
  caseId?: string;
  readOnly?: boolean;
  formsEnabled?: boolean;
  formHistoryVisible?: boolean;
  testMode?: TestMode;
}

const HIDDEN_KEYS = new Set(["handler", "submitted_by_doctor_id", "submission_timestamp", "form_key", "form_title"]);

const toJalali = (isoDateString: string) => {
  if (!isoDateString) return "-";
  try {
    if (isoDateString.startsWith("13") || isoDateString.startsWith("14")) return isoDateString;
    return new Date(isoDateString).toLocaleDateString("fa-IR");
  } catch {
    return isoDateString;
  }
};

const formatFileSize = (size: number) => {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
};

const interactiveStatusLabel = (status?: ClinicalTestEntry["interactive_status"]) => {
  if (status === "COMPLETED") return "تکمیل شده";
  if (status === "IN_PROGRESS" || status === "SUBMITTED") return "در حال انجام";
  if (status === "FAILED") return "نیازمند تلاش دوباره";
  return "در انتظار انجام";
};

interface TestDraft {
  id?: string;
  source?: "manual" | "interactive";
  catalog_id?: number | null;
  interactive_test_id?: number | null;
  title: string;
  url: string;
  result_summary: string;
}

const getTestAttachments = (test: ClinicalTestEntry): ClinicalTestAttachment[] => {
  if (Array.isArray(test.attachments) && test.attachments.length > 0) {
    return test.attachments;
  }
  if (test.file_name) {
    return [{
      id: "legacy-file",
      file_name: test.file_name,
      file_path: test.file_path,
      file_uploaded_at: test.file_uploaded_at,
      content_type: test.file_name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream",
    }];
  }
  return [];
};

export function FormsTab({
  forms,
  tests,
  testsCatalog,
  availableForms,
  uiSignal,
  onEdit,
  patientId,
  caseId,
  readOnly = false,
  formsEnabled = true,
  formHistoryVisible = true,
  testMode = "full_catalog",
}: Props) {
  const params = useParams();
  const threadId = params.threadId as string;

  const [activeModalForm, setActiveModalForm] = useState<FormDefinition | null>(null);
  const [draftData, setDraftData] = useState<any>(null);
  const [viewingFormEntry, setViewingFormEntry] = useState<any | null>(null);
  const [formPickerOpen, setFormPickerOpen] = useState(false);
  const [formSearch, setFormSearch] = useState("");

  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testSaving, setTestSaving] = useState(false);
  const [testUploading, setTestUploading] = useState(false);
  const [testPickerOpen, setTestPickerOpen] = useState(false);
  const [testDraft, setTestDraft] = useState<TestDraft>({ source: "manual", title: "", url: "", result_summary: "", catalog_id: null, interactive_test_id: null });
  const [interactiveCatalog, setInteractiveCatalog] = useState<InteractiveTestCatalogItem[]>([]);
  const [interactiveCatalogLoading, setInteractiveCatalogLoading] = useState(false);
  const [testMarkedDone, setTestMarkedDone] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedFilePreviews, setSelectedFilePreviews] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const onEditRef = useRef(onEdit);

  useEffect(() => {
    onEditRef.current = onEdit;
  }, [onEdit]);

  useEffect(() => {
    if (readOnly || testMode !== "full_catalog") return;
    let ignore = false;

    const loadInteractiveCatalog = async () => {
      setInteractiveCatalogLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/vania/esanj/tests/`, {
          method: "GET",
          headers: { ...getAuthHeaders() },
        });
        if (!res.ok) return;
        const body = await res.json();
        if (!ignore && Array.isArray(body?.tests)) {
          setInteractiveCatalog(body.tests);
        }
      } catch {
      } finally {
        if (!ignore) setInteractiveCatalogLoading(false);
      }
    };

    loadInteractiveCatalog();
    return () => {
      ignore = true;
    };
  }, [readOnly, testMode]);

  const catalogMap = useMemo(() => {
    const m = new Map<number, ClinicalTestCatalogItem>();
    (testsCatalog || []).forEach((item) => m.set(item.id, item));
    return m;
  }, [testsCatalog]);

  const filteredTestsCatalog = useMemo(() => {
    if (testMode !== "full_catalog") return [];
    const q = testDraft.title.trim().toLowerCase();
    if (!q) return testsCatalog || [];
    return (testsCatalog || []).filter((item) =>
      `${item.id} ${item.title} ${item.url}`.toLowerCase().includes(q)
    );
  }, [testsCatalog, testDraft.title, testMode]);

  const filteredInteractiveCatalog = useMemo(() => {
    if (testMode !== "full_catalog") return [];
    const q = testDraft.title.trim().toLowerCase();
    if (!q) return interactiveCatalog || [];
    return (interactiveCatalog || []).filter((item) =>
      `${item.esanj_test_id} ${item.title} ${item.title_employee || ""}`.toLowerCase().includes(q)
    );
  }, [interactiveCatalog, testDraft.title, testMode]);

  const filteredForms = useMemo(() => {
    const q = formSearch.trim().toLowerCase();
    if (!q) return availableForms || [];
    return (availableForms || []).filter((item) =>
      `${item.key} ${item.title} ${item.description}`.toLowerCase().includes(q)
    );
  }, [availableForms, formSearch]);

  const viewingFormDefinition = useMemo(() => {
    const formKey = viewingFormEntry?.form_key || viewingFormEntry?.data?.form_key;
    return (availableForms || []).find((f) => f.key === formKey) || null;
  }, [availableForms, viewingFormEntry]);

  const activeTestAttachments = useMemo(() => {
    if (!testDraft.id) return [];
    const activeTest = (tests || []).find((item) => item.id === testDraft.id);
    return activeTest ? getTestAttachments(activeTest) : [];
  }, [testDraft.id, tests]);

  useEffect(() => {
    const nextPreviews: Record<string, string> = {};

    selectedFiles.forEach((file) => {
      if (file.type.startsWith("image/")) {
        nextPreviews[`${file.name}-${file.size}-${file.lastModified}`] = URL.createObjectURL(file);
      }
    });

    setSelectedFilePreviews(nextPreviews);

    return () => {
      Object.values(nextPreviews).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [selectedFiles]);

  useEffect(() => {
    if (!uiSignal) return;

    let shouldClearSignal = false;
    if (uiSignal.type === "OPEN_FORM" && uiSignal.form) {
      setActiveModalForm(uiSignal.form);
      setDraftData(null);
      shouldClearSignal = true;
    } else if (uiSignal.type === "DRAFT_FORM" && uiSignal.form) {
      setActiveModalForm(uiSignal.form);
      setDraftData(uiSignal.data);
      shouldClearSignal = true;
    }

    if (shouldClearSignal) {
      setTimeout(() => onEditRef.current({ ui_signal: undefined }), 300);
    }
  }, [uiSignal]);

  const handleFormSuccess = (formData: any) => {
    if (!activeModalForm) return;

    toast.success(`فرم «${activeModalForm.title}» با موفقیت ثبت شد.`);
    setActiveModalForm(null);
    setFormPickerOpen(false);

    const newEntry = {
      id: "temp-" + Date.now(),
      type: activeModalForm.title,
      date: new Date().toISOString(),
      form_key: activeModalForm.key,
      case_id: caseId,
      data: {
        ...formData,
        form_key: activeModalForm.key,
        form_title: activeModalForm.title,
        case_id: caseId,
      },
    };
    onEdit({ forms: [newEntry, ...(forms || [])] });
  };

  const openNewTestModal = () => {
    setSelectedFiles([]);
    setTestDraft({ source: "manual", title: "", url: "", result_summary: "", catalog_id: null, interactive_test_id: null });
    setTestMarkedDone(false);
    setTestModalOpen(true);
  };

  const openEditTestModal = (test: ClinicalTestEntry) => {
    setSelectedFiles([]);
    setTestDraft({
      id: test.id,
      source: test.source === "interactive" ? "interactive" : "manual",
      catalog_id: test.catalog_id || null,
      interactive_test_id: test.interactive_test_id || null,
      title: test.title || "",
      url: test.url || "",
      result_summary: test.result_text || test.result_summary || "",
    });
    setTestMarkedDone(true);
    setTestModalOpen(true);
  };

  const handleCatalogChange = (value: string) => {
    const id = Number(value);
    const item = catalogMap.get(id);
    if (!item) return;
    setTestDraft((prev) => ({ ...prev, source: "manual", catalog_id: id, interactive_test_id: null, title: item.title, url: item.url }));
    setTestPickerOpen(false);
  };

  const handleInteractiveCatalogChange = (test: InteractiveTestCatalogItem) => {
    setTestDraft((prev) => ({
      ...prev,
      source: "interactive",
      catalog_id: null,
      interactive_test_id: test.esanj_test_id,
      title: test.title,
      url: "",
      result_summary: "",
    }));
    setTestMarkedDone(false);
    setSelectedFiles([]);
    setTestPickerOpen(false);
  };

  const handleTestTitleChange = (value: string) => {
    setTestDraft((prev) => ({ ...prev, title: value, catalog_id: null, interactive_test_id: null, source: prev.source === "interactive" ? "interactive" : "manual", url: "" }));
    setTestPickerOpen(testMode === "full_catalog" && !!value.trim());
  };

  const clearLinkedCatalog = () => {
    setTestDraft((prev) => ({ ...prev, source: "manual", catalog_id: null, interactive_test_id: null, url: "" }));
  };

  const addSelectedFiles = (incomingFiles: File[]) => {
    if (incomingFiles.length === 0) return;

    setSelectedFiles((prev) => {
      const seen = new Set(prev.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
      const next = [...prev];

      incomingFiles.forEach((file) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        if (!seen.has(key)) {
          seen.add(key);
          next.push(file);
        }
      });

      return next;
    });
  };

  const removeSelectedFile = (targetFile: File) => {
    setSelectedFiles((prev) =>
      prev.filter(
        (file) =>
          !(file.name === targetFile.name && file.size === targetFile.size && file.lastModified === targetFile.lastModified)
      )
    );
  };

  const upsertTest = async () => {
    if (!testDraft.title.trim()) {
      toast.error("عنوان تست الزامی است.");
      return;
    }
    const isInteractive = testDraft.source === "interactive";
    if (isInteractive && !testDraft.interactive_test_id) {
      toast.error("یک تست تعاملی را انتخاب کنید.");
      return;
    }

    const isEditMode = !!testDraft.id;
    const shouldSaveResult = !isInteractive && (isEditMode || testMarkedDone);
    const resultSummary = shouldSaveResult ? testDraft.result_summary : "";

    setTestSaving(true);
    try {
      let testId = testDraft.id;
      let updatedTests = [...(tests || [])];

      if (!testId) {
        const res = await fetch(`${API_BASE_URL}/api/vania/tests/`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({
            patient_id: patientId,
            case_id: caseId,
            source: isInteractive ? "interactive" : "manual",
            catalog_id: !isInteractive && testMode === "full_catalog" ? testDraft.catalog_id || undefined : undefined,
            interactive_test_id: isInteractive ? testDraft.interactive_test_id : undefined,
            title: testDraft.title,
            url: !isInteractive && testMode === "full_catalog" ? testDraft.url : "",
            result_text: resultSummary,
            result_summary: resultSummary,
          }),
        });
        if (!res.ok) throw new Error("ثبت تست ناموفق بود.");
        const created = await res.json();
        testId = created.id;
        updatedTests = [created, ...updatedTests];
      } else if (!isInteractive) {
        const res = await fetch(`${API_BASE_URL}/api/vania/tests/${testId}/`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({
            patient_id: patientId,
            case_id: caseId,
            catalog_id: testMode === "full_catalog" ? testDraft.catalog_id || undefined : undefined,
            title: testDraft.title,
            url: testMode === "full_catalog" ? testDraft.url : "",
            result_text: resultSummary,
            result_summary: resultSummary,
          }),
        });
        if (!res.ok) throw new Error("ویرایش تست ناموفق بود.");
        const updated = await res.json();
        updatedTests = updatedTests.map((t) => (t.id === testId ? updated : t));
      }

      if (!isInteractive && (testDraft.id || testMarkedDone) && selectedFiles.length > 0 && testId) {
        setTestUploading(true);
        let latestTest = updatedTests.find((t) => t.id === testId) || null;
        for (const file of selectedFiles) {
          const fd = new FormData();
          fd.append("patient_id", String(patientId));
          if (caseId) fd.append("case_id", String(caseId));
          fd.append("file", file);

          const uploadRes = await fetch(`${API_BASE_URL}/api/vania/tests/${testId}/file/`, {
            method: "POST",
            headers: { ...getAuthHeaders(), ...(caseId ? { "X-Target-Case-ID": String(caseId) } : {}) },
            body: fd,
          });
          if (!uploadRes.ok) throw new Error(`آپلود فایل «${file.name}» ناموفق بود.`);
          latestTest = await uploadRes.json();
          updatedTests = updatedTests.map((t) => (t.id === testId ? latestTest! : t));
        }
        setTestUploading(false);
      }

      onEdit({ tests: updatedTests });
      toast.success(isInteractive ? "تست تعاملی با موفقیت ارجاع شد." : "تست با موفقیت ذخیره شد.");
      setTestModalOpen(false);
    } catch (e: any) {
      setTestUploading(false);
      toast.error(e.message || "خطا در ذخیره تست.");
    } finally {
      setTestSaving(false);
    }
  };

  const deleteTest = async (testId: string) => {
    const ok = confirm("این تست حذف شود؟");
    if (!ok) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/vania/tests/${testId}/?patient_id=${patientId}`, {
        method: "DELETE",
        headers: { ...getAuthHeaders(), ...(caseId ? { "X-Target-Case-ID": String(caseId) } : {}) },
      });
      if (!res.ok) throw new Error("حذف تست ناموفق بود.");
      onEdit({ tests: (tests || []).filter((t) => t.id !== testId) });
      toast.success("تست حذف شد.");
    } catch (e: any) {
      toast.error(e.message || "خطا در حذف تست.");
    }
  };

  const deleteTestFile = async (testId: string, attachmentId?: string) => {
    try {
      const query = new URLSearchParams({ patient_id: String(patientId) });
      if (attachmentId) query.set("attachment_id", attachmentId);
      const res = await fetch(`${API_BASE_URL}/api/vania/tests/${testId}/file/delete/?${query.toString()}`, {
        method: "DELETE",
        headers: { ...getAuthHeaders(), ...(caseId ? { "X-Target-Case-ID": String(caseId) } : {}) },
      });
      if (!res.ok) throw new Error("حذف فایل ناموفق بود.");
      onEdit({
        tests: (tests || []).map((t) =>
          t.id === testId
            ? {
                ...t,
                attachments: getTestAttachments(t).filter((item) => item.id !== attachmentId),
                file_name: null,
                file_path: null,
                file_uploaded_at: null,
              }
            : t
        ),
      });
      toast.success("فایل تست حذف شد.");
    } catch (e: any) {
      toast.error(e.message || "خطا در حذف فایل.");
    }
  };

  const downloadTestFile = async (testId: string, attachmentId?: string, fallbackName?: string | null) => {
    try {
      const query = new URLSearchParams({ patient_id: String(patientId) });
      if (attachmentId) query.set("attachment_id", attachmentId);
      const res = await fetch(`${API_BASE_URL}/api/vania/tests/${testId}/file/download/?${query.toString()}`, {
        method: "GET",
        headers: { ...getAuthHeaders(), ...(caseId ? { "X-Target-Case-ID": String(caseId) } : {}) },
      });
      if (!res.ok) throw new Error("دانلود فایل ناموفق بود.");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fallbackName || "test-result.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e.message || "خطا در دانلود فایل.");
    }
  };

  return (
    <div className="space-y-6 pb-10 animate-in fade-in slide-in-from-right-2 duration-300">
      {formsEnabled || formHistoryVisible ? (
      <section className="rounded-2xl border border-border/60 bg-background/70 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">فرم‌ها و ارزیابی‌ها</h3>
            <p className="mt-1 text-[11px] text-muted-foreground">افزودن فرم‌های جدید و مرور تاریخچه ثبت‌شده.</p>
          </div>
          {!readOnly && formsEnabled ? <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setFormPickerOpen(true)}>
            <Plus className="w-3.5 h-3.5" />
            افزودن فرم جدید
          </Button> : null}
        </div>

        {formHistoryVisible ? (
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> تاریخچه فرم‌ها
          </h4>
          <Badge variant="outline" className="text-[10px] font-normal">{forms?.length || 0} مورد</Badge>
        </div>
        ) : null}

        {formHistoryVisible ? ((forms?.length || 0) === 0 ? (
          <div className="text-center py-8 text-muted-foreground bg-muted/10 rounded-xl border border-dashed text-xs italic">
            هنوز فرمی تکمیل نشده است.
          </div>
        ) : (
          <div className="space-y-2">
            {forms.map((entry, idx) => (
              <div key={entry.id || idx} className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-primary opacity-70" />
                    <span className="truncate text-sm font-semibold">{entry.data?.form_title || entry.type || entry.form_key}</span>
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {toJalali(entry.date)}
                  </div>
                </div>
                <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => setViewingFormEntry(entry)}>
                  <FileText className="w-3.5 h-3.5" />
                  مشاهده فرم
                </Button>
              </div>
            ))}
          </div>
        )) : (
          <div className="text-center py-8 text-muted-foreground bg-muted/10 rounded-xl border border-dashed text-xs italic">
            این نقش به فرم‌های پرونده دسترسی ندارد.
          </div>
        )}
      </section>
      ) : null}

      {testMode !== "disabled" ? (
      <section className="rounded-2xl border border-border/60 bg-background/70 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-primary" /> {testMode === "exams_only" ? "آزمایش‌ها" : "تست‌ها و آزمایش‌ها"}
          </h3>
          {!readOnly ? <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={openNewTestModal}>
            <Plus className="w-3.5 h-3.5" /> {testMode === "exams_only" ? "افزودن آزمایش" : "افزودن تست یا آزمایش"}
          </Button> : null}
        </div>

        {(tests?.length || 0) === 0 ? (
          <div className="text-center py-8 text-muted-foreground bg-muted/10 rounded-xl border border-dashed text-xs italic">
            هنوز تست یا آزمایشی ثبت نشده است.
          </div>
        ) : (
          <div className="space-y-2">
            {tests.map((test) => {
              const attachments = getTestAttachments(test);
              const resultText = test.result_text || test.result_summary || "";
              const isInteractive = test.source === "interactive";
              const hasResult = isInteractive ? test.interactive_status === "COMPLETED" : !!resultText.trim() || attachments.length > 0;

              return (
                <div
                  key={test.id}
                  className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-right shadow-sm transition hover:border-primary/40 hover:bg-primary/5"
                >
                  <button
                    type="button"
                    onClick={() => openEditTestModal(test)}
                    className="min-w-0 flex-1 text-right"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold">{test.title}</span>
                      {isInteractive ? <Badge variant="secondary" className="text-[10px]">تست تعاملی</Badge> : null}
                      {test.url ? <Badge variant="outline" className="text-[10px]">لینک</Badge> : null}
                      {attachments.length > 0 ? <Badge variant="outline" className="text-[10px]">{attachments.length} فایل</Badge> : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <Badge variant={hasResult ? "outline" : "secondary"} className="text-[10px]">
                        {isInteractive ? interactiveStatusLabel(test.interactive_status) : hasResult ? "تکمیل شده" : "در انتظار تکمیل"}
                      </Badge>
                      <span>{toJalali(test.created_at || "")}</span>
                    </div>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    {!readOnly ? (
                      <>
                        <Button
                          size="icon"
                          type="button"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => openEditTestModal(test)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          type="button"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={() => deleteTest(test.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      ) : null}

      <Dialog open={formsEnabled && formPickerOpen} onOpenChange={setFormPickerOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle>انتخاب فرم جدید</DialogTitle>
            <DialogDescription>فرم مورد نیاز این پرونده را انتخاب کنید.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={formSearch} onChange={(e) => setFormSearch(e.target.value)} placeholder="جستجوی فرم..." className="pr-9" />
            </div>
            <div className="grid max-h-[50vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
              {filteredForms.map((form) => (
                <button
                  key={form.key}
                  onClick={() => {
                    setActiveModalForm(form);
                    setDraftData(null);
                    setFormPickerOpen(false);
                  }}
                  className="flex flex-col items-start rounded-xl border bg-card p-3 text-right transition hover:border-primary/40 hover:bg-primary/5"
                >
                  <span className="text-sm font-semibold">{form.title}</span>
                  <span className="mt-1 text-[11px] text-muted-foreground line-clamp-3">{form.description}</span>
                </button>
              ))}
              {filteredForms.length === 0 && (
                <div className="col-span-full rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                  فرمی با این عبارت پیدا نشد.
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={formsEnabled && !!activeModalForm} onOpenChange={(o) => !o && setActiveModalForm(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-4xl max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="flex items-center gap-2">
              {activeModalForm?.title}
              {draftData && (
                <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200 text-[10px] gap-1 px-2 py-0.5 animate-in zoom-in">
                  <Sparkles className="w-3 h-3" />
                  پیش نویس هوش مصنوعی
                </Badge>
              )}
            </DialogTitle>

            {draftData && (
              <DialogDescription className="text-xs bg-purple-50 text-purple-800 p-2.5 rounded-lg flex items-start gap-2 mt-2 border border-purple-100">
                <Bot className="w-4 h-4 mt-0.5 shrink-0" />
                <p>این فرم بر اساس تحلیل های اخیر پیش نویس شده است. لطفا بررسی و تایید کنید.</p>
              </DialogDescription>
            )}
          </DialogHeader>

          {activeModalForm && (
            <div className="py-2">
              <DynamicForm
                formHandle={activeModalForm.handler}
                schema={activeModalForm.schema}
                key={draftData ? "draft-mode" : "new-mode"}
                prefill={{
                  ...(draftData || {}),
                  form_key: activeModalForm.key,
                  form_title: activeModalForm.title,
                }}
                title={activeModalForm.title}
                description={activeModalForm.description}
                onSuccess={handleFormSuccess}
                patientId={patientId}
                sessionId={threadId}
                caseId={caseId}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingFormEntry} onOpenChange={(open) => !open && setViewingFormEntry(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-4xl max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle>{viewingFormEntry?.data?.form_title || viewingFormEntry?.type || viewingFormEntry?.form_key || "فرم ثبت‌شده"}</DialogTitle>
            <DialogDescription>
              {viewingFormEntry?.date ? `تاریخ ثبت: ${toJalali(viewingFormEntry.date)}` : "نمایش اطلاعات ثبت‌شده فرم"}
            </DialogDescription>
          </DialogHeader>

          {viewingFormEntry && viewingFormDefinition ? (
            <DynamicForm
              formHandle={viewingFormDefinition.handler}
              schema={viewingFormDefinition.schema}
              prefill={viewingFormEntry.data || {}}
              title={viewingFormDefinition.title}
              description={viewingFormDefinition.description}
              disabled
              readOnly
              hideSubmit
            />
          ) : (
            <div className="text-sm text-muted-foreground">تعریف این فرم برای نمایش پیدا نشد.</div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={testModalOpen} onOpenChange={setTestModalOpen}>
        <DialogContent dir="rtl" className="flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-xl flex-col overflow-hidden">
          <DialogHeader className="text-right">
            <DialogTitle>{testDraft.source === "interactive" ? "تست تعاملی" : testDraft.id ? (testMode === "exams_only" ? "ویرایش آزمایش" : "ویرایش تست یا آزمایش") : (testMode === "exams_only" ? "افزودن آزمایش" : "افزودن تست یا آزمایش")}</DialogTitle>
            <DialogDescription>
              {testDraft.source === "interactive" ? "انتخاب و ارجاع به مراجع." : "عنوان و نتیجه را ثبت کنید."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-4 overflow-y-auto pr-1">
            {testMode === "full_catalog" && !testDraft.id ? (
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-border/60 bg-muted/10 p-1">
                <Button
                  type="button"
                  variant={testDraft.source === "manual" ? "secondary" : "ghost"}
                  className="h-9 text-xs"
                  onClick={() => setTestDraft((prev) => ({ ...prev, source: "manual", interactive_test_id: null }))}
                >
                  ثبت دستی
                </Button>
                <Button
                  type="button"
                  variant={testDraft.source === "interactive" ? "secondary" : "ghost"}
                  className="h-9 text-xs"
                  onClick={() => {
                    setTestDraft({ source: "interactive", title: "", url: "", result_summary: "", catalog_id: null, interactive_test_id: null });
                    setTestMarkedDone(false);
                    setSelectedFiles([]);
                  }}
                >
                  تست تعاملی
                </Button>
              </div>
            ) : null}

            <div className="grid gap-1.5">
              <Label className="text-xs">{testDraft.source === "interactive" ? "انتخاب تست تعاملی" : testMode === "exams_only" ? "عنوان آزمایش" : "عنوان تست یا آزمایش"}</Label>
              <div className="space-y-2">
                <Popover open={testMode === "full_catalog" && testPickerOpen && !!testDraft.title.trim() && (filteredTestsCatalog.length > 0 || filteredInteractiveCatalog.length > 0)} onOpenChange={setTestPickerOpen}>
                  <PopoverAnchor asChild>
                    <div className="relative">
                      <Input
                        value={testDraft.title}
                        onChange={(e) => handleTestTitleChange(e.target.value)}
                        readOnly={!!testDraft.id && testDraft.source === "interactive"}
                        placeholder={testDraft.source === "interactive" ? "نام تست تعاملی را جستجو کنید" : testMode === "exams_only" ? "نام آزمایش را وارد کنید" : "نام تست یا آزمایش را جستجو یا وارد کنید"}
                        onFocus={() => {
                          if (testMode === "full_catalog" && !testDraft.id) {
                            setTestPickerOpen(!!testDraft.title.trim() && (filteredTestsCatalog.length > 0 || filteredInteractiveCatalog.length > 0));
                          }
                        }}
                      />
                    </div>
                  </PopoverAnchor>
                  <PopoverContent
                    align="start"
                    sideOffset={6}
                    onOpenAutoFocus={(event) => event.preventDefault()}
                    className="max-h-72 w-[var(--radix-popover-trigger-width)] overflow-y-auto rounded-xl p-2"
                  >
                  <div className="mb-1 px-1 text-[10px] text-muted-foreground">انتخاب سریع</div>
                    <div className="grid gap-1">
                      {testDraft.source === "interactive" ? filteredInteractiveCatalog.map((item) => (
                        <button
                          key={item.esanj_test_id}
                          type="button"
                          onClick={() => handleInteractiveCatalogChange(item)}
                          className="rounded-lg px-3 py-2 text-right text-xs transition hover:bg-muted"
                        >
                          <div className="font-medium">{item.title}</div>
                          <div className="mt-0.5 text-[10px] text-muted-foreground">تست تعاملی</div>
                        </button>
                      )) : filteredTestsCatalog.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleCatalogChange(String(item.id))}
                          className="rounded-lg px-3 py-2 text-right text-xs transition hover:bg-muted"
                        >
                          {item.title}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                {testDraft.source === "interactive" && testDraft.interactive_test_id ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-sky-200 bg-sky-50/70 px-3 py-2 text-xs text-sky-950">
                    <div className="min-w-0">
                      <div className="font-medium">انتخاب شد</div>
                      <div className="truncate text-[11px] opacity-80">{testDraft.title}</div>
                    </div>
                    {!testDraft.id ? (
                      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clearLinkedCatalog}>
                        <X className="h-3.5 w-3.5" />
                        حذف اتصال
                      </Button>
                    ) : null}
                  </div>
                ) : testMode === "full_catalog" && testDraft.catalog_id ? (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs text-emerald-900">
                    <div className="min-w-0">
                      <div className="font-medium">تست انتخاب شده از فهرست</div>
                      <div className="truncate text-[11px] opacity-80">{testDraft.title}</div>
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clearLinkedCatalog}>
                      <X className="h-3.5 w-3.5" />
                      حذف اتصال
                    </Button>
                  </div>
                ) : testMode === "full_catalog" ? (
                  <div className="text-[10px] text-muted-foreground">
                    {testDraft.source === "interactive"
                      ? interactiveCatalogLoading ? "در حال بارگذاری..." : "نام تست را جستجو کنید."
                      : "می‌توانید عنوان را آزادانه وارد کنید یا یکی از موارد مشابه را انتخاب کنید."}
                  </div>
                ) : null}

                {testDraft.source === "interactive" && !testDraft.interactive_test_id ? (
                  <div className="max-h-52 overflow-y-auto rounded-xl border border-border/60 bg-muted/10 p-1">
                    {filteredInteractiveCatalog.length > 0 ? (
                      <>
                        <div className="px-3 py-2 text-[10px] text-muted-foreground">
                          {filteredInteractiveCatalog.length.toLocaleString("fa-IR")} تست قابل انتخاب
                        </div>
                        {filteredInteractiveCatalog.map((item) => (
                        <button
                          key={item.esanj_test_id}
                          type="button"
                          onClick={() => handleInteractiveCatalogChange(item)}
                          className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-right text-xs transition hover:bg-background"
                        >
                          <span className="min-w-0 truncate font-medium">{item.title}</span>
                          <Badge variant="outline" className="shrink-0 text-[10px] font-normal">تعاملی</Badge>
                        </button>
                        ))}
                      </>
                    ) : (
                      <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                        تستی پیدا نشد.
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            {testDraft.source === "interactive" && testDraft.id ? (
              <div className="space-y-3 rounded-xl border border-border/60 bg-muted/10 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">وضعیت تست</span>
                  <Badge variant="secondary" className="text-[10px]">{interactiveStatusLabel((tests || []).find((item) => item.id === testDraft.id)?.interactive_status)}</Badge>
                </div>
                <InteractiveTestResultView
                  rawText={testDraft.result_summary}
                  emptyText="پس از تکمیل مراجع، نتیجه اینجا نمایش داده می‌شود."
                />
              </div>
            ) : null}

            {!testDraft.id && testDraft.source !== "interactive" ? (
              <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/10 px-3 py-3">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-foreground">انجام شده</div>
                  <div className="text-[11px] text-muted-foreground">اگر انجام شده، نتیجه را ثبت کنید.</div>
                </div>
                <Switch checked={testMarkedDone} onCheckedChange={setTestMarkedDone} />
              </div>
            ) : null}

            {testDraft.source !== "interactive" && (testDraft.id || testMarkedDone) ? (
              <>
                <div className="grid gap-1.5">
                  <Label className="text-xs">متن نتیجه</Label>
                  <Textarea
                    value={testDraft.result_summary}
                    onChange={(e) => setTestDraft((p) => ({ ...p, result_summary: e.target.value }))}
                    placeholder="متن نتیجه را وارد کنید."
                    className="min-h-[110px]"
                  />
                </div>

                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-xs">فایل‌های نتیجه</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      افزودن فایل
                    </Button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="application/pdf,image/*"
                    className="hidden"
                    onChange={(e) => {
                      addSelectedFiles(Array.from(e.target.files || []));
                      e.target.value = "";
                    }}
                  />

                  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span>PDF یا تصویر</span>
                      <span>{activeTestAttachments.length + selectedFiles.length} فایل</span>
                    </div>

                    {activeTestAttachments.length === 0 && selectedFiles.length === 0 ? (
                      <div className="py-8 text-center text-xs text-muted-foreground">
                        فایلی ثبت نشده است.
                      </div>
                    ) : (
                      <div className="mt-3 max-h-[340px] overflow-y-auto pr-1">
                        <div className="grid gap-3 sm:grid-cols-2">
                        {activeTestAttachments.map((attachment) => {
                          const isPdf = attachment.content_type?.includes("pdf");

                          return (
                            <div key={attachment.id} className="overflow-hidden rounded-2xl border border-border/60 bg-background/60">
                              <div className="flex h-28 items-center justify-center bg-muted/20">
                                {isPdf ? (
                                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                    <FileText className="h-8 w-8" />
                                    <span className="text-[10px]">PDF</span>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                    <ImageIcon className="h-8 w-8" />
                                    <span className="text-[10px]">تصویر</span>
                                  </div>
                                )}
                              </div>

                              <div className="space-y-3 p-3">
                                <div className="space-y-1 text-right">
                                  <div className="truncate text-xs font-medium text-foreground">{attachment.file_name}</div>
                                  <div className="text-[10px] text-muted-foreground">
                                    {toJalali(attachment.file_uploaded_at || "")}
                                  </div>
                                </div>

                                <div className="flex items-center justify-between gap-2">
                                  <Badge variant="outline" className="text-[10px] font-normal">
                                    ثبت شده
                                  </Badge>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8"
                                      onClick={() => downloadTestFile(testDraft.id!, attachment.id, attachment.file_name)}
                                    >
                                      <Download className="h-3.5 w-3.5" />
                                    </Button>
                                    {!readOnly ? (
                                      <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 text-destructive"
                                        onClick={() => deleteTestFile(testDraft.id!, attachment.id)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {selectedFiles.map((file) => {
                          const key = `${file.name}-${file.size}-${file.lastModified}`;
                          const previewUrl = selectedFilePreviews[key];
                          const isImage = file.type.startsWith("image/");

                          return (
                            <div key={key} className="overflow-hidden rounded-2xl border border-primary/20 bg-primary/5">
                              <div className="relative flex h-28 items-center justify-center overflow-hidden bg-background/70">
                                {isImage && previewUrl ? (
                                  <img src={previewUrl} alt={file.name} className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                    {file.type.includes("pdf") ? <FileText className="h-8 w-8" /> : <ImageIcon className="h-8 w-8" />}
                                    <span className="text-[10px]">{file.type.includes("pdf") ? "PDF" : "تصویر"}</span>
                                  </div>
                                )}

                                <Button
                                  type="button"
                                  size="icon"
                                  variant="secondary"
                                  className="absolute left-2 top-2 h-7 w-7"
                                  onClick={() => removeSelectedFile(file)}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>

                              <div className="space-y-2 p-3">
                                <div className="space-y-1 text-right">
                                  <div className="truncate text-xs font-medium text-foreground">{file.name}</div>
                                  <div className="text-[10px] text-muted-foreground">
                                    {formatFileSize(file.size)}
                                  </div>
                                </div>
                                <Badge variant="secondary" className="text-[10px] font-normal">
                                  آماده آپلود
                                </Badge>
                              </div>
                            </div>
                          );
                        })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>

          {!(testDraft.id && testDraft.source === "interactive") ? (
            <DialogFooter className="border-t border-border/60 pt-4">
              <Button onClick={upsertTest} disabled={readOnly || testSaving || testUploading} className="w-full gap-2 sm:w-auto">
                {testSaving || testUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {testUploading ? "در حال آپلود فایل..." : testDraft.source === "interactive" ? "ارجاع تست تعاملی" : testMode === "exams_only" ? "ذخیره آزمایش" : "ذخیره تست"}
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
