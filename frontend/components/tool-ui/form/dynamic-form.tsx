// start of frontend/components/tool-ui/form/dynamic-form.tsx
"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { Loader2, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { useAssistantRuntime } from "@assistant-ui/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useVaniaStore } from "@/lib/vania/store";

// --- Types ---

interface FormFieldDef {
  name: string;
  label: string;
  type: "text" | "number" | "email" | "textarea" | "select" | "checkbox" | "date";
  required?: boolean;
  options?: string[];
  placeholder?: string;
  help_text?: string;
}

interface DynamicFormProps {
  formHandle: string;
  schema: FormFieldDef[];
  prefill?: Record<string, any>;
  title?: string;
  description?: string;
  onSuccess?: (data: Record<string, any>) => void;
  disabled?: boolean;
  patientId?: number; 
  sessionId?: string; 
}

export function DynamicForm({ 
  formHandle, 
  schema = [], 
  prefill = {}, 
  title,
  description,
  onSuccess,
  disabled = false,
  patientId, 
  sessionId, 
}: DynamicFormProps) {
  const runtime = useAssistantRuntime();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fallback to global store if prop is missing
  const { activePatientId: storePatientId } = useVaniaStore();
  const effectivePatientId = patientId || storePatientId;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm({
    defaultValues: prefill,
  });

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      };

      // [FIX] Removed custom X-Target-Resource-ID header to prevent CORS preflight failures.
      // We now pass resource_id in the body.

      const res = await fetch(`${API_BASE_URL}/api/services/forms/submit/`, {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
          handler: formHandle,
          form_handle: formHandle,
          session_id: sessionId,
          resource_id: effectivePatientId, // [FIX] Send context in body
          data: data,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || errData.detail || "Submission failed");
      }
      
      const responseJson = await res.json();

      if (onSuccess) onSuccess(data);

      await runtime.thread.append({
        role: "user",
        content: [{ type: "text", text: `[System: Form '${formHandle}' Submitted. Data: ${JSON.stringify(data)}]` }],
      });

    } catch (err: any) {
      console.error("Form Submission Error:", err);
      setError(err.message || "خطایی در ثبت اطلاعات رخ داد.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full mx-auto border rounded-xl p-5 bg-card shadow-sm transition-all" dir="rtl">
      
      {(title || description) && (
        <div className="mb-5 border-b pb-3 space-y-1">
          {title && <h3 className="font-semibold text-foreground">{title}</h3>}
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-lg flex items-center gap-2 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {schema.map((field) => (
          <div key={field.name} className="flex flex-col gap-1.5 group">
            
            {field.type !== "checkbox" && (
              <Label 
                htmlFor={field.name} 
                className={cn(
                  "text-xs font-medium text-muted-foreground group-focus-within:text-primary transition-colors",
                  errors[field.name] && "text-destructive"
                )}
              >
                {field.label} {field.required && <span className="text-destructive">*</span>}
              </Label>
            )}

            {(field.type === "text" || field.type === "number" || field.type === "email" || field.type === "date") && (
              <Input
                id={field.name}
                type={field.type}
                placeholder={field.placeholder}
                className="h-9 text-right w-full"
                {...register(field.name, { 
                  required: field.required,
                  valueAsNumber: field.type === "number"
                })}
              />
            )}

            {field.type === "textarea" && (
              <Textarea
                id={field.name}
                placeholder={field.placeholder}
                className="min-h-[80px] text-right resize-y w-full"
                {...register(field.name, { required: field.required })}
              />
            )}

            {field.type === "select" && (
              <Controller
                control={control}
                name={field.name}
                rules={{ required: field.required }}
                render={({ field: fieldProps }) => (
                  <Select onValueChange={fieldProps.onChange} defaultValue={fieldProps.value}>
                    <SelectTrigger className="h-9 text-right w-full" dir="rtl">
                      <SelectValue placeholder={field.placeholder || "انتخاب کنید..."} />
                    </SelectTrigger>
                    <SelectContent dir="rtl">
                      {(field.options || []).map((opt) => (
                        <SelectItem key={opt} value={opt} className="text-right cursor-pointer">
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}

            {field.type === "checkbox" && (
              <div className="flex items-center gap-2 mt-1 p-1 w-full">
                <Controller
                  control={control}
                  name={field.name}
                  rules={{ required: field.required }}
                  render={({ field: fieldProps }) => (
                    <Checkbox 
                      id={field.name} 
                      checked={fieldProps.value} 
                      onCheckedChange={fieldProps.onChange}
                      className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                    />
                  )}
                />
                <Label htmlFor={field.name} className="text-sm cursor-pointer select-none">
                  {field.label} {field.required && <span className="text-destructive">*</span>}
                </Label>
              </div>
            )}

            {errors[field.name] && (
              <span className="text-[10px] text-destructive animate-in slide-in-from-top-1 font-medium">
                تکمیل این فیلد الزامی است.
              </span>
            )}
            
            {field.help_text && !errors[field.name] && (
              <span className="text-[10px] text-muted-foreground/70">
                {field.help_text}
              </span>
            )}
          </div>
        ))}

        <Button 
          type="submit" 
          className="w-full mt-4 gap-2 font-bold shadow-sm" 
          disabled={isSubmitting || disabled} 
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>در حال پردازش...</span>
            </>
          ) : (
            <>
              {disabled ? (
                 <span>در حال دریافت فرم...</span> 
              ) : (
                 <>
                   <Send className="w-4 h-4" />
                   <span>ثبت اطلاعات</span>
                 </>
              )}
            </>
          )}
        </Button>
      </form>
    </div>
  );
}