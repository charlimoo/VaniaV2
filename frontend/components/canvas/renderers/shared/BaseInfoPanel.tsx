"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, BriefcaseBusiness, Eye, FileText, FlaskConical, Globe, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DynamicForm } from "@/components/tool-ui/form/dynamic-form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CaseSummary, ClinicalTestEntry, FormDefinition } from "@/lib/types/vania";

interface Props {
  profile: Record<string, any>;
  forms: any[];
  tests: ClinicalTestEntry[];
  cases: CaseSummary[];
  onOpenCase: (caseId: string) => void;
  onEditProfile?: () => void;
  caseAction?: ReactNode;
  canEditProfile?: boolean;
  emptyCasesText: string;
  availableForms?: FormDefinition[];
  renderCaseActions?: (item: CaseSummary) => ReactNode;
}

type SchemaField = {
  name?: string;
  label?: string;
  type: string;
  fields?: SchemaField[];
  columns?: Array<{ name: string; label: string; type?: string }>;
};

type ProfileSection = {
  title: string;
  fields: Array<SchemaField & { key: string; social?: string }>;
};

const hasValue = (value: unknown) => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

const toText = (value: unknown) => {
  if (Array.isArray(value)) return value.join("، ");
  return String(value);
};

const SOCIAL_FIELD_MAP: Record<string, string> = {
  social_instagram: "instagram",
  social_x: "x",
  social_linkedin: "linkedin",
  social_telegram: "telegram",
  social_website: "website",
};

const FALLBACK_PROFILE_SECTIONS: ProfileSection[] = [
  {
    title: "هویت و پرونده",
    fields: [
      { key: "full_name", label: "نام و نام خانوادگی", type: "text" },
      { key: "national_id", label: "شماره ملی", type: "text" },
      { key: "gender", label: "جنسیت", type: "text" },
      { key: "birth_date", label: "تاریخ تولد", type: "date" },
    ],
  },
  {
    title: "راه‌های ارتباطی",
    fields: [
      { key: "mobile_phone", label: "شماره موبایل", type: "text" },
      { key: "home_phone", label: "تلفن ثابت", type: "text" },
      { key: "email", label: "ایمیل", type: "email" },
      { key: "preferred_contact_method", label: "راه ارتباطی ترجیحی", type: "text" },
      { key: "address_home", label: "نشانی محل سکونت", type: "textarea" },
      { key: "address_work", label: "نشانی محل کار", type: "textarea" },
    ],
  },
];

const normalizeSocialHref = (type: string, value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const handle = trimmed.replace(/^@/, "");
  if (!handle) return null;

  switch (type) {
    case "instagram":
      return `https://instagram.com/${handle}`;
    case "x":
      return `https://x.com/${handle}`;
    case "linkedin":
      return handle.includes("/") ? `https://linkedin.com/${handle}` : `https://linkedin.com/in/${handle}`;
    case "telegram":
      return `https://t.me/${handle}`;
    case "website":
      return `https://${handle}`;
    default:
      return null;
  }
};

