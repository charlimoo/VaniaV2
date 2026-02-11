// frontend/app/(chat)/chat/[agentId]/[threadId]/page.tsx
"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation"; // [FIX] Added useSearchParams
import Link from "next/link";
import { HttpAgent } from "@ag-ui/client";
import { AssistantRuntimeProvider, type AppendMessage } from "@assistant-ui/react";
import { useAgUiRuntime } from "@/lib/ag-ui/useAgUiRuntime";
import { Loader2, Columns3, MessageSquare, Lock } from "lucide-react";
import { type ImperativePanelHandle } from "react-resizable-panels";
import { useVaniaStore } from "@/lib/vania/store";
// --- UI Components ---
import { GlobalHeader } from "@/components/global-header";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { CanvasPanel } from "@/components/canvas/CanvasPanel";
import { CollapsedPanel } from "@/components/workspace/CollapsedPanel";
import { DebugInspector } from "@/components/debug-inspector";
import { AuthDialog } from "@/components/auth/auth-dialog";

// --- Global Tools ---
import {
  ChartToolUI,
  DataTableToolUI,
  OptionListToolUI,
  MediaCardToolUI,
  ProductCarouselToolUI,
  DynamicFormToolUI
} from "@/components/assistant-ui/tool-registry";

// --- State & Logic ---
import { AgentService } from "@/lib/types";
import { useCanvasStore } from "@/lib/canvas/store";
import { useWorkspaceStore } from "@/lib/workspace-store";
import { useCanvasSync } from "@/lib/canvas/useCanvasSync";
import { threadManager, simpleAttachmentAdapter } from "@/lib/SimpleThreadAdapters";
import { useUser } from "@/hooks/use-user";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { useChatLayout } from "@/components/chat/chat-layout-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAgentSettings } from "@/lib/agent-settings-store";
import { useTradeStore } from "@/lib/vania/tstore";
import { cn } from "@/lib/utils";
import { APP_CONFIG } from "@/lib/config";

export default function ChatPage() {
  const params = useParams();
  const searchParams = useSearchParams(); // [FIX] Initialize hook
  const router = useRouter();
  const isMobile = useIsMobile();
  const { loading: userLoading, refreshUser } = useUser();
  const { refreshThreads } = useChatLayout();
  
  const agentId = params.agentId as string;
  const threadId = params.threadId as string;
  
  // [FIX] Extract patientId from URL query
  const patientIdParam = searchParams.get('patientId');
  const patientId = patientIdParam ? parseInt(patientIdParam) : null;

  const { setActivePatient } = useVaniaStore();

  // --- STORES & SETTINGS ---
  const { syncAgentDefaults, settingsByAgent } = useAgentSettings();
  const agentSettings = settingsByAgent[agentId] || { reasoningEffort: 'medium', isReasoningEnabled: true };
  
  const { isChatCollapsed, isCanvasCollapsed, toggleChat, toggleCanvas } = useWorkspaceStore();
  
  const clearCanvas = useCanvasStore((s) => s.clear);
  const resetTradeFilters = useTradeStore((s) => s.resetFilters);

  // --- LOCAL STATE ---
  const [threadTitle, setThreadTitle] = useState(APP_CONFIG.TEXT.NEW_THREAD_TITLE);
  const [service, setService] = useState<AgentService | null>(null);
  const [initLoading, setInitLoading] = useState(true);
  const [isCreatedOnBackend, setIsCreatedOnBackend] = useState(false);
  const [mobileView, setMobileView] = useState<'chat' | 'canvas'>('chat');
  
  // State for dynamic logic
  const [accessDenied, setAccessDenied] = useState<string | null>(null);
  const [sessionUsageDelta, setSessionUsageDelta] = useState(0);

  // --- REFS (Version 2 Logic) ---
  const chatPanelRef = useRef<ImperativePanelHandle>(null);
  const canvasPanelRef = useRef<ImperativePanelHandle>(null);
  const isPollingTitle = useRef(false);
  const isLayoutTransitioning = useRef(false);

  const isDraft = threadId.startsWith("local-") && !isCreatedOnBackend;

  // [FIX] 3. Restore Context from History
  // If we open a saved thread (not local) AND there is no patientId in the URL,
  // we check the backend to see if this thread belongs to a patient.
  useEffect(() => {
    if (threadId.startsWith("local-") || patientId) return;

    const restoreContext = async () => {
        try {
            const token = localStorage.getItem("accessToken");
            if (!token) return;

            const res = await fetch(`${API_BASE_URL}/agent/sessions/${threadId}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                
                // Inspect session_state (saved by threadManager.createThreadOnBackend)
                // OR check the raw chat history for context markers if needed.
                // Assuming backend stores it in session_data or session_state map.
                // Note: The /sessions/{id} endpoint returns { chat_history, session_name }
                // We might need to inspect the 'session_data' if your backend endpoint exposes it.
                // If it doesn't, we can infer it from the first few messages or add it to the endpoint.
                
                // *Assumption*: Backend 'get_session_history' serializer (routes.py) 
                // currently returns { chat_history, session_name }.
                // To fix this robustly, ensure backend returns `session_data` or `patient_id`.
                //
                // For now, let's assume we can fetch the full object via a direct call if needed, 
                // OR we rely on the `useCanvasSync` hydration which loads the canvas.
                
                // BETTER APPROACH:
                // Actually, the `useCanvasSync` hook calls `/agent/canvas/state/...`. 
                // If that returns patient data, we know which patient it is.
                // But `useCanvasSync` is reactive. 
                // Let's force a metadata check here using the raw storage API if available, 
                // or just rely on the fact that if we load a thread, we should try to set the URL.
                
                // Let's check `session_data` which contains `patient_id`
                // *Requires backend update to return session_data in GET /sessions/{id}*
                // If backend update isn't possible right now, we can check the canvas state:
                
                const canvasRes = await fetch(`${API_BASE_URL}/agent/canvas/state/${threadId}`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                
                if (canvasRes.ok) {
                    const canvasData = await canvasRes.json();
                    const pmCanvas = canvasData.canvases?.find((c: any) => c.component_key === "VANIA_PATIENT_MANAGER");
                    
                    if (pmCanvas && pmCanvas.current_state?.patient_profile?.id) {
                        const pid = pmCanvas.current_state.patient_profile.id;
                        const pname = pmCanvas.current_state.patient_profile.name;
                        
                        console.log(`[Restore] Found Patient ${pid} in canvas state. Restoring URL.`);
                        setActivePatient(pid, pname);
                        router.replace(`/chat/${agentId}/${threadId}?patientId=${pid}`);
                    }
                }
            }
        } catch (e) {
            console.error("Failed to restore patient context", e);
        }
    };

    restoreContext();
  }, [threadId, patientId, agentId, router, setActivePatient]);

  // 1. Reset State on Thread Change
  useEffect(() => {
    clearCanvas();
    setIsCreatedOnBackend(false);
    setMobileView('chat'); 
    resetTradeFilters();
    setAccessDenied(null);
    setSessionUsageDelta(0);
    return () => { clearCanvas(); };
  }, [threadId, clearCanvas, resetTradeFilters]);

  // 2. Fetch Service Metadata & Check Access
  useEffect(() => {
    if (userLoading) return;

    const headers = getAuthHeaders();
    if (!headers.Authorization) {
      router.replace("/auth");
      return;
    }

    const fetchData = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/services/`, { headers });
        if (res.ok) {
          const services: AgentService[] = await res.json();
          const current = services.find((s) => s.slug === agentId);

          if (current) {
            setService(current);
            syncAgentDefaults(agentId, {
              enable_reasoning: current.enable_reasoning,
              reasoning_effort: current.reasoning_effort,
            });

            const isOwned = current.access_status === 'OWNED' || current.access_status === 'FREE';
            if (!isOwned && current.demo_config?.access_mode === 'BLOCKED') {
              setAccessDenied("دسترسی به نسخه دمو برای این دستیار محدود شده است.");
              setInitLoading(false);
              return; 
            }
          }
        }
        if (!threadId.startsWith("local-")) {
           setIsCreatedOnBackend(true);
        }
      } catch (e) {
        console.error("Initialization error", e);
      } finally {
        setInitLoading(false);
      }
    };

    fetchData();
  }, [agentId, router, userLoading, threadId, syncAgentDefaults]);

  // 3. Layout Synchronization Effect
  useEffect(() => {
    const chatPanel = chatPanelRef.current;
    const canvasPanel = canvasPanelRef.current;
    
    if (!chatPanel || !canvasPanel) return;

    const t1 = setTimeout(() => {
        isLayoutTransitioning.current = true;

        if (isChatCollapsed) {
          chatPanel.collapse(); 
          canvasPanel.expand(); 
        } else if (isCanvasCollapsed) {
          canvasPanel.collapse();
          chatPanel.expand();
        } else {
          const defaultWidth = service?.ui_config?.default_width || 65;
          chatPanel.resize(100 - defaultWidth);
          canvasPanel.resize(defaultWidth);
        }

        const t2 = setTimeout(() => {
            isLayoutTransitioning.current = false;
        }, 550);
        
        return () => clearTimeout(t2);
    }, 10);

    return () => clearTimeout(t1);
  }, [isChatCollapsed, isCanvasCollapsed, service]);

  // 4. Access Control Logic
  const isOwned = service?.is_owned || service?.is_free;
  const isPreviewMode = !!service && !isOwned;

  // 5. Runtime Agent Setup
  const agent = useMemo(() => {
    const headers = getAuthHeaders();
    if (!headers.Authorization) return new HttpAgent({ url: "" });
    
    const extraHeaders: Record<string, string> = {
        "X-Reasoning-Effort": isPreviewMode ? "none" : agentSettings.reasoningEffort, 
        "X-Enable-Reasoning": isPreviewMode ? "false" : (agentSettings.isReasoningEnabled ? "true" : "false")
    };

    // [FIX] Inject Patient ID into headers if present
    if (patientId) {
        extraHeaders["X-Target-Resource-ID"] = patientId.toString();
    }

    return new HttpAgent({
      url: `${API_BASE_URL}/agent/agui?agent_id=${agentId}`,
      headers: { ...headers, ...extraHeaders } as Record<string, string>
    });
  }, [agentId, agentSettings, isPreviewMode, patientId]); // Add patientId dependency

  // 6. Subscription & Smart Title Polling
  useEffect(() => {
    if (!agent) return;

    const subscription = agent.subscribe({
      onRunFinishedEvent: () => {
        setTimeout(() => refreshUser(), 1000);
        
        if (isPreviewMode) {
          setSessionUsageDelta(prev => prev + 1);
        }

        const defaultTitle = APP_CONFIG.TEXT.NEW_THREAD_TITLE;
        if (threadTitle === defaultTitle && !isPollingTitle.current) {
            isPollingTitle.current = true;
            const pollAttempts = 5;
            let attempt = 0;

            const checkTitle = async () => {
                if (attempt >= pollAttempts) {
                    isPollingTitle.current = false;
                    return;
                }
                try {
                    const token = localStorage.getItem("accessToken");
                    if (!token) return;
                    const { title } = await threadManager.getThreadMetadata(threadId, token);
                    
                    if (title && title !== defaultTitle && title !== "New Conversation" && title !== "Untitled") {
                        setThreadTitle(title);
                        refreshThreads();
                        isPollingTitle.current = false;
                    } else {
                        attempt++;
                        setTimeout(checkTitle, 2000);
                    }
                } catch (e) {
                    console.warn("Title poll failed", e);
                    isPollingTitle.current = false;
                }
            };
            setTimeout(checkTitle, 1000);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [agent, refreshUser, threadTitle, threadId, refreshThreads, isPreviewMode]);

  // 7. Adapters
  const historyAdapter = useMemo(() => ({
    load: async (id: string) => {
      const token = localStorage.getItem("accessToken");
      if (!token) return { messages: [] };
      const { messages, title } = await threadManager.getMessages(id, token);
      if (title) setThreadTitle(title);
      return { messages };
    },
    append: async () => {} 
  }), []);

  const handleNewMessage = useCallback(async (message: AppendMessage) => {
    const token = localStorage.getItem("accessToken");
    
    let tempTitle = APP_CONFIG.TEXT.NEW_THREAD_TITLE;
    try {
        let userText = "";
        if (typeof message.content === 'string') userText = message.content;
        else if (Array.isArray(message.content)) {
            const textPart = message.content.find((p: any) => p.type === 'text');
            if (textPart && 'text' in textPart) userText = textPart.text;
        }

        if (userText?.trim()) {
            const clean = userText.trim();
            tempTitle = clean.length > 30 ? clean.substring(0, 30) + "..." : clean;
        }
    } catch (e) { /* ignore */ }

    if (threadId.startsWith("local-") && token) {
        // [FIX] Pass patientId when creating the thread on backend
        await threadManager.createThreadOnBackend(threadId, tempTitle, agentId, token, patientId);
        setIsCreatedOnBackend(true);
        setThreadTitle(tempTitle);
        refreshThreads();
    }
  }, [threadId, agentId, refreshThreads, patientId]); // Add patientId dependency

  const runtime = useAgUiRuntime({
    agent,
    threadId,
    agentId,
    onNewMessageWrapper: handleNewMessage,
    adapters: { history: historyAdapter, attachments: simpleAttachmentAdapter },
    onError: (err) => console.error("Runtime Error:", err)
  });

  // 8. Canvas Sync Hook
  useCanvasSync({ 
    agent, 
    threadId, 
    agentId, 
    token: typeof window !== "undefined" ? localStorage.getItem("accessToken") : null,
    isDraft,
    onRename: (title) => { setThreadTitle(title); refreshThreads(); },
    patientId: patientId // [FIX] Pass patientId to hydration hook
  });

  // 9. Mobile Gestures
  const handleMobileToggle = () => setMobileView(prev => prev === 'chat' ? 'canvas' : 'chat');
  const touchStart = useRef<number | null>(null);
  const touchEnd = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => { touchEnd.current = null; touchStart.current = e.targetTouches[0].clientX; };
  const onTouchMove = (e: React.TouchEvent) => { touchEnd.current = e.targetTouches[0].clientX; };
  const onTouchEnd = () => {
    if (!touchStart.current || !touchEnd.current) return;
    const distance = touchStart.current - touchEnd.current;
    if (distance > 50 && mobileView === 'chat') setMobileView('canvas');
    if (distance < -50 && mobileView === 'canvas') setMobileView('chat');
  };

  // 10. Dynamic UI Config
  const uiConfig = service?.ui_config || { 
    has_canvas: false, 
    default_width: 65, 
    show_voice_input: true 
  };
  
  let hasCanvasCapability = uiConfig.has_canvas;
  if (isPreviewMode && service?.demo_config?.canvas_mode === 'HIDDEN') {
      hasCanvasCapability = false;
  }

  const realtimeUsage = (service?.current_usage || 0) + sessionUsageDelta;

  // --- RENDER ---
  if (userLoading || initLoading || !service) {
      return (
        <div className="h-full flex items-center justify-center text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> {APP_CONFIG.TEXT.LOADING_INIT}
        </div>
      );
  }

  if (accessDenied) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-6 bg-background text-center animate-in fade-in">
        <div className="max-w-md space-y-4">
          <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">دسترسی محدود</h1>
          <p className="text-muted-foreground">{accessDenied}</p>
          <div className="pt-4 flex flex-col sm:flex-row gap-3 w-full">
            <Button size="lg" className="flex-1" asChild>
              <Link href="/dashboard/billing">خرید اشتراک</Link>
            </Button>
            <Button variant="outline" size="lg" className="flex-1" onClick={() => router.push('/dashboard')}>
              بازگشت به پیشخوان
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AuthDialog />
      <ChartToolUI /><DataTableToolUI /><OptionListToolUI /><MediaCardToolUI /><ProductCarouselToolUI /><DynamicFormToolUI />

      <div key={threadId} className="flex flex-col h-full w-full bg-background overflow-hidden">
        
        <GlobalHeader variant="chat" title={threadTitle}>
          <DebugInspector service={service} />
          {isMobile && hasCanvasCapability && (
            <Button
                variant={mobileView === 'canvas' ? "secondary" : "ghost"}
                onClick={handleMobileToggle}
                className={mobileView === 'canvas' ? "bg-muted" : ""}
            >
                {mobileView === 'chat' ? <Columns3 className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                {mobileView === 'chat' ? "دشبورد" : "چت"}
            </Button>
          )}
        </GlobalHeader>

        <div className="flex-1 overflow-hidden relative flex flex-col">
          {isMobile ? (
            <div 
                className="relative w-full h-full overflow-hidden"
                onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
            >
                <div 
                    className={cn(
                        "flex w-[200%] h-full transition-transform duration-300 ease-in-out will-change-transform",
                        mobileView === 'canvas' ? "translate-x-1/2" : "translate-x-0"
                    )}
                >
                    <div className="w-1/2 h-full overflow-hidden">
                        <ChatPanel 
                            service={service}
                            threadId={threadId}
                            isCollapsed={false}
                            onCollapse={() => {}} onExpand={() => {}}
                            allowCollapse={false}
                            isPreviewMode={isPreviewMode}
                            currentUsage={realtimeUsage}
                        />
                    </div>
                    <div className="w-1/2 h-full overflow-hidden border-l">
                        {hasCanvasCapability ? (
                            <CanvasPanel 
                                onCollapse={handleMobileToggle} 
                                isPreviewMode={isPreviewMode}
                                demoConfig={service.demo_config}
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                                ابزار بصری در دسترس نیست
                            </div>
                        )}
                    </div>
                </div>
            </div>
          ) : (
            <>
              {hasCanvasCapability ? (
                <ResizablePanelGroup direction="horizontal" className="h-full">
                  <ResizablePanel 
                    ref={chatPanelRef}
                    id="chat-panel" 
                    order={1} 
                    defaultSize={100 - uiConfig.default_width}
                    minSize={25}
                    collapsible={true}
                    collapsedSize={4}
                    onCollapse={() => { if (!isLayoutTransitioning.current && !isChatCollapsed) toggleChat(); }}
                    onExpand={() => { if (!isLayoutTransitioning.current && isChatCollapsed) toggleChat(); }}
                    className="transition-all duration-500 ease-in-out h-full"
                  >
                    <ChatPanel 
                      service={service} 
                      threadId={threadId}
                      isCollapsed={isChatCollapsed}
                      onCollapse={toggleChat}
                      onExpand={toggleChat}
                      allowCollapse={true} 
                      isPreviewMode={isPreviewMode}
                      currentUsage={realtimeUsage}
                    />
                  </ResizablePanel>

                  <ResizableHandle withHandle className="bg-border/50 hover:bg-primary/50 w-1" />

                  <ResizablePanel 
                    ref={canvasPanelRef}
                    id="canvas-panel" 
                    order={2} 
                    defaultSize={uiConfig.default_width}
                    minSize={25}
                    collapsible={true}
                    collapsedSize={4}
                    onCollapse={() => { if (!isLayoutTransitioning.current && !isCanvasCollapsed) toggleCanvas(); }}
                    onExpand={() => { if (!isLayoutTransitioning.current && isCanvasCollapsed) toggleCanvas(); }}
                    className="transition-all duration-500 ease-in-out h-full"
                  >
                    {isCanvasCollapsed ? (
                      <CollapsedPanel side="left" title="بوم کار" onExpand={toggleCanvas} />
                    ) : (
                      <CanvasPanel 
                        onCollapse={toggleCanvas} 
                        isPreviewMode={isPreviewMode}
                        demoConfig={service.demo_config}
                      />
                    )}
                  </ResizablePanel>
                </ResizablePanelGroup>
              ) : (
                <div className="h-full w-full flex justify-center bg-background">
                   <div className="w-full border-x border-border/50 h-full shadow-sm max-w-5xl">
                       <ChatPanel 
                          service={service} 
                          threadId={threadId}
                          onCollapse={() => {}} 
                          isCollapsed={false}
                          onExpand={() => {}}
                          allowCollapse={false} 
                          isPreviewMode={isPreviewMode}
                          currentUsage={realtimeUsage}
                       />
                   </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AssistantRuntimeProvider>
  );
}