import React from "react";
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import { RescueTask } from "@/lib/types/vania";

Font.register({
  family: "Estedad",
  fonts: [
    { src: "/fonts/Estedad-Medium.ttf" },
    { src: "/fonts/Estedad-Bold.ttf", fontWeight: "bold" },
  ],
});

const normalizePersianText = (input: any): string => {
  const raw = String(input ?? "");
  return raw
    .normalize("NFC")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/ة/g, "ه")
    .replace(/[\u200B\u200D\u200E\u200F\u2066-\u2069\uFEFF]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
};

const toFaDate = (value?: string) => {
  if (!value) return "-";
  if (value.includes("/")) return value;
  try {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString("fa-IR");
  } catch {
    return value;
  }
};

const DIMENSION_LABELS: Record<string, string> = {
  PERSONAL: "رشد شخصی",
  EMOTIONAL: "رشد عاطفی",
  RELATIONSHIP: "ارتباط سودمند",
  FRIENDSHIP: "ارتباط با دوستان",
  CAREER: "شغلی-تحصیلی",
  INTELLECTUAL: "رشد فکری",
  ENVIRONMENT: "رشد محیطی",
  RECREATION: "تفریحی-ورزشی",
  SOLITUDE: "مدیریت تنهایی",
};

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontFamily: "Estedad",
    fontSize: 10,
    lineHeight: 1.6,
    backgroundColor: "#ffffff",
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: "#2563eb",
    paddingBottom: 10,
    marginBottom: 16,
    alignItems: "flex-end",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1e3a8a",
    textAlign: "right",
  },
  meta: {
    fontSize: 9,
    color: "#475569",
    textAlign: "right",
    marginTop: 2,
  },
  section: {
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 6,
    padding: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#0f172a",
    textAlign: "right",
    marginBottom: 6,
  },
  taskRow: {
    marginBottom: 4,
    textAlign: "right",
    color: "#334155",
  },
  label: {
    fontWeight: "bold",
  },
  footer: {
    position: "absolute",
    bottom: 16,
    left: 32,
    right: 32,
    textAlign: "center",
    color: "#94a3b8",
    fontSize: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 6,
  },
});

interface Props {
  tasks: RescueTask[];
  patientId: number;
}

export const RescueNetPDF = ({ tasks, patientId }: Props) => {
  const grouped = Object.keys(DIMENSION_LABELS).map((key) => ({
    key,
    label: DIMENSION_LABELS[key],
    items: (tasks || []).filter((t) => t.dimension === key),
  }));

  const total = (tasks || []).length;
  const done = (tasks || []).filter((t) => t.status === "DONE").length;

  return (
    <Document title={`RescueNet_${patientId}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>گزارش تور نجات</Text>
          <Text style={styles.meta}>
            <Text style={styles.label}>پرونده:</Text> {patientId} | <Text style={styles.label}>تعداد تکالیف:</Text> {total} |{" "}
            <Text style={styles.label}>انجام شده:</Text> {done}
          </Text>
        </View>

        {grouped.map((group) => (
          <View key={group.key} style={styles.section}>
            <Text style={styles.sectionTitle}>{normalizePersianText(group.label)}</Text>
            {group.items.length === 0 ? (
              <Text style={styles.taskRow}>— موردی ثبت نشده —</Text>
            ) : (
              group.items.map((task, idx) => (
                <Text key={task.id} style={styles.taskRow}>
                  {idx + 1}. {normalizePersianText(task.text)} | وضعیت:{" "}
                  {task.status === "DONE" ? "انجام شده" : "در انتظار"} | موعد: {normalizePersianText(toFaDate(task.due_date))}
                </Text>
              ))
            )}
          </View>
        ))}

        <Text style={styles.footer} fixed>
          این سند در تاریخ {new Date().toLocaleDateString("fa-IR")} تولید شده است.
        </Text>
      </Page>
    </Document>
  );
};
