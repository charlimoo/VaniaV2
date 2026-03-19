"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, BookOpen, FileText, FolderOpen, History, LifeBuoy, Pill, Route } from "lucide-react";
import { cn } from "@/lib/utils";
import { PatientJourneyState, VisitorCanvasTab } from "@/lib/types/vania";
import { useUser } from "@/hooks/use-user";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DynamicForm } from "@/components/tool-ui/form/dynamic-form";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { useCanvasStore } from "@/lib/canvas/store";
import { PatientHomeTab } from "./patient/PatientHomeTab";
import { PatientRescueNetTab } from "./patient/PatientRescueNetTab";
import { PatientTimelineTab } from "./patient/PatientTimelineTab";
import { PatientLibraryTab } from "./patient/PatientLibraryTab";
import { PatientMedicationsTab } from "./patient/PatientMedicationsTab";
import { PatientTestsTab } from "./patient/PatientTestsTab";
import { BaseInfoPanel } from "./shared/BaseInfoPanel";
import { CaseFilesTab } from "./shared/CaseFilesTab";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { CaseShareCandidate, CaseShareGrant, CaseSummary } from "@/lib/types/vania";

interface Props {
  data: PatientJourneyState;
  onEdit: (delta: Partial<PatientJourneyState>) => void;
  isLocked: boolean;
}

const replaceCaseScopedEntries = <T extends { case_id?: string | null }>(
  existingEntries: T[] = [],
  caseEntries: T[] = [],
  caseId?: string | null
) => {
  if (!caseId) return existingEntries;
  const untouchedEntries = (existingEntries || []).filter((entry) => entry?.case_id !== caseId);
  return [...caseEntries, ...untouchedEntries];
};

