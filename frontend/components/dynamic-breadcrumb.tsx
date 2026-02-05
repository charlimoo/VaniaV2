"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, Home } from "lucide-react";
import { Fragment } from "react";

// Mapping for known static routes
const ROUTE_MAP: Record<string, string> = {
  dashboard: "پیشخوان",
  billing: "خرید اشتراک",
  invoices: "سفارشات",
  settings: "تنظیمات",
  faq: "مرکز راهنما",
  chat: "گفتگو",
  auth: "احراز هویت",
};

export function DynamicBreadcrumb() {
  const pathname = usePathname();
  
  // Filter out empty strings from the split operation
  const segments = pathname.split("/").filter((item) => item !== "");

  // Don't show breadcrumbs on the root landing page
  if (segments.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="hidden sm:flex items-center text-sm font-medium text-muted-foreground animate-in fade-in slide-in-from-right-2 duration-500">
      <ol className="flex items-center gap-1.5">
        
        {/* Home Icon */}
        <li>
          <Link 
            href="/dashboard" 
            className="flex items-center hover:text-foreground transition-colors p-1.5 rounded-md hover:bg-muted/80"
            title="بازگشت به پیشخوان"
          >
            <Home className="h-4 w-4" />
          </Link>
        </li>

        {segments.map((segment, index) => {
          // Construct the path up to this segment
          const href = `/${segments.slice(0, index + 1).join("/")}`;
          const isLast = index === segments.length - 1;
          
          let label = ROUTE_MAP[segment];
          
          // Logic for Dynamic Segments
          if (!label) {
            // 1. UUID Detection (Standard 8-4-4-4-12 hex format) -> Invoice Page
            if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(segment)) {
                label = "جزئیات فاکتور";
            } 
            // 2. Draft/Session ID Detection (Starts with 'local-' or is very long) -> Chat Page
            else if (segment.startsWith("local-") || segment.length > 20) {
              label = "جزئیات گفتگو";
            } 
            // 3. Numeric ID Detection -> Generic Item
            else if (/^\d+$/.test(segment)) {
              label = `آیتم ${segment}`;
            } else {
              // Fallback: Capitalize first letter (if English) or just show segment
              label = segment;
            }
          }

          // Skip rendering "Dashboard" text since we already have the Home icon
          if (segment === 'dashboard') return null;

          return (
            <Fragment key={href}>
              {/* Separator */}
              <li aria-hidden="true" className="text-muted-foreground/40">
                <ChevronLeft className="h-4 w-4" />
              </li>
              
              {/* Breadcrumb Item */}
              <li>
                {isLast ? (
                  <span className="text-foreground font-semibold px-1 pointer-events-none select-none">
                    {label}
                  </span>
                ) : (
                  <Link 
                    href={href} 
                    className="hover:text-primary transition-colors hover:underline underline-offset-4 px-1"
                  >
                    {label}
                  </Link>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}