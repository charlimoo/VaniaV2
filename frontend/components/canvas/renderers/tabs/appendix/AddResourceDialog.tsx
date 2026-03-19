"use client";

import { useState } from "react";
import { Plus, Loader2, BookOpen, User, Quote, Lightbulb } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { CulturalResource, ResourceType } from "@/lib/types/vania";

interface Props {
  patientId: number;
  caseId?: string;
  onSuccess: (resource: CulturalResource) => void;
  trigger?: React.ReactNode;
}

export function AddResourceDialog({ patientId, caseId, onSuccess, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    type: "BOOK" as ResourceType,
    creator: "",
    reason: "",
    excerpt: ""
  });

  const handleSubmit = async () => {
    if (!formData.title || !formData.creator) {
      toast.error("عنوان و نام پدیدآورنده الزامی است.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/vania/appendix/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          patient_id: patientId,
          case_id: caseId,
          title: formData.title,
          type: formData.type,
          creator: formData.creator,
          reason_for_prescription: formData.reason || "پیشنهاد عمومی برای ارتقای بینش",
          content_excerpt: formData.excerpt
        }),
      });

      if (!res.ok) throw new Error("خطا در ثبت منبع.");

      const newResource: CulturalResource = await res.json();
      toast.success("منبع به پیوست اندیشه اضافه شد.");
      
      setOpen(false);
      setFormData({ title: "", type: "BOOK", creator: "", reason: "", excerpt: "" });
      onSuccess(newResource);

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
          <Button variant="ghost" size="sm" className="gap-2 h-8 text-xs">
            <Plus className="w-3.5 h-3.5" /> افزودن دستی
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md" dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle>افزودن به پیوست اندیشه</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="grid gap-2 sm:col-span-2">
                <Label className="text-xs flex gap-1"><BookOpen className="w-3 h-3"/> عنوان اثر</Label>
                <Input value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} />
            </div>
            <div className="grid gap-2">
                <Label className="text-xs">نوع</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData({...formData, type: v as ResourceType})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="BOOK">کتاب</SelectItem>
                        <SelectItem value="MOVIE">فیلم</SelectItem>
                        <SelectItem value="POEM">شعر</SelectItem>
                    </SelectContent>
                </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label className="text-xs flex gap-1"><User className="w-3 h-3"/> نویسنده / کارگردان / شاعر</Label>
            <Input value={formData.creator} onChange={(e) => setFormData({...formData, creator: e.target.value})} />
          </div>

          <div className="grid gap-2">
            <Label className="text-xs flex gap-1"><Lightbulb className="w-3 h-3"/> دلیل تجویز (نسخه درمانی)</Label>
            <Textarea 
                value={formData.reason} 
                onChange={(e) => setFormData({...formData, reason: e.target.value})} 
                placeholder="چرا این اثر برای این مراجع مفید است؟"
                className="h-16"
            />
          </div>

          <div className="grid gap-2">
            <Label className="text-xs flex gap-1"><Quote className="w-3 h-3"/> برش کوتاه / دیالوگ ماندگار (اختیاری)</Label>
            <Textarea 
                value={formData.excerpt} 
                onChange={(e) => setFormData({...formData, excerpt: e.target.value})} 
                className="h-16"
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={loading} className="w-full sm:w-auto">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "افزودن به کتابخانه"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