export function BaseInfoPanel({
  profile,
  forms,
  tests,
  cases,
  onOpenCase,
  onEditProfile,
  caseAction,
  canEditProfile = false,
  emptyCasesText,
  availableForms = [],
  renderCaseActions,
}: Props) {
  const [activeFormEntry, setActiveFormEntry] = useState<any | null>(null);
  const visibleForms = (forms || []).filter((item) => item?.form_key !== "BASE_PROFILE_V1" && item?.data?.form_key !== "BASE_PROFILE_V1");
  const baseProfileDefinition = useMemo(
    () => (availableForms || []).find((form) => form.key === "BASE_PROFILE_V1") || null,
    [availableForms]
  );
  const profileSections = useMemo<ProfileSection[]>(() => {
    const schema = baseProfileDefinition?.schema || [];
    if (!schema.length) return FALLBACK_PROFILE_SECTIONS;

    return schema
      .filter((field) => field.type === "section")
      .map((section) => ({
        title: section.title || section.label || "بخش",
        fields: (section.fields || [])
          .filter((field) => !!field.name)
          .map((field) => ({
            ...field,
            key: field.name as string,
            social: field.name ? SOCIAL_FIELD_MAP[field.name] : undefined,
          })),
      }));
  }, [baseProfileDefinition]);
  const visibleProfileSections = profileSections
    .map((section) => ({
      ...section,
      fields: section.fields.filter((field) => hasValue(profile?.[field.key])),
    }))
    .filter((section) => section.fields.length > 0);
  const activeFormDefinition = useMemo(() => {
    const formKey = activeFormEntry?.form_key || activeFormEntry?.data?.form_key;
    return (availableForms || []).find((form) => form.key === formKey) || null;
  }, [activeFormEntry, availableForms]);

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">پرونده‌ها</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              برای ورود به هر پرونده، آن را از فهرست زیر انتخاب کنید.
            </p>
          </div>
          {caseAction}
        </div>

        <div className="grid gap-3">
          {cases.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border/70 bg-background/70 px-4 py-5 text-sm text-muted-foreground">
              {emptyCasesText}
            </div>
          ) : (
            cases.map((item) => (
              <div
                key={item.id}
                className="group flex w-full items-center justify-between gap-4 rounded-3xl border border-primary/25 bg-primary/8 px-4 py-4 text-right transition hover:border-primary/45 hover:bg-primary/12"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <BriefcaseBusiness className="h-4 w-4 text-primary" />
                    <span className="truncate">{item.title}</span>
                    {item.is_read_only ? <Badge variant="outline" className="text-[10px]">فقط مشاهده</Badge> : null}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {item.doctor_name || "بدون متخصص"}
                    {item.doctor_profession_label ? ` • ${item.doctor_profession_label}` : ""}
                    {item.updated_at ? ` • آخرین بروزرسانی: ${new Date(item.updated_at).toLocaleDateString("fa-IR")}` : ""}
                  </div>
                  {(item.shared_with?.length || 0) > 0 ? (
                    <div className="mt-2 text-[11px] text-muted-foreground">
                      اشتراک فقط-خواندنی با {item.shared_with?.map((share) => share.grantee_doctor_name).join("، ")}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {renderCaseActions ? <div>{renderCaseActions(item)}</div> : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onOpenCase(item.id)}
                    className="inline-flex h-8 items-center gap-1 px-2 text-xs font-medium text-primary transition group-hover:translate-x-[-2px]"
                  >
                    ورود
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">اطلاعات پایه</h2>

          </div>
          {canEditProfile && onEditProfile && (
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onEditProfile}>
              <Pencil className="h-3.5 w-3.5" />
              {profile?.full_name ? "ویرایش اطلاعات پایه" : "تکمیل اطلاعات پایه"}
            </Button>
          )}
        </div>

        {visibleProfileSections.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            هنوز اطلاعات پایه‌ای ثبت نشده است.
          </div>
        ) : (
          <div className="space-y-6">
            {visibleProfileSections.map((section) => (
              <div key={section.title} className="space-y-3">
                <div className="text-xs font-regular text-primary/70">{section.title}</div>
                <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
                  {section.fields.map((field) => {
                    const rawValue = profile?.[field.key];
                    const href = typeof rawValue === "string" && field.social ? normalizeSocialHref(field.social, rawValue) : null;

                    if (field.type === "datagrid" && Array.isArray(rawValue)) {
                      return (
                        <div key={field.key} className="sm:col-span-2 xl:col-span-3">
                          <div className="mb-2 text-[11px] text-muted-foreground">{field.label}</div>
                          <div className="overflow-hidden rounded-2xl border border-border/60">
                            <Table>
                              <TableHeader className="bg-muted/30">
                                <TableRow className="hover:bg-transparent">
                                  {(field.columns || []).map((column) => (
                                    <TableHead key={column.name} className="text-right text-xs font-medium">
                                      {column.label}
                                    </TableHead>
                                  ))}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {rawValue.map((row: Record<string, unknown>, index: number) => (
                                  <TableRow key={`${field.key}-${index}`}>
                                    {(field.columns || []).map((column) => (
                                      <TableCell key={column.name} className="text-xs whitespace-normal">
                                        {hasValue(row?.[column.name]) ? toText(row[column.name]) : "-"}
                                      </TableCell>
                                    ))}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={field.key} className="border-b border-border/50 pb-2">
                        <div className="text-[11px] text-muted-foreground">{field.label}</div>
                        <div className="mt-1 text-sm font-medium leading-6">
                          {href ? (
                            <Link href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                              <Globe className="h-3.5 w-3.5" />
                              {toText(rawValue)}
                            </Link>
                          ) : (
                            toText(rawValue)
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>



      <Dialog open={!!activeFormEntry} onOpenChange={(open) => !open && setActiveFormEntry(null)}>
        <DialogContent dir="rtl" className="w-[calc(100vw-2rem)] max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{activeFormEntry?.data?.form_title || activeFormEntry?.type || activeFormEntry?.form_key || "فرم ثبت‌شده"}</DialogTitle>
          </DialogHeader>

          {activeFormEntry && activeFormDefinition ? (
            <DynamicForm
              formHandle={activeFormDefinition.handler}
              schema={activeFormDefinition.schema}
              prefill={activeFormEntry.data || {}}
              title={activeFormDefinition.title}
              description={activeFormDefinition.description}
              disabled
              readOnly
              hideSubmit
            />
          ) : (
            <div className="text-sm text-muted-foreground">تعریف این فرم برای نمایش پیدا نشد.</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
