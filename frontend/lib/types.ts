// frontend/lib/types.ts

// --- Economy Configuration ---
export interface EconomyConfig {
  currency_name: string;
  currency_symbol: string;
  daily_free_credits: string; 
  transcription_cost_per_minute: string;
  bank_card_number?: string;
  bank_holder_name?: string;
  manual_payment_tips?: string;
  support_phone?: string;
  support_email?: string;
  support_address?: string;
}

export interface FAQItem {
  id: number;
  question: string;
  answer: string;
  category: string;
}

// --- Subscription Plans ---
export interface SubscriptionPlan {
  id: number;
  slug: string;
  name: string;
  description: string;
  price: string;
  duration_days: number;
  included_credits: string;
  included_agents: string[]; // List of agent names/slugs unlocked
  included_agent_slugs?: string[];
  is_active: boolean;
}

// --- User & Wallet Definitions ---
export interface WalletInfo {
  id: number;
  // Balances as strings to preserve decimal precision
  balance_plan: string;    
  balance_paid: string;
  daily_free_used: string;
  
  // Plan Metadata (Flattened from UserWalletSerializer)
  active_plan_name?: string | null;
  plan_expires_at?: string | null;
  
  updated_at: string;
}

export interface UserData {
  id: number;
  phone_number: string;
  full_name?: string;
  email?: string;
  date_joined: string;
  role_slug?: string;  // e.g., 'doctor' | 'patient'
  role_label?: string; // e.g., 'پزشک' | 'بیمار'
  // Single Wallet Object (No more roles list or primary_wallet_info)
  wallet?: WalletInfo;
}

// --- Agent Service ---

// [NEW] Demo Mode Configuration Types
export type DemoAccessMode = 'ALLOWED' | 'BLOCKED';
export type DemoLimitScope = 'SESSION' | 'DAILY' | 'TOTAL' | 'NONE';
export type DemoCanvasMode = 'HIDDEN' | 'LOCKED' | 'OPEN';

export interface DemoConfig {
  access_mode: DemoAccessMode;
  model_override?: string | null;
  message_limit_scope: DemoLimitScope;
  message_limit_count: number;
  canvas_mode: DemoCanvasMode;
  canvas_placeholder_text?: string;
}

export interface ServiceSuggestion {
  title: string;
  subtitle: string;
  prompt: string;
}

export interface AgentUIConfig {
  has_canvas: boolean;
  default_width: number;
  show_voice_input: boolean;
  mobile_view_default?: 'chat' | 'canvas';
}

export interface AgentService {
  id: number;
  name: string;
  slug: string;
  description: string;
  model_id?: string;
  user_guide?: string;
  supported_canvases: string[]; 
  ui_config: AgentUIConfig; 
  is_free: boolean;
  is_public: boolean;
  is_active: boolean;
  is_accessible: boolean;
  
  // Dynamic Access Status (Computed by Backend)
  access_status: 'FREE' | 'OWNED' | 'LOCKED' | 'MAINTENANCE';
  is_owned: boolean;
  license_expires_at: string | null;

  // [NEW] Demo Rules & Usage from Backend
  demo_config?: DemoConfig;
  current_usage?: number; // Usage count for DAILY or TOTAL scopes at page load
  
  tags: string[];               
  cost_multiplier: string; 
  suggestions: ServiceSuggestion[];
  quick_actions?: { handle: string; name: string }[];
  
  // Technical Logic
  reasoning_type?: 'NATIVE' | 'HYBRID' | 'NONE'; 
  capabilities?: string[];
  enable_reasoning: boolean;
  reasoning_effort: 'low' | 'medium' | 'high' | 'none';
}

// --- Billing & Invoicing ---
export interface BillingProduct { 
  id: number; 
  name: string; 
  description: string; 
  price: string; 
  credit_amount: string; 
  
  // Nested Plan Details (if this product is a plan activation)
  plan_details?: SubscriptionPlan; 
}

export interface Invoice {
  id: string;
  status: "PENDING" | "PAID" | "CANCELLED" | "WAITING"; 
  total_amount: string;
  created_at: string;
  item_name?: string;
  item_description?: string;
  user_name?: string;
  user_phone?: string;
  transaction_ref_id?: string;
  discount_amount?: string;
}

// --- Dynamic Forms ---
export interface FormField {
  name: string;
  label: string;
  type: "select" | "checkbox" | "text" | "number" | "email" | "textarea" | "date";
  options?: string[]; 
  required?: boolean;
  placeholder?: string;
}

export interface FormPayload {
  form_handle: string; 
  title: string;
  description?: string;
  prefill?: Record<string, any>; 
  schema: FormField[];
}
