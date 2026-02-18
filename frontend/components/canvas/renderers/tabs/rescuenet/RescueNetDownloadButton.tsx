"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { pdf } from "@react-pdf/renderer";
import { saveAs } from "file-saver";
import { RescueTask } from "@/lib/types/vania";
import { RescueNetPDF } from "./RescueNetPDF";

interface Props {
  tasks: RescueTask[];
  patientId: number;
}

export function RescueNetDownloadButton({ tasks, patientId }: Props) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    const toastId = toast.loading("در حال آماده‌سازی PDF تور نجات...");

    try {
      const blob = await pdf(<RescueNetPDF tasks={tasks} patientId={patientId} />).toBlob();
      const fileName = `Vania_RescueNet_${patientId}.pdf`;
      saveAs(blob, fileName);
      toast.dismiss(toastId);
      toast.success("گزارش تور نجات دانلود شد.");
    } catch (e) {
      console.error("RescueNet PDF generation failed:", e);
      toast.dismiss(toastId);
      toast.error("خطا در تولید PDF تور نجات.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="ghost" size="sm" className="gap-1.5 h-9" onClick={handleDownload} disabled={loading}>
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
      دانلود
    </Button>
  );
}

