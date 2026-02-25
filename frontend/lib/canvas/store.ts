// start of lib/canvas/store.ts
import { create } from 'zustand';

// --- Configuration ---
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// --- Types ---

export interface CanvasData {
  id: string;
  name: string;
  slug: string;
  component_key: string; // e.g., 'RECHARTS_DASHBOARD'
  current_state: Record<string, any>;
  is_visible: boolean;
}

interface CanvasState {
  // ... (Existing State)
  instances: Record<string, CanvasData>;
  orderedIds: string[];
  activeTabId: string | null;
  isPanelOpen: boolean;
  isLocked: boolean;
  
  // [FIX] New State to track the active patient context for API calls
  contextResourceId: string | null;
  contextDoctorId: string | null;

  // ... (Existing Actions)
  setInstances: (canvases: CanvasData[]) => void;
  updateCanvas: (
    id: string, 
    newState: Record<string, any>, 
    forceFocus?: boolean, 
    source?: 'USER' | 'AGENT',
    meta?: Partial<CanvasData>
  ) => void;
  setActiveTab: (id: string) => void;
  togglePanel: (isOpen?: boolean) => void;
  setLocked: (locked: boolean) => void;
  getOrderedInstances: () => CanvasData[];
  clear: () => void;
  
  // [FIX] New Action
  setContextResourceId: (id: string | null) => void;
  setContextDoctorId: (id: string | null) => void;
}

// --- Utility: Deep Merge ---
// Prevents data loss when merging partial updates (deltas)
function deepMerge(target: any, source: any): any {
  // If target is not an object (e.g. null, undefined, primitive), return source
  if (typeof target !== 'object' || target === null) return source;
  // If source is not an object, return target (shouldn't happen in valid merge) or overwrite
  if (typeof source !== 'object' || source === null) return source; // Overwrite primitive

  const output = { ...target };
  
  Object.keys(source).forEach(key => {
    const sourceValue = source[key];
    const targetValue = output[key];

    if (Array.isArray(sourceValue)) {
      // Arrays are overwritten, not merged index-by-index
      output[key] = sourceValue;
    } else if (typeof sourceValue === 'object' && sourceValue !== null && targetValue) {
      // Recursive merge for objects
      output[key] = deepMerge(targetValue, sourceValue);
    } else {
      // Primitive value overwrite
      output[key] = sourceValue;
    }
  });
  
  return output;
}

// --- Store Implementation ---

