"use client";

import { useMemo, useState } from "react";
import { Pencil, Pill, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { MedicationEntry } from "@/lib/types/vania";

interface Props {
  medications: MedicationEntry[];
  patientId: number;
  caseId?: string;
  onEdit: (delta: any) => void;
  readOnly?: boolean;
}

const EMPTY_FORM = {
  drug_name: "",
  dosage: "",
  usage_instructions: "",
  timing: "",
  duration: "",
  notes: "",
};

export function MedicationsTab({ medications, patientId, caseId, onEdit, readOnly = false }: Props) {
  const [draft, setDraft] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const submitLabel = useMemo(() => (editingId ? "ذخیره دارو" : "افزودن دارو"), [editingId]);

  const resetForm = () => {
    setDraft(EMPTY_FORM);
    setEditingId(null);
  };

  const handleSubmit = async () => {
    if (readOnly || !draft.drug_name.trim()) return;

    setIsSaving(true);
    try {
      const payload = {
        patient_id: patientId,
        case_id: caseId,
        drug_name: draft.drug_name.trim(),
        dosage: draft.dosage.trim(),
        usage_instructions: draft.usage_instructions.trim(),
        timing: draft.timing.trim(),
        duration: draft.duration.trim(),
        notes: draft.notes.trim(),
      };

      if (editingId) {
        const res = await fetch(`${API_BASE_URL}/api/vania/medications/${editingId}/`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("ذخیره تغییرات دارو ناموفق بود.");
        const updated: MedicationEntry = await res.json();
        onEdit({ medications: medications.map((item) => (item.id === editingId ? updated : item)) });
        toast.success("دارو به‌روزرسانی شد.");
      } else {
        const res = await fetch(`${API_BASE_URL}/api/vania/medications/`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("ثبت دارو ناموفق بود.");
        const created: MedicationEntry = await res.json();
        onEdit({ medications: [created, ...(medications || [])] });
        toast.success("دارو ثبت شد.");
      }

      resetForm();
    } catch (error: any) {
      toast.error(error?.message || "خطا در ذخیره دارو.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (item: MedicationEntry) => {
    if (readOnly) return;
    setEditingId(item.id);
    setDraft({
      drug_name: item.drug_name || "",
      dosage: item.dosage || "",
      usage_instructions: item.usage_instructions || "",
      timing: item.timing || "",
      duration: item.duration || "",
      notes: item.notes || "",
    });
  };

  const handleDelete = async (id: string) => {
    if (readOnly) return;
    setDeletingId(id);
    try {
      const query = new URLSearchParams({ patient_id: String(patientId) });
      if (caseId) query.set("case_id", caseId);
      const res = await fetch(`${API_BASE_URL}/api/vania/medications/${id}/?${query.toString()}`, {
        method: "DELETE",
        headers: { ...getAuthHeaders() },
      });
      if (!res.ok) throw new Error("حذف دارو ناموفق بود.");
      onEdit({ medications: medications.filter((item) => item.id !== id) });
      if (editingId === id) resetForm();
      toast.success("دارو حذف شد.");
    } catch (error: any) {
      toast.error(error?.message || "خطا در حذف دارو.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 pb-10 animate-in fade-in slide-in-from-right-2 duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Pill className="h-4 w-4 text-primary" />
            شیوه و مصرف دارو
          </h3>
          <p className="text-xs text-muted-foreground">ثبت نسخه ساده برای نام دارو، مقدار، زمان مصرف و توضیح تکمیلی.</p>
        </div>
      </div>

      {!readOnly ? (
        <div className="grid gap-4 rounded-2xl border border-border/60 bg-card/60 p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>نام دارو</Label>
              <Input value={draft.drug_name} onChange={(e) => setDraft((prev) => ({ ...prev, drug_name: e.target.value }))} placeholder="مثلا: سرترالین" />
            </div>
            <div className="space-y-2">
              <Label>دوز / مقدار</Label>
              <Input value={draft.dosage} onChange={(e) => setDraft((prev) => ({ ...prev, dosage: e.target.value }))} placeholder="مثلا: ۵۰ میلی‌گرم" />
            </div>
            <div className="space-y-2">
              <Label>زمان مصرف</Label>
              <Input value={draft.timing} onChange={(e) => setDraft((prev) => ({ ...prev, timing: e.target.value }))} placeholder="مثلا: هر شب بعد از شام" />
            </div>
            <div className="space-y-2">
              <Label>مدت مصرف</Label>
              <Input value={draft.duration} onChange={(e) => setDraft((prev) => ({ ...prev, duration: e.target.value }))} placeholder="مثلا: ۳۰ روز" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>شیوه مصرف</Label>
            <Textarea value={draft.usage_instructions} onChange={(e) => setDraft((prev) => ({ ...prev, usage_instructions: e.target.value }))} placeholder="مثلا: روزی یک عدد همراه آب" />
          </div>

          <div className="space-y-2">
            <Label>توضیحات</Label>
            <Textarea value={draft.notes} onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))} placeholder="نکات احتیاطی یا توضیح تکمیلی" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => void handleSubmit()} disabled={!draft.drug_name.trim() || isSaving} className="gap-2">
              <Plus className="h-4 w-4" />
              {isSaving ? "در حال ذخیره..." : submitLabel}
            </Button>
            {editingId ? (
              <Button variant="ghost" onClick={resetForm}>
                انصراف
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {(medications || []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
            هنوز دارویی برای این پرونده ثبت نشده است.
          </div>
        ) : (
          medications.map((item) => (
            <div key={item.id} className="grid gap-3 rounded-2xl border border-border/60 bg-background px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-sm font-semibold">{item.drug_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {[item.dosage, item.timing, item.duration].filter(Boolean).join(" • ") || "بدون جزئیات تکمیلی"}
                  </div>
                </div>
                {!readOnly ? (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(item)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => void handleDelete(item.id)}
                      disabled={deletingId === item.id}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : null}
              </div>

              {item.usage_instructions ? (
                <div className="text-sm leading-6 text-foreground">{item.usage_instructions}</div>
              ) : null}

              {item.notes ? (
                <div className="text-xs leading-6 text-muted-foreground">{item.notes}</div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
