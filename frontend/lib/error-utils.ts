function collectErrorMessages(payload: unknown): string[] {
  if (!payload) {
    return []
  }

  if (typeof payload === "string") {
    return payload.trim() ? [payload.trim()] : []
  }

  if (Array.isArray(payload)) {
    return payload.flatMap((item) => collectErrorMessages(item))
  }

  if (typeof payload === "object") {
    const record = payload as Record<string, unknown>

    for (const key of ["detail", "error", "message"]) {
      const direct = record[key]
      if (direct) {
        const nested = collectErrorMessages(direct)
        if (nested.length > 0) {
          return nested
        }
      }
    }

    return Object.values(record).flatMap((value) => collectErrorMessages(value))
  }

  return []
}

export function extractErrorMessage(payload: unknown, fallback: string): string {
  const messages = collectErrorMessages(payload)
  return messages.length > 0 ? messages.join(" ") : fallback
}
