"use client";

import { Pill } from "lucide-react";

import { MedicationEntry } from "@/lib/types/vania";

interface Props {
  medications: MedicationEntry[];
}

export function PatientMedicationsTab({ medications }: Props) {
  return (
    <div className="space-y-6 pb-10 animate-in fade-in slide-in-from-right-2 duration-300">
      <div className="space-y-1">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <Pill className="h-4 w-4 text-primary" />
          شیوه و مصرف دارو
        </h3>
        <p className="text-xs text-muted-foreground">داروهای ثبت‌شده توسط متخصص برای این پرونده.</p>
      </div>

      {(medications || []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
          هنوز دارویی برای این پرونده ثبت نشده است.
        </div>
      ) : (
        <div className="space-y-3">
          {medications.map((item) => (
            <div key={item.id} className="rounded-2xl border border-border/60 bg-background px-4 py-4">
              <div className="text-sm font-semibold">{item.drug_name}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {[item.dosage, item.timing, item.duration].filter(Boolean).join(" • ") || "بدون جزئیات تکمیلی"}
              </div>
              {item.usage_instructions ? <div className="mt-3 text-sm leading-6">{item.usage_instructions}</div> : null}
              {item.notes ? <div className="mt-2 text-xs leading-6 text-muted-foreground">{item.notes}</div> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
