"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, AlertCircle, Route } from "lucide-react";
import { RoleGuard } from "@/components/role-guard";
import PatientJourneyCanvas from "@/components/canvas/renderers/PatientJourneyCanvas";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { useUser } from "@/hooks/use-user";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type JourneyState = {
  greeting: string;
  current_phase: string;
  tasks: any[];
  timeline: any[];
  library: any[];
  tests?: any[];
  active_goals: string[];
  forms_tests_analysis?: string;
  my_doctors?: Array<{ id: number; name: string }>;
  selected_doctor_id?: number | null;
  active_tab?: string;
};

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
  const searchParams = useSearchParams();

  const queryDoctorId = searchParams.get("doctorId") || searchParams.get("expertId");
  const sessionId = useMemo(() => (user?.id ? `visitor-dashboard-${user.id}` : null), [user?.id]);
  const [doctorScopeId, setDoctorScopeId] = useState<string | null>(queryDoctorId);

  const [canvasId, setCanvasId] = useState<string | null>(null);
  const [data, setData] = useState<JourneyState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDoctorScopeId(queryDoctorId);
  }, [queryDoctorId]);

  useEffect(() => {
    if (!user?.id || queryDoctorId) return;
    const stored = localStorage.getItem(`vania:last_selected_doctor_by_patient:${user.id}`);
    if (stored) setDoctorScopeId(stored);
  }, [user?.id, queryDoctorId]);

  const loadCanvas = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);

    try {
      const headers = getAuthHeaders();
      if (!headers.Authorization) return;

      const query = new URLSearchParams({ agent_id: VISITOR_AGENT_SLUG });
      // Always pass doctor_id (real or sentinel) to force backend re-hydration on each load.
      query.set("doctor_id", doctorScopeId || "0");

      const res = await fetch(`${API_BASE_URL}/agent/canvas/state/${sessionId}?${query.toString()}`, { headers });
      if (!res.ok) throw new Error("دریافت داشبورد با خطا مواجه شد.");

      const body: CanvasStateResponse = await res.json();
      const journey = body.canvases?.find((c) => c.component_key === "VANIA_PATIENT_JOURNEY");
      if (!journey) throw new Error("بوم مسیر مراجع یافت نشد.");

      setCanvasId(journey.id);
      setData(journey.current_state);

      const hydratedDoctor = journey.current_state?.selected_doctor_id;
      if (!doctorScopeId && hydratedDoctor) {
        setDoctorScopeId(String(hydratedDoctor));
      }
    } catch (e: any) {
      setError(e?.message || "خطا در بارگذاری داشبورد.");
    } finally {
      setLoading(false);
    }
  }, [sessionId, doctorScopeId]);

  useEffect(() => {
    loadCanvas();
  }, [loadCanvas]);

  const handleEdit = useCallback(async (delta: Partial<JourneyState>) => {
    if (!canvasId || !data) return;

    const previous = data;
    setData((prev) => (prev ? deepMerge(prev, delta) : prev));
    if (delta.selected_doctor_id) {
      const nextDoctor = String(delta.selected_doctor_id);
      setDoctorScopeId(nextDoctor);
      if (user?.id) {
        localStorage.setItem(`vania:last_selected_doctor_by_patient:${user.id}`, nextDoctor);
      }
    }
    setSaving(true);

    try {
      const headers = getAuthHeaders();
      if (!headers.Authorization) throw new Error("نشست کاربر معتبر نیست.");
      const effectiveDoctorId = doctorScopeId || (delta.selected_doctor_id ? String(delta.selected_doctor_id) : null) || (data.selected_doctor_id ? String(data.selected_doctor_id) : null);

      const res = await fetch(`${API_BASE_URL}/agent/canvas/instance/${canvasId}`, {
        method: "PATCH",
        headers: {
          ...headers,
          "Content-Type": "application/json",
          ...(user?.id ? { "X-Target-Resource-ID": String(user.id) } : {}),
          ...(effectiveDoctorId ? { "X-Target-Expert-ID": effectiveDoctorId } : {}),
          ...(effectiveDoctorId ? { "X-Target-Doctor-ID": effectiveDoctorId } : {}),
        },
        body: JSON.stringify({ delta }),
      });

      if (!res.ok) throw new Error("ذخیره تغییرات ناموفق بود.");
    } catch {
      setData(previous);
    } finally {
      setSaving(false);
    }
  }, [canvasId, data, doctorScopeId, user?.id]);

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
