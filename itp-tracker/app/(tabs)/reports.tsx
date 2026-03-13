import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '@/constants/Colors';
import {
  generateDoctorQuestions,
  generateDailySummary,
  DoctorQuestions,
} from '@/services/azureOpenAIService';
import { formatDate } from '@/services/storageService';

// Mock AI-generated doctor questions
const MOCK_QUESTIONS = [
  {
    id: '1',
    category: 'Steroid Taper',
    question:
      'Platelets dropped 40% within 5 days of reducing prednisone 15→10mg. Should we slow the taper or hold at 15mg temporarily?',
    context:
      'Platelet count went from 47k on Mar 4 to 28k on Mar 7 — a 40% decline that coincides with the dose reduction on Mar 1.',
    priority: 'high',
  },
  {
    id: '2',
    category: 'Eltrombopag / Liver',
    question:
      'ALT has tripled over 6 weeks (22→52). At what threshold would you consider dose reduction or switching to romiplostim?',
    context:
      'ALT trend: 22 (Feb 16) → 35 (Feb 23) → 52 (Mar 7). Eltrombopag is a known hepatotoxin. Current dose 50mg.',
    priority: 'high',
  },
  {
    id: '3',
    category: 'Immunology',
    question:
      'IgG has gone from 820→680 over 4 months on steroids. Should we check IgG subclasses? At what level would you consider PCP prophylaxis?',
    context:
      'IgG is now below the reference range (700-1600 mg/dL). Patient has been on chronic prednisone since Jan 5.',
    priority: 'medium',
  },
  {
    id: '4',
    category: 'Bleeding Risk',
    question:
      'With platelets at 28k and 3 new bruises today + active oral blisters, are there activities we should restrict? What\'s the ER threshold?',
    context:
      'Visual assessment shows 7 total bruises (3 new today), plus 1 blood blister in mouth. Daily photos show increasing trend.',
    priority: 'medium',
  },
  {
    id: '5',
    category: 'Treatment Plan',
    question:
      'If platelets don\'t recover above 50k after holding the taper for 2 weeks, what\'s the next step — increase eltrombopag, add rituximab, or consider IVIG?',
    context:
      'Current trajectory shows declining platelets despite eltrombopag at 50mg. Multiple second-line options available.',
    priority: 'low',
  },
];

const MOCK_AI_SUMMARY = `**Clinical Summary — ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}**

Your son's ITP is showing signs of increased activity following the recent prednisone taper. Key observations:

**Hematology:**
• Platelet count has dropped to 28k/µL — the lowest in 2 months. This represents a 40% decline over 3 days, temporally correlated with the prednisone reduction from 15mg to 10mg.
• MPV is elevated at 11.2 fL, which is actually a reassuring sign — it indicates the bone marrow is actively producing large, young platelets (compensatory thrombopoiesis). The problem is peripheral destruction, not production failure.

**Hepatology:**
• ALT continues to trend upward (22 → 35 → 52 U/L) since starting eltrombopag. The pattern is consistent with dose-dependent drug-induced liver injury. AST remains normal, suggesting early hepatocellular involvement.

**Immunology:**
• IgG has fallen below the normal range (680 vs ref 700-1600). This is consistent with steroid-induced immunosuppression. Worth monitoring for infection risk.

**Physical Assessment:**
• 7 bruises total: 3 new (left leg x2, right arm x1), 1 healing (left arm), 3 unchanged.
• 1 blood blister on inner cheek — unchanged from yesterday.
• No petechiae noted on torso.

**Overall Assessment:**
The current regimen is not adequately controlling platelet counts during the steroid taper. The disease appears steroid-dependent with an incomplete response to eltrombopag at current dose. Liver function needs close monitoring.`;