export const useCanvasStore = create<CanvasState>((set, get) => ({
  instances: {},
  orderedIds: [],
  activeTabId: null,
  isPanelOpen: false,
  isLocked: false,
  
  // [FIX] Initialize as null
  contextResourceId: null,
  contextDoctorId: null,

  setContextResourceId: (id) => set({ contextResourceId: id }),
  setContextDoctorId: (id) => set({ contextDoctorId: id }),

  setInstances: (canvases) => {
    console.log(`[CanvasStore] 🌊 Hydrating ${canvases?.length || 0} instances from backend.`);
    
    if (!canvases || canvases.length === 0) {
      // If we receive an empty list, we usually don't want to blow away the state 
      // if we are in the middle of a generation, but for navigation it's correct.
      // For now, we allow clearing.
      return;
    }

    const instanceMap: Record<string, CanvasData> = {};
    const ids: string[] = [];
    
    let firstVisibleId: string | null = null;

    canvases.forEach((c) => {
      instanceMap[c.id] = c;
      ids.push(c.id);
      if (c.is_visible && !firstVisibleId) {
        firstVisibleId = c.id;
      }
    });

    set((state) => {
        // Keep current active tab if it still exists in the new list
        // Otherwise default to the first visible one
        const nextActiveId = state.activeTabId && instanceMap[state.activeTabId] 
            ? state.activeTabId 
            : firstVisibleId;

        return {
            instances: instanceMap,
            orderedIds: ids,
            activeTabId: nextActiveId,
            // Auto-open panel if we have content and it wasn't explicitly closed
            isPanelOpen: state.isPanelOpen || (!!firstVisibleId)
        };
    });
  },

  updateCanvas: (id, delta, forceFocus = false, source = 'AGENT', meta) => {
    // [LOGGING START]
    // Group logs to keep console clean but explorable
    console.groupCollapsed(`[CanvasStore] ⚡ Update Canvas: ${id} (${source})`);
    console.log("1. Incoming Delta:", delta);
    if (meta) console.log("   Metadata provided:", meta);
    // [LOGGING END]
    
    set((state) => {
      const existing = state.instances[id];
      
      // SCENARIO 1: New Instance Creation (Self-Healing)
      if (!existing) {
        if (meta && meta.component_key && meta.name) {
           console.log("2. Action: Creating NEW instance from metadata.");
           
           const newInstance: CanvasData = {
             id,
             name: meta.name,
             slug: meta.slug || "generated",
             component_key: meta.component_key,
             current_state: delta, // Initial state is the delta
             is_visible: true
           };

           console.log("3. New Instance State:", newInstance);
           console.groupEnd();

           return {
             instances: { ...state.instances, [id]: newInstance },
             orderedIds: [...state.orderedIds, id],
             activeTabId: forceFocus ? id : (state.activeTabId || id),
             isPanelOpen: forceFocus ? true : state.isPanelOpen
           };
        } else {
           console.warn("2. ⚠️ Warning: Missing instance and no metadata provided. Update ignored.");
           console.groupEnd();
           return state;
        }
      }

      // SCENARIO 2: Update Existing Instance
      console.log("2. Existing State (Before):", JSON.parse(JSON.stringify(existing.current_state)));

      const mergedState = deepMerge(existing.current_state, delta);
      
      console.log("3. Merged State (After):", JSON.parse(JSON.stringify(mergedState)));
      
      // Check specifically for data array length if it exists
      if (mergedState.data && Array.isArray(mergedState.data)) {
          console.log(`   -> Data Array Length: ${mergedState.data.length}`);
      }
      
      console.groupEnd();

      const updatedInstances = {
        ...state.instances,
        [id]: {
          ...existing,
          current_state: mergedState,
          is_visible: true, // Updates implies visibility
        },
      };

      return {
        instances: updatedInstances,
        activeTabId: forceFocus ? id : state.activeTabId,
        isPanelOpen: forceFocus ? true : state.isPanelOpen,
      };
    });

    // Network Sync (Fire-and-Forget)
    // Only performed if the update originated from the User (e.g. typing)
    if (source === 'USER') {
      const token = localStorage.getItem("accessToken");
      
      // Get the resource ID from store state
      const resourceId = get().contextResourceId;
      const doctorId = get().contextDoctorId;

      if (token) {
        const headers: Record<string, string> = {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
        };

        // Inject the header if we have a patient context
        if (resourceId) {
            headers["X-Target-Resource-ID"] = resourceId;
        }
        if (doctorId) {
            headers["X-Target-Expert-ID"] = doctorId;
            headers["X-Target-Doctor-ID"] = doctorId;
        }

        fetch(`${API_BASE}/agent/canvas/instance/${id}`, {
          method: "PATCH",
          headers: headers,
          body: JSON.stringify({ delta }),
        }).catch((err) => {
          console.error("[CanvasStore] ❌ Background Sync Failed:", err);
        });
      }
    }
  },

  setActiveTab: (id) => set({ activeTabId: id, isPanelOpen: true }),

  togglePanel: (isOpen) => set((state) => ({
    isPanelOpen: isOpen !== undefined ? isOpen : !state.isPanelOpen,
  })),

  setLocked: (locked) => {
      // Less verbose logging for lock toggling
      // console.log(`[CanvasStore] 🔒 Lock State: ${locked}`);
      set({ isLocked: locked });
  },

  getOrderedInstances: () => {
    const s = get();
    return s.orderedIds.map(id => s.instances[id]).filter(Boolean);
  },

    clear: () => {
    console.log("[CanvasStore] 🧹 Clearing all instances.");
    set({
        instances: {},
        orderedIds: [],
        activeTabId: null,
        isPanelOpen: false,
        isLocked: false,
        contextResourceId: null,
        contextDoctorId: null
    });
  },
  
}));
// end of lib/canvas/store.ts
