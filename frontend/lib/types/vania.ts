// frontend/lib/types/vania.ts

// ==============================================================================
// == ENUMERATIONS: Standardized choices for Vania system states and types
// ==============================================================================

/** Defines the stages of the 6-Phase Clinical Protocol. */
export type TherapyPhase = 
  | "PHASE_1_ANALYSIS" 
  | "PHASE_2_APPROACHES" 
  | "PHASE_3_SELECTION" 
  | "PHASE_4_PROTOCOL" 
  | "PHASE_5_EXECUTION" 
  | "PHASE_6_APPENDIX";

/** Defines the state of an individual therapy session within the Roadmap. */
export type SessionStatus = "DRAFT" | "READY" | "COMPLETED";

/** The 9 dimensions of the 'Rescue Net' (Tour-e Nejat) framework. */
export type RescueDimension = 
  | "PERSONAL"
  | "RELATIONSHIP"
  | "CAREER" 
  | "EMOTIONAL"
  | "INTELLECTUAL"
  | "FRIENDSHIP" 
  | "ENVIRONMENT"
  | "SOLITUDE"
  | "RECREATION";

/** The types of cultural resources that can be prescribed in the Thought Appendix. */
export type ResourceType = "BOOK" | "POEM" | "MOVIE";

// ==============================================================================
// == DATA PILLAR INTERFACES: The core data structures for the Canvas tabs
// ==============================================================================

/** Represents a single session (past, present, or future) in the therapy plan. */
export interface RoadmapSession {
  session_number: number;
  title: string;
  status: SessionStatus;
  scheduled_date?: string;
  doctor_instructions?: string; // Private instructions for the doctor
  doc_id?: string; // Link to the full Session Report (UserContextEntry ID)
}

/** The singleton object for the `therapy_roadmap` context. This is the master plan. */
export interface TherapyRoadmap {
  current_phase: TherapyPhase;
  treatment_approaches: string[];
  sessions: RoadmapSession[];
  active_session_number?: number | null;
  created_at: string;
  updated_at: string;
}

/** Represents a single task/homework assigned to the patient, tagged with a dimension. */
export interface RescueTask {
  id: string;
  text: string;
  dimension: RescueDimension;
  status: "PENDING" | "DONE";
  created_at: string;
  doctor_name?: string;
  due_date?: string;
}

/** Represents a single prescribed book, poem, or movie. */
export interface CulturalResource {
  id: string;
  type: ResourceType;
  title: string;
  creator: string; // Author, Poet, or Director
  reason_for_prescription: string;
  content_excerpt?: string;
  status: "SUGGESTED" | "CONSUMED";
}

/** The root object for the `thought_appendix_library` context. */
export interface ThoughtAppendix {
  resources: CulturalResource[];
}

/** Defines the structure of a form template that can be rendered in the UI. */
export interface FormDefinition {
  key: string;
  title: string;
  description: string;
  handler: string;
  schema: any[]; // JSON Schema for form fields
}

// ==============================================================================
// == ROOT CANVAS STATE: The main object hydrated from the backend
// ==============================================================================

/**
 * Defines the complete state of the PatientManagerCanvas, hydrated from the backend.
 * This object contains all the data needed to render the 4 main tabs.
 */
export interface PatientManagerState {
  is_active: boolean;
  active_tab: "ROADMAP" | "RESCUENET" | "APPENDIX" | "FORMS";
  
  patient_profile: {
    id: number;
    name: string;
    phone: string;
    avatar_url?: string;
  };

  // --- The 4 Data Pillars ---
  roadmap_data: TherapyRoadmap;
  appendix_data: ThoughtAppendix;
  tasks: RescueTask[]; // For the Rescue Net tab
  forms: any[]; // History of completed forms
  available_forms: FormDefinition[]; // Form templates

  // Legacy/flat session history, can be used to find full report data by doc_id
  sessions: any[]; 
  
  // For real-time UI updates triggered by the agent
  ui_signal?: { 
    type: "OPEN_FORM" | "DRAFT_FORM"; 
    form?: FormDefinition; 
    data?: Record<string, any>; // Pre-filled data for drafts
  };
}