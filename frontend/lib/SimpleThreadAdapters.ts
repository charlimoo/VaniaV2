import { ThreadMessage, AttachmentAdapter, PendingAttachment, CompleteAttachment, Attachment } from "@assistant-ui/react";
import { APP_CONFIG } from "@/lib/config";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";

export const COMPOSER_ATTACHMENT_MAX_FILES = 5;
export const COMPOSER_ATTACHMENT_ACCEPT = "image/*,.pdf,application/pdf";

const tryParseJSON = (value: any) => {
  if (value === undefined || value === null) return null;
  if (typeof value === "object") return value;

  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === "string") {
      try {
        return JSON.parse(parsed);
      } catch {
        return parsed;
      }
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
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

const getFileExtension = (file: File) => {
  const match = /\.([^.]+)$/.exec(file.name);
  return match?.[1]?.toLowerCase() ?? "";
};

const isPdfFile = (file: File) => file.type === "application/pdf" || getFileExtension(file) === "pdf";

export const isSupportedComposerAttachment = (file: File) => file.type.startsWith("image/") || isPdfFile(file);

const getAttachmentType = (file: File): PendingAttachment["type"] => (file.type.startsWith("image/") ? "image" : "file");

type PreparedAttachmentData = {
  id: string;
  type: PendingAttachment["type"];
  name: string;
  contentType: string;
  imageBase64?: string;
  previewUrl?: string;
  processedOnServer: boolean;
};

const normalizeId = (id: string | undefined) => {
  if (!id) return "";
  return id.replace(/^call_/, "");
};

const cleanContent = (text: string) => {
  if (!text) return "";
  const currentUserMatch = text.match(/<current_user_message>\s*([\s\S]*?)\s*<\/current_user_message>/i);
  if (text.includes("<active_branch_history>") && currentUserMatch?.[1]) {
    return currentUserMatch[1].trim();
  }

  return text
    .replace(/<additional context>[\s\S]*?<\/additional context>/gi, "")
    .replace(/additional context>[\s\S]*?<<\/additional context>/gi, "")
    .replace(/<additional_context>[\s\S]*?<\/additional_context>/gi, "")
    .replace(/<active_branch_history>[\s\S]*?<\/active_branch_history>/gi, "")
    .trim();
};

const buildHistoryAttachments = (attachments: any[] | undefined) => {
  if (!Array.isArray(attachments) || attachments.length === 0) return [];

  return attachments.map((attachment: any, index: number) => ({
    id: attachment.id || `history-attachment-${index}-${attachment.name || "file"}`,
    type: (attachment.type === "image" ? "image" : "file") as "image" | "file",
    name: attachment.name || "file",
    contentType: attachment.contentType || attachment.content_type || "application/octet-stream",
    status: { type: "complete" as const },
    content:
      attachment.type === "image" && attachment.preview_image
        ? [{ type: "image" as const, image: attachment.preview_image }]
        : [],
  }));
};

export const createSimpleAttachmentAdapter = ({
  threadId,
  agentId,
  ensureThread,
}: {
  threadId: string;
  agentId: string;
  ensureThread: () => Promise<void>;
}): AttachmentAdapter => {
  const preparedAttachments = new Map<string, PreparedAttachmentData>();

  return {
    accept: COMPOSER_ATTACHMENT_ACCEPT,

    async *add({ file }: { file: File }): AsyncGenerator<PendingAttachment, void> {
      if (!isSupportedComposerAttachment(file)) {
        throw new Error("Only image and PDF files are allowed.");
      }

      const id = crypto.randomUUID();
      const type = getAttachmentType(file);
      const contentType = file.type || "application/octet-stream";
      const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;

      let pendingAttachment: PendingAttachment = {
        id,
        file,
        type,
        name: file.name,
        contentType,
        status: { type: "running", reason: "uploading", progress: 5 },
        content: previewUrl ? [{ type: "image", image: previewUrl }] : [],
      };
      yield pendingAttachment;

      try {
        if (file.type.startsWith("image/")) {
          pendingAttachment = { ...pendingAttachment, status: { type: "running", reason: "uploading", progress: 45 } };
          yield pendingAttachment;

          const imageBase64 = await compressImage(file);
          preparedAttachments.set(id, {
            id,
            type,
            name: file.name,
            contentType,
            imageBase64,
            previewUrl,
            processedOnServer: false,
          });
        } else {
          pendingAttachment = { ...pendingAttachment, status: { type: "running", reason: "uploading", progress: 15 } };
          yield pendingAttachment;

          await ensureThread();

          pendingAttachment = { ...pendingAttachment, status: { type: "running", reason: "uploading", progress: 55 } };
          yield pendingAttachment;

          const formData = new FormData();
          formData.append("thread_id", threadId);
          formData.append("agent_id", agentId);
          formData.append("attachment_id", id);
          formData.append("file", file);

          const response = await fetch(`${API_BASE_URL}/agent/attachments/prepare`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: formData,
          });

          if (!response.ok) {
            const body = await response.json().catch(() => null);
            throw new Error(
              body?.detail || body?.error || "آماده‌سازی فایل PDF انجام نشد.",
            );
          }

          preparedAttachments.set(id, {
            id,
            type,
            name: file.name,
            contentType,
            processedOnServer: true,
          });
        }

        pendingAttachment = {
          ...pendingAttachment,
          status: { type: "requires-action", reason: "composer-send" },
        };
        yield pendingAttachment;
      } catch (e) {
        console.error("Attachment preparation failed", e);
        pendingAttachment = {
          ...pendingAttachment,
          status: { type: "incomplete", reason: "error" },
        };
        yield pendingAttachment;
      }
    },

    async send(attachment: PendingAttachment): Promise<CompleteAttachment> {
      const prepared = preparedAttachments.get(attachment.id);
      if (!prepared) {
        throw new Error("Attachment not prepared");
      }

      preparedAttachments.delete(attachment.id);

      if (prepared.type === "image" && prepared.imageBase64) {
        if (prepared.previewUrl) {
          URL.revokeObjectURL(prepared.previewUrl);
        }
        return {
          ...attachment,
          file: undefined,
          status: { type: "complete" },
          content: [{ type: "image", image: prepared.imageBase64 }],
        };
      }

      return {
        ...attachment,
        file: undefined,
        status: { type: "complete" },
        content: [],
      };
    },

    async remove(attachment: Attachment) {
      const prepared = preparedAttachments.get(attachment.id);
      const image = attachment.content?.find((part) => part.type === "image");
      const previewUrl =
        prepared?.previewUrl || (image?.type === "image" && image.image.startsWith("blob:") ? image.image : undefined);

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }

      if (prepared?.processedOnServer) {
        await fetch(`${API_BASE_URL}/agent/attachments/${attachment.id}?thread_id=${encodeURIComponent(threadId)}`, {
          method: "DELETE",
          headers: getAuthHeaders(),
        }).catch((error) => {
          console.error("Failed to delete prepared attachment", error);
        });
      }

      preparedAttachments.delete(attachment.id);
    },
  };
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

