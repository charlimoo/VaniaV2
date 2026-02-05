// start of frontend/lib/canvas/useCanvasSync.ts
import { useEffect, useRef } from "react";
import { HttpAgent } from "@ag-ui/client";
import { useCanvasStore } from "@/lib/canvas/store";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";

interface UseCanvasSyncProps {
  agent: HttpAgent | null;
  threadId: string;
  agentId?: string; 
  token: string | null;
  onRename?: (title: string) => void;
  isDraft?: boolean;
  patientId?: number | null;
}

export function useCanvasSync({ 
  agent, 
  threadId, 
  agentId, 
  token, 
  onRename, 
  isDraft = false,
  patientId 
}: UseCanvasSyncProps) {
  
  const setInstances = useCanvasStore((s) => s.setInstances);
  const updateCanvas = useCanvasStore((s) => s.updateCanvas);
  const setLocked = useCanvasStore((s) => s.setLocked);
  
  const hydratedRef = useRef<string | null>(null);

  const hydrate = async () => {
    // [DEBUG] Log entry into hydration
    console.log(`[CanvasSync] 🔄 Hydrate Triggered. Thread: ${threadId}, PatientID: ${patientId}`);

    if (!token || !threadId) {
        console.warn("[CanvasSync] Missing token or threadId, skipping.");
        return;
    }
    
    try {
      let queryParams = agentId ? `?agent_id=${agentId}` : '?';
      
      // [DEBUG] Check if we are appending the query param
      if (patientId) {
          queryParams += `&patient_id=${patientId}`;
          console.log(`[CanvasSync] ✅ Appending patient_id to Query Params: ${patientId}`);
      } else {
          console.log(`[CanvasSync] ⚠️ No patientId available for Query Params.`);
      }

      const url = `${API_BASE_URL}/agent/canvas/state/${threadId}${queryParams}`;
      
      const headers = getAuthHeaders();
      
      if (patientId) {
          headers["X-Target-Resource-ID"] = patientId.toString();
          console.log(`[CanvasSync] ✅ Setting X-Target-Resource-ID Header: ${patientId}`);
      }

      console.log(`[CanvasSync] 🚀 Fetching: ${url}`);
      const res = await fetch(url, { headers });
      
      if (res.ok) {
        const data = await res.json();
        console.log(`[CanvasSync] 📥 Response OK. Canvases: ${data.canvases?.length || 0}`);
        if (Array.isArray(data.canvases)) {
            setInstances(data.canvases);
            hydratedRef.current = threadId;
        }
      } else {
          console.error(`[CanvasSync] ❌ Fetch failed: ${res.status}`);
      }
    } catch (e) {
      console.error("[CanvasSync] ❌ Hydration Network Error:", e);
    }
  };

  useEffect(() => {
    if (!token || !threadId || !agentId) return;
    
    // [DEBUG] Log dependency change
    console.log(`[CanvasSync] Effect Change -> Thread: ${threadId}, Patient: ${patientId}, HydratedRef: ${hydratedRef.current}`);

    if (hydratedRef.current !== threadId) {
        hydrate();
    } else if (patientId && hydratedRef.current === threadId) {
        console.log("[CanvasSync] Context Update detected (Patient set late). Re-hydrating.");
        hydrate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, token, agentId, patientId]);

  useEffect(() => {
    if (!agent) return;

    const subscription = agent.subscribe({
      onEvent: (payload: any) => {
        const event = payload.event || payload;
        
        if (event.type === "RUN_STARTED") setLocked(true);
        if (event.type === "RUN_FINISHED" || event.type === "RUN_ERROR") setLocked(false);

        if (event.type === "CUSTOM") {
            const { name, value } = event;

            switch (name) {
                case "CANVAS_UPDATE":
                    if (value && value.canvas_id && value.delta) {
                        updateCanvas(
                            value.canvas_id, 
                            value.delta, 
                            value.force_open, 
                            'AGENT', 
                            value.meta
                        );
                    }
                    break;

                case "SESSION_RENAME":
                    if (value?.title && onRename) {
                        onRename(value.title);
                    }
                    break;

                default:
                    break;
            }
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [agent, updateCanvas, setLocked, onRename]); 
}
// end of frontend/lib/canvas/useCanvasSync.ts