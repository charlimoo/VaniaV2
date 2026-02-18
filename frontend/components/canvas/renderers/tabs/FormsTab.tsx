"use client";

import { useState, useEffect, useMemo } from "react";
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
  Link2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import { DynamicForm } from "@/components/tool-ui/form/dynamic-form";
import { FormDefinition, ClinicalTestCatalogItem, ClinicalTestEntry } from "@/lib/types/vania";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  forms: any[];
  tests: ClinicalTestEntry[];
  testsCatalog: ClinicalTestCatalogItem[];
  availableForms: FormDefinition[];
  uiSignal?: { type: string; form?: FormDefinition; data?: any };
  onEdit: (delta: any) => void;
  patientId: number;
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

interface TestDraft {
  id?: string;
  catalog_id?: number | null;
  title: string;
  url: string;
  result_summary: string;
}

export function FormsTab({ forms, tests, testsCatalog, availableForms, uiSignal, onEdit, patientId }: Props) {
  const params = useParams();
  const threadId = params.threadId as string;

  const [activeModalForm, setActiveModalForm] = useState<FormDefinition | null>(null);
  const [draftData, setDraftData] = useState<any>(null);

  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testSaving, setTestSaving] = useState(false);
  const [testUploading, setTestUploading] = useState(false);
  const [testDraft, setTestDraft] = useState<TestDraft>({ title: "", url: "", result_summary: "", catalog_id: null });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const catalogMap = useMemo(() => {
    const m = new Map<number, ClinicalTestCatalogItem>();
    (testsCatalog || []).forEach((item) => m.set(item.id, item));
    return m;
  }, [testsCatalog]);

  const getFieldLabel = (entry: any, fieldKey: string) => {
    if (entry.form_key) {
      const def = availableForms?.find((f) => f.key === entry.form_key);
      if (def) {
        const field = def.schema.find((s: any) => s.name === fieldKey);
        if (field) return field.label;
      }
    }
    const defByTitle = availableForms?.find((f) => f.title === entry.type);
    if (defByTitle) {
      const field = defByTitle.schema.find((s: any) => s.name === fieldKey);
      if (field) return field.label;
    }
    return fieldKey;
  };

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
      setTimeout(() => onEdit({ ui_signal: undefined }), 300);
    }
  }, [uiSignal, onEdit]);

  const handleFormSuccess = (formData: any) => {
    if (!activeModalForm) return;

    toast.success(`فرم «${activeModalForm.title}» با موفقیت ثبت شد.`);
    setActiveModalForm(null);

    const newEntry = {
      id: "temp-" + Date.now(),
      type: activeModalForm.title,
      date: new Date().toISOString(),
      form_key: activeModalForm.key,
      data: {
        ...formData,
        form_key: activeModalForm.key,
        form_title: activeModalForm.title,
      },
    };
    onEdit({ forms: [newEntry, ...(forms || [])] });
  };

  const openNewTestModal = () => {
    setSelectedFile(null);
    setTestDraft({ title: "", url: "", result_summary: "", catalog_id: null });
    setTestModalOpen(true);
  };

  const openEditTestModal = (test: ClinicalTestEntry) => {
    setSelectedFile(null);
    setTestDraft({
      id: test.id,
      catalog_id: test.catalog_id || null,
      title: test.title || "",
      url: test.url || "",
      result_summary: test.result_summary || "",
    });
    setTestModalOpen(true);
  };

  const handleCatalogChange = (value: string) => {
    const id = Number(value);
    const item = catalogMap.get(id);
    if (!item) return;
    setTestDraft((prev) => ({ ...prev, catalog_id: id, title: item.title, url: item.url }));
  };

  const upsertTest = async () => {
    if (!testDraft.title.trim()) {
      toast.error("عنوان تست الزامی است.");
      return;
    }

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
            catalog_id: testDraft.catalog_id || undefined,
            title: testDraft.title,
            url: testDraft.url,
            result_summary: testDraft.result_summary,
          }),
        });
        if (!res.ok) throw new Error("ثبت تست ناموفق بود.");
        const created = await res.json();
        testId = created.id;
        updatedTests = [created, ...updatedTests];
      } else {
        const res = await fetch(`${API_BASE_URL}/api/vania/tests/${testId}/`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({
            patient_id: patientId,
            catalog_id: testDraft.catalog_id || undefined,
            title: testDraft.title,
            url: testDraft.url,
            result_summary: testDraft.result_summary,
          }),
        });
        if (!res.ok) throw new Error("ویرایش تست ناموفق بود.");
        const updated = await res.json();
        updatedTests = updatedTests.map((t) => (t.id === testId ? updated : t));
      }

      if (selectedFile && testId) {
        setTestUploading(true);
        const fd = new FormData();
        fd.append("patient_id", String(patientId));
        fd.append("file", selectedFile);
        fd.append("result_summary", testDraft.result_summary || "");
        fd.append("auto_summarize", "true");

        const uploadRes = await fetch(`${API_BASE_URL}/api/vania/tests/${testId}/file/`, {
          method: "POST",
          headers: { ...getAuthHeaders() },
          body: fd,
        });
        setTestUploading(false);
        if (!uploadRes.ok) throw new Error("آپلود فایل تست ناموفق بود.");
        const uploaded = await uploadRes.json();
        updatedTests = updatedTests.map((t) => (t.id === testId ? uploaded : t));
      }

      onEdit({ tests: updatedTests });
      toast.success("تست با موفقیت ذخیره شد.");
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
        headers: { ...getAuthHeaders() },
      });
      if (!res.ok) throw new Error("حذف تست ناموفق بود.");
      onEdit({ tests: (tests || []).filter((t) => t.id !== testId) });
      toast.success("تست حذف شد.");
    } catch (e: any) {
      toast.error(e.message || "خطا در حذف تست.");
    }
  };

  const deleteTestFile = async (testId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/vania/tests/${testId}/file/delete/?patient_id=${patientId}`, {
        method: "DELETE",
        headers: { ...getAuthHeaders() },
      });
      if (!res.ok) throw new Error("حذف فایل ناموفق بود.");
      onEdit({
        tests: (tests || []).map((t) =>
          t.id === testId ? { ...t, file_name: null, file_path: null, file_uploaded_at: null } : t
        ),
      });
      toast.success("فایل تست حذف شد.");
    } catch (e: any) {
      toast.error(e.message || "خطا در حذف فایل.");
    }
  };

  const downloadTestFile = async (testId: string, fallbackName?: string | null) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/vania/tests/${testId}/file/download/?patient_id=${patientId}`, {
        method: "GET",
        headers: { ...getAuthHeaders() },
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
    <div className="space-y-8 pb-10 animate-in fade-in slide-in-from-right-2 duration-300">
      <section>
        <h3 className="text-xs font-bold text-muted-foreground mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4" /> ثبت ارزیابی جدید (فرم)
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(availableForms || []).map((form) => (
            <button
              key={form.key}
              onClick={() => setActiveModalForm(form)}
              className="flex flex-col items-start p-3 rounded-xl border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all text-right group h-full shadow-sm"
            >
              <span className="font-bold text-xs group-hover:text-primary transition-colors">{form.title}</span>
              <span className="text-[10px] text-muted-foreground mt-1 line-clamp-2 text-start opacity-80">{form.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-bold text-muted-foreground flex items-center gap-2">
            <FlaskConical className="w-4 h-4" /> تست ها ({tests?.length || 0})
          </h3>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={openNewTestModal}>
            <Plus className="w-3.5 h-3.5" /> افزودن تست
          </Button>
        </div>

        {(tests?.length || 0) === 0 ? (
          <div className="text-center py-8 text-muted-foreground bg-muted/10 rounded-xl border border-dashed text-xs italic">
            هنوز تستی ثبت نشده است.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {tests.map((test) => (
              <div key={test.id} className="rounded-xl border bg-card p-3 shadow-sm space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <div className="truncate text-xs font-bold">{test.title}</div>
                    <div className="text-[10px] text-muted-foreground">{toJalali(test.created_at || "")}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditTestModal(test)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteTest(test.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {test.url && (
                  <a href={test.url} target="_blank" rel="noreferrer" className="text-[11px] text-primary inline-flex items-center gap-1.5 break-all">
                    <Link2 className="w-3 h-3" /> لینک تست
                  </a>
                )}

                <div className="text-[11px] text-foreground/80 leading-relaxed bg-muted/20 rounded p-2 min-h-[56px]">
                  {test.result_summary || "خلاصه نتیجه ثبت نشده است."}
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="min-w-0 break-all text-[10px] text-muted-foreground">
                    {test.file_name ? `فایل: ${test.file_name}` : "بدون فایل"}
                  </div>
                  <div className="flex items-center gap-1">
                    {test.file_name && (
                      <>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => downloadTestFile(test.id, test.file_name)}>
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteTestFile(test.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-xs font-bold text-muted-foreground mb-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> تاریخچه فرم ها ({forms?.length || 0})
        </h3>

        {(forms?.length || 0) === 0 ? (
          <div className="text-center py-8 text-muted-foreground bg-muted/10 rounded-xl border border-dashed text-xs italic">
            هنوز فرمی تکمیل نشده است.
          </div>
        ) : (
          <Accordion type="single" collapsible className="w-full space-y-2">
            {forms.map((entry, idx) => (
              <AccordionItem key={entry.id || idx} value={entry.id || String(idx)} className="border rounded-lg bg-card px-0 shadow-sm">
                <AccordionTrigger className="px-4 py-3 hover:no-underline text-xs">
                  <div className="ml-2 flex w-full items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-primary opacity-70" />
                      <span className="truncate font-semibold">{entry.data?.form_title || entry.type || entry.form_key}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">{toJalali(entry.date)}</span>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="px-4 pb-4 pt-0 border-t border-dashed border-border/50 mt-2">
                  <div className="grid grid-cols-1 gap-2 pt-3">
                    {Object.entries(entry.data)
                      .filter(([key]) => !HIDDEN_KEYS.has(key))
                      .map(([key, value]) => {
                        if (value === null || value === undefined || value === "") return null;

                        const label = getFieldLabel(entry, key);

                        if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object") {
                          return (
                            <div key={key} className="flex flex-col text-[11px] border-b border-border/30 pb-2 gap-2 mt-2">
                              <span className="text-muted-foreground font-medium">{label}:</span>
                              <div className="border rounded-md overflow-hidden">
                                <table className="w-full text-right bg-muted/10">
                                  <thead className="bg-muted/20">
                                    <tr>
                                      {Object.keys(value[0]).map((h) => (
                                        <th key={h} className="p-1.5 font-semibold text-[10px] text-muted-foreground border-b">
                                          {h}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {value.map((row: any, i: number) => (
                                      <tr key={i} className="border-b last:border-0 hover:bg-card">
                                        {Object.values(row).map((val: any, j) => (
                                          <td key={j} className="p-1.5 text-foreground">
                                            {String(val)}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        }

                        let displayValue = "";
                        if (typeof value === "object" && !Array.isArray(value)) {
                          displayValue = Object.entries(value)
                            .map(([subKey, subVal]) => `${subKey}: ${subVal}`)
                            .join("\n");
                        } else if (Array.isArray(value)) {
                          displayValue = value.join("، ");
                        } else {
                          if (key.includes("date") || key === "birth_date" || key === "file_date") {
                            displayValue = toJalali(String(value));
                          } else {
                            displayValue = String(value);
                          }
                        }

                        if (!displayValue || displayValue === "null") return null;

                        return (
                          <div key={key} className="flex flex-col sm:flex-row sm:justify-between text-[11px] border-b border-border/30 pb-1.5 last:border-0 gap-1 sm:gap-4">
                            <span className="text-muted-foreground font-medium shrink-0">{label}:</span>
                            <span className="font-medium text-foreground text-left whitespace-pre-wrap">{displayValue}</span>
                          </div>
                        );
                      })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </section>

      <Dialog open={!!activeModalForm} onOpenChange={(o) => !o && setActiveModalForm(null)}>
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
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={testModalOpen} onOpenChange={setTestModalOpen}>
        <DialogContent dir="rtl" className="w-[calc(100vw-2rem)] max-w-xl">
          <DialogHeader className="text-right">
            <DialogTitle>{testDraft.id ? "ویرایش تست" : "افزودن تست"}</DialogTitle>
            <DialogDescription>
              برای هر تست می توانید لینک، خلاصه نتیجه و فایل PDF نتیجه را ثبت کنید.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-1.5">
              <Label className="text-xs">انتخاب از لیست تست ها</Label>
              <Select
                value={testDraft.catalog_id ? String(testDraft.catalog_id) : undefined}
                onValueChange={handleCatalogChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="یک تست انتخاب کنید" />
                </SelectTrigger>
                <SelectContent>
                  {(testsCatalog || []).map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.id}. {item.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs">عنوان تست</Label>
              <Input value={testDraft.title} onChange={(e) => setTestDraft((p) => ({ ...p, title: e.target.value }))} />
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs">لینک تست</Label>
              <Input value={testDraft.url} onChange={(e) => setTestDraft((p) => ({ ...p, url: e.target.value }))} dir="ltr" />
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs">خلاصه نتیجه</Label>
              <Textarea
                value={testDraft.result_summary}
                onChange={(e) => setTestDraft((p) => ({ ...p, result_summary: e.target.value }))}
                placeholder="در صورت خالی بودن، بعد از آپلود PDF خلاصه به صورت خودکار تولید می شود."
                className="min-h-[110px]"
              />
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs">فایل نتیجه (PDF)</Label>
              <Input type="file" accept="application/pdf" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
              {selectedFile && <div className="text-[10px] text-muted-foreground">{selectedFile.name}</div>}
            </div>
          </div>

          <DialogFooter>
            <Button onClick={upsertTest} disabled={testSaving || testUploading} className="w-full gap-2 sm:w-auto">
              {testSaving || testUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {testUploading ? "در حال آپلود و خلاصه سازی..." : "ذخیره تست"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