type SessionContextLabels = {
  patientName?: string | null;
  doctorName?: string | null;
  caseTitle?: string | null;
  caseDoctorName?: string | null;
  caseDoctorProfessionSlug?: string | null;
  caseDoctorProfessionLabel?: string | null;
};

const buildSessionState = ({
  agentId,
  patientId,
  doctorId,
  caseId,
  labels,
}: {
  agentId: string;
  patientId?: number | null;
  doctorId?: number | null;
  caseId?: string | null;
  labels?: SessionContextLabels;
}) => ({
  agent_id: agentId,
  ...(patientId ? { visitor_id: patientId, patient_id: patientId } : {}),
  ...(labels?.patientName ? { visitor_name: labels.patientName, patient_name: labels.patientName } : {}),
  ...(doctorId ? { selected_expert_id: doctorId, selected_doctor_id: doctorId } : {}),
  ...(labels?.doctorName ? { selected_expert_name: labels.doctorName, selected_doctor_name: labels.doctorName } : {}),
  ...(caseId ? { selected_case_id: caseId } : {}),
  ...(labels?.caseTitle ? { selected_case_title: labels.caseTitle } : {}),
  ...(labels?.caseDoctorName ? { selected_case_doctor_name: labels.caseDoctorName } : {}),
  ...(labels?.caseDoctorProfessionSlug ? { selected_case_doctor_profession_slug: labels.caseDoctorProfessionSlug } : {}),
  ...(labels?.caseDoctorProfessionLabel ? { selected_case_doctor_profession_label: labels.caseDoctorProfessionLabel } : {}),
});

