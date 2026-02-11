// frontend/components/canvas/renderers/PatientManagerCanvas.tsx
"use client";

import { useState, useEffect } from "react";
import { 
  User,
  Map, 
  LifeBuoy, 
  Library, 
  FileText, 
  ShieldAlert
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PatientManagerState } from "@/lib/types/vania";

// --- Tab Components ---
// These are the individual views for each of the 4 main sections.
import { ProfileTab } from "./tabs/ProfileTab"
import { RoadmapTab } from "./tabs/RoadmapTab";
import { RescueNetTab } from "./tabs/RescueNetTab";
import { AppendixTab } from "./tabs/AppendixTab";
import { FormsTab } from "./tabs/FormsTab";

// --- Props Interface ---
interface Props {
  data: PatientManagerState;
  onEdit: (delta: Partial<PatientManagerState>) => void;
  isLocked: boolean;
}

/**
 * PatientManagerCanvas is the primary user interface for doctors interacting with a patient's file.
 * It serves as a container for four distinct tabs:
 * 1. Roadmap (سند پشتیبان): The main therapy plan and session reports.
 * 2. Rescue Net (تور نجات): Patient tasks categorized by life dimensions.
 * 3. Appendix (پیوست اندیشه): Prescribed cultural resources (books, films, etc.).
 * 4. Forms (فرم‌ها): Clinical assessment forms.
 */
export default function PatientManagerCanvas({ data, onEdit, isLocked }: Props) {
  // Local state to manage which tab is currently visible.
  // It's initialized from the `data` prop, which is hydrated from the backend.
  const [activeTab, setActiveTab] = useState<string>(data.active_tab || "PROFILE");

  // This effect ensures that if the AI forces a tab switch (e.g., by opening a form),
  // the component's local state syncs with the incoming prop change.
  useEffect(() => {
    if (data.active_tab && data.active_tab !== activeTab) {
      setActiveTab(data.active_tab);
    }
  }, [data.active_tab]);

  // --- Render States ---

  // 1. Empty State: Rendered when no patient is selected.
  if (!data?.is_active || !data?.patient_profile) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground bg-muted/5" dir="rtl">
        <div className="bg-muted p-4 rounded-full mb-4">
           <User className="h-8 w-8 opacity-50" />
        </div>
        <h3 className="font-semibold text-lg">پرونده‌ای باز نیست</h3>
        <p className="text-sm mt-2 max-w-[240px]">
          برای مشاهده اطلاعات، لطفاً از منوی بالای صفحه چت، یک بیمار را انتخاب کنید.
        </p>
      </div>
    );
  }

  // Destructure data for easier access
  const { patient_profile, clinical_summary, roadmap_data, appendix_data, tasks, active_goals } = data;

  return (
    <div className="flex flex-col h-full bg-background font-sans relative overflow-hidden" dir="rtl">
      
      {/* --- HEADER SECTION --- */}
      <div className="p-6 pb-2 shrink-0 border-b border-border/40 bg-background/50 backdrop-blur-sm z-10">
        
        {/* Patient Identity */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold text-foreground">{patient_profile.name}</h1>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
              <span className="font-mono bg-muted/50 px-2 py-0.5 rounded">{patient_profile.phone}</span>
              {roadmap_data?.current_phase && (
                <span className="px-2 py-0.5 bg-muted-50 text-blue-400 border border-muted-100 rounded-full font-medium text-[10px]">
                  {/* Simple mapping for a user-friendly display of the current phase */}
                  {roadmap_data.current_phase === 'PHASE_1_ANALYSIS' ? 'فاز ۱: تحلیل' :
                   roadmap_data.current_phase === 'PHASE_2_APPROACHES' ? 'فاز ۲: پیشنهاد رویکرد' :
                   roadmap_data.current_phase === 'PHASE_4_PROTOCOL' ? 'فاز ۴: طراحی پروتکل' :
                   roadmap_data.current_phase === 'PHASE_5_EXECUTION' ? 'فاز ۵: اجرای جلسات' :
                   roadmap_data.current_phase}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* --- NAVIGATION TABS --- */}
        <div className="mt-6 flex gap-1 p-1 bg-muted/30 border border-border/50 rounded-xl">
          {[
            { id: "PROFILE", label: "پرونده", icon: User },
            { id: "ROADMAP", label: "سند پشتیبان", icon: Map },
            { id: "RESCUENET", label: "تور نجات", icon: LifeBuoy },
            { id: "APPENDIX", label: "پیوست اندیشه", icon: Library },
            { id: "FORMS", label: "فرم‌ها", icon: FileText },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => { 
                setActiveTab(tab.id); 
                // Notify the parent store of the user's tab change
                onEdit({ active_tab: tab.id as any }); 
              }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-lg transition-all duration-200",
                activeTab === tab.id 
                  ? "bg-background text-primary shadow-sm border border-border/50" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* --- CONTENT AREA --- */}
      {/* This area dynamically renders the content of the active tab. */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 bg-muted/5">
        
        {activeTab === "PROFILE" && (
          <ProfileTab 
            patientProfile={patient_profile}
            clinicalSummary={clinical_summary || ""}
            onEdit={onEdit}
            isLocked={isLocked}
          />
        )}

        {activeTab === "ROADMAP" && (
          <RoadmapTab 
            roadmap={roadmap_data} 
            activeGoals={active_goals || []} // [NEW] Passing goals
            patientId={patient_profile.id}
            patientName={patient_profile.name} 
            allSessionsHistory={data.sessions || []}
            onEdit={onEdit} 
          />
        )}
        
        {activeTab === "RESCUENET" && (
          <RescueNetTab 
            tasks={tasks || []}
            patientId={patient_profile.id}
            onEdit={onEdit} 
          />
        )}
        
        {activeTab === "APPENDIX" && (
          <AppendixTab 
            library={appendix_data}
            patientId={patient_profile.id} 
            onEdit={onEdit} 
          />
        )}
        
        {activeTab === "FORMS" && (
          <FormsTab 
            forms={data.forms || []} 
            availableForms={data.available_forms || []}
            uiSignal={data.ui_signal}
            onEdit={onEdit}
            patientId={patient_profile.id} // [NEW] Pass the patient ID here
          />
        )}
      </div>
    </div>
  );
}