// components/tool-ui/data-table/_ui.tsx
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
 * Re-export Shadcn UI Button.
 * Path: @/components/ui/button
 */
export { Button } from "@/components/ui/button";

/**
 * Re-export Shadcn UI Dropdown Menu components.
 * Path: @/components/ui/dropdown-menu
 */
export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Re-export Shadcn UI Accordion components (used for mobile view).
 * Path: @/components/ui/accordion
 */
export {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

/**
 * Re-export Shadcn UI Tooltip components.
 * Path: @/components/ui/tooltip
 */
export {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Re-export Shadcn UI Badge (used for status pills).
 * Path: @/components/ui/badge
 */
export { Badge } from "@/components/ui/badge";

/**
 * Re-export Shadcn UI Table components.
 * Path: @/components/ui/table
 */
export {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";