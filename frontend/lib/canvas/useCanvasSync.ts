// frontend/lib/canvas/useCanvasSync.ts

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
  patientId?: number | null;
  doctorId?: number | null;
  isDraft?: boolean;
}

export function useCanvasSync({ 
  agent, 
  threadId, 
  agentId, 
  token, 
  onRename, 
  patientId,
  doctorId,
  isDraft = false,
}: UseCanvasSyncProps) {
  
  const setInstances = useCanvasStore((s) => s.setInstances);
  const updateCanvas = useCanvasStore((s) => s.updateCanvas);
  const setLocked = useCanvasStore((s) => s.setLocked);
  
  // [FIX] Import the new setter
  const setContextResourceId = useCanvasStore((s) => s.setContextResourceId);
  const setContextDoctorId = useCanvasStore((s) => s.setContextDoctorId);
  
  const hydratedRef = useRef<string | null>(null);

  // [FIX] Effect to sync patientId to the global store
  useEffect(() => {
    if (patientId) {
        setContextResourceId(patientId.toString());
    } else {
        setContextResourceId(null);
    }
  }, [patientId, setContextResourceId]);

  useEffect(() => {
    if (doctorId) {
      setContextDoctorId(doctorId.toString());
    } else {
      setContextDoctorId(null);
    }
  }, [doctorId, setContextDoctorId]);

  // --- Hydration Function ---
  const hydrate = async () => {
    if (!token || !threadId) {
        return;
    }
    
    try {
      let queryParams = agentId ? `?agent_id=${agentId}` : '?';
      
      if (patientId) {
          queryParams += `&visitor_id=${patientId}&patient_id=${patientId}`;
      }
      if (doctorId) {
          queryParams += `&expert_id=${doctorId}&doctor_id=${doctorId}`;
      }

      const url = `${API_BASE_URL}/agent/canvas/state/${threadId}${queryParams}`;
      const headers = getAuthHeaders();
      
      if (patientId) {
          headers["X-Target-Resource-ID"] = patientId.toString();
      }
      if (doctorId) {
          headers["X-Target-Expert-ID"] = doctorId.toString();
          headers["X-Target-Doctor-ID"] = doctorId.toString();
      }

      const res = await fetch(url, { headers });
      
      if (res.ok) {
        const data = await res.json();
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

  // --- Initial Hydration Effect ---
  useEffect(() => {
    if (!token || !threadId || !agentId) return;
    
    if (hydratedRef.current !== threadId) {
        hydrate();
    } else if ((patientId || doctorId) && hydratedRef.current === threadId) {
        hydrate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, token, agentId, patientId, doctorId]);

  // --- Real-time Subscription Effect ---
  useEffect(() => {
    if (!agent) return;

    const subscription = agent.subscribe({
      onEvent: (payload: any) => {
        const event = payload.event || payload;
        
        if (event.type === "RUN_STARTED") {
          setLocked(true);
        }
        
        // [FIX] REMOVED the problematic re-hydration call from RUN_FINISHED.
        // We now only set the lock state to false and trust the CANVAS_UPDATE events.
        if (event.type === "RUN_FINISHED" || event.type === "RUN_ERROR") {
            setLocked(false);
            // The line below was causing the bug and has been removed:
            // if (event.type === "RUN_FINISHED") { hydrate(); }
        }

        if (event.type === "CUSTOM") {
            const { name, value } = event;

            switch (name) {
                case "CANVAS_UPDATE":
                    // This now becomes the single source of truth for in-run updates.
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
    // Re-added dependencies to ensure the hook re-subscribes if they change.
  }, [agent, updateCanvas, setLocked, onRename, setInstances]); 
}
