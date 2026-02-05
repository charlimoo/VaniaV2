// components/tool-ui/shared/_ui.tsx
"use client";

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility for constructing className strings conditionally.
 * This is used by the ActionButtons shared component.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Re-export Shadcn UI Button.
 * Used for footer actions across all tools.
 */
export { Button } from "@/components/ui/button";