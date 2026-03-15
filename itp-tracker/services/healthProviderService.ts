import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ───────────────────────────────────────────────────────────
export interface HealthProvider {
  id: string;
  name: string;
  logo: string;
  description: string;
  authUrl: string;
  tokenUrl: string;
  fhirBaseUrl: string;
  scopes: string[];
  redirectUri: string;
}

export interface FHIRLabResult {
  name: string;
  value: number;
  unit: string;
  ref: string;
  status: 'critical' | 'warning' | 'normal';
  code: string; // LOINC code
}

export interface FHIRLabPanel {
  name: string;
  items: FHIRLabResult[];
}

export interface FHIRLabSet {
  date: string;
  isNew: boolean;
  panels: FHIRLabPanel[];
}

export interface TokenData {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  patient?: string;
  scope: string;
  obtained_at: number;
}

// ─── Storage keys ────────────────────────────────────────────────────
const TOKEN_KEY = 'fhir_token_data';
const PROVIDER_KEY = 'fhir_connected_provider';
const LABS_CACHE_KEY = 'fhir_labs_cache';

// ─── Provider definitions ────────────────────────────────────────────
export const HEALTH_PROVIDERS: HealthProvider[] = [
  {
    id: 'epic',
    name: 'Epic MyChart',
    logo: '🏥',
    description: 'Connect to Epic MyChart for lab results',
    authUrl: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize',
    tokenUrl: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token',
    fhirBaseUrl: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4',
    scopes: ['openid', 'fhirUser', 'patient/Observation.read', 'patient/Patient.read'],
    redirectUri: 'https://localhost/auth/callback',
  },
  // Add more providers later
];

// ─── LOINC codes for ITP-relevant labs ───────────────────────────────
const ITP_LOINC_CODES: Record<string, { name: string; panel: string; ref: string }> = {
  // CBC / Platelets
  '777-3':   { name: 'Platelets', panel: 'CBC with Differential', ref: '150-400' },
  '26515-7': { name: 'Platelets', panel: 'CBC with Differential', ref: '150-400' },
  '6690-2':  { name: 'WBC', panel: 'CBC with Differential', ref: '4.5-11' },
  '26464-8': { name: 'WBC', panel: 'CBC with Differential', ref: '4.5-11' },
  '789-8':   { name: 'RBC', panel: 'CBC with Differential', ref: '4.0-5.5' },
  '718-7':   { name: 'Hemoglobin', panel: 'CBC with Differential', ref: '11.5-15.5' },
  '4544-3':  { name: 'Hematocrit', panel: 'CBC with Differential', ref: '34-45' },
  '32623-1': { name: 'MPV', panel: 'CBC with Differential', ref: '7.5-11.5' },
  '770-8':   { name: 'Neutrophils', panel: 'CBC with Differential', ref: '40-70' },
  '26499-4': { name: 'Neutrophils', panel: 'CBC with Differential', ref: '40-70' },
  '736-9':   { name: 'Lymphocytes', panel: 'CBC with Differential', ref: '20-45' },
  '26474-7': { name: 'Lymphocytes', panel: 'CBC with Differential', ref: '20-45' },
  // Metabolic
  '1742-6':  { name: 'ALT', panel: 'Comprehensive Metabolic Panel', ref: '7-35' },
  '1920-8':  { name: 'AST', panel: 'Comprehensive Metabolic Panel', ref: '8-33' },
  '1975-2':  { name: 'Bilirubin, Total', panel: 'Comprehensive Metabolic Panel', ref: '0.1-1.2' },
  '2345-7':  { name: 'Glucose', panel: 'Comprehensive Metabolic Panel', ref: '70-100' },
  '3094-0':  { name: 'BUN', panel: 'Comprehensive Metabolic Panel', ref: '7-20' },
  '2160-0':  { name: 'Creatinine', panel: 'Comprehensive Metabolic Panel', ref: '0.3-0.7' },
  // Immunology
  '2465-3':  { name: 'IgG', panel: 'Immunology', ref: '700-1600' },
  '2458-8':  { name: 'IgA', panel: 'Immunology', ref: '70-400' },
  '2472-9':  { name: 'IgM', panel: 'Immunology', ref: '40-230' },
};

// Build a search string of all LOINC codes for the FHIR query
const ALL_LOINC_CODES = Object.keys(ITP_LOINC_CODES).join(',');

