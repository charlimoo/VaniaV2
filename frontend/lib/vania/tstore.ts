// frontend/src/store/useTradeStore.ts

// IMPORTANT : THIS FILE IS FROM ANOTHER PROJECT AND CONTAINS LOTS OF IRRELEVANT STUFF, JUST NEEDED IT TO MAKE THE CANVAS MINIMIZE IN CHAT PAGE WORK

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// --- Interfaces for State and Actions ---

/**
 * Defines the shape of all user-configurable filters.
 */
export interface Filters {
  year: string[];
  type_id: number | null;
  country_ids: number[];
  exclude_country_ids: number[];
  customs_ids: number[];
  hs_codes: string[];
  section_id: number | null;
  min_value: number | null;
  max_value: number | null;
  min_weight: number | null;
  max_weight: number | null;
  country_group: string | null;
  commodity_group_mode: 'section' | 'hs_code';
}

/**
 * Represents a saved snapshot of filters for later use.
 */
interface SavedView {
  id: string;
  name: string;
  date: string;
  filters: Filters;
  activeTab: string;
}

/**
 * The complete shape of the global store.
 */
interface TradeState {
  // State
  activeTab: string;
  filters: Filters;
  savedViews: SavedView[];
  
  // Actions
  setActiveTab: (tab: string) => void;
  setFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  toggleFilterList: (key: 'year' | 'country_ids' | 'customs_ids' | 'hs_codes' | 'exclude_country_ids', value: any) => void;
  resetFilters: () => void;
  
  // Bookmark Actions
  saveView: (name: string) => void;
  loadView: (id: string) => void;
  deleteView: (id: string) => void;
}

// --- Initial State ---

const initialFilters: Filters = {
  year: [],
  type_id: null,
  country_ids: [],
  exclude_country_ids: [],
  customs_ids: [],
  hs_codes: [],
  section_id: null,
  min_value: null,
  max_value: null,
  min_weight: null,
  max_weight: null,
  country_group: null,
  commodity_group_mode: 'section', // Default to broad groups
};

// --- Store Implementation ---

export const useTradeStore = create<TradeState>()(
  // Use persist middleware to save state to localStorage
  persist(
    (set, get) => ({
      // --- Initial State Values ---
      activeTab: 'overview',
      filters: initialFilters,
      savedViews: [],

      // --- Actions ---

      setActiveTab: (tab) => set({ activeTab: tab }),

      setFilter: (key, value) => set((state) => ({
        filters: { ...state.filters, [key]: value }
      })),

      /**
       * Toggles a value in a list-based filter (e.g., multi-select).
       * If the value exists, it's removed. If not, it's added.
       */
      toggleFilterList: (key, value) => set((state) => {
        const list = state.filters[key] as any[];
        const exists = list.includes(value);
        
        const newList = exists 
          ? list.filter((item) => item !== value)
          : [...list, value];
        
        return {
          filters: { ...state.filters, [key]: newList }
        };
      }),

      resetFilters: () => set({ 
        filters: {
          ...initialFilters,
          // Persist the user's UI choice for the pie chart across resets
          commodity_group_mode: get().filters.commodity_group_mode 
        } 
      }),
      
      // --- Bookmark (Saved View) Actions ---

      saveView: (name) => {
        const { filters, activeTab, savedViews } = get();
        const newView: SavedView = {
          id: crypto.randomUUID(),
          name,
          date: new Date().toLocaleDateString('fa-IR'), // Persian date format
          filters: { ...filters }, // Create a deep copy of current filters
          activeTab
        };
        // Prepend new view to the top of the list
        set({ savedViews: [newView, ...savedViews] }); 
      },

      loadView: (id) => {
        const view = get().savedViews.find(v => v.id === id);
        if (view) {
          set({ 
            // Load the filters and the active tab from the saved view
            filters: { ...view.filters },
            activeTab: view.activeTab 
          });
        }
      },

      deleteView: (id) => {
        set({ savedViews: get().savedViews.filter(v => v.id !== id) });
      }
    }),
    {
      // --- Persist Middleware Configuration ---
      name: 'tradex-filter-storage', // The key to use in localStorage
      storage: createJSONStorage(() => localStorage), // Specify localStorage
      // We only want to save filters and views, not transient UI state like activeTab
      partialize: (state) => ({ 
        filters: state.filters, 
        savedViews: state.savedViews 
      }),
    }
  )
);