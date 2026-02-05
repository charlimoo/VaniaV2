// start of frontend/app/(chat)/chat/layout.tsx
"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { useUser } from "@/hooks/use-user"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { ChatSidebar } from "@/components/chat/chat-sidebar"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { ChatLayoutProvider } from "@/components/chat/chat-layout-context"
import { APP_CONFIG } from "@/lib/config";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isAuthenticated, loading } = useUser()
  const router = useRouter()

  // 1. Auth Guard
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/auth")
    }
  }, [isAuthenticated, loading, router])

  // 2. Loading State
  if (loading) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{APP_CONFIG.TEXT.LOADING_CHAT}</p>
        </div>
      </div>
    )
  }

  // Prevent flash
  if (!isAuthenticated) return null 

  // 3. Render Chat Shell
  return (
    <ChatLayoutProvider>
      {/* 
        Outer Provider: Controls the Global Navigation Rail (Dashboard Sidebar).
        - open={false}: Forces the sidebar to stay collapsed (Rail mode).
        - defaultOpen={false}: Ensures initial state is collapsed.
      */}
      <SidebarProvider 
        open={false} 
        defaultOpen={false}
        onOpenChange={() => {}} 
        className="h-dvh w-full overflow-hidden"
      >
        
        {/* 
          Global Navigation Rail
          - side="right": Placed at the rightmost edge (Start in RTL).
        */}
        <DashboardSidebar side="right" />
        
        {/* 
          Outer Inset: Wraps the Chat Area.
          Occupies the space to the LEFT of the Dashboard Rail.
        */}
        <SidebarInset className="h-full overflow-hidden p-0">
          
          {/* Inner Provider: Manages the Chat Sidebar. */}
          <SidebarProvider className="h-full w-full">
            
            {/* 
              Chat Sidebar (Thread History)
              [FIX]: Added style={{ right: '3rem' }}.
              Since the DashboardSidebar occupies the first 3rem (48px) on the right,
              we must offset the ChatSidebar by that amount to place it immediately 
              to the left of the rail, preventing overlap.
            */}
            <ChatSidebar style={{ right: '3rem' }} />
            
            {/* Inner Inset: Main Content (Chat Thread + Canvas) */}
            <SidebarInset className="h-full overflow-hidden flex flex-col">
              {children}
            </SidebarInset>
            
          </SidebarProvider>
        </SidebarInset>
        
      </SidebarProvider>
    </ChatLayoutProvider>
  )
}