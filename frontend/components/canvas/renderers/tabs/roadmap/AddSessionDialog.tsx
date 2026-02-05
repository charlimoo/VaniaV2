// start of frontend/components/canvas/renderers/tabs/roadmap/AddSessionDialog.tsx
"use client";

import { useState } from "react";
import { Plus, Loader2, BookText, Lightbulb } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { RoadmapSession } from "@/lib/types/vania";

// --- Props Interface ---
interface Props {
  patientId: number;
  onSuccess: (session: RoadmapSession) => void; // [FIX] Updated signature
  trigger?: React.ReactNode;
}

export function AddSessionDialog({ patientId, onSuccess, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ title: "", instructions: "" });

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast.error("موضوع جلسه نمی‌تواند خالی باشد.");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("در حال افزودن جلسه به نقشه راه...");

    try {
      const res = await fetch(`${API_BASE_URL}/api/vania/roadmap/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          patient_id: patientId,
          title: formData.title,
          instructions: formData.instructions,
        }),
      });

      if (!res.ok) throw new Error("سرور با خطا مواجه شد.");

      const newSession: RoadmapSession = await res.json(); // [FIX] Await JSON

      toast.dismiss(toastId);
      toast.success("جلسه جدید اضافه شد.");
      
      setOpen(false);
      setFormData({ title: "", instructions: "" });
      
      onSuccess(newSession); // Pass object back

    } catch (e: any) {
      toast.dismiss(toastId);
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" variant="outline">
            <Plus className="w-4 h-4" />
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle>برنامه‌ریزی جلسه جدید</DialogTitle>
          <DialogDescription>
            یک جلسه جدید به نقشه راه درمان بیمار اضافه کنید.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="session-title" className="flex items-center gap-2">
              <BookText className="w-3.5 h-3.5" />
              موضوع جلسه
            </Label>
            <Input 
              id="session-title"
              value={formData.title} 
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              placeholder="مثال: تکنیک‌های تنظیم هیجان" 
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="session-instructions" className="flex items-center gap-2">
              <Lightbulb className="w-3.5 h-3.5" />
              دستورالعمل‌های راهنما (اختیاری)
            </Label>
            <Textarea 
              id="session-instructions"
              value={formData.instructions}
              onChange={(e) => setFormData({...formData, instructions: e.target.value})}
              placeholder="نکات خصوصی برای هوش مصنوعی..."
              className="min-h-[100px]"
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={loading} className="w-full">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "افزودن به نقشه راه"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}