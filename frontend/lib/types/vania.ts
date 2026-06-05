export type TherapyPhase =
  | "PHASE_1_ANALYSIS"
  | "PHASE_2_APPROACHES"
  | "PHASE_3_SELECTION"
  | "PHASE_4_PROTOCOL"
  | "PHASE_5_EXECUTION"
  | "PHASE_6_APPENDIX";

export type SessionStatus = "DRAFT" | "READY" | "COMPLETED";

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

export type ResourceType = "BOOK" | "POEM" | "MOVIE";

export interface RoadmapSession {
  session_number: number;
  title: string;
  status: SessionStatus;
  scheduled_date?: string;
  doctor_instructions?: string;
  doc_id?: string;
}

export interface TherapyRoadmap {
  current_phase: TherapyPhase;
  treatment_approaches: string[];
  sessions: RoadmapSession[];
  active_session_number?: number | null;
  created_at: string;
  updated_at: string;
}

export interface RescueTask {
  id: string;
  text: string;
  dimension: RescueDimension;
  status: "PENDING" | "DONE";
  created_at: string;
  doctor_name?: string;
  doctor_id?: number;
  due_date?: string;
  case_id?: string | null;
}

export interface CulturalResource {
  id: string;
  type: ResourceType;
  title: string;
  creator: string;
  reason_for_prescription: string;
  content_excerpt?: string;
  status: "SUGGESTED" | "CONSUMED";
}

export interface ThoughtAppendix {
  resources: CulturalResource[];
}

export interface MedicationEntry {
  id: string;
  drug_name: string;
  dosage?: string;
  usage_instructions?: string;
  timing?: string;
  duration?: string;
  notes?: string;
  prescribed_at?: string;
  doctor_id?: number;
  doctor_name?: string;
  case_id?: string | null;
}

export interface FormDefinition {
  key: string;
  title: string;
  description: string;
  handler: string;
  schema: Array<{
    name?: string;
    label?: string;
    title?: string;
    description?: string;
    type: string;
    width?: "full" | "half";
    options?: string[];
    help_text?: string;
    fields?: any[];
    columns?: any[];
  }>;
}

export interface ClinicalTestCatalogItem {
  id: number;
  title: string;
  url: string;
}

export interface InteractiveTestCatalogItem {
  id: number;
  esanj_test_id: number;
  title: string;
  title_employee?: string;
  is_available?: boolean;
}

export interface ClinicalTestAttachment {
  id: string;
  file_name: string;
  file_path?: string | null;
  file_uploaded_at?: string | null;
  content_type?: string | null;
}

export interface ClinicalTestEntry {
  id: string;
  source?: "manual" | "interactive";
  catalog_id?: number | null;
  interactive_test_id?: number | null;
  interactive_status?: "ASSIGNED" | "IN_PROGRESS" | "SUBMITTED" | "COMPLETED" | "FAILED" | null;
  interactive_attempt_id?: string | null;
  assigned_to_user_id?: number | null;
  assigned_by_user_id?: number | null;
  completed_at?: string | null;
  title: string;
  url?: string;
  result_text?: string;
  result_summary?: string;
  attachments?: ClinicalTestAttachment[];
  file_name?: string | null;
  file_path?: string | null;
  file_uploaded_at?: string | null;
  created_at?: string;
  updated_at?: string;
  case_id?: string | null;
  submitted_by_doctor_id?: number;
}

export type ExpertCanvasTab = "CASE_OVERVIEW" | "ROADMAP" | "RESCUENET" | "MEDICATIONS" | "APPENDIX" | "FILES";
export type VisitorCanvasTab = "CASE_OVERVIEW" | "RESCUENET" | "MEDICATIONS" | "TIMELINE" | "LIBRARY" | "FILES";
export type CaseOverviewSection = "clinical_summary" | "forms_tests_analysis" | "forms" | "tests";
export type TestMode = "full_catalog" | "exams_only" | "disabled";

export interface ProfessionFeaturePolicy {
  show_clinical_summary: boolean;
  show_forms_tests_analysis: boolean;
  forms_enabled: boolean;
  form_history_visible: boolean;
  tests_visible: boolean;
  files_enabled: boolean;
  medications_enabled: boolean;
  rescue_net_enabled: boolean;
  appendix_enabled: boolean;
  roadmap_enabled: boolean;
  timeline_enabled: boolean;
  library_enabled: boolean;
}

export interface CaseFileTextStats {
  readable: boolean;
  total_chars: number;
  total_chunks: number;
  total_pages: number;
}

export interface CaseFileEntry {
  id: string;
  name: string;
  description?: string;
  original_file_name: string;
  storage_path?: string;
  content_type?: string;
  size_bytes?: number;
  uploaded_at: string;
  uploaded_by_user_id?: number;
  uploaded_by_role?: "EXPERT" | "VISITOR";
  case_id?: string | null;
  doctor_id?: number | null;
  file_extension?: string;
  extraction_status?: "PENDING" | "READY" | "FAILED" | "UNSUPPORTED";
  text_stats: CaseFileTextStats;
}

