/**
 * Azure Cosmos DB Service
 *
 * Provides cloud sync for ITP Tracker data using Cosmos DB REST API.
 * Uses master key authentication with pure-JS HMAC-SHA256.
 *
 * Data Model:
 *   Database: itp-tracker
 *   Container: patient-data (partition key: /patientId)
 *
 * Document types: medications, daily-doses-{date}, checkin-{date},
 *                 checkin-history, side-effects-{date}
 */

// ─── Configuration ────────────────────────────────────────────────────

const CONFIG = {
  endpoint: process.env.EXPO_PUBLIC_COSMOS_ENDPOINT || '',
  key: process.env.EXPO_PUBLIC_COSMOS_KEY || '',
  databaseId: process.env.EXPO_PUBLIC_COSMOS_DATABASE || 'itp-tracker',
  containerId: process.env.EXPO_PUBLIC_COSMOS_CONTAINER || 'patient-data',
};

const PATIENT_ID = 'patient-001'; // Single user for now

// ─── Pure-JS HMAC-SHA256 (no native crypto needed) ───────────────────

// Base64 decode
function b64decode(str: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = [];
  let buffer = 0, bits = 0;
  for (let i = 0; i < str.length; i++) {
    const val = chars.indexOf(str[i]);
    if (val === -1 || val === 64) continue;
    buffer = (buffer << 6) | val;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(output);
}

// Base64 encode
function b64encode(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1] ?? 0, c = bytes[i + 2] ?? 0;
    const triplet = (a << 16) | (b << 8) | c;
    result += chars[(triplet >> 18) & 0x3f];
    result += chars[(triplet >> 12) & 0x3f];
    result += (i + 1 < bytes.length) ? chars[(triplet >> 6) & 0x3f] : '=';
    result += (i + 2 < bytes.length) ? chars[triplet & 0x3f] : '=';
  }
  return result;
}

// SHA-256 constants
const K256 = new Uint32Array([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
]);

function sha256(data: Uint8Array): Uint8Array {
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  const msgLen = data.length;
  const bitLen = msgLen * 8;
  const padLen = ((msgLen + 9 + 63) & ~63);
  const padded = new Uint8Array(padLen);
  padded.set(data);
  padded[msgLen] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padLen - 4, bitLen, false);

  const w = new Uint32Array(64);

  for (let offset = 0; offset < padLen; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = (rotr(w[i-15], 7) ^ rotr(w[i-15], 18) ^ (w[i-15] >>> 3)) >>> 0;
      const s1 = (rotr(w[i-2], 17) ^ rotr(w[i-2], 19) ^ (w[i-2] >>> 10)) >>> 0;
      w[i] = (w[i-16] + s0 + w[i-7] + s1) >>> 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (h + S1 + ch + K256[i] + w[i]) >>> 0;
      const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (S0 + maj) >>> 0;

      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }

  const result = new Uint8Array(32);
  const rv = new DataView(result.buffer);
  rv.setUint32(0, h0); rv.setUint32(4, h1); rv.setUint32(8, h2); rv.setUint32(12, h3);
  rv.setUint32(16, h4); rv.setUint32(20, h5); rv.setUint32(24, h6); rv.setUint32(28, h7);
  return result;
}

function rotr(x: number, n: number): number {
  return ((x >>> n) | (x << (32 - n))) >>> 0;
}

function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
  const blockSize = 64;
  let k = key;
  if (k.length > blockSize) k = sha256(k);
  const paddedKey = new Uint8Array(blockSize);
  paddedKey.set(k);

  const ipad = new Uint8Array(blockSize);
  const opad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    ipad[i] = paddedKey[i] ^ 0x36;
    opad[i] = paddedKey[i] ^ 0x5c;
  }

  const inner = new Uint8Array(blockSize + message.length);
  inner.set(ipad);
  inner.set(message, blockSize);
  const innerHash = sha256(inner);

  const outer = new Uint8Array(blockSize + 32);
  outer.set(opad);
  outer.set(innerHash, blockSize);
  return sha256(outer);
}

// ─── Auth Header Generation ──────────────────────────────────────────

function generateAuthToken(
  verb: string,
  resourceType: string,
  resourceLink: string,
  date: string
): string {
  const key = CONFIG.key;
  if (!key) return '';

  const text = `${verb.toLowerCase()}\n${resourceType.toLowerCase()}\n${resourceLink}\n${date.toLowerCase()}\n\n`;
  const keyBytes = b64decode(key);
  const messageBytes = new TextEncoder().encode(text);
  const signature = hmacSha256(keyBytes, messageBytes);
  const sig64 = b64encode(signature);

  return encodeURIComponent(`type=master&ver=1.0&sig=${sig64}`);
}

// ─── REST API Helpers ─────────────────────────────────────────────────

function getHeaders(verb: string, resourceType: string, resourceLink: string): Record<string, string> {
  const date = new Date().toUTCString();
  return {
    'Authorization': generateAuthToken(verb, resourceType, resourceLink, date),
    'x-ms-date': date,
    'x-ms-version': '2018-12-31',
    'Content-Type': 'application/json',
    'x-ms-documentdb-partitionkey': `["${PATIENT_ID}"]`,
  };
}

function getBaseUrl(): string {
  return `${CONFIG.endpoint}/dbs/${CONFIG.databaseId}/colls/${CONFIG.containerId}`;
}

// ─── Document Types ───────────────────────────────────────────────────

export interface CosmosDocument {
  id: string;
  patientId: string;
  type: string;
  data: any;
  updatedAt: string;
  _rid?: string;
  _self?: string;
  _etag?: string;
  _ts?: number;
}

// ─── CRUD Operations ──────────────────────────────────────────────────

/**
 * Upsert (create or replace) a document in Cosmos DB.
 */
export async function upsertDocument(
  docType: string,
  docId: string,
  data: any
): Promise<CosmosDocument | null> {
  if (!CONFIG.endpoint || !CONFIG.key) return null;

  const resourceLink = `dbs/${CONFIG.databaseId}/colls/${CONFIG.containerId}`;
  const url = `${CONFIG.endpoint}/${resourceLink}/docs`;

  const document: CosmosDocument = {
    id: `${PATIENT_ID}_${docType}_${docId}`,
    patientId: PATIENT_ID,
    type: docType,
    data,
    updatedAt: new Date().toISOString(),
  };

  try {
    const headers = getHeaders('POST', 'docs', resourceLink);
    headers['x-ms-documentdb-is-upsert'] = 'True';

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(document),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Cosmos upsert failed (${response.status}):`, errorText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Cosmos upsert error:', error);
    return null;
  }
}

/**
 * Read a single document by type and ID.
 */
export async function readDocument(
  docType: string,
  docId: string
): Promise<any | null> {
  if (!CONFIG.endpoint || !CONFIG.key) return null;

  const compositeId = `${PATIENT_ID}_${docType}_${docId}`;
  const resourceLink = `dbs/${CONFIG.databaseId}/colls/${CONFIG.containerId}/docs/${compositeId}`;
  const url = `${CONFIG.endpoint}/${resourceLink}`;

  try {
    const headers = getHeaders('GET', 'docs', resourceLink);
    const response = await fetch(url, { method: 'GET', headers });

    if (response.status === 404) return null;
    if (!response.ok) {
      console.error(`Cosmos read failed (${response.status})`);
      return null;
    }

    const doc: CosmosDocument = await response.json();
    return doc.data;
  } catch (error) {
    console.error('Cosmos read error:', error);
    return null;
  }
}

/**
 * Query documents by type.
 */
export async function queryByType(docType: string): Promise<any[]> {
  if (!CONFIG.endpoint || !CONFIG.key) return [];

  const resourceLink = `dbs/${CONFIG.databaseId}/colls/${CONFIG.containerId}`;
  const url = `${CONFIG.endpoint}/${resourceLink}/docs`;

  try {
    const headers = getHeaders('POST', 'docs', resourceLink);
    headers['x-ms-documentdb-isquery'] = 'True';
    headers['Content-Type'] = 'application/query+json';

    const query = {
      query: 'SELECT * FROM c WHERE c.patientId = @patientId AND c.type = @type ORDER BY c.updatedAt DESC',
      parameters: [
        { name: '@patientId', value: PATIENT_ID },
        { name: '@type', value: docType },
      ],
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(query),
    });

    if (!response.ok) {
      console.error(`Cosmos query failed (${response.status})`);
      return [];
    }

    const result = await response.json();
    return (result.Documents || []).map((doc: CosmosDocument) => doc.data);
  } catch (error) {
    console.error('Cosmos query error:', error);
    return [];
  }
}

/**
 * Get all documents for the patient (for full sync).
 */
export async function getAllDocuments(): Promise<CosmosDocument[]> {
  if (!CONFIG.endpoint || !CONFIG.key) return [];

  const resourceLink = `dbs/${CONFIG.databaseId}/colls/${CONFIG.containerId}`;
  const url = `${CONFIG.endpoint}/${resourceLink}/docs`;

  try {
    const headers = getHeaders('POST', 'docs', resourceLink);
    headers['x-ms-documentdb-isquery'] = 'True';
    headers['Content-Type'] = 'application/query+json';

    const query = {
      query: 'SELECT * FROM c WHERE c.patientId = @patientId',
      parameters: [{ name: '@patientId', value: PATIENT_ID }],
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(query),
    });

    if (!response.ok) {
      console.error(`Cosmos getAllDocuments failed (${response.status})`);
      return [];
    }

    const result = await response.json();
    return result.Documents || [];
  } catch (error) {
    console.error('Cosmos getAllDocuments error:', error);
    return [];
  }
}

// ─── High-Level Sync Functions ────────────────────────────────────────

/**
 * Check if Cosmos DB is configured and reachable.
 */
export async function isCosmosAvailable(): Promise<boolean> {
  if (!CONFIG.endpoint || !CONFIG.key) return false;

  try {
    const resourceLink = `dbs/${CONFIG.databaseId}`;
    const url = `${CONFIG.endpoint}/${resourceLink}`;
    const headers = getHeaders('GET', 'dbs', resourceLink);
    delete headers['x-ms-documentdb-partitionkey'];

    const response = await fetch(url, { method: 'GET', headers });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Sync a specific data type to the cloud.
 */
export async function syncToCloud(docType: string, docId: string, data: any): Promise<boolean> {
  const result = await upsertDocument(docType, docId, data);
  return result !== null;
}

/**
 * Pull a specific data type from the cloud.
 */
export async function pullFromCloud(docType: string, docId: string): Promise<any | null> {
  return readDocument(docType, docId);
}

export default {
  upsertDocument,
  readDocument,
  queryByType,
  getAllDocuments,
  isCosmosAvailable,
  syncToCloud,
  pullFromCloud,
};
