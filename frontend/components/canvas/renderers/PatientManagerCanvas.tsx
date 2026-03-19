"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowRight, BriefcaseBusiness, Ellipsis, FileText, FolderOpen, Library, LifeBuoy, Loader2, Pencil, Pill, Plus, Trash2, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { ExpertCanvasTab, PatientManagerState } from "@/lib/types/vania";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DynamicForm } from "@/components/tool-ui/form/dynamic-form";
import { ProfileTab } from "./tabs/ProfileTab";
import { RoadmapTab } from "./tabs/RoadmapTab";
import { RescueNetTab } from "./tabs/RescueNetTab";
import { MedicationsTab } from "./tabs/MedicationsTab";
import { AppendixTab } from "./tabs/AppendixTab";
import { FormsTab } from "./tabs/FormsTab";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { useCanvasStore } from "@/lib/canvas/store";
import { BaseInfoPanel } from "./shared/BaseInfoPanel";
import { CaseFilesTab } from "./shared/CaseFilesTab";

interface Props {
  data: PatientManagerState;
  onEdit: (delta: Partial<PatientManagerState>) => void;
  isLocked: boolean;
}

type CaseDialogMode = "create" | "edit" | "delete" | null;

const EMPTY_CASE = (id: string, title: string, doctorId?: number | null, doctorName?: string) => ({
  id,
  title,
  clinical_summary: "",
  forms_tests_analysis: "",
  roadmap_data: {
    current_phase: "PHASE_1_ANALYSIS" as const,
    treatment_approaches: [],
    sessions: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  active_goals: [],
  appendix_data: { resources: [] },
  medications: [],
  tasks: [],
  forms: [],
  tests: [],
  files: [],
  sessions: [],
  doctor_id: doctorId || null,
  doctor_name: doctorName,
  visible_tabs: ["CASE_OVERVIEW", "ROADMAP", "RESCUENET", "MEDICATIONS", "APPENDIX", "FILES"] as ExpertCanvasTab[],
  case_overview_sections: ["clinical_summary", "forms_tests_analysis", "forms", "tests"],
  allowed_form_keys: ["BASE_PROFILE_V1"],
  test_mode: "full_catalog" as const,
  feature_policy: {
    show_clinical_summary: true,
    show_forms_tests_analysis: true,
    forms_enabled: true,
    form_history_visible: true,
    tests_visible: true,
    files_enabled: true,
    medications_enabled: true,
    rescue_net_enabled: true,
    appendix_enabled: true,
    roadmap_enabled: true,
    timeline_enabled: true,
    library_enabled: true,
  },
});

const replaceCaseScopedEntries = <T extends { case_id?: string | null }>(
  existingEntries: T[] = [],
  caseEntries: T[] = [],
  caseId?: string | null
) => {
  if (!caseId) return existingEntries;
  const untouchedEntries = (existingEntries || []).filter((entry) => entry?.case_id !== caseId);
  return [...caseEntries, ...untouchedEntries];
};

export default function PatientManagerCanvas({ data, onEdit, isLocked }: Props) {
  const params = useParams();
  const setInstances = useCanvasStore((s) => s.setInstances);

  const threadId = params.threadId as string | undefined;
  const agentId = params.agentId as string | undefined;

  const [activeView, setActiveView] = useState<"BASE" | "CASES">(data.active_view || "CASES");
  const [activeTab, setActiveTab] = useState<string>(data.active_tab || "CASE_OVERVIEW");
  const [dialogMode, setDialogMode] = useState<CaseDialogMode>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [isHydratingCase, setIsHydratingCase] = useState(false);
  const [baseInfoOpen, setBaseInfoOpen] = useState(false);

  useEffect(() => {
    if (data.active_view && data.active_view !== activeView) setActiveView(data.active_view);
  }, [data.active_view, activeView]);

  useEffect(() => {
    if (data.active_tab && data.active_tab !== activeTab) setActiveTab(data.active_tab);
  }, [data.active_tab, activeTab]);

  const selectedCase = data.selected_case;
  const selectedCaseId = data.selected_case_id;
  const isSelectedCaseReadOnly = !!selectedCase?.is_read_only || selectedCase?.can_edit === false;
  const visibleTabs = (selectedCase?.visible_tabs || data.visible_tabs || ["CASE_OVERVIEW"]) as ExpertCanvasTab[];
  const featurePolicy = selectedCase?.feature_policy || data.feature_policy;
  const caseOverviewSections = selectedCase?.case_overview_sections || data.case_overview_sections || [];
  const baseProfileForm = data.base_profile?.form || {};
  const baseProfileDefinition = (data.available_forms || []).find((form) => form.key === "BASE_PROFILE_V1");
  const selectedCaseMeta = useMemo(
    () => data.cases?.find((item) => item.id === selectedCaseId) || data.cases?.[0],
    [data.cases, selectedCaseId]
  );
  const selectedDoctorId = selectedCaseMeta?.doctor_id || selectedCase?.doctor_id || null;

  useEffect(() => {
    if (activeView !== "CASES" || !visibleTabs.length) return;
    if (!visibleTabs.includes(activeTab as ExpertCanvasTab)) {
      const nextTab = visibleTabs[0];
      setActiveTab(nextTab);
      onEdit({ active_tab: nextTab } as any);
    }
  }, [activeTab, activeView, onEdit, visibleTabs]);

  if (!data?.is_active || !data?.patient_profile) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground" dir="rtl">
        <User className="mb-4 h-8 w-8 opacity-40" />
        <h3 className="text-lg font-semibold">پرونده‌ای باز نیست</h3>
        <p className="mt-2 text-sm">برای شروع، یک مراجع را از بالای چت انتخاب کنید.</p>
      </div>
    );
  }

  const switchView = (view: "BASE" | "CASES") => {
    setActiveView(view);
    onEdit({ active_view: view } as any);
  };

  const switchTab = (tab: ExpertCanvasTab) => {
    setActiveTab(tab);
    onEdit({ active_tab: tab } as any);
  };

  const hydrateCaseFromServer = async (caseId: string) => {
    if (!threadId || !agentId || !selectedDoctorId) {
      return;
    }

    setIsHydratingCase(true);
    try {
      const headers = getAuthHeaders();
      if (!headers.Authorization) return;

      headers["X-Target-Resource-ID"] = String(data.patient_profile.id);
      headers["X-Target-Expert-ID"] = String(selectedDoctorId);
      headers["X-Target-Doctor-ID"] = String(selectedDoctorId);
      headers["X-Target-Case-ID"] = caseId;

      const query = new URLSearchParams({
        agent_id: agentId,
        visitor_id: String(data.patient_profile.id),
        patient_id: String(data.patient_profile.id),
        expert_id: String(selectedDoctorId),
        doctor_id: String(selectedDoctorId),
        case_id: caseId,
      });

      const res = await fetch(`${API_BASE_URL}/agent/canvas/state/${threadId}?${query.toString()}`, { headers });
      if (!res.ok) return;
      const body = await res.json();
      if (Array.isArray(body?.canvases)) {
        setInstances(body.canvases);
      }
    } finally {
      setIsHydratingCase(false);
    }
  };

  const handleCaseSelect = async (caseId: string) => {
    const nextCase = data.cases.find((item) => item.id === caseId);
    if (!nextCase) return;

    onEdit({
      active_view: "CASES",
      active_tab: ((nextCase as any).visible_tabs || visibleTabs || ["CASE_OVERVIEW"])[0],
      selected_case_id: caseId,
      selected_case: {
        ...(data.selected_case || {}),
        id: nextCase.id,
        title: nextCase.title,
        doctor_id: nextCase.doctor_id,
        doctor_name: nextCase.doctor_name,
      } as any,
    });

    await hydrateCaseFromServer(caseId);
  };

  const handleBackToBase = () => {
    switchView("BASE");
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
      patient_profile: {
        ...data.patient_profile,
        name: formData.full_name || data.patient_profile.name,
      },
    } as any);
    setBaseInfoOpen(false);
  };

  const handleSelectedCaseEdit = (delta: Record<string, any>) => {
    if (!selectedCase) return;

    const nextSelectedCase = { ...selectedCase, ...delta };
    const nextDelta: Record<string, any> = { selected_case: nextSelectedCase };

    if (Array.isArray(delta.forms)) {
      nextDelta.base_profile = {
        ...data.base_profile,
        forms: replaceCaseScopedEntries(data.base_profile.forms || [], delta.forms, selectedCase.id),
      };
    }

    if (Array.isArray(delta.tests)) {
      nextDelta.base_profile = {
        ...(nextDelta.base_profile || data.base_profile),
        tests: replaceCaseScopedEntries(data.base_profile.tests || [], delta.tests, selectedCase.id),
      };
    }

    onEdit(nextDelta as any);
  };

  const openCreateDialog = () => {
    setDraftTitle(`پرونده ${((data.cases?.length || 0) + 1).toLocaleString("fa-IR")}`);
    setDialogMode("create");
  };

  const openEditDialog = () => {
    if (!selectedCaseMeta) return;
    setDraftTitle(selectedCaseMeta.title);
    setDialogMode("edit");
  };

  const openDeleteDialog = () => {
    if (!selectedCaseMeta) return;
    setDraftTitle(selectedCaseMeta.title);
    setDialogMode("delete");
  };

  const handleCreateCase = () => {
    const title = draftTitle.trim();
    if (!title) return;

    const id = `draft-${Date.now()}`;
    const now = new Date().toISOString();
    const nextCases = [
      {
        id,
        title,
        doctor_id: selectedDoctorId,
        doctor_name: selectedCaseMeta?.doctor_name || selectedCase?.doctor_name,
        created_at: now,
        updated_at: now,
      },
      ...(data.cases || []),
    ];

    onEdit({
      active_view: "CASES",
      selected_case_id: id,
      cases: nextCases,
      selected_case: EMPTY_CASE(id, title, selectedDoctorId, selectedCaseMeta?.doctor_name || selectedCase?.doctor_name) as any,
    });

    setDialogMode(null);
    setDraftTitle("");
  };

  const handleRenameCase = () => {
    const title = draftTitle.trim();
    if (!title || !selectedCaseMeta) return;

    const nextCases = (data.cases || []).map((item) =>
      item.id === selectedCaseMeta.id
        ? { ...item, title, updated_at: new Date().toISOString() }
        : item
    );

    onEdit({
      cases: nextCases,
      selected_case: selectedCase ? ({ ...selectedCase, title } as any) : selectedCase,
    });

    setDialogMode(null);
    setDraftTitle("");
  };

  const handleDeleteCase = async () => {
    if (!selectedCaseMeta) return;

    const nextCases = (data.cases || []).filter((item) => item.id !== selectedCaseMeta.id);
    const fallbackCase = nextCases[0] || null;

    onEdit({
      cases: nextCases,
      selected_case_id: fallbackCase?.id || null,
      selected_case: fallbackCase
        ? ({
            ...(selectedCase && selectedCase.id === fallbackCase.id ? selectedCase : EMPTY_CASE(
              fallbackCase.id,
              fallbackCase.title,
              fallbackCase.doctor_id,
              fallbackCase.doctor_name
            )),
            id: fallbackCase.id,
            title: fallbackCase.title,
            doctor_id: fallbackCase.doctor_id,
            doctor_name: fallbackCase.doctor_name,
          } as any)
        : null,
      active_view: fallbackCase ? "CASES" : "BASE",
    });

    setDialogMode(null);
    setDraftTitle("");

    if (fallbackCase?.id) {
      await hydrateCaseFromServer(fallbackCase.id);
    }
  };

  return (
    <div className="flex h-full flex-col bg-background" dir="rtl">
      <div className="shrink-0 border-b border-border/40 bg-background/80 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <h1 className="truncate text-xl font-bold">{data.patient_profile.name}</h1>
            <p className="text-xs text-muted-foreground">{data.patient_profile.phone}</p>
          </div>

          {activeView === "CASES" && selectedCase ? (
            <div className="flex items-center gap-2">
              {isSelectedCaseReadOnly ? (
                <div className="rounded-full bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground">فقط مشاهده</div>
              ) : null}
              <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 rounded-full px-3 text-xs" onClick={handleBackToBase}>
                <ArrowRight className="h-3.5 w-3.5" />
                بازگشت به اطلاعات پایه
              </Button>
              {!isSelectedCaseReadOnly ? <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                    <Ellipsis className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={openEditDialog}>
                    <Pencil className="h-4 w-4" />
                    ویرایش نام
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={openDeleteDialog} variant="destructive">
                    <Trash2 className="h-4 w-4" />
                    حذف پرونده
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu> : null}
            </div>
          ) : (
            <div className="rounded-full bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
              اطلاعات پایه
            </div>
          )}
        </div>

        {activeView === "CASES" && selectedCase && (
          <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-border/40 pt-3">
            <div className="ml-2 text-sm font-semibold">{selectedCase.title}</div>
            {[
              { id: "CASE_OVERVIEW", label: "پرونده و فرم‌ها", icon: FileText },
              { id: "ROADMAP", label: "سند پشتیبان", icon: BriefcaseBusiness },
              { id: "RESCUENET", label: "تور نجات", icon: LifeBuoy },
              { id: "MEDICATIONS", label: "شیوه و مصرف دارو", icon: Pill },
              { id: "APPENDIX", label: "پیوست اندیشه", icon: Library },
              { id: "FILES", label: "فایل‌ها", icon: FolderOpen },
            ].filter((tab) => visibleTabs.includes(tab.id as ExpertCanvasTab)).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => switchTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] transition",
                  activeTab === tab.id ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            ))}
            {isHydratingCase && (
              <div className="mr-auto flex items-center gap-1 text-[11px] text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                در حال بارگذاری پرونده
              </div>
            )}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-muted/5 p-3 sm:p-6">
        {activeView === "BASE" && (
          <div className="space-y-8">
            <BaseInfoPanel
              profile={baseProfileForm}
              forms={data.base_profile.forms || []}
              tests={data.base_profile.tests || []}
              cases={data.cases || []}
              availableForms={data.available_forms || []}
              onOpenCase={handleCaseSelect}
              onEditProfile={() => setBaseInfoOpen(true)}
              canEditProfile={!!baseProfileDefinition}
              emptyCasesText="هنوز پرونده‌ای برای این بیمار ساخته نشده است."
              caseAction={
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={openCreateDialog}>
                  <Plus className="h-3.5 w-3.5" />
                  پرونده جدید
                </Button>
              }
            />
          </div>
        )}

        {activeView === "CASES" && selectedCase && activeTab === "CASE_OVERVIEW" && (
          <div className="space-y-10">
            <ProfileTab
              patientProfile={data.patient_profile}
              clinicalSummary={selectedCase.clinical_summary || ""}
              formsTestsAnalysis={selectedCase.forms_tests_analysis || ""}
              forms={caseOverviewSections.includes("forms") ? selectedCase.forms || [] : []}
              tests={caseOverviewSections.includes("tests") ? selectedCase.tests || [] : []}
              onEdit={handleSelectedCaseEdit}
              isLocked={isLocked || isSelectedCaseReadOnly}
              showClinicalSummary={caseOverviewSections.includes("clinical_summary")}
              showFormsTestsAnalysis={caseOverviewSections.includes("forms_tests_analysis")}
            />
            {(featurePolicy?.forms_enabled || featurePolicy?.form_history_visible || (selectedCase.test_mode || data.test_mode || "disabled") !== "disabled") ? (
            <FormsTab
              forms={caseOverviewSections.includes("forms") ? selectedCase.forms || [] : []}
              tests={caseOverviewSections.includes("tests") ? selectedCase.tests || [] : []}
              testsCatalog={data.tests_catalog || []}
              availableForms={(data.available_forms || []).filter(
                (form) =>
                  form.key !== "BASE_PROFILE_V1" &&
                  (selectedCase.allowed_form_keys || data.allowed_form_keys || []).includes(form.key)
              )}
              uiSignal={data.ui_signal}
              onEdit={handleSelectedCaseEdit}
              patientId={data.patient_profile.id}
              caseId={selectedCase.id}
              readOnly={isSelectedCaseReadOnly}
              formsEnabled={!!featurePolicy?.forms_enabled}
              formHistoryVisible={caseOverviewSections.includes("forms") && !!featurePolicy?.form_history_visible}
              testMode={selectedCase.test_mode || data.test_mode || "disabled"}
            />
            ) : null}
          </div>
        )}

        {activeView === "CASES" && selectedCase && activeTab === "ROADMAP" && featurePolicy?.roadmap_enabled && (
          <RoadmapTab
            roadmap={selectedCase.roadmap_data}
            activeGoals={selectedCase.active_goals || []}
            patientId={data.patient_profile.id}
            caseId={selectedCase.id}
            patientName={data.patient_profile.name}
            allSessionsHistory={selectedCase.sessions || []}
            onEdit={handleSelectedCaseEdit}
            readOnly={isSelectedCaseReadOnly}
          />
        )}

        {activeView === "CASES" && selectedCase && activeTab === "RESCUENET" && featurePolicy?.rescue_net_enabled && (
          <RescueNetTab
            tasks={selectedCase.tasks || []}
            patientId={data.patient_profile.id}
            caseId={selectedCase.id}
            onEdit={handleSelectedCaseEdit}
            readOnly={isSelectedCaseReadOnly}
          />
        )}

        {activeView === "CASES" && selectedCase && activeTab === "MEDICATIONS" && featurePolicy?.medications_enabled && (
          <MedicationsTab
            medications={selectedCase.medications || []}
            onEdit={handleSelectedCaseEdit}
            readOnly={isSelectedCaseReadOnly}
          />
        )}

        {activeView === "CASES" && selectedCase && activeTab === "APPENDIX" && featurePolicy?.appendix_enabled && (
          <AppendixTab
            library={selectedCase.appendix_data}
            patientId={data.patient_profile.id}
            caseId={selectedCase.id}
            onEdit={handleSelectedCaseEdit}
            readOnly={isSelectedCaseReadOnly}
          />
        )}

        {activeView === "CASES" && selectedCase && activeTab === "FILES" && featurePolicy?.files_enabled && (
          <CaseFilesTab
            files={selectedCase.files || []}
            selectedDoctorId={selectedDoctorId}
            selectedCaseId={selectedCase.id}
            patientId={data.patient_profile.id}
            onEdit={handleSelectedCaseEdit}
            readOnly={isSelectedCaseReadOnly}
          />
        )}
      </div>

      <Dialog open={dialogMode === "create" || dialogMode === "edit"} onOpenChange={(open) => !open && setDialogMode(null)}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogMode === "create" ? "ایجاد پرونده جدید" : "ویرایش نام پرونده"}</DialogTitle>
            <DialogDescription>
              {dialogMode === "create"
                ? "برای پرونده جدید یک نام مشخص و قابل تشخیص وارد کنید."
                : "نام جدید پرونده را ثبت کنید."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="case-title">نام پرونده</Label>
            <Input id="case-title" value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} placeholder="مثلا: پیگیری اضطراب خواب" />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogMode(null)}>انصراف</Button>
            <Button onClick={dialogMode === "create" ? handleCreateCase : handleRenameCase} disabled={!draftTitle.trim()}>
              {dialogMode === "create" ? "ایجاد پرونده" : "ذخیره تغییرات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogMode === "delete"} onOpenChange={(open) => !open && setDialogMode(null)}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>حذف پرونده</DialogTitle>
            <DialogDescription>
              این عملیات قابل بازگشت نیست. پرونده «{selectedCaseMeta?.title || draftTitle}» از فهرست پرونده‌ها حذف می‌شود.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogMode(null)}>انصراف</Button>
            <Button variant="destructive" onClick={handleDeleteCase}>
              حذف پرونده
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={baseInfoOpen} onOpenChange={setBaseInfoOpen}>
        <DialogContent dir="rtl" className="w-[calc(100vw-2rem)] max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{baseProfileDefinition?.title || "اطلاعات پایه"}</DialogTitle>
            <DialogDescription>
              این فرم به پروفایل مشترک مراجع تعلق دارد و با ویرایش آن، اطلاعات پایه برای خود او و متخصصان متصل به‌روزرسانی می‌شود.
            </DialogDescription>
          </DialogHeader>

          {baseProfileDefinition && (
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
              patientId={data.patient_profile.id}
              sessionId={threadId}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
