"use client";

import { CheckCircle2, ChevronDown, Gauge, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";

type ResultObject = Record<string, unknown>;

interface Props {
  result?: unknown;
  rawText?: string;
  emptyText?: string;
  className?: string;
}

type TextSection = {
  key: string;
  title: string;
  text: string;
};

type ScoreItem = {
  key: string;
  label: string;
  value: string;
};

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

const technicalKeys = new Set([
  "answers_payload",
  "raw",
  "type",
  "uuid",
  "employee_id",
  "test_id",
  "age",
  "sex",
]);

const scoreKeys = new Set([
  "score",
  "total_score",
  "total",
  "percent",
  "total_percent",
  "result",
  "grade",
  "level",
]);

const textKeys = new Set([
  "summary",
  "interpretation",
  "description",
  "response",
  "solution",
  "int_solution",
  "text",
  "message",
]);

const labelMap: Record<string, string> = {
  score: "نمره",
  total_score: "نمره کل",
  total: "مجموع",
  percent: "درصد",
  total_percent: "درصد کل",
  result: "نتیجه",
  grade: "سطح",
  level: "سطح",
  summary: "خلاصه",
  interpretation: "تفسیر",
  description: "توضیح",
  response: "پیشنهادها",
  solution: "راهکارها",
  int_solution: "راهکارهای تکمیلی",
  emotional_intelligence: "هوش هیجانی",
  grading: "نمره گذاری",
};

const isTechnicalKey = (key: string) => technicalKeys.has(key) || /^q\d+$/i.test(key);

const readableLabel = (key: string) => {
  if (labelMap[key]) return labelMap[key];
  return key.replace(/_/g, " ");
};

const decodeHtml = (value: string) => {
  let output = value;
  for (let index = 0; index < 4; index += 1) {
    const before = output;
    if (typeof window !== "undefined") {
      const textarea = document.createElement("textarea");
      textarea.innerHTML = output;
      output = textarea.value;
    } else {
      output = output
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    }
    if (output === before) break;
  }
  return output;
};

const cleanText = (value: unknown) => {
  if (value == null) return "";
  const text = typeof value === "string" ? value : String(value);
  return decodeHtml(text)
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|ul|ol|h\d)\s*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const firstString = (...values: unknown[]) => {
  for (const value of values) {
    const cleaned = cleanText(value);
    if (cleaned) return cleaned;
  }
  return "";
};

const unwrapPayload = (source: unknown) => {
  const container = isRecord(source) ? source : {};
  if (isRecord(container.result)) return container.result;
  if (isRecord(container.json)) return container.json;
  return container;
};

const walkResult = (
  payload: unknown,
  textSections: TextSection[],
  scores: ScoreItem[],
  path = "",
) => {
  if (!isRecord(payload)) return;

  Object.entries(payload).forEach(([key, value]) => {
    if (isTechnicalKey(key)) return;
    const currentPath = path ? `${path}.${key}` : key;

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      const cleaned = cleanText(value);
      if (!cleaned) return;
      if (scoreKeys.has(key) || (typeof value === "number" && cleaned.length <= 8)) {
        scores.push({ key: currentPath, label: readableLabel(key), value: cleaned });
        return;
      }
      if (textKeys.has(key) || cleaned.length > 40) {
        textSections.push({ key: currentPath, title: readableLabel(key), text: cleaned });
      }
      return;
    }

    if (isRecord(value)) {
      walkResult(value, textSections, scores, currentPath);
    }
  });
};

const collectOtherRows = (payload: unknown, prefix = ""): ScoreItem[] => {
  if (!isRecord(payload)) return [];
  return Object.entries(payload)
    .flatMap(([key, value]) => {
      if (isTechnicalKey(key) || textKeys.has(key) || scoreKeys.has(key)) return [];
      const currentPath = prefix ? `${prefix}.${key}` : key;
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        const cleaned = cleanText(value);
        return cleaned ? [{ key: currentPath, label: readableLabel(key), value: cleaned }] : [];
      }
      return [];
    })
    .slice(0, 6);
};

