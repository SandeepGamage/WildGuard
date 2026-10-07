import { createCollectionPatrolRepository } from './patrol.repository.collection';

const STORAGE_KEY = 'wildguard.patrol';

/**
 * Web fallback for `expo start --web` previews (expo-sqlite needs a WASM setup on the
 * web). Same interface as patrol.repository.js, backed by localStorage.
 */
export const patrolRepository = createCollectionPatrolRepository({
  load() {
    try {
      return JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) ?? '{}');
    } catch {
      return {};
    }
  },
  save(data) {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(data));
  },
});
