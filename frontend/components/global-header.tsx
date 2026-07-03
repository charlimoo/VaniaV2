"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { BookOpenCheck, Loader2 } from "lucide-react"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"
import { DynamicBreadcrumb } from "@/components/dynamic-breadcrumb";
import {NotificationBell} from "@/components/notifications/notification-bell"
import { SupportChatButton } from "@/components/support-chat-button"
import { API_BASE_URL, getAuthHeaders } from "@/lib/api"

type PageTutorial = {
  id: number
  title: string
  path: string
  video_url: string
  match_prefix: boolean
}

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
  const pathname = usePathname()
  const [tutorial, setTutorial] = useState<PageTutorial | null>(null)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [tutorialLoading, setTutorialLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    const loadTutorial = async () => {
      const headers = getAuthHeaders()
      if (!headers.Authorization) {
        setTutorial(null)
        return
      }

      setTutorialLoading(true)
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/vania/page-tutorials/match/?path=${encodeURIComponent(pathname || "/")}`,
          { headers },
        )
        if (!res.ok) {
          if (!cancelled) setTutorial(null)
          return
        }
        const data = await res.json().catch(() => null)
        if (!cancelled) {
          setTutorial(data?.tutorial?.video_url ? data.tutorial : null)
        }
      } catch {
        if (!cancelled) setTutorial(null)
      } finally {
        if (!cancelled) setTutorialLoading(false)
      }
    }

    loadTutorial()

    return () => {
      cancelled = true
    }
  }, [pathname])

  return (
    <>
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
              {tutorial && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setTutorialOpen(true)}
                  className="h-8 gap-1.5 rounded-md px-2 text-xs sm:px-3"
                >
                  <BookOpenCheck className="size-4 text-primary" />
                  <span className="whitespace-nowrap">آموزش این قسمت</span>
                </Button>
              )}
              {!tutorial && tutorialLoading && (
                <span className="hidden h-8 items-center px-1 text-muted-foreground sm:flex" aria-label="در حال بررسی آموزش">
                  <Loader2 className="size-4 animate-spin" />
                </span>
              )}
              {/* 
                 [REMOVED] CartDropdown 
                 Direct purchase flow replaces the shopping cart.
              */}
              <NotificationBell />
              <SupportChatButton />
              <ThemeToggle />

          </div>
        </div>
      </header>

      <Dialog open={tutorialOpen} onOpenChange={setTutorialOpen}>
        <DialogContent dir="rtl" className="w-[calc(100vw-1rem)] max-w-4xl overflow-hidden p-0 sm:w-[calc(100vw-2rem)]">
          <DialogHeader className="px-4 pb-2 pt-4 text-right sm:px-6">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <BookOpenCheck className="size-5 text-primary" />
              {tutorial?.title || "آموزش این قسمت"}
            </DialogTitle>
            <DialogDescription>
              ویدیوی آموزشی
            </DialogDescription>
          </DialogHeader>
          <div className="px-4 pb-4 sm:px-6 sm:pb-6">
            {tutorial?.video_url ? (
              <div className="overflow-hidden rounded-lg border bg-black">
                <video
                  key={tutorial.video_url}
                  src={tutorial.video_url}
                  controls
                  playsInline
                  preload="metadata"
                  className="aspect-video max-h-[70vh] w-full bg-black object-contain"
                />
              </div>
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-lg border bg-muted text-sm text-muted-foreground">
                ویدیوی آموزشی در دسترس نیست.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
