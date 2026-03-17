import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  SafeAreaView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '@/constants/Colors';
import {
  MedicalDocumentService,
  DocumentExtractionResult,
  ExtractedLabValue,
} from '@/services/medicalDocumentService';

type Step = 'pick' | 'preview' | 'analyzing' | 'results';

interface ScanDocumentModalProps {
  visible: boolean;
  onClose: () => void;
  onDocumentProcessed: (result: DocumentExtractionResult) => void;
}

export default function ScanDocumentModal({
  visible,
  onClose,
  onDocumentProcessed,
}: ScanDocumentModalProps) {
  const [step, setStep] = useState<Step>('pick');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [result, setResult] = useState<DocumentExtractionResult | null>(null);

  const pickFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow camera access to scan documents.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: false,
    });
    if (!res.canceled && res.assets[0]) {
      setImageUri(res.assets[0].uri);
      setStep('preview');
    }
  };

  const pickFromGallery = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.8,
      allowsEditing: false,
      allowsMultipleSelection: false,
    });
    if (!res.canceled && res.assets[0]) {
      setImageUri(res.assets[0].uri);
      setStep('preview');
    }
  };

  const analyzeDocument = async () => {
    if (!imageUri) return;
    setStep('analyzing');
    try {
      const extraction = await MedicalDocumentService.analyzeDocument(imageUri);
      setResult(extraction);
      setStep('results');
    } catch (error) {
      console.error('Analysis error:', error);
      Alert.alert('Analysis Failed', (error as Error).message);
      setStep('preview');
    }
  };

  const handleDone = () => {
    if (result) {
      onDocumentProcessed(result);
    }
    resetAndClose();
  };

  const resetAndClose = () => {
    setStep('pick');
    setImageUri(null);
    setResult(null);
    onClose();
  };

  const goBack = () => {
    if (step === 'preview') {
      setStep('pick');
      setImageUri(null);
    } else if (step === 'results') {
      setStep('pick');
      setImageUri(null);
      setResult(null);
    } else {
      resetAndClose();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return '#EF4444';
      case 'warning': return '#F59E0B';
      case 'normal': return '#10B981';
      default: return '#6B7280';
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={resetAndClose}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack} style={styles.backBtn}>
            <Ionicons
              name={step === 'pick' ? 'close' : 'arrow-back'}
              size={24}
              color={palette.gray700}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {step === 'pick' ? 'Upload Document' :
             step === 'preview' ? 'Review' :
             step === 'analyzing' ? 'Analyzing...' :
             'Results'}
          </Text>
          {step === 'results' && (
            <TouchableOpacity onPress={handleDone} style={styles.doneBtn}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Step: Pick source */}
        {step === 'pick' && (
          <ScrollView style={styles.content} contentContainerStyle={styles.pickContent}>
            <View style={styles.heroSection}>
              <View style={styles.heroIcon}>
                <Ionicons name="document-text" size={48} color={palette.primary} />
              </View>
              <Text style={styles.heroTitle}>Scan Medical Documents</Text>
              <Text style={styles.heroSubtext}>
                Take a photo or upload screenshots of lab results, doctor's notes, visit summaries, prescriptions — anything medical
              </Text>
            </View>

            <TouchableOpacity style={styles.sourceCard} onPress={pickFromCamera} activeOpacity={0.7}>
              <View style={[styles.sourceIcon, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="camera" size={28} color="#3B82F6" />
              </View>
              <View style={styles.sourceInfo}>
                <Text style={styles.sourceName}>Take Photo</Text>
                <Text style={styles.sourceDesc}>Photograph a printed report or screen</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={palette.gray400} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.sourceCard} onPress={pickFromGallery} activeOpacity={0.7}>
              <View style={[styles.sourceIcon, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="images" size={28} color="#10B981" />
              </View>
              <View style={styles.sourceInfo}>
                <Text style={styles.sourceName}>Choose from Photos</Text>
                <Text style={styles.sourceDesc}>Pick a screenshot or saved document image</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={palette.gray400} />
            </TouchableOpacity>

            <View style={styles.tipBox}>
              <Ionicons name="bulb" size={18} color="#F59E0B" />
              <Text style={styles.tipText}>
                Tip: Screenshot your MyChart lab results or photograph your after-visit summary. AI will extract all the data automatically.
              </Text>
            </View>

            <View style={styles.supportedTypes}>
              <Text style={styles.supportedTitle}>Supported Documents</Text>
              <View style={styles.typeGrid}>
                {[
                  { icon: '🔬', label: 'Lab Reports' },
                  { icon: '📋', label: "Doctor's Notes" },
                  { icon: '📄', label: 'Visit Summaries' },
                  { icon: '💊', label: 'Medication Lists' },
                  { icon: '🏥', label: 'Discharge Summary' },
                  { icon: '📷', label: 'Imaging Reports' },
                ].map((type, i) => (
                  <View key={i} style={styles.typeChip}>
                    <Text style={styles.typeEmoji}>{type.icon}</Text>
                    <Text style={styles.typeLabel}>{type.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
        )}

        {/* Step: Preview image */}
        {step === 'preview' && imageUri && (
          <View style={styles.previewContainer}>
            <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
            <View style={styles.previewActions}>
              <TouchableOpacity style={styles.retakeBtn} onPress={goBack}>
                <Ionicons name="refresh" size={18} color={palette.gray600} />
                <Text style={styles.retakeBtnText}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.analyzeBtn} onPress={analyzeDocument}>
                <Ionicons name="sparkles" size={18} color="#fff" />
                <Text style={styles.analyzeBtnText}>Analyze Document</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Step: Analyzing */}
        {step === 'analyzing' && (
          <View style={styles.analyzingContainer}>
            <ActivityIndicator size="large" color={palette.primary} />
            <Text style={styles.analyzingTitle}>Analyzing Document...</Text>
            <Text style={styles.analyzingSubtext}>
              AI is reading and extracting medical data
            </Text>
            <View style={styles.analyzingSteps}>
              {['Reading document text', 'Identifying document type', 'Extracting lab values', 'Categorizing findings'].map((s, i) => (
                <View key={i} style={styles.analyzingStep}>
                  <Ionicons name="checkmark-circle" size={16} color={palette.primary} />
                  <Text style={styles.analyzingStepText}>{s}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Step: Results */}
        {step === 'results' && result && (
          <ScrollView style={styles.content}>
            {/* Category badge */}
            <View style={styles.resultHeader}>
              <View style={[styles.categoryBadge, { backgroundColor: MedicalDocumentService.getCategoryColor(result.category) + '20' }]}>
                <Text style={styles.categoryIcon}>
                  {MedicalDocumentService.getCategoryIcon(result.category)}
                </Text>
                <Text style={[styles.categoryText, { color: MedicalDocumentService.getCategoryColor(result.category) }]}>
                  {result.categoryLabel}
                </Text>
              </View>
              {result.provider && (
                <Text style={styles.resultProvider}>{result.provider}</Text>
              )}
              <Text style={styles.resultDate}>
                {new Date(result.date).toLocaleDateString('en-US', {
                  month: 'long', day: 'numeric', year: 'numeric',
                })}
              </Text>
            </View>

            {/* Title & Summary */}
            <View style={styles.resultCard}>
              <Text style={styles.resultTitle}>{result.title}</Text>
              <Text style={styles.resultSummary}>{result.summary}</Text>
            </View>

            {/* Lab Values */}
            {result.labValues && result.labValues.length > 0 && (
              <View style={styles.resultCard}>
                <Text style={styles.sectionTitle}>
                  🔬 Lab Values ({result.labValues.length})
                </Text>
                {result.labValues.map((lab, i) => (
                  <View key={i} style={styles.labRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.labName}>{lab.name}</Text>
                      {lab.referenceRange ? (
                        <Text style={styles.labRef}>Ref: {lab.referenceRange}</Text>
                      ) : null}
                    </View>
                    <Text style={[styles.labValue, { color: getStatusColor(lab.status) }]}>
                      {lab.value} {lab.unit}
                    </Text>
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(lab.status) + '20' }]}>
                      <Ionicons
                        name={lab.status === 'critical' ? 'alert' : lab.status === 'warning' ? 'warning' : 'checkmark'}
                        size={12}
                        color={getStatusColor(lab.status)}
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Medications */}
            {result.medications && result.medications.length > 0 && (
              <View style={styles.resultCard}>
                <Text style={styles.sectionTitle}>
                  💊 Medications ({result.medications.length})
                </Text>
                {result.medications.map((med, i) => (
                  <View key={i} style={styles.medRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.medName}>{med.name}</Text>
                      <Text style={styles.medDose}>{med.dose} — {med.frequency}</Text>
                    </View>
                    <View style={[styles.medStatusBadge, {
                      backgroundColor: med.status === 'new' ? '#DBEAFE' :
                        med.status === 'changed' ? '#FEF3C7' :
                        med.status === 'discontinued' ? '#FEE2E2' : '#D1FAE5'
                    }]}>
                      <Text style={[styles.medStatusText, {
                        color: med.status === 'new' ? '#3B82F6' :
                          med.status === 'changed' ? '#D97706' :
                          med.status === 'discontinued' ? '#EF4444' : '#10B981'
                      }]}>
                        {med.status}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Vitals */}
            {result.vitals && result.vitals.length > 0 && (
              <View style={styles.resultCard}>
                <Text style={styles.sectionTitle}>
                  ❤️ Vitals
                </Text>
                <View style={styles.vitalsGrid}>
                  {result.vitals.map((v, i) => (
                    <View key={i} style={styles.vitalChip}>
                      <Text style={styles.vitalName}>{v.name}</Text>
                      <Text style={styles.vitalValue}>{v.value} {v.unit}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Diagnoses */}
            {result.diagnoses && result.diagnoses.length > 0 && (
              <View style={styles.resultCard}>
                <Text style={styles.sectionTitle}>
                  📋 Diagnoses
                </Text>
                {result.diagnoses.map((dx, i) => (
                  <View key={i} style={styles.dxRow}>
                    <Ionicons
                      name={dx.status === 'active' ? 'alert-circle' : dx.status === 'resolved' ? 'checkmark-circle' : 'eye'}
                      size={16}
                      color={dx.status === 'active' ? '#EF4444' : dx.status === 'resolved' ? '#10B981' : '#F59E0B'}
                    />
                    <Text style={styles.dxName}>{dx.name}</Text>
                    {dx.icdCode && <Text style={styles.dxCode}>{dx.icdCode}</Text>}
                  </View>
                ))}
              </View>
            )}

            {/* Notes */}
            {result.notes && (
              <View style={styles.resultCard}>
                <Text style={styles.sectionTitle}>
                  📝 Provider Notes
                </Text>
                {result.notes.provider && (
                  <Text style={styles.noteProvider}>
                    {result.notes.provider} • {result.notes.specialty}
                  </Text>
                )}
                <Text style={styles.noteSummary}>{result.notes.summary}</Text>

                {result.notes.keyFindings && result.notes.keyFindings.length > 0 && (
                  <>
                    <Text style={styles.noteSubtitle}>Key Findings</Text>
                    {result.notes.keyFindings.map((f, i) => (
                      <View key={i} style={styles.bulletRow}>
                        <Text style={styles.bullet}>•</Text>
                        <Text style={styles.bulletText}>{f}</Text>
                      </View>
                    ))}
                  </>
                )}

                {result.notes.recommendations && result.notes.recommendations.length > 0 && (
                  <>
                    <Text style={styles.noteSubtitle}>Recommendations</Text>
                    {result.notes.recommendations.map((r, i) => (
                      <View key={i} style={styles.bulletRow}>
                        <Text style={styles.bullet}>→</Text>
                        <Text style={styles.bulletText}>{r}</Text>
                      </View>
                    ))}
                  </>
                )}

                {result.notes.followUp && (
                  <View style={styles.followUpBox}>
                    <Ionicons name="calendar" size={14} color={palette.primary} />
                    <Text style={styles.followUpText}>{result.notes.followUp}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Scan another */}
            <TouchableOpacity style={styles.scanAnotherBtn} onPress={goBack}>
              <Ionicons name="add-circle" size={20} color={palette.primary} />
              <Text style={styles.scanAnotherText}>Scan Another Document</Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: Platform.OS === 'android' ? 30 : 0 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backBtn: { marginRight: 16, padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#111827', flex: 1 },
  doneBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: palette.primary, borderRadius: 8 },
  doneBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  content: { flex: 1, padding: 16 },
  // Pick
  pickContent: { paddingBottom: 40 },
  heroSection: { alignItems: 'center', paddingVertical: 24 },
  heroIcon: { width: 80, height: 80, borderRadius: 20, backgroundColor: palette.primaryLight, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  heroTitle: { fontSize: 22, fontWeight: '700', color: '#111827' },
  heroSubtext: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 8, paddingHorizontal: 20, lineHeight: 20 },
  sourceCard: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#F9FAFB', borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  sourceIcon: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  sourceInfo: { flex: 1 },
  sourceName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  sourceDesc: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  tipBox: { flexDirection: 'row', backgroundColor: '#FFFBEB', borderRadius: 12, padding: 14, marginTop: 16, gap: 10, alignItems: 'flex-start' },
  tipText: { flex: 1, fontSize: 13, color: '#92400E', lineHeight: 18 },
  supportedTypes: { marginTop: 24 },
  supportedTitle: { fontSize: 14, fontWeight: '600', color: '#6B7280', marginBottom: 12 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, gap: 6 },
  typeEmoji: { fontSize: 14 },
  typeLabel: { fontSize: 12, color: '#4B5563', fontWeight: '500' },
  // Preview
  previewContainer: { flex: 1 },
  previewImage: { flex: 1, margin: 16, borderRadius: 12, backgroundColor: '#F3F4F6' },
  previewActions: { flexDirection: 'row', padding: 16, gap: 12 },
  retakeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, backgroundColor: '#F3F4F6', gap: 8 },
  retakeBtnText: { fontSize: 15, fontWeight: '600', color: '#4B5563' },
  analyzeBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, backgroundColor: palette.primary, gap: 8 },
  analyzeBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  // Analyzing
  analyzingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  analyzingTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginTop: 24 },
  analyzingSubtext: { fontSize: 14, color: '#6B7280', marginTop: 8 },
  analyzingSteps: { marginTop: 32, gap: 12 },
  analyzingStep: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  analyzingStepText: { fontSize: 14, color: '#4B5563' },
  // Results
  resultHeader: { alignItems: 'center', marginBottom: 16, paddingTop: 8 },
  categoryBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, gap: 6 },
  categoryIcon: { fontSize: 16 },
  categoryText: { fontSize: 13, fontWeight: '700' },
  resultProvider: { fontSize: 15, fontWeight: '600', color: '#374151', marginTop: 8 },
  resultDate: { fontSize: 13, color: '#9CA3AF', marginTop: 4 },
  resultCard: { backgroundColor: '#F9FAFB', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  resultTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  resultSummary: { fontSize: 14, color: '#4B5563', marginTop: 8, lineHeight: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 },
  // Labs
  labRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  labName: { fontSize: 14, fontWeight: '500', color: '#374151' },
  labRef: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  labValue: { fontSize: 15, fontWeight: '700', marginRight: 8 },
  statusDot: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  // Meds
  medRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  medName: { fontSize: 14, fontWeight: '600', color: '#374151' },
  medDose: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  medStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  medStatusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  // Vitals
  vitalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  vitalChip: { backgroundColor: '#EFF6FF', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, minWidth: 100 },
  vitalName: { fontSize: 11, color: '#6B7280', fontWeight: '500' },
  vitalValue: { fontSize: 15, fontWeight: '700', color: '#1E40AF', marginTop: 2 },
  // Diagnoses
  dxRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  dxName: { flex: 1, fontSize: 14, color: '#374151' },
  dxCode: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  // Notes
  noteProvider: { fontSize: 13, color: '#6B7280', fontWeight: '600', marginBottom: 8 },
  noteSummary: { fontSize: 14, color: '#374151', lineHeight: 20 },
  noteSubtitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginTop: 14, marginBottom: 6 },
  bulletRow: { flexDirection: 'row', marginLeft: 4, marginBottom: 4, gap: 8 },
  bullet: { fontSize: 14, color: '#6B7280' },
  bulletText: { flex: 1, fontSize: 13, color: '#4B5563', lineHeight: 18 },
  followUpBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.primaryLight, borderRadius: 10, padding: 12, marginTop: 12, gap: 8 },
  followUpText: { flex: 1, fontSize: 13, color: palette.primary, fontWeight: '500' },
  // Scan another
  scanAnotherBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, gap: 8, marginTop: 8 },
  scanAnotherText: { fontSize: 15, fontWeight: '600', color: palette.primary },
});
