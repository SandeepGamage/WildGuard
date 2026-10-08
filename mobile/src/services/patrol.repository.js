import * as SQLite from 'expo-sqlite';
import { PATROL_STATUS, SYNC_STATUS } from '../constants/patrol';

const DATABASE_NAME = 'wildguard.db';

let databasePromise = null;

function openDatabase() {
  databasePromise ??= SQLite.openDatabaseAsync(DATABASE_NAME).then(async (db) => {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS patrol_sessions (
        id TEXT PRIMARY KEY NOT NULL,
        ranger_id TEXT NOT NULL,
        park_name TEXT NOT NULL,
        sector_name TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        synced_status TEXT
      );
      CREATE TABLE IF NOT EXISTS patrol_track_points (
        id TEXT PRIMARY KEY NOT NULL,
        session_id TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        accuracy_m REAL,
        recorded_at TEXT NOT NULL,
        sync_status TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_patrol_points_session ON patrol_track_points (session_id, sync_status);
      CREATE TABLE IF NOT EXISTS patrol_incidents (
        id TEXT PRIMARY KEY NOT NULL,
        session_id TEXT NOT NULL,
        incident_type TEXT NOT NULL,
        note TEXT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        location_warning INTEGER NOT NULL DEFAULT 0,
        location_fix_at TEXT,
        occurred_at TEXT NOT NULL,
        photo TEXT,
        photo_path TEXT,
        storage_warning INTEGER NOT NULL DEFAULT 0,
        sync_status TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_patrol_incidents_session ON patrol_incidents (session_id, sync_status);
    `);
    return db;
  });
  return databasePromise;
}

const toSession = (r) =>
  r && {
    id: r.id,
    rangerId: r.ranger_id,
    parkName: r.park_name,
    sectorName: r.sector_name,
    status: r.status,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    syncedStatus: r.synced_status,
  };

const toPoint = (r) => ({
  id: r.id,
  sessionId: r.session_id,
  latitude: r.latitude,
  longitude: r.longitude,
  accuracyM: r.accuracy_m,
  recordedAt: r.recorded_at,
  syncStatus: r.sync_status,
});

const toIncident = (r) => ({
  id: r.id,
  sessionId: r.session_id,
  incidentType: r.incident_type,
  note: r.note,
  latitude: r.latitude,
  longitude: r.longitude,
  locationWarning: Boolean(r.location_warning),
  locationFixAt: r.location_fix_at,
  occurredAt: r.occurred_at,
  photo: r.photo ? JSON.parse(r.photo) : null,
  photoPath: r.photo_path,
  storageWarning: Boolean(r.storage_warning),
  syncStatus: r.sync_status,
  attempts: r.attempts,
  lastError: r.last_error,
});

const SESSION_COLUMNS = {
  status: 'status',
  endedAt: 'ended_at',
  syncedStatus: 'synced_status',
};

const INCIDENT_COLUMNS = {
  photoPath: 'photo_path',
  attempts: 'attempts',
  lastError: 'last_error',
};

const placeholders = (ids) => ids.map(() => '?').join(', ');

/**
 * Durable local store for UC1 (expo-sqlite). Every patrol record is written here before
 * any network call, and stays PENDING until the server acknowledges it.
 */
export const patrolRepository = {
  async insertSession(s) {
    const db = await openDatabase();
    await db.runAsync(
      `INSERT INTO patrol_sessions
        (id, ranger_id, park_name, sector_name, status, started_at, ended_at, synced_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      s.id,
      s.rangerId,
      s.parkName,
      s.sectorName,
      s.status,
      s.startedAt,
      s.endedAt,
      s.syncedStatus,
    );
  },

  async getSession(id) {
    const db = await openDatabase();
    return toSession(await db.getFirstAsync('SELECT * FROM patrol_sessions WHERE id = ?', id));
  },

  async getActiveSession(rangerId) {
    const db = await openDatabase();
    return toSession(
      await db.getFirstAsync(
        'SELECT * FROM patrol_sessions WHERE ranger_id = ? AND status = ? ORDER BY started_at DESC',
        rangerId,
        PATROL_STATUS.ACTIVE,
      ),
    );
  },

  async getLatestCompletedSession(rangerId) {
    const db = await openDatabase();
    return toSession(
      await db.getFirstAsync(
        'SELECT * FROM patrol_sessions WHERE ranger_id = ? AND status = ? ORDER BY started_at DESC',
        rangerId,
        PATROL_STATUS.COMPLETED,
      ),
    );
  },

  async updateSession(id, fields) {
    const entries = Object.entries(fields).filter(([key]) => SESSION_COLUMNS[key]);
    if (entries.length === 0) return;
    const db = await openDatabase();
    await db.runAsync(
      `UPDATE patrol_sessions SET ${entries.map(([key]) => `${SESSION_COLUMNS[key]} = ?`).join(', ')} WHERE id = ?`,
      ...entries.map(([, value]) => value),
      id,
    );
  },

  async insertTrackPoint(p) {
    const db = await openDatabase();
    await db.runAsync(
      `INSERT OR IGNORE INTO patrol_track_points
        (id, session_id, latitude, longitude, accuracy_m, recorded_at, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      p.id,
      p.sessionId,
      p.latitude,
      p.longitude,
      p.accuracyM,
      p.recordedAt,
      p.syncStatus,
    );
  },

  async listTrackPoints(sessionId) {
    const db = await openDatabase();
    const rows = await db.getAllAsync(
      'SELECT * FROM patrol_track_points WHERE session_id = ? ORDER BY recorded_at ASC',
      sessionId,
    );
    return rows.map(toPoint);
  },

  async getLastTrackPoint(sessionId) {
    const db = await openDatabase();
    const row = await db.getFirstAsync(
      'SELECT * FROM patrol_track_points WHERE session_id = ? ORDER BY recorded_at DESC',
      sessionId,
    );
    return row ? toPoint(row) : null;
  },

  async listPendingTrackPoints(sessionId, limit) {
    const db = await openDatabase();
    const rows = await db.getAllAsync(
      'SELECT * FROM patrol_track_points WHERE session_id = ? AND sync_status = ? ORDER BY recorded_at ASC LIMIT ?',
      sessionId,
      SYNC_STATUS.PENDING,
      limit,
    );
    return rows.map(toPoint);
  },

  async markTrackPointsSynced(ids) {
    if (ids.length === 0) return;
    const db = await openDatabase();
    await db.runAsync(
      `UPDATE patrol_track_points SET sync_status = ? WHERE id IN (${placeholders(ids)})`,
      SYNC_STATUS.SYNCED,
      ...ids,
    );
  },

  async insertIncident(i) {
    const db = await openDatabase();
    await db.runAsync(
      `INSERT INTO patrol_incidents
        (id, session_id, incident_type, note, latitude, longitude, location_warning, location_fix_at,
         occurred_at, photo, photo_path, storage_warning, sync_status, attempts, last_error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      i.id,
      i.sessionId,
      i.incidentType,
      i.note,
      i.latitude,
      i.longitude,
      i.locationWarning ? 1 : 0,
      i.locationFixAt,
      i.occurredAt,
      i.photo ? JSON.stringify(i.photo) : null,
      i.photoPath,
      i.storageWarning ? 1 : 0,
      i.syncStatus,
      i.attempts,
      i.lastError,
    );
  },

  async listIncidents(sessionId) {
    const db = await openDatabase();
    const rows = await db.getAllAsync(
      'SELECT * FROM patrol_incidents WHERE session_id = ? ORDER BY occurred_at ASC',
      sessionId,
    );
    return rows.map(toIncident);
  },

  async listPendingIncidents(sessionId, limit) {
    const db = await openDatabase();
    const rows = await db.getAllAsync(
      'SELECT * FROM patrol_incidents WHERE session_id = ? AND sync_status = ? ORDER BY occurred_at ASC LIMIT ?',
      sessionId,
      SYNC_STATUS.PENDING,
      limit,
    );
    return rows.map(toIncident);
  },

  async updateIncident(id, fields) {
    const db = await openDatabase();
    const sets = [];
    const values = [];
    for (const [key, value] of Object.entries(fields)) {
      if (key === 'photo') {
        sets.push('photo = ?');
        values.push(value ? JSON.stringify(value) : null);
      } else if (INCIDENT_COLUMNS[key]) {
        sets.push(`${INCIDENT_COLUMNS[key]} = ?`);
        values.push(value);
      }
    }
    if (sets.length === 0) return;
    await db.runAsync(`UPDATE patrol_incidents SET ${sets.join(', ')} WHERE id = ?`, ...values, id);
  },

  async markIncidentsSynced(ids) {
    if (ids.length === 0) return;
    const db = await openDatabase();
    await db.runAsync(
      `UPDATE patrol_incidents SET sync_status = ? WHERE id IN (${placeholders(ids)})`,
      SYNC_STATUS.SYNCED,
      ...ids,
    );
  },

  /** Items still waiting for the server: unsent track points, incidents and session changes. */
  async countPending(rangerId) {
    const db = await openDatabase();
    const row = await db.getFirstAsync(
      `SELECT
         (SELECT COUNT(*) FROM patrol_track_points p JOIN patrol_sessions s ON s.id = p.session_id
           WHERE s.ranger_id = ? AND p.sync_status = ?) +
         (SELECT COUNT(*) FROM patrol_incidents i JOIN patrol_sessions s ON s.id = i.session_id
           WHERE s.ranger_id = ? AND i.sync_status = ?) +
         (SELECT COUNT(*) FROM patrol_sessions
           WHERE ranger_id = ? AND (synced_status IS NULL OR synced_status != status)) AS total`,
      rangerId,
      SYNC_STATUS.PENDING,
      rangerId,
      SYNC_STATUS.PENDING,
      rangerId,
    );
    return row?.total ?? 0;
  },

  async listSessionsToSync(rangerId) {
    const db = await openDatabase();
    const rows = await db.getAllAsync(
      `SELECT * FROM patrol_sessions s
       WHERE s.ranger_id = ? AND (
         s.synced_status IS NULL OR s.synced_status != s.status
         OR EXISTS (SELECT 1 FROM patrol_track_points p WHERE p.session_id = s.id AND p.sync_status = ?)
         OR EXISTS (SELECT 1 FROM patrol_incidents i WHERE i.session_id = s.id AND i.sync_status = ?))
       ORDER BY s.started_at ASC`,
      rangerId,
      SYNC_STATUS.PENDING,
      SYNC_STATUS.PENDING,
    );
    return rows.map(toSession);
  },
};
