// start of frontend/lib/SimpleThreadAdapters.ts
import { ThreadMessage, AttachmentAdapter, PendingAttachment, CompleteAttachment } from "@assistant-ui/react";
import { APP_CONFIG } from "@/lib/config";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";

const tryParseJSON = (value: any) => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'object') return value;
  
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === 'string') {
        try { return JSON.parse(parsed); } catch { return parsed; }
    }
    return parsed;
  } catch {
    return value;
  }
};

const generateStableId = (content: string, role: string, index: number, timestamp?: string | number) => {
  const safeContent = content || "";
  const safeTs = timestamp || "";
  const str = `${safeContent}-${role}-${index}-${safeTs}`;
  
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `msg-${Math.abs(hash)}`;
};

const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const MAX_WIDTH = 800;
        const scaleSize = MAX_WIDTH / img.width;
        if (scaleSize < 1) {
            canvas.width = MAX_WIDTH;
            canvas.height = img.height * scaleSize;
        } else {
            canvas.width = img.width;
            canvas.height = img.height;
        }
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

const normalizeId = (id: string | undefined) => {
  if (!id) return "";
  return id.replace(/^call_/, "");
};

const cleanContent = (text: string) => {
  if (!text) return "";
  return text
    .replace(/<additional context>[\s\S]*?<\/additional context>/gi, "")
    .replace(/additional context>[\s\S]*?<<\/additional context>/gi, "")
    .replace(/<additional_context>[\s\S]*?<\/additional_context>/gi, "")
    .trim();
};

export const simpleAttachmentAdapter: AttachmentAdapter = {
  accept: "image/*",
  
  async add({ file }: { file: File }): Promise<PendingAttachment> {
    if (!file.type.startsWith("image/")) {
       throw new Error("Only image files are allowed.");
    }

    return {
      id: crypto.randomUUID(),
      file, 
      type: "image", 
      name: file.name,
      contentType: file.type, 
      status: { type: "requires-action", reason: "composer-send" }, 
      content: [{ type: "image", image: URL.createObjectURL(file) }]
    };
  },
  
  async send(attachment: PendingAttachment): Promise<CompleteAttachment> {
    try {
        const base64 = await compressImage(attachment.file);

        return { 
            ...attachment, 
            status: { type: "complete" }, 
            content: [{ 
                type: "image", 
                image: base64,
            }] 
        };
    } catch (e) {
        console.error("Image processing failed", e);
        return { ...attachment, status: { type: "complete" }, content: [] };
    }
  },
  async remove() {},
};

export interface ThreadMetadata {
  threadId: string;
  id: string;
  title: string;
  status: string;
  createdAt: number;
  isLocal: boolean;
  agentId: string;
}

