import { toast } from "sonner";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { ApiError } from "./api";

export const BILLING_REQUIRED_EVENT = "vania:billing-required";

export type BillingRequiredDetail = {
  title?: string;
  message?: string;
  source?: string;
};

export const showBillingRequiredDialog = (detail?: BillingRequiredDetail) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(BILLING_REQUIRED_EVENT, { detail }));
};

/**
 * Intercepts API errors and checks for a 402 Payment Required status.
 * If a 402 error is detected, it displays a specific toast notification
 * with a "Buy Credits" action button that redirects the user to the billing page.
 *
 * @param error The error object thrown by a fetch call.
 * @param router The Next.js AppRouter instance for navigation.
 * @returns `true` if the error was a 402 and was handled, otherwise `false`.
 */
export const handleBillingError = (error: any, router: AppRouterInstance): boolean => {
  // Check if the error is our custom ApiError or has a status property
  const status = error instanceof ApiError ? error.status : error?.status;
  
  if (status === 402) {
    const message =
      typeof error?.detail === "string"
        ? error.detail
        : error?.detail?.detail || error?.message || "اعتبار کافی نیست.";

    showBillingRequiredDialog({
      title: "اعتبار گفتگو تمام شد",
      message: "برای ادامه، یک طرح یا بسته اعتبار تهیه کنید.",
    });

    toast.error("عدم موجودی کافی", {
      description: message,
      action: {
        label: "خرید اعتبار",
        onClick: () => router.push("/dashboard/billing"),
      },
      duration: 10000, // Show for a longer duration
    });
    
    // Return true to signify that the error has been handled
    return true; 
  }
  
  // Return false if it was not a billing error
  return false; 
};
