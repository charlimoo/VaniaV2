import React from "react";
import { Font, StyleSheet, Text, View } from "@react-pdf/renderer";

let isRegistered = false;

export function registerPersianPdfFont() {
  if (isRegistered) return;
  Font.register({
    family: "Estedad",
    fonts: [
      { src: "/fonts/Estedad-Medium.ttf", fontWeight: "normal" },
      { src: "/fonts/Estedad-Bold.ttf", fontWeight: "bold" },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  isRegistered = true;
}

export function normalizePdfText(input: unknown): string {
  return String(input ?? "")
    .normalize("NFC")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/ة/g, "ه")
    .replace(/[\u200B\u200D\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export function formatPdfDate(value?: string | number | Date | null): string {
  if (!value) return "ثبت نشده";
  if (typeof value === "string" && value.includes("/")) return normalizePdfText(value);
  try {
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return normalizePdfText(value);
    return parsed.toLocaleDateString("fa-IR");
  } catch {
    return normalizePdfText(value);
  }
}

export function toTextList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => normalizePdfText(item)).filter(Boolean);
  }
  const text = normalizePdfText(value);
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((item) => item.replace(/^[-•\d.\s]+/, "").trim())
    .filter(Boolean);
}

export const pdfStyles = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 42,
    paddingHorizontal: 34,
    fontFamily: "Estedad",
    fontSize: 10,
    lineHeight: 1.75,
    color: "#1f2937",
    backgroundColor: "#ffffff",
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    paddingBottom: 10,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "right",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 9,
    color: "#6b7280",
    textAlign: "right",
  },
  section: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 5,
    padding: 10,
  },
  sectionTitle: {
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    fontSize: 12,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "right",
  },
  field: {
    marginBottom: 7,
  },
  label: {
    marginBottom: 2,
    fontSize: 8,
    fontWeight: "bold",
    color: "#6b7280",
    textAlign: "right",
  },
  value: {
    fontSize: 10,
    color: "#1f2937",
    textAlign: "right",
  },
  muted: {
    fontSize: 9,
    color: "#6b7280",
    textAlign: "right",
  },
  listItem: {
    marginBottom: 5,
    paddingRight: 8,
    borderRightWidth: 2,
    borderRightColor: "#e5e7eb",
  },
  listText: {
    fontSize: 10,
    color: "#1f2937",
    textAlign: "right",
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 34,
    right: 34,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    fontSize: 8,
    color: "#9ca3af",
    textAlign: "center",
  },
} as any);

export function PdfHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={pdfStyles.header}>
      <Text style={pdfStyles.title}>{normalizePdfText(title)}</Text>
      {subtitle ? <Text style={pdfStyles.subtitle}>{normalizePdfText(subtitle)}</Text> : null}
    </View>
  );
}

export function PdfSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={pdfStyles.section}>
      <Text style={pdfStyles.sectionTitle}>{normalizePdfText(title)}</Text>
      {children}
    </View>
  );
}

export function PdfField({ label, value }: { label: string; value?: unknown }) {
  const text = normalizePdfText(value) || "ثبت نشده";
  return (
    <View style={pdfStyles.field}>
      <Text style={pdfStyles.label}>{normalizePdfText(label)}</Text>
      <Text style={pdfStyles.value}>{text}</Text>
    </View>
  );
}

export function PdfList({ items, emptyText = "موردی ثبت نشده است." }: { items?: unknown[]; emptyText?: string }) {
  const list = (items || []).map((item) => normalizePdfText(item)).filter(Boolean);
  if (list.length === 0) {
    return <Text style={pdfStyles.muted}>{normalizePdfText(emptyText)}</Text>;
  }
  return (
    <View>
      {list.map((item, index) => (
        <View key={`${index}-${item}`} style={pdfStyles.listItem}>
          <Text style={pdfStyles.listText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export function PdfFooter() {
  return (
    <Text style={pdfStyles.footer} fixed>
      این سند در تاریخ {new Date().toLocaleDateString("fa-IR")} توسط وانیا آپ تولید شده است.
    </Text>
  );
}
