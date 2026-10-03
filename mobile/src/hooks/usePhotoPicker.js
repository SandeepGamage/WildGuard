import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { PHOTO_RULES } from '../constants/domain';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const PHOTO_ERRORS = Object.freeze({
  PERMISSION: 'PERMISSION',
  TOO_LARGE: 'TOO_LARGE',
  UNSUPPORTED: 'UNSUPPORTED',
});

const mimeFromAsset = (asset) => {
  if (asset.mimeType) return asset.mimeType;
  const extension = asset.uri.split('.').pop()?.toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return 'image/jpeg';
};

const PICKER_OPTIONS = {
  mediaTypes: ['images'],
  quality: PHOTO_RULES.QUALITY,
  allowsEditing: false,
  exif: false,
};

/**
 * Optional report photo from the camera or gallery.
 * @returns {{ photo: object|null, error: string|null, pick: (source: 'camera'|'library') => Promise<void>, remove: () => void }}
 */
export function usePhotoPicker() {
  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState(null);

  const pick = useCallback(async (source) => {
    setError(null);
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError(PHOTO_ERRORS.PERMISSION);
        return;
      }
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(PICKER_OPTIONS)
        : await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const mimeType = mimeFromAsset(asset);
    if (!ALLOWED_TYPES.includes(mimeType)) {
      setError(PHOTO_ERRORS.UNSUPPORTED);
      return;
    }
    if (asset.fileSize && asset.fileSize > PHOTO_RULES.MAX_BYTES) {
      setError(PHOTO_ERRORS.TOO_LARGE);
      return;
    }
    setPhoto({ uri: asset.uri, mimeType, sizeBytes: asset.fileSize ?? 1 });
  }, []);

  const remove = useCallback(() => {
    setPhoto(null);
    setError(null);
  }, []);

  return { photo, error, pick, remove };
}
