import { create } from 'zustand';

interface ModalState {
  isAuthModalOpen: boolean;
  toggleAuthModal: (open: boolean) => void;
}

/**
 * A simple Zustand store to manage the state of global UI modals,
 * such as the authentication dialog.
 */
export const useModalStore = create<ModalState>((set) => ({
  isAuthModalOpen: false,
  toggleAuthModal: (open) => set({ isAuthModalOpen: open }),
}));