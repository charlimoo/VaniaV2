// frontend/app/(dashboard)/dashboard/layout.tsx
"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/hooks/use-user"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { GlobalHeader } from "@/components/global-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Loader2 } from "lucide-react"
import { APP_CONFIG } from "@/lib/config"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isAuthenticated, loading } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/auth")
    }
  }, [isAuthenticated, loading, router])

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{APP_CONFIG.TEXT.LOADING_WORKSPACE}</p>
        </div>
      </div>
    )
  }

  // Prevent flash of unstyled content
  if (!isAuthenticated) return null 

  return (
    <SidebarProvider>
      <DashboardSidebar />
      
      <SidebarInset>
        {/* Unified Global Header for Dashboard */}
        <GlobalHeader 
          variant="dashboard" 
          title="ناحیه کاربری" 
        />
        
        {/* Main Content Area */}
        <main className="flex flex-1 flex-col gap-4 p-4 pt-4 h-full">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}