import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { palette } from '@/constants/Colors';

const { width } = Dimensions.get('window');

// Mock data — will be replaced with real data from DB
const MOCK = {
  date: 'March 9, 2026',
  plateletCount: 28,
  plateletTrend: 'down',
  plateletPrev: 47,
  bruiseCount: 7,
  bruisePrev: 4,
  newBruises: 3,
  healingBruises: 1,
  medsToday: [
    { name: 'Prednisone', dose: '10mg', taken: true },
    { name: 'Eltrombopag', dose: '50mg', taken: false },
    { name: 'Omeprazole', dose: '20mg', taken: true },
  ],
  lastLabDate: '2 days ago',
  aiSummarySnippet:
    'Platelets dropped to 28k — likely related to prednisone taper. 3 new bruises detected. ALT trending up.',
  questionsCount: 5,
};

function StatusBadge({ level }: { level: 'critical' | 'warning' | 'good' }) {
  const config = {
    critical: { color: palette.critical, bg: palette.criticalLight, label: 'Needs Attention' },
    warning: { color: palette.warning, bg: palette.warningLight, label: 'Monitor' },
    good: { color: palette.success, bg: palette.successLight, label: 'Stable' },
  };
  const c = config[level];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <View style={[styles.badgeDot, { backgroundColor: c.color }]} />
      <Text style={[styles.badgeText, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}

function StatCard({
  icon,
  label,
  value,
  unit,
  subtitle,
  color,
  onPress,
}: {
  icon: string;
  label: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  color: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={styles.statCard} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.statIconWrap, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statRow}>
        <Text style={[styles.statValue, { color }]}>{value}</Text>
        {unit && <Text style={styles.statUnit}>{unit}</Text>}
      </View>
      {subtitle && <Text style={styles.statSub}>{subtitle}</Text>}
    </TouchableOpacity>
  );
}

function MedCheckItem({
  name,
  dose,
  taken,
  onToggle,
}: {
  name: string;
  dose: string;
  taken: boolean;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity style={styles.medItem} onPress={onToggle} activeOpacity={0.7}>
      <View style={[styles.medCheck, taken && styles.medCheckDone]}>
        {taken && <Ionicons name="checkmark" size={14} color={palette.white} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.medName, taken && styles.medNameDone]}>{name}</Text>
        <Text style={styles.medDose}>{dose}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={palette.gray300} />
    </TouchableOpacity>
  );
}