export default function PatientJourneyCanvas({ data, onEdit }: Props) {
  const { user } = useUser();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const setInstances = useCanvasStore((state) => state.setInstances);
  const [activeView, setActiveView] = useState<"BASE" | "CASES">(data.active_view || "CASES");
  const [activeTab, setActiveTab] = useState<string>(data.active_tab || "CASE_OVERVIEW");
  const [baseInfoOpen, setBaseInfoOpen] = useState(false);
  const [pendingCaseId, setPendingCaseId] = useState<string | null>(null);
  const [shareDialogCase, setShareDialogCase] = useState<CaseSummary | null>(null);
  const [shareCandidates, setShareCandidates] = useState<CaseShareCandidate[]>([]);
  const [currentShares, setCurrentShares] = useState<CaseShareGrant[]>([]);
  const [selectedShareExpertId, setSelectedShareExpertId] = useState<string>("");
  const [isShareLoading, setIsShareLoading] = useState(false);
  const [isSubmittingShare, setIsSubmittingShare] = useState(false);

  const threadId = typeof params.threadId === "string" ? params.threadId : null;
  const agentId = typeof params.agentId === "string" ? params.agentId : null;
  const isChatCanvas = !!threadId && !!agentId;

  useEffect(() => {
    if (data.active_view && data.active_view !== activeView) setActiveView(data.active_view);
  }, [data.active_view, activeView]);

  useEffect(() => {
    if (data.active_tab && data.active_tab !== activeTab) setActiveTab(data.active_tab);
  }, [data.active_tab, activeTab]);

  useEffect(() => {
    if (!pendingCaseId) return;
    if (data.selected_case_id === pendingCaseId && data.selected_case?.id === pendingCaseId) {
      setPendingCaseId(null);
    }
  }, [data.selected_case_id, data.selected_case?.id, pendingCaseId]);

  const selectedCase = data.selected_case;
  const baseProfileForm = data.base_profile?.form || {};
  const baseProfileDefinition = (data.available_forms || []).find((form) => form.key === "BASE_PROFILE_V1");
  const visibleSelectedCase = pendingCaseId ? null : selectedCase;
  const visibleTabs = (visibleSelectedCase?.visible_tabs || data.visible_tabs || ["CASE_OVERVIEW"]) as VisitorCanvasTab[];
  const featurePolicy = visibleSelectedCase?.feature_policy || data.feature_policy;
  const caseOverviewSections = visibleSelectedCase?.case_overview_sections || data.case_overview_sections || [];

  useEffect(() => {
    if (activeView !== "CASES" || !visibleTabs.length) return;
    if (!visibleTabs.includes(activeTab as VisitorCanvasTab)) {
      const nextTab = visibleTabs[0];
      setActiveTab(nextTab);
      onEdit({ active_tab: nextTab } as any);
    }
  }, [activeTab, activeView, onEdit, visibleTabs]);

  const buildScopedSearchParams = (doctorId?: number | null, caseId?: string | null) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (doctorId) {
      nextParams.set("expertId", String(doctorId));
      nextParams.set("doctorId", String(doctorId));
    } else {
      nextParams.delete("expertId");
      nextParams.delete("doctorId");
    }
    if (caseId) {
      nextParams.set("caseId", caseId);
    } else {
      nextParams.delete("caseId");
    }
    return nextParams;
  };

  const hydrateChatCanvas = async (doctorId: number, caseId: string) => {
    if (!threadId || !agentId || !user?.id) return;
    const headers = getAuthHeaders();
    if (!headers.Authorization) return;

    headers["X-Target-Resource-ID"] = String(user.id);
    headers["X-Target-Expert-ID"] = String(doctorId);
    headers["X-Target-Doctor-ID"] = String(doctorId);
    headers["X-Target-Case-ID"] = caseId;

    const query = new URLSearchParams({ agent_id: agentId });
    query.set("visitor_id", String(user.id));
    query.set("patient_id", String(user.id));
    query.set("expert_id", String(doctorId));
    query.set("doctor_id", String(doctorId));
    query.set("case_id", caseId);

    const res = await fetch(`${API_BASE_URL}/agent/canvas/state/${threadId}?${query.toString()}`, { headers });
    if (!res.ok) return;

    const body = await res.json();
    if (Array.isArray(body.canvases)) {
      setInstances(body.canvases);
    }
  };

  const handleOpenCase = async (caseId: string) => {
    const caseMeta = (data.cases || []).find((item) => item.id === caseId);
    if (!caseMeta?.doctor_id) return;

    setPendingCaseId(caseId);
    setActiveView("CASES");
    setActiveTab(((caseMeta as any).visible_tabs || ["CASE_OVERVIEW"])[0]);

    const nextParams = buildScopedSearchParams(caseMeta.doctor_id, caseId);
    const nextQuery = nextParams.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
    const currentUrl = `${window.location.pathname}${window.location.search}`;

    if (nextUrl !== currentUrl) {
      router.replace(nextUrl);
    }

    if (isChatCanvas) {
      await hydrateChatCanvas(caseMeta.doctor_id, caseId);
      return;
    }

    onEdit({
      active_view: "CASES",
      active_tab: ((caseMeta as any).visible_tabs || ["CASE_OVERVIEW"])[0],
      selected_case_id: caseId,
      selected_doctor_id: caseMeta.doctor_id,
    } as any);
  };

  const handleBackToBase = () => {
    setActiveView("BASE");
    setPendingCaseId(null);

    const nextParams = buildScopedSearchParams(null, null);
    const nextQuery = nextParams.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (nextUrl !== currentUrl) {
      router.replace(nextUrl);
    }

    onEdit({
      active_view: "BASE",
      selected_case_id: null,
      selected_doctor_id: null,
    } as any);
  };
  const handleBaseProfileSuccess = (formData: Record<string, any>) => {
    onEdit({
      base_profile: {
        ...data.base_profile,
        form: {
          ...baseProfileForm,
          ...formData,
          form_key: "BASE_PROFILE_V1",
          form_title: baseProfileDefinition?.title || "اطلاعات پایه",
        },
      },
    } as any);
    setBaseInfoOpen(false);
  };

  const handleSelectedCaseEdit = (delta: Record<string, any>) => {
    if (!visibleSelectedCase) return;

    const nextSelectedCase = { ...visibleSelectedCase, ...delta };
    const nextDelta: Record<string, any> = { selected_case: nextSelectedCase };

    if (Array.isArray(delta.forms)) {
      nextDelta.base_profile = {
        ...data.base_profile,
        forms: replaceCaseScopedEntries(data.base_profile.forms || [], delta.forms, visibleSelectedCase.id || undefined),
      };
    }

    if (Array.isArray(delta.tests)) {
      nextDelta.base_profile = {
        ...(nextDelta.base_profile || data.base_profile),
        tests: replaceCaseScopedEntries(data.base_profile.tests || [], delta.tests, visibleSelectedCase.id || undefined),
      };
    }

    onEdit(nextDelta as any);
  };

  const openShareDialog = async (caseItem: CaseSummary) => {
    setShareDialogCase(caseItem);
    setSelectedShareExpertId("");
    setIsShareLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/vania/cases/${caseItem.id}/share-options/`, {
        headers: { ...getAuthHeaders() },
      });
      if (!res.ok) throw new Error("دریافت اطلاعات اشتراک پرونده ناموفق بود.");
      const body = await res.json();
      setShareCandidates(Array.isArray(body?.candidates) ? body.candidates : []);
      setCurrentShares(Array.isArray(body?.current_shares) ? body.current_shares : []);
    } catch (error: any) {
      toast.error(error?.message || "خطا در دریافت تنظیمات اشتراک.");
      setShareDialogCase(null);
    } finally {
      setIsShareLoading(false);
    }
  };

  const grantReadOnlyAccess = async () => {
    if (!shareDialogCase || !selectedShareExpertId) return;
    setIsSubmittingShare(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/vania/cases/${shareDialogCase.id}/shares/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ expert_id: Number(selectedShareExpertId) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "ثبت اشتراک ناموفق بود.");
      const nextShare = body as CaseShareGrant;
      const nextShares = [nextShare, ...currentShares.filter((item) => item.grantee_doctor_id !== nextShare.grantee_doctor_id)];
      setCurrentShares(nextShares);
      setShareCandidates((prev) => prev.filter((item) => String(item.id) !== selectedShareExpertId));
      setSelectedShareExpertId("");
      onEdit({
        cases: (data.cases || []).map((item) =>
          item.id === shareDialogCase.id ? { ...item, shared_with: nextShares } : item
        ),
      } as any);
      toast.success("دسترسی فقط-خواندنی ثبت شد.");
    } catch (error: any) {
      toast.error(error?.message || "خطا در ثبت اشتراک.");
    } finally {
      setIsSubmittingShare(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-background" dir="rtl">
      <div className="shrink-0 border-b border-border/40 bg-background/80 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Route className="h-4 w-4 text-primary" />
              مسیر من
            </h2>
            {activeView === "CASES" && visibleSelectedCase?.doctor_name ? (
              <p className="text-xs text-muted-foreground">
                متخصص فعال: {visibleSelectedCase.doctor_name}
                {visibleSelectedCase.doctor_profession_label ? ` • ${visibleSelectedCase.doctor_profession_label}` : ""}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">اطلاعات پایه و فهرست پرونده‌ها از اینجا قابل مشاهده است.</p>
            )}
          </div>

          {activeView === "CASES" && (visibleSelectedCase || pendingCaseId) ? (
            <button
              type="button"
              onClick={handleBackToBase}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              بازگشت به اطلاعات پایه
            </button>
          ) : (
            <div className="rounded-full bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
              اطلاعات پایه
            </div>
          )}
        </div>

        {activeView === "CASES" && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/40 pt-3">
            <div className="ml-2 text-sm font-semibold">{visibleSelectedCase?.title || "پرونده"}</div>
            {[
              { id: "CASE_OVERVIEW", label: "پرونده و فرم‌ها", icon: FileText },
              { id: "RESCUENET", label: "تور نجات", icon: LifeBuoy },
              { id: "MEDICATIONS", label: "شیوه و مصرف دارو", icon: Pill },
              { id: "TIMELINE", label: "مسیر من", icon: History },
              { id: "LIBRARY", label: "کتابخانه", icon: BookOpen },
              { id: "FILES", label: "فایل‌ها", icon: FolderOpen },
            ].filter((tab) => visibleTabs.includes(tab.id as VisitorCanvasTab)).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  onEdit({ active_tab: tab.id as any });
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] transition",
                  activeTab === tab.id ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-muted/5 p-4 sm:p-6">
        {activeView === "BASE" && (
          <div className="space-y-8">
            <BaseInfoPanel
              profile={baseProfileForm}
              forms={data.base_profile.forms || []}
              tests={data.base_profile.tests || []}
              cases={data.cases || []}
              availableForms={data.available_forms || []}
              onOpenCase={handleOpenCase}
              onEditProfile={() => setBaseInfoOpen(true)}
              canEditProfile={!!baseProfileDefinition}
              emptyCasesText="هنوز پرونده‌ای برای شما ثبت نشده است."
              renderCaseActions={(item) => (
                <Button type="button" variant="ghost" size="sm" className="h-8 text-[11px]" onClick={() => openShareDialog(item)}>
                  اشتراک مشاهده
                </Button>
              )}
            />
          </div>
        )}

        {activeView === "CASES" && !visibleSelectedCase && (
          <div className="flex min-h-[320px] items-center justify-center text-sm text-muted-foreground">
            در حال بارگذاری پرونده...
          </div>
        )}

        {activeView === "CASES" && visibleSelectedCase && activeTab === "CASE_OVERVIEW" && (
          <div className="space-y-8">
            <PatientHomeTab
              greeting={visibleSelectedCase.title}
              activeGoals={[]}
              clinicalSummary={visibleSelectedCase.clinical_summary || ""}
              formsTestsAnalysis={visibleSelectedCase.forms_tests_analysis || ""}
              forms={caseOverviewSections.includes("forms") ? visibleSelectedCase.forms || [] : []}
              tests={caseOverviewSections.includes("tests") ? visibleSelectedCase.tests || [] : []}
              showClinicalSummary={caseOverviewSections.includes("clinical_summary")}
              showFormsTestsAnalysis={caseOverviewSections.includes("forms_tests_analysis")}
              showForms={caseOverviewSections.includes("forms")}
              showTests={false}
            />
            {caseOverviewSections.includes("tests") ? <PatientTestsTab
              tests={visibleSelectedCase.tests || []}
              selectedDoctorId={visibleSelectedCase.doctor_id}
              selectedCaseId={visibleSelectedCase.id || undefined}
              onEdit={handleSelectedCaseEdit}
              title={visibleSelectedCase.test_mode === "exams_only" ? "آزمایش های من" : "تست های من"}
              createLabel={visibleSelectedCase.test_mode === "exams_only" ? "ثبت نتیجه آزمایش" : "آپلود نتیجه"}
              emptyText={visibleSelectedCase.test_mode === "exams_only" ? "هنوز آزمایشی برای این پرونده ثبت نشده است." : "هنوز تستی توسط متخصص ثبت نشده است."}
            /> : null}
          </div>
        )}

        {activeView === "CASES" && visibleSelectedCase && activeTab === "RESCUENET" && featurePolicy?.rescue_net_enabled && (
          <PatientRescueNetTab
            tasks={visibleSelectedCase.tasks || []}
            selectedDoctorId={visibleSelectedCase.doctor_id}
            selectedCaseId={visibleSelectedCase.id || undefined}
            onEdit={handleSelectedCaseEdit}
          />
        )}

        {activeView === "CASES" && visibleSelectedCase && activeTab === "MEDICATIONS" && featurePolicy?.medications_enabled && (
          <PatientMedicationsTab medications={visibleSelectedCase.medications || []} />
        )}

        {activeView === "CASES" && visibleSelectedCase && activeTab === "TIMELINE" && featurePolicy?.timeline_enabled && (
          <PatientTimelineTab
            sessions={visibleSelectedCase.timeline || []}
            patientName={visibleSelectedCase.title || "پرونده"}
          />
        )}

        {activeView === "CASES" && visibleSelectedCase && activeTab === "LIBRARY" && featurePolicy?.library_enabled && (
          <PatientLibraryTab
            library={visibleSelectedCase.library || []}
            selectedDoctorId={visibleSelectedCase.doctor_id}
            selectedCaseId={visibleSelectedCase.id || undefined}
            onEdit={handleSelectedCaseEdit}
          />
        )}

        {activeView === "CASES" && visibleSelectedCase && activeTab === "FILES" && featurePolicy?.files_enabled && (
          <CaseFilesTab
            files={visibleSelectedCase.files || []}
            selectedDoctorId={visibleSelectedCase.doctor_id}
            selectedCaseId={visibleSelectedCase.id || undefined}
            onEdit={handleSelectedCaseEdit}
          />
        )}
      </div>

      <Dialog open={baseInfoOpen} onOpenChange={setBaseInfoOpen}>
        <DialogContent dir="rtl" className="w-[calc(100vw-2rem)] max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{baseProfileDefinition?.title || "اطلاعات پایه"}</DialogTitle>
            <DialogDescription>
              این فرم به پروفایل مشترک شما تعلق دارد و تغییرات آن برای متخصصان متصل نیز قابل مشاهده خواهد بود.
            </DialogDescription>
          </DialogHeader>

          {baseProfileDefinition && user?.id && (
            <DynamicForm
              formHandle={baseProfileDefinition.handler}
              schema={baseProfileDefinition.schema}
              prefill={{
                ...baseProfileForm,
                form_key: baseProfileDefinition.key,
                form_title: baseProfileDefinition.title,
              }}
              title={baseProfileDefinition.title}
              description={baseProfileDefinition.description}
              onSuccess={handleBaseProfileSuccess}
              patientId={user.id}
              sessionId={`visitor-base-profile-${user.id}`}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!shareDialogCase} onOpenChange={(open) => !open && setShareDialogCase(null)}>
        <DialogContent dir="rtl" className="w-[calc(100vw-2rem)] max-w-xl">
          <DialogHeader>
            <DialogTitle>اشتراک فقط-خواندنی پرونده</DialogTitle>
            <DialogDescription>
              فقط متخصصان هم‌نوع با متخصص این پرونده در این فهرست نشان داده می‌شوند. دسترسی جدید فقط برای مشاهده است و امکان ویرایش ندارد.
            </DialogDescription>
          </DialogHeader>

          {isShareLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">در حال بارگذاری...</div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-2xl bg-muted/20 px-4 py-3 text-sm">
                <div className="font-semibold">{shareDialogCase?.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {shareDialogCase?.doctor_name || "بدون متخصص"}
                  {shareDialogCase?.doctor_profession_label ? ` • ${shareDialogCase.doctor_profession_label}` : ""}
                </div>
              </div>

              <div className="space-y-2">
                <Label>افزودن متخصص جدید</Label>
                <div className="flex gap-2">
                  <Select value={selectedShareExpertId} onValueChange={setSelectedShareExpertId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="یک متخصص هم‌نوع انتخاب کنید" />
                    </SelectTrigger>
                    <SelectContent>
                      {shareCandidates.map((candidate) => (
                        <SelectItem key={candidate.id} value={String(candidate.id)}>
                          {candidate.name} {candidate.profession_label ? `• ${candidate.profession_label}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={grantReadOnlyAccess} disabled={!selectedShareExpertId || isSubmittingShare}>
                    ثبت دسترسی
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>اشتراک‌های فعال</Label>
                {currentShares.length === 0 ? (
                  <div className="text-sm text-muted-foreground">هنوز اشتراک فقط-خواندنی ثبت نشده است.</div>
                ) : (
                  <div className="space-y-2">
                    {currentShares.map((share) => (
                      <div key={share.grantee_doctor_id} className="flex items-center justify-between rounded-2xl border border-border/60 px-4 py-3 text-sm">
                        <div>
                          <div className="font-medium">{share.grantee_doctor_name}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {share.grantee_doctor_profession_label || share.grantee_doctor_role_label || "متخصص"}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">فقط مشاهده</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
