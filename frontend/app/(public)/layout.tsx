"use client";

import { ThemeProvider } from "@/components/providers/theme-provider";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <div className="min-h-screen w-full bg-[#050505] text-foreground flex flex-col" dir="rtl">
        
        {/* Simple Public Header */}
        <header className="container mx-auto px-6 py-6 flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-white pl-0">
              <ArrowRight className="h-4 w-4" />
              بازگشت به خانه
            </Button>
          </Link>
        </header>

        {/* Main Content */}
        <main className="flex-1 container mx-auto px-6 pb-20">
          <div className="max-w-4xl mx-auto">
            {children}
          </div>
        </main>

      </div>
    </ThemeProvider>
  );
}