// frontend/components/canvas/renderers/tabs/roadmap/DownloadButton.tsx
"use client";

import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";

// --- React-PDF & File Saving Imports ---
// These are necessary for generating the PDF blob and triggering the download.
import { pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';

// --- Component Imports ---
// The PDF template component we created earlier.
import { SessionPDF } from "./SessionPDF";

// --- Props Interface ---
interface Props {
  // The structured session report JSON data.
  data: any; 
  // The name of the patient for the PDF filename.
  patientName: string;
}

/**
 * Renders a button that, when clicked, generates a professional PDF of the 
 * session support document on the client-side and initiates a download.
 * It provides loading and success/error feedback to the user.
 */
export function DownloadButton({ data, patientName }: Props) {
  const [loading, setLoading] = useState(false);

  /**
   * Handles the PDF generation and download process.
   */
  const handleDownload = async () => {
    setLoading(true);
    const toastId = toast.loading("در حال آماده‌سازی سند PDF...");

    try {
      // 1. Generate the PDF blob using @react-pdf/renderer.
      // We pass the data and patient name to our PDF template component.
      const blob = await pdf(
        <SessionPDF 
            data={data} 
            patientName={patientName} 
        />
      ).toBlob();
      
      // 2. Use file-saver to trigger the browser's download functionality.
      // We create a user-friendly filename.
      const fileName = `Vania_Session_Report_${data.session_number || 'draft'}_${patientName.replace(/\s/g,'_')}.pdf`;
      saveAs(blob, fileName);

      // 3. Provide success feedback.
      toast.dismiss(toastId);
      toast.success("سند PDF با موفقیت دانلود شد.");

    } catch (e) {
      // 4. Handle errors gracefully.
      console.error("PDF generation failed:", e);
      toast.dismiss(toastId);
      toast.error("خطا در تولید PDF. ممکن است فونت فارسی بارگذاری نشده باشد.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={handleDownload} 
      disabled={loading}
      className="gap-2 h-8 text-xs"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <FileDown className="w-3.5 h-3.5" />
      )}
      دانلود نسخه چاپی
    </Button>
  );
}