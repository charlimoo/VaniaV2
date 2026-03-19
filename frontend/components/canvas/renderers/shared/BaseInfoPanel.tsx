"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, BriefcaseBusiness, Eye, FileText, FlaskConical, Globe, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DynamicForm } from "@/components/tool-ui/form/dynamic-form";
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

const PROFILE_SECTIONS = [
  {
    title: "هویت و پرونده",
    fields: [
      { key: "full_name", label: "نام و نام خانوادگی" },
      { key: "national_id", label: "شماره ملی" },
      { key: "file_number", label: "شماره پرونده" },
      { key: "file_date", label: "تاریخ تشکیل پرونده" },
      { key: "gender", label: "جنسیت" },
      { key: "birth_date", label: "تاریخ تولد" },
    ],
  },
  {
    title: "راه‌های ارتباطی",
    fields: [
      { key: "mobile_phone", label: "شماره موبایل" },
      { key: "home_phone", label: "تلفن ثابت" },
      { key: "email", label: "ایمیل" },
      { key: "preferred_contact_method", label: "راه ارتباطی ترجیحی" },
      { key: "address_home", label: "نشانی محل سکونت" },
      { key: "address_work", label: "نشانی محل کار" },
    ],
  },
  {
    title: "وضعیت فردی، تحصیلی و شغلی",
    fields: [
      { key: "marital_status", label: "وضعیت تأهل" },
      { key: "family_relation", label: "نسبت فامیلی با همسر" },
      { key: "children_count", label: "تعداد فرزندان" },
      { key: "education_level", label: "تحصیلات" },
      { key: "education_major", label: "رشته تحصیلی" },
      { key: "military_status", label: "وضعیت نظام وظیفه" },
      { key: "military_exempt_reason", label: "علت معافیت" },
      { key: "job_status", label: "وضعیت شغلی" },
      { key: "job_type", label: "نوع شغل" },
      { key: "job_title", label: "عنوان شغل" },
      { key: "income_approx", label: "درآمد تقریبی" },
    ],
  },
  {
    title: "شبکه‌های اجتماعی",
    fields: [
      { key: "social_instagram", label: "اینستاگرام", social: "instagram" },
      { key: "social_x", label: "ایکس", social: "x" },
      { key: "social_linkedin", label: "لینکدین", social: "linkedin" },
      { key: "social_telegram", label: "تلگرام", social: "telegram" },
      { key: "social_website", label: "وب‌سایت", social: "website" },
      { key: "social_other", label: "سایر راه‌های آنلاین" },
    ],
  },
  {
    title: "ارجاع",
    fields: [
      { key: "referral_source", label: "منبع ارجاع" },
    ],
  },
];

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
  const visibleProfileSections = PROFILE_SECTIONS.map((section) => ({
    ...section,
    fields: section.fields.filter((field) => hasValue(profile?.[field.key])),
  })).filter((section) => section.fields.length > 0);
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
              <button
                key={item.id}
                type="button"
                onClick={() => onOpenCase(item.id)}
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
                  {renderCaseActions ? <div onClick={(e) => e.stopPropagation()}>{renderCaseActions(item)}</div> : null}
                  <div className="inline-flex items-center gap-1 text-xs font-medium text-primary transition group-hover:translate-x-[-2px]">
                    ورود
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </div>
                </div>
              </button>
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
                <div className="text-sm font-semibold text-foreground">{section.title}</div>
                <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
                  {section.fields.map((field) => {
                    const rawValue = profile?.[field.key];
                    const href = typeof rawValue === "string" && field.social ? normalizeSocialHref(field.social, rawValue) : null;

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

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">ثبت‌های پایه</h3>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <FlaskConical className="h-4 w-4 text-primary" />
                تست‌های ثبت‌شده
              </h3>
              <Badge variant="outline">{tests.length}</Badge>
            </div>
            <div className="grid gap-3">
              {tests.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/60 px-4 py-5 text-sm text-muted-foreground">
                  هنوز تستی ثبت نشده است.
                </div>
              ) : (
                tests.map((test) => (
                  <div key={test.id} className="border-b border-border/50 pb-3">
                    <div className="text-sm font-medium">{test.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{test.result_text || test.result_summary || "متن نتیجه هنوز ثبت نشده است."}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <FileText className="h-4 w-4 text-primary" />
                فرم‌های ثبت‌شده
              </h3>
              <Badge variant="outline">{visibleForms.length}</Badge>
            </div>
            <div className="grid gap-3">
              {visibleForms.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/60 px-4 py-5 text-sm text-muted-foreground">
                  هنوز فرم دیگری ثبت نشده است.
                </div>
              ) : (
                visibleForms.map((form, index) => (
                  <div key={form.id || index} className="flex items-center justify-between gap-3 border-b border-border/50 pb-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{form.data?.form_title || form.type || form.form_key}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {form.date ? new Date(form.date).toLocaleDateString("fa-IR") : "بدون تاریخ"}
                      </div>
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => setActiveFormEntry(form)}>
                      <Eye className="h-3.5 w-3.5" />
                      مشاهده فرم
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
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
