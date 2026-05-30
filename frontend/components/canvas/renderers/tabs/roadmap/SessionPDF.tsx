import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { normalizeFlashcards } from "@/lib/flashcards";
import {
  formatPdfDate,
  normalizePdfText,
  PdfField,
  PdfFooter,
  PdfHeader,
  PdfList,
  PdfSection,
  pdfStyles,
  registerPersianPdfFont,
  toTextList,
} from "../pdf/PersianPdf";

registerPersianPdfFont();

type SwotData = {
  Strengths?: unknown[];
  Weaknesses?: unknown[];
  Opportunities?: unknown[];
  Threats?: unknown[];
};

interface Props {
  data: any;
  patientName: string;
  doctorName?: string;
}

const hasItems = (items: unknown[]) => toTextList(items).length > 0;

function SwotSection({ swot }: { swot?: SwotData | null }) {
  const groups = [
    { title: "نقاط قوت", items: swot?.Strengths || [] },
    { title: "نقاط ضعف", items: swot?.Weaknesses || [] },
    { title: "فرصت‌ها", items: swot?.Opportunities || [] },
    { title: "تهدیدها", items: swot?.Threats || [] },
  ];

  if (!groups.some((group) => hasItems(group.items))) return null;

  return (
    <PdfSection title="تحلیل SWOT">
      {groups.map((group) => (
        <View key={group.title} style={{ marginBottom: 8 }}>
          <Text style={pdfStyles.label}>{group.title}</Text>
          <PdfList items={toTextList(group.items)} />
        </View>
      ))}
    </PdfSection>
  );
}

export const SessionPDF = ({ data, patientName, doctorName = "" }: Props) => {
  const flashcards = normalizeFlashcards(data?.flashcards || []);
  const smartGoals = toTextList(data?.smart_goals);
  const approaches = Array.isArray(data?.approaches_used)
    ? data.approaches_used.join("، ")
    : data?.approaches_used;
  const summary =
    data?.symptoms_analysis ||
    data?.summary ||
    data?.clinical_summary ||
    data?.content ||
    "";

  return (
    <Document title={`گزارش جلسه ${normalizePdfText(data?.session_number || "")}`}>
      <Page size="A4" style={pdfStyles.page}>
        <PdfHeader
          title="گزارش جلسه"
          subtitle={`مراجع: ${normalizePdfText(patientName) || "ثبت نشده"}`}
        />

        <PdfSection title="مشخصات">
          <PdfField label="مراجع" value={patientName} />
          {doctorName ? <PdfField label="متخصص" value={doctorName} /> : null}
          <PdfField label="شماره جلسه" value={data?.session_number} />
          <PdfField label="تاریخ" value={formatPdfDate(data?.date || data?.scheduled_date)} />
          <PdfField label="عنوان یا موضوع" value={data?.topic || data?.title} />
        </PdfSection>

        <PdfSection title="خلاصه و تحلیل جلسه">
          <PdfField label="خلاصه قابل مشاهده برای مراجع" value={summary} />
          {approaches ? <PdfField label="رویکردهای استفاده‌شده" value={approaches} /> : null}
        </PdfSection>

        <SwotSection swot={data?.swot_analysis} />

        {smartGoals.length > 0 ? (
          <PdfSection title="اهداف جلسه">
            <PdfList items={smartGoals} />
          </PdfSection>
        ) : null}

        <PdfSection title="فلش‌کارت‌ها و یادآوری‌ها">
          {flashcards.length === 0 ? (
            <Text style={pdfStyles.muted}>فلش‌کارتی ثبت نشده است.</Text>
          ) : (
            flashcards.map((card, index) => (
              <View key={`${index}-${card.title}`} style={{ marginBottom: 9 }}>
                <Text style={pdfStyles.label}>{normalizePdfText(card.title) || `یادآوری ${index + 1}`}</Text>
                <Text style={pdfStyles.value}>{normalizePdfText(card.content) || "بدون توضیح"}</Text>
              </View>
            ))
          )}
        </PdfSection>

        <PdfFooter />
      </Page>
    </Document>
  );
};
