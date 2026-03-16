/**
 * Apple Health (HealthKit) Integration Service
 *
 * Reads lab results that MyChart and other health apps have synced to Apple Health.
 * This bypasses the need for hospital-specific FHIR API approval.
 *
 * IMPORTANT: Requires a development build (not Expo Go).
 * Run: npx expo prebuild && npx expo run:ios
 * Or use EAS Build: eas build --platform ios --profile development
 */
import { Platform } from 'react-native';
import AppleHealthKit, {
  HealthKitPermissions,
  HealthValue,
  HealthInputOptions,
} from 'react-native-health';

// ─── Types ───────────────────────────────────────────────────────────
export interface HealthKitLabResult {
  name: string;
  value: number;
  unit: string;
  ref: string;
  status: 'critical' | 'warning' | 'normal';
  date: string;
}

export interface HealthKitLabSet {
  date: string;
  isNew: boolean;
  panels: {
    name: string;
    items: HealthKitLabResult[];
  }[];
}

// ─── HealthKit permissions we need ───────────────────────────────────
const PERMISSIONS: HealthKitPermissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.BloodGlucose,
      AppleHealthKit.Constants.Permissions.BloodPressureDiastolic,
      AppleHealthKit.Constants.Permissions.BloodPressureSystolic,
      AppleHealthKit.Constants.Permissions.BodyTemperature,
      AppleHealthKit.Constants.Permissions.HeartRate,
      AppleHealthKit.Constants.Permissions.OxygenSaturation,
      AppleHealthKit.Constants.Permissions.Height,
      AppleHealthKit.Constants.Permissions.Weight,
      // Lab results come through as clinical records
    ],
    write: [],
  },
};

// ─── ITP-relevant reference ranges ──────────────────────────────────
const LAB_REFERENCE_RANGES: Record<string, { ref: string; unit: string; panel: string }> = {
  'Platelets': { ref: '150-400', unit: 'k/µL', panel: 'CBC with Differential' },
  'WBC': { ref: '4.5-11', unit: 'k/µL', panel: 'CBC with Differential' },
  'RBC': { ref: '4.0-5.5', unit: 'M/µL', panel: 'CBC with Differential' },
  'Hemoglobin': { ref: '11.5-15.5', unit: 'g/dL', panel: 'CBC with Differential' },
  'Hematocrit': { ref: '34-45', unit: '%', panel: 'CBC with Differential' },
  'MPV': { ref: '7.5-11.5', unit: 'fL', panel: 'CBC with Differential' },
  'Neutrophils': { ref: '40-70', unit: '%', panel: 'CBC with Differential' },
  'Lymphocytes': { ref: '20-45', unit: '%', panel: 'CBC with Differential' },
  'ALT': { ref: '7-35', unit: 'U/L', panel: 'Comprehensive Metabolic Panel' },
  'AST': { ref: '8-33', unit: 'U/L', panel: 'Comprehensive Metabolic Panel' },
  'Bilirubin': { ref: '0.1-1.2', unit: 'mg/dL', panel: 'Comprehensive Metabolic Panel' },
  'Glucose': { ref: '70-100', unit: 'mg/dL', panel: 'Comprehensive Metabolic Panel' },
  'BUN': { ref: '7-20', unit: 'mg/dL', panel: 'Comprehensive Metabolic Panel' },
  'Creatinine': { ref: '0.3-0.7', unit: 'mg/dL', panel: 'Comprehensive Metabolic Panel' },
  'BloodGlucose': { ref: '70-100', unit: 'mg/dL', panel: 'Comprehensive Metabolic Panel' },
};

// ─── Service ─────────────────────────────────────────────────────────
export class AppleHealthService {
  private static initialized = false;

  /**
   * Check if HealthKit is available (iOS only)
   */
  static isAvailable(): boolean {
    return Platform.OS === 'ios';
  }

  /**
   * Initialize HealthKit and request permissions
   * Returns true if successful
   */
  static async initialize(): Promise<boolean> {
    if (!this.isAvailable()) {
      console.log('HealthKit is only available on iOS');
      return false;
    }

    return new Promise((resolve) => {
      AppleHealthKit.initHealthKit(PERMISSIONS, (error: string) => {
        if (error) {
          console.error('HealthKit init error:', error);
          resolve(false);
        } else {
          this.initialized = true;
          resolve(true);
        }
      });
    });
  }

