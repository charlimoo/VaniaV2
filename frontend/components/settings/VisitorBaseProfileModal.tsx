"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DynamicForm } from "@/components/tool-ui/form/dynamic-form";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import type { FormDefinition } from "@/lib/types/vania";

interface VisitorBaseProfileModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: () => Promise<any> | void;
}

interface BaseProfileResponse {
  form: FormDefinition;
  data: Record<string, any>;
}

export function VisitorBaseProfileModal({
  isOpen,
  onOpenChange,
  onUpdate,
}: VisitorBaseProfileModalProps) {
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<BaseProfileResponse | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    setLoading(true);

    fetch(`${API_BASE_URL}/api/vania/my-base-profile/`, {
      headers: getAuthHeaders(),
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("بارگذاری پروفایل انجام نشد.");
        }
        return res.json();
      })
      .then((data: BaseProfileResponse) => {
        if (!mounted) return;
        setPayload(data);
      })
      .catch((error) => {
        console.error(error);
        toast.error("خطا در دریافت پروفایل مراجع.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen]);

  const handleSubmit = async (formData: Record<string, any>) => {
    const res = await fetch(`${API_BASE_URL}/api/vania/my-base-profile/`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify(formData),
    });

    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(result?.error || "ذخیره پروفایل انجام نشد.");
    }

    setPayload((current) => current ? { ...current, data: result.data || formData } : current);
    toast.success("پروفایل شما با موفقیت بروزرسانی شد.");
    await onUpdate?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="w-[calc(100vw-2rem)] max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="text-right">
          <DialogTitle>{payload?.form?.title || "پروفایل پایه مراجع"}</DialogTitle>
          <DialogDescription>
            اطلاعات مشترک پروفایل خود را از اینجا مدیریت کنید. این بخش به پرونده‌ها، تست‌ها و فرم‌های موردی وابسته نیست.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : payload?.form ? (
          <DynamicForm
            formHandle={payload.form.handler}
            schema={payload.form.schema}
            prefill={payload.data || {}}
            title={payload.form.title}
            description={payload.form.description}
            submitOverride={handleSubmit}
          />
        ) : (
          <div className="text-sm text-muted-foreground">
            اطلاعات این فرم در حال حاضر در دسترس نیست.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
