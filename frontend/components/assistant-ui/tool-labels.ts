// components/assistant-ui/tool-labels.ts

const parse = (args: string | object) => {
  if (typeof args === "object") return args;
  try {
    return JSON.parse(args);
  } catch {
    return {};
  }
};

type LabelGenerator = (args: any) => string;

type ToolConfig = {
  active: string | LabelGenerator;
  completed: string | LabelGenerator;
};

// Tools that shouldn't show their arguments in the collapsed badge
export const HIDE_ARGS_TOOLS = ["think", "analyze", "reasoning_tool", "read_chat_history", "transfer_to_agent"];

export const TOOL_LABELS: Record<string, ToolConfig> = {
  // --- Web Search ---
  duckduckgo_search: {
    active: (args) => `جستجو در وب برای "${args.query || '...'}"`,
    completed: (args) => `جستجو برای "${args.query}" انجام شد`,
  },
  google_search: {
    active: (args) => `جستجو در گوگل برای "${args.query || '...'}"`,
    completed: "نتایج جستجو دریافت شد",
  },
  
  // --- RAG / Knowledge Base ---
  search_knowledge_base: {
    active: (args) => `جستجو در اسناد برای "${args.query || '...'}"`,
    completed: "اسناد مرتبط پیدا شد",
  },
  knowledge_base_tool: {
    active: "مشورت با پایگاه دانش...",
    completed: "اطلاعات بازیابی شد",
  },
  read_chat_history: {
    active: "مرور تاریخچه گفتگو...",
    completed: "تاریخچه بررسی شد",
  },

  // --- Finance ---
  get_stock_price: {
    active: (args) => `بررسی قیمت نماد ${args.symbol || 'سهم'}`,
    completed: (args) => `قیمت ${args.symbol} دریافت شد`,
  },
  get_current_stock_price: {
    active: (args) => `استعلام قیمت لحظه‌ای ${args.symbol || 'سهام'}`,
    completed: (args) => `قیمت ${args.symbol} بروزرسانی شد`,
  },
  yfinance_tools: {
     active: "دریافت داده‌های بازار سرمایه...",
     completed: "داده‌های مالی دریافت شد",
  },
  
  // --- Utilities ---
  calculator: {
    active: (args) => `محاسبه عبارت ${args.expression || '...'}`,
    completed: "محاسبه انجام شد",
  },
  get_featured_products: {
    active: "جستجوی محصولات پیشنهادی...",
    completed: "محصولات پیدا شد",
  },
  
  // --- Internal / Logic ---
  analyze: {
    active: "تحلیل داده‌ها...",
    completed: "تحلیل تکمیل شد",
  },
  think: {
    active: "در حال تفکر...",
    completed: "پردازش منطقی",
  },
  set_trade_view: {
    active: "بروزرسانی بوم...",
    completed: "بوم بروزرسانی شد",
  },
  find_hs_code: {
    active: "جستجوی کد...",
    completed: "جستجوی کد انجام شد",
  },
  lookup_entity_id: {
    active: "جستجوی موجودیت...",
    completed: "جستجوی موجودیت انجام شد",
  },
  run_sql_query: {
    active: "جستجوی داده ها...",
    completed: "جستجوی داده ها انجام شد",
  },
  transfer_to_agent: {
    active: (args) => `انتقال به دستیار ${args.agent_id || 'جدید'}...`,
    completed: "گفتگو منتقل شد",
  },
  // Demo Tools
  analyze_reexport_route: {
    active: (args) => `در حال انجام کار...`,
    completed: "مسیر تجاری تحلیل شد",
  },
  create_pnl_model: {
    active: (args) => `در حال انجام کار...`,
    completed: "محاسبات مالی انجام شد",
  },
  run_risk_simulation: {
    active: (args) => `در حال انجام کار...`,
    completed: "شبیه سازی اجرا شد",
  },
  analyze_shipments_vs_new_directive: {
    active: (args) => `در حال انجام کار...`,
    completed: "تطبیق انجام شد",
  },
  extract_and_validate_pattern: {
    active: (args) => `در حال انجام کار...`,
    completed: "اعتبار سنجی الگو ها انجام شد",
  },
  update_document_clause: {
    active: (args) => `در حال انجام کار...`,
    completed: "بروز رسانی محتوا انجام شد",
  },
  generate_document: {
    active: (args) => `در حال انجام کار...`,
    completed: "تولید پیش‌نویس قرارداد",
  },
  get_trade_overview: {
    active: (args) => `در حال انجام کار...`,
    completed: "بارگذاری داده‌های نقشه جهانی",
  },
  verify_news_timeline: {
    active: (args) => `در حال انجام کار...`,
    completed: "خط زمانی اخبار تایید شد",
  },
  calculate_regulatory_impact: {
    active: (args) => `در حال انجام کار...`,
    completed: "آنالیز تاثیر قانون گذاری انجام شد",
  },

};

// [FIX] Updated to handle undefined name
export const getToolConfig = (name: string | undefined | null): ToolConfig => {
  const safeName = name || "system_tool";

  // 1. Direct Match
  if (TOOL_LABELS[safeName]) {
    return TOOL_LABELS[safeName];
  }

  // 2. Normalize and Format (Fallback)
  // Converts "my_custom_tool" -> "My Custom Tool"
  const formattedName = safeName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return {
    active: `${formattedName}...`,
    completed: `${formattedName} تکمیل شد`,
  };
};

// [FIX] Updated to pass potentially undefined name safely
export const getSmartLabel = (name: string | undefined | null, status: 'active' | 'completed', argsText: string) => {
  const config = getToolConfig(name);
  const generator = config[status];
  
  if (typeof generator === "string") return generator;

  const args = parse(argsText);
  return generator(args);
};