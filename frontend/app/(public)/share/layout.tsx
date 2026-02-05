// frontend/app/(public)/share/layout.tsx
import { APP_CONFIG } from "@/lib/config";
import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function ShareLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col min-h-screen bg-background font-sans" dir="rtl">
      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center w-full max-w-5xl mx-auto p-4 sm:p-6">
        {children}
      </main>

      {/* Sticky/Fixed CTA Footer */}
      <footer className="sticky bottom-0 z-50 w-full border-t border-border bg-background/80 backdrop-blur-md p-4">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="hidden sm:flex flex-col">
                <span className="text-xs font-bold">{APP_CONFIG.BRANDING.APP_NAME}</span>
                <span className="text-[10px] text-muted-foreground">ساخته شده با هوش مصنوعی</span>
            </div>
          </div>

          <Link 
            href="/"
            className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-full text-xs font-bold transition-transform hover:scale-105 shadow-lg shadow-primary/20"
          >
            حساب خود را بسازید
          </Link>
        </div>
      </footer>
    </div>
  );
}