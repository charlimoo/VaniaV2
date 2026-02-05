"use client";

import { useUserContext } from "@/components/providers/user-provider";

/**
 * A wrapper hook that consumes the Global User Context.
 * Using this hook ensures all components share the same User State
 * and don't trigger duplicate network requests.
 */
export function useUser() {
  const context = useUserContext();

  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }

  return context;
}