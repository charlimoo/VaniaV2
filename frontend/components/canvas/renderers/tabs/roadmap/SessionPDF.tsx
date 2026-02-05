// frontend/components/canvas/renderers/tabs/roadmap/SessionPDF.tsx
import React from 'react';
import { 
  Document, 
  Page, 
  Text, 
  View, 
  StyleSheet, 
  Font 
} from '@react-pdf/renderer';

// --- 1. Font Registration (CRITICAL for Persian) ---
// This requires the font files to be present in the `public/fonts/` directory.
Font.register({
  family: 'Vazirmatn',
  fonts: [
    { src: '/fonts/Vazirmatn-Regular.ttf' },
    { src: '/fonts/Vazirmatn-Bold.ttf', fontWeight: 'bold' }
  ]
});

// --- 2. Professional StyleSheet ---
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Vazirmatn',
    fontSize: 10,
    lineHeight: 1.6,
    flexDirection: 'column',
    backgroundColor: '#ffffff'
  },
  // --- Header ---
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#1e3a8a',
    paddingBottom: 15,
    marginBottom: 25
  },
  headerBrand: { fontSize: 22, fontWeight: 'bold', color: '#1e3a8a' },
  headerMeta: { fontSize: 9, color: '#475569', textAlign: 'right' },
  // --- Sections ---
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    paddingBottom: 5,
    marginBottom: 10,
    textAlign: 'right'
  },
  text: { textAlign: 'right', color: '#334155', marginBottom: 5 },
  label: { fontWeight: 'bold' },
  // --- SWOT Grid ---
  gridRow: { flexDirection: 'row-reverse', gap: 10, marginBottom: 10 },
  gridCol: { flex: 1, padding: 10, borderRadius: 4, borderWidth: 1 },
  swotS: { backgroundColor: '#f0fdf4', borderColor: '#dcfce7' },
  swotW: { backgroundColor: '#fef2f2', borderColor: '#fee2e2' },
  swotO: { backgroundColor: '#eff6ff', borderColor: '#dbeafe' },
  swotT: { backgroundColor: '#fff7ed', borderColor: '#ffedd5' },
  swotTitle: { fontSize: 10, fontWeight: 'bold', marginBottom: 5, textAlign: 'right' },
  // --- Flashcards ---
  cardContainer: { flexDirection: 'column', gap: 8, marginTop: 5 },
  flashcard: {
    padding: 10,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fef3c7',
    borderRadius: 6
  },
  cardTitle: { fontSize: 10, fontWeight: 'bold', color: '#92400e', marginBottom: 3, textAlign: 'right' },
  // --- Footer ---
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 40,
    right: 40,
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8
  }
});

interface Props {
  data: any; // The structured session report JSON
  patientName: string;
  doctorName?: string;
}

/**
 * Renders a professional, print-ready PDF document for a completed therapy session.
 * It takes the structured JSON from a "Session Support Document" and lays it out
 * in a clinical format, correctly handling RTL text.
 */
export const SessionPDF = ({ data, patientName, doctorName = "متخصص روان‌درمانی" }: Props) => (
  <Document title={`گزارش جلسه ${data.session_number} - ${patientName}`}>
    <Page size="A4" style={styles.page}>
      
      {/* --- HEADER --- */}
      <View style={styles.header}>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.headerBrand}>سند پشتیبان جلسه درمانی</Text>
          <Text style={styles.headerMeta}>سیستم هوشمند وانیا (VCOS)</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.headerMeta}><Text style={styles.label}>مراجع:</Text> {patientName}</Text>
          <Text style={styles.headerMeta}><Text style={styles.label}>درمانگر:</Text> {doctorName}</Text>
          <Text style={styles.headerMeta}><Text style={styles.label}>جلسه:</Text> {data.session_number}  |  <Text style={styles.label}>تاریخ:</Text> {data.date}</Text>
        </View>
      </View>

      {/* --- OVERVIEW SECTION --- */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>خلاصه جلسه</Text>
        <Text style={styles.text}><Text style={styles.label}>موضوع اصلی:</Text> {data.topic}</Text>
        <Text style={styles.text}><Text style={styles.label}>رویکردهای درمانی به کار رفته:</Text> {Array.isArray(data.approaches_used) ? data.approaches_used.join('، ') : data.approaches_used}</Text>
        <Text style={styles.text}><Text style={styles.label}>تحلیل بالینی:</Text> {data.symptoms_analysis}</Text>
      </View>

      {/* --- SWOT ANALYSIS SECTION --- */}
      <View style={{marginBottom: 15}}>
        <Text style={styles.sectionTitle}>تحلیل استراتژیک (SWOT)</Text>
        <View style={styles.gridRow}>
            <View style={[styles.gridCol, styles.swotS]}>
                <Text style={[styles.swotTitle, {color: '#166534'}]}>نقاط قوت (Strengths)</Text>
                {data.swot_analysis?.Strengths?.map((item:string, i:number) => <Text key={i} style={styles.text}>• {item}</Text>)}
            </View>
            <View style={[styles.gridCol, styles.swotW]}>
                <Text style={[styles.swotTitle, {color: '#991b1b'}]}>نقاط ضعف (Weaknesses)</Text>
                {data.swot_analysis?.Weaknesses?.map((item:string, i:number) => <Text key={i} style={styles.text}>• {item}</Text>)}
            </View>
        </View>
        <View style={styles.gridRow}>
            <View style={[styles.gridCol, styles.swotO]}>
                <Text style={[styles.swotTitle, {color: '#1e40af'}]}>فرصت‌ها (Opportunities)</Text>
                {data.swot_analysis?.Opportunities?.map((item:string, i:number) => <Text key={i} style={styles.text}>• {item}</Text>)}
            </View>
            <View style={[styles.gridCol, styles.swotT]}>
                <Text style={[styles.swotTitle, {color: '#9a3412'}]}>تهدیدها (Threats)</Text>
                {data.swot_analysis?.Threats?.map((item:string, i:number) => <Text key={i} style={styles.text}>• {item}</Text>)}
            </View>
        </View>
      </View>

      {/* --- SMART GOALS SECTION --- */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>اهداف هوشمند (SMART Goals)</Text>
        {data.smart_goals?.map((goal:string, i:number) => (
          <Text key={i} style={styles.text}>{i + 1}. {goal}</Text>
        ))}
      </View>

      {/* --- PATIENT FLASHCARDS SECTION --- */}
      <View style={{ marginTop: 10 }}>
        <Text style={styles.sectionTitle}>فلش‌کارت‌های مراجع (یادآوری تکنیک)</Text>
        <View style={styles.cardContainer}>
          {data.flashcards?.map((card:any, i:number) => (
            <View key={i} style={styles.flashcard}>
              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.text}>{card.content}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* --- FOOTER --- */}
      <Text style={styles.footer} fixed>
        این سند توسط دستیار هوشمند بالینی وانیا (VCOS) در تاریخ {new Date().toLocaleDateString('fa-IR')} تنظیم شده و محتوای آن محرمانه است.
      </Text>
    </Page>
  </Document>
);