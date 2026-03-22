// frontend/components/chat/chat-sidebar.tsx

"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  MessageSquare,
  Plus,
  Loader2,
  Trash2,
  MoreHorizontal,
  Bot,
  ChevronsUpDown,
  Check,
  LayoutDashboard, // Added import
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { useUser } from "@/hooks/use-user"
import { threadManager, type ThreadMetadata } from "@/lib/SimpleThreadAdapters"
import { useChatLayout } from "@/components/chat/chat-layout-context"
import { APP_CONFIG } from "@/lib/config"
import { API_BASE_URL, getAuthHeaders } from "@/lib/api"
import { AgentService } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile" // Added import

export function ChatSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const params = useParams()
  const router = useRouter()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { user, logout } = useUser()
  const { refreshTrigger } = useChatLayout()
  const { setOpenMobile, open } = useSidebar()
  const isMobile = useIsMobile() // Added hook usage

  const agentId = params?.agentId as string
  const activeThreadId = params?.threadId as string

  const [threads, setThreads] = React.useState<ThreadMetadata[]>([])
  const [loading, setLoading] = React.useState(true)

  // Store all agents for the switcher
  const [allAgents, setAllAgents] = React.useState<AgentService[]>([])
  const [currentAgent, setCurrentAgent] = React.useState<AgentService | null>(null)

  // Fetch Agents
  React.useEffect(() => {
    const fetchAgents = async () => {
      try {
        const headers = getAuthHeaders()
        const res = await fetch(`${API_BASE_URL}/api/services/`, { headers })
        if (res.ok) {
          const data = await res.json()
          const sorted = [...data].sort((a: AgentService, b: AgentService) => {
            const aFeatured = a.ui_config?.featured ? 1 : 0
            const bFeatured = b.ui_config?.featured ? 1 : 0
            const aActive = a.access_status === "OWNED" || a.access_status === "FREE" ? 1 : 0
            const bActive = b.access_status === "OWNED" || b.access_status === "FREE" ? 1 : 0
            if (aFeatured !== bFeatured) return bFeatured - aFeatured
            if (aActive !== bActive) return bActive - aActive
            return a.name.localeCompare(b.name, "fa")
          })
          setAllAgents(sorted)

          if (agentId) {
            const found = sorted.find((s: AgentService) => s.slug === agentId)
            if (found) setCurrentAgent(found)
          }
        }
      } catch (e) {
        console.error("Agent fetch failed", e)
      }
    }
    fetchAgents()
  }, [agentId])

  // Fetch Threads
  React.useEffect(() => {
    const fetchThreads = async () => {
      const token = localStorage.getItem("accessToken")
      if (!token || !agentId) return

      try {
        const list = await threadManager.listThreads(token, agentId)
        setThreads(list)
      } catch (error) {
        console.error("Failed to load threads", error)
      } finally {
        setLoading(false)
      }
    }

    fetchThreads()
  }, [agentId, refreshTrigger])

  const handleNewChat = () => {
    const newId = `local-${crypto.randomUUID()}`
    router.push(`/chat/${agentId}/${newId}`)
    setOpenMobile(false)
  }

  const handleSwitchAgent = (slug: string) => {
    if (slug === agentId) return
    const newId = `local-${crypto.randomUUID()}`
    router.push(`/chat/${slug}/${newId}`)
    setOpenMobile(false)
  }

  const handleDelete = async (e: React.MouseEvent, threadId: string) => {
    e.stopPropagation()
    const token = localStorage.getItem("accessToken")
    if (!token) return

    setThreads((prev) => prev.filter((t) => t.threadId !== threadId))
    await threadManager.delete(threadId, token)

    if (activeThreadId === threadId) handleNewChat()
  }

  // Check access inside the component or fetch it
  const isPreviewMode =
    currentAgent &&
    currentAgent.access_status !== "OWNED" &&
    currentAgent.access_status !== "FREE"

  return (
    <Sidebar collapsible="icon" side="right" {...props}>
      <SidebarHeader className="h-14 border-b border-sidebar-border p-0 flex flex-col justify-center">
        <SidebarMenu>
          <SidebarMenuItem>
            {open ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground w-[95%] justify-between gap-2 px-2 m-2"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-foreground overflow-hidden">
                        {APP_CONFIG.IMAGES.AGENT_AVATAR_PLACEHOLDER ? (
                          <img
                            src={APP_CONFIG.IMAGES.AGENT_AVATAR_PLACEHOLDER}
                            alt="Agent"
                            className="size-full object-cover"
                          />
                        ) : (
                          <Bot className="size-4 text-primary" />
                        )}
                      </div>
                      <div className="grid flex-1 text-start text-xs leading-tight">
                        <span className="truncate font-semibold">
                          {currentAgent ? currentAgent.name : "دستیار هوشمند"}
                        </span>
                      </div>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-50" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                  align="start"
                  side="bottom"
                  sideOffset={4}
                   {...({ dir: "rtl" } as any)}
                >
                  <DropdownMenuLabel className="text-xs text-muted-foreground px-2 py-1">
                  </DropdownMenuLabel>
                  {allAgents.map((agent) => (
                    <DropdownMenuItem
                      key={agent.id}
                      onClick={() => handleSwitchAgent(agent.slug)}
                      className={cn(
                        "gap-2 p-2 cursor-pointer",
                        agent.ui_config?.featured && "bg-amber-50/70 dark:bg-amber-950/10"
                      )}
                    >
                      <div
                        className={cn(
                          "flex size-6 items-center justify-center rounded-sm border ",
                          agent.ui_config?.featured
                            ? "bg-amber-100 border-amber-300/60 dark:bg-amber-900/30 dark:border-amber-700/50"
                            : "",
                          agent.slug === agentId
                            ? "bg-primary/10 border-primary/20"
                            : "bg-background border-border"
                        )}
                      >
                        <Bot className="size-4 shrink-0 text-muted-foreground" />
                      </div>
                      <div className="flex min-w-0 flex-1 items-center gap-1.5">
                        <span className="truncate text-xs">{agent.name}</span>
                        {agent.ui_config?.featured && (
                          <span className="shrink-0 rounded-full border border-amber-300/60 bg-amber-100/80 px-1.5 py-0.5 text-[9px] text-amber-800 dark:border-amber-700/50 dark:bg-amber-900/30 dark:text-amber-300">
                            ویژه
                          </span>
                        )}
                      </div>
                      {agent.slug === agentId && (
                        <Check className="ml-auto size-4 opacity-70" />
                      )}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="gap-2 p-2 cursor-pointer" asChild>
                    <Link href="/dashboard">
                      <div className="flex size-6 items-center justify-center rounded-sm border bg-background border-border">
                        <MoreHorizontal className="size-4 shrink-0 text-muted-foreground" />
                      </div>
                      <span className="truncate text-sm">مشاهده همه</span>
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="w-full flex items-center justify-center">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary/10 text-primary-foreground overflow-hidden">
                    {APP_CONFIG.IMAGES.AGENT_AVATAR_PLACEHOLDER ? (
                      <img
                        src={APP_CONFIG.IMAGES.AGENT_AVATAR_PLACEHOLDER}
                        alt="Agent"
                        className="size-full object-cover"
                      />
                    ) : (
                      <Bot className="size-4 text-primary" />
                    )}
                  </div>
              </div>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <div className="p-2 pb-0">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={handleNewChat}
                className={cn(
                  "border border-sidebar-border shadow-sm hover:bg-sidebar-accent transition-all duration-200",
                  !open && "justify-center px-0"
                )}
                tooltip={!open ? APP_CONFIG.TEXT.NEW_THREAD_TITLE : undefined}
              >
                <Plus className="size-4" />
                {open && <span>{APP_CONFIG.TEXT.NEW_THREAD_TITLE}</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
            
            {/* Added: Back to Dashboard Button (Mobile Only) */}
            {isMobile && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  className={cn(
                    "border border-sidebar-border shadow-sm hover:bg-sidebar-accent transition-all duration-200 mt-2",
                    !open && "justify-center px-0"
                  )}
                >
                  <Link href="/dashboard">
                    <LayoutDashboard className="size-4" />
                    {open && <span>بازگشت به داشبورد</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}

          </SidebarMenu>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>تاریخچه</SidebarGroupLabel>
          <SidebarGroupContent>
            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : threads.length === 0 ? (
              <div className="px-4 py-4 text-xs text-muted-foreground text-center group-data-[collapsible=icon]:hidden">
                هنوز تاریخچه‌ای وجود ندارد.
              </div>
            ) : (
              <SidebarMenu>
                {threads.map((thread) => (
                  <SidebarMenuItem key={thread.threadId}>
                    <SidebarMenuButton
                      asChild
                      isActive={activeThreadId === thread.threadId}
                      className="group/item"
                      tooltip={!open ? thread.title : undefined}
                    >
                      <Link
                        href={`/chat/${agentId}/${thread.threadId}`}
                        onClick={() => setOpenMobile(false)}
                      >
                        <MessageSquare className="size-4 opacity-70 shrink-0" />
                        <span className="truncate group-data-[collapsible=icon]:hidden">
                          {thread.title}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <div
                              role="button"
                              className={cn(
                                "ms-auto p-1 hover:bg-muted rounded-sm transition-opacity group-data-[collapsible=icon]:hidden",
                                isPreviewMode
                                  ? "opacity-20 cursor-not-allowed"
                                  : "opacity-0 group-hover/item:opacity-100"
                              )}
                              onClick={(e) => {
                                if (isPreviewMode) {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  return
                                }
                                e.stopPropagation()
                              }}
                            >
                              <MoreHorizontal className="size-3" />
                            </div>
                          </DropdownMenuTrigger>

                          {!isPreviewMode && (
                            <DropdownMenuContent align="end" className="w-32">
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive text-xs"
                                onClick={(e) => handleDelete(e, thread.threadId)}
                              >
                                <Trash2 className="size-3 me-2" /> حذف
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          )}
                        </DropdownMenu>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  )
}