// Mini platelet sparkline (simple visual)
function PlateletSparkline() {
  const points = [65, 72, 58, 47, 52, 45, 28];
  const max = 80;
  const h = 40;
  return (
    <View style={styles.sparkline}>
      {points.map((p, i) => (
        <View key={i} style={styles.sparkCol}>
          <View
            style={[
              styles.sparkBar,
              {
                height: (p / max) * h,
                backgroundColor:
                  p < 30 ? palette.critical : p < 50 ? palette.warning : palette.primary,
                borderRadius: 2,
              },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const [meds, setMeds] = React.useState(MOCK.medsToday);

  const toggleMed = (index: number) => {
    setMeds((prev) =>
      prev.map((m, i) => (i === index ? { ...m, taken: !m.taken } : m))
    );
  };

  const medsTaken = meds.filter((m) => m.taken).length;
  const status = MOCK.plateletCount < 30 ? 'critical' : MOCK.plateletCount < 50 ? 'warning' : 'good';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>ITP Tracker</Text>
          <Text style={styles.date}>{MOCK.date}</Text>
        </View>
        <StatusBadge level={status} />
      </View>

      {/* Quick Stats */}
      <View style={styles.statsGrid}>
        <StatCard
          icon="water"
          label="Platelets"
          value={MOCK.plateletCount}
          unit="k/µL"
          subtitle={`${MOCK.plateletTrend === 'down' ? '↓' : '↑'} from ${MOCK.plateletPrev}k`}
          color={MOCK.plateletCount < 30 ? palette.critical : palette.warning}
          onPress={() => router.push('/(tabs)/labs')}
        />
        <StatCard
          icon="ellipse"
          label="Bruises"
          value={MOCK.bruiseCount}
          subtitle={`+${MOCK.newBruises} new today`}
          color={MOCK.newBruises > 2 ? palette.warning : palette.success}
          onPress={() => router.push('/(tabs)/checkin')}
        />
      </View>

      {/* Platelet Trend Mini */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Platelet Trend (7 entries)</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/labs')}>
            <Text style={styles.cardLink}>View All →</Text>
          </TouchableOpacity>
        </View>
        <PlateletSparkline />
        <View style={styles.sparkLabels}>
          <Text style={styles.sparkLabel}>7 entries ago</Text>
          <Text style={styles.sparkLabel}>Today</Text>
        </View>
      </View>

      {/* AI Summary */}
      <TouchableOpacity
        style={styles.aiCard}
        onPress={() => router.push('/(tabs)/reports')}
        activeOpacity={0.8}
      >
        <View style={styles.aiHeader}>
          <Ionicons name="sparkles" size={18} color={palette.purple} />
          <Text style={styles.aiTitle}>AI Analysis</Text>
          <View style={styles.aiBadge}>
            <Text style={styles.aiBadgeText}>{MOCK.questionsCount} questions</Text>
          </View>
        </View>
        <Text style={styles.aiText}>{MOCK.aiSummarySnippet}</Text>
        <Text style={styles.aiLink}>Read full analysis & doctor questions →</Text>
      </TouchableOpacity>

      {/* Meds Today */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Medications Today</Text>
          <Text style={styles.medProgress}>
            {medsTaken}/{meds.length}
          </Text>
        </View>
        {/* Progress bar */}
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${(medsTaken / meds.length) * 100}%` },
            ]}
          />
        </View>
        {meds.map((med, i) => (
          <MedCheckItem
            key={i}
            name={med.name}
            dose={med.dose}
            taken={med.taken}
            onToggle={() => toggleMed(i)}
          />
        ))}
      </View>

      {/* Quick Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => router.push('/(tabs)/checkin')}
        >
          <Ionicons name="camera" size={24} color={palette.primary} />
          <Text style={styles.actionLabel}>Daily{'\n'}Check-in</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => router.push('/(tabs)/labs')}
        >
          <Ionicons name="flask" size={24} color={palette.teal} />
          <Text style={styles.actionLabel}>View{'\n'}Labs</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => router.push('/(tabs)/reports')}
        >
          <Ionicons name="document-text" size={24} color={palette.purple} />
          <Text style={styles.actionLabel}>Doctor{'\n'}Report</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.gray50 },
  content: { padding: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: { fontSize: 26, fontWeight: '700', color: palette.gray800 },
  date: { fontSize: 14, color: palette.gray500, marginTop: 2 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  badgeText: { fontSize: 12, fontWeight: '600' },

  statsGrid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: palette.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statLabel: { fontSize: 12, color: palette.gray500, fontWeight: '500' },
  statRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
  statValue: { fontSize: 28, fontWeight: '700' },
  statUnit: { fontSize: 13, color: palette.gray500, marginLeft: 3 },
  statSub: { fontSize: 12, color: palette.gray400, marginTop: 4 },

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
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: palette.gray800 },
  cardLink: { fontSize: 13, color: palette.primary, fontWeight: '500' },

  sparkline: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 44,
    gap: 6,
    paddingHorizontal: 4,
  },
  sparkCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  sparkBar: { width: '100%', minHeight: 4 },
  sparkLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  sparkLabel: { fontSize: 10, color: palette.gray400 },

  aiCard: {
    backgroundColor: palette.purpleLight,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: palette.purple + '30',
  },
  aiHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  aiTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.purple,
    marginLeft: 6,
    flex: 1,
  },
  aiBadge: {
    backgroundColor: palette.purple + '20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  aiBadgeText: { fontSize: 11, fontWeight: '600', color: palette.purple },
  aiText: { fontSize: 14, color: palette.gray700, lineHeight: 20 },
  aiLink: {
    fontSize: 13,
    color: palette.purple,
    fontWeight: '500',
    marginTop: 8,
  },

  medProgress: { fontSize: 14, fontWeight: '600', color: palette.primary },
  progressBar: {
    height: 4,
    backgroundColor: palette.gray100,
    borderRadius: 2,
    marginBottom: 12,
  },
  progressFill: {
    height: 4,
    backgroundColor: palette.success,
    borderRadius: 2,
  },
  medItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: palette.gray100,
  },
  medCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: palette.gray300,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  medCheckDone: {
    backgroundColor: palette.success,
    borderColor: palette.success,
  },
  medName: { fontSize: 15, fontWeight: '500', color: palette.gray800 },
  medNameDone: { textDecorationLine: 'line-through', color: palette.gray400 },
  medDose: { fontSize: 12, color: palette.gray500, marginTop: 1 },

  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: palette.white,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.gray600,
    textAlign: 'center',
    marginTop: 6,
  },
});
