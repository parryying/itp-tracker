import React, { useEffect, useCallback } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '@/constants/Colors';
import { interpretLabResults, LabInterpretation } from '@/services/azureOpenAIService';
import { HealthProviderService, FHIRLabSet } from '@/services/healthProviderService';
import { AppleHealthService } from '@/services/appleHealthService';
import ConnectLabsModal from '../connect-labs';

const { width } = Dimensions.get('window');

// Mock lab data — will come from MyChart FHIR sync
const MOCK_LABS = [
  {
    date: 'Mar 7, 2026',
    isNew: true,
    panels: [
      {
        name: 'CBC with Differential',
        items: [
          { name: 'Platelets', value: 28, unit: 'k/µL', ref: '150-400', status: 'critical' },
          { name: 'WBC', value: 6.2, unit: 'k/µL', ref: '4.5-11', status: 'normal' },
          { name: 'RBC', value: 4.5, unit: 'M/µL', ref: '4.0-5.5', status: 'normal' },
          { name: 'Hemoglobin', value: 12.8, unit: 'g/dL', ref: '11.5-15.5', status: 'normal' },
          { name: 'Hematocrit', value: 38.2, unit: '%', ref: '34-45', status: 'normal' },
          { name: 'MPV', value: 11.2, unit: 'fL', ref: '7.5-11.5', status: 'warning' },
          { name: 'Neutrophils', value: 55, unit: '%', ref: '40-70', status: 'normal' },
          { name: 'Lymphocytes', value: 32, unit: '%', ref: '20-45', status: 'normal' },
        ],
      },
      {
        name: 'Comprehensive Metabolic Panel',
        items: [
          { name: 'ALT', value: 52, unit: 'U/L', ref: '7-35', status: 'warning' },
          { name: 'AST', value: 28, unit: 'U/L', ref: '8-33', status: 'normal' },
          { name: 'Bilirubin, Total', value: 0.8, unit: 'mg/dL', ref: '0.1-1.2', status: 'normal' },
          { name: 'Glucose', value: 92, unit: 'mg/dL', ref: '70-100', status: 'normal' },
          { name: 'BUN', value: 14, unit: 'mg/dL', ref: '7-20', status: 'normal' },
          { name: 'Creatinine', value: 0.5, unit: 'mg/dL', ref: '0.3-0.7', status: 'normal' },
        ],
      },
      {
        name: 'Immunology',
        items: [
          { name: 'IgG', value: 680, unit: 'mg/dL', ref: '700-1600', status: 'warning' },
          { name: 'IgA', value: 120, unit: 'mg/dL', ref: '70-400', status: 'normal' },
          { name: 'IgM', value: 95, unit: 'mg/dL', ref: '40-230', status: 'normal' },
        ],
      },
    ],
  },
  {
    date: 'Mar 4, 2026',
    isNew: false,
    panels: [
      {
        name: 'CBC with Differential',
        items: [
          { name: 'Platelets', value: 47, unit: 'k/µL', ref: '150-400', status: 'critical' },
          { name: 'WBC', value: 7.1, unit: 'k/µL', ref: '4.5-11', status: 'normal' },
          { name: 'Hemoglobin', value: 13.1, unit: 'g/dL', ref: '11.5-15.5', status: 'normal' },
          { name: 'MPV', value: 10.8, unit: 'fL', ref: '7.5-11.5', status: 'normal' },
        ],
      },
    ],
  },
];

// Mock platelet history for the chart
const PLATELET_HISTORY = [
  { date: 'Jan 5', value: 95 },
  { date: 'Jan 19', value: 78 },
  { date: 'Feb 2', value: 65 },
  { date: 'Feb 9', value: 72 },
  { date: 'Feb 16', value: 58 },
  { date: 'Feb 23', value: 47 },
  { date: 'Mar 1', value: 52 },
  { date: 'Mar 4', value: 47 },
  { date: 'Mar 7', value: 28 },
];

// Mock medication events for the chart overlay
const MED_EVENTS = [
  { date: 'Jan 5', label: 'Prednisone 20mg start' },
  { date: 'Feb 2', label: 'Taper to 15mg' },
  { date: 'Feb 16', label: 'Eltrombopag 50mg start' },
  { date: 'Mar 1', label: 'Taper to 10mg' },
];

