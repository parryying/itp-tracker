import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncToCloud, pullFromCloud, queryByType, isCosmosAvailable } from './cosmosDbService';

// ─── Types ────────────────────────────────────────────────────────────

export interface Medication {
  id: string;
  name: string;
  category: string;
  currentDose: string;
  frequency: string;
  startDate: string;
  status: 'active' | 'tapering' | 'discontinued';
  sideEffects: string[];
  dosageHistory: { dose: string; startDate: string; endDate: string }[];
  nextChange: string;
  color: string;
}

export interface DailyDose {
  medId: string;
  medName: string;
  dose: string;
  time: string;
  taken: boolean;
  takenAt: string | null;
}

export interface CheckinData {
  date: string; // YYYY-MM-DD
  photos: Record<string, { localUri: string; blobPath: string | null }>;
  analyses: Record<string, any>;
  symptoms: string[];
  energy: number;
  activities: string;
  notes: string;
  savedAt: string;
}

export interface SideEffectLog {
  date: string;
  effects: Record<string, boolean>; // effectLabel -> on/off
}

// ─── Keys ─────────────────────────────────────────────────────────────

const KEYS = {
  MEDICATIONS: '@itp/medications',
  DOSES: (date: string) => `@itp/doses/${date}`,
  CHECKIN: (date: string) => `@itp/checkins/${date}`,
  CHECKIN_HISTORY: '@itp/checkin-history', // list of dates with check-ins
  SIDE_EFFECTS: (date: string) => `@itp/side-effects/${date}`,
};

// ─── Date Helpers ─────────────────────────────────────────────────────

