"use client";

import { useState, useEffect } from "react";
import { 
  User, 
  FileText, 
  Phone, 
  Calendar, 
  Briefcase, 
  Heart,
  Save, 
  Loader2, 
  CheckCircle,
  GraduationCap
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {  PatientManagerState } from "@/lib/types/vania";
// This interface now reflects the full patient profile, including demographics
interface PatientProfile {
  id: number;
  name: string;
  phone: string;
  age?: number | string;
  marital_status?: string;
  education?: string;
  job?: string;
}

interface ProfileTabProps {
  patientProfile: PatientProfile;
  clinicalSummary: string;
  onEdit: (delta: Partial<PatientManagerState>) => void; 
  isLocked: boolean;
}

export function ProfileTab({ patientProfile, clinicalSummary, onEdit, isLocked }: ProfileTabProps) {
  // --- State Management ---
  // State for the large clinical summary text area
  const [summary, setSummary] = useState(clinicalSummary || "");
  
  // State for the editable profile fields
  const [profileData, setProfileData] = useState({
    name: patientProfile.name || "",
    age: patientProfile.age || "",
    marital_status: patientProfile.marital_status || "single",
    education: patientProfile.education || "bachelor",
    job: patientProfile.job || ""
  });
  
  const [isSaving, setIsSaving] = useState(false);

  // --- Derived State ---
  // Check if there are unsaved changes in either the profile or the summary
  const isProfileDirty = 
    profileData.name !== (patientProfile.name || "") ||
    String(profileData.age) !== String(patientProfile.age || "") ||
    profileData.marital_status !== (patientProfile.marital_status || "single") ||
    profileData.education !== (patientProfile.education || "bachelor") ||
    profileData.job !== (patientProfile.job || "");

  const isSummaryDirty = summary !== (clinicalSummary || "");
  const isDirty = isProfileDirty || isSummaryDirty;

  // --- Effects ---
  // Update local state if props change (e.g., from an agent update)
  useEffect(() => {
    setSummary(clinicalSummary || "");
    setProfileData({
      name: patientProfile.name || "",
      age: patientProfile.age || "",
      marital_status: patientProfile.marital_status || "single",
      education: patientProfile.education || "bachelor",
      job: patientProfile.job || ""
    });
  }, [clinicalSummary, patientProfile]);

  // --- Handlers ---
  const handleProfileChange = (field: keyof typeof profileData, value: string) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (!isDirty || isLocked) return;

    setIsSaving(true);
    const updatePayload: Partial<PatientManagerState> = {};

    if (isProfileDirty) {
      updatePayload.patient_profile = {
        ...patientProfile, // Spread existing to satisfy required fields like id/phone
        name: profileData.name,
        age: profileData.age,
        marital_status: profileData.marital_status,
        education: profileData.education,
        job: profileData.job,
      };
    }

    if (isSummaryDirty) {
      updatePayload.clinical_summary = summary;
    }
    
    toast.promise(
      new Promise<void>((resolve) => {
        onEdit(updatePayload);
        // Simulate network latency for visual feedback
        setTimeout(() => resolve(), 700); 
      }),
      {
        loading: "در حال ذخیره تغییرات...",
        success: "پرونده بیمار با موفقیت به‌روزرسانی شد.",
        error: "خطا در ذخیره‌سازی.",
        finally: () => setIsSaving(false),
      }
    );
  };

  return (
    <div className="space-y-8 pb-10 animate-in fade-in slide-in-from-right-2 duration-300">
      
      {/* --- Section 1: Demographics (Now Editable) --- */}
      <section className="space-y-4">
        <h3 className="text-xs font-bold text-muted-foreground flex items-center gap-2">
          <User className="w-4 h-4" /> مشخصات اصلی و جمعیت‌شناختی
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-1.5">
            <Label className="text-xs flex items-center gap-1.5"><User className="w-3 h-3"/> نام و نام خانوادگی</Label>
            <Input value={profileData.name} onChange={(e) => handleProfileChange('name', e.target.value)} disabled={isLocked || isSaving} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs flex items-center gap-1.5"><Phone className="w-3 h-3"/> شماره تماس</Label>
            <Input value={patientProfile.phone} disabled readOnly className="font-mono bg-muted/50" />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs flex items-center gap-1.5"><Calendar className="w-3 h-3"/> سن</Label>
            <Input type="number" value={profileData.age} onChange={(e) => handleProfileChange('age', e.target.value)} disabled={isLocked || isSaving} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs flex items-center gap-1.5"><Heart className="w-3 h-3"/> وضعیت تاهل</Label>
            <Select value={profileData.marital_status} onValueChange={(v) => handleProfileChange('marital_status', v)} disabled={isLocked || isSaving}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="single">مجرد</SelectItem>
                <SelectItem value="married">متاهل</SelectItem>
                <SelectItem value="divorced">مطلقه</SelectItem>
                <SelectItem value="widow">بیوه</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs flex items-center gap-1.5"><GraduationCap className="w-3 h-3"/> تحصیلات</Label>
            <Select value={profileData.education} onValueChange={(v) => handleProfileChange('education', v)} disabled={isLocked || isSaving}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="diploma">دیپلم</SelectItem>
                <SelectItem value="bachelor">کارشناسی</SelectItem>
                <SelectItem value="master">کارشناسی ارشد</SelectItem>
                <SelectItem value="phd">دکتری</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs flex items-center gap-1.5"><Briefcase className="w-3 h-3"/> شغل</Label>
            <Input value={profileData.job} onChange={(e) => handleProfileChange('job', e.target.value)} disabled={isLocked || isSaving} />
          </div>
        </div>
      </section>

      {/* --- Section 2: Clinical Summary --- */}
      <section>
        <div className="grid gap-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="clinical-summary" className="text-xs font-bold text-muted-foreground flex items-center gap-2">
              <FileText className="w-4 h-4" /> خلاصه بالینی و مشاهدات
            </Label>
          </div>
          
          <Textarea
            id="clinical-summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="شرح حال، شکایت اصلی، مشاهدات تست‌های فرافکن و فرمول‌بندی مشکل را در اینجا وارد کنید..."
            className="min-h-[250px] text-sm leading-relaxed"
            disabled={isLocked || isSaving}
          />
        </div>
      </section>

      {/* --- Global Save Button --- */}
      <div className="flex justify-end items-center gap-3 sticky bottom-0 py-2 -mx-6 px-6 bg-background/80 backdrop-blur-sm border-t -mb-10">
          <div className={cn(
            "flex items-center gap-1.5 text-xs transition-opacity duration-300",
            isDirty ? "text-amber-600" : "text-emerald-600",
            isLocked && "opacity-50"
          )}>
            {isDirty ? (
              <>تغییرات ذخیره نشده</>
            ) : (
              <><CheckCircle className="w-3.5 h-3.5" /> ذخیره شده</>
            )}
          </div>

          <Button 
            className="h-9 text-xs gap-1.5" 
            onClick={handleSave}
            disabled={isSaving || isLocked || !isDirty}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin"/>
            ) : (
              <Save className="w-4 h-4" />
            )}
            ذخیره تغییرات
          </Button>
      </div>
    </div>
  );
}