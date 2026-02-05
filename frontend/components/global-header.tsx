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
        "flex h-14 shrink-0 items-center justify-between border-b px-4 sticky top-0 z-20 transition-[width,height] ease-linear",
        "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        className
      )}
      dir="rtl"
    >
      {/* Left Side (RTL Right): Navigation */}
      <div className="flex items-center gap-2">
        <SidebarTrigger className="mr-0" />
        
        {title ? (
          <span className="text-sm font-medium truncate max-w-[200px] sm:max-w-md animate-in fade-in">
            {title}
          </span>
        ) : (
          <DynamicBreadcrumb />
        )}
      </div>

      {/* Right Side (RTL Left): Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Page Specific Actions */}
        {children}

        {/* Global Tools */}
        <div className="flex items-center gap-1">
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