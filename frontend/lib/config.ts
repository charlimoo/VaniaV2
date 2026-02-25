// frontend/lib/config.ts
import { 
  LayoutDashboard, 
  CreditCard, 
  Receipt, 
  Settings, 
  HelpCircle,
  MessageSquare,
  Stethoscope,  
  Users         
} from "lucide-react";

export const APP_CONFIG = {
  // --- CORE IDENTITY ---
  BRANDING: {
    APP_NAME: "وانیا اپ",
    APP_TAGLINE: "همراه هوشمند شما",
    COMPANY_NAME: "وانیا",
  },

  // --- ASSETS & IMAGES ---
  IMAGES: {
    AUTH_BACKGROUND: "/auth.jpg",
    AUTH_PAGE_BACKGROUND: "/authback.jpg",
    LOGO_ICON: "/logo.png",
    FAVICON: "/logo.png",
    AGENT_AVATAR_PLACEHOLDER: "", 
  },
  
  // --- ECONOMY: FIAT (REAL MONEY) ---
  ECONOMY: {
    LOCALE: "fa-IR", // Persian locale for correct digit formatting
    CURRENCY_CODE: "IRR",
    CURRENCY_SYMBOL: "تومان",
  },

  // --- ECONOMY: VIRTUAL CREDITS ---
  CREDITS: {
    DEFAULT_DAILY_FREE_AMOUNT: 5.0, // Fallback if API fails
    DISPLAY_PRECISION: 0, 
    SYMBOL: 'سرمایه گفت‌وگو',
    NAME_SINGULAR: 'سرمایه گفت‌وگو',
    NAME_PLURAL: 'سرمایه گفت‌وگو',
  },

  // --- UI TEXT & LABELS ---
  TEXT: {
    // Dashboard
    DASHBOARD_GREETING: "خوش اومدی",
    DASHBOARD_SUBTEXT: "دستیار مورد نظرت رو انتخاب کن و به گفت و گو بپرداز",

    // Billing
    BILLING_TITLE: "خرید اشتراک",
    BILLING_DESC: "خرید اشتراک، افزایش اعتبار و مشاهده تراکنش‌ها.",
    PLAN_ACTIVE_LABEL: "طرح فعال",
    PLAN_EXPIRES_LABEL: "تاریخ انقضا",
    BUY_CREDIT_TITLE: "افزایش موجودی",
    BUY_PLAN_TITLE: "ارتقای اشتراک",

    // Chat Interface
    CHAT_WELCOME_TITLE: "سلام!",
    CHAT_WELCOME_SUBTITLE: "امروز چه کمکی از من برمیاد؟",
    CHAT_INPUT_PLACEHOLDER: "بنویسید...",
    NEW_THREAD_TITLE: "گفتگوی جدید",
    
    // Agent Grid
    AGENT_FALLBACK_DESC: "یک دستیار هوش مصنوعی پیشرفته آماده برای کمک به وظایف شما.",
    
    // Canvas / Status
    LOADING_INIT: "در حال راه‌اندازی...",
    LOADING_CHAT: "در حال بارگذاری محیط گفتگو...",
    LOADING_WORKSPACE: "در حال آماده‌سازی میزکار...",
    CANVAS_LOCKED: "دستیار در حال بروزرسانی بوم است. ویرایش موقتاً قفل شده است.",

    // Settings
    MEMORY_TAB_TITLE: "بانک خاطرات",
    MEMORY_TAB_DESC: "مدیریت اطلاعاتی که دستیارها درباره شما آموخته‌اند.",
    MEMORY_UNKNOWN_FACT: "اطلاعات نامشخص",
  },

  // --- SIDEBAR CONFIGURATION (Merged) ---
  SIDEBAR: {
    items: [
      {
        key: "dashboard",
        title: "پیشخوان",
        url: "/dashboard",
        icon: LayoutDashboard,
        visible: true
      },
      // [NEW] Communication Hub
      {
        key: "messages",
        title: "پیام‌ها",
        url: "/dashboard/messages",
        icon: MessageSquare,
        visible: true
      },
      // Expert Specific View
      {
        key: "visitors",
        title: "مدیریت مراجعین",
        url: "/dashboard/visitors",
        icon: Users,
        visible: true, // You can toggle this based on role in the Sidebar component later
        allowedRoles: ['expert']
      },
      // Visitor Specific View
      {
        key: "experts",
        title: "متخصصان من",
        url: "/dashboard/experts",
        icon: Stethoscope,
        visible: true,
        allowedRoles: ['visitor']
      },
      {
        key: "billing",
        title: "خرید اشتراک",
        url: "/dashboard/billing",
        icon: CreditCard,
        visible: true
      },
      {
        key: "invoices",
        title: "سفارشات",
        url: "/dashboard/invoices",
        icon: Receipt,
        visible: true
      },
      {
        key: "settings",
        title: "تنظیمات",
        url: "/dashboard/settings",
        icon: Settings,
        visible: true
      },
      {
        key: "faq",
        title: "راهنما و سوالات",
        url: "/dashboard/faq",
        icon: HelpCircle,
        visible: true
      }
    ]
  },

  // --- FEATURE FLAGS ---
  FEATURES: {
    ENABLE_BILLING: true,
    // [UPDATED] Disabled memory feature
    ENABLE_MEMORY: false,
    ENABLE_FAQ: true,
  }
};
