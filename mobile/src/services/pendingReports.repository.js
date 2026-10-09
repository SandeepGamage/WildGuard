import * as SQLite from 'expo-sqlite';

const DATABASE_NAME = 'wildguard.db';

export const PENDING_STATUS = Object.freeze({ QUEUED: 'QUEUED', FAILED: 'FAILED' });

let databasePromise = null;

function openDatabase() {
  databasePromise ??= SQLite.openDatabaseAsync(DATABASE_NAME).then(async (db) => {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS pending_reports (
        client_request_id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        photo TEXT,
        photo_path TEXT,
        status TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at TEXT NOT NULL
      );
    `);
    return db;
  });
  return databasePromise;
}

const toItem = (row) => ({
  clientRequestId: row.client_request_id,
  userId: row.user_id,
  payload: JSON.parse(row.payload),
  photo: row.photo ? JSON.parse(row.photo) : null,
  photoPath: row.photo_path,
  status: row.status,
  attempts: row.attempts,
  lastError: row.last_error,
  createdAt: row.created_at,
});

/**
 * Durable local queue of reports that have not reached the server yet
 * (expo-sqlite). A report is written here BEFORE any network call, so it is
 * never lost to a crash, a dropped connection or a server outage.
 */
export const pendingReportsRepository = {
  async add(item) {
    const db = await openDatabase();
    await db.runAsync(
      `INSERT OR REPLACE INTO pending_reports
        (client_request_id, user_id, payload, photo, photo_path, status, attempts, last_error, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      item.clientRequestId,
      item.userId,
      JSON.stringify(item.payload),
      item.photo ? JSON.stringify(item.photo) : null,
      item.photoPath,
      item.status,
      item.attempts,
      item.lastError,
      item.createdAt,
    );
  },

  async listForUser(userId) {
    const db = await openDatabase();
    const rows = await db.getAllAsync(
      'SELECT * FROM pending_reports WHERE user_id = ? ORDER BY created_at DESC',
      userId,
    );
    return rows.map(toItem);
  },

  async update(clientRequestId, fields) {
    const db = await openDatabase();
    const current = await db.getFirstAsync(
      'SELECT * FROM pending_reports WHERE client_request_id = ?',
      clientRequestId,
    );
    if (!current) return;
    const next = { ...toItem(current), ...fields };
    await this.add(next);
  },

  async remove(clientRequestId) {
    const db = await openDatabase();
    await db.runAsync('DELETE FROM pending_reports WHERE client_request_id = ?', clientRequestId);
  },
};