function getStatusColor(status: string) {
  switch (status) {
    case 'critical': return palette.critical;
    case 'warning': return palette.warning;
    case 'normal': return palette.success;
    default: return palette.gray500;
  }
}

function getStatusBg(status: string) {
  switch (status) {
    case 'critical': return palette.criticalLight;
    case 'warning': return palette.warningLight;
    case 'normal': return palette.successLight;
    default: return palette.gray100;
  }
}

// Simple chart using Views
function PlateletChart({ data }: { data: { date: string; value: number }[] }) {
  const maxVal = Math.max(120, ...data.map(d => d.value) ) + 10;
  const chartHeight = 180;
  const thresholds = [
    { value: 30, label: '30k (severe)', color: palette.critical },
    { value: 50, label: '50k (moderate)', color: palette.warning },
    { value: 150, label: '150k (normal)', color: palette.success },
  ];

  return (
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>Platelet Trend</Text>
      
      {/* Threshold lines */}
      {thresholds.map((t) => (
        <View
          key={t.value}
          style={[
            styles.thresholdLine,
            {
              bottom: (t.value / maxVal) * chartHeight,
              borderColor: t.color + '40',
            },
          ]}
        >
          <Text style={[styles.thresholdLabel, { color: t.color }]}>
            {t.label}
          </Text>
        </View>
      ))}

      {/* Bars */}
      <View style={[styles.chartBars, { height: chartHeight }]}>
        {data.map((point, i) => {
          const height = (point.value / maxVal) * chartHeight;
          const color =
            point.value < 30
              ? palette.critical
              : point.value < 50
              ? palette.warning
              : point.value < 150
              ? palette.primary
              : palette.success;
          const isLast = i === data.length - 1;
          return (
            <View key={i} style={styles.chartBarCol}>
              <Text style={[styles.chartBarValue, { color }]}>
                {point.value}
              </Text>
              <View
                style={[
                  styles.chartBar,
                  {
                    height,
                    backgroundColor: color,
                    opacity: isLast ? 1 : 0.6,
                  },
                ]}
              />
              <Text style={styles.chartBarLabel}>{point.date}</Text>
            </View>
          );
        })}
      </View>

      {/* Med events */}
      <View style={styles.medEvents}>
        <Text style={styles.medEventsTitle}>Medication Changes</Text>
        {MED_EVENTS.map((e, i) => (
          <View key={i} style={styles.medEvent}>
            <View style={styles.medEventDot} />
            <Text style={styles.medEventText}>
              {e.date}: {e.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function LabResultItem({
  item,
}: {
  item: { name: string; value: number; unit: string; ref: string; status: string };
}) {
  return (
    <View style={styles.labItem}>
      <View style={{ flex: 1 }}>
        <Text style={styles.labName}>{item.name}</Text>
        <Text style={styles.labRef}>Ref: {item.ref}</Text>
      </View>
      <View style={styles.labValueWrap}>
        <Text style={[styles.labValue, { color: getStatusColor(item.status) }]}>
          {item.value}
        </Text>
        <Text style={styles.labUnit}>{item.unit}</Text>
      </View>
      <View style={[styles.labStatusDot, { backgroundColor: getStatusBg(item.status) }]}>
        {item.status === 'critical' && (
          <Ionicons name="alert" size={12} color={palette.critical} />
        )}
        {item.status === 'warning' && (
          <Ionicons name="warning" size={12} color={palette.warning} />
        )}
        {item.status === 'normal' && (
          <Ionicons name="checkmark" size={12} color={palette.success} />
        )}
      </View>
    </View>
  );
}

export default function LabsScreen() {
  const [expandedPanel, setExpandedPanel] = React.useState<string | null>(
    'CBC with Differential'
  );
  const [syncStatus, setSyncStatus] = React.useState<'synced' | 'syncing' | 'error'>('synced');
  const [aiInterpretation, setAiInterpretation] = React.useState<LabInterpretation | null>(null);
  const [aiLoading, setAiLoading] = React.useState(false);
  const [connectModalVisible, setConnectModalVisible] = React.useState(false);
  const [connectedProvider, setConnectedProvider] = React.useState<string | null>(null);
  const [liveLabData, setLiveLabData] = React.useState<FHIRLabSet[] | null>(null);
  const [labsLoading, setLabsLoading] = React.useState(false);
  const [plateletHistory, setPlateletHistory] = React.useState<{ date: string; value: number }[]>(PLATELET_HISTORY);

  // Check for existing connection on mount
  useEffect(() => {
    (async () => {
      // Check FHIR provider
      const provider = await HealthProviderService.getConnectedProvider();
      if (provider) {
        setConnectedProvider(provider.name);
        fetchLiveLabData();
        return;
      }
      // Check Apple Health
      if (AppleHealthService.isAvailable() && AppleHealthService.isInitialized()) {
        setConnectedProvider('Apple Health');
        fetchLiveLabData();
      }
    })();
  }, []);

  const fetchLiveLabData = useCallback(async (forceRefresh = false) => {
    setLabsLoading(true);
    setSyncStatus('syncing');
    try {
      // Try Apple Health first if connected via that
      if (connectedProvider === 'Apple Health' || AppleHealthService.isInitialized()) {
        const healthKitLabs = await AppleHealthService.fetchLabResults();
        if (healthKitLabs.length > 0) {
          setLiveLabData(healthKitLabs as any);
          setSyncStatus('synced');
          setLabsLoading(false);
          return;
        }
      }

      // Otherwise try FHIR
      const [labs, platelets] = await Promise.all([
        HealthProviderService.fetchLabResults(forceRefresh),
        HealthProviderService.fetchPlateletHistory(),
      ]);
      if (labs.length > 0) setLiveLabData(labs);
      if (platelets.length > 0) setPlateletHistory(platelets);
      setSyncStatus('synced');
    } catch (error) {
      console.log('Lab fetch info:', (error as Error).message);
      setSyncStatus('error');
    } finally {
      setLabsLoading(false);
    }
  }, [connectedProvider]);

  // Use live data if available, otherwise mock
  const displayLabs = liveLabData || MOCK_LABS;

  const flagCount = displayLabs[0]?.panels.reduce(
    (acc, panel) => acc + panel.items.filter((i) => i.status !== 'normal').length,
    0
  ) || 0;

  const runAiInterpretation = async () => {
    setAiLoading(true);
    try {
      // Use live data if available, otherwise mock
      const allLabs = displayLabs.map((labSet) => ({
        date: labSet.date,
        panels: labSet.panels.map((p) => ({
          name: p.name,
          results: p.items.map((i) => ({
            name: i.name,
            value: i.value,
            unit: i.unit,
            referenceRange: i.ref,
            status: i.status,
          })),
        })),
      }));
      const meds = [
        { name: 'Prednisone', dose: '10mg', status: 'tapering', history: '20mg→15mg→10mg since Jan 5' },
        { name: 'Eltrombopag', dose: '50mg', status: 'active', history: '25mg→50mg since Feb 16' },
        { name: 'Omeprazole', dose: '20mg', status: 'active' },
      ];
      const symptoms = [
        { date: 'Mar 9', bruises: 7, newBruises: 3, energy: 3, oralBlisters: 1 },
        { date: 'Mar 8', bruises: 5, newBruises: 1, energy: 3, oralBlisters: 1 },
      ];
      const result = await interpretLabResults(allLabs, meds, symptoms);
      setAiInterpretation(result);
    } catch (error) {
      console.error('AI interpretation failed:', error);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* MyChart Sync Status */}
      <View style={styles.syncCard}>
        <View style={styles.syncRow}>
          <View style={styles.syncIcon}>
            <Ionicons
              name={connectedProvider ? 'cloud-done' : 'cloud-offline'}
              size={20}
              color={connectedProvider ? palette.success : palette.gray400}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.syncTitle}>
              {connectedProvider ? `${connectedProvider} Connected` : 'Connect Lab Provider'}
            </Text>
            <Text style={styles.syncSub}>
              {connectedProvider ? 'Last synced: 2 hours ago' : 'Import labs automatically'}
            </Text>
          </View>
          {connectedProvider ? (
            <TouchableOpacity
              style={styles.syncBtn}
              onPress={() => fetchLiveLabData(true)}
              disabled={syncStatus === 'syncing'}
            >
              {syncStatus === 'syncing' ? (
                <ActivityIndicator size={14} color={palette.primary} />
              ) : (
                <Ionicons
                  name="refresh"
                  size={16}
                  color={palette.primary}
                />
              )}
              <Text style={styles.syncBtnText}>
                {syncStatus === 'syncing' ? 'Syncing...' : 'Sync'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.connectBtn}
              onPress={() => setConnectModalVisible(true)}
            >
              <Text style={styles.connectBtnText}>Connect</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* AI Interpretation Banner */}
      <TouchableOpacity
        style={styles.aiCard}
        activeOpacity={0.8}
        onPress={() => { if (!aiInterpretation && !aiLoading) runAiInterpretation(); }}
      >
        <View style={styles.aiHeader}>
          <Ionicons name="sparkles" size={18} color={palette.purple} />
          <Text style={styles.aiTitle}>AI Lab Interpretation</Text>
          {aiLoading ? (
            <ActivityIndicator size="small" color={palette.purple} />
          ) : (
            <View style={styles.flagBadge}>
              <Text style={styles.flagBadgeText}>
                {aiInterpretation ? `${aiInterpretation.flags.length} flags` : `${flagCount} flags`}
              </Text>
            </View>
          )}
        </View>
        {aiLoading ? (
          <Text style={styles.aiText}>Analyzing labs with clinical reasoning...</Text>
        ) : aiInterpretation ? (
          <View>
            <Text style={styles.aiText}>{aiInterpretation.interpretation}</Text>
            {aiInterpretation.flags.length > 0 && (
              <View style={{ marginTop: 10 }}>
                {aiInterpretation.flags.map((flag, i) => (
                  <View key={i} style={[styles.aiFlagRow, {
                    backgroundColor: flag.severity === 'critical' ? palette.criticalLight
                      : flag.severity === 'warning' ? palette.warningLight : palette.primaryLight,
                  }]}>
                    <Ionicons
                      name={flag.severity === 'critical' ? 'alert-circle' : 'warning'}
                      size={14}
                      color={flag.severity === 'critical' ? palette.critical : palette.warning}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.aiFlagTitle}>{flag.lab}: {flag.value}</Text>
                      <Text style={styles.aiFlagExplain}>{flag.explanation}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
            {aiInterpretation.urgent && aiInterpretation.urgent_message && (
              <View style={styles.aiUrgentBanner}>
                <Ionicons name="alert-circle" size={16} color={palette.critical} />
                <Text style={styles.aiUrgentText}>{aiInterpretation.urgent_message}</Text>
              </View>
            )}
          </View>
        ) : (
          <View>
            <Text style={styles.aiText}>
              Tap to generate AI clinical interpretation of your latest lab results.
            </Text>
            <Text style={styles.aiLink}>Analyze with AI →</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Platelet Chart */}
      <PlateletChart data={plateletHistory} />

      {/* Lab Results by Date */}
      {labsLoading && !liveLabData ? (
        <View style={{ padding: 32, alignItems: 'center' }}>
          <ActivityIndicator size="large" color={palette.primary} />
          <Text style={{ marginTop: 12, color: palette.gray500 }}>Loading lab results...</Text>
        </View>
      ) : (
      displayLabs.map((labSet, labIdx) => (
        <View key={labIdx}>
          <View style={styles.dateHeader}>
            <Text style={styles.dateText}>{labSet.date}</Text>
            {labSet.isNew && (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>NEW</Text>
              </View>
            )}
          </View>

          {labSet.panels.map((panel) => {
            const panelKey = `${labSet.date}-${panel.name}`;
            const isExpanded = expandedPanel === panel.name && labIdx === 0;
            const panelFlags = panel.items.filter((i) => i.status !== 'normal').length;
            return (
              <View key={panelKey} style={styles.panelCard}>
                <TouchableOpacity
                  style={styles.panelHeader}
                  onPress={() =>
                    setExpandedPanel(isExpanded ? null : panel.name)
                  }
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="flask"
                    size={18}
                    color={panelFlags > 0 ? palette.warning : palette.success}
                  />
                  <Text style={styles.panelName}>{panel.name}</Text>
                  {panelFlags > 0 && (
                    <View style={styles.panelFlagBadge}>
                      <Text style={styles.panelFlagText}>{panelFlags}</Text>
                    </View>
                  )}
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={palette.gray400}
                  />
                </TouchableOpacity>
                {isExpanded &&
                  panel.items.map((item, idx) => (
                    <LabResultItem key={idx} item={item} />
                  ))}
              </View>
            );
          })}
        </View>
      ))
      )}

      <View style={{ height: 32 }} />
    </ScrollView>

    <ConnectLabsModal
      visible={connectModalVisible}
      onClose={() => setConnectModalVisible(false)}
      onConnected={(provider) => {
        setConnectedProvider(provider.name);
        setConnectModalVisible(false);
        // Fetch labs after connecting
        fetchLiveLabData();
      }}
    />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.gray50 },
  content: { padding: 16 },

  syncCard: {
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
  syncRow: { flexDirection: 'row', alignItems: 'center' },
  syncIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: palette.successLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  syncTitle: { fontSize: 15, fontWeight: '600', color: palette.gray800 },
  syncSub: { fontSize: 12, color: palette.gray500, marginTop: 2 },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  syncBtnText: { fontSize: 13, color: palette.primary, fontWeight: '600' },
  connectBtn: {
    backgroundColor: palette.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  connectBtnText: { fontSize: 13, color: palette.white, fontWeight: '600' },

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
  flagBadge: {
    backgroundColor: palette.warning + '25',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  flagBadgeText: { fontSize: 11, fontWeight: '600', color: palette.warning },
  aiText: { fontSize: 14, color: palette.gray700, lineHeight: 20 },
  aiLink: { fontSize: 13, color: palette.purple, fontWeight: '500', marginTop: 8 },
  aiFlagRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    marginBottom: 6,
  },
  aiFlagTitle: { fontSize: 13, fontWeight: '600', color: palette.gray800 },
  aiFlagExplain: { fontSize: 12, color: palette.gray600, lineHeight: 17, marginTop: 2 },
  aiUrgentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.criticalLight,
    padding: 12,
    borderRadius: 10,
    marginTop: 10,
    gap: 8,
  },
  aiUrgentText: { flex: 1, fontSize: 13, fontWeight: '600', color: palette.critical },

  chartContainer: {
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
  chartTitle: { fontSize: 16, fontWeight: '600', color: palette.gray800, marginBottom: 16 },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    position: 'relative',
  },
  chartBarCol: { flex: 1, alignItems: 'center' },
  chartBar: { width: '80%', borderRadius: 4, minHeight: 4 },
  chartBarValue: { fontSize: 9, fontWeight: '700', marginBottom: 4 },
  chartBarLabel: {
    fontSize: 7,
    color: palette.gray500,
    marginTop: 4,
    textAlign: 'center',
  },
  thresholdLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    zIndex: 1,
  },
  thresholdLabel: {
    fontSize: 8,
    position: 'absolute',
    right: 0,
    top: -10,
    fontWeight: '500',
  },
  medEvents: { marginTop: 16, borderTopWidth: 1, borderTopColor: palette.gray100, paddingTop: 12 },
  medEventsTitle: { fontSize: 12, fontWeight: '600', color: palette.gray500, marginBottom: 8 },
  medEvent: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  medEventDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.primary,
    marginRight: 8,
  },
  medEventText: { fontSize: 12, color: palette.gray600 },

  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 8,
  },
  dateText: { fontSize: 16, fontWeight: '600', color: palette.gray800 },
  newBadge: {
    backgroundColor: palette.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  newBadgeText: { fontSize: 10, fontWeight: '700', color: palette.white },

  panelCard: {
    backgroundColor: palette.white,
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 8,
  },
  panelName: { flex: 1, fontSize: 14, fontWeight: '600', color: palette.gray700 },
  panelFlagBadge: {
    backgroundColor: palette.warningLight,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  panelFlagText: { fontSize: 11, fontWeight: '700', color: palette.warning },

  labItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: palette.gray100,
  },
  labName: { fontSize: 14, color: palette.gray700, fontWeight: '500' },
  labRef: { fontSize: 11, color: palette.gray400, marginTop: 2 },
  labValueWrap: { alignItems: 'flex-end', marginRight: 10 },
  labValue: { fontSize: 16, fontWeight: '700' },
  labUnit: { fontSize: 10, color: palette.gray500 },
  labStatusDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