  /**
   * Check if HealthKit is initialized
   */
  static isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Fetch blood glucose samples (most commonly synced lab value)
   */
  static async getBloodGlucose(daysBack = 90): Promise<HealthValue[]> {
    if (!this.initialized) return [];

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const options: HealthInputOptions = {
      startDate: startDate.toISOString(),
      endDate: new Date().toISOString(),
      ascending: false,
      limit: 100,
    };

    return new Promise((resolve) => {
      AppleHealthKit.getBloodGlucoseSamples(options, (error: string, results: HealthValue[]) => {
        if (error) {
          console.error('Blood glucose error:', error);
          resolve([]);
        } else {
          resolve(results || []);
        }
      });
    });
  }

  /**
   * Fetch all available lab-related data from HealthKit
   * and format into our standard lab structure
   */
  static async fetchLabResults(daysBack = 180): Promise<HealthKitLabSet[]> {
    if (!this.initialized) {
      const ok = await this.initialize();
      if (!ok) return [];
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Fetch all available health data types
    const [glucose] = await Promise.all([
      this.getBloodGlucose(daysBack),
    ]);

    // Combine all results with proper lab names
    const allResults: { name: string; value: number; unit: string; date: Date }[] = [];

    for (const g of glucose) {
      allResults.push({
        name: 'BloodGlucose',
        value: g.value,
        unit: 'mg/dL',
        date: new Date(g.startDate),
      });
    }

    // Group by date
    return this.groupByDate(allResults);
  }

  /**
   * Get clinical records (requires iOS 12+ and user approval)
   * These contain actual lab results from hospitals
   */
  static async getClinicalRecords(): Promise<any[]> {
    // Clinical records (FHIR) require special entitlements
    // and are available through HealthKit's clinical records API
    // This is the gold standard for getting real lab data
    if (!this.isAvailable()) return [];

    // Note: react-native-health doesn't directly support clinical records yet
    // We would need a custom native module for this
    // For now, return empty and fall back to regular health data
    return [];
  }

  /**
   * Group raw health values by date into our standard lab panel format
   */
  private static groupByDate(
    results: { name: string; value: number; unit: string; date: Date }[]
  ): HealthKitLabSet[] {
    const byDate = new Map<string, Map<string, HealthKitLabResult[]>>();

    for (const result of results) {
      const dateKey = result.date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      const labInfo = LAB_REFERENCE_RANGES[result.name];
      const panelName = labInfo?.panel || 'Other Results';
      const ref = labInfo?.ref || '';
      const displayName = result.name === 'BloodGlucose' ? 'Glucose' : result.name;
      const status = this.computeStatus(result.value, ref, displayName);

      if (!byDate.has(dateKey)) byDate.set(dateKey, new Map());
      const panels = byDate.get(dateKey)!;
      if (!panels.has(panelName)) panels.set(panelName, []);

      panels.get(panelName)!.push({
        name: displayName,
        value: Math.round(result.value * 100) / 100,
        unit: labInfo?.unit || result.unit,
        ref,
        status,
        date: dateKey,
      });
    }

    // Convert to sorted array
    const sortedDates = Array.from(byDate.keys()).sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime()
    );

    return sortedDates.map((dateKey, i) => {
      const panelMap = byDate.get(dateKey)!;
      const panels = Array.from(panelMap.entries()).map(([name, items]) => ({
        name,
        items,
      }));
      return {
        date: dateKey,
        isNew: i === 0,
        panels,
      };
    });
  }

  /**
   * Compute lab value status based on reference range
   */
  private static computeStatus(
    value: number,
    refRange: string,
    labName: string
  ): 'critical' | 'warning' | 'normal' {
    if (!refRange || !refRange.includes('-')) return 'normal';

    const [lowStr, highStr] = refRange.split('-').map((s) => s.trim());
    const low = parseFloat(lowStr);
    const high = parseFloat(highStr);
    if (isNaN(low) || isNaN(high)) return 'normal';

    if (value >= low && value <= high) return 'normal';

    // ITP-specific: platelet thresholds
    if (labName.toLowerCase().includes('platelet')) {
      if (value < 30) return 'critical';
      if (value < 50) return 'warning';
    }

    const range = high - low;
    const deviation = value < low ? (low - value) / range : (value - high) / range;
    if (deviation > 0.5) return 'critical';
    return 'warning';
  }
}
