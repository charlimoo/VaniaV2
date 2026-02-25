"use client";

import { useState, useEffect } from "react";
import { LayoutDashboard, LifeBuoy, History, Library, Loader2, FlaskConical, Stethoscope, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClinicalTestEntry } from "@/lib/types/vania";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// --- Tab Imports ---
import { PatientHomeTab } from "./patient/PatientHomeTab";
import { PatientRescueNetTab } from "./patient/PatientRescueNetTab";
import { PatientTimelineTab } from "./patient/PatientTimelineTab";
import { PatientLibraryTab } from "./patient/PatientLibraryTab";
import { PatientTestsTab } from "./patient/PatientTestsTab";

// --- Types ---
// Matches the structure returned by PatientDataService.get_patient_dashboard_snapshot
interface PatientState {
  greeting: string;
  current_phase: string;
  tasks: any[];
  timeline: any[];
  library: any[];
  tests?: ClinicalTestEntry[];
  active_goals: string[];
  forms_tests_analysis?: string;
  my_doctors?: Array<{ id: number; name: string }>;
  selected_doctor_id?: number | null;
  // Tracks which tab is currently open (for persistence via backend sync)
  active_tab?: string; 
}

interface Props {
  data: PatientState;
  onEdit: (delta: Partial<PatientState>) => void;
  isLocked: boolean;
}

export default function PatientJourneyCanvas({ data, onEdit, isLocked }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Initialize local state from props (backend source of truth)
  // Default to 'HOME' if not set
  const [activeTab, setActiveTab] = useState<string>(data?.active_tab || "HOME");
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(data?.selected_doctor_id || null);

  // Sync local state if backend pushes a tab change (e.g. Agent says "Let's look at your tasks")
  useEffect(() => {
    if (data?.active_tab && data.active_tab !== activeTab) {
      setActiveTab(data.active_tab);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.active_tab]);

  useEffect(() => {
    if (data?.selected_doctor_id && data.selected_doctor_id !== selectedDoctorId) {
      setSelectedDoctorId(data.selected_doctor_id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.selected_doctor_id]);

  useEffect(() => {
    const queryDoctorId = searchParams.get("doctorId");
    if (!queryDoctorId) return;
    const parsed = Number(queryDoctorId);
    if (!Number.isNaN(parsed) && parsed !== selectedDoctorId) {
      setSelectedDoctorId(parsed);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    // Persist tab selection to backend so it survives refresh/device switch
    // and informs the Agent of the user's focus
    onEdit({ active_tab: tab });
  };

  // --- Loading / Empty State ---
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-background text-muted-foreground gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="text-sm">در حال دریافت اطلاعات پرونده...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background font-sans relative overflow-hidden" dir="rtl">
      {!!data.my_doctors?.length && data.my_doctors.length > 1 && (
        <div className="shrink-0 border-b border-border/40 bg-background/70 px-4 py-3">
          <div className="flex items-center gap-3 backdrop-blur-sm">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-muted-foreground">نمایش متخصص:</p>
              <div className="relative mt-1">
                <select
                  className="h-9 w-full appearance-none rounded-lg border border-border bg-background px-3 pl-9 text-sm font-medium text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  value={selectedDoctorId ?? ""}
                  onChange={(e) => {
                    const nextDoctorId = Number(e.target.value);
                    setSelectedDoctorId(nextDoctorId);
                    onEdit({ selected_doctor_id: nextDoctorId } as any);
                    const pid = searchParams.get("patientId");
                    if (pid) {
                      localStorage.setItem(`vania:last_selected_doctor_by_patient:${pid}`, String(nextDoctorId));
                    }
                    const params = new URLSearchParams(searchParams.toString());
                    params.set("doctorId", String(nextDoctorId));
                    router.replace(`${pathname}?${params.toString()}`);
                  }}
                >
                  {data.my_doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* --- CONTENT AREA (Scrollable) --- */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 bg-muted/5 scroll-smooth">
        
        {activeTab === "HOME" && (
          <PatientHomeTab 
            greeting={data.greeting}
            activeGoals={data.active_goals || []}
            formsTestsAnalysis={data.forms_tests_analysis || ""}
          />
        )}

        {activeTab === "RESCUE" && (
          <PatientRescueNetTab 
            tasks={data.tasks || []}
            selectedDoctorId={selectedDoctorId}
            onEdit={onEdit}
          />
        )}

        {activeTab === "TIMELINE" && (
          <PatientTimelineTab 
            sessions={data.timeline || []}
            patientName={data.greeting.replace("سلام ", "").replace("دوست من", "")} 
          />
        )}

        {activeTab === "LIBRARY" && (
          <PatientLibraryTab 
            library={data.library || []}
            onEdit={onEdit}
          />
        )}

        {activeTab === "TESTS" && (
          <PatientTestsTab
            tests={data.tests || []}
            selectedDoctorId={selectedDoctorId}
            onEdit={onEdit}
          />
        )}

      </div>

      {/* --- BOTTOM NAVIGATION BAR --- */}
      {/* Fixed footer navigation for easy mobile access */}
      <div className="shrink-0 border-t border-border/40 bg-background/80 backdrop-blur-md pb-safe">
        <div className="grid grid-cols-5 gap-1 p-2">
          {[
            { id: "HOME", label: "خانه", icon: LayoutDashboard },
            { id: "RESCUE", label: "تور نجات", icon: LifeBuoy },
            { id: "TIMELINE", label: "مسیر من", icon: History },
            { id: "LIBRARY", label: "کتابخانه", icon: Library },
            { id: "TESTS", label: "تست ها", icon: FlaskConical },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "flex flex-col items-center justify-center py-2.5 rounded-xl transition-all duration-300 relative overflow-hidden",
                  isActive 
                    ? "text-primary font-bold" 
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                {/* Active Indicator Background */}
                {isActive && (
                  <div className="absolute inset-0 bg-primary/10 rounded-xl animate-in zoom-in-95 duration-200" />
                )}
                
                <tab.icon className={cn("w-5 h-5 mb-1 z-10 transition-transform", isActive && "scale-110")} />
                <span className="text-[10px] z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}