export function todayKey(): string {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

export function formatDate(date?: Date): string {
  const d = date || new Date();
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatShortDate(date?: Date): string {
  const d = date || new Date();
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ─── Medications ──────────────────────────────────────────────────────

export async function getMedications(): Promise<Medication[]> {
  try {
    const json = await AsyncStorage.getItem(KEYS.MEDICATIONS);
    if (json) return JSON.parse(json);
    // First run: seed with defaults
    await saveMedications(DEFAULT_MEDICATIONS);
    return DEFAULT_MEDICATIONS;
  } catch {
    return DEFAULT_MEDICATIONS;
  }
}

export async function saveMedications(meds: Medication[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.MEDICATIONS, JSON.stringify(meds));
  pushToCloud('medications', 'list', meds);
}

export async function addMedication(med: Medication): Promise<Medication[]> {
  const meds = await getMedications();
  meds.push(med);
  await saveMedications(meds);
  return meds;
}

export async function updateMedication(id: string, updates: Partial<Medication>): Promise<Medication[]> {
  const meds = await getMedications();
  const idx = meds.findIndex((m) => m.id === id);
  if (idx >= 0) {
    meds[idx] = { ...meds[idx], ...updates };
    await saveMedications(meds);
  }
  return meds;
}

// ─── Daily Doses ──────────────────────────────────────────────────────

export async function getDailyDoses(date?: string): Promise<DailyDose[]> {
  const key = date || todayKey();
  try {
    const json = await AsyncStorage.getItem(KEYS.DOSES(key));
    if (json) return JSON.parse(json);
    // No entry yet — build from current medications
    const meds = await getMedications();
    const doses: DailyDose[] = meds
      .filter((m) => m.status !== 'discontinued')
      .map((m) => ({
        medId: m.id,
        medName: m.name,
        dose: m.currentDose,
        time: getDefaultTime(m),
        taken: false,
        takenAt: null,
      }));
    return doses;
  } catch {
    return [];
  }
}

export async function saveDailyDoses(doses: DailyDose[], date?: string): Promise<void> {
  const key = date || todayKey();
  await AsyncStorage.setItem(KEYS.DOSES(key), JSON.stringify(doses));
  pushToCloud('daily-doses', key, doses);
}

export async function toggleDose(medId: string, date?: string): Promise<DailyDose[]> {
  const doses = await getDailyDoses(date);
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
  await saveDailyDoses(updated, date);
  return updated;
}

function getDefaultTime(med: Medication): string {
  // Rough default scheduling
  const name = med.name.toLowerCase();
  if (name.includes('eltrombopag') || name.includes('promacta')) return '6:00 PM';
  if (name.includes('omeprazole')) return '7:30 AM';
  return '8:00 AM';
}

// ─── Check-ins ────────────────────────────────────────────────────────

export async function getCheckin(date?: string): Promise<CheckinData | null> {
  const key = date || todayKey();
  try {
    const json = await AsyncStorage.getItem(KEYS.CHECKIN(key));
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
}

export async function saveCheckin(data: CheckinData): Promise<void> {
  await AsyncStorage.setItem(KEYS.CHECKIN(data.date), JSON.stringify(data));
  // Update check-in history
  const history = await getCheckinHistory();
  if (!history.includes(data.date)) {
    history.unshift(data.date);
    await AsyncStorage.setItem(KEYS.CHECKIN_HISTORY, JSON.stringify(history));
  }
  // Push to cloud
  pushToCloud('checkin', data.date, data);
  pushToCloud('checkin-history', 'dates', history);
}

export async function getCheckinHistory(): Promise<string[]> {
  try {
    const json = await AsyncStorage.getItem(KEYS.CHECKIN_HISTORY);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

// ─── Side Effects ─────────────────────────────────────────────────────

export async function getSideEffects(date?: string): Promise<Record<string, boolean>> {
  const key = date || todayKey();
  try {
    const json = await AsyncStorage.getItem(KEYS.SIDE_EFFECTS(key));
    if (json) {
      const log: SideEffectLog = JSON.parse(json);
      return log.effects;
    }
    return {};
  } catch {
    return {};
  }
}

export async function saveSideEffects(effects: Record<string, boolean>, date?: string): Promise<void> {
  const key = date || todayKey();
  const log: SideEffectLog = { date: key, effects };
  await AsyncStorage.setItem(KEYS.SIDE_EFFECTS(key), JSON.stringify(log));
  pushToCloud('side-effects', key, log);
}

// ─── Cloud Sync ───────────────────────────────────────────────────────

let _syncEnabled = false;

export async function initCloudSync(): Promise<boolean> {
  _syncEnabled = await isCosmosAvailable();
  return _syncEnabled;
}

export function isSyncEnabled(): boolean {
  return _syncEnabled;
}

/**
 * Push all local data to cloud (call after saves).
 * Non-blocking — failures are logged but don't affect local ops.
 */
async function pushToCloud(docType: string, docId: string, data: any): Promise<void> {
  if (!_syncEnabled) return;
  try {
    await syncToCloud(docType, docId, data);
  } catch (e) {
    console.warn('Cloud sync push failed:', e);
  }
}

/**
 * Full sync: pull all data from cloud and merge into local storage.
 * Cloud wins for newer data (based on updatedAt/savedAt).
 */
export async function pullAllFromCloud(): Promise<{ synced: number; errors: number }> {
  if (!_syncEnabled) return { synced: 0, errors: 0 };

  let synced = 0;
  let errors = 0;

  try {
    // Pull medications
    const cloudMeds = await pullFromCloud('medications', 'list');
    if (cloudMeds) {
      await AsyncStorage.setItem(KEYS.MEDICATIONS, JSON.stringify(cloudMeds));
      synced++;
    }

    // Pull checkin history
    const cloudHistory = await pullFromCloud('checkin-history', 'dates');
    if (cloudHistory) {
      const localHistory = await getCheckinHistory();
      // Merge: union of both lists, deduplicated, sorted desc
      const merged = [...new Set([...cloudHistory, ...localHistory])].sort().reverse();
      await AsyncStorage.setItem(KEYS.CHECKIN_HISTORY, JSON.stringify(merged));
      synced++;

      // Pull each checkin
      for (const date of merged) {
        const cloudCheckin = await pullFromCloud('checkin', date);
        if (cloudCheckin) {
          const localCheckin = await getCheckin(date);
          // Cloud wins if newer or local doesn't exist
          if (!localCheckin || (cloudCheckin.savedAt > (localCheckin.savedAt || ''))) {
            await AsyncStorage.setItem(KEYS.CHECKIN(date), JSON.stringify(cloudCheckin));
            synced++;
          }
        }
      }
    }
  } catch (e) {
    console.warn('Cloud sync pull failed:', e);
    errors++;
  }

  return { synced, errors };
}

/**
 * Push all local data to cloud (full upload).
 */
export async function pushAllToCloud(): Promise<{ synced: number; errors: number }> {
  if (!_syncEnabled) return { synced: 0, errors: 0 };

  let synced = 0;
  let errors = 0;

  try {
    // Push medications
    const meds = await getMedications();
    if (await syncToCloud('medications', 'list', meds)) synced++;
    else errors++;

    // Push checkin history + each checkin
    const history = await getCheckinHistory();
    if (await syncToCloud('checkin-history', 'dates', history)) synced++;
    else errors++;

    for (const date of history) {
      const checkin = await getCheckin(date);
      if (checkin) {
        if (await syncToCloud('checkin', date, checkin)) synced++;
        else errors++;
      }
    }
  } catch (e) {
    console.warn('Cloud sync push all failed:', e);
    errors++;
  }

  return { synced, errors };
}

// ─── Default Medication Data ──────────────────────────────────────────

import { palette } from '@/constants/Colors';

const DEFAULT_MEDICATIONS: Medication[] = [
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
    color: '#ED8936',
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
    color: '#4A90D9',
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
    color: '#319795',
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
    color: '#38A169',
  },
];

// ─── Utility: Clear all data (for debugging) ─────────────────────────

export async function clearAllData(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const itpKeys = keys.filter((k) => k.startsWith('@itp/'));
  await AsyncStorage.multiRemove(itpKeys);
}
