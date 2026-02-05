"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/api";
import { EconomyConfig } from "@/lib/types";
import { APP_CONFIG } from "@/lib/config"; // Used for initial/fallback state

interface ConfigContextType {
  config: EconomyConfig;
  loading: boolean;
}

// Default state uses fallback values from the static config file
const defaultState: EconomyConfig = {
  currency_name: APP_CONFIG.CREDITS.NAME_SINGULAR,
  currency_symbol: APP_CONFIG.CREDITS.SYMBOL,
  daily_free_credits: APP_CONFIG.CREDITS.DEFAULT_DAILY_FREE_AMOUNT.toString(),
  transcription_cost_per_minute: "10.00" // Default cost
};

const ConfigContext = createContext<ConfigContextType>({
  config: defaultState,
  loading: true,
});

/**
 * Provides global access to dynamic economy settings fetched from the backend.
 * This allows administrators to change currency names, symbols, and limits
 * without requiring a frontend deployment.
 */
export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<EconomyConfig>(defaultState);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/billing/config/`, {
            // Use Next.js revalidation to cache this rarely-changing data for 1 hour
            next: { revalidate: 3600 } 
        });

        if (res.ok) {
          const data: EconomyConfig = await res.json();
          setConfig(data);
        } else {
          // If the API fails, we log it but continue with the default values
          console.error("Failed to fetch economy config, using fallback values.");
        }
      } catch (e) {
        console.error("Network error fetching economy config:", e);
      } finally {
        setLoading(false);
      }
    };
    
    fetchConfig();
  }, []);

  return (
    <ConfigContext.Provider value={{ config, loading }}>
      {children}
    </ConfigContext.Provider>
  );
}

/**
 * Custom hook to easily access the global economy configuration.
 */
export function useConfig() {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error("useConfig must be used within a ConfigProvider");
  }
  return context;
}