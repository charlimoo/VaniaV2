// lib/ag-ui/runtime/event-parser.ts
import type { AgUiEvent } from "./types";

// Helper type guards
const isString = (value: unknown): value is string => typeof value === "string";
const isNonEmptyString = (value: unknown): value is string =>
  isString(value) && value.length > 0;

// Helper to construct objects with optional properties
const withOptional = <T extends object>(
  base: T,
  optionals: Record<string, unknown>,
) => {
  const definedEntries = Object.entries(optionals).filter(
    ([, value]) => value !== undefined,
  );
  return definedEntries.length === 0
    ? base
    : ({ ...base, ...Object.fromEntries(definedEntries) } as T);
};

/**
 * Parses a raw event object (usually from JSON) into a strict AgUiEvent.
 * Handles standard protocol events and custom extensions for Canvas.
 */
export const parseAgUiEvent = (event: unknown): AgUiEvent | null => {
  if (!event || typeof event !== "object") return null;
  
  const payload = event as Record<string, unknown>;
  const typeValue = payload["type"];
  
  if (!isString(typeValue)) return null;

  // Helper to safely extract string properties
  const getString = (key: string) =>
    isString(payload[key]) ? (payload[key] as string) : undefined;

  // Debug log for raw event types (optional, can be noisy)
  // console.debug(`[EventParser] Parsing type: ${typeValue}`);

  switch (typeValue) {
    // --- LIFECYCLE EVENTS ---
    case "RUN_STARTED": {
      const runId = getString("runId");
      return runId ? { type: "RUN_STARTED", runId } : null;
    }
    case "RUN_FINISHED": {
      const runId = getString("runId");
      return runId ? { type: "RUN_FINISHED", runId } : null;
    }
    case "RUN_CANCELLED": {
      const runId = getString("runId");
      return withOptional({ type: "RUN_CANCELLED" as const }, { runId });
    }
    case "RUN_ERROR": {
      return withOptional(
        { type: "RUN_ERROR" as const },
        {
          message: getString("message"),
          code: getString("code"),
        },
      );
    }

    // --- TEXT MESSAGE EVENTS ---
    case "TEXT_MESSAGE_START":
      return withOptional(
        { type: "TEXT_MESSAGE_START" as const },
        { messageId: getString("messageId") },
      );
    case "TEXT_MESSAGE_CONTENT": {
      const delta = getString("delta");
      // We explicitly allow empty strings if they are part of the protocol, 
      // but usually content events imply data.
      if (!isNonEmptyString(delta)) return null;
      return withOptional(
        { type: "TEXT_MESSAGE_CONTENT" as const, delta },
        { messageId: getString("messageId") },
      );
    }
    case "TEXT_MESSAGE_END":
      return withOptional(
        { type: "TEXT_MESSAGE_END" as const },
        { messageId: getString("messageId") },
      );
    case "TEXT_MESSAGE_CHUNK": {
      // Convenience event often used by simple backends
      const delta = getString("delta") ?? "";
      return withOptional(
        { type: "TEXT_MESSAGE_CHUNK" as const, delta },
        { messageId: getString("messageId") },
      );
    }

    // --- THINKING / REASONING EVENTS ---
    case "THINKING_START":
      return withOptional(
        { type: "THINKING_START" as const },
        { title: getString("title") },
      );
    case "THINKING_TEXT_MESSAGE_START":
      return { type: "THINKING_TEXT_MESSAGE_START" };
    case "THINKING_TEXT_MESSAGE_CONTENT": {
      const delta = getString("delta") ?? "";
      return { type: "THINKING_TEXT_MESSAGE_CONTENT", delta };
    }
    case "THINKING_TEXT_MESSAGE_END":
      return { type: "THINKING_TEXT_MESSAGE_END" };
    case "THINKING_END":
      return { type: "THINKING_END" };

    // --- TOOL CALL EVENTS ---
    case "TOOL_CALL_START": {
      const toolCallId = getString("toolCallId");
      if (!toolCallId) return null;
      return withOptional(
        { type: "TOOL_CALL_START" as const, toolCallId },
        {
          toolCallName: getString("toolCallName"),
          parentMessageId: getString("parentMessageId"),
        },
      );
    }
    case "TOOL_CALL_ARGS": {
      const toolCallId = getString("toolCallId");
      if (!toolCallId) return null;
      const delta = getString("delta") ?? "";
      return { type: "TOOL_CALL_ARGS", toolCallId, delta };
    }
    case "TOOL_CALL_END": {
      const toolCallId = getString("toolCallId");
      return toolCallId ? { type: "TOOL_CALL_END", toolCallId } : null;
    }
    case "TOOL_CALL_CHUNK":
      return withOptional(
        { type: "TOOL_CALL_CHUNK" as const },
        {
          toolCallId: getString("toolCallId"),
          toolCallName: getString("toolCallName"),
          parentMessageId: getString("parentMessageId"),
          delta: getString("delta"),
        },
      );
    case "TOOL_CALL_RESULT": {
      const toolCallId = getString("toolCallId");
      if (!toolCallId) return null;
      return withOptional(
        {
          type: "TOOL_CALL_RESULT" as const,
          toolCallId,
          content: getString("content") ?? "",
        },
        {
          messageId: getString("messageId"),
          role: payload["role"] === "tool" ? "tool" : undefined,
        },
      );
    }

    // --- STATE MANAGEMENT ---
    case "STATE_SNAPSHOT":
      return { type: "STATE_SNAPSHOT", snapshot: payload["snapshot"] };
    case "STATE_DELTA":
      return {
        type: "STATE_DELTA",
        delta: Array.isArray(payload["delta"])
          ? (payload["delta"] as any[])
          : [],
      };
    case "MESSAGES_SNAPSHOT":
      return {
        type: "MESSAGES_SNAPSHOT",
        messages: Array.isArray(payload["messages"])
          ? (payload["messages"] as any[])
          : [],
      };

    // --- CUSTOM & RAW ---
    case "RAW":
      return withOptional(
        { type: "RAW" as const, event: payload["event"] },
        { source: getString("source") },
      );
      
    // [CRITICAL] Handler for Canvas Updates sent by Agno v2 tools
    case "CUSTOM": {
      const name = getString("name");
      if (!name) return null;
      return { 
        type: "CUSTOM", 
        name, 
        value: payload["value"] 
      };
    }

    default:
      // Fallback for unknown events
      return withOptional(
        { type: "RAW" as const, event: payload },
        {
          source: isString(payload["type"])
            ? (payload["type"] as string)
            : undefined,
        },
      );
  }
};