export const threadManager = {
  listThreads: async (token: string, agentId?: string, page = 1, limit = 50): Promise<any[]> => {
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        page: String(page),
      });
      if (agentId) {
        params.set("agent_id", agentId);
      }

      const res = await fetch(`${API_BASE_URL}/agent/sessions?${params.toString()}`, {
        headers: getAuthHeaders(),
      });

      if (res.status === 401) throw new Error("UNAUTHORIZED");
      if (!res.ok) throw new Error(`Failed: ${res.status}`);

      const data = await res.json();
      const sessions = Array.isArray(data) ? data : data.data || [];

      const threads = sessions.map((t: any) => ({
        threadId: t.session_id,
        id: t.session_id,
        title: t.session_name || APP_CONFIG.TEXT.NEW_THREAD_TITLE,
        status: "regular",
        createdAt: t.created_at,
        isLocal: false,
        agentId: t.agent_id,
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

  getMessages: async (threadId: string, token: string): Promise<{ messages: ThreadMessage[]; title?: string }> => {
    if (!threadId || threadId === "main") return { messages: [] };

    try {
      const res = await fetch(`${API_BASE_URL}/agent/sessions/${threadId}`, {
        headers: getAuthHeaders(),
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

      rawHistory.forEach((msg: any) => {
        if ((msg.role === "tool" || msg.role === "function") && msg.tool_call_id) {
          const parsedContent = tryParseJSON(msg.content);
          toolCallResults.set(normalizeId(msg.tool_call_id), parsedContent);
        }
      });

      let currentAssistantMessage: any = null;

      rawHistory.forEach((msg: any, index: number) => {
        const role = msg.role === "model" ? "assistant" : msg.role;

        if (role === "system" || role === "tool" || role === "function") return;

        const createdAt = msg.created_at ? new Date(msg.created_at * 1000) : new Date();
        const id = generateStableId(msg.content || "empty", role, index, msg.created_at);

        if (role === "user") {
          if (currentAssistantMessage) {
            messages.push(currentAssistantMessage);
            currentAssistantMessage = null;
          }

          const cleanedText = cleanContent(msg.content || "");
          const historyAttachments = buildHistoryAttachments(msg.attachments);

          messages.push({
            id,
            role: "user",
            content: [{ type: "text", text: cleanedText }],
            createdAt,
            attachments: historyAttachments,
            metadata: { custom: {} },
          });
        } else if (role === "assistant") {
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

              if (typeof tc.function?.arguments === "string") {
                argsText = tc.function.arguments;
                try {
                  args = JSON.parse(argsText);
                } catch {}
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
                result,
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
              metadata: { steps: [], unstable_annotations: [], unstable_data: [], unstable_state: null, custom: {} },
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
        headers: getAuthHeaders(),
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
    patientId?: number | null,
    doctorId?: number | null,
    caseId?: string | null,
    labels?: SessionContextLabels,
  ) => {
    try {
      const payload = {
        session_id: threadId,
        session_name: initialTitle || "New Conversation",
        session_state: buildSessionState({ agentId, patientId, doctorId, caseId, labels }),
      };

      const headers: Record<string, string> = {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      };

      if (patientId) {
        headers["X-Target-Resource-ID"] = patientId.toString();
      }
      if (doctorId) {
        headers["X-Target-Expert-ID"] = doctorId.toString();
        headers["X-Target-Doctor-ID"] = doctorId.toString();
      }
      if (caseId) {
        headers["X-Target-Case-ID"] = caseId;
      }

      const res = await fetch(`${API_BASE_URL}/agent/sessions`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
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
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ session_name: newTitle }),
    }).catch(console.error);
  },

  delete: async (threadId: string, token: string) => {
    if (!threadId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/agent/sessions/${threadId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) console.error(`Delete failed: ${res.status}`);
    } catch (e) {
      console.error("Delete error:", e);
    }
  },
};
