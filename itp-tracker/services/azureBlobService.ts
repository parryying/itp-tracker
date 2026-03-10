/**
 * Azure Blob Storage Service
 *
 * Uploads patient photos directly to Azure Blob Storage using SAS tokens.
 * Photos are organized by date and body region for easy retrieval and comparison.
 *
 * Blob path format: {patientId}/{YYYY-MM-DD}/{bodyRegion}_{timestamp}.jpg
 *
 * Setup:
 *   1. Create an Azure Storage Account
 *   2. Create a container called "patient-photos"
 *   3. Generate a SAS token with rwdl permissions
 *   4. Add credentials to .env
 */

import * as FileSystem from 'expo-file-system';

// Configuration — loaded from environment or constants
const CONFIG = {
  accountName: process.env.EXPO_PUBLIC_AZURE_STORAGE_ACCOUNT_NAME || 'itptrackerstorage',
  containerName: process.env.EXPO_PUBLIC_AZURE_STORAGE_CONTAINER_NAME || 'patient-photos',
  sasToken: process.env.EXPO_PUBLIC_AZURE_STORAGE_SAS_TOKEN || '',
};

/** Constructs the base URL for the Azure Blob Storage container */
function getContainerUrl(): string {
  return `https://${CONFIG.accountName}.blob.core.windows.net/${CONFIG.containerName}`;
}

/** Constructs the full URL for a specific blob, including SAS token */
function getBlobUrl(blobPath: string): string {
  return `${getContainerUrl()}/${blobPath}?${CONFIG.sasToken}`;
}

/**
 * Generates a structured blob path for a photo.
 *
 * Format: {patientId}/{date}/{bodyRegion}_{timestamp}.jpg
 * Example: patient-001/2026-03-10/left_arm_1710072000000.jpg
 */
function generateBlobPath(
  patientId: string,
  bodyRegion: string,
  date?: Date
): string {
  const d = date || new Date();
  const dateStr = d.toISOString().split('T')[0]; // YYYY-MM-DD
  const timestamp = d.getTime();
  const sanitizedRegion = bodyRegion.replace(/\s+/g, '_').toLowerCase();
  return `${patientId}/${dateStr}/${sanitizedRegion}_${timestamp}.jpg`;
}

/**
 * Upload a photo from the device to Azure Blob Storage.
 *
 * The photo is read from the local URI (from expo-image-picker or expo-camera),
 * uploaded to Azure, and the local file is NOT saved to the photo album.
 *
 * @param localUri - Local file URI from image picker/camera (e.g., file:///...)
 * @param patientId - Patient identifier
 * @param bodyRegion - Body region label (e.g., "left_arm", "mouth")
 * @param date - Date of the photo (defaults to now)
 * @returns The blob URL (without SAS token) for storage in the database
 */
export async function uploadPhoto(
  localUri: string,
  patientId: string,
  bodyRegion: string,
  date?: Date
): Promise<{ blobUrl: string; blobPath: string }> {
  const blobPath = generateBlobPath(patientId, bodyRegion, date);
  const uploadUrl = getBlobUrl(blobPath);

  try {
    // Read the file as base64
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Upload to Azure Blob Storage via PUT with SAS token
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'x-ms-blob-type': 'BlockBlob',
        'Content-Type': 'image/jpeg',
        'x-ms-blob-content-type': 'image/jpeg',
      },
      body: base64ToArrayBuffer(base64),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Azure upload failed (${response.status}): ${errorText}`);
    }

    // Return the public URL (without SAS) for DB storage
    const publicUrl = `${getContainerUrl()}/${blobPath}`;
    return { blobUrl: publicUrl, blobPath };
  } catch (error) {
    console.error('Photo upload failed:', error);
    throw error;
  }
}

/**
 * Get a signed URL for viewing a previously uploaded photo.
 * Appends the SAS token so the image can be displayed in the app.
 */
export function getSignedPhotoUrl(blobPath: string): string {
  return getBlobUrl(blobPath);
}

/**
 * List all photos for a specific patient and date.
 * Uses the Azure Blob Storage List Blobs API.
 */
export async function listPhotosForDate(
  patientId: string,
  date: Date
): Promise<{ name: string; url: string }[]> {
  const dateStr = date.toISOString().split('T')[0];
  const prefix = `${patientId}/${dateStr}/`;
  const listUrl = `${getContainerUrl()}?restype=container&comp=list&prefix=${prefix}&${CONFIG.sasToken}`;

  try {
    const response = await fetch(listUrl);
    if (!response.ok) {
      throw new Error(`List blobs failed (${response.status})`);
    }

    const xmlText = await response.text();
    // Simple XML parsing for blob names
    const blobs: { name: string; url: string }[] = [];
    const nameRegex = /<Name>(.*?)<\/Name>/g;
    let match;
    while ((match = nameRegex.exec(xmlText)) !== null) {
      const name = match[1];
      blobs.push({
        name,
        url: getSignedPhotoUrl(name),
      });
    }
    return blobs;
  } catch (error) {
    console.error('List photos failed:', error);
    return [];
  }
}

/**
 * Delete a specific photo from Azure Blob Storage.
 */
export async function deletePhoto(blobPath: string): Promise<boolean> {
  const deleteUrl = getBlobUrl(blobPath);

  try {
    const response = await fetch(deleteUrl, { method: 'DELETE' });
    return response.ok;
  } catch (error) {
    console.error('Delete photo failed:', error);
    return false;
  }
}

/**
 * Get photos from the previous day for comparison.
 */
export async function getPreviousDayPhotos(
  patientId: string,
  currentDate?: Date
): Promise<{ name: string; url: string; region: string }[]> {
  const d = currentDate || new Date();
  const prevDate = new Date(d);
  prevDate.setDate(prevDate.getDate() - 1);

  const photos = await listPhotosForDate(patientId, prevDate);
  return photos.map((p) => {
    // Extract region from blob name: patientId/date/region_timestamp.jpg
    const filename = p.name.split('/').pop() || '';
    const region = filename.replace(/_\d+\.jpg$/, '');
    return { ...p, region };
  });
}

/** Convert base64 string to ArrayBuffer for fetch body */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export default {
  uploadPhoto,
  getSignedPhotoUrl,
  listPhotosForDate,
  deletePhoto,
  getPreviousDayPhotos,
};
