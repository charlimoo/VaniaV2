"use client";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { AuthForm } from "@/components/auth-form";
// [FIX] Import from the new, correct modal store
import { useModalStore } from "@/lib/modal-store";

/**
 * A global dialog that wraps the authentication form.
 * Its visibility is controlled by the `useModalStore`.
 */
export function AuthDialog() {
  // [FIX] Use the new store to get state and actions
  const isOpen = useModalStore((s) => s.isAuthModalOpen);
  const toggleAuthModal = useModalStore((s) => s.toggleAuthModal);

  return (
    <Dialog open={isOpen} onOpenChange={toggleAuthModal}>
      <DialogContent 
        className="max-w-md p-0 overflow-hidden bg-background border-border" 
        dir="rtl"
      >
        <DialogTitle className="sr-only">ورود به حساب کاربری</DialogTitle>
        <DialogDescription className="sr-only">
          لطفاً برای ادامه عملیات وارد حساب کاربری خود شوید.
        </DialogDescription>
        
        <div className="max-h-[85vh] overflow-y-auto w-full">
          <AuthForm 
            className="border-none shadow-none" 
            onSuccess={() => toggleAuthModal(false)} 
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}