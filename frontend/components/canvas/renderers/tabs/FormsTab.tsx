// frontend/components/canvas/renderers/tabs/FormsTab.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { 
  FileText, 
  Plus, 
  CheckCircle2, 
  Bot,
  Sparkles
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";
import { toast } from "sonner";
import { DynamicForm } from "@/components/tool-ui/form/dynamic-form";
import { FormDefinition } from "@/lib/types/vania";
import { Badge } from "@/components/ui/badge";

// --- Props Interface ---
interface Props {
  forms: any[]; 
  availableForms: FormDefinition[]; 
  uiSignal?: { type: string; form?: FormDefinition; data?: any };
  onEdit: (delta: any) => void;
  patientId: number; 
}

// Keys to exclude from the history view (Metadata)
const HIDDEN_KEYS = new Set([
  'handler', 
  'submitted_by_doctor_id', 
  'submission_timestamp', 
  'form_key', 
  'form_title'
]);

export function FormsTab({ forms, availableForms, uiSignal, onEdit, patientId }: Props) {
  const params = useParams();
  const threadId = params.threadId as string;
  
  const [activeModalForm, setActiveModalForm] = useState<FormDefinition | null>(null);
  const [draftData, setDraftData] = useState<any>(null);

  // --- Helper to translate raw keys to human labels ---
  const getFieldLabel = (entry: any, fieldKey: string) => {
    // 1. Try to match by stable 'form_key' first
    if (entry.form_key) {
        const def = availableForms?.find(f => f.key === entry.form_key);
        if (def) {
            const field = def.schema.find((s: any) => s.name === fieldKey);
            if (field) return field.label;
        }
    }
    // 2. Fallback: Try to match by 'type' title
    const defByTitle = availableForms?.find(f => f.title === entry.type);
    if (defByTitle) {
        const field = defByTitle.schema.find((s: any) => s.name === fieldKey);
        if (field) return field.label;
    }
    return fieldKey;
  };

  // --- UI Signal Handler ---
  useEffect(() => {
    if (uiSignal) {
        let shouldClearSignal = false;

        if (uiSignal.type === "OPEN_FORM" && uiSignal.form) {
            setActiveModalForm(uiSignal.form);
            setDraftData(null);
            shouldClearSignal = true;
        } 
        else if (uiSignal.type === "DRAFT_FORM" && uiSignal.form) {
            setActiveModalForm(uiSignal.form);
            setDraftData(uiSignal.data);
            shouldClearSignal = true;
        }

        if (shouldClearSignal) {
            setTimeout(() => onEdit({ ui_signal: undefined }), 300);
        }
    }
  }, [uiSignal, onEdit]);

  // --- Success Handler ---
  const handleSuccess = (formData: any) => {
    if (!activeModalForm) return;

    toast.success(`فرم «${activeModalForm.title}» با موفقیت ثبت شد.`);
    setActiveModalForm(null);
    
    // Optimistic UI Update
    const newEntry = {
        id: "temp-" + Date.now(),
        type: activeModalForm.title,
        date: new Date().toISOString(),
        // We ensure the metadata is present in the optimistic update too
        form_key: activeModalForm.key,
        data: {
            ...formData,
            form_key: activeModalForm.key,
            form_title: activeModalForm.title 
        }
    };
    onEdit({ forms: [newEntry, ...(forms || [])] });
  };

  return (
    <div className="space-y-8 pb-10 animate-in fade-in slide-in-from-right-2 duration-300">
      
      {/* --- Section 1: Available Form Templates --- */}
      <section>
        <h3 className="text-xs font-bold text-muted-foreground mb-3 flex items-center gap-2">
            <Plus className="w-4 h-4" /> ثبت ارزیابی جدید
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {(availableForms || []).map((form) => (
                <button
                    key={form.key}
                    onClick={() => setActiveModalForm(form)}
                    className="flex flex-col items-start p-3 rounded-xl border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all text-right group h-full shadow-sm"
                >
                    <span className="font-bold text-xs group-hover:text-primary transition-colors">{form.title}</span>
                    <span className="text-[10px] text-muted-foreground mt-1 line-clamp-2 text-start opacity-80">{form.description}</span>
                </button>
            ))}
        </div>
      </section>

      {/* --- Section 2: History of Completed Forms --- */}
      <section>
        <h3 className="text-xs font-bold text-muted-foreground mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> تاریخچه فرم‌ها ({forms?.length || 0})
        </h3>
        
        {(forms?.length || 0) === 0 ? (
            <div className="text-center py-8 text-muted-foreground bg-muted/10 rounded-xl border border-dashed text-xs italic">
                هنوز فرمی تکمیل نشده است.
            </div>
        ) : (
            <Accordion type="single" collapsible className="w-full space-y-2">
                {forms.map((entry, idx) => (
                    <AccordionItem key={entry.id || idx} value={entry.id || String(idx)} className="border rounded-lg bg-card px-0 shadow-sm">
                        <AccordionTrigger className="px-4 py-3 hover:no-underline text-xs">
                            <div className="flex justify-between w-full ml-2 items-center">
                                <div className="flex items-center gap-2">
                                    <FileText className="w-3.5 h-3.5 text-primary opacity-70" />
                                    {/* Display Title or Fallback Key */}
                                    <span className="font-semibold">
                                        {/* If entry.data.form_title exists, use it. Otherwise use entry.type which is the fallback title */}
                                        {entry.data?.form_title || entry.type || entry.form_key}
                                    </span>
                                </div>
                                <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                                    {new Date(entry.date).toLocaleDateString('fa-IR')}
                                </span>
                            </div>
                        </AccordionTrigger>
                        
                        <AccordionContent className="px-4 pb-4 pt-0 border-t border-dashed border-border/50 mt-2">
                            <div className="grid grid-cols-1 gap-2 pt-3">
                                {Object.entries(entry.data)
                                    .filter(([key]) => !HIDDEN_KEYS.has(key)) 
                                    .map(([key, value]) => {
                                        // Skip nulls/empty
                                        if (value === null || value === undefined || value === "") return null;

                                        const label = getFieldLabel(entry, key);
                                        
                                        let displayValue = "";
                                        if (typeof value === 'object' && !Array.isArray(value)) {
                                            displayValue = Object.entries(value)
                                                .map(([subKey, subVal]) => `${subKey}: ${subVal}`)
                                                .join('\n');
                                        } else if (Array.isArray(value)) {
                                            displayValue = value.join('، ');
                                        } else {
                                            displayValue = String(value);
                                        }
                                        
                                        if (!displayValue || displayValue === "null") return null;

                                        return (
                                            <div key={key} className="flex flex-col sm:flex-row sm:justify-between text-[11px] border-b border-border/30 pb-1.5 last:border-0 gap-1 sm:gap-4">
                                                <span className="text-muted-foreground font-medium shrink-0">{label}:</span>
                                                <span className="font-medium text-foreground text-left whitespace-pre-wrap">
                                                    {displayValue}
                                                </span>
                                            </div>
                                        );
                                    })
                                }
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        )}
      </section>

      {/* --- Modal for Filling Forms --- */}
      <Dialog open={!!activeModalForm} onOpenChange={(o) => !o && setActiveModalForm(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" dir="rtl">
            <DialogHeader className="text-right">
                <DialogTitle className="flex items-center gap-2">
                    {activeModalForm?.title}
                    {draftData && (
                        <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200 text-[10px] gap-1 px-2 py-0.5 animate-in zoom-in">
                            <Sparkles className="w-3 h-3" />
                            پیش‌نویس هوش مصنوعی
                        </Badge>
                    )}
                </DialogTitle>
                
                {draftData && (
                    <DialogDescription className="text-xs bg-purple-50 text-purple-800 p-2.5 rounded-lg flex items-start gap-2 mt-2 border border-purple-100">
                        <Bot className="w-4 h-4 mt-0.5 shrink-0" />
                        <p>من این فرم را بر اساس تحلیل‌های اخیر پیش‌نویس کرده‌ام. لطفاً آن را بررسی، ویرایش و در نهایت تایید کنید.</p>
                    </DialogDescription>
                )}
            </DialogHeader>
            
            {activeModalForm && (
                <div className="py-2">
                    <DynamicForm 
                        formHandle={activeModalForm.handler}
                        schema={activeModalForm.schema}
                        key={draftData ? 'draft-mode' : 'new-mode'} 
                        // [FIX] Inject Key and Title into the form data payload
                        // This ensures the backend receives 'form_key' so it can save the correct title
                        prefill={{
                            ...(draftData || {}),
                            form_key: activeModalForm.key,
                            form_title: activeModalForm.title
                        }} 
                        title={activeModalForm.title}
                        description={activeModalForm.description}
                        onSuccess={handleSuccess}
                        patientId={patientId}
                        sessionId={threadId}
                    />
                </div>
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
}