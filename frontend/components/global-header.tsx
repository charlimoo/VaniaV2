"use client"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"
import { DynamicBreadcrumb } from "@/components/dynamic-breadcrumb";
import {NotificationBell} from "@/components/notifications/notification-bell"
interface GlobalHeaderProps {
  /**
   * Optional title override. If provided, replaces the breadcrumb.
   * Useful for Chat pages where the Thread Title is more relevant.
   */
  title?: string
  
  /**
   * Layout variant.
   */
  variant: "dashboard" | "chat"
  
  /**
   * Slot for page-specific actions (e.g. Chat Controls).
   */
  children?: React.ReactNode 
  
  className?: string
}

export function GlobalHeader({ title, variant, children, className }: GlobalHeaderProps) {
  return (
    <header 
      className={cn(
        "sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b px-2 sm:px-4 transition-[width,height] ease-linear",
        "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        className
      )}
      dir="rtl"
    >
      {/* Left Side (RTL Right): Navigation */}
      <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
        <SidebarTrigger className="mr-0" />
        
        {title ? (
          <span className="animate-in fade-in truncate text-sm font-medium max-w-[140px] sm:max-w-[240px] md:max-w-md">
            {title}
          </span>
        ) : (
          <DynamicBreadcrumb />
        )}
      </div>

      {/* Right Side (RTL Left): Actions */}
      <div className="ml-2 flex shrink-0 items-center gap-1 sm:gap-2">
        {/* Page Specific Actions */}
        {children}

        {/* Global Tools */}
        <div className="flex items-center gap-0.5 sm:gap-1">
            {/* 
               [REMOVED] CartDropdown 
               Direct purchase flow replaces the shopping cart.
            */}
            <NotificationBell />
            <ThemeToggle />

        </div>
      </div>
    </header>
  )
}
