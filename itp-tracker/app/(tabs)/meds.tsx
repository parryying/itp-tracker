import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '@/constants/Colors';

// Mock medication data
const MOCK_MEDICATIONS = [
  {
    id: '1',
    name: 'Prednisone',
    category: 'Corticosteroid',
    currentDose: '10mg',
    frequency: 'Once daily (morning)',
    startDate: 'Jan 5, 2026',
    status: 'tapering',
    sideEffects: ['Mood changes', 'Weight gain', 'Increased appetite'],
    dosageHistory: [
      { dose: '20mg', startDate: 'Jan 5', endDate: 'Feb 1' },
      { dose: '15mg', startDate: 'Feb 2', endDate: 'Feb 28' },
      { dose: '10mg', startDate: 'Mar 1', endDate: 'Current' },
    ],
    nextChange: 'Taper to 7.5mg on Mar 15',
    color: palette.warning,
  },
  {
    id: '2',
    name: 'Eltrombopag (Promacta)',
    category: 'TPO Receptor Agonist',
    currentDose: '50mg',
    frequency: 'Once daily (empty stomach)',
    startDate: 'Feb 16, 2026',
    status: 'active',
    sideEffects: ['Liver enzyme elevation', 'Headache'],
    dosageHistory: [
      { dose: '25mg', startDate: 'Feb 16', endDate: 'Feb 22' },
      { dose: '50mg', startDate: 'Feb 23', endDate: 'Current' },
    ],
    nextChange: 'Review at next visit',
    color: palette.primary,
  },
  {
    id: '3',
    name: 'Omeprazole',
    category: 'Proton Pump Inhibitor',
    currentDose: '20mg',
    frequency: 'Once daily (before breakfast)',
    startDate: 'Jan 5, 2026',
    status: 'active',
    sideEffects: [],
    dosageHistory: [
      { dose: '20mg', startDate: 'Jan 5', endDate: 'Current' },
    ],
    nextChange: 'Continue while on prednisone',
    color: palette.teal,
  },
  {
    id: '4',
    name: 'Vitamin D3',
    category: 'Supplement',
    currentDose: '1000 IU',
    frequency: 'Once daily',
    startDate: 'Jan 5, 2026',
    status: 'active',
    sideEffects: [],
    dosageHistory: [
      { dose: '1000 IU', startDate: 'Jan 5', endDate: 'Current' },
    ],
    nextChange: 'Continue while on prednisone',
    color: palette.success,
  },
];

// Mock today's doses
const initialDoses = [
  { medId: '1', medName: 'Prednisone', dose: '10mg', time: '8:00 AM', taken: true, takenAt: '8:12 AM' },
  { medId: '2', medName: 'Eltrombopag', dose: '50mg', time: '6:00 PM', taken: false, takenAt: null },
  { medId: '3', medName: 'Omeprazole', dose: '20mg', time: '7:30 AM', taken: true, takenAt: '7:35 AM' },
  { medId: '4', medName: 'Vitamin D3', dose: '1000 IU', time: '8:00 AM', taken: true, takenAt: '8:12 AM' },
];

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

export default function MedsScreen() {
  const [doses, setDoses] = React.useState(initialDoses);
  const [expandedMed, setExpandedMed] = React.useState<string | null>('1');
  const [showSideEffects, setShowSideEffects] = React.useState(false);

  const toggleDose = (medId: string) => {
    setDoses((prev) =>
      prev.map((d) =>
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
      )
    );
  };

  const takenCount = doses.filter((d) => d.taken).length;

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
                width: `${(takenCount / doses.length) * 100}%`,
                backgroundColor:
                  takenCount === doses.length ? palette.success : palette.primary,
              },
            ]}
          />
        </View>
        {doses.map((dose) => (
          <TouchableOpacity
            key={dose.medId}
            style={styles.doseItem}
            onPress={() => toggleDose(dose.medId)}
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
            {[
              'Mood changes / irritability',
              'Increased appetite',
              'Weight change',
              'Sleep difficulty',
              'Headache',
              'Stomach upset',
              'Fatigue',
            ].map((effect, i) => (
              <SideEffectToggle key={i} label={effect} />
            ))}
          </View>
        )}
      </TouchableOpacity>

      {/* Medication Details */}
      <Text style={styles.sectionTitle}>Medications</Text>
      {MOCK_MEDICATIONS.map((med) => {
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
        onPress={() => Alert.alert('Add Medication', 'Medication form would open here.')}
      >
        <Ionicons name="add-circle" size={22} color={palette.primary} />
        <Text style={styles.addBtnText}>Add Medication</Text>
      </TouchableOpacity>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function SideEffectToggle({ label }: { label: string }) {
  const [on, setOn] = React.useState(false);
  return (
    <View style={styles.sideEffectToggle}>
      <Text style={styles.sideEffectToggleLabel}>{label}</Text>
      <Switch
        value={on}
        onValueChange={setOn}
        trackColor={{ false: palette.gray200, true: palette.warningLight }}
        thumbColor={on ? palette.warning : palette.gray400}
      />
    </View>
  );
}

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
});
