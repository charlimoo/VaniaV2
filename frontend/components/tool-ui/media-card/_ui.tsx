// components/tool-ui/media-card/_ui.tsx
"use client";

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility for constructing className strings conditionally.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Re-export Shadcn UI Card components.
 */
export { Card, CardContent, CardFooter } from "@/components/ui/card";

/**
 * Re-export Shadcn UI Button.
 */
export { Button } from "@/components/ui/button";

/**
 * Re-export Shadcn UI Badge.
 */
export { Badge } from "@/components/ui/badge";

/**
 * Re-export Shadcn UI Dropdown components (used for actions menu).
 */
export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Re-export Shadcn UI Tooltip components.
 */
export {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";