export interface CaseVoiceNote {
  id: string;
  file_name: string;
  storage_path?: string;
  content_type?: string;
  size_bytes: number;
  duration_seconds: number;
  created_at: string;
  uploaded_by_user_id?: number;
}

export interface BaseProfileState {
  form: Record<string, any>;
  forms: any[];
  tests: ClinicalTestEntry[];
}

export interface CaseSummary {
  id: string;
  title: string;
  doctor_id?: number | null;
  doctor_name?: string;
  owner_doctor_id?: number | null;
  owner_doctor_name?: string;
  doctor_role_label?: string;
  doctor_profession_slug?: string | null;
  doctor_profession_label?: string | null;
  access_mode?: "OWNER" | "READ_ONLY";
  can_edit?: boolean;
  is_read_only?: boolean;
  shared_with?: CaseShareGrant[];
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CaseShareGrant {
  grantee_doctor_id: number;
  grantee_doctor_name: string;
  grantee_doctor_role_label?: string;
  grantee_doctor_profession_slug?: string | null;
  grantee_doctor_profession_label?: string | null;
  access_mode: "READ_ONLY";
  status: "ACTIVE" | "REVOKED";
}

export interface CaseShareCandidate {
  id: number;
  name: string;
  role_label?: string;
  profession_slug?: string | null;
  profession_label?: string | null;
}

export interface ExpertCaseState {
  id: string;
  title: string;
  doctor_id?: number | null;
  doctor_name?: string;
  doctor_profession_slug?: string | null;
  doctor_profession_label?: string | null;
  can_edit?: boolean;
  is_read_only?: boolean;
  visible_tabs?: ExpertCanvasTab[];
  case_overview_sections?: CaseOverviewSection[];
  allowed_form_keys?: string[];
  test_mode?: TestMode;
  feature_policy?: ProfessionFeaturePolicy;
  clinical_summary?: string;
  summary_voice_notes?: CaseVoiceNote[];
  forms_tests_analysis?: string;
  roadmap_data: TherapyRoadmap;
  active_goals: string[];
  appendix_data: ThoughtAppendix;
  medications: MedicationEntry[];
  tasks: RescueTask[];
  forms: any[];
  tests: ClinicalTestEntry[];
  files: CaseFileEntry[];
  sessions: any[];
}

export interface PatientManagerState {
  is_active: boolean;
  active_view: "BASE" | "CASES";
  active_tab: ExpertCanvasTab;
  visible_tabs?: ExpertCanvasTab[];
  case_overview_sections?: CaseOverviewSection[];
  allowed_form_keys?: string[];
  test_mode?: TestMode;
  feature_policy?: ProfessionFeaturePolicy;
  patient_profile: {
    id: number;
    name: string;
    phone: string;
    avatar_url?: string;
    age?: number | string;
    marital_status?: string;
    education?: string;
    job?: string;
  };
  base_profile: BaseProfileState;
  cases: CaseSummary[];
  selected_case_id?: string | null;
  selected_case?: ExpertCaseState | null;
  tests_catalog: ClinicalTestCatalogItem[];
  available_forms: FormDefinition[];
  ui_signal?: {
    type: "OPEN_FORM" | "DRAFT_FORM";
    form?: FormDefinition;
    data?: Record<string, any>;
  };
}

export interface VisitorCaseState {
  id: string | null;
  title: string;
  doctor_id?: number | null;
  doctor_name?: string;
  doctor_role_label?: string;
  doctor_profession_slug?: string | null;
  doctor_profession_label?: string | null;
  shared_with?: CaseShareGrant[];
  visible_tabs?: VisitorCanvasTab[];
  case_overview_sections?: CaseOverviewSection[];
  allowed_form_keys?: string[];
  test_mode?: TestMode;
  feature_policy?: ProfessionFeaturePolicy;
  greeting?: string;
  clinical_summary?: string;
  current_phase?: string;
  active_goals?: string[];
  tasks: RescueTask[];
  medications: MedicationEntry[];
  timeline: any[];
  library: CulturalResource[];
  tests: ClinicalTestEntry[];
  forms: any[];
  files: CaseFileEntry[];
  forms_tests_analysis?: string;
}

export interface PatientJourneyState {
  is_active: boolean;
  active_view: "BASE" | "CASES";
  active_tab: VisitorCanvasTab;
  visible_tabs?: VisitorCanvasTab[];
  case_overview_sections?: CaseOverviewSection[];
  allowed_form_keys?: string[];
  test_mode?: TestMode;
  feature_policy?: ProfessionFeaturePolicy;
  base_profile: BaseProfileState;
  cases: CaseSummary[];
  selected_case_id?: string | null;
  selected_case?: VisitorCaseState | null;
  my_doctors?: Array<{ id: number; name: string }>;
  selected_doctor_id?: number | null;
  available_forms?: FormDefinition[];
  ui_signal?: {
    type: "OPEN_FORM" | "DRAFT_FORM";
    form?: FormDefinition;
    data?: Record<string, any>;
  };
}
