import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { palette } from '@/constants/Colors';
import { uploadPhoto, getSignedPhotoUrl } from '@/services/azureBlobService';
import { analyzeBruisePhoto, BruiseAnalysis } from '@/services/azureOpenAIService';
import {
  CheckinData,
  getCheckin,
  saveCheckin,
  getCheckinHistory,
  todayKey,
  formatDate,
  formatShortDate,
} from '@/services/storageService';

const BODY_REGIONS = [
  { id: 'left_arm', label: 'Left Arm', icon: 'body' },
  { id: 'right_arm', label: 'Right Arm', icon: 'body' },
  { id: 'left_leg', label: 'Left Leg', icon: 'body' },
  { id: 'right_leg', label: 'Right Leg', icon: 'body' },
  { id: 'torso', label: 'Torso', icon: 'body' },
  { id: 'mouth', label: 'Mouth', icon: 'happy' },
];

const SYMPTOM_OPTIONS = [
  { id: 'bruises', label: 'Bruises', icon: 'ellipse' },
  { id: 'petechiae', label: 'Petechiae (blood spots)', icon: 'grid' },
  { id: 'mouth_blisters', label: 'Mouth Blisters', icon: 'water' },
  { id: 'nosebleed', label: 'Nosebleed', icon: 'water' },
  { id: 'gum_bleeding', label: 'Gum Bleeding', icon: 'water' },
  { id: 'fatigue', label: 'Fatigue', icon: 'bed' },
];

const ENERGY_LEVELS = [
  { value: 1, emoji: '😫', label: 'Very Low' },
  { value: 2, emoji: '😕', label: 'Low' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😁', label: 'Great' },
];

type Step = 'photos' | 'symptoms' | 'notes' | 'review';
type ScreenMode = 'history' | 'wizard' | 'view';

const PATIENT_ID = 'patient-001'; // Will come from auth context later

export default function CheckinScreen() {
  // ─── Screen mode: history list vs wizard vs read-only view ──────────
  const [mode, setMode] = React.useState<ScreenMode>('history');
  const [historyDates, setHistoryDates] = React.useState<string[]>([]);
  const [historyCheckins, setHistoryCheckins] = React.useState<Record<string, CheckinData>>({});
  const [viewingDate, setViewingDate] = React.useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = React.useState(false);

  // ─── Wizard state ───────────────────────────────────────────────────
  const [step, setStep] = React.useState<Step>('photos');
  const [photos, setPhotos] = React.useState<Record<string, { localUri: string; blobPath: string | null }>>({});
  const [uploading, setUploading] = React.useState<string | null>(null);
  const [analyzing, setAnalyzing] = React.useState<string | null>(null);
  const [analyses, setAnalyses] = React.useState<Record<string, BruiseAnalysis>>({});
  const [symptoms, setSymptoms] = React.useState<string[]>([]);
  const [energy, setEnergy] = React.useState(3);
  const [notes, setNotes] = React.useState('');
  const [activities, setActivities] = React.useState('');
  const [loaded, setLoaded] = React.useState(false);

  const steps: Step[] = ['photos', 'symptoms', 'notes', 'review'];
  const stepIndex = steps.indexOf(step);

  // ─── Load history on mount ─────────────────────────────────────────
  React.useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const dates = await getCheckinHistory();
    setHistoryDates(dates);
    // Load summaries for each check-in
    const checkins: Record<string, CheckinData> = {};
    for (const d of dates.slice(0, 30)) { // load last 30
      const c = await getCheckin(d);
      if (c) checkins[d] = c;
    }
    setHistoryCheckins(checkins);
    setHistoryLoaded(true);
  };

  // ─── Start / resume wizard ─────────────────────────────────────────
  const startOrResumeCheckin = async () => {
    const existing = await getCheckin();
    if (existing) {
      setPhotos(existing.photos || {});
      setAnalyses(existing.analyses || {});
      setSymptoms(existing.symptoms || []);
      setEnergy(existing.energy || 3);
      setNotes(existing.notes || '');
      setActivities(existing.activities || '');
    } else {
      setPhotos({});
      setAnalyses({});
      setSymptoms([]);
      setEnergy(3);
      setNotes('');
      setActivities('');
    }
    setStep('photos');
    setLoaded(true);
    setMode('wizard');
  };

  // ─── View a past check-in ──────────────────────────────────────────
  const viewCheckin = (date: string) => {
    setViewingDate(date);
    setMode('view');
  };

  const goBackToHistory = async () => {
    setMode('history');
    setViewingDate(null);
    await loadHistory(); // refresh in case we just saved
  };

  // Auto-save partial progress so data isn't lost
  const autoSave = async (overrides?: Partial<CheckinData>) => {
    const checkin: CheckinData = {
      date: todayKey(),
      photos,
      analyses,
      symptoms,
      energy,
      activities,
      notes,
      savedAt: new Date().toISOString(),
      ...overrides,
    };
    await saveCheckin(checkin);
  };

  const handleTakePhoto = async (regionId: string) => {
    // Request camera permission
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Camera access is required to take photos.');
      return;
    }

    // Launch camera — photo is NOT saved to album
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
      exif: true,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const localUri = result.assets[0].uri;

    // Show photo immediately while uploading
    setPhotos((p) => ({ ...p, [regionId]: { localUri, blobPath: null } }));
    setUploading(regionId);

    try {
      // Upload to Azure Blob Storage (not to phone album)
      const { blobPath } = await uploadPhoto(localUri, PATIENT_ID, regionId);
      setPhotos((p) => ({
        ...p,
        [regionId]: { localUri, blobPath },
      }));
      // After upload, run AI bruise analysis
      setAnalyzing(regionId);
      try {
        // Read local file as blob, then convert to base64 for AI vision API
        const fileResp = await fetch(localUri);
        const blob = await fileResp.blob();
        const reader = new FileReader();
        const base64: string = await new Promise((resolve, reject) => {
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            // Strip data:image/jpeg;base64, prefix
            resolve(dataUrl.split(',')[1] || dataUrl);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        const analysis = await analyzeBruisePhoto(base64, regionId);
        setAnalyses((prev) => ({ ...prev, [regionId]: analysis }));
      } catch (aiError) {
        console.error('AI analysis failed:', aiError);
        // Non-blocking — photo is still saved even if AI fails
      } finally {
        setAnalyzing(null);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      Alert.alert(
        'Upload Failed',
        'Photo saved locally. It will be uploaded when connection is restored.',
      );
    } finally {
      setUploading(null);
    }
  };

  const toggleSymptom = (id: string) => {
    setSymptoms((prev) => {
      const updated = prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id];
      autoSave({ symptoms: updated });
      return updated;
    });
  };

  const handleSubmit = async () => {
    const checkin: CheckinData = {
      date: todayKey(),
      photos,
      analyses,
      symptoms,
      energy,
      activities,
      notes,
      savedAt: new Date().toISOString(),
    };
    await saveCheckin(checkin);
    Alert.alert(
      'Check-in Saved',
      `Your check-in for ${formatDate()} has been saved. It will persist even if you close the app.`,
      [{ text: 'OK', onPress: goBackToHistory }]
    );
  };

  // ─── Helper: format a YYYY-MM-DD date string for display ───────────
  const displayDate = (dateStr: string) => {
    const parts = dateStr.split('-');
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const isToday = (dateStr: string) => dateStr === todayKey();

  // ─── HISTORY MODE ──────────────────────────────────────────────────
  if (mode === 'history') {
    const todayCheckin = historyCheckins[todayKey()];
    return (
      <View style={styles.container}>
        <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <Text style={styles.historyTitle}>Check-ins</Text>
          <Text style={styles.historySubtitle}>{formatDate()}</Text>

          {/* Today Card */}
          <TouchableOpacity
            style={styles.todayCard}
            onPress={startOrResumeCheckin}
            activeOpacity={0.7}
          >
            <View style={styles.todayCardLeft}>
              <View style={[styles.todayBadge, todayCheckin ? styles.todayBadgeDone : null]}>
                <Ionicons
                  name={todayCheckin ? 'checkmark-circle' : 'add-circle'}
                  size={28}
                  color={todayCheckin ? palette.success : palette.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.todayLabel}>
                  {todayCheckin ? "Today's Check-in" : 'Start Today\'s Check-in'}
                </Text>
                {todayCheckin ? (
                  <Text style={styles.todayMeta}>
                    {Object.keys(todayCheckin.photos || {}).length} photos · {(todayCheckin.symptoms || []).length} symptoms · Energy {ENERGY_LEVELS.find(e => e.value === todayCheckin.energy)?.emoji || '😐'}
                  </Text>
                ) : (
                  <Text style={styles.todayMeta}>
                    Take photos, log symptoms, and track your day
                  </Text>
                )}
              </View>
            </View>
            <Ionicons
              name={todayCheckin ? 'create-outline' : 'arrow-forward'}
              size={22}
              color={todayCheckin ? palette.primary : palette.gray400}
            />
          </TouchableOpacity>

          {/* History */}
          {historyDates.length > 0 && (
            <View style={styles.historySection}>
              <Text style={styles.historySectionTitle}>Past Check-ins</Text>
              {historyDates.map((dateStr) => {
                const c = historyCheckins[dateStr];
                if (!c || isToday(dateStr)) return null;
                const photoCount = Object.keys(c.photos || {}).length;
                const symptomCount = (c.symptoms || []).length;
                const energyEmoji = ENERGY_LEVELS.find(e => e.value === c.energy)?.emoji || '😐';
                return (
                  <TouchableOpacity
                    key={dateStr}
                    style={styles.historyCard}
                    onPress={() => viewCheckin(dateStr)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.historyCardDate}>
                      <Text style={styles.historyCardDay}>
                        {new Date(dateStr + 'T12:00:00').getDate()}
                      </Text>
                      <Text style={styles.historyCardMonth}>
                        {new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' })}
                      </Text>
                    </View>
                    <View style={styles.historyCardBody}>
                      <Text style={styles.historyCardTitle}>{displayDate(dateStr)}</Text>
                      <View style={styles.historyCardStats}>
                        {photoCount > 0 && (
                          <View style={styles.historyStatBadge}>
                            <Ionicons name="camera" size={12} color={palette.primary} />
                            <Text style={styles.historyStatText}>{photoCount}</Text>
                          </View>
                        )}
                        {symptomCount > 0 && (
                          <View style={[styles.historyStatBadge, { backgroundColor: palette.warningLight }]}>
                            <Ionicons name="medkit" size={12} color={palette.warning} />
                            <Text style={[styles.historyStatText, { color: palette.warning }]}>{symptomCount}</Text>
                          </View>
                        )}
                        <Text style={styles.historyEnergyEmoji}>{energyEmoji}</Text>
                      </View>
                      {(c.notes || c.activities) ? (
                        <Text style={styles.historyCardNote} numberOfLines={1}>
                          {c.activities || c.notes}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={palette.gray300} />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {historyDates.filter(d => !isToday(d)).length === 0 && historyLoaded && (
            <View style={styles.emptyHistory}>
              <Ionicons name="calendar-outline" size={48} color={palette.gray300} />
              <Text style={styles.emptyHistoryText}>No past check-ins yet</Text>
              <Text style={styles.emptyHistorySubtext}>
                Complete your first check-in to start tracking
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // ─── VIEW MODE (read-only past check-in) ────────────────────────────
  if (mode === 'view' && viewingDate) {
    const c = historyCheckins[viewingDate];
    if (!c) {
      setMode('history');
      return null;
    }
    return (
      <View style={styles.container}>
        {/* Header with back button */}
        <View style={styles.viewHeader}>
          <TouchableOpacity onPress={goBackToHistory} style={styles.viewBackBtn}>
            <Ionicons name="arrow-back" size={22} color={palette.primary} />
            <Text style={styles.viewBackText}>Check-ins</Text>
          </TouchableOpacity>
          <Text style={styles.viewDateTitle}>{displayDate(viewingDate)}</Text>
        </View>

        <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
          {/* Photos */}
          {Object.keys(c.photos || {}).length > 0 && (
            <View style={styles.viewSection}>
              <Text style={styles.viewSectionTitle}>📸 Photos</Text>
              <View style={styles.viewPhotoGrid}>
                {Object.entries(c.photos).map(([region, photo]) => (
                  <View key={region} style={styles.viewPhotoItem}>
                    <Image source={{ uri: photo.localUri }} style={styles.viewPhotoThumb} />
                    <Text style={styles.viewPhotoLabel}>
                      {BODY_REGIONS.find(r => r.id === region)?.label || region}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* AI Analysis */}
          {Object.keys(c.analyses || {}).length > 0 && (
            <View style={styles.viewSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <Ionicons name="sparkles" size={16} color={palette.purple} />
                <Text style={[styles.viewSectionTitle, { marginBottom: 0, color: palette.purple }]}>AI Analysis</Text>
              </View>
              {Object.entries(c.analyses).map(([region, analysis]: [string, any]) => (
                <View key={region} style={styles.viewAnalysisItem}>
                  <Text style={styles.viewAnalysisRegion}>
                    {BODY_REGIONS.find(r => r.id === region)?.label || region}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                    <Text style={{ fontSize: 13, color: palette.gray600 }}>
                      Bruises: <Text style={{ fontWeight: '700', color: analysis.bruise_count > 0 ? palette.warning : palette.success }}>{analysis.bruise_count}</Text>
                    </Text>
                    <Text style={{ fontSize: 13, color: palette.gray600 }}>
                      Petechiae: <Text style={{ fontWeight: '700', color: analysis.petechiae_count > 0 ? palette.warning : palette.success }}>{analysis.petechiae_count}</Text>
                    </Text>
                    <Text style={{ fontSize: 13, color: palette.gray600 }}>
                      Severity: <Text style={{ fontWeight: '700' }}>{analysis.severity}</Text>
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Symptoms */}
          <View style={styles.viewSection}>
            <Text style={styles.viewSectionTitle}>🩺 Symptoms</Text>
            {(c.symptoms || []).length > 0 ? (
              c.symptoms.map((s) => (
                <View key={s} style={styles.viewSymptomItem}>
                  <Ionicons name="checkmark-circle" size={18} color={palette.primary} />
                  <Text style={styles.viewSymptomText}>
                    {SYMPTOM_OPTIONS.find(o => o.id === s)?.label || s}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.viewEmptyText}>No symptoms reported</Text>
            )}
          </View>

          {/* Energy */}
          <View style={styles.viewSection}>
            <Text style={styles.viewSectionTitle}>⚡ Energy Level</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 32 }}>{ENERGY_LEVELS.find(e => e.value === c.energy)?.emoji || '😐'}</Text>
              <Text style={{ fontSize: 16, fontWeight: '600', color: palette.gray700 }}>
                {ENERGY_LEVELS.find(e => e.value === c.energy)?.label || 'Okay'}
              </Text>
            </View>
          </View>

          {/* Activities */}
          {c.activities ? (
            <View style={styles.viewSection}>
              <Text style={styles.viewSectionTitle}>🏃 Activities</Text>
              <Text style={styles.viewNoteText}>{c.activities}</Text>
            </View>
          ) : null}

          {/* Notes */}
          {c.notes ? (
            <View style={styles.viewSection}>
              <Text style={styles.viewSectionTitle}>📝 Notes</Text>
              <Text style={styles.viewNoteText}>{c.notes}</Text>
            </View>
          ) : null}

          {/* Saved timestamp */}
          <Text style={styles.viewSavedAt}>
            Saved at {new Date(c.savedAt).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' })}
          </Text>
        </ScrollView>
      </View>
    );
  }

  // ─── WIZARD MODE ────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Wizard top bar with back to history */}
      <View style={styles.wizardTopBar}>
        <TouchableOpacity onPress={goBackToHistory} style={styles.wizardBackBtn}>
          <Ionicons name="arrow-back" size={20} color={palette.primary} />
          <Text style={styles.wizardBackText}>History</Text>
        </TouchableOpacity>
        <Text style={styles.wizardTopTitle}>Today's Check-in</Text>
        <View style={{ width: 70 }} />
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        {steps.map((s, i) => (
          <View key={s} style={styles.progressStep}>
            <View
              style={[
                styles.progressDot,
                i <= stepIndex && styles.progressDotActive,
              ]}
            >
              {i < stepIndex && (
                <Ionicons name="checkmark" size={12} color={palette.white} />
              )}
            </View>
            <Text
              style={[
                styles.progressLabel,
                i <= stepIndex && styles.progressLabelActive,
              ]}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Text>
            {i < steps.length - 1 && (
              <View
                style={[
                  styles.progressLine,
                  i < stepIndex && styles.progressLineActive,
                ]}
              />
            )}
          </View>
        ))}
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        {/* Step 1: Photos */}
        {step === 'photos' && (
          <View>
            <Text style={styles.stepTitle}>📸 Daily Photos</Text>
            <Text style={styles.stepDesc}>
              Take photos of each body region. AI will detect and count bruises, petechiae, and blisters.
            </Text>
            <View style={styles.regionGrid}>
              {BODY_REGIONS.map((region) => {
                const photo = photos[region.id];
                const isUploading = uploading === region.id;
                return (
                  <TouchableOpacity
                    key={region.id}
                    style={[
                      styles.regionCard,
                      photo && styles.regionCardDone,
                    ]}
                    onPress={() => handleTakePhoto(region.id)}
                    activeOpacity={0.7}
                    disabled={isUploading}
                  >
                    {photo ? (
                      <View style={styles.regionDone}>
                        <Image
                          source={{ uri: photo.localUri }}
                          style={styles.regionThumb}
                        />
                        {isUploading ? (
                          <View style={styles.uploadingOverlay}>
                            <ActivityIndicator size="small" color={palette.white} />
                            <Text style={styles.uploadingText}>Uploading...</Text>
                          </View>
                        ) : photo.blobPath ? (
                          <View style={styles.uploadedBadge}>
                            <Ionicons name="cloud-done" size={14} color={palette.white} />
                          </View>
                        ) : (
                          <View style={[styles.uploadedBadge, { backgroundColor: palette.warning }]}>
                            <Ionicons name="cloud-offline" size={14} color={palette.white} />
                          </View>
                        )}
                      </View>
                    ) : (
                      <View style={styles.regionIcon}>
                        <Ionicons name="camera-outline" size={28} color={palette.gray400} />
                      </View>
                    )}
                    <Text
                      style={[
                        styles.regionLabel,
                        photo && styles.regionLabelDone,
                      ]}
                    >
                      {region.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* AI Analysis Results */}
            {analyzing && (
              <View style={styles.aiAnalysisCard}>
                <ActivityIndicator size="small" color={palette.purple} />
                <Text style={styles.aiAnalyzingText}>
                  AI is analyzing {analyzing.replace('_', ' ')} for bruises...
                </Text>
              </View>
            )}

            {Object.keys(analyses).length > 0 && (
              <View style={styles.aiResultsCard}>
                <View style={styles.aiResultsHeader}>
                  <Ionicons name="sparkles" size={18} color={palette.purple} />
                  <Text style={styles.aiResultsTitle}>AI Bruise Analysis</Text>
                </View>
                {Object.entries(analyses).map(([region, analysis]) => (
                  <View key={region} style={styles.aiRegionResult}>
                    <Text style={styles.aiRegionName}>
                      {BODY_REGIONS.find((r) => r.id === region)?.label || region}
                    </Text>
                    <View style={styles.aiCountsRow}>
                      <View style={styles.aiCountBadge}>
                        <Text style={[styles.aiCountValue, { color: analysis.bruise_count > 0 ? palette.warning : palette.success }]}>
                          {analysis.bruise_count}
                        </Text>
                        <Text style={styles.aiCountLabel}>Bruises</Text>
                      </View>
                      <View style={styles.aiCountBadge}>
                        <Text style={[styles.aiCountValue, { color: analysis.petechiae_count > 0 ? palette.warning : palette.success }]}>
                          {analysis.petechiae_count}
                        </Text>
                        <Text style={styles.aiCountLabel}>Petechiae</Text>
                      </View>
                      <View style={styles.aiCountBadge}>
                        <Text style={[styles.aiCountValue, { color: analysis.blood_blisters > 0 ? palette.critical : palette.success }]}>
                          {analysis.blood_blisters}
                        </Text>
                        <Text style={styles.aiCountLabel}>Blisters</Text>
                      </View>
                      <View style={[styles.aiSeverityBadge, {
                        backgroundColor: analysis.severity === 'severe' ? palette.criticalLight
                          : analysis.severity === 'moderate' ? palette.warningLight
                          : palette.successLight,
                      }]}>
                        <Text style={[styles.aiSeverityText, {
                          color: analysis.severity === 'severe' ? palette.critical
                            : analysis.severity === 'moderate' ? palette.warning
                            : palette.success,
                        }]}>
                          {analysis.severity}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.aiSummaryText}>{analysis.summary}</Text>
                  </View>
                ))}
                {/* Totals */}
                <View style={styles.aiTotalsRow}>
                  <Text style={styles.aiTotalsLabel}>Total across all regions:</Text>
                  <Text style={styles.aiTotalsValue}>
                    {Object.values(analyses).reduce((sum, a) => sum + a.bruise_count, 0)} bruises,{' '}
                    {Object.values(analyses).reduce((sum, a) => sum + a.petechiae_count, 0)} petechiae
                  </Text>
                </View>
              </View>
            )}

            {/* Comparison preview (mock) */}
            {Object.keys(photos).length > 0 && (
              <View style={styles.comparisonCard}>
                <View style={styles.comparisonHeader}>
                  <Ionicons name="git-compare" size={18} color={palette.primary} />
                  <Text style={styles.comparisonTitle}>Day-over-Day Comparison</Text>
                </View>
                <View style={styles.comparisonPreview}>
                  <View style={styles.comparisonSide}>
                    <View style={styles.comparisonPlaceholder}>
                      <Text style={styles.comparisonPlaceholderText}>Yesterday</Text>
                    </View>
                  </View>
                  <Ionicons name="arrow-forward" size={20} color={palette.gray400} />
                  <View style={styles.comparisonSide}>
                    <View style={[styles.comparisonPlaceholder, { backgroundColor: palette.primaryLight }]}>
                      <Text style={styles.comparisonPlaceholderText}>Today</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.comparisonStats}>
                  <View style={styles.comparisonStat}>
                    <Text style={[styles.comparisonStatValue, { color: palette.critical }]}>+3</Text>
                    <Text style={styles.comparisonStatLabel}>New</Text>
                  </View>
                  <View style={styles.comparisonStat}>
                    <Text style={[styles.comparisonStatValue, { color: palette.success }]}>1</Text>
                    <Text style={styles.comparisonStatLabel}>Healing</Text>
                  </View>
                  <View style={styles.comparisonStat}>
                    <Text style={[styles.comparisonStatValue, { color: palette.gray500 }]}>0</Text>
                    <Text style={styles.comparisonStatLabel}>Resolved</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Step 2: Symptoms */}
        {step === 'symptoms' && (
          <View>
            <Text style={styles.stepTitle}>🩺 Symptoms</Text>
            <Text style={styles.stepDesc}>
              Select any symptoms observed today.
            </Text>
            {SYMPTOM_OPTIONS.map((symptom) => (
              <TouchableOpacity
                key={symptom.id}
                style={[
                  styles.symptomItem,
                  symptoms.includes(symptom.id) && styles.symptomItemActive,
                ]}
                onPress={() => toggleSymptom(symptom.id)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={symptom.icon as any}
                  size={20}
                  color={symptoms.includes(symptom.id) ? palette.primary : palette.gray400}
                />
                <Text
                  style={[
                    styles.symptomLabel,
                    symptoms.includes(symptom.id) && styles.symptomLabelActive,
                  ]}
                >
                  {symptom.label}
                </Text>
                {symptoms.includes(symptom.id) && (
                  <Ionicons name="checkmark-circle" size={22} color={palette.primary} />
                )}
              </TouchableOpacity>
            ))}

            {/* Energy level */}
            <Text style={[styles.stepTitle, { marginTop: 24 }]}>Energy Level</Text>
            <View style={styles.energyRow}>
              {ENERGY_LEVELS.map((e) => (
                <TouchableOpacity
                  key={e.value}
                  style={[
                    styles.energyBtn,
                    energy === e.value && styles.energyBtnActive,
                  ]}
                  onPress={() => setEnergy(e.value)}
                >
                  <Text style={styles.energyEmoji}>{e.emoji}</Text>
                  <Text
                    style={[
                      styles.energyLabel,
                      energy === e.value && styles.energyLabelActive,
                    ]}
                  >
                    {e.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Step 3: Notes */}
        {step === 'notes' && (
          <View>
            <Text style={styles.stepTitle}>📝 Notes</Text>
            <Text style={styles.stepDesc}>
              Any additional notes about today.
            </Text>
            <Text style={styles.inputLabel}>Activities / Events</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., Played soccer, fell down, bumped into table..."
              multiline
              numberOfLines={3}
              value={activities}
              onChangeText={setActivities}
              placeholderTextColor={palette.gray400}
            />
            <Text style={styles.inputLabel}>General Notes</Text>
            <TextInput
              style={[styles.textInput, { minHeight: 100 }]}
              placeholder="Any observations, concerns, or things to remember..."
              multiline
              numberOfLines={5}
              value={notes}
              onChangeText={setNotes}
              placeholderTextColor={palette.gray400}
            />
          </View>
        )}

        {/* Step 4: Review */}
        {step === 'review' && (
          <View>
            <Text style={styles.stepTitle}>✅ Review Check-in</Text>
            <View style={styles.reviewCard}>
              <Text style={styles.reviewSection}>Photos</Text>
              <Text style={styles.reviewValue}>
                {Object.keys(photos).length} of {BODY_REGIONS.length} regions captured
              </Text>
              {Object.keys(photos).length > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 }}>
                  <Ionicons name="cloud-done" size={14} color={palette.success} />
                  <Text style={{ fontSize: 12, color: palette.success }}>
                    {Object.values(photos).filter((p) => p.blobPath).length} uploaded to Azure
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.reviewCard}>
              <Text style={styles.reviewSection}>Symptoms</Text>
              {symptoms.length > 0 ? (
                symptoms.map((s) => (
                  <Text key={s} style={styles.reviewValue}>
                    • {SYMPTOM_OPTIONS.find((o) => o.id === s)?.label}
                  </Text>
                ))
              ) : (
                <Text style={styles.reviewValue}>No symptoms selected</Text>
              )}
            </View>
            <View style={styles.reviewCard}>
              <Text style={styles.reviewSection}>Energy Level</Text>
              <Text style={styles.reviewValue}>
                {ENERGY_LEVELS.find((e) => e.value === energy)?.emoji}{' '}
                {ENERGY_LEVELS.find((e) => e.value === energy)?.label}
              </Text>
            </View>
            {activities ? (
              <View style={styles.reviewCard}>
                <Text style={styles.reviewSection}>Activities</Text>
                <Text style={styles.reviewValue}>{activities}</Text>
              </View>
            ) : null}
            {notes ? (
              <View style={styles.reviewCard}>
                <Text style={styles.reviewSection}>Notes</Text>
                <Text style={styles.reviewValue}>{notes}</Text>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomBar}>
        {stepIndex > 0 && (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => { autoSave(); setStep(steps[stepIndex - 1]); }}
          >
            <Ionicons name="arrow-back" size={20} color={palette.primary} />
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }} />
        {stepIndex < steps.length - 1 ? (
          <TouchableOpacity
            style={styles.nextBtn}
            onPress={() => { autoSave(); setStep(steps[stepIndex + 1]); }}
          >
            <Text style={styles.nextBtnText}>Next</Text>
            <Ionicons name="arrow-forward" size={20} color={palette.white} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
            <Text style={styles.submitBtnText}>Save Check-in</Text>
            <Ionicons name="checkmark" size={20} color={palette.white} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.gray50 },
  scrollArea: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },

  // ─── History Mode ──────────────────────────────────────────────────
  historyTitle: { fontSize: 28, fontWeight: '800', color: palette.gray800, marginBottom: 4 },
  historySubtitle: { fontSize: 14, color: palette.gray500, marginBottom: 20 },

  todayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: palette.primaryLight,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  todayCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  todayBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: palette.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  todayBadgeDone: { backgroundColor: palette.successLight },
  todayLabel: { fontSize: 16, fontWeight: '700', color: palette.gray800, marginBottom: 2 },
  todayMeta: { fontSize: 12, color: palette.gray500, lineHeight: 18 },

  historySection: { marginTop: 4 },
  historySectionTitle: { fontSize: 16, fontWeight: '700', color: palette.gray700, marginBottom: 12 },

  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: palette.gray100,
  },
  historyCardDate: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: palette.gray50,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  historyCardDay: { fontSize: 18, fontWeight: '700', color: palette.gray800 },
  historyCardMonth: { fontSize: 10, fontWeight: '600', color: palette.gray500, textTransform: 'uppercase' },
  historyCardBody: { flex: 1 },
  historyCardTitle: { fontSize: 14, fontWeight: '600', color: palette.gray700, marginBottom: 4 },
  historyCardStats: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  historyStatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  historyStatText: { fontSize: 12, fontWeight: '600', color: palette.primary },
  historyEnergyEmoji: { fontSize: 16 },
  historyCardNote: { fontSize: 12, color: palette.gray400, marginTop: 2 },

  emptyHistory: { alignItems: 'center', marginTop: 40, gap: 8 },
  emptyHistoryText: { fontSize: 16, fontWeight: '600', color: palette.gray400 },
  emptyHistorySubtext: { fontSize: 13, color: palette.gray400 },

  // ─── View Mode ─────────────────────────────────────────────────────
  viewHeader: {
    backgroundColor: palette.white,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: palette.gray100,
  },
  viewBackBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  viewBackText: { fontSize: 15, color: palette.primary, fontWeight: '600' },
  viewDateTitle: { fontSize: 20, fontWeight: '700', color: palette.gray800 },

  viewSection: {
    backgroundColor: palette.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  viewSectionTitle: { fontSize: 16, fontWeight: '700', color: palette.gray800, marginBottom: 12 },
  viewPhotoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  viewPhotoItem: { alignItems: 'center', width: '30%' },
  viewPhotoThumb: { width: 80, height: 80, borderRadius: 12, marginBottom: 4 },
  viewPhotoLabel: { fontSize: 11, color: palette.gray500, fontWeight: '500' },
  viewAnalysisItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: palette.gray100,
  },
  viewAnalysisRegion: { fontSize: 13, fontWeight: '600', color: palette.gray600 },
  viewSymptomItem: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  viewSymptomText: { fontSize: 14, color: palette.gray700 },
  viewEmptyText: { fontSize: 14, color: palette.gray400, fontStyle: 'italic' },
  viewNoteText: { fontSize: 14, color: palette.gray700, lineHeight: 22 },
  viewSavedAt: { fontSize: 12, color: palette.gray400, textAlign: 'center', marginTop: 8 },

  // ─── Wizard top bar ────────────────────────────────────────────────
  wizardTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.gray100,
  },
  wizardBackBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 70 },
  wizardBackText: { fontSize: 14, color: palette.primary, fontWeight: '600' },
  wizardTopTitle: { fontSize: 16, fontWeight: '700', color: palette.gray800 },

  // ─── Progress Bar ──────────────────────────────────────────────────
  progressContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: palette.white,
    borderBottomWidth: 1,
    borderBottomColor: palette.gray100,
  },
  progressStep: {
    flex: 1,
    alignItems: 'center',
    flexDirection: 'row',
  },
  progressDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: palette.gray200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressDotActive: { backgroundColor: palette.primary },
  progressLabel: {
    fontSize: 10,
    color: palette.gray400,
    marginLeft: 4,
    fontWeight: '500',
  },
  progressLabelActive: { color: palette.primary },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: palette.gray200,
    marginHorizontal: 4,
  },
  progressLineActive: { backgroundColor: palette.primary },

  stepTitle: { fontSize: 20, fontWeight: '700', color: palette.gray800, marginBottom: 8 },
  stepDesc: { fontSize: 14, color: palette.gray500, marginBottom: 20, lineHeight: 20 },

  regionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  regionCard: {
    width: '47%',
    backgroundColor: palette.white,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: palette.gray200,
    borderStyle: 'dashed',
  },
  regionCardDone: {
    borderColor: palette.success,
    borderStyle: 'solid',
    backgroundColor: palette.successLight,
  },
  regionIcon: { marginBottom: 8 },
  regionDone: { marginBottom: 8, position: 'relative' },
  regionThumb: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingText: {
    color: palette.white,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
  },
  uploadedBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: palette.success,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: palette.white,
  },
  regionLabel: { fontSize: 13, fontWeight: '600', color: palette.gray600 },
  regionLabelDone: { color: palette.success },

  comparisonCard: {
    backgroundColor: palette.white,
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: palette.primaryLight,
  },
  comparisonHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  comparisonTitle: { fontSize: 15, fontWeight: '600', color: palette.gray800, marginLeft: 8 },
  comparisonPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  comparisonSide: { flex: 1 },
  comparisonPlaceholder: {
    height: 80,
    backgroundColor: palette.gray100,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  comparisonPlaceholderText: { fontSize: 12, color: palette.gray500 },
  comparisonStats: { flexDirection: 'row', justifyContent: 'space-around' },
  comparisonStat: { alignItems: 'center' },
  comparisonStatValue: { fontSize: 20, fontWeight: '700' },
  comparisonStatLabel: { fontSize: 11, color: palette.gray500, marginTop: 2 },

  symptomItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.white,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: palette.gray200,
    gap: 12,
  },
  symptomItemActive: {
    borderColor: palette.primary,
    backgroundColor: palette.primaryLight,
  },
  symptomLabel: { flex: 1, fontSize: 15, color: palette.gray600, fontWeight: '500' },
  symptomLabelActive: { color: palette.primary },

  energyRow: { flexDirection: 'row', gap: 8 },
  energyBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.gray200,
  },
  energyBtnActive: {
    borderColor: palette.primary,
    backgroundColor: palette.primaryLight,
  },
  energyEmoji: { fontSize: 24 },
  energyLabel: { fontSize: 9, color: palette.gray500, marginTop: 4, fontWeight: '500' },
  energyLabelActive: { color: palette.primary },

  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.gray700,
    marginBottom: 8,
    marginTop: 8,
  },
  textInput: {
    backgroundColor: palette.white,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: palette.gray800,
    borderWidth: 1,
    borderColor: palette.gray200,
    textAlignVertical: 'top',
    marginBottom: 16,
    minHeight: 60,
  },

  reviewCard: {
    backgroundColor: palette.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  reviewSection: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.gray500,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  reviewValue: { fontSize: 15, color: palette.gray800, lineHeight: 22 },

  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: palette.white,
    borderTopWidth: 1,
    borderTopColor: palette.gray100,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backBtnText: { fontSize: 15, color: palette.primary, fontWeight: '600' },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  nextBtnText: { fontSize: 15, color: palette.white, fontWeight: '600' },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.success,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  submitBtnText: { fontSize: 15, color: palette.white, fontWeight: '600' },

  // AI Analysis styles
  aiAnalysisCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.purpleLight,
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    gap: 10,
  },
  aiAnalyzingText: {
    fontSize: 13,
    color: palette.purple,
    fontWeight: '500',
    flex: 1,
  },
  aiResultsCard: {
    backgroundColor: palette.white,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: palette.purple + '30',
  },
  aiResultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  aiResultsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.purple,
  },
  aiRegionResult: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: palette.gray100,
  },
  aiRegionName: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.gray600,
    marginBottom: 6,
  },
  aiCountsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  aiCountBadge: {
    alignItems: 'center',
    backgroundColor: palette.gray50,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  aiCountValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  aiCountLabel: {
    fontSize: 9,
    color: palette.gray500,
    fontWeight: '500',
  },
  aiSeverityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 'auto',
  },
  aiSeverityText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  aiSummaryText: {
    fontSize: 13,
    color: palette.gray600,
    lineHeight: 18,
  },
  aiTotalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: palette.gray100,
    marginTop: 4,
  },
  aiTotalsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.gray500,
  },
  aiTotalsValue: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.gray800,
  },
});
