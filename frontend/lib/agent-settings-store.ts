// frontend/lib/agent-settings-store.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// [FIX] Updated type definition
interface AgentSettings {
  isReasoningEnabled: boolean;
  reasoningEffort: 'low' | 'medium' | 'high' | 'none';
}

interface AgentSettingsState {
  settingsByAgent: Record<string, AgentSettings>;

  syncAgentDefaults: (agentSlug: string, defaults: {
    enable_reasoning: boolean;
    reasoning_effort: 'low' | 'medium' | 'high' | 'none';
  }) => void;

  setReasoningEnabled: (agentSlug: string, enabled: boolean) => void;
  setReasoningEffort: (agentSlug: string, effort: 'low' | 'medium' | 'high' | 'none') => void;
}

const DEFAULT_SETTINGS: AgentSettings = {
  isReasoningEnabled: false,
  reasoningEffort: 'none',
};

export const useAgentSettings = create<AgentSettingsState>()(
  persist(
    (set, get) => ({
      settingsByAgent: {},

      syncAgentDefaults: (agentSlug, defaults) => {
        const existing = get().settingsByAgent[agentSlug];
        if (!existing) {
          set((state) => ({
            settingsByAgent: {
              ...state.settingsByAgent,
              [agentSlug]: {
                isReasoningEnabled: false,
                reasoningEffort: 'none',
              } as AgentSettings,
            },
          }));
        }
      },
      // ... (Rest of actions remain same, type inference handles the change) ...
      setReasoningEnabled: (agentSlug, enabled) => {
        set((state) => ({
          settingsByAgent: {
            ...state.settingsByAgent,
            [agentSlug]: {
              ...(state.settingsByAgent[agentSlug] || DEFAULT_SETTINGS),
              isReasoningEnabled: enabled,
            },
          },
        }));
      },
      
      setReasoningEffort: (agentSlug, effort) => {
        set((state) => ({
          settingsByAgent: {
            ...state.settingsByAgent,
            [agentSlug]: {
              ...(state.settingsByAgent[agentSlug] || DEFAULT_SETTINGS),
              reasoningEffort: effort,
            },
          },
        }));
      },
    }),
    {
      name: 'aegra-agent-settings-v2',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
