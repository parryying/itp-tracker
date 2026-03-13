/**
 * Health Provider Service
 *
 * Connects to health data sources via SMART on FHIR (open standard).
 * Supports:
 *   - Epic MyChart (most hospitals)
 *   - Cerner (Oracle Health)
 *   - LabCorp Patient Portal
 *   - Quest MyQuest
 *
 * Flow:
 *   1. User picks provider → app opens OAuth login in WebView
 *   2. User logs into their own portal (credentials never touch our app)
 *   3. OAuth returns access token
 *   4. App fetches FHIR lab results using token
 *   5. Results parsed into our lab format and saved locally + cloud
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ────────────────────────────────────────────────────────────

export interface HealthProvider {
  id: string;
  name: string;
  icon: string; // Ionicons name
  color: string;
  fhirBaseUrl: string;
  authUrl: string;
  tokenUrl: string;
  clientId: string;
  scopes: string;
  description: string;
}

export interface ProviderConnection {
  providerId: string;
  providerName: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: string; // ISO date
  patientId: string; // FHIR patient ID
  connectedAt: string;
}

export interface LabResult {
  date: string; // Display date e.g. "Mar 7, 2026"
  dateKey: string; // YYYY-MM-DD for sorting
  source: string; // Provider name
  isNew: boolean;
  panels: LabPanel[];
}

export interface LabPanel {
  name: string;
  items: LabItem[];
}

export interface LabItem {
  name: string;
  value: number;
  unit: string;
  ref: string; // Reference range
  status: 'critical' | 'warning' | 'normal';
}

// ─── Storage Keys ─────────────────────────────────────────────────────

const KEYS = {
  CONNECTIONS: '@itp/health-connections',
  LAB_RESULTS: '@itp/lab-results',
  LAST_SYNC: '@itp/labs-last-sync',
};

// ─── Known Providers ──────────────────────────────────────────────────

const REDIRECT_URI = 'https://localhost/auth/callback';

export const PROVIDERS: HealthProvider[] = [
  {
    id: 'epic-mychart',
    name: 'MyChart (Epic)',
    icon: 'medical',
    color: '#0072CE',
    fhirBaseUrl: process.env.EXPO_PUBLIC_EPIC_FHIR_URL || 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4',
    authUrl: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize',
    tokenUrl: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token',
    clientId: process.env.EXPO_PUBLIC_EPIC_CLIENT_ID || '',
    scopes: 'openid fhirUser patient/Observation.read patient/DiagnosticReport.read patient/Patient.read',
    description: 'Connect your MyChart account to auto-import lab results from your hospital.',
  },
  {
    id: 'labcorp',
    name: 'LabCorp',
    icon: 'flask',
    color: '#00529B',
    fhirBaseUrl: process.env.EXPO_PUBLIC_LABCORP_FHIR_URL || 'https://fhir.labcorp.com/r4',
    authUrl: 'https://fhir.labcorp.com/r4/authorize',
    tokenUrl: 'https://fhir.labcorp.com/r4/token',
    clientId: process.env.EXPO_PUBLIC_LABCORP_CLIENT_ID || '',
    scopes: 'openid fhirUser patient/Observation.read patient/DiagnosticReport.read launch/patient',
    description: 'Pull lab results directly from your LabCorp patient portal.',
  },
  {
    id: 'quest',
    name: 'Quest Diagnostics',
    icon: 'analytics',
    color: '#003B71',
    fhirBaseUrl: process.env.EXPO_PUBLIC_QUEST_FHIR_URL || 'https://fhir.questdiagnostics.com/r4',
    authUrl: 'https://fhir.questdiagnostics.com/r4/authorize',
    tokenUrl: 'https://fhir.questdiagnostics.com/r4/token',
    clientId: process.env.EXPO_PUBLIC_QUEST_CLIENT_ID || '',
    scopes: 'openid fhirUser patient/Observation.read patient/DiagnosticReport.read launch/patient',
    description: 'Import MyQuest lab results automatically.',
  },
  {
    id: 'cerner',
    name: 'Oracle Health (Cerner)',
    icon: 'globe',
    color: '#C4262E',
    fhirBaseUrl: process.env.EXPO_PUBLIC_CERNER_FHIR_URL || 'https://fhir-ehr.cerner.com/r4',
    authUrl: 'https://authorization.cerner.com/tenants/ec2458f2-1e24-41c8-b71b-0e701af7583d/protocols/oauth2/profiles/smart-v1/personas/patient/authorize',
    tokenUrl: 'https://authorization.cerner.com/tenants/ec2458f2-1e24-41c8-b71b-0e701af7583d/protocols/oauth2/profiles/smart-v1/token',
    clientId: process.env.EXPO_PUBLIC_CERNER_CLIENT_ID || '',
    scopes: 'openid fhirUser patient/Observation.read patient/DiagnosticReport.read launch/patient',
    description: 'Connect to hospitals using Oracle Health / Cerner systems.',
  },
];

// ─── OAuth Flow ───────────────────────────────────────────────────────

/**
 * Generate the OAuth authorization URL for a provider.
 * The user navigates to this URL in a WebView to log in.
 */
