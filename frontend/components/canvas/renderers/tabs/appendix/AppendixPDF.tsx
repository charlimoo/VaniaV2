import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { ThoughtAppendix } from "@/lib/types/vania";
import {
  normalizePdfText,
  PdfField,
  PdfFooter,
  PdfHeader,
  PdfSection,
  pdfStyles,
  registerPersianPdfFont,
} from "../pdf/PersianPdf";

registerPersianPdfFont();

const TYPE_LABEL: Record<string, string> = {
  BOOK: "کتاب",
  MOVIE: "فیلم",
  POEM: "شعر",
};

interface Props {
  library: ThoughtAppendix;
  patientId: number;
  patientName?: string;
  caseTitle?: string;
}

export const AppendixPDF = ({ library, patientId, patientName, caseTitle }: Props) => {
  const resources = library?.resources || [];

  return (
    <Document title={`گزارش پیوست اندیشه ${patientId}`}>
      <Page size="A4" style={pdfStyles.page}>
        <PdfHeader
          title="گزارش پیوست اندیشه"
          subtitle={`مراجع: ${normalizePdfText(patientName) || patientId}`}
        />

        <PdfSection title="خلاصه">
          <PdfField label="مراجع" value={patientName || patientId} />
          {caseTitle ? <PdfField label="پرونده" value={caseTitle} /> : null}
          <PdfField label="تعداد منابع" value={resources.length.toLocaleString("fa-IR")} />
        </PdfSection>

        {resources.length === 0 ? (
          <PdfSection title="منابع">
            <Text style={pdfStyles.muted}>هنوز منبعی ثبت نشده است.</Text>
          </PdfSection>
        ) : (
          resources.map((resource, index) => (
            <PdfSection key={resource.id || `${resource.title}-${index}`} title={resource.title || `منبع ${index + 1}`}>
              <PdfField label="نوع" value={TYPE_LABEL[resource.type] || resource.type} />
              <PdfField label="پدیدآورنده" value={resource.creator} />
              {resource.content_excerpt ? <PdfField label="بخشی از اثر" value={resource.content_excerpt} /> : null}
              <PdfField label="دلیل پیشنهاد" value={resource.reason_for_prescription} />
              <PdfField label="وضعیت" value={resource.status === "CONSUMED" ? "مطالعه یا مشاهده شده" : "پیشنهاد شده"} />
            </PdfSection>
          ))
        )}

        <PdfFooter />
      </Page>
    </Document>
  );
};