const fullPayloadForDisplay = (resultPayload: unknown, gradingPayload: unknown) => {
  const payload: Record<string, unknown> = {};
  if (isRecord(resultPayload) && Object.keys(resultPayload).length > 0) {
    payload.result_json = resultPayload;
  }
  if (isRecord(gradingPayload) && Object.keys(gradingPayload).length > 0) {
    payload.grading_json = gradingPayload;
  }
  return Object.keys(payload).length > 0 ? payload : null;
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
      <div className={`rounded-xl border bg-muted/10 p-3 text-sm leading-8 text-foreground ${className}`}>
        {cleanText(source)}
      </div>
    );
  }

  const container = isRecord(source) ? source : {};
  const resultPayload = unwrapPayload(source);
  const gradingPayload = isRecord(container.grading) ? container.grading : {};
  const textSections: TextSection[] = [];
  const scores: ScoreItem[] = [];

  walkResult(resultPayload, textSections, scores);
  walkResult(gradingPayload, textSections, scores, "grading");

  const summary = firstString(
    isRecord(resultPayload) ? resultPayload.summary : "",
    isRecord(resultPayload) ? resultPayload.interpretation : "",
    isRecord(resultPayload) ? resultPayload.description : "",
    container.summary,
  );
  const dedupedSections = textSections.filter(
    (section, index, list) => list.findIndex((item) => item.text === section.text) === index,
  );
  const dedupedScores = scores.filter(
    (score, index, list) => list.findIndex((item) => item.label === score.label && item.value === score.value) === index,
  );
  const otherRows = [
    ...collectOtherRows(resultPayload),
    ...collectOtherRows(gradingPayload, "grading"),
  ];
  const fullPayload = fullPayloadForDisplay(resultPayload, gradingPayload);

  return (
    <div className={`space-y-4 rounded-xl border bg-background p-4 ${className}`} dir="rtl">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          نتیجه آماده است
        </div>
        <Badge variant="outline" className="text-[10px] font-normal">
          تست تعاملی
        </Badge>
      </div>

      {dedupedScores.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-3">
          {dedupedScores.slice(0, 6).map((score) => (
            <div key={`${score.key}-${score.value}`} className="rounded-lg border bg-muted/10 px-3 py-3">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Gauge className="h-3.5 w-3.5" />
                {score.label}
              </div>
              <div className="mt-1 text-lg font-semibold text-foreground">{score.value}</div>
            </div>
          ))}
        </div>
      ) : null}

      {summary && dedupedSections.length === 0 ? (
        <p className="rounded-lg bg-muted/20 px-3 py-2 text-sm leading-8 text-foreground">
          {summary}
        </p>
      ) : null}

      {dedupedSections.length > 0 ? (
        <div className="space-y-3">
          {dedupedSections.map((section, index) => (
            <section key={section.key} className="rounded-lg border bg-muted/10 p-3">
              <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold" dir="rtl">
                {index === 0 ? <Sparkles className="h-4 w-4 text-primary" /> : null}
                {section.title}
              </h4>
              <div className="whitespace-pre-line text-sm leading-8 text-foreground" dir="rtl">
                {section.text}
              </div>
            </section>
          ))}
        </div>
      ) : null}

      {otherRows.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {otherRows.map((row) => (
            <div key={`${row.key}-${row.value}`} className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
              <div className="text-[10px] text-muted-foreground">{row.label}</div>
              <div className="mt-1 break-words text-xs font-medium text-foreground">{row.value}</div>
            </div>
          ))}
        </div>
      ) : null}

      {/* {fullPayload ? (
        <details className="group rounded-lg border border-border/70 bg-muted/10">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            <span>جزئیات کامل پاسخ ایسنج</span>
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
          </summary>
          <pre dir="ltr" className="max-h-96 overflow-auto border-t px-3 py-3 text-left text-[11px] leading-5 text-foreground">
            {JSON.stringify(fullPayload, null, 2)}
          </pre>
        </details>
      ) : null} */}
    </div>
  );
}
