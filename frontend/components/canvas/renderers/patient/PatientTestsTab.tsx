"use client";

import { useEffect, useState } from "react";
import { FlaskConical, Upload, Download, Loader2, Link2 } from "lucide-react";
import { toast } from "sonner";
import { ClinicalTestEntry } from "@/lib/types/vania";
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
  onEdit: (delta: any) => void;
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

export function PatientTestsTab({ tests, selectedDoctorId, onEdit }: Props) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [activeTest, setActiveTest] = useState<ClinicalTestEntry | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [resultSummary, setResultSummary] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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
          },
        });
        if (!res.ok) return;
        const body = await res.json();
        if (!ignore && Array.isArray(body?.tests)) {
          onEdit({ tests: body.tests });
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
  }, [selectedDoctorId]);

  const openUpload = (test: ClinicalTestEntry) => {
    setActiveTest(test);
    setResultSummary(test.result_summary || "");
    setSelectedFile(null);
    setUploadOpen(true);
  };

  const uploadFile = async () => {
    if (!activeTest?.id) return;
    if (!selectedFile) {
      toast.error("لطفا فایل PDF را انتخاب کنید.");
      return;
    }

    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      fd.append("result_summary", resultSummary || "");
      fd.append("auto_summarize", "true");

      const res = await fetch(`${API_BASE_URL}/api/vania/tests/${activeTest.id}/file/`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          ...(selectedDoctorId ? { "X-Target-Expert-ID": String(selectedDoctorId) } : {}),
          ...(selectedDoctorId ? { "X-Target-Doctor-ID": String(selectedDoctorId) } : {}),
        },
        body: fd,
      });

      if (!res.ok) {
        let errorText = "آپلود فایل ناموفق بود.";
        try {
          const body = await res.json();
          if (body?.error) errorText = body.error;
        } catch {}
        throw new Error(errorText);
      }

      const updated = await res.json();
      onEdit({ tests: (tests || []).map((t) => (t.id === activeTest.id ? updated : t)) });
      toast.success("فایل تست با موفقیت ثبت شد.");
      setUploadOpen(false);
    } catch (e: any) {
      toast.error(e.message || "خطا در آپلود فایل.");
    } finally {
      setIsUploading(false);
    }
  };

  const downloadTestFile = async (testId: string, fallbackName?: string | null) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/vania/tests/${testId}/file/download/`, {
        method: "GET",
        headers: {
          ...getAuthHeaders(),
          ...(selectedDoctorId ? { "X-Target-Expert-ID": String(selectedDoctorId) } : {}),
          ...(selectedDoctorId ? { "X-Target-Doctor-ID": String(selectedDoctorId) } : {}),
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
        هنوز تستی توسط متخصص ثبت نشده است.
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10 animate-in fade-in slide-in-from-right-2 duration-300 font-sans">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
          <FlaskConical className="w-4 h-4 text-primary" />
          تست های من
        </h3>
        <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
          {tests.length} مورد
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {tests.map((test) => {
          const missingSummary = !test.result_summary?.trim();
          const missingFile = !test.file_name;
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
                    آپلود نتیجه
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
                {test.file_name && (
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => downloadTestFile(test.id, test.file_name)}>
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent dir="rtl" className="w-[calc(100vw-2rem)] max-w-xl">
          <DialogHeader className="text-right">
            <DialogTitle>آپلود نتیجه تست</DialogTitle>
            <DialogDescription>
              فایل PDF را آپلود کنید. اگر خلاصه را خالی بگذارید، خلاصه به صورت خودکار تولید می شود.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-1.5">
              <Label className="text-xs">خلاصه نتیجه (اختیاری)</Label>
              <Textarea
                value={resultSummary}
                onChange={(e) => setResultSummary(e.target.value)}
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
