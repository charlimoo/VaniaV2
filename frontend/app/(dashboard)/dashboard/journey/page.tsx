"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, AlertCircle, Route } from "lucide-react";
import { RoleGuard } from "@/components/role-guard";
import PatientJourneyCanvas from "@/components/canvas/renderers/PatientJourneyCanvas";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { useUser } from "@/hooks/use-user";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PatientJourneyState } from "@/lib/types/vania";

type JourneyState = PatientJourneyState;

type CanvasStateResponse = {
  canvases?: Array<{
    id: string;
    component_key: string;
    current_state: JourneyState;
  }>;
};

const VISITOR_AGENT_SLUG = "vania-visitor-companion";

function deepMerge(target: any, source: any): any {
  if (typeof target !== "object" || target === null) return source;
  if (typeof source !== "object" || source === null) return source;

  const output = { ...target };
  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    const targetValue = output[key];
    if (Array.isArray(sourceValue)) output[key] = sourceValue;
    else if (typeof sourceValue === "object" && sourceValue !== null && targetValue) {
      output[key] = deepMerge(targetValue, sourceValue);
    } else output[key] = sourceValue;
  }
  return output;
}

export default function VisitorJourneyPage() {
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  const queryDoctorId = searchParams.get("doctorId") || searchParams.get("expertId");
  const queryCaseId = searchParams.get("caseId");
  const sessionId = useMemo(() => (user?.id ? `visitor-dashboard-${user.id}` : null), [user?.id]);
  const [doctorScopeId, setDoctorScopeId] = useState<string | null>(queryDoctorId);
  const [caseScopeId, setCaseScopeId] = useState<string | null>(queryCaseId);

  const [canvasId, setCanvasId] = useState<string | null>(null);
  const [data, setData] = useState<JourneyState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDoctorScopeId(queryDoctorId);
    setCaseScopeId(queryCaseId);
  }, [queryDoctorId, queryCaseId]);

  const updateScopeQuery = useCallback((doctorId?: string | null, caseId?: string | null) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (doctorId) {
      nextParams.set("expertId", doctorId);
      nextParams.set("doctorId", doctorId);
    } else {
      nextParams.delete("expertId");
      nextParams.delete("doctorId");
    }
    if (caseId) {
      nextParams.set("caseId", caseId);
    } else {
      nextParams.delete("caseId");
    }

    const nextQuery = nextParams.toString();
    const nextUrl = `/dashboard/journey${nextQuery ? `?${nextQuery}` : ""}`;
    const currentUrl = `/dashboard/journey${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
    if (nextUrl !== currentUrl) {
      router.replace(nextUrl);
    }
  }, [router, searchParams]);

  const loadCanvas = useCallback(async () => {
    if (!sessionId || !user?.id) return;
    setLoading(true);
    setError(null);

    try {
      const headers = getAuthHeaders();
      if (!headers.Authorization) return;
      headers["X-Target-Resource-ID"] = String(user.id);
      if (doctorScopeId) {
        headers["X-Target-Expert-ID"] = doctorScopeId;
        headers["X-Target-Doctor-ID"] = doctorScopeId;
      }
      if (caseScopeId) headers["X-Target-Case-ID"] = caseScopeId;

      const query = new URLSearchParams({ agent_id: VISITOR_AGENT_SLUG });
      query.set("visitor_id", String(user.id));
      query.set("patient_id", String(user.id));
      if (doctorScopeId) {
        query.set("doctor_id", doctorScopeId);
        query.set("expert_id", doctorScopeId);
      }
      if (caseScopeId) query.set("case_id", caseScopeId);

      const res = await fetch(`${API_BASE_URL}/agent/canvas/state/${sessionId}?${query.toString()}`, { headers });
      if (!res.ok) throw new Error("دریافت داشبورد با خطا مواجه شد.");

      const body: CanvasStateResponse = await res.json();
      const journey = body.canvases?.find((c) => c.component_key === "VANIA_PATIENT_JOURNEY");
      if (!journey) throw new Error("بوم مسیر مراجع یافت نشد.");

      setCanvasId(journey.id);
      setData(journey.current_state);

      const hydratedDoctor = journey.current_state?.selected_doctor_id;
      const hydratedCase = journey.current_state?.selected_case_id;
      if (!doctorScopeId && hydratedDoctor && journey.current_state?.active_view === "CASES") {
        setDoctorScopeId(String(hydratedDoctor));
      }
      if (!caseScopeId && hydratedCase && journey.current_state?.active_view === "CASES") {
        setCaseScopeId(String(hydratedCase));
      }
    } catch (e: any) {
      setError(e?.message || "خطا در بارگذاری داشبورد.");
    } finally {
      setLoading(false);
    }
  }, [sessionId, doctorScopeId, caseScopeId, user?.id]);

  useEffect(() => {
    loadCanvas();
  }, [loadCanvas]);

  const handleEdit = useCallback(async (delta: Partial<JourneyState>) => {
    if (!canvasId || !data) return;

    const selectedCaseId = delta.selected_case_id ? String(delta.selected_case_id) : null;
    const selectedCaseMeta = selectedCaseId ? (data.cases || []).find((item) => item.id === selectedCaseId) : null;
    const selectedDoctorId =
      delta.selected_doctor_id != null
        ? String(delta.selected_doctor_id)
        : selectedCaseMeta?.doctor_id != null
          ? String(selectedCaseMeta.doctor_id)
          : null;

    if (selectedCaseId && selectedDoctorId) {
      setDoctorScopeId(selectedDoctorId);
      setCaseScopeId(selectedCaseId);
      if (user?.id) {
        localStorage.setItem(`vania:last_selected_doctor_by_patient:${user.id}`, selectedDoctorId);
      }
      updateScopeQuery(selectedDoctorId, selectedCaseId);
    } else if (delta.active_view === "BASE") {
      setCaseScopeId(null);
      setDoctorScopeId(null);
      updateScopeQuery(null, null);
    }

    const previous = data;
    setData((prev) => (prev ? deepMerge(prev, delta) : prev));
    if (selectedDoctorId && !selectedCaseId) {
      const nextDoctor = selectedDoctorId;
      setDoctorScopeId(nextDoctor);
      if (user?.id) {
        localStorage.setItem(`vania:last_selected_doctor_by_patient:${user.id}`, nextDoctor);
      }
    }
    if (selectedCaseId && !selectedDoctorId) {
      setCaseScopeId(selectedCaseId);
    }
    setSaving(true);

    try {
      const headers = getAuthHeaders();
      if (!headers.Authorization) throw new Error("نشست کاربر معتبر نیست.");
      const effectiveDoctorId =
        selectedDoctorId ||
        doctorScopeId ||
        (data.selected_case?.doctor_id != null ? String(data.selected_case.doctor_id) : null) ||
        (data.selected_doctor_id != null ? String(data.selected_doctor_id) : null);
      const effectiveCaseId =
        selectedCaseId ||
        caseScopeId ||
        (data.selected_case_id ? String(data.selected_case_id) : null);

      const res = await fetch(`${API_BASE_URL}/agent/canvas/instance/${canvasId}`, {
        method: "PATCH",
        headers: {
          ...headers,
          "Content-Type": "application/json",
          ...(user?.id ? { "X-Target-Resource-ID": String(user.id) } : {}),
          ...(effectiveDoctorId ? { "X-Target-Expert-ID": effectiveDoctorId } : {}),
          ...(effectiveDoctorId ? { "X-Target-Doctor-ID": effectiveDoctorId } : {}),
          ...(effectiveCaseId ? { "X-Target-Case-ID": effectiveCaseId } : {}),
        },
        body: JSON.stringify({ delta }),
      });

      if (!res.ok) throw new Error("ذخیره تغییرات ناموفق بود.");
    } catch {
      setData(previous);
    } finally {
      setSaving(false);
    }
  }, [canvasId, data, doctorScopeId, caseScopeId, user?.id, updateScopeQuery]);

  return (
    <RoleGuard allowedRoles={["visitor"]}>
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col space-y-4 pb-6 pt-4" dir="rtl">
        <div className="flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
            <Route className="h-5 w-5 text-primary" />
            داشبورد مسیر من
          </h1>
          {saving && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              در حال ذخیره...
            </div>
          )}
        </div>

        <div className="min-h-[70vh] overflow-hidden rounded-2xl border bg-background shadow-sm">
          {loading && (
            <div className="flex h-[70vh] items-center justify-center text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              در حال بارگذاری داشبورد...
            </div>
          )}

          {!loading && error && (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>خطا</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          )}

          {!loading && !error && data && (
            <PatientJourneyCanvas data={data} onEdit={handleEdit} isLocked={false} />
          )}
        </div>
      </div>
    </RoleGuard>
  );
}