export const threadManager = {
  listThreads: async (token: string, agentId?: string, page = 1, limit = 50): Promise<any[]> => {
    try {
      const res = await fetch(`${API_BASE_URL}/agent/sessions?limit=${limit}&page=${page}`, {
        headers: getAuthHeaders()
      });
      
      if (res.status === 401) throw new Error("UNAUTHORIZED");
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      
      const data = await res.json();
      const sessions = Array.isArray(data) ? data : (data.data || []);
      
      const threads = sessions.map((t: any) => ({
        threadId: t.session_id, 
        id: t.session_id,
        title: t.session_name || APP_CONFIG.TEXT.NEW_THREAD_TITLE,
        status: "regular",
        createdAt: t.created_at,
        isLocal: false,
        agentId: t.agent_id
      }));

      if (agentId) {
         return threads.filter((t: any) => t.agentId === agentId);
      }
      return threads;

    } catch (e: any) {
      if (e.message === "UNAUTHORIZED") throw e;
      console.error("[Adapter] Error listing sessions:", e);
      return [];
    }
  },

  getMessages: async (threadId: string, token: string): Promise<{ messages: ThreadMessage[], title?: string }> => {
    if (!threadId || threadId === "main") return { messages: [] };

    try {
      const res = await fetch(`${API_BASE_URL}/agent/sessions/${threadId}`, {
        headers: getAuthHeaders()
      });

      if (res.status === 404) return { messages: [], title: APP_CONFIG.TEXT.NEW_THREAD_TITLE };
      if (res.status === 401) throw new Error("UNAUTHORIZED");
      if (!res.ok) return { messages: [] };
      
      const data = await res.json();
      const rawHistory = data.chat_history || [];
      const title = data.session_name || APP_CONFIG.TEXT.NEW_THREAD_TITLE;
      
      rawHistory.sort((a: any, b: any) => (a.created_at || 0) - (b.created_at || 0));

      const messages: ThreadMessage[] = [];
      const toolCallResults = new Map<string, any>(); 

      // --- PASS 1: Collect Tool Results ---
      rawHistory.forEach((msg: any) => {
        if ((msg.role === "tool" || msg.role === "function") && msg.tool_call_id) {
            const parsedContent = tryParseJSON(msg.content);
            toolCallResults.set(normalizeId(msg.tool_call_id), parsedContent);
        }
      });

      // --- PASS 2: Build Message Objects ---
      let currentAssistantMessage: any = null;

      rawHistory.forEach((msg: any, index: number) => {
        const role = (msg.role === "model" ? "assistant" : msg.role);
        
        if (role === "system" || role === "tool" || role === "function") return; 

        const createdAt = msg.created_at ? new Date(msg.created_at * 1000) : new Date();
        const id = generateStableId(msg.content || "empty", role, index, msg.created_at);

        if (role === "user") {
            if (currentAssistantMessage) {
                messages.push(currentAssistantMessage);
                currentAssistantMessage = null;
            }

            const cleanedText = cleanContent(msg.content || "");

            messages.push({
                id,
                role: "user",
                content: [{ type: "text", text: cleanedText }],
                createdAt,
                attachments: [],
                metadata: { custom: {} }
            });
        } 
        else if (role === "assistant") {
            const parts: any[] = [];
            
            if (msg.content) {
                parts.push({ type: "text", text: msg.content });
            }

            if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
                for (const tc of msg.tool_calls) {
                    const rawId = tc.id || tc.tool_call_id;
                    const normalizedId = normalizeId(rawId);
                    
                    let argsText = "{}";
                    let args = {};

                    if (typeof tc.function?.arguments === 'string') {
                        argsText = tc.function.arguments;
                        try { args = JSON.parse(argsText); } catch {} 
                    } else if (tc.function?.arguments) {
                        args = tc.function.arguments; 
                        argsText = JSON.stringify(args);
                    }

                    const result = toolCallResults.get(normalizedId);

                    parts.push({
                        type: "tool-call",
                        toolCallId: rawId,
                        toolCallName: tc.function?.name || tc.tool_name,
                        toolName: tc.function?.name || tc.tool_name, 
                        argsText,
                        args,
                        result: result 
                    });
                }
            }

            if (currentAssistantMessage) {
                currentAssistantMessage.content.push(...parts);
            } else {
                currentAssistantMessage = {
                    id,
                    role: "assistant",
                    content: parts,
                    status: { type: "complete", reason: "unknown" },
                    createdAt,
                    metadata: { steps: [], unstable_annotations: [], unstable_data: [], unstable_state: null, custom: {} }
                };
            }
        }
      });

      if (currentAssistantMessage) {
          messages.push(currentAssistantMessage);
      }

      return { messages, title };
      
    } catch (e: any) {
      if (e.message === "UNAUTHORIZED") throw e;
      console.error("[Adapter] Fetch Error:", e);
      return { messages: [] };
    }
  },

  getThreadMetadata: async (threadId: string, token: string): Promise<{ title: string | null }> => {
    try {
      const res = await fetch(`${API_BASE_URL}/agent/sessions/${threadId}`, {
        headers: getAuthHeaders()
      });

      if (!res.ok) return { title: null };
      
      const data = await res.json();
      return { title: data.session_name };
    } catch (e) {
      console.error("[Adapter] Metadata fetch error:", e);
      return { title: null };
    }
  },
  
  createThreadOnBackend: async (
      threadId: string, 
      initialTitle: string | undefined, 
      agentId: string, 
      token: string, 
      patientId?: number | null // [NEW] Added optional patientId
  ) => {
    try {
      const payload = {
          session_id: threadId, 
          session_name: initialTitle || "New Conversation",
          session_state: { 
              agent_id: agentId,
              // [FIX] Save patient_id to session metadata for persistence
              ...(patientId ? { patient_id: patientId } : {})
          }
      };

      const headers: Record<string, string> = {
          ...getAuthHeaders(),
          "Content-Type": "application/json"
      };

      // [FIX] Send Header as well
      if (patientId) {
          headers["X-Target-Resource-ID"] = patientId.toString();
      }

      const res = await fetch(`${API_BASE_URL}/agent/sessions`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
          const errText = await res.text();
          console.error(`[Adapter] Create thread failed: ${res.status} ${errText}`);
      }
    } catch (e) {
      console.error("Failed to create on backend", e);
    }
  },

  rename: async (threadId: string, newTitle: string, token: string) => {
    if (!threadId) return; 
    await fetch(`${API_BASE_URL}/agent/sessions/${threadId}`, { 
        method: "PATCH",
        headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ session_name: newTitle }),
    }).catch(console.error);
  },

  delete: async (threadId: string, token: string) => {
    if (!threadId) return;
    try {
        const res = await fetch(`${API_BASE_URL}/agent/sessions/${threadId}`, { 
            method: "DELETE",
            headers: getAuthHeaders()
        });
        if (!res.ok) console.error(`Delete failed: ${res.status}`);
    } catch (e) {
        console.error("Delete error:", e);
    }
  }
};
// end of frontend/lib/SimpleThreadAdapters.ts