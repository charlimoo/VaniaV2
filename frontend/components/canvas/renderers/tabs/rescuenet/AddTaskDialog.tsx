// start of frontend/components/canvas/renderers/tabs/rescuenet/AddTaskDialog.tsx
"use client";

import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
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
  patientId: number;
  onSuccess: (task: RescueTask) => void;
  trigger?: React.ReactNode;
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

export function AddTaskDialog({ patientId, onSuccess, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ 
    text: "", 
    dimension: "PERSONAL" as RescueDimension,
    due_date: ""
  });

  const handleSubmit = async () => {
    if (!formData.text.trim()) {
      toast.error("عنوان تکلیف الزامی است.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/vania/tasks/manage/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          patient_id: patientId,
          text: formData.text,
          dimension: formData.dimension,
          due_date: formData.due_date || null
        }),
      });

      if (!res.ok) throw new Error("خطا در ثبت تکلیف.");

      const newTask: RescueTask = await res.json();
      toast.success("تکلیف جدید ثبت شد.");
      setOpen(false);
      setFormData({ text: "", dimension: "PERSONAL", due_date: "" });
      onSuccess(newTask);

    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" variant="outline" className="gap-2">
            <Plus className="w-3.5 h-3.5" /> افزودن تکلیف
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md" dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle>افزودن تکلیف (تور نجات)</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label className="text-xs">عنوان تکلیف</Label>
            <Input 
                value={formData.text} 
                onChange={(e) => setFormData({...formData, text: e.target.value})} 
                placeholder="مثال: مطالعه کتاب به مدت ۲۰ دقیقه"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
                <Label className="text-xs">بعد زندگی</Label>
                <Select value={formData.dimension} onValueChange={(v) => setFormData({...formData, dimension: v as RescueDimension})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {DIMENSIONS.map(d => (
                            <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="grid gap-2">
                <Label className="text-xs">مهلت انجام (اختیاری)</Label>
                <Input 
                    type="date" 
                    value={formData.due_date} 
                    onChange={(e) => setFormData({...formData, due_date: e.target.value})} 
                />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={loading} className="w-full sm:w-auto">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "ثبت تکلیف"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
