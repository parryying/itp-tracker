import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '@/constants/Colors';
import {
  Medication,
  DailyDose,
  getMedications,
  getDailyDoses,
  saveDailyDoses,
  addMedication,
  getSideEffects,
  saveSideEffects,
  formatDate,
} from '@/services/storageService';
import { useFocusEffect } from '@react-navigation/native';

// ─── Sub-components ───────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const config: Record<string, { color: string; bg: string; label: string }> = {
    active: { color: palette.success, bg: palette.successLight, label: 'Active' },
    tapering: { color: palette.warning, bg: palette.warningLight, label: 'Tapering' },
    discontinued: { color: palette.gray500, bg: palette.gray100, label: 'Stopped' },
  };
  const c = config[status] || config.active;
  return (
    <View style={[styles.statusPill, { backgroundColor: c.bg }]}>
      <Text style={[styles.statusPillText, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}

function DoseTimeline({
  history,
  color,
}: {
  history: { dose: string; startDate: string; endDate: string }[];
  color: string;
}) {
  return (
    <View style={styles.timeline}>
      {history.map((entry, i) => (
        <View key={i} style={styles.timelineItem}>
          <View style={styles.timelineLeft}>
            <View
              style={[
                styles.timelineDot,
                {
                  backgroundColor:
                    entry.endDate === 'Current' ? color : palette.gray300,
                },
              ]}
            />
            {i < history.length - 1 && <View style={styles.timelineLine} />}
          </View>
          <View style={styles.timelineContent}>
            <Text
              style={[
                styles.timelineDose,
                entry.endDate === 'Current' && { fontWeight: '700', color },
              ]}
            >
              {entry.dose}
            </Text>
            <Text style={styles.timelineDates}>
              {entry.startDate} — {entry.endDate}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function SideEffectToggle({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: boolean;
  onToggle: (val: boolean) => void;
}) {
  return (
    <View style={styles.sideEffectToggle}>
      <Text style={styles.sideEffectToggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: palette.gray200, true: palette.warningLight }}
        thumbColor={value ? palette.warning : palette.gray400}
      />
    </View>
  );
}

// ─── Add Medication Modal ─────────────────────────────────────────────

const CATEGORY_OPTIONS = [
  'Corticosteroid',
  'TPO Receptor Agonist',
  'Immunosuppressant',
  'Proton Pump Inhibitor',
  'Supplement',
  'Other',
];

const FREQUENCY_OPTIONS = [
  'Once daily (morning)',
  'Once daily (evening)',
  'Once daily (empty stomach)',
  'Once daily (before breakfast)',
  'Twice daily',
  'Three times daily',
  'As needed',
  'Weekly',
];

const COLOR_OPTIONS = [
  palette.primary,
  palette.warning,
  palette.teal,
  palette.success,
  palette.purple,
  palette.critical,
];

function AddMedicationModal({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (med: Medication) => void;
}) {
  const [name, setName] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [dose, setDose] = React.useState('');
  const [frequency, setFrequency] = React.useState('');
  const [selectedColor, setSelectedColor] = React.useState(COLOR_OPTIONS[0]);
  const [showCategories, setShowCategories] = React.useState(false);
  const [showFrequencies, setShowFrequencies] = React.useState(false);

  const resetForm = () => {
    setName('');
    setCategory('');
    setDose('');
    setFrequency('');
    setSelectedColor(COLOR_OPTIONS[0]);
    setShowCategories(false);
    setShowFrequencies(false);
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a medication name.');
      return;
    }
    if (!dose.trim()) {
      Alert.alert('Required', 'Please enter a dosage.');
      return;
    }

    const newMed: Medication = {
      id: Date.now().toString(),
      name: name.trim(),
      category: category || 'Other',
      currentDose: dose.trim(),
      frequency: frequency || 'Once daily (morning)',
      startDate: formatDate(),
      status: 'active',
      sideEffects: [],
      dosageHistory: [
        { dose: dose.trim(), startDate: formatDate(), endDate: 'Current' },
      ],
      nextChange: 'Review at next visit',
      color: selectedColor,
    };

    onSave(newMed);
    resetForm();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Medication</Text>
            <TouchableOpacity onPress={() => { resetForm(); onClose(); }}>
              <Ionicons name="close" size={24} color={palette.gray500} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {/* Name */}
            <Text style={styles.fieldLabel}>Medication Name *</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="e.g., Prednisone, Eltrombopag..."
              value={name}
              onChangeText={setName}
              placeholderTextColor={palette.gray400}
              autoFocus
            />

            {/* Category */}
            <Text style={styles.fieldLabel}>Category</Text>
            <TouchableOpacity
              style={styles.fieldSelect}
              onPress={() => setShowCategories(!showCategories)}
            >
              <Text style={category ? styles.fieldSelectText : styles.fieldSelectPlaceholder}>
                {category || 'Select category...'}
              </Text>
              <Ionicons
                name={showCategories ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={palette.gray400}
              />
            </TouchableOpacity>
            {showCategories && (
              <View style={styles.optionsList}>
                {CATEGORY_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.optionItem, category === opt && styles.optionItemActive]}
                    onPress={() => { setCategory(opt); setShowCategories(false); }}
                  >
                    <Text style={[styles.optionText, category === opt && styles.optionTextActive]}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Dose */}
            <Text style={styles.fieldLabel}>Dosage *</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="e.g., 10mg, 50mg, 1000 IU..."
              value={dose}
              onChangeText={setDose}
              placeholderTextColor={palette.gray400}
            />

            {/* Frequency */}
            <Text style={styles.fieldLabel}>Frequency</Text>
            <TouchableOpacity
              style={styles.fieldSelect}
              onPress={() => setShowFrequencies(!showFrequencies)}
            >
              <Text style={frequency ? styles.fieldSelectText : styles.fieldSelectPlaceholder}>
                {frequency || 'Select frequency...'}
              </Text>
              <Ionicons
                name={showFrequencies ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={palette.gray400}
              />
            </TouchableOpacity>
            {showFrequencies && (
              <View style={styles.optionsList}>
                {FREQUENCY_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.optionItem, frequency === opt && styles.optionItemActive]}
                    onPress={() => { setFrequency(opt); setShowFrequencies(false); }}
                  >
                    <Text style={[styles.optionText, frequency === opt && styles.optionTextActive]}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Color */}
            <Text style={styles.fieldLabel}>Color Tag</Text>
            <View style={styles.colorRow}>
              {COLOR_OPTIONS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: c },
                    selectedColor === c && styles.colorSwatchActive,
                  ]}
                  onPress={() => setSelectedColor(c)}
                >
                  {selectedColor === c && (
                    <Ionicons name="checkmark" size={16} color={palette.white} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Save Button */}
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Ionicons name="checkmark-circle" size={22} color={palette.white} />
            <Text style={styles.saveBtnText}>Add Medication</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Side Effects List ────────────────────────────────────────────────

const SIDE_EFFECT_OPTIONS = [
  'Mood changes / irritability',
  'Increased appetite',
  'Weight change',
  'Sleep difficulty',
  'Headache',
  'Stomach upset',
  'Fatigue',
];

// ─── Main Screen ──────────────────────────────────────────────────────

export default function MedsScreen() {
  const [medications, setMedications] = React.useState<Medication[]>([]);
  const [doses, setDoses] = React.useState<DailyDose[]>([]);
  const [expandedMed, setExpandedMed] = React.useState<string | null>('1');
  const [showSideEffects, setShowSideEffects] = React.useState(false);
  const [sideEffects, setSideEffects] = React.useState<Record<string, boolean>>({});
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  // Load data on focus
  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      const [meds, dailyDoses, effects] = await Promise.all([
        getMedications(),
        getDailyDoses(),
        getSideEffects(),
      ]);
      setMedications(meds);
      setDoses(dailyDoses);
      setSideEffects(effects);
    } catch (error) {
      console.error('Failed to load meds data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleDose = async (medId: string) => {
    const updated = doses.map((d) =>
      d.medId === medId
        ? {
            ...d,
            taken: !d.taken,
            takenAt: !d.taken
              ? new Date().toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                })
              : null,
          }
        : d
    );
    setDoses(updated);
    await saveDailyDoses(updated);
  };

  const handleToggleSideEffect = async (label: string, value: boolean) => {
    const updated = { ...sideEffects, [label]: value };
    setSideEffects(updated);
    await saveSideEffects(updated);
  };

  const handleAddMedication = async (med: Medication) => {
    const updated = await addMedication(med);
    setMedications(updated);
    // Add a dose entry for the new med
    const newDose: DailyDose = {
      medId: med.id,
      medName: med.name,
      dose: med.currentDose,
      time: '8:00 AM',
      taken: false,
      takenAt: null,
    };
    const updatedDoses = [...doses, newDose];
    setDoses(updatedDoses);
    await saveDailyDoses(updatedDoses);
    setShowAddModal(false);
    Alert.alert('Added', `${med.name} has been added to your medications.`);
  };

  const takenCount = doses.filter((d) => d.taken).length;

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: palette.gray500 }}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Today's Doses */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Today's Doses</Text>
          <Text style={styles.doseProgress}>
            {takenCount}/{doses.length} taken
          </Text>
        </View>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${doses.length > 0 ? (takenCount / doses.length) * 100 : 0}%`,
                backgroundColor:
                  takenCount === doses.length && doses.length > 0 ? palette.success : palette.primary,
              },
            ]}
          />
        </View>
        {doses.map((dose) => (
          <TouchableOpacity
            key={dose.medId}
            style={styles.doseItem}
            onPress={() => handleToggleDose(dose.medId)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.doseCheck,
                dose.taken && styles.doseCheckDone,
              ]}
            >
              {dose.taken && (
                <Ionicons name="checkmark" size={14} color={palette.white} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.doseName,
                  dose.taken && styles.doseNameDone,
                ]}
              >
                {dose.medName}
              </Text>
              <Text style={styles.doseInfo}>
                {dose.dose} · {dose.time}
              </Text>
            </View>
            {dose.taken && dose.takenAt && (
              <Text style={styles.doseTakenAt}>✓ {dose.takenAt}</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Side Effects Log */}
      <TouchableOpacity
        style={styles.sideEffectCard}
        onPress={() => setShowSideEffects(!showSideEffects)}
        activeOpacity={0.8}
      >
        <View style={styles.sideEffectHeader}>
          <Ionicons name="alert-circle" size={18} color={palette.warning} />
          <Text style={styles.sideEffectTitle}>Side Effect Check</Text>
          <Ionicons
            name={showSideEffects ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={palette.gray400}
          />
        </View>
        {showSideEffects && (
          <View style={styles.sideEffectList}>
            {SIDE_EFFECT_OPTIONS.map((effect) => (
              <SideEffectToggle
                key={effect}
                label={effect}
                value={!!sideEffects[effect]}
                onToggle={(val) => handleToggleSideEffect(effect, val)}
              />
            ))}
          </View>
        )}
      </TouchableOpacity>

      {/* Medication Details */}
      <Text style={styles.sectionTitle}>Medications</Text>
      {medications.map((med) => {
        const isExpanded = expandedMed === med.id;
        return (
          <View key={med.id} style={styles.medCard}>
            <TouchableOpacity
              style={styles.medHeader}
              onPress={() => setExpandedMed(isExpanded ? null : med.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.medColorBar, { backgroundColor: med.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.medName}>{med.name}</Text>
                <Text style={styles.medCategory}>{med.category}</Text>
              </View>
              <StatusPill status={med.status} />
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={palette.gray400}
                style={{ marginLeft: 8 }}
              />
            </TouchableOpacity>

            {isExpanded && (
              <View style={styles.medDetails}>
                <View style={styles.medDetailRow}>
                  <Text style={styles.medDetailLabel}>Current Dose</Text>
                  <Text style={styles.medDetailValue}>{med.currentDose}</Text>
                </View>
                <View style={styles.medDetailRow}>
                  <Text style={styles.medDetailLabel}>Frequency</Text>
                  <Text style={styles.medDetailValue}>{med.frequency}</Text>
                </View>
                <View style={styles.medDetailRow}>
                  <Text style={styles.medDetailLabel}>Started</Text>
                  <Text style={styles.medDetailValue}>{med.startDate}</Text>
                </View>
                <View style={styles.medDetailRow}>
                  <Text style={styles.medDetailLabel}>Next Change</Text>
                  <Text style={[styles.medDetailValue, { color: palette.primary }]}>
                    {med.nextChange}
                  </Text>
                </View>

                {/* Dosage History Timeline */}
                <Text style={styles.timelineTitle}>Dosage History</Text>
                <DoseTimeline history={med.dosageHistory} color={med.color} />

                {/* Known Side Effects */}
                {med.sideEffects.length > 0 && (
                  <View style={styles.knownSideEffects}>
                    <Text style={styles.knownSideEffectsTitle}>
                      Known Side Effects
                    </Text>
                    {med.sideEffects.map((se, i) => (
                      <Text key={i} style={styles.sideEffectItem}>
                        • {se}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        );
      })}

      {/* Add Medication Button */}
      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => setShowAddModal(true)}
      >
        <Ionicons name="add-circle" size={22} color={palette.primary} />
        <Text style={styles.addBtnText}>Add Medication</Text>
      </TouchableOpacity>

      <View style={{ height: 32 }} />

      {/* Add Medication Modal */}
      <AddMedicationModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddMedication}
      />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.gray50 },
  content: { padding: 16 },

  card: {
    backgroundColor: palette.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: palette.gray800 },
  doseProgress: { fontSize: 14, fontWeight: '600', color: palette.primary },
  progressBar: {
    height: 4,
    backgroundColor: palette.gray100,
    borderRadius: 2,
    marginBottom: 12,
  },
  progressFill: { height: 4, borderRadius: 2 },

  doseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: palette.gray100,
  },
  doseCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: palette.gray300,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doseCheckDone: { backgroundColor: palette.success, borderColor: palette.success },
  doseName: { fontSize: 15, fontWeight: '500', color: palette.gray800 },
  doseNameDone: { textDecorationLine: 'line-through', color: palette.gray400 },
  doseInfo: { fontSize: 12, color: palette.gray500, marginTop: 2 },
  doseTakenAt: { fontSize: 12, color: palette.success, fontWeight: '500' },

  sideEffectCard: {
    backgroundColor: palette.warningLight,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: palette.warning + '30',
  },
  sideEffectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sideEffectTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: palette.gray800,
  },
  sideEffectList: { marginTop: 12 },
  sideEffectToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  sideEffectToggleLabel: { fontSize: 14, color: palette.gray700 },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.gray800,
    marginBottom: 12,
    marginTop: 8,
  },

  medCard: {
    backgroundColor: palette.white,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  medHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  medColorBar: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
  },
  medName: { fontSize: 15, fontWeight: '600', color: palette.gray800 },
  medCategory: { fontSize: 12, color: palette.gray500, marginTop: 2 },

  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusPillText: { fontSize: 11, fontWeight: '600' },

  medDetails: { padding: 16, paddingTop: 0, borderTopWidth: 1, borderTopColor: palette.gray100 },
  medDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: palette.gray50,
  },
  medDetailLabel: { fontSize: 13, color: palette.gray500 },
  medDetailValue: { fontSize: 13, fontWeight: '600', color: palette.gray700 },

  timelineTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.gray500,
    marginTop: 16,
    marginBottom: 8,
  },
  timeline: { paddingLeft: 4 },
  timelineItem: { flexDirection: 'row', minHeight: 40 },
  timelineLeft: { width: 20, alignItems: 'center' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: palette.gray200,
    marginVertical: 2,
  },
  timelineContent: { flex: 1, marginLeft: 10, paddingBottom: 8 },
  timelineDose: { fontSize: 14, color: palette.gray700 },
  timelineDates: { fontSize: 11, color: palette.gray400, marginTop: 2 },

  knownSideEffects: {
    marginTop: 12,
    backgroundColor: palette.gray50,
    padding: 12,
    borderRadius: 10,
  },
  knownSideEffectsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.gray500,
    marginBottom: 6,
  },
  sideEffectItem: { fontSize: 13, color: palette.gray600, marginBottom: 2 },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primaryLight,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 4,
  },
  addBtnText: { fontSize: 15, fontWeight: '600', color: palette.primary },

  // ─── Modal Styles ──────────────────────────────────────────────────

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: palette.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: palette.gray100,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: palette.gray800 },
  modalScroll: { paddingHorizontal: 20 },

  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.gray700,
    marginTop: 16,
    marginBottom: 8,
  },
  fieldInput: {
    backgroundColor: palette.gray50,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: palette.gray800,
    borderWidth: 1,
    borderColor: palette.gray200,
  },
  fieldSelect: {
    backgroundColor: palette.gray50,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.gray200,
  },
  fieldSelectText: { fontSize: 15, color: palette.gray800 },
  fieldSelectPlaceholder: { fontSize: 15, color: palette.gray400 },
  optionsList: {
    backgroundColor: palette.white,
    borderRadius: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: palette.gray200,
    overflow: 'hidden',
  },
  optionItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: palette.gray100,
  },
  optionItemActive: { backgroundColor: palette.primaryLight },
  optionText: { fontSize: 14, color: palette.gray700 },
  optionTextActive: { color: palette.primary, fontWeight: '600' },

  colorRow: {
    flexDirection: 'row',
    gap: 12,
  },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorSwatchActive: {
    borderWidth: 3,
    borderColor: palette.gray800,
  },

  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primary,
    marginHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  saveBtnText: { fontSize: 16, fontWeight: '600', color: palette.white },
});
