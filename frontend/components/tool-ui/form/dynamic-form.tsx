"use client";

import { useState } from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form"; // Import useFieldArray
import { Loader2, Send, AlertCircle, Plus, Trash2 } from "lucide-react"; // Import Icons
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"; // Ensure you have shadcn table component

import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useVaniaStore } from "@/lib/vania/store";
import { PersianDatePicker } from "@/components/ui/persian-date-picker";

// --- Types ---
interface FormFieldDef {
  name: string;
  label: string;
  type: "text" | "number" | "email" | "textarea" | "select" | "checkbox" | "date" | "datagrid" | "checkbox_group"; // Added datagrid
  required?: boolean;
  options?: string[];
  placeholder?: string;
  help_text?: string;
  width?: "full" | "half"; // Added simple layout control
  columns?: FormFieldDef[]; // For datagrid
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

// --- Sub-Component for DataGrid ---
function DataGridField({ control, fieldDef }: { control: any, fieldDef: FormFieldDef }) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: fieldDef.name,
  });

  return (
    <div className="border rounded-lg overflow-hidden my-2">
      <div className="bg-muted/30 px-3 py-2 border-b flex justify-between items-center">
        <span className="text-xs font-semibold text-muted-foreground">{fieldDef.label}</span>
        <Button 
          type="button" 
          variant="ghost" 
          size="sm" 
          onClick={() => append({})} // Add empty row
          className="h-6 text-[10px] gap-1 hover:bg-primary/10 hover:text-primary"
        >
          <Plus className="w-3 h-3" /> افزودن سطر
        </Button>
      </div>
      <div className="overflow-x-auto">
        <Table dir="rtl">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {fieldDef.columns?.map((col) => (
                <TableHead key={col.name} className="text-right text-[10px] h-8 font-medium">{col.label}</TableHead>
              ))}
              <TableHead className="w-[40px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((item, index) => (
              <TableRow key={item.id} className="hover:bg-muted/10">
                {fieldDef.columns?.map((col) => (
                  <TableCell key={col.name} className="p-2">
                    {/* Render inputs inside table cells */}
                    {col.type === "select" ? (
                      <Controller
                        control={control}
                        name={`${fieldDef.name}.${index}.${col.name}`}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger className="h-7 text-[11px]">
                              <SelectValue placeholder="-" />
                            </SelectTrigger>
                            <SelectContent dir="rtl">
                              {col.options?.map((opt) => (
                                <SelectItem key={opt} value={opt} className="text-[11px]">{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    ) : (
                      <Input 
                        {...control.register(`${fieldDef.name}.${index}.${col.name}`)}
                        type={col.type}
                        className="h-7 text-[11px]"
                      />
                    )}
                  </TableCell>
                ))}
                <TableCell className="p-2 text-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive/70 hover:text-destructive"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {fields.length === 0 && (
              <TableRow>
                <TableCell colSpan={(fieldDef.columns?.length || 0) + 1} className="text-center text-[10px] text-muted-foreground py-4">
                  هنوز هیچ سطری اضافه نشده است.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// --- Main Component ---
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

      const res = await fetch(`${API_BASE_URL}/api/services/forms/submit/`, {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
          handler: formHandle,
          form_handle: formHandle,
          session_id: sessionId,
          resource_id: effectivePatientId, 
          data: data,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || errData.detail || "Submission failed");
      }
      
      if (onSuccess) onSuccess(data);

      await runtime.thread.append({
        role: "user",
        content: [{ type: "text", text: `[System: Form '${formHandle}' Submitted.]` }],
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

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-lg flex items-center gap-2 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Simple Layout Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {schema.map((field) => {
            const isFullWidth = field.width === 'full' || field.type === 'textarea' || field.type === 'datagrid' || !field.width;
            
            return (
              <div key={field.name} className={cn("flex flex-col gap-1.5 group", isFullWidth ? "col-span-1 md:col-span-2" : "col-span-1")}>
                
                {/* Standard Inputs */}
                {field.type !== "checkbox" && field.type !== "datagrid" && (
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

                {/* --- INPUT TYPES --- */}
                {(field.type === "text" || field.type === "number" || field.type === "email") && (
                  <Input
                    id={field.name}
                    type={field.type}
                    placeholder={field.placeholder}
                    className="h-9 text-right w-full"
                    {...register(field.name, { required: field.required })}
                  />
                  
                )}
                {field.type === "date" && (
                  <Controller
                    control={control}
                    name={field.name}
                    rules={{ required: field.required }}
                    render={({ field: { onChange, value } }) => (
                      <PersianDatePicker
                        value={value}
                        onChange={onChange}
                        placeholder={field.placeholder}
                      />
                    )}
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

                {/* --- DATA GRID (TABLE) --- */}
                {field.type === "datagrid" && (
                  <DataGridField control={control} fieldDef={field} />
                )}

                {/* --- CHECKBOX GROUP (Multi-Select) --- */}
                {field.type === "checkbox_group" && (
                  <div className="space-y-2 border rounded-md p-3 bg-muted/10">
                    <Label className="text-xs font-semibold text-muted-foreground mb-2 block">
                      {field.label}
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Controller
                        control={control}
                        name={field.name}
                        // Initialize as empty array
                        defaultValue={[]}
                        render={({ field: { onChange, value } }) => (
                          <>
                            {field.options?.map((option) => (
                              <div key={option} className="flex items-center gap-2">
                                <Checkbox
                                  id={`${field.name}-${option}`}
                                  checked={Array.isArray(value) && value.includes(option)}
                                  onCheckedChange={(checked) => {
                                    const currentValues = Array.isArray(value) ? value : [];
                                    if (checked) {
                                      onChange([...currentValues, option]);
                                    } else {
                                      onChange(currentValues.filter((v: string) => v !== option));
                                    }
                                  }}
                                  className="data-[state=checked]:bg-primary w-4 h-4"
                                />
                                <label
                                  htmlFor={`${field.name}-${option}`}
                                  className="text-[11px] cursor-pointer select-none font-medium"
                                >
                                  {option}
                                </label>
                              </div>
                            ))}
                          </>
                        )}
                      />
                    </div>
                  </div>
                )}

                {/* Errors & Help Text */}
                {errors[field.name] && (
                  <span className="text-[10px] text-destructive font-medium">الزامی</span>
                )}
                {field.help_text && (
                  <span className="text-[10px] text-muted-foreground/70">{field.help_text}</span>
                )}
              </div>
            );
          })}
        </div>

        <Button type="submit" className="w-full mt-4 gap-2 font-bold shadow-sm" disabled={isSubmitting || disabled}>
          {isSubmitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /><span>در حال پردازش...</span></>
          ) : (
            <><Send className="w-4 h-4" /><span>ثبت اطلاعات</span></>
          )}
        </Button>
      </form>
    </div>
  );
}