export type NormalizedFlashcard = { title: string; content: string };

const TITLE_KEYS = [
  "title",
  "front",
  "question",
  "heading",
  "name",
  "technique",
  "topic",
  "key_point",
  "keypoint",
  "عنوان",
  "تیتر",
] as const;

const CONTENT_KEYS = [
  "content",
  "back",
  "answer",
  "description",
  "details",
  "body",
  "note",
  "text",
  "توضیح",
  "شرح",
  "متن",
] as const;

function toText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  return "";
}

function pick(obj: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    if (key in obj) {
      const text = toText(obj[key]);
      if (text) return text;
    }
  }
  return "";
}

export function normalizeFlashcards(raw: unknown): NormalizedFlashcard[] {
  if (!Array.isArray(raw)) return [];

  const normalized: NormalizedFlashcard[] = [];
  for (const item of raw) {
    let title = "";
    let content = "";

    if (typeof item === "string") {
      title = item.trim();
    } else if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      title = pick(obj, TITLE_KEYS);
      content = pick(obj, CONTENT_KEYS);

      if (!title && !content) {
        const values = Object.values(obj).map(toText).filter(Boolean);
        if (values.length === 1) title = values[0];
        if (values.length >= 2) {
          title = values[0];
          content = values[1];
        }
      }
    } else {
      title = toText(item);
    }

    if (title || content) normalized.push({ title, content });
  }

  return normalized;
}
