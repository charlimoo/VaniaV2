"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileImage, FileText, Loader2, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { useUser } from "@/hooks/use-user";
import { CaseFileEntry } from "@/lib/types/vania";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  files: CaseFileEntry[];
  selectedDoctorId?: number | null;
  selectedCaseId?: string;
  patientId?: number;
  onEdit: (delta: any) => void;
  readOnly?: boolean;
}

const PAGE_SIZE = 8;

const toJalali = (isoDateString?: string) => {
  if (!isoDateString) return "-";
  try {
    if (isoDateString.startsWith("13") || isoDateString.startsWith("14")) return isoDateString;
    return new Date(isoDateString).toLocaleDateString("fa-IR");
  } catch {
    return isoDateString;
  }
};

const formatBytes = (value?: number) => {
  const size = Number(value || 0);
  if (!size) return "-";
  if (size < 1024) return `${size} بایت`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} کیلوبایت`;
  return `${(size / (1024 * 1024)).toFixed(1)} مگابایت`;
};

const typeLabel = (file: CaseFileEntry) => {
  const ext = (file.file_extension || "").replace(".", "").toUpperCase();
  return ext || file.content_type || "FILE";
};

const extractionLabel = (status?: string) => {
  switch (status) {
    case "READY":
      return "قابل خواندن";
    case "UNSUPPORTED":
      return "فقط دانلود";
    case "FAILED":
      return "استخراج ناموفق";
    default:
      return "در حال آماده سازی";
  }
};

const uploaderLabel = (role?: string) => role === "EXPERT" ? "متخصص" : "مراجع";

const isImage = (contentType?: string, ext?: string) =>
  Boolean(contentType?.startsWith("image/") || [".png", ".jpg", ".jpeg", ".webp"].includes((ext || "").toLowerCase()));

export function CaseFilesTab({ files, selectedDoctorId, selectedCaseId, patientId, onEdit, readOnly = false }: Props) {
  const { user } = useUser();
  const resolvedPatientId = patientId || user?.id;
  const [isLoading, setIsLoading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const onEditRef = useRef(onEdit);
  const filesRef = useRef(files);

  useEffect(() => {
    onEditRef.current = onEdit;
  }, [onEdit]);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCaseId, query]);

  useEffect(() => {
    if (!selectedCaseId || !selectedDoctorId) return;
    let ignore = false;

    const loadFiles = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          case_id: selectedCaseId,
          page: "1",
          page_size: "100",
        });
        if (resolvedPatientId && patientId) {
          params.set("patient_id", String(resolvedPatientId));
        }
        const res = await fetch(`${API_BASE_URL}/api/vania/case-files/?${params.toString()}`, {
          headers: {
            ...getAuthHeaders(),
            "X-Target-Doctor-ID": String(selectedDoctorId),
            "X-Target-Expert-ID": String(selectedDoctorId),
            "X-Target-Case-ID": String(selectedCaseId),
          },
        });
        if (!res.ok) return;
        const body = await res.json();
        if (!ignore && Array.isArray(body?.items)) {
          const nextSerialized = JSON.stringify(body.items);
          const currentSerialized = JSON.stringify(filesRef.current || []);
          if (nextSerialized !== currentSerialized) {
            onEditRef.current({ files: body.items });
          }
        }
      } catch {
      } finally {
        if (!ignore) setIsLoading(false);
      }
    };

    loadFiles();
    return () => {
      ignore = true;
    };
  }, [patientId, resolvedPatientId, selectedCaseId, selectedDoctorId]);

  const filteredFiles = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return files || [];
    return (files || []).filter((item) =>
      `${item.name} ${item.description || ""} ${item.original_file_name}`.toLowerCase().includes(normalized)
    );
  }, [files, query]);

  const totalPages = Math.max(1, Math.ceil(filteredFiles.length / PAGE_SIZE));
  const pageItems = filteredFiles.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const resetUpload = () => {
    setName("");
    setDescription("");
    setSelectedFile(null);
  };

  const openUpload = () => {
    resetUpload();
    setUploadOpen(true);
  };

  const uploadFile = async () => {
    if (!selectedCaseId || !selectedDoctorId) {
      toast.error("ابتدا پرونده فعال را انتخاب کنید.");
      return;
    }
    if (!name.trim()) {
      toast.error("نام فایل الزامی است.");
      return;
    }
    if (!selectedFile) {
      toast.error("فایل را انتخاب کنید.");
      return;
    }

    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append("name", name.trim());
      fd.append("description", description.trim());
      fd.append("case_id", selectedCaseId);
      fd.append("file", selectedFile);
      if (patientId && resolvedPatientId) {
        fd.append("patient_id", String(resolvedPatientId));
      }

      const res = await fetch(`${API_BASE_URL}/api/vania/case-files/`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "X-Target-Doctor-ID": String(selectedDoctorId),
          "X-Target-Expert-ID": String(selectedDoctorId),
          "X-Target-Case-ID": String(selectedCaseId),
        },
        body: fd,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "آپلود فایل ناموفق بود.");
      }
      const created = await res.json();
      onEdit({ files: [created, ...(files || [])] });
      setUploadOpen(false);
      resetUpload();
      toast.success("فایل با موفقیت ثبت شد.");
    } catch (error: any) {
      toast.error(error?.message || "خطا در آپلود فایل.");
    } finally {
      setIsUploading(false);
    }
  };

  const deleteFile = async (fileId: string) => {
    if (!selectedCaseId || !selectedDoctorId) return;
    const ok = confirm("این فایل حذف شود؟");
    if (!ok) return;
    try {
      const params = new URLSearchParams({ case_id: selectedCaseId });
      if (patientId && resolvedPatientId) {
        params.set("patient_id", String(resolvedPatientId));
      }
      const res = await fetch(`${API_BASE_URL}/api/vania/case-files/${fileId}/?${params.toString()}`, {
        method: "DELETE",
        headers: {
          ...getAuthHeaders(),
          "X-Target-Doctor-ID": String(selectedDoctorId),
          "X-Target-Expert-ID": String(selectedDoctorId),
          "X-Target-Case-ID": String(selectedCaseId),
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "حذف فایل ناموفق بود.");
      }
      onEdit({ files: (files || []).filter((item) => item.id !== fileId) });
      toast.success("فایل حذف شد.");
    } catch (error: any) {
      toast.error(error?.message || "خطا در حذف فایل.");
    }
  };

  const downloadFile = async (fileId: string, fallbackName: string) => {
    if (!selectedCaseId || !selectedDoctorId) return;
    try {
      const params = new URLSearchParams({ case_id: selectedCaseId });
      if (patientId && resolvedPatientId) {
        params.set("patient_id", String(resolvedPatientId));
      }
      const res = await fetch(`${API_BASE_URL}/api/vania/case-files/${fileId}/download/?${params.toString()}`, {
        headers: {
          ...getAuthHeaders(),
          "X-Target-Doctor-ID": String(selectedDoctorId),
          "X-Target-Expert-ID": String(selectedDoctorId),
          "X-Target-Case-ID": String(selectedCaseId),
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "دانلود فایل ناموفق بود.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fallbackName || "case-file";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error(error?.message || "خطا در دانلود فایل.");
    }
  };

  return (
    <div className="space-y-5 pb-10 animate-in fade-in slide-in-from-right-2 duration-300">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">مدیریت فایل‌ها</h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            فایل‌های مشترک این پرونده را اینجا نگه دارید تا شما و عامل هوشمند بتوانید به آن‌ها مراجعه کنید.
          </p>
        </div>
        {!readOnly ? (
          <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={openUpload}>
            <Upload className="h-3.5 w-3.5" />
            افزودن فایل
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جستجوی نام، توضیح یا نام اصلی فایل..." className="pr-9" />
        </div>
        <Badge variant="outline" className="text-[10px] font-normal">
          {filteredFiles.length} فایل
        </Badge>
      </div>

      {isLoading && !(files?.length || 0) ? (
        <div className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">
          در حال بارگذاری فایل‌ها...
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/10 px-4 text-sm text-muted-foreground">
          هنوز فایلی برای این پرونده ثبت نشده است.
        </div>
      ) : (
        <div className="space-y-3">
          {pageItems.map((file) => (
            <div key={file.id} className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    {isImage(file.content_type, file.file_extension) ? (
                      <FileImage className="h-4 w-4 text-primary" />
                    ) : (
                      <FileText className="h-4 w-4 text-primary" />
                    )}
                    <span className="truncate">{file.name}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {file.original_file_name}
                  </div>
                  {file.description ? (
                    <p className="mt-2 text-[12px] leading-6 text-foreground/80">{file.description}</p>
                  ) : null}
                </div>

                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => downloadFile(file.id, file.original_file_name)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  {!readOnly ? (
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteFile(file.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                <Badge variant="secondary" className="text-[10px]">{typeLabel(file)}</Badge>
                <Badge variant="outline" className="text-[10px]">{extractionLabel(file.extraction_status)}</Badge>
                <span>بارگذار: {uploaderLabel(file.uploaded_by_role)}</span>
                <span>تاریخ: {toJalali(file.uploaded_at)}</span>
                <span>حجم: {formatBytes(file.size_bytes)}</span>
                {file.text_stats?.readable ? (
                  <span>بخش‌ها: {file.text_stats.total_chunks}</span>
                ) : null}
              </div>
            </div>
          ))}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button size="sm" variant="outline" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
                قبلی
              </Button>
              <span className="text-xs text-muted-foreground">
                صفحه {currentPage.toLocaleString("fa-IR")} از {totalPages.toLocaleString("fa-IR")}
              </span>
              <Button size="sm" variant="outline" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
                بعدی
              </Button>
            </div>
          )}
        </div>
      )}

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent dir="rtl" className="w-[calc(100vw-2rem)] max-w-xl">
          <DialogHeader className="text-right">
            <DialogTitle>افزودن فایل جدید</DialogTitle>
            <DialogDescription>
              نام فایل الزامی است. می‌توانید توضیح کوتاه هم اضافه کنید تا مرور فایل‌ها آسان‌تر شود.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-1.5">
              <Label className="text-xs">نام فایل</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلا: نتایج تست اسفند" />
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs">توضیح فایل</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="توضیح کوتاه درباره محتوا یا کاربرد فایل"
                className="min-h-[110px]"
              />
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs">فایل</Label>
              <Input
                type="file"
                accept=".pdf,.txt,.doc,.docx,.png,.jpg,.jpeg,.webp"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
              {selectedFile ? (
                <div className="text-[11px] text-muted-foreground">
                  {selectedFile.name} • {formatBytes(selectedFile.size)}
                </div>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button onClick={uploadFile} disabled={isUploading} className="w-full gap-2 sm:w-auto">
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {isUploading ? "در حال آپلود..." : "ثبت فایل"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
