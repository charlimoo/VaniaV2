// frontend/lib/workspace-store.ts
import { create } from 'zustand';

/**
 * Defines the state and actions for managing the primary workspace layout
 * in the chat view (Chat Panel vs. Canvas Panel).
 */
interface WorkspaceState {
  // --- STATE ---
  /** If true, the Chat panel is collapsed to its minimal vertical strip. */
  isChatCollapsed: boolean;
  /** If true, the Canvas panel is collapsed to its minimal vertical strip. */
  isCanvasCollapsed: boolean;
  
  // --- ACTIONS ---
  /** Toggles the collapsed state of the Chat panel. */
  toggleChat: () => void;
  /** Toggles the collapsed state of the Canvas panel. */
  toggleCanvas: () => void;
  /** Resets the layout to the default split-view. */
  resetLayout: () => void;
}

/**
 * Zustand store for managing the collapsible workspace UI state.
 * [FIX] Removed persistence. Layout resets to default (Both Open) on refresh.
 */
export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  // Default state: a standard split view with both panels visible.
  isChatCollapsed: false,
  isCanvasCollapsed: false,

  toggleChat: () => set((state) => {
    const willCollapse = !state.isChatCollapsed;
    return {
      isChatCollapsed: willCollapse,
      // If collapsing chat, ensure canvas expands
      isCanvasCollapsed: willCollapse ? false : state.isCanvasCollapsed 
    };
  }),

  toggleCanvas: () => set((state) => {
    const willCollapse = !state.isCanvasCollapsed;
    return {
      isCanvasCollapsed: willCollapse,
      // If collapsing canvas, ensure chat expands
      isChatCollapsed: willCollapse ? false : state.isChatCollapsed
    };
  }),

  resetLayout: () => set({
    isChatCollapsed: false,
    isCanvasCollapsed: false
  })
}));