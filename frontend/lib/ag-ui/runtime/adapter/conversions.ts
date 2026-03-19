// lib/ag-ui/runtime/adapter/conversions.ts
"use client";

// Types matching the Python Backend's Pydantic models
export type AgUiTextInput = { type: "text"; text: string };
export type AgUiBinaryInput = { 
  type: "binary"; 
  mimeType: string; 
  data?: string; 
  url?: string; 
  id?: string;
  filename?: string;
};

export type AgUiMessage =
  | {
      id: string;
      role: "user";
      content: string | Array<AgUiTextInput | AgUiBinaryInput>;
      name?: string;
      attachmentsMeta?: Array<{
        id: string;
        name: string;
        contentType: string;
        type: "image" | "document" | "file";
      }>;
    }
  | {
      id: string;
      role: "assistant";
      content?: string;
      name?: string;
      toolCalls?: any[];
    }
  | {
      id: string;
      role: "tool";
      content: string;
      toolCallId: string;
      error?: string;
    }
  | {
      id: string;
      role: "system" | "developer";
      content: string;
  };

type ThreadMessageLike = {
  id: string;
  role: string;
  content: any;
  name?: string;
  attachments?: readonly any[] | any[]; 
};

const generateId = () =>
  (globalThis.crypto as any)?.randomUUID?.() ??
  Math.random().toString(36).slice(2);

// --- HELPER: Normalize Tool Calls ---
const normaliseToolCall = (part: any) => {
  const id = part.toolCallId ?? generateId();
  const argsText =
    typeof part.argsText === "string"
      ? part.argsText
      : JSON.stringify(part.args ?? {});
      
  return {
    id,
    call: {
      id,
      type: "function" as const,
      function: {
        name: part.toolName ?? "unknown_tool",
        arguments: argsText,
      },
    },
  };
};

export const toAgUiMessages = (
  messages: readonly ThreadMessageLike[],
): AgUiMessage[] => {
  const converted: AgUiMessage[] = [];

  for (const message of messages) {
    const role = message.role;
    
    // --- 1. Handle Content & Attachments ---
    let parts: Array<AgUiTextInput | AgUiBinaryInput> = [];

    // Process Text/Image content from UI
    if (Array.isArray(message.content)) {
      for (const part of message.content) {
        if (part.type === "text") {
          parts.push({ type: "text", text: part.text });
        } else if (part.type === "image") {
           // Base64 image from UI state
           if (part.image) {
             parts.push({ 
               type: "binary", 
                mimeType: "image/jpeg", // Defaulting to jpeg for base64
               data: part.image.split(',')[1] || part.image, // Remove data:image/... prefix if present
               filename: message.attachments?.[0]?.file?.name,
             });
           }
        }
      }
    } else if (typeof message.content === "string") {
      parts.push({ type: "text", text: message.content });
    }

    // Process File Attachments
    if (message.attachments && message.attachments.length > 0) {
        for (const attachment of message.attachments) {
            const contentPart = attachment.content?.[0];
            
            // 1. Handle Images
            if (contentPart?.type === "image" && contentPart.image) {
                 parts.push({ 
                   type: "binary", 
                   mimeType: attachment.file?.type || "image/jpeg",
                   data: contentPart.image.split(',')[1] || contentPart.image,
                   filename: attachment.file?.name,
                 });
            }
            
            // 2. Handle Documents (CSV, PDF, etc.)
            // We look for 'file' type OR fallback to checking if a file object exists
            else if (attachment.file) {
                // If we stored the base64 in 'text' field in SimpleThreadAdapters
                const rawBase64 = contentPart?.text || ""; 
                if (rawBase64) {
                    parts.push({
                        type: "binary",
                        mimeType: attachment.file.type || "application/octet-stream",
                        // Strip Data URL prefix if present (e.g. "data:text/csv;base64,...")
                        data: rawBase64.includes(',') ? rawBase64.split(',')[1] : rawBase64,
                        filename: attachment.file.name,
                    });
                }
            }
        }
    }

    // Determine final content format (String or Array)
    let finalContent: any = parts;
    if (parts.length === 0) finalContent = ""; 
    else if (parts.length === 1 && parts[0].type === "text") finalContent = parts[0].text;


    // --- 2. Map Roles ---
    
    // A. Assistant
    if (role === "assistant") {
      const toolCallParts = Array.isArray(message.content) 
        ? message.content.filter((part: any) => part?.type === "tool-call")
        : [];

      const toolCalls = toolCallParts.map((part: any) => {
        const { id, call } = normaliseToolCall(part);
        return { id, call, part };
      });

      // Push the Assistant Message
      converted.push({
        id: message.id,
        role: "assistant",
        content: typeof finalContent === "string" ? finalContent : "", // Assistant content is usually just text
        ...(message.name ? { name: message.name } : {}),
        ...(toolCalls.length > 0
          ? { toolCalls: toolCalls.map((entry) => entry.call) }
          : {}),
      });

      // Push distinct Tool Result messages (AG-UI protocol expects results as separate messages)
      for (const { id: toolCallId, part } of toolCalls) {
        if (part.result === undefined) continue;

        const resultContent = typeof part.result === "string"
            ? part.result
            : JSON.stringify(part.result);

        converted.push({
          id: `${toolCallId}:tool`,
          role: "tool",
          content: resultContent,
          toolCallId,
          ...(part.isError ? { error: resultContent } : {}),
        });
      }
      continue;
    }

    // B. Tool (Standalone)
    if (role === "tool") {
      const toolCallId = (message as any).toolCallId ?? generateId();
      converted.push({
        id: message.id,
        role: "tool",
        content: typeof finalContent === "string" ? finalContent : JSON.stringify(finalContent),
        toolCallId,
        ...(typeof (message as any).error === "string"
          ? { error: (message as any).error }
          : undefined),
      });
      continue;
    }

    // C. User / System
    converted.push({
      id: message.id,
      role: role as "user" | "system",
      content: finalContent, // Can be string or Array<Input>
      ...(message.name ? { name: message.name } : {}),
      ...(role === "user" && message.attachments?.length
        ? {
            attachmentsMeta: message.attachments.map((attachment: any) => ({
              id: attachment.id,
              name: attachment.name,
              contentType: attachment.contentType,
              type: attachment.type,
            })),
          }
        : {}),
    });
  }

  return converted;
};

export const toAgUiTools = (tools: Record<string, any> | undefined) => {
  if (!tools) return [];

  return Object.entries(tools)
    .filter(([, tool]) => !tool?.disabled && tool?.type !== "backend")
    .map(([name, tool]) => ({
      name,
      description: tool?.description ?? undefined,
      parameters:
        typeof tool?.parameters?.toJSON === "function"
          ? tool.parameters.toJSON()
          : typeof tool?.parameters?.toJSONSchema === "function"
            ? tool.parameters.toJSONSchema()
            : tool?.parameters,
    }));
};
