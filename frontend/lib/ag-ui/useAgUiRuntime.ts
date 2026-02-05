// start of lib/ag-ui/useAgUiRuntime.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useExternalStoreRuntime,
  useRuntimeAdapters,
  type ExternalStoreAdapter,
  type ThreadMessage,
  type AppendMessage,
  type AssistantRuntime,
} from "@assistant-ui/react";

import { makeLogger } from "./runtime/logger";
import type { UseAgUiRuntimeOptions } from "./runtime/types";
import { AgUiThreadRuntimeCore } from "./runtime/AgUiThreadRuntimeCore";

// Extended options to support Thread/Agent IDs and the Wrapper Hook
type AgUiRuntimeOptionsWithThread = Omit<UseAgUiRuntimeOptions, "adapters"> & {
  threadId?: string;
  agentId?: string;
  onNewMessageWrapper?: (message: AppendMessage) => Promise<void>;
  adapters?: {
    threadList?: any;
    history?: {
      load: (threadId: string) => Promise<{ messages: ThreadMessage[] }>;
      append?: (message: ThreadMessage) => Promise<void>;
    };
    attachments?: any;
    speech?: any;
    feedback?: any;
  };
};

export function useAgUiRuntime(
  options: AgUiRuntimeOptionsWithThread,
): AssistantRuntime {
  // 1. Setup Logger & Versioning
  const logger = useMemo(() => makeLogger(options.logger), [options.logger]);
  const [version, setVersion] = useState(0);
  const notifyUpdate = useCallback(() => setVersion((v) => v + 1), []);
  
  // 2. Initialize Core (Singleton per component lifecycle)
  const coreRef = useRef<AgUiThreadRuntimeCore | null>(null);
  
  if (!coreRef.current) {
    coreRef.current = new AgUiThreadRuntimeCore({
      threadId: options.threadId,
      agentId: options.agentId || "system",
      agent: options.agent,
      logger,
      showThinking: options.showThinking ?? true,
      ...(options.onError ? { onError: options.onError } : {}),
      ...(options.onCancel ? { onCancel: options.onCancel } : {}),
      notifyUpdate,
    });
  }

  const core = coreRef.current;
  
  // 3. Track History Loading State
  // This prevents infinite re-fetching when the component re-renders
  const lastLoadedThreadId = useRef<string | null>(null);

  // --- EFFECT: Update Core Options ---
  // Syncs React props (like threadId changes) to the internal Core
  useEffect(() => {
    core.updateOptions({
      threadId: options.threadId,
      agentId: options.agentId || "system",
      agent: options.agent,
      logger,
      showThinking: options.showThinking ?? true,
      onError: options.onError,
      onCancel: options.onCancel,
      // We pass the history adapter if available, though we handle loading manually below
      history: options.adapters?.history as any, 
    });
  }, [
    options.threadId, 
    options.agentId, 
    options.agent, 
    options.showThinking, 
    options.adapters?.history, 
    core,
    logger
  ]);

  // --- EFFECT: Load History ---
  useEffect(() => {
    const historyAdapter = options.adapters?.history;
    const currentThreadId = options.threadId;

    // Skip if no ID, or if it's the default "main", or no adapter provided
    if (!currentThreadId || currentThreadId === "main" || !historyAdapter) return;
    
    // Skip if we already loaded this exact thread ID
    if (lastLoadedThreadId.current === currentThreadId) return;

    let isActive = true;

    // Check if the adapter has a load function
    if (typeof historyAdapter.load === "function") {
      console.log(`[Runtime] Attempting to load history for: ${currentThreadId}`);
      historyAdapter.load(currentThreadId).then((data: { messages: ThreadMessage[] }) => {
        // Prevent race conditions: Ensure we are still mounted and on the same thread
        if (!isActive) return;
        
        // Internal check to ensure core is synchronized
        // (Cast to any to access private property or use a getter if available)
        if ((core as any).threadId !== currentThreadId) return;
        
        const messages = data?.messages; 
        
        if (Array.isArray(messages)) {
          console.log(`[Runtime] Loaded ${messages.length} messages for ${currentThreadId}`);
          core.applyExternalMessages(messages);
          
          // Mark this ID as successfully loaded
          lastLoadedThreadId.current = currentThreadId;
        }
      }).catch((e: any) => {
        if(isActive) console.error("[Runtime] Failed to load history", e);
      });
    }

    return () => { isActive = false; };
  }, [options.threadId, options.adapters?.history, core]);

  // 4. Merge Adapters
  // Merges custom adapters with default runtime adapters (e.g. for Speech)
  const runtimeAdapters = useRuntimeAdapters();
  const adapterAdapters = useMemo(() => {
    const value: any = { ...options.adapters };
    const defaults = runtimeAdapters as any;
    
    if (!value.attachments && defaults?.attachments) value.attachments = defaults.attachments;
    if (!value.speech && defaults?.speech) value.speech = defaults.speech;
    if (!value.feedback && defaults?.feedback) value.feedback = defaults.feedback;
    
    // We handle history loading manually in the effect above, but we pass it through
    // in case other components need it, though usually we strip it here to avoid 
    // double-handling by the library if it auto-loads.
    // delete value.history; 

    return Object.keys(value).length ? value : undefined;
  }, [options.adapters, runtimeAdapters]);

  // 5. Define the Store
  // This maps the internal Core state to the UI library's expectation
  const store = useMemo(
    () =>
      ({
        messages: core.getMessages(),
        state: core.getState(),
        isRunning: core.isRunning(),
        
        // INTERCEPTOR: Handle New Messages
        onNew: async (message: AppendMessage) => {
            // If a wrapper is provided (e.g. for creating backend sessions), await it first
            if (options.onNewMessageWrapper) {
                await options.onNewMessageWrapper(message);
            }
            return core.append(message);
        },
        
        onEdit: (message: AppendMessage) => core.edit(message),
        onReload: (parentId: string | null, config: { runConfig?: any }) =>
          core.reload(parentId, config),
        onCancel: () => core.cancel(),
        onAddToolResult: (options) => core.addToolResult(options),
        onResume: (config) => core.resume(config),
        
        // State Hydration
        setMessages: (messages: readonly ThreadMessage[]) =>
          core.applyExternalMessages(messages),
        onImport: (messages: readonly ThreadMessage[]) =>
          core.applyExternalMessages(messages),
        onLoadExternalState: (state: any) => 
          core.loadExternalState(state),
          
        adapters: adapterAdapters,
      }) satisfies ExternalStoreAdapter<ThreadMessage>,
    [adapterAdapters, core, version, options.onNewMessageWrapper]
  );

  // 6. Create Runtime
  const runtime = useExternalStoreRuntime(store);

  // 7. Attach/Detach Lifecycle
  useEffect(() => {
    core.attachRuntime(runtime);
    return () => {
      core.cancel();
      core.detachRuntime();
    };
  }, [core, runtime]);

  return runtime;
}
// end of lib/ag-ui/useAgUiRuntime.ts