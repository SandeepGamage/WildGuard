export const PENDING_STATUS = Object.freeze({ QUEUED: 'QUEUED', FAILED: 'FAILED' });

const STORAGE_KEY = 'wildguard.pendingReports';

const readAll = () => {
  try {
    return JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
};

const writeAll = (items) => globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(items));

/**
 * Web fallback for `expo start --web` previews (expo-sqlite needs a WASM setup on
 * the web). Same interface as pendingReports.repository.js, backed by localStorage.
 * Native builds use the SQLite implementation.
 */
export const pendingReportsRepository = {
  async add(item) {
    writeAll([...readAll().filter((row) => row.clientRequestId !== item.clientRequestId), item]);
  },

  async listForUser(userId) {
    return readAll()
      .filter((row) => row.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async update(clientRequestId, fields) {
    writeAll(readAll().map((row) => (row.clientRequestId === clientRequestId ? { ...row, ...fields } : row)));
  },

  async remove(clientRequestId) {
    writeAll(readAll().filter((row) => row.clientRequestId !== clientRequestId));
  },
};