function PriorityBadge({ level }: { level: string }) {
  const config: Record<string, { color: string; bg: string; label: string }> = {
    high: { color: palette.critical, bg: palette.criticalLight, label: 'Important' },
    medium: { color: palette.warning, bg: palette.warningLight, label: 'Ask' },
    low: { color: palette.primary, bg: palette.primaryLight, label: 'Consider' },
  };
  const c = config[level] || config.medium;
  return (
    <View style={[styles.priorityBadge, { backgroundColor: c.bg }]}>
      <Text style={[styles.priorityText, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}

export default function ReportsScreen() {
  const [activeTab, setActiveTab] = React.useState<'questions' | 'summary' | 'history'>('questions');
  const [checkedQuestions, setCheckedQuestions] = React.useState<string[]>([]);
  const [aiQuestions, setAiQuestions] = React.useState<DoctorQuestions | null>(null);
  const [aiSummary, setAiSummary] = React.useState<string | null>(null);
  const [loadingQuestions, setLoadingQuestions] = React.useState(false);
  const [loadingSummary, setLoadingSummary] = React.useState(false);

  // Patient data for AI context (will come from DB later)
  const patientData = {
    labs: [
      { date: 'Mar 7', platelets: 28, mpv: 11.2, alt: 52, igg: 680 },
      { date: 'Mar 4', platelets: 47, mpv: 10.8 },
      { date: 'Feb 23', platelets: 52, alt: 35 },
      { date: 'Feb 16', platelets: 58, alt: 22 },
    ],
    meds: [
      { name: 'Prednisone', dose: '10mg', status: 'tapering', history: '20mg\u219215mg\u219210mg' },
      { name: 'Eltrombopag', dose: '50mg', status: 'active', started: 'Feb 16' },
      { name: 'Omeprazole', dose: '20mg', status: 'active' },
    ],
    symptoms: [
      { date: 'Mar 9', bruises: 7, newBruises: 3, energy: 3, oralBlisters: 1 },
      { date: 'Mar 8', bruises: 5, newBruises: 1, energy: 3, oralBlisters: 1 },
    ],
    bruiseAssessments: [
      { date: 'Mar 9', totalBruises: 7, severity: 'moderate', regions: { left_leg: 3, right_arm: 2, left_arm: 1, torso: 1 } },
    ],
  };

  const handleGenerateQuestions = async () => {
    setLoadingQuestions(true);
    try {
      const result = await generateDoctorQuestions(
        patientData.labs,
        patientData.meds,
        patientData.symptoms,
        patientData.bruiseAssessments
      );
      setAiQuestions(result);
    } catch (error) {
      console.error('Failed to generate questions:', error);
      Alert.alert('Error', 'Failed to generate questions. Using cached data.');
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleGenerateSummary = async () => {
    setLoadingSummary(true);
    try {
      const result = await generateDailySummary(
        patientData.labs,
        patientData.meds,
        patientData.symptoms,
        patientData.bruiseAssessments,
        new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      );
      setAiSummary(result);
    } catch (error) {
      console.error('Failed to generate summary:', error);
      Alert.alert('Error', 'Failed to generate summary. Using cached data.');
    } finally {
      setLoadingSummary(false);
    }
  };

  // Use AI questions if available, otherwise fall back to mock
  const displayQuestions = aiQuestions?.questions?.map((q, i) => ({
    id: String(i + 1),
    ...q,
  })) || MOCK_QUESTIONS;

  const toggleQuestion = (id: string) => {
    setCheckedQuestions((prev) =>
      prev.includes(id) ? prev.filter((q) => q !== id) : [...prev, id]
    );
  };

  const handleExport = () => {
    Alert.alert(
      'Export Report',
      'This will generate a PDF with:\n\n• AI clinical summary\n• Lab trends & charts\n• Medication history\n• Daily photos with annotations\n• Doctor discussion questions\n\nReady to share with your hematologist.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Generate PDF', onPress: () => Alert.alert('PDF Generated', 'Report saved and ready to share.') },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {(['questions', 'summary', 'history'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'questions'
                ? `Questions (${displayQuestions.length})`
                : tab === 'summary'
                ? 'AI Summary'
                : 'History'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        {/* Questions Tab */}
        {activeTab === 'questions' && (
          <View>
            <View style={styles.questionsHeader}>
              <View>
                <Text style={styles.sectionTitle}>Doctor Discussion Questions</Text>
                <Text style={styles.sectionDesc}>
                  AI-generated questions based on recent labs, meds, and symptoms
                </Text>
              </View>
            </View>

            {/* Generate button */}
            {!aiQuestions && (
              <TouchableOpacity
                style={styles.generateBtn}
                onPress={handleGenerateQuestions}
                disabled={loadingQuestions}
                activeOpacity={0.7}
              >
                {loadingQuestions ? (
                  <ActivityIndicator size="small" color={palette.white} />
                ) : (
                  <Ionicons name="sparkles" size={18} color={palette.white} />
                )}
                <Text style={styles.generateBtnText}>
                  {loadingQuestions ? 'Generating questions...' : 'Generate AI Questions'}
                </Text>
              </TouchableOpacity>
            )}

            {displayQuestions.map((q) => (
              <TouchableOpacity
                key={q.id}
                style={[
                  styles.questionCard,
                  checkedQuestions.includes(q.id) && styles.questionCardChecked,
                ]}
                onPress={() => toggleQuestion(q.id)}
                activeOpacity={0.7}
              >
                <View style={styles.questionTop}>
                  <View
                    style={[
                      styles.questionCheck,
                      checkedQuestions.includes(q.id) && styles.questionCheckDone,
                    ]}
                  >
                    {checkedQuestions.includes(q.id) && (
                      <Ionicons name="checkmark" size={14} color={palette.white} />
                    )}
                  </View>
                  <View style={styles.questionMeta}>
                    <Text style={styles.questionCategory}>{q.category}</Text>
                    <PriorityBadge level={q.priority} />
                  </View>
                </View>
                <Text
                  style={[
                    styles.questionText,
                    checkedQuestions.includes(q.id) && styles.questionTextChecked,
                  ]}
                >
                  {q.question}
                </Text>
                <View style={styles.contextBox}>
                  <Ionicons name="information-circle" size={14} color={palette.gray400} />
                  <Text style={styles.contextText}>{q.context}</Text>
                </View>
              </TouchableOpacity>
            ))}

            <Text style={styles.disclaimer}>
              ⚕️ These questions are AI-generated for informational purposes. They do not replace medical advice.
              Always discuss treatment decisions with your hematologist.
            </Text>
          </View>
        )}

        {/* Summary Tab */}
        {activeTab === 'summary' && (
          <View>
            <View style={styles.summaryHeader}>
              <Ionicons name="sparkles" size={20} color={palette.purple} />
              <Text style={styles.sectionTitle}>AI Clinical Summary</Text>
            </View>

            {/* Generate button */}
            {!aiSummary && (
              <TouchableOpacity
                style={styles.generateBtn}
                onPress={handleGenerateSummary}
                disabled={loadingSummary}
                activeOpacity={0.7}
              >
                {loadingSummary ? (
                  <ActivityIndicator size="small" color={palette.white} />
                ) : (
                  <Ionicons name="sparkles" size={18} color={palette.white} />
                )}
                <Text style={styles.generateBtnText}>
                  {loadingSummary ? 'Generating summary...' : 'Generate AI Summary'}
                </Text>
              </TouchableOpacity>
            )}

            {loadingSummary && (
              <View style={styles.summaryCard}>
                <ActivityIndicator size="large" color={palette.purple} />
                <Text style={{ textAlign: 'center', color: palette.gray500, marginTop: 12 }}>
                  Analyzing labs, meds, and symptoms...
                </Text>
              </View>
            )}

            {(aiSummary || (!loadingSummary && !aiSummary)) && (
              <View>
                <Text style={styles.summaryDate}>
                  {aiSummary
                    ? `Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
                    : 'Tap the button above to generate a fresh AI summary'}
                </Text>
                <View style={styles.summaryCard}>
                  {(aiSummary || MOCK_AI_SUMMARY).split('\n').map((line, i) => {
                    if (line.startsWith('**') && line.endsWith('**')) {
                      const text = line.replace(/\*\*/g, '');
                      return (
                        <Text key={i} style={styles.summaryHeading}>
                          {text}
                        </Text>
                      );
                    }
                    if (line.startsWith('•')) {
                      return (
                        <Text key={i} style={styles.summaryBullet}>
                          {line}
                        </Text>
                      );
                    }
                    if (line.trim() === '') return <View key={i} style={{ height: 8 }} />;
                    return (
                      <Text key={i} style={styles.summaryText}>
                        {line.replace(/\*\*/g, '')}
                      </Text>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <View>
            <Text style={styles.sectionTitle}>Report History</Text>
            <Text style={styles.sectionDesc}>Previous reports generated for doctor visits</Text>

            {[
              { date: 'Mar 9, 2026', type: 'Daily Summary', questions: 5 },
              { date: 'Mar 7, 2026', type: 'Lab Review', questions: 4 },
              { date: 'Mar 2, 2026', type: 'Weekly Report', questions: 7 },
              { date: 'Feb 23, 2026', type: 'Clinic Visit Report', questions: 6 },
              { date: 'Feb 16, 2026', type: 'Treatment Change', questions: 5 },
            ].map((report, i) => (
              <TouchableOpacity key={i} style={styles.historyItem}>
                <View style={styles.historyIcon}>
                  <Ionicons name="document-text" size={20} color={palette.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyTitle}>{report.type}</Text>
                  <Text style={styles.historyDate}>{report.date}</Text>
                </View>
                <View style={styles.historyBadge}>
                  <Text style={styles.historyBadgeText}>{report.questions} Q</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={palette.gray300} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Export Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.exportBtn} onPress={handleExport}>
          <Ionicons name="share-outline" size={20} color={palette.white} />
          <Text style={styles.exportBtnText}>Export Report for Doctor</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.gray50 },
  scrollArea: { flex: 1 },
  scrollContent: { padding: 16 },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: palette.white,
    paddingHorizontal: 16,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: palette.gray100,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: palette.primary },
  tabText: { fontSize: 13, fontWeight: '500', color: palette.gray500 },
  tabTextActive: { color: palette.primary, fontWeight: '600' },

  questionsHeader: { marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: palette.gray800 },
  sectionDesc: { fontSize: 13, color: palette.gray500, marginTop: 4 },

  questionCard: {
    backgroundColor: palette.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: palette.gray200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  questionCardChecked: {
    borderColor: palette.success,
    backgroundColor: palette.successLight + '40',
  },
  questionTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  questionCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: palette.gray300,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  questionCheckDone: { backgroundColor: palette.success, borderColor: palette.success },
  questionMeta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  questionCategory: { fontSize: 12, fontWeight: '600', color: palette.gray500 },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  priorityText: { fontSize: 10, fontWeight: '600' },
  questionText: { fontSize: 15, color: palette.gray800, lineHeight: 22, fontWeight: '500' },
  questionTextChecked: { color: palette.gray400 },
  contextBox: {
    flexDirection: 'row',
    backgroundColor: palette.gray50,
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    gap: 6,
    alignItems: 'flex-start',
  },
  contextText: { flex: 1, fontSize: 12, color: palette.gray500, lineHeight: 18 },

  disclaimer: {
    fontSize: 12,
    color: palette.gray400,
    lineHeight: 18,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 16,
  },

  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  summaryDate: { fontSize: 12, color: palette.gray400, marginBottom: 16 },
  summaryCard: {
    backgroundColor: palette.white,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.gray800,
    marginTop: 12,
    marginBottom: 6,
  },
  summaryBullet: {
    fontSize: 14,
    color: palette.gray700,
    lineHeight: 22,
    paddingLeft: 4,
  },
  summaryText: { fontSize: 14, color: palette.gray700, lineHeight: 22 },

  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: palette.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyTitle: { fontSize: 15, fontWeight: '600', color: palette.gray800 },
  historyDate: { fontSize: 12, color: palette.gray500, marginTop: 2 },
  historyBadge: {
    backgroundColor: palette.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  historyBadgeText: { fontSize: 11, fontWeight: '600', color: palette.primary },

  bottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: palette.white,
    borderTopWidth: 1,
    borderTopColor: palette.gray100,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primary,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  exportBtnText: { fontSize: 15, fontWeight: '600', color: palette.white },

  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.purple,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  generateBtnText: { fontSize: 15, fontWeight: '600', color: palette.white },
});
