"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { pdf } from "@react-pdf/renderer";
import { saveAs } from "file-saver";
import { ThoughtAppendix } from "@/lib/types/vania";
import { AppendixPDF } from "./AppendixPDF";

interface Props {
  library: ThoughtAppendix;
  patientId: number;
  patientName?: string;
  caseTitle?: string;
}

const safeFilePart = (value: string | number | undefined) =>
  String(value || "report").replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_");

export function AppendixDownloadButton({ library, patientId, patientName, caseTitle }: Props) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    const toastId = toast.loading("در حال آماده‌سازی PDF پیوست اندیشه...");
    try {
      const blob = await pdf(
        <AppendixPDF library={library} patientId={patientId} patientName={patientName} caseTitle={caseTitle} />,
      ).toBlob();
      const fileName = `Vania_Appendix_${safeFilePart(patientName || patientId)}.pdf`;
      saveAs(blob, fileName);
      toast.dismiss(toastId);
      toast.success("گزارش پیوست اندیشه دانلود شد.");
    } catch (e) {
      console.error("Appendix PDF generation failed:", e);
      toast.dismiss(toastId);
      toast.error("خطا در تولید PDF پیوست اندیشه.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="ghost" size="sm" className="gap-1.5 h-9 text-xs" onClick={handleDownload} disabled={loading}>
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
      دانلود PDF
    </Button>
  );
}
