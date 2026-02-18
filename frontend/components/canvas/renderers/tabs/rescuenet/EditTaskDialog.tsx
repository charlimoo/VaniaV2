"use client";

import { useState } from "react";
import { Pencil, Loader2, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { RescueTask, RescueDimension } from "@/lib/types/vania";

interface Props {
  task: RescueTask;
  patientId: number;
  onSuccess: (updatedTask: RescueTask) => void;
}

const DIMENSIONS: { key: RescueDimension; label: string }[] = [
  { key: "PERSONAL", label: "رشد شخصی" },
  { key: "EMOTIONAL", label: "رشد عاطفی" },
  { key: "RELATIONSHIP", label: "ارتباط سودمند" },
  { key: "FRIENDSHIP", label: "ارتباط با دوستان" },
  { key: "CAREER", label: "شغلی-تحصیلی" },
  { key: "INTELLECTUAL", label: "رشد فکری" },
  { key: "ENVIRONMENT", label: "رشد محیطی" },
  { key: "RECREATION", label: "تفریحی-ورزشی" },
  { key: "SOLITUDE", label: "مدیریت تنهایی" },
];

export function EditTaskDialog({ task, patientId, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ 
    text: task.text, 
    dimension: task.dimension,
    due_date: task.due_date || ""
  });

  const handleSubmit = async () => {
    if (!formData.text.trim()) {
      toast.error("عنوان تکلیف الزامی است.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/vania/tasks/manage/${task.id}/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          patient_id: patientId,
          text: formData.text,
          dimension: formData.dimension, // Note: Backend edit might not support dimension change yet, but UI allows it
          due_date: formData.due_date || null
        }),
      });

      if (!res.ok) throw new Error("خطا در ویرایش تکلیف.");

      toast.success("تکلیف ویرایش شد.");
      setOpen(false);
      
      onSuccess({
        ...task,
        text: formData.text,
        dimension: formData.dimension,
        due_date: formData.due_date
      });

    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary">
            <Pencil className="w-3 h-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md" dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle>ویرایش تکلیف</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label className="text-xs">عنوان تکلیف</Label>
            <Input 
                value={formData.text} 
                onChange={(e) => setFormData({...formData, text: e.target.value})} 
            />
          </div>
          <div className="grid gap-2">
            <Label className="text-xs">مهلت انجام</Label>
            <Input 
                type="date" 
                value={formData.due_date} 
                onChange={(e) => setFormData({...formData, due_date: e.target.value})} 
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={loading} className="w-full gap-2 sm:w-auto">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            ذخیره تغییرات
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