// ─── Main service ────────────────────────────────────────────────────
export class HealthProviderService {
  // ── Auth URL generation ──────────────────────────────────────────
  static generateAuthUrl(provider: HealthProvider, clientId: string, state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: provider.redirectUri,
      scope: provider.scopes.join(' '),
      state,
      aud: provider.fhirBaseUrl,
    });
    return `${provider.authUrl}?${params.toString()}`;
  }

  // ── Parse callback URL ──────────────────────────────────────────
  static async handleAuthCallback(url: string): Promise<{ code: string; state: string } | null> {
    const urlObj = new URL(url);
    const code = urlObj.searchParams.get('code');
    const state = urlObj.searchParams.get('state');
    const error = urlObj.searchParams.get('error');

    if (error) {
      throw new Error(`OAuth error: ${error}`);
    }
    if (!code || !state) {
      return null;
    }
    return { code, state };
  }

  // ── Exchange authorization code for access token ─────────────────
  static async exchangeCodeForToken(
    provider: HealthProvider,
    code: string,
    clientId: string,
  ): Promise<TokenData> {
    const response = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: provider.redirectUri,
        client_id: clientId,
      }).toString(),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('Token exchange error:', body);
      throw new Error(`Token exchange failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const tokenData: TokenData = {
      ...data,
      obtained_at: Date.now(),
    };

    // Persist token + provider
    await AsyncStorage.setItem(TOKEN_KEY, JSON.stringify(tokenData));
    await AsyncStorage.setItem(PROVIDER_KEY, provider.id);

    return tokenData;
  }

  // ── Get stored token (check expiry) ──────────────────────────────
  static async getStoredToken(): Promise<TokenData | null> {
    try {
      const raw = await AsyncStorage.getItem(TOKEN_KEY);
      if (!raw) return null;
      const token: TokenData = JSON.parse(raw);

      // Check if expired (with 60s buffer)
      const elapsed = (Date.now() - token.obtained_at) / 1000;
      if (elapsed >= token.expires_in - 60) {
        // Token expired — clear it
        await this.disconnect();
        return null;
      }
      return token;
    } catch {
      return null;
    }
  }

  // ── Get connected provider name ──────────────────────────────────
  static async getConnectedProvider(): Promise<HealthProvider | null> {
    const id = await AsyncStorage.getItem(PROVIDER_KEY);
    if (!id) return null;
    return HEALTH_PROVIDERS.find(p => p.id === id) || null;
  }

  // ── Disconnect / clear stored data ───────────────────────────────
  static async disconnect(): Promise<void> {
    await AsyncStorage.multiRemove([TOKEN_KEY, PROVIDER_KEY, LABS_CACHE_KEY]);
  }

  // ── Fetch lab results from FHIR API ──────────────────────────────
  static async fetchLabResults(forceRefresh = false): Promise<FHIRLabSet[]> {
    // Check cache first
    if (!forceRefresh) {
      const cached = await AsyncStorage.getItem(LABS_CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        // Cache valid for 30 minutes
        if (Date.now() - timestamp < 30 * 60 * 1000) {
          return data;
        }
      }
    }

    const token = await this.getStoredToken();
    if (!token) {
      throw new Error('Not connected — please connect to a lab provider first.');
    }

    const provider = await this.getConnectedProvider();
    if (!provider) {
      throw new Error('No provider found.');
    }

    // Query FHIR Observation endpoint for lab results
    const patientId = token.patient || '';
    const url = `${provider.fhirBaseUrl}/Observation?` +
      `patient=${patientId}` +
      `&category=laboratory` +
      `&code=${ALL_LOINC_CODES}` +
      `&_sort=-date` +
      `&_count=100`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        Accept: 'application/fhir+json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        await this.disconnect();
        throw new Error('Session expired — please reconnect.');
      }
      throw new Error(`FHIR query failed: ${response.status}`);
    }

    const bundle = await response.json();
    const labSets = this.parseFHIRBundle(bundle);

    // Cache
    await AsyncStorage.setItem(LABS_CACHE_KEY, JSON.stringify({
      data: labSets,
      timestamp: Date.now(),
    }));

    return labSets;
  }

  // ── Fetch platelet history specifically ──────────────────────────
  static async fetchPlateletHistory(): Promise<{ date: string; value: number }[]> {
    const token = await this.getStoredToken();
    if (!token) return [];

    const provider = await this.getConnectedProvider();
    if (!provider) return [];

    const patientId = token.patient || '';
    // Platelet LOINC codes
    const plateletCodes = '777-3,26515-7';
    const url = `${provider.fhirBaseUrl}/Observation?` +
      `patient=${patientId}` +
      `&code=${plateletCodes}` +
      `&_sort=-date` +
      `&_count=50`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        Accept: 'application/fhir+json',
      },
    });

    if (!response.ok) return [];

    const bundle = await response.json();
    const entries = bundle.entry || [];

    return entries
      .map((entry: any) => {
        const res = entry.resource;
        const value = res?.valueQuantity?.value;
        const date = res?.effectiveDateTime || res?.issued;
        if (!value || !date) return null;
        const d = new Date(date);
        const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return { date: label, value: Math.round(value) };
      })
      .filter(Boolean)
      .reverse(); // oldest first for chart
  }

  // ── Parse a FHIR Bundle into our lab data structure ──────────────
  private static parseFHIRBundle(bundle: any): FHIRLabSet[] {
    const entries = bundle.entry || [];
    const byDate = new Map<string, Map<string, FHIRLabResult[]>>();

    for (const entry of entries) {
      const res = entry.resource;
      if (res?.resourceType !== 'Observation') continue;

      // Get date
      const rawDate = res.effectiveDateTime || res.issued;
      if (!rawDate) continue;
      const dateObj = new Date(rawDate);
      const dateKey = dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      // Get LOINC code
      const coding = res.code?.coding?.find((c: any) =>
        c.system === 'http://loinc.org' || ITP_LOINC_CODES[c.code]
      );
      const loincCode = coding?.code || '';
      const knownLab = ITP_LOINC_CODES[loincCode];

      // Get value
      const value = res.valueQuantity?.value;
      const unit = res.valueQuantity?.unit || res.valueQuantity?.code || '';
      if (value === undefined || value === null) continue;

      // Determine lab name and panel
      const labName = knownLab?.name || coding?.display || res.code?.text || 'Unknown';
      const panelName = knownLab?.panel || 'Other Results';
      const refRange = knownLab?.ref || this.extractReferenceRange(res);

      // Determine status from reference range
      const status = this.computeStatus(value, refRange, labName);

      // Group by date → panel
      if (!byDate.has(dateKey)) byDate.set(dateKey, new Map());
      const panels = byDate.get(dateKey)!;
      if (!panels.has(panelName)) panels.set(panelName, []);

      // Deduplicate by name within same panel+date
      const existing = panels.get(panelName)!;
      if (!existing.find(r => r.name === labName)) {
        existing.push({
          name: labName,
          value: Math.round(value * 100) / 100,
          unit,
          ref: refRange,
          status,
          code: loincCode,
        });
      }
    }

    // Convert to array, sort by date descending
    const now = new Date();
    const labSets: FHIRLabSet[] = [];
    const sortedDates = Array.from(byDate.keys()).sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime()
    );

    for (let i = 0; i < sortedDates.length; i++) {
      const dateKey = sortedDates[i];
      const panelMap = byDate.get(dateKey)!;
      const panels: FHIRLabPanel[] = [];

      // Sort panels: CBC first, then CMP, then Immunology, then other
      const panelOrder = ['CBC with Differential', 'Comprehensive Metabolic Panel', 'Immunology'];
      const sortedPanels = Array.from(panelMap.keys()).sort((a, b) => {
        const ia = panelOrder.indexOf(a);
        const ib = panelOrder.indexOf(b);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      });

      for (const panelName of sortedPanels) {
        panels.push({ name: panelName, items: panelMap.get(panelName)! });
      }

      labSets.push({
        date: dateKey,
        isNew: i === 0, // most recent is "new"
        panels,
      });
    }

    return labSets;
  }

  // ── Extract reference range from FHIR Observation ────────────────
  private static extractReferenceRange(observation: any): string {
    const refRange = observation.referenceRange?.[0];
    if (!refRange) return '';
    const low = refRange.low?.value;
    const high = refRange.high?.value;
    if (low !== undefined && high !== undefined) return `${low}-${high}`;
    if (low !== undefined) return `>${low}`;
    if (high !== undefined) return `<${high}`;
    return refRange.text || '';
  }

  // ── Compute status from value and reference range ────────────────
  private static computeStatus(
    value: number,
    refRange: string,
    labName: string
  ): 'critical' | 'warning' | 'normal' {
    if (!refRange || !refRange.includes('-')) return 'normal';

    const [lowStr, highStr] = refRange.split('-').map(s => s.trim());
    const low = parseFloat(lowStr);
    const high = parseFloat(highStr);
    if (isNaN(low) || isNaN(high)) return 'normal';

    if (value >= low && value <= high) return 'normal';

    // For platelets, use ITP-specific thresholds
    const isPlatelet = labName.toLowerCase().includes('platelet');
    if (isPlatelet) {
      if (value < 30) return 'critical';
      if (value < 50) return 'warning'; // moderate thrombocytopenia
    }

    // General: how far out of range?
    const range = high - low;
    const deviation = value < low ? (low - value) / range : (value - high) / range;
    if (deviation > 0.5) return 'critical';
    if (deviation > 0) return 'warning';
    return 'normal';
  }
}