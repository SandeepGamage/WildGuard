import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { PATROL_RULES } from '../constants/patrol';

async function freeBytes() {
  try {
    return await FileSystem.getFreeDiskStorageAsync();
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

/**
 * E2 – when the phone is low on storage, shrink the photo so the incident still saves.
 * Never throws: if compression fails the original photo is kept.
 * @param {{ uri: string, mimeType: string, sizeBytes: number }} photo
 * @returns {Promise<{ photo: object, storageLow: boolean }>}
 */
export async function preparePatrolPhoto(photo) {
  if ((await freeBytes()) >= PATROL_RULES.LOW_STORAGE_BYTES) return { photo, storageLow: false };
  try {
    const result = await ImageManipulator.manipulateAsync(
      photo.uri,
      [{ resize: { width: PATROL_RULES.COMPRESSED_WIDTH } }],
      { compress: PATROL_RULES.COMPRESSED_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
    );
    return {
      photo: { uri: result.uri, mimeType: 'image/jpeg', sizeBytes: Math.min(photo.sizeBytes, 400 * 1024) },
      storageLow: true,
    };
  } catch {
    return { photo, storageLow: true };
  }
}
