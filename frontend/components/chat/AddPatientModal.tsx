"use client";

import { useState } from "react";
import { useAssistantRuntime } from "@assistant-ui/react";
import { 
  UserPlus, 
  Loader2, 
  User,
  Phone,
  ArrowRight
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { useVaniaStore } from "@/lib/vania/store";
import { useRouter, useParams } from "next/navigation";
import { getNormalizedValidPhoneOrNull, sanitizePhoneInputForDisplay } from "@/lib/phone";

interface Props {
  trigger?: React.ReactNode;
}

/**
 * Simplified modal for adding a new patient.
 * Only captures Name and Phone Number to quickly establish a connection.
 * Detailed demographics are now managed in the Base Profile clinical form.
 */
export function AddPatientModal({ trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
  });

  const runtime = useAssistantRuntime();
  const { setActivePatient } = useVaniaStore();
  const router = useRouter();
  const params = useParams();
  const agentId = params.agentId as string;

  const handleSubmit = async () => {
    const normalizedPhone = getNormalizedValidPhoneOrNull(formData.phone);
    if (!formData.fullName || !normalizedPhone) {
      toast.error("نام و نام خانوادگی و شماره تماس الزامی است.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/vania/visitors/invite/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          phone_number: normalizedPhone,
          full_name: formData.fullName,
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "خطا در ایجاد پرونده مراجعه کننده.");
      }
      
      const data = await res.json();
      const patientId = data.patient_id;
      const patientName = data.name || formData.fullName;

      toast.success(`پرونده برای «${patientName}» ایجاد شد.`);
      setOpen(false);
      setActivePatient(patientId, patientName);

      // Navigate to a new dedicated thread
      const newThreadId = `local-${crypto.randomUUID()}`;
      router.push(`/chat/${agentId}/${newThreadId}?visitorId=${patientId}`);

      // Trigger Onboarding workflow in the new thread
      setTimeout(() => {
        // [UPDATE] Injected instructions now point to the forms workflow
        const contextMsg = `[SYSTEM: NEW_PATIENT_CREATED]
- Patient Name: ${formData.fullName}
- Status: Initial Onboarding
ACTION REQUIRED: You are in Phase 1. Greet the doctor. Explain that you are ready to begin the analysis. 
Suggest that the doctor should first complete BASE_PROFILE_V1 in the "فرم‌ها" tab, and then provide additional clinical details so you can fill other forms and clinical summary.`;

        runtime.thread.append({
          role: "system",
          content: [{ type: "text", text: contextMsg }]
        });
        
        runtime.thread.append({
          role: "user",
          content: [{ type: "text", text: `پرونده جدید برای ${formData.fullName} تشکیل شد. بیایید تحلیل اولیه را شروع کنیم.` }]
        });
      }, 1000);

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
          <Button variant="ghost" size="sm" className="w-full justify-start text-xs font-normal text-primary hover:bg-primary/10">
            <UserPlus className="mr-2 h-4 w-4" /> پرونده جدید
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[400px]" dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle className="text-lg">تشکیل پرونده بالینی</DialogTitle>
          <DialogDescription className="text-xs">
            برای شروع، نام و شماره تماس مراجعه کننده را وارد کنید. سایر جزئیات در زبانه «فرم‌ها» و فرم اطلاعات پایه ثبت می‌شود.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label className="text-xs flex items-center gap-1.5"><User className="w-3 h-3"/> نام و نام خانوادگی</Label>
            <Input 
              value={formData.fullName} 
              onChange={(e) => setFormData({...formData, fullName: e.target.value})} 
              placeholder="مثال: سارا محمدی" 
            />
          </div>
          <div className="grid gap-2">
            <Label className="text-xs flex items-center gap-1.5"><Phone className="w-3 h-3"/> شماره تماس</Label>
            <Input 
              value={formData.phone} 
              onChange={(e) => setFormData({...formData, phone: sanitizePhoneInputForDisplay(e.target.value)})} 
              placeholder="09123456789" 
              dir="ltr" 
              type="tel"
              inputMode="numeric"
              maxLength={11}
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={loading} className="w-full gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            ایجاد پرونده و شروع گفتگو
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
