// frontend/components/providers/user-provider.tsx
"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { UserData } from "@/lib/types";
import { API_BASE_URL, getAuthHeaders, ApiError } from "@/lib/api";

export type RefreshResult = { success: boolean; error?: string };

interface UserContextType {
  user: UserData | null;
  loading: boolean;
  error: string | null;
  refreshUser: () => Promise<RefreshResult>;
  logout: () => void;
  isAuthenticated: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

// Routes that do not require authentication
// Note: '/auth' is removed as it no longer exists.
const PUBLIC_PATHS = ["/", "/support", "/terms", "/pitch"];

/**
 * Manages the global user authentication state.
 * Fetches user profile, handles session expiration, and protects routes.
 */
export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const router = useRouter();
  const pathname = usePathname();

  const clearSession = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
    }
    setUser(null);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    // Redirect to Homepage (which now houses the Auth form)
    router.replace("/");
  }, [router, clearSession]);

  const fetchUser = useCallback(async (): Promise<RefreshResult> => {
    const headers = getAuthHeaders();
    
    if (!headers.Authorization) {
      setUser(null);
      setLoading(false);
      return { success: false, error: "No access token found" };
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/profile/`, { headers });

      if (res.ok) {
        const data: UserData = await res.json();
        setUser(data);
        return { success: true };
      } else {
        // Handle session expiration
        if (res.status === 401) {
          clearSession();
          return { success: false, error: "Session expired" };
        }
        // Throw a structured error for other issues
        throw new ApiError(`Server error (${res.status})`, res.status);
      }
    } catch (err: any) {
      console.error("Fetch user error:", err);
      setError(err.message);
      // If a critical auth error occurs (e.g., 401), log the user out
      if (err instanceof ApiError && err.status === 401) {
        logout();
      }
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [clearSession, logout]);

  // Initial fetch and periodic refresh
  useEffect(() => {
    fetchUser();
    // Refresh user data (especially wallet balance) every 60 seconds
    const intervalId = setInterval(fetchUser, 60000); 
    return () => clearInterval(intervalId);
  }, [fetchUser]);

  // Global Route Protection
  useEffect(() => {
    if (loading) return; // Wait until initial auth check is complete

    // Check if current path matches or starts with a public path
    const isPublicPage = PUBLIC_PATHS.some(path => 
      path === "/" ? pathname === "/" : pathname.startsWith(path)
    );

    // If user is not authenticated and the page is not public, redirect to Homepage
    if (!user && !isPublicPage) {
      router.replace("/");
    }
  }, [user, loading, pathname, router]);

  const value = {
    user,
    loading,
    error,
    refreshUser: fetchUser,
    logout,
    isAuthenticated: !!user,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

/**
 * Custom hook for consuming the UserContext.
 */
export function useUserContext() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUserContext must be used within a UserProvider");
  }
  return context;
}