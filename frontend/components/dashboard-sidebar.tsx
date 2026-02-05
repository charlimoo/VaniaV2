// frontend/components/dashboard-sidebar.tsx
"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Command } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { UserProfileMenu } from "@/components/user-profile-menu"
import { useUser } from "@/hooks/use-user"
import { APP_CONFIG } from "@/lib/config"
import { cn } from "@/lib/utils"

export function DashboardSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { user, logout } = useUser()
  const { open } = useSidebar()

  // --- CHANGED LOGIC START ---
  const navItems = APP_CONFIG.SIDEBAR.items.filter(item => {
    // 1. Check visibility flag
    if (!item.visible) return false;

    // 2. Check Role Permissions
    // @ts-ignore - Assuming you haven't strictly typed APP_CONFIG yet
    const allowedRoles = item.allowedRoles as string[] | undefined;
    
    // If no specific roles defined, everyone sees it
    if (!allowedRoles || allowedRoles.length === 0) return true;

    // If roles defined, check if user has the matching role
    if (user?.role_slug && allowedRoles.includes(user.role_slug)) {
      return true;
    }

    return false;
  });

  return (
    <Sidebar collapsible="icon" side="right" {...props}>
      <SidebarHeader className="h-14 border-b border-sidebar-border p-0 flex flex-col justify-center">
        {open ? (
          <SidebarMenu className="px-2 w-full">
            <SidebarMenuItem>
              <SidebarMenuButton 
                size="lg" 
                asChild
                className="w-full justify-start gap-2 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <Link href="/dashboard">
                  <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-foreground overflow-hidden">
                    {APP_CONFIG.IMAGES.LOGO_ICON ? (
                      <img src={APP_CONFIG.IMAGES.LOGO_ICON} alt="Logo" className="size-full object-contain p-1" />
                    ) : (
                      <Command className="size-4 text-primary" />
                    )}
                  </div>
                  <div className="grid flex-1 text-start text-sm leading-tight">
                    <span className="truncate font-semibold">{APP_CONFIG.BRANDING.APP_NAME}</span>
                    <span className="truncate text-xs">{APP_CONFIG.BRANDING.APP_TAGLINE}</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : (
          <div className="w-full flex items-center justify-center">
            <Link 
              href="/dashboard" 
              className="flex aspect-square size-10 items-center justify-center rounded-lg hover:bg-sidebar-accent transition-colors"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary/10 text-primary-foreground overflow-hidden">
                {APP_CONFIG.IMAGES.LOGO_ICON ? (
                  <img src={APP_CONFIG.IMAGES.LOGO_ICON} alt="Logo" className="size-full object-contain p-1" />
                ) : (
                  <Command className="size-4 text-primary" />
                )}
              </div>
            </Link>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent className="pt-2">
            <SidebarMenu>
              {navItems.map((item) => {
                // Determine active state: exact match or sub-path match (except dashboard root)
                const isActive = pathname === item.url || (item.url !== '/dashboard' && pathname.startsWith(item.url));
                
                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      isActive={isActive}
                      className="
                        group/menu-btn 
                        w-full justify-start gap-3 px-3 py-2 h-10 transition-all duration-200 ease-in-out
                        hover:bg-sidebar-accent/50 
                        data-[active=true]:bg-sidebar-accent/40 
                        data-[active=true]:font-medium
                        relative overflow-visible
                      "
                    >
                      <Link href={item.url} className="flex items-center gap-3 relative z-10">
                        {isActive && (
                          <div className="absolute right-[-12px] top-1/2 -translate-y-1/2 h-6 w-1 rounded-l-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
                        )}
                        <item.icon 
                          className={cn(
                            "size-4 shrink-0 transition-colors duration-200",
                            isActive 
                              ? "text-primary fill-primary/20" 
                              : "text-muted-foreground group-hover/menu-btn:text-foreground"
                          )}
                        />
                        {open && (
                          <span className="transition-colors text-start animate-in fade-in duration-200">
                            {item.title}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-0">
        <UserProfileMenu user={user} onLogout={logout} />
      </SidebarFooter>
      
      <SidebarRail />
    </Sidebar>
  )
}