import React from "react";
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import { ThoughtAppendix } from "@/lib/types/vania";

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

const TYPE_LABEL: Record<string, string> = {
  BOOK: "کتاب",
  MOVIE: "فیلم",
  POEM: "شعر",
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
    borderBottomColor: "#1d4ed8",
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
    marginTop: 2,
    textAlign: "right",
  },
  resource: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 6,
    padding: 10,
    marginBottom: 10,
  },
  resourceTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#0f172a",
    textAlign: "right",
    marginBottom: 3,
  },
  resourceMeta: {
    fontSize: 9,
    color: "#475569",
    textAlign: "right",
    marginBottom: 4,
  },
  text: {
    textAlign: "right",
    color: "#334155",
    marginBottom: 3,
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
  library: ThoughtAppendix;
  patientId: number;
}

export const AppendixPDF = ({ library, patientId }: Props) => {
  const resources = library?.resources || [];

  return (
    <Document title={`Appendix_${patientId}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>گزارش پیوست اندیشه</Text>
          <Text style={styles.meta}>
            <Text style={styles.label}>پرونده:</Text> {patientId} | <Text style={styles.label}>تعداد منابع:</Text> {resources.length}
          </Text>
        </View>

        {resources.length === 0 ? (
          <View style={styles.resource}>
            <Text style={styles.text}>— منبعی ثبت نشده است —</Text>
          </View>
        ) : (
          resources.map((res) => (
            <View key={res.id} style={styles.resource}>
              <Text style={styles.resourceTitle}>{normalizePersianText(res.title)}</Text>
              <Text style={styles.resourceMeta}>
                نوع: {TYPE_LABEL[res.type] || normalizePersianText(res.type)} | پدیدآورنده: {normalizePersianText(res.creator)}
              </Text>
              {!!res.content_excerpt && (
                <Text style={styles.text}>
                  <Text style={styles.label}>بخشی از اثر:</Text> {normalizePersianText(res.content_excerpt)}
                </Text>
              )}
              <Text style={styles.text}>
                <Text style={styles.label}>دلیل تجویز:</Text> {normalizePersianText(res.reason_for_prescription)}
              </Text>
            </View>
          ))
        )}

        <Text style={styles.footer} fixed>
          این سند در تاریخ {new Date().toLocaleDateString("fa-IR")} تولید شده است.
        </Text>
      </Page>
    </Document>
  );
};

