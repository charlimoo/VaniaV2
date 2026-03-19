"use client";

import { useEffect, useRef, useState } from "react";
import { FlaskConical, Upload, Download, Loader2, Link2 } from "lucide-react";
import { toast } from "sonner";
import { ClinicalTestAttachment, ClinicalTestEntry } from "@/lib/types/vania";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";

interface Props {
  tests: ClinicalTestEntry[];
  selectedDoctorId?: number | null;
  selectedCaseId?: string;
  onEdit: (delta: any) => void;
  title?: string;
  createLabel?: string;
  emptyText?: string;
}

const toJalali = (isoDateString?: string) => {
  if (!isoDateString) return "-";
  try {
    if (isoDateString.startsWith("13") || isoDateString.startsWith("14")) return isoDateString;
    return new Date(isoDateString).toLocaleDateString("fa-IR");
  } catch {
    return isoDateString;
  }
};

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

export function PatientTestsTab({
  tests,
  selectedDoctorId,
  selectedCaseId,
  onEdit,
  title = "تست های من",
  createLabel = "آپلود نتیجه",
  emptyText = "هنوز تستی توسط متخصص ثبت نشده است.",
}: Props) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [activeTest, setActiveTest] = useState<ClinicalTestEntry | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [resultSummary, setResultSummary] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const onEditRef = useRef(onEdit);
  const testsRef = useRef(tests);

  useEffect(() => {
    onEditRef.current = onEdit;
  }, [onEdit]);

  useEffect(() => {
    testsRef.current = tests;
  }, [tests]);

  useEffect(() => {
    let ignore = false;

    const loadTests = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/vania/tests/`, {
          method: "GET",
          headers: {
            ...getAuthHeaders(),
            ...(selectedDoctorId ? { "X-Target-Expert-ID": String(selectedDoctorId) } : {}),
            ...(selectedDoctorId ? { "X-Target-Doctor-ID": String(selectedDoctorId) } : {}),
            ...(selectedCaseId ? { "X-Target-Case-ID": String(selectedCaseId) } : {}),
          },
        });
        if (!res.ok) return;
        const body = await res.json();
        if (!ignore && Array.isArray(body?.tests)) {
          const nextSerialized = JSON.stringify(body.tests);
          const currentSerialized = JSON.stringify(testsRef.current || []);
          if (nextSerialized !== currentSerialized) {
            onEditRef.current({ tests: body.tests });
          }
        }
      } catch {
      } finally {
        if (!ignore) setIsLoading(false);
      }
    };

    loadTests();
    return () => {
      ignore = true;
    };
  }, [selectedDoctorId, selectedCaseId]);

  const openUpload = (test: ClinicalTestEntry) => {
    setActiveTest(test);
    setResultSummary(test.result_text || test.result_summary || "");
    setSelectedFiles([]);
    setUploadOpen(true);
  };

  const uploadFile = async () => {
    if (!activeTest?.id) return;
    if (selectedFiles.length === 0 && !resultSummary.trim()) {
      toast.error("متن نتیجه یا فایل را ثبت کنید.");
      return;
    }

    setIsUploading(true);
    try {
      let nextTests = [...(tests || [])];
      if (resultSummary.trim() !== (activeTest.result_text || activeTest.result_summary || "").trim()) {
        const updateRes = await fetch(`${API_BASE_URL}/api/vania/tests/${activeTest.id}/`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
            ...(selectedDoctorId ? { "X-Target-Expert-ID": String(selectedDoctorId) } : {}),
            ...(selectedDoctorId ? { "X-Target-Doctor-ID": String(selectedDoctorId) } : {}),
            ...(selectedCaseId ? { "X-Target-Case-ID": String(selectedCaseId) } : {}),
          },
          body: JSON.stringify({
            result_text: resultSummary,
            result_summary: resultSummary,
            case_id: selectedCaseId,
          }),
        });
        if (!updateRes.ok) throw new Error("ذخیره متن نتیجه ناموفق بود.");
        const updated = await updateRes.json();
        nextTests = nextTests.map((t) => (t.id === activeTest.id ? updated : t));
      }

      if (selectedFiles.length === 0) {
        onEdit({ tests: nextTests });
        toast.success("نتیجه تست با موفقیت ذخیره شد.");
        setUploadOpen(false);
        return;
      }

      let latestTest = nextTests.find((t) => t.id === activeTest.id) || null;
      for (const file of selectedFiles) {
        const fd = new FormData();
        fd.append("file", file);
        if (selectedCaseId) fd.append("case_id", selectedCaseId);

        const res = await fetch(`${API_BASE_URL}/api/vania/tests/${activeTest.id}/file/`, {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
            ...(selectedDoctorId ? { "X-Target-Expert-ID": String(selectedDoctorId) } : {}),
            ...(selectedDoctorId ? { "X-Target-Doctor-ID": String(selectedDoctorId) } : {}),
            ...(selectedCaseId ? { "X-Target-Case-ID": String(selectedCaseId) } : {}),
          },
          body: fd,
        });

        if (!res.ok) {
          let errorText = `آپلود فایل «${file.name}» ناموفق بود.`;
          try {
            const body = await res.json();
            if (body?.error) errorText = body.error;
          } catch {}
          throw new Error(errorText);
        }

        latestTest = await res.json();
        nextTests = nextTests.map((t) => (t.id === activeTest.id ? latestTest! : t));
      }

      onEdit({ tests: nextTests });
      toast.success("نتیجه تست با موفقیت ثبت شد.");
      setUploadOpen(false);
    } catch (e: any) {
      toast.error(e.message || "خطا در آپلود فایل.");
    } finally {
      setIsUploading(false);
    }
  };

  const downloadTestFile = async (testId: string, attachmentId?: string, fallbackName?: string | null) => {
    try {
      const query = new URLSearchParams();
      if (attachmentId) query.set("attachment_id", attachmentId);
      const res = await fetch(`${API_BASE_URL}/api/vania/tests/${testId}/file/download/${query.toString() ? `?${query.toString()}` : ""}`, {
        method: "GET",
        headers: {
          ...getAuthHeaders(),
          ...(selectedDoctorId ? { "X-Target-Expert-ID": String(selectedDoctorId) } : {}),
          ...(selectedDoctorId ? { "X-Target-Doctor-ID": String(selectedDoctorId) } : {}),
          ...(selectedCaseId ? { "X-Target-Case-ID": String(selectedCaseId) } : {}),
        },
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

  if (isLoading && !tests?.length) {
    return (
      <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl bg-muted/5">
        در حال بارگذاری تست ها...
      </div>
    );
  }

  if (!tests?.length) {
    return (
      <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl bg-muted/5">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10 animate-in fade-in slide-in-from-right-2 duration-300 font-sans">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
          <FlaskConical className="w-4 h-4 text-primary" />
          {title}
        </h3>
        <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
          {tests.length} مورد
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {tests.map((test) => {
          const attachments = getTestAttachments(test);
          const resultText = test.result_text || test.result_summary || "";
          const missingSummary = !resultText.trim();
          const missingFile = attachments.length === 0;
          const isTodo = missingSummary || missingFile;

          return (
            <div key={test.id} className="rounded-xl border bg-card p-3 shadow-sm space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <div className="truncate text-xs font-bold flex items-center gap-2">
                    <span className="truncate">{test.title}</span>
                    {isTodo && (
                      <Badge variant="secondary" className="text-[10px]">
                        در انتظار تکمیل
                      </Badge>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{toJalali(test.created_at)}</div>
                </div>

                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => openUpload(test)}>
                    <Upload className="w-3.5 h-3.5 ml-1" />
                    {createLabel}
                  </Button>
                </div>
              </div>

              {test.url && (
                <a href={test.url} target="_blank" rel="noreferrer" className="text-[11px] text-primary inline-flex items-center gap-1.5 break-all">
                  <Link2 className="w-3 h-3" /> لینک تست
                </a>
              )}

              <div className="text-[11px] text-foreground/80 leading-relaxed bg-muted/20 rounded p-2 min-h-[56px] whitespace-pre-wrap">
                {resultText || "متن نتیجه ثبت نشده است."}
              </div>

              <div className="space-y-2 pt-1">
                <div className="text-[10px] text-muted-foreground">فایل‌ها: {attachments.length}</div>
                {attachments.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {attachments.map((attachment) => (
                      <div key={attachment.id} className="rounded-xl border border-border/60 bg-muted/10 px-3 py-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 text-[10px] text-muted-foreground">
                            <div className="truncate font-medium text-foreground">{attachment.file_name}</div>
                            <div className="mt-1">{toJalali(attachment.file_uploaded_at || "")}</div>
                            <div className="mt-1">{attachment.content_type?.includes("pdf") ? "PDF" : "تصویر"}</div>
                          </div>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => downloadTestFile(test.id, attachment.id, attachment.file_name)}>
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[10px] text-muted-foreground">هنوز فایلی ثبت نشده است.</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent dir="rtl" className="w-[calc(100vw-2rem)] max-w-xl">
          <DialogHeader className="text-right">
            <DialogTitle>{createLabel}</DialogTitle>
            <DialogDescription>
              متن نتیجه را ثبت کنید و در صورت نیاز فایل PDF یا تصویر اضافه کنید.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-1.5">
              <Label className="text-xs">متن نتیجه</Label>
              <Textarea
                value={resultSummary}
                onChange={(e) => setResultSummary(e.target.value)}
                className="min-h-[110px]"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">فایل‌های نتیجه (PDF یا تصویر)</Label>
              <Input type="file" multiple accept="application/pdf,image/*" onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))} />
              {selectedFiles.length > 0 && (
                <div className="rounded-lg border border-border/60 bg-muted/10 p-2">
                  <div className="mb-2 text-[10px] text-muted-foreground">{selectedFiles.length} فایل انتخاب شده</div>
                  <div className="grid gap-1">
                    {selectedFiles.map((file) => (
                      <div key={`${file.name}-${file.size}`} className="truncate text-[10px] text-foreground/80">
                        {file.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button onClick={uploadFile} disabled={isUploading} className="w-full gap-2 sm:w-auto">
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {isUploading ? "در حال آپلود..." : "ثبت فایل"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
