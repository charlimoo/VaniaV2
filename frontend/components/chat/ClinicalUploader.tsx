// frontend/components/chat/ClinicalUploader.tsx
"use client";

import { useState, useRef } from "react";
import { useAssistantRuntime } from "@assistant-ui/react";
import { 
  UploadCloud, 
  Loader2, 
  ScanEye 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";

// --- Props Interface ---
interface Props {
  disabled?: boolean;
}

/**
 * Renders a modal dialog for uploading clinical assets like Rorschach/TAT test images or PDFs.
 * This is a key component for initiating the agent's Phase 1 (Analysis) workflow.
 * After uploading, it sends a hidden system message to the agent, instructing it to
 * call the `analyze_projective_tests` tool with the uploaded file IDs.
 */
export function ClinicalUploader({ disabled }: Props) {
  // --- State Hooks ---
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  
  // --- Refs & Hooks ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const runtime = useAssistantRuntime();

  // --- Event Handler ---
  const handleUploadAndAnalyze = async () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      toast.error("لطفاً حداقل یک فایل را برای تحلیل انتخاب کنید.");
      return;
    }

    setUploading(true);
    const toastId = toast.loading(`در حال آپلود ${selectedFiles.length} فایل...`);
    const uploadedFileIds: string[] = [];

    try {
      // 1. Upload files to a dedicated endpoint
      // This endpoint should handle file storage (e.g., S3, local) and return unique IDs.
      for (const file of Array.from(selectedFiles)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("purpose", "PROJECTIVE_TEST"); // Optional metadata

        const res = await fetch(`${API_BASE_URL}/agent/upload`, { // Assuming a generic upload endpoint
          method: "POST",
          headers: getAuthHeaders(), // Do NOT set Content-Type for FormData
          body: formData
        });

        if (!res.ok) {
          throw new Error(`آپلود فایل ${file.name} با خطا مواجه شد.`);
        }
        
        const data = await res.json();
        if (data.file_id) {
          uploadedFileIds.push(data.file_id);
        }
      }
      
      toast.dismiss(toastId);
      toast.success("آپلود کامل شد. تحلیل آغاز می‌شود...");

      // 2. Trigger the Agent's Analysis Tool
      // We send a hidden system message that contains the tool call information.
      const fileListStr = uploadedFileIds.join(", ");
      const systemMessage = `[SYSTEM: CLINICAL_ASSETS_UPLOADED]
Please call the 'analyze_projective_tests' tool with the following file IDs:
file_ids: [${uploadedFileIds.map(id => `"${id}"`).join(", ")}]`;

      runtime.thread.append({
        role: "user", // Sent as 'user' so the agent processes it
        content: [{ type: "text", text: systemMessage }]
      });

      // 3. Reset UI State
      setOpen(false);
      setSelectedFiles(null);

    } catch (e: any) {
      toast.dismiss(toastId);
      toast.error(e.message || "خطا در آپلود فایل‌ها.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="icon" 
          className="rounded-full h-8 w-8 text-indigo-600 border-indigo-200 bg-indigo-50 hover:bg-indigo-100"
          title="آپلود تست‌های بالینی (Rorschach/TAT)"
          disabled={disabled}
        >
          <ScanEye className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle className="flex items-center gap-2">
            <ScanEye className="w-5 h-5 text-primary"/>
            تحلیل تست‌های فرافکن
          </DialogTitle>
          <DialogDescription>
            تصاویر کارت‌های Rorschach، TAT یا سایر اسناد بالینی را برای شروع فاز ۱ آپلود کنید.
          </DialogDescription>
        </DialogHeader>

        {/* --- Dropzone Area --- */}
        <div 
            className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-muted/5 transition-colors"
            onClick={() => fileInputRef.current?.click()}
        >
            <input 
                type="file" 
                multiple 
                accept="image/png, image/jpeg, application/pdf" 
                className="hidden" 
                ref={fileInputRef}
                onChange={(e) => setSelectedFiles(e.target.files)}
            />
            
            <div className="bg-primary/10 p-3 rounded-full mb-3">
                <UploadCloud className="w-6 h-6 text-primary" />
            </div>
            
            {selectedFiles && selectedFiles.length > 0 ? (
                <div className="text-sm font-medium">
                    {selectedFiles.length} فایل برای آپلود انتخاب شد.
                    <p className="text-xs text-muted-foreground mt-1">برای تغییر انتخاب کلیک کنید.</p>
                </div>
            ) : (
                <div className="space-y-1">
                    <p className="text-sm font-medium">فایل‌ها را اینجا بکشید یا برای انتخاب کلیک کنید</p>
                    <p className="text-xs text-muted-foreground">پشتیبانی از PDF, JPG, PNG</p>
                </div>
            )}
        </div>

        <DialogFooter>
            <Button onClick={handleUploadAndAnalyze} disabled={uploading || !selectedFiles} className="w-full gap-2">
                {uploading ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" /> در حال آپلود و ارسال برای تحلیل...
                    </>
                ) : (
                    "آپلود و شروع تحلیل"
                )}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}