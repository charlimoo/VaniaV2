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
import { createSimpleAttachmentAdapter, threadManager } from "@/lib/SimpleThreadAdapters";
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
  
  // Resolve canonical + legacy query params.
  const patientIdParam = searchParams.get('visitorId') || searchParams.get('patientId');
  const patientId = patientIdParam ? parseInt(patientIdParam) : null;
  const doctorIdParam = searchParams.get('expertId') || searchParams.get('doctorId');
  const doctorId = doctorIdParam ? parseInt(doctorIdParam) : null;
  const caseId = searchParams.get('caseId');

  const { setActivePatient } = useVaniaStore();

  // --- STORES & SETTINGS ---
  const { syncAgentDefaults, settingsByAgent } = useAgentSettings();
  const agentSettings = settingsByAgent[agentId] || { reasoningEffort: 'medium', isReasoningEnabled: true };
  
  const { isChatCollapsed, isCanvasCollapsed, toggleChat, toggleCanvas } = useWorkspaceStore();
  
  const clearCanvas = useCanvasStore((s) => s.clear);
  const canvasInstances = useCanvasStore((s) => s.instances);
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
  const restoredContextRef = useRef<string | null>(null);

  const isDraft = threadId.startsWith("local-") && !isCreatedOnBackend;

  const getDoctorLocalKey = (pid: number) => `vania:last_selected_doctor_by_patient:${pid}`;
  const getExpertLocalKey = (pid: number) => `vania:last_selected_expert_by_visitor:${pid}`;

  // [FIX] 3. Restore Context from History
  // If we open a saved thread (not local) AND there is no patientId in the URL,
  // we check the backend to see if this thread belongs to a patient.
  useEffect(() => {
    if (threadId.startsWith("local-")) return;

    const restoreKey = [
      threadId,
      patientId || "",
      doctorId || "",
      caseId || "",
    ].join(":");

    if (restoredContextRef.current === restoreKey) return;
    if (patientId && doctorId) {
      restoredContextRef.current = restoreKey;
      return;
    }

    const restoreContext = async () => {
        try {
            restoredContextRef.current = restoreKey;
            const token = localStorage.getItem("accessToken");
            if (!token) return;

            const res = await fetch(`${API_BASE_URL}/agent/sessions/${threadId}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                
                const sessionState = data.session_state || {};
                let resolvedPatientId = patientId || sessionState.visitor_id || sessionState.patient_id || null;
                let resolvedDoctorId = doctorId || sessionState.selected_expert_id || sessionState.selected_doctor_id || null;
                let resolvedCaseId = caseId || sessionState.selected_case_id || null;
                if (!resolvedDoctorId && resolvedPatientId) {
                  const localExpert = localStorage.getItem(getExpertLocalKey(Number(resolvedPatientId)));
                  const localDoctor = localStorage.getItem(getDoctorLocalKey(Number(resolvedPatientId)));
                  if (localExpert) resolvedDoctorId = Number(localExpert);
                  else if (localDoctor) resolvedDoctorId = Number(localDoctor);
                }
                
                const canvasRes = await fetch(`${API_BASE_URL}/agent/canvas/state/${threadId}`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                
                if (canvasRes.ok) {
                    const canvasData = await canvasRes.json();
                    const pmCanvas = canvasData.canvases?.find((c: any) => c.component_key === "VANIA_PATIENT_MANAGER");
                    
                    if (!resolvedPatientId && pmCanvas && pmCanvas.current_state?.patient_profile?.id) {
                        resolvedPatientId = pmCanvas.current_state.patient_profile.id;
                        const pname = pmCanvas.current_state.patient_profile.name;
                        setActivePatient(resolvedPatientId, pname);
                    }
                    const query = new URLSearchParams();
                    if (resolvedPatientId) query.set("visitorId", String(resolvedPatientId));
                    if (resolvedDoctorId) query.set("expertId", String(resolvedDoctorId));
                    if (resolvedCaseId) query.set("caseId", String(resolvedCaseId));
                    if (query.toString()) {
                      const targetUrl = `/chat/${agentId}/${threadId}?${query.toString()}`;
                      const currentUrl = `/chat/${agentId}/${threadId}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
                      if (targetUrl !== currentUrl) {
                        router.replace(targetUrl);
                      }
                    }
                }
            }
        } catch (e) {
            console.error("Failed to restore patient context", e);
        }
    };

    restoreContext();
  }, [threadId, patientId, doctorId, caseId, agentId, router, setActivePatient, searchParams]);

  useEffect(() => {
    if (!threadId.startsWith("local-")) return;
    if (!patientId || doctorId) return;
    const localDoctor = localStorage.getItem(getExpertLocalKey(patientId)) || localStorage.getItem(getDoctorLocalKey(patientId));
    if (!localDoctor) return;
    router.replace(`/chat/${agentId}/${threadId}?visitorId=${patientId}&expertId=${localDoctor}`);
  }, [threadId, patientId, doctorId, agentId, router]);

  useEffect(() => {
    if (!patientId || !doctorId) return;
    localStorage.setItem(getDoctorLocalKey(patientId), String(doctorId));
    localStorage.setItem(getExpertLocalKey(patientId), String(doctorId));
  }, [patientId, doctorId]);

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
    if (doctorId) {
        extraHeaders["X-Target-Expert-ID"] = doctorId.toString();
        extraHeaders["X-Target-Doctor-ID"] = doctorId.toString();
    }
    if (caseId) {
        extraHeaders["X-Target-Case-ID"] = caseId;
    }

    return new HttpAgent({
      url: `${API_BASE_URL}/agent/agui?agent_id=${agentId}`,
      headers: { ...headers, ...extraHeaders } as Record<string, string>
    });
  }, [agentId, agentSettings, isPreviewMode, patientId, doctorId, caseId]); // Add patientId dependency

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
        await threadManager.createThreadOnBackend(threadId, tempTitle, agentId, token, patientId, doctorId);
        setIsCreatedOnBackend(true);
        setThreadTitle(tempTitle);
        refreshThreads();
    }
  }, [threadId, agentId, refreshThreads, patientId, doctorId]); // Add patientId dependency

  const ensureThread = useCallback(async () => {
    const token = localStorage.getItem("accessToken");
    if (!threadId.startsWith("local-") || !token || isCreatedOnBackend) return;
    await threadManager.createThreadOnBackend(threadId, threadTitle, agentId, token, patientId, doctorId);
    setIsCreatedOnBackend(true);
    refreshThreads();
  }, [agentId, doctorId, isCreatedOnBackend, patientId, refreshThreads, threadId, threadTitle]);

  const attachmentsAdapter = useMemo(
    () =>
      createSimpleAttachmentAdapter({
        threadId,
        agentId,
        ensureThread,
      }),
    [threadId, agentId, ensureThread],
  );

  const runtime = useAgUiRuntime({
    agent,
    threadId,
    agentId,
    onNewMessageWrapper: handleNewMessage,
    adapters: { history: historyAdapter, attachments: attachmentsAdapter },
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
    patientId: patientId, // [FIX] Pass patientId to hydration hook
    doctorId: doctorId
    ,caseId
  });

  useEffect(() => {
    if (threadId.startsWith("local-")) return;
    const headers = getAuthHeaders();
    if (!headers.Authorization) return;
    const session_state: Record<string, any> = {};
    if (patientId) {
      session_state.visitor_id = patientId;
      session_state.patient_id = patientId;
    }
    if (doctorId) {
      session_state.selected_expert_id = doctorId;
      session_state.selected_doctor_id = doctorId;
    }
    if (caseId) {
      session_state.selected_case_id = caseId;
    }
    if (Object.keys(session_state).length === 0) return;
    fetch(`${API_BASE_URL}/agent/sessions/${threadId}`, {
      method: "PATCH",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ session_state }),
    }).catch(() => {});
  }, [threadId, patientId, doctorId, caseId]);

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
  
  const hasVisibleCanvas = useMemo(
    () => Object.values(canvasInstances).some((canvas) => canvas.is_visible),
    [canvasInstances]
  );
  const hasSupportedCanvas = (service?.supported_canvases?.length || 0) > 0;

  let hasCanvasCapability = uiConfig.has_canvas && hasSupportedCanvas;
  if (isPreviewMode && service?.demo_config?.canvas_mode === 'HIDDEN') {
      hasCanvasCapability = false;
  }
  const showCanvasSection = hasCanvasCapability && hasVisibleCanvas;

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

      <div key={threadId} className="flex min-w-0 flex-col h-full w-full bg-background overflow-hidden">
        
        <GlobalHeader variant="chat" title={threadTitle}>
          <DebugInspector service={service} />
          {isMobile && showCanvasSection && (
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

        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {isMobile ? (
            <>
              {showCanvasSection ? (
                <div 
                    className="relative h-full w-full overflow-hidden"
                    onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
                >
                    <div 
                        className={cn(
                            "flex h-full w-[200%] min-w-0 overflow-hidden transition-transform duration-300 ease-in-out will-change-transform",
                            mobileView === 'canvas' ? "translate-x-1/2" : "translate-x-0"
                        )}
                    >
                        <div className="h-full w-1/2 min-w-0 overflow-hidden">
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
                        <div className="h-full w-1/2 min-w-0 overflow-hidden border-l">
                            <CanvasPanel 
                                onCollapse={handleMobileToggle} 
                                isPreviewMode={isPreviewMode}
                                demoConfig={service.demo_config}
                            />
                        </div>
                    </div>
                </div>
              ) : (
                <div className="h-full w-full">
                  <ChatPanel 
                    service={service}
                    threadId={threadId}
                    isCollapsed={false}
                    onCollapse={() => {}} 
                    onExpand={() => {}}
                    allowCollapse={false}
                    isPreviewMode={isPreviewMode}
                    currentUsage={realtimeUsage}
                  />
                </div>
              )}
            </>
          ) : (
            <>
              {showCanvasSection ? (
                <ResizablePanelGroup direction="horizontal" className="h-full min-w-0">
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
                    className="h-full min-w-0 transition-all duration-500 ease-in-out"
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
                    className="h-full min-w-0 transition-all duration-500 ease-in-out"
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
                <div className="h-full w-full bg-background">
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
              )}
            </>
          )}
        </div>
      </div>
    </AssistantRuntimeProvider>
  );
}
