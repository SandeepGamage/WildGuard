import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'wildguard.onboarded';

/** True once the user has passed the welcome + language screens on this phone. */
export async function isOnboarded() {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function markOnboarded() {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    // Not persisted; the welcome screens simply show again next launch.
  }
}