export function getAuthUrl(provider: HealthProvider, state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: provider.clientId,
    redirect_uri: REDIRECT_URI,
    scope: provider.scopes,
    state,
    aud: provider.fhirBaseUrl,
  });
  return `${provider.authUrl}?${params.toString()}`;
}

/**
 * Exchange an authorization code for an access token.
 */
export async function exchangeCodeForToken(
  provider: HealthProvider,
  code: string
): Promise<ProviderConnection> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: provider.clientId,
  });

  const response = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const expiresIn = data.expires_in || 3600;

  const connection: ProviderConnection = {
    providerId: provider.id,
    providerName: provider.name,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    patientId: data.patient || '',
    connectedAt: new Date().toISOString(),
  };

  // Save connection
  await saveConnection(connection);
  return connection;
}

/**
 * Refresh an expired access token.
 */
export async function refreshAccessToken(
  provider: HealthProvider,
  connection: ProviderConnection
): Promise<ProviderConnection> {
  if (!connection.refreshToken) {
    throw new Error('No refresh token available. Please reconnect.');
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: connection.refreshToken,
    client_id: provider.clientId,
  });

  const response = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error('Token refresh failed. Please reconnect.');
  }

  const data = await response.json();
  const expiresIn = data.expires_in || 3600;

  const updated: ProviderConnection = {
    ...connection,
    accessToken: data.access_token,
    refreshToken: data.refresh_token || connection.refreshToken,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
  };

  await saveConnection(updated);
  return updated;
}

// ─── FHIR Data Fetching ──────────────────────────────────────────────

/**
 * Fetch lab observations from a FHIR server.
 * Returns raw FHIR Observation resources.
 */
export async function fetchLabObservations(
  provider: HealthProvider,
  connection: ProviderConnection
): Promise<any[]> {
  // Check if token is expired
  let conn = connection;
  if (new Date(conn.expiresAt) < new Date()) {
    conn = await refreshAccessToken(provider, conn);
  }

  const categories = ['laboratory'];
  const allObservations: any[] = [];

  for (const category of categories) {
    const url = `${provider.fhirBaseUrl}/Observation?patient=${conn.patientId}&category=${category}&_sort=-date&_count=100`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${conn.accessToken}`,
        'Accept': 'application/fhir+json',
      },
    });

    if (!response.ok) {
      console.error(`FHIR fetch failed (${response.status})`);
      continue;
    }

    const bundle = await response.json();
    if (bundle.entry) {
      allObservations.push(...bundle.entry.map((e: any) => e.resource));
    }
  }

  return allObservations;
}

// ─── FHIR to App Format Parser ───────────────────────────────────────

// Common LOINC codes for ITP-relevant labs
const LOINC_MAP: Record<string, { name: string; panel: string }> = {
  // CBC
  '777-3': { name: 'Platelets', panel: 'CBC with Differential' },
  '6690-2': { name: 'WBC', panel: 'CBC with Differential' },
  '789-8': { name: 'RBC', panel: 'CBC with Differential' },
  '718-7': { name: 'Hemoglobin', panel: 'CBC with Differential' },
  '4544-3': { name: 'Hematocrit', panel: 'CBC with Differential' },
  '32623-1': { name: 'MPV', panel: 'CBC with Differential' },
  '770-8': { name: 'Neutrophils', panel: 'CBC with Differential' },
  '736-9': { name: 'Lymphocytes', panel: 'CBC with Differential' },
  // CMP
  '1742-6': { name: 'ALT', panel: 'Comprehensive Metabolic Panel' },
  '1920-8': { name: 'AST', panel: 'Comprehensive Metabolic Panel' },
  '1975-2': { name: 'Bilirubin, Total', panel: 'Comprehensive Metabolic Panel' },
  '2345-7': { name: 'Glucose', panel: 'Comprehensive Metabolic Panel' },
  '3094-0': { name: 'BUN', panel: 'Comprehensive Metabolic Panel' },
  '2160-0': { name: 'Creatinine', panel: 'Comprehensive Metabolic Panel' },
  // Immunology
  '2465-3': { name: 'IgG', panel: 'Immunology' },
  '2458-8': { name: 'IgA', panel: 'Immunology' },
  '2472-9': { name: 'IgM', panel: 'Immunology' },
};

/**
 * Parse FHIR Observation resources into our LabResult format.
 */
export function parseFhirObservations(
  observations: any[],
  sourceName: string
): LabResult[] {
  // Group by date
  const byDate: Record<string, any[]> = {};

  for (const obs of observations) {
    if (!obs.valueQuantity?.value) continue;

    const dateStr = (obs.effectiveDateTime || obs.issued || '').split('T')[0];
    if (!dateStr) continue;

    if (!byDate[dateStr]) byDate[dateStr] = [];
    byDate[dateStr].push(obs);
  }

  // Convert to LabResult format
  const results: LabResult[] = [];
  const sortedDates = Object.keys(byDate).sort().reverse();

  for (const dateKey of sortedDates) {
    const obs = byDate[dateKey];
    const panelMap: Record<string, LabItem[]> = {};

    for (const o of obs) {
      // Try to match LOINC code
      const coding = o.code?.coding?.find((c: any) => c.system?.includes('loinc'));
      const loincCode = coding?.code;
      const mapping = loincCode ? LOINC_MAP[loincCode] : null;

      const name = mapping?.name || coding?.display || o.code?.text || 'Unknown';
      const panelName = mapping?.panel || 'Other Results';

      const value = o.valueQuantity.value;
      const unit = o.valueQuantity.unit || '';

      // Parse reference range
      let ref = '';
      let status: 'normal' | 'warning' | 'critical' = 'normal';

      if (o.referenceRange?.[0]) {
        const range = o.referenceRange[0];
        const low = range.low?.value;
        const high = range.high?.value;
        if (low != null && high != null) {
          ref = `${low}-${high}`;
          if (value < low || value > high) {
            // Determine severity
            if (name === 'Platelets') {
              status = value < 30 ? 'critical' : value < 50 ? 'warning' : 'normal';
            } else {
              const deviation = Math.abs(value - (low + high) / 2) / ((high - low) / 2);
              status = deviation > 2 ? 'critical' : 'warning';
            }
          }
        }
      }

      // Use FHIR interpretation if available
      if (o.interpretation?.[0]?.coding?.[0]?.code) {
        const interp = o.interpretation[0].coding[0].code;
        if (['HH', 'LL', 'AA'].includes(interp)) status = 'critical';
        else if (['H', 'L', 'A'].includes(interp)) status = 'warning';
        else status = 'normal';
      }

      if (!panelMap[panelName]) panelMap[panelName] = [];
      panelMap[panelName].push({ name, value, unit, ref, status });
    }

    // Convert to display date
    const d = new Date(dateKey + 'T12:00:00');
    const displayDate = d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    results.push({
      date: displayDate,
      dateKey,
      source: sourceName,
      isNew: sortedDates.indexOf(dateKey) === 0,
      panels: Object.entries(panelMap).map(([name, items]) => ({ name, items })),
    });
  }

  return results;
}

// ─── Connection Management ────────────────────────────────────────────

export async function getConnections(): Promise<ProviderConnection[]> {
  try {
    const json = await AsyncStorage.getItem(KEYS.CONNECTIONS);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

export async function saveConnection(conn: ProviderConnection): Promise<void> {
  const connections = await getConnections();
  const idx = connections.findIndex((c) => c.providerId === conn.providerId);
  if (idx >= 0) {
    connections[idx] = conn;
  } else {
    connections.push(conn);
  }
  await AsyncStorage.setItem(KEYS.CONNECTIONS, JSON.stringify(connections));
}

export async function removeConnection(providerId: string): Promise<void> {
  const connections = await getConnections();
  const filtered = connections.filter((c) => c.providerId !== providerId);
  await AsyncStorage.setItem(KEYS.CONNECTIONS, JSON.stringify(filtered));
}

// ─── Lab Results Storage ──────────────────────────────────────────────

export async function getStoredLabResults(): Promise<LabResult[]> {
  try {
    const json = await AsyncStorage.getItem(KEYS.LAB_RESULTS);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

export async function saveLabResults(results: LabResult[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.LAB_RESULTS, JSON.stringify(results));
}

export async function mergeLabResults(newResults: LabResult[]): Promise<LabResult[]> {
  const existing = await getStoredLabResults();

  // Merge by dateKey + source, newer data wins
  const merged = [...existing];
  for (const newResult of newResults) {
    const idx = merged.findIndex(
      (r) => r.dateKey === newResult.dateKey && r.source === newResult.source
    );
    if (idx >= 0) {
      merged[idx] = newResult;
    } else {
      merged.push(newResult);
    }
  }

  // Sort by date descending
  merged.sort((a, b) => b.dateKey.localeCompare(a.dateKey));

  // Mark only the latest as new
  merged.forEach((r, i) => { r.isNew = i === 0; });

  await saveLabResults(merged);
  return merged;
}

/**
 * Sync labs from all connected providers.
 */
export async function syncAllLabs(): Promise<{ synced: number; errors: string[] }> {
  const connections = await getConnections();
  let synced = 0;
  const errors: string[] = [];

  for (const conn of connections) {
    const provider = PROVIDERS.find((p) => p.id === conn.providerId);
    if (!provider) continue;

    try {
      const observations = await fetchLabObservations(provider, conn);
      const results = parseFhirObservations(observations, conn.providerName);
      await mergeLabResults(results);
      synced += results.length;
    } catch (error: any) {
      errors.push(`${conn.providerName}: ${error.message}`);
    }
  }

  await AsyncStorage.setItem(KEYS.LAST_SYNC, new Date().toISOString());
  return { synced, errors };
}

export async function getLastSyncTime(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.LAST_SYNC);
}

export default {
  PROVIDERS,
  getAuthUrl,
  exchangeCodeForToken,
  refreshAccessToken,
  fetchLabObservations,
  parseFhirObservations,
  getConnections,
  saveConnection,
  removeConnection,
  getStoredLabResults,
  saveLabResults,
  mergeLabResults,
  syncAllLabs,
  getLastSyncTime,
};
