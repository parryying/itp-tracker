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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '@/constants/Colors';

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

export default function CheckinScreen() {
  const [step, setStep] = React.useState<Step>('photos');
  const [photos, setPhotos] = React.useState<Record<string, string | null>>({});
  const [symptoms, setSymptoms] = React.useState<string[]>([]);
  const [energy, setEnergy] = React.useState(3);
  const [notes, setNotes] = React.useState('');
  const [activities, setActivities] = React.useState('');

  const steps: Step[] = ['photos', 'symptoms', 'notes', 'review'];
  const stepIndex = steps.indexOf(step);

  const handleTakePhoto = (regionId: string) => {
    // In production, this would launch expo-image-picker
    Alert.alert(
      'Camera',
      `This would open the camera to photograph: ${regionId}\n\nThe photo will be sent to AI for bruise detection and counting.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Simulate Photo',
          onPress: () => setPhotos((p) => ({ ...p, [regionId]: 'captured' })),
        },
      ]
    );
  };

  const toggleSymptom = (id: string) => {
    setSymptoms((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleSubmit = () => {
    Alert.alert(
      'Check-in Saved',
      'Your daily check-in has been saved. AI analysis will be generated shortly.',
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={styles.container}>
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
              {BODY_REGIONS.map((region) => (
                <TouchableOpacity
                  key={region.id}
                  style={[
                    styles.regionCard,
                    photos[region.id] && styles.regionCardDone,
                  ]}
                  onPress={() => handleTakePhoto(region.id)}
                  activeOpacity={0.7}
                >
                  {photos[region.id] ? (
                    <View style={styles.regionDone}>
                      <Ionicons name="checkmark-circle" size={32} color={palette.success} />
                    </View>
                  ) : (
                    <View style={styles.regionIcon}>
                      <Ionicons name="camera-outline" size={28} color={palette.gray400} />
                    </View>
                  )}
                  <Text
                    style={[
                      styles.regionLabel,
                      photos[region.id] && styles.regionLabelDone,
                    ]}
                  >
                    {region.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

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
            onPress={() => setStep(steps[stepIndex - 1])}
          >
            <Ionicons name="arrow-back" size={20} color={palette.primary} />
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }} />
        {stepIndex < steps.length - 1 ? (
          <TouchableOpacity
            style={styles.nextBtn}
            onPress={() => setStep(steps[stepIndex + 1])}
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
  regionDone: { marginBottom: 8 },
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
});
