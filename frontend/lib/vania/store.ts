import { create } from 'zustand';
// [FIX] Removed persist middleware import

interface VaniaState {
  activePatientId: number | null;
  activePatientName: string | null;
  setActivePatient: (id: number | null, name?: string) => void;
  reset: () => void;
}

export const useVaniaStore = create<VaniaState>((set) => ({
  activePatientId: null,
  activePatientName: null,

  setActivePatient: (id, name) => {
    // console.log(`[VaniaStore] Setting active patient: ID=${id}, Name=${name}`);
    set({ 
      activePatientId: id,
      activePatientName: name || null 
    });
  },

  reset: () => {
    set({ activePatientId: null, activePatientName: null });
  },
}));