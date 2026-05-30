import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { RescueTask } from "@/lib/types/vania";
import {
  formatPdfDate,
  normalizePdfText,
  PdfField,
  PdfFooter,
  PdfHeader,
  PdfSection,
  pdfStyles,
  registerPersianPdfFont,
} from "../pdf/PersianPdf";

registerPersianPdfFont();

const DIMENSION_LABELS: Record<string, string> = {
  PERSONAL: "رشد شخصی",
  EMOTIONAL: "رشد عاطفی",
  RELATIONSHIP: "ارتباط سودمند",
  FRIENDSHIP: "ارتباط با دوستان",
  CAREER: "شغلی و تحصیلی",
  INTELLECTUAL: "رشد فکری",
  ENVIRONMENT: "رشد محیطی",
  RECREATION: "تفریحی و ورزشی",
  SOLITUDE: "مدیریت تنهایی",
};

interface Props {
  tasks: RescueTask[];
  patientId: number;
  patientName?: string;
  caseTitle?: string;
}

export const RescueNetPDF = ({ tasks, patientId, patientName, caseTitle }: Props) => {
  const normalizedTasks = tasks || [];
  const total = normalizedTasks.length;
  const done = normalizedTasks.filter((task) => task.status === "DONE").length;
  const grouped = Object.keys(DIMENSION_LABELS)
    .map((key) => ({
      key,
      label: DIMENSION_LABELS[key],
      items: normalizedTasks.filter((task) => task.dimension === key),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <Document title={`گزارش تور نجات ${patientId}`}>
      <Page size="A4" style={pdfStyles.page}>
        <PdfHeader
          title="گزارش تور نجات"
          subtitle={`مراجع: ${normalizePdfText(patientName) || patientId}`}
        />

        <PdfSection title="خلاصه">
          <PdfField label="مراجع" value={patientName || patientId} />
          {caseTitle ? <PdfField label="پرونده" value={caseTitle} /> : null}
          <PdfField label="تعداد کل تکالیف" value={total.toLocaleString("fa-IR")} />
          <PdfField label="تکالیف انجام‌شده" value={done.toLocaleString("fa-IR")} />
          <PdfField label="تکالیف باقی‌مانده" value={(total - done).toLocaleString("fa-IR")} />
        </PdfSection>

        {grouped.length === 0 ? (
          <PdfSection title="تکالیف">
            <Text style={pdfStyles.muted}>هنوز تکلیفی ثبت نشده است.</Text>
          </PdfSection>
        ) : (
          grouped.map((group) => (
            <PdfSection key={group.key} title={group.label}>
              {group.items.map((task, index) => (
                <View key={task.id || `${group.key}-${index}`} style={pdfStyles.listItem}>
                  <Text style={pdfStyles.listText}>{normalizePdfText(task.text) || "بدون عنوان"}</Text>
                  <Text style={pdfStyles.muted}>
                    وضعیت: {task.status === "DONE" ? "انجام شده" : "در انتظار"}
                  </Text>
                  <Text style={pdfStyles.muted}>موعد: {formatPdfDate(task.due_date)}</Text>
                  {task.doctor_name ? <Text style={pdfStyles.muted}>متخصص: {normalizePdfText(task.doctor_name)}</Text> : null}
                </View>
              ))}
            </PdfSection>
          ))
        )}

        <PdfFooter />
      </Page>
    </Document>
  );
};
