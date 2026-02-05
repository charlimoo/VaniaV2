// start of frontend/app/(chat)/chat/[agentId]/[threadId]/page.tsx
"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { HttpAgent } from "@ag-ui/client";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useAgUiRuntime } from "@/lib/ag-ui/useAgUiRuntime"; // [FIX] Correct path
import { Loader2, Columns3, MessageSquare } from "lucide-react";
import { type ImperativePanelHandle } from "react-resizable-panels";

// ... (Imports remain same) ...
import { GlobalHeader } from "@/components/global-header";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { CanvasPanel } from "@/components/canvas/CanvasPanel";
import { CollapsedPanel } from "@/components/workspace/CollapsedPanel";
import { DebugInspector } from "@/components/debug-inspector";
import { AuthDialog } from "@/components/auth/auth-dialog";

import {
  ChartToolUI,
  DataTableToolUI,
  OptionListToolUI,
  MediaCardToolUI,
  DynamicFormToolUI,
  ProductCarouselToolUI
} from "@/components/assistant-ui/tool-registry";

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
import { useVaniaStore } from "@/lib/vania/store";
import { cn } from "@/lib/utils";
import { APP_CONFIG } from "@/lib/config";

export default function ChatPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isMobile = useIsMobile();
  const { loading: userLoading, refreshUser } = useUser();
  const { refreshThreads } = useChatLayout();
  
  const agentId = params.agentId as string;
  const threadId = params.threadId as string;

  // --- STORES & SETTINGS ---
  const { syncAgentDefaults, settingsByAgent } = useAgentSettings();
  const agentSettings = settingsByAgent[agentId] || { reasoningEffort: 'medium', isReasoningEnabled: true };
  
  const { isChatCollapsed, isCanvasCollapsed, toggleChat, toggleCanvas, resetLayout } = useWorkspaceStore();
  const clearCanvas = useCanvasStore((s) => s.clear);
  
  const { activePatientId, setActivePatient, reset: resetVania } = useVaniaStore();

  // --- LOCAL STATE ---
  const [threadTitle, setThreadTitle] = useState("گفتگوی جدید");
  const [service, setService] = useState<AgentService | null>(null);
  const [initLoading, setInitLoading] = useState(true);
  const [isCreatedOnBackend, setIsCreatedOnBackend] = useState(false);
  const [mobileView, setMobileView] = useState<'chat' | 'canvas'>('chat');

  // --- REFS ---
  const chatPanelRef = useRef<ImperativePanelHandle>(null);
  const canvasPanelRef = useRef<ImperativePanelHandle>(null);
  const touchStart = useRef<number | null>(null);
  const touchEnd = useRef<number | null>(null);

  const isDraft = threadId.startsWith("local-") && !isCreatedOnBackend;

  // ---------------------------------------------------------------------------
  // [FIX] Derive effective Patient ID (URL > Store)
  // ---------------------------------------------------------------------------
  const urlPatientId = searchParams.get('patientId');
  const effectivePatientId = urlPatientId ? parseInt(urlPatientId) : activePatientId;

  // ---------------------------------------------------------------------------
  // 1. Vania Patient Context Synchronization
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (urlPatientId) {
        const pid = parseInt(urlPatientId);
        if (!isNaN(pid) && pid !== activePatientId) {
            console.log(`[Page] Syncing Patient ID from URL: ${pid}`);
            setActivePatient(pid, "Loading...");
        }
    } else {
        if (threadId.startsWith('local-') && activePatientId !== null) {
            console.log("[Page] Clearing Patient Context (New Session)");
            resetVania();
        }
    }
  }, [urlPatientId, threadId, activePatientId, setActivePatient, resetVania]);

  // ---------------------------------------------------------------------------
  // 2. Auto-Open Canvas
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (effectivePatientId && !initLoading) {
      const { isCanvasCollapsed } = useWorkspaceStore.getState();
      if (isCanvasCollapsed) {
        toggleCanvas();
      }
    }
  }, [effectivePatientId, initLoading, toggleCanvas]);

  // ---------------------------------------------------------------------------
  // 3. Cleanup
  // ---------------------------------------------------------------------------
  useEffect(() => {
    clearCanvas();
    setIsCreatedOnBackend(false);
    setMobileView('chat');
    resetLayout();
    return () => { clearCanvas(); };
  }, [threadId, clearCanvas, resetLayout]);

  // ---------------------------------------------------------------------------
  // 4. Fetch Service
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (userLoading) return;
    const headers = getAuthHeaders();
    if (!headers.Authorization) { router.replace("/auth"); return; }
    
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
          }
        }
        if (!threadId.startsWith("local-")) setIsCreatedOnBackend(true);
      } catch (e) { 
        console.error("Initialization error", e); 
      } finally { 
        setInitLoading(false); 
      }
    };
    fetchData();
  }, [agentId, router, userLoading, threadId, syncAgentDefaults]);

  // ---------------------------------------------------------------------------
  // 5. Initialize Agent Client
  // ---------------------------------------------------------------------------
  const agent = useMemo(() => {
    const headers = getAuthHeaders();
    if (!headers.Authorization) return new HttpAgent({ url: "" });
    
    const extraHeaders: Record<string, string> = {
        "X-Reasoning-Effort": agentSettings.reasoningEffort, 
        "X-Enable-Reasoning": agentSettings.isReasoningEnabled ? "true" : "false",
    };
    
    // [FIX] Use effective ID
    if (effectivePatientId) {
        extraHeaders["X-Target-Patient-ID"] = effectivePatientId.toString();
    }

    return new HttpAgent({
      url: `${API_BASE_URL}/agent/agui?agent_id=${agentId}`,
      headers: { ...headers, ...extraHeaders } as Record<string, string>
    });
  }, [agentId, agentSettings, effectivePatientId]);

  // ---------------------------------------------------------------------------
  // 6. Runtime & History
  // ---------------------------------------------------------------------------
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

  const handleNewMessage = useCallback(async () => {
    const token = localStorage.getItem("accessToken");
    if (isDraft && token) {
        await threadManager.createThreadOnBackend(
            threadId, 
            APP_CONFIG.TEXT.NEW_THREAD_TITLE, 
            agentId, 
            token, 
            effectivePatientId // [FIX] Use effective ID
        );
        setIsCreatedOnBackend(true);
        refreshThreads();
    }
  }, [isDraft, threadId, agentId, refreshThreads, effectivePatientId]);

  const runtime = useAgUiRuntime({
    agent, 
    threadId, 
    agentId, 
    onNewMessageWrapper: handleNewMessage,
    adapters: { history: historyAdapter, attachments: simpleAttachmentAdapter },
    onError: (err) => console.error("Runtime Error:", err)
  });

  // ---------------------------------------------------------------------------
  // 7. Sync Hooks (Canvas)
  // ---------------------------------------------------------------------------
  useCanvasSync({ 
    agent, 
    threadId, 
    agentId, 
    token: typeof window !== "undefined" ? localStorage.getItem("accessToken") : null,
    isDraft, 
    onRename: (title) => { setThreadTitle(title); refreshThreads(); },
    patientId: effectivePatientId // [FIX] Pass effective ID
  });

  // ---------------------------------------------------------------------------
  // 8. Mobile & Capabilities
  // ---------------------------------------------------------------------------
  const handleMobileToggle = () => setMobileView(prev => prev === 'chat' ? 'canvas' : 'chat');
  
  const onTouchStart = (e: React.TouchEvent) => { touchEnd.current = null; touchStart.current = e.targetTouches[0].clientX; };
  const onTouchMove = (e: React.TouchEvent) => { touchEnd.current = e.targetTouches[0].clientX; };
  const onTouchEnd = () => {
    if (!touchStart.current || !touchEnd.current) return;
    const distance = touchStart.current - touchEnd.current;
    if (distance > 50 && mobileView === 'chat') setMobileView('canvas');
    if (distance < -50 && mobileView === 'canvas') setMobileView('chat');
  };

  const hasCanvasCapability = useMemo(() => {
    if (!service) return false;
    const caps = service.capabilities || [];
    return caps.some(c => ["shop","trade","analysis","vania_doctor","vania_patient"].includes(c));
  }, [service]);

  if (userLoading || initLoading || !service) {
    return (
        <div className="h-full flex items-center justify-center text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" /> {APP_CONFIG.TEXT.LOADING_INIT}
        </div>
    );
  }

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AuthDialog />
      <ChartToolUI />
      <DataTableToolUI />
      <OptionListToolUI />
      <MediaCardToolUI />
      <ProductCarouselToolUI />
      <DynamicFormToolUI />

      <div key={threadId} className="flex flex-col h-full w-full bg-background overflow-hidden">
        <GlobalHeader variant="chat" title={threadTitle}>
          <DebugInspector service={service} />
          {isMobile && hasCanvasCapability && (
            <Button 
                variant={mobileView === 'canvas' ? "secondary" : "ghost"} 
                size="icon" 
                onClick={handleMobileToggle} 
                className={mobileView === 'canvas' ? "bg-muted" : ""}
            >
                {mobileView === 'chat' ? <Columns3 className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
            </Button>
          )}
        </GlobalHeader>

        <div className="flex-1 overflow-hidden relative flex flex-col">
          {isMobile ? (
            <div 
                className="relative w-full h-full overflow-hidden"
                onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
            >
                <div className={cn("flex w-[200%] h-full transition-transform duration-300 ease-in-out will-change-transform", mobileView === 'canvas' ? "translate-x-1/2" : "translate-x-0")}>
                    <div className="w-1/2 h-full overflow-hidden">
                        <ChatPanel 
                            service={service} 
                            threadId={threadId}
                            isCollapsed={false} 
                            onCollapse={() => {}} 
                            onExpand={() => {}} 
                            allowCollapse={false} 
                            capabilities={service.capabilities || []}
                        />
                    </div>
                    <div className="w-1/2 h-full overflow-hidden border-l">
                        {hasCanvasCapability ? <CanvasPanel onCollapse={handleMobileToggle} /> : <div className="flex items-center justify-center h-full text-muted-foreground">ابزار بصری در دسترس نیست</div>}
                    </div>
                </div>
            </div>
          ) : (
            <>
              {hasCanvasCapability ? (
                <ResizablePanelGroup direction="horizontal" className="h-full" autoSaveId="chat-layout-v3">
                  <ResizablePanel ref={chatPanelRef} id="chat-panel" order={1} defaultSize={35} minSize={25} collapsible={true} collapsedSize={4} className="transition-all duration-500 ease-in-out h-full">
                    <ChatPanel 
                        service={service} 
                        threadId={threadId}
                        isCollapsed={isChatCollapsed} 
                        onCollapse={toggleChat} 
                        onExpand={toggleChat} 
                        allowCollapse={true}
                        capabilities={service.capabilities || []}
                    />
                  </ResizablePanel>
                  <ResizableHandle withHandle className="bg-border/50 hover:bg-primary/50 w-1" />
                  <ResizablePanel ref={canvasPanelRef} id="canvas-panel" order={2} defaultSize={65} minSize={25} collapsible={true} collapsedSize={4} className="transition-all duration-500 ease-in-out h-full">
                    {isCanvasCollapsed ? <CollapsedPanel side="left" title="بوم کار" onExpand={toggleCanvas} /> : <CanvasPanel onCollapse={toggleCanvas} />}
                  </ResizablePanel>
                </ResizablePanelGroup>
              ) : (
                <div className="h-full w-full flex justify-center bg-background">
                   <div className="w-full max-w-4xl border-x border-border/50 h-full shadow-sm">
                     <ChatPanel 
                        service={service} 
                        threadId={threadId}
                        onCollapse={() => {}} 
                        isCollapsed={false} 
                        onExpand={() => {}} 
                        allowCollapse={false}
                        capabilities={service.capabilities || []}
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
// end of frontend/app/(chat)/chat/[agentId]/[threadId]/page.tsx