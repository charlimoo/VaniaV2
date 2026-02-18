// frontend/components/ui/persian-date-picker.tsx
"use client";

import DatePicker, { DateObject } from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PersianDatePickerProps {
  value?: string;
  onChange: (date: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function PersianDatePicker({
  value,
  onChange,
  placeholder = "انتخاب تاریخ...",
  className,
  disabled = false,
}: PersianDatePickerProps) {
  return (
    <div className={cn("relative w-full", className)}>
      <DatePicker
        value={value}
        onChange={(date: DateObject | null) => {
          // Returns string format "1403/05/21"
          if (date) {
            onChange(date.format("YYYY/MM/DD"));
          } else {
            onChange("");
          }
        }}
        calendar={persian}
        locale={persian_fa}
        calendarPosition="bottom-right"
        disabled={disabled}
        format="YYYY/MM/DD"
        containerClassName="w-full"
        inputClass={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-right font-mono",
          !value && "text-muted-foreground"
        )}
        placeholder={placeholder}
        arrow={false}
      />
      <CalendarIcon className="absolute left-3 top-2.5 h-4 w-4 opacity-50 pointer-events-none" />
    </div>
  );
}