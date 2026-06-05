"use client";

import { CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";

type ResultObject = Record<string, unknown>;

interface Props {
  result?: unknown;
  rawText?: string;
  emptyText?: string;
  className?: string;
}

const isRecord = (value: unknown): value is ResultObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseRawText = (rawText?: string): unknown => {
  if (!rawText?.trim()) return null;
  try {
    return JSON.parse(rawText);
  } catch {
    return rawText;
  }
};

const getString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
};

const primitiveRows = (payload: unknown, prefix = ""): Array<{ label: string; value: string }> => {
  if (!isRecord(payload)) return [];

  const rows: Array<{ label: string; value: string }> = [];
  Object.entries(payload).forEach(([key, value]) => {
    if (["summary", "interpretation", "description", "answers_payload"].includes(key)) return;
    const label = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      rows.push({ label, value: String(value) });
    }
  });
  return rows.slice(0, 8);
};

export function InteractiveTestResultView({
  result,
  rawText,
  emptyText = "نتیجه هنوز آماده نیست.",
  className = "",
}: Props) {
  const source = result ?? parseRawText(rawText);

  if (!source || (typeof source === "string" && !source.trim())) {
    return (
      <div className={`rounded-xl border border-dashed bg-muted/10 px-4 py-5 text-center text-xs text-muted-foreground ${className}`}>
        {emptyText}
      </div>
    );
  }

  if (typeof source === "string") {
    return (
      <div className={`rounded-xl border bg-muted/10 p-3 text-sm leading-7 text-foreground ${className}`}>
        {source}
      </div>
    );
  }

  const container = isRecord(source) ? source : {};
  const resultPayload = isRecord(container.result)
    ? container.result
    : isRecord(container.json)
      ? container.json
      : container;
  const gradingPayload = isRecord(container.grading) ? container.grading : {};
  const summary = getString(
    resultPayload.summary,
    resultPayload.interpretation,
    resultPayload.description,
    container.summary
  );
  const rows = [...primitiveRows(resultPayload), ...primitiveRows(gradingPayload, "grading")];
  const rawJson = JSON.stringify(source, null, 2);

  return (
    <div className={`space-y-3 rounded-xl border bg-background/70 p-3 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          نتیجه آماده است
        </div>
        <Badge variant="outline" className="text-[10px] font-normal">
          تست تعاملی
        </Badge>
      </div>

      {summary ? (
        <p className="rounded-lg bg-muted/20 px-3 py-2 text-sm leading-7 text-foreground">
          {summary}
        </p>
      ) : null}

      {rows.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {rows.map((row) => (
            <div key={`${row.label}-${row.value}`} className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
              <div className="text-[10px] text-muted-foreground">{row.label}</div>
              <div className="mt-1 break-words text-xs font-medium text-foreground">{row.value}</div>
            </div>
          ))}
        </div>
      ) : null}

      <details className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-xs">
        <summary className="cursor-pointer text-muted-foreground">جزئیات</summary>
        <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap text-left text-[11px] leading-5 text-muted-foreground" dir="ltr">
          {rawJson}
        </pre>
      </details>
    </div>
  );
}
