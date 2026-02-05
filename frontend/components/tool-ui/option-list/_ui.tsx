// components/tool-ui/option-list/_ui.tsx
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility for constructing className strings conditionally.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Re-export Shadcn UI Button.
 */
export { Button } from "@/components/ui/button";

/**
 * Re-export Shadcn UI Separator.
 * Path: @/components/ui/separator
 */
export { Separator } from "@/components/ui/separator";