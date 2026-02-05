// frontend/components/chat/AddPatientModal.tsx
"use client";

import { useState } from "react";
import { useAssistantRuntime } from "@assistant-ui/react";
import { 
  UserPlus, 
  Loader2, 
  Save,
  Briefcase,
  GraduationCap,
  Heart,
  Calendar,
  Phone
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { useVaniaStore } from "@/lib/vania/store";
import { useRouter, useParams } from "next/navigation";

// --- Props Interface ---
interface Props {
  trigger?: React.ReactNode;
}

/**
 * Renders a modal dialog for adding a new patient to the doctor's roster.
 * This form captures the essential demographic information required for the
 * AI agent to begin its Phase 1 (Analysis) protocol. Upon successful creation,
 * it navigates to a new chat thread and injects a system message to trigger
 * the agent's onboarding workflow.
 */
export function AddPatientModal({ trigger }: Props) {
  // --- State Hooks ---
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    age: "",
    marital: "single",
    education: "bachelor",
    job: ""
  });

  // --- React & Library Hooks ---
  const runtime = useAssistantRuntime();
  const { setActivePatient } = useVaniaStore();
  const router = useRouter();
  const params = useParams();
  const agentId = params.agentId as string;

  // --- Event Handler ---
  const handleSubmit = async () => {
    // 1. Basic Validation
    if (!formData.fullName || !formData.phone) {
      toast.error("نام و نام خانوادگی و شماره تماس الزامی است.");
      return;
    }

    setLoading(true);
    try {
      // 2. API Call: Send patient data to the backend to create the user account
      const res = await fetch(`${API_BASE_URL}/api/vania/patients/invite/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          phone_number: formData.phone,
          full_name: formData.fullName,
          age: formData.age ? parseInt(formData.age) : null,
          marital_status: formData.marital,
          education: formData.education,
          job: formData.job
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "خطا در ایجاد پرونده بیمار. لطفاً دوباره تلاش کنید.");
      }
      
      const data = await res.json();
      const patientId = data.patient_id;
      const patientName = data.name || formData.fullName;

      // 3. Update Global & UI State
      toast.success(`پرونده برای «${patientName}» با موفقیت ایجاد شد.`);
      setOpen(false);
      setActivePatient(patientId, patientName);

      // 4. Navigate to a new, dedicated chat thread for this patient
      const newThreadId = `local-${crypto.randomUUID()}`;
      router.push(`/chat/${agentId}/${newThreadId}?patientId=${patientId}`);

      // 5. Trigger Agent's Onboarding Workflow
      // This is a critical step that injects context into the new chat, telling the AI what to do.
      setTimeout(() => {
        // A. Inject the captured demographics as a system message. The AI will use this
        //    as the basis for its Phase 1 analysis.
        const contextMsg = `[SYSTEM: NEW_PATIENT_ONBOARDING_DATA]
- Name: ${formData.fullName}
- Age: ${formData.age}
- Marital Status: ${formData.marital}
- Education: ${formData.education}
- Job: ${formData.job}
ACTION REQUIRED: You are in Phase 1 (Analysis). Greet the doctor and ask them to upload the Projective Tests (TAT/Rorschach) using the 'Clinical Assets' button.`;

        runtime.thread.append({
          role: "system",
          content: [{ type: "text", text: contextMsg }]
        });
        
        // B. Simulate a user message to prompt the agent to start its turn.
        runtime.thread.append({
          role: "user",
          content: [{ type: "text", text: `پرونده جدید برای ${formData.fullName} تشکیل شد. لطفاً فرآیند تحلیل فاز ۱ را شروع کن.` }]
        });
      }, 1000); // Wait 1 second for navigation to complete

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
          // Default trigger if none is provided
          <Button variant="ghost" size="sm" className="w-full justify-start text-xs font-normal text-primary hover:bg-primary/10">
            <UserPlus className="mr-2 h-4 w-4" /> پرونده جدید
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[500px]" dir="rtl">
        <DialogHeader className="text-right border-b pb-4">
          <DialogTitle className="text-lg">تشکیل پرونده بالینی جدید</DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            اطلاعات دموگرافیک زیر برای شروع **فاز ۱ (تحلیل)** توسط هوش مصنوعی ضروری است.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-6 py-4">
          
          {/* --- Identity Section --- */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-muted-foreground flex items-center gap-2">
              <span className="w-1 h-4 bg-primary rounded-full"/> مشخصات اصلی
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-xs">نام و نام خانوادگی <span className="text-red-500">*</span></Label>
                <Input value={formData.fullName} onChange={(e) => setFormData({...formData, fullName: e.target.value})} placeholder="مثال: سارا محمدی" />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs">شماره تماس <span className="text-red-500">*</span></Label>
                <Input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} placeholder="0912..." dir="ltr" />
              </div>
            </div>
          </div>

          {/* --- Demographics Section --- */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-muted-foreground flex items-center gap-2">
              <span className="w-1 h-4 bg-secondary rounded-full"/> اطلاعات جمعیت‌شناختی (برای تحلیل)
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-xs flex items-center gap-1.5"><Calendar className="w-3 h-3"/> سن</Label>
                <Input type="number" value={formData.age} onChange={(e) => setFormData({...formData, age: e.target.value})} />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs flex items-center gap-1.5"><Heart className="w-3 h-3"/> وضعیت تاهل</Label>
                <Select value={formData.marital} onValueChange={(v) => setFormData({...formData, marital: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">مجرد</SelectItem>
                    <SelectItem value="married">متاهل</SelectItem>
                    <SelectItem value="divorced">مطلقه</SelectItem>
                    <SelectItem value="widow">بیوه</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="text-xs flex items-center gap-1.5"><GraduationCap className="w-3 h-3"/> تحصیلات</Label>
                <Select value={formData.education} onValueChange={(v) => setFormData({...formData, education: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="diploma">دیپلم</SelectItem>
                    <SelectItem value="bachelor">کارشناسی</SelectItem>
                    <SelectItem value="master">کارشناسی ارشد</SelectItem>
                    <SelectItem value="phd">دکتری</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="text-xs flex items-center gap-1.5"><Briefcase className="w-3 h-3"/> شغل</Label>
                <Input value={formData.job} onChange={(e) => setFormData({...formData, job: e.target.value})} />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={loading} className="w-full gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            ثبت پرونده و شروع تحلیل
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}