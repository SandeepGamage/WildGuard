import { PATROL_ERRORS, PATROL_RULES, PATROL_STATUS, SYNC_STATUS } from '../constants/patrol';
import { distanceMeters } from '../utils/geo';

/** Total walked distance in metres over an ordered list of track points. */
export function trackDistanceMeters(points) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += distanceMeters(points[i - 1], points[i]);
  return total;
}

/** A fix is usable for the track only when its accuracy is known and within the limit (A4). */
export const isAccurateFix = (fix) =>
  Number.isFinite(fix?.accuracy) && fix.accuracy <= PATROL_RULES.MAX_ACCURACY_M;

/** Delay before automatic retry number `failures` (1-based): 30 s, 2 min, then 10 min. */
export function retryDelayMs(failures) {
  const delays = PATROL_RULES.RETRY_DELAYS_MS;
  return delays[Math.min(Math.max(failures, 1) - 1, delays.length - 1)];
}

/**
 * Patrol use-case rules on top of a local repository. Everything is written to the
 * phone first, so nothing is lost without a connection. Dependencies are injected so
 * the logic runs without SQLite, GPS or a network.
 *
 * @param {object} deps
 * @param {object} deps.repository Local patrol store.
 * @param {() => string} deps.newId
 * @param {(photo: object) => Promise<{ photo: object, storageLow: boolean }>} [deps.preparePhoto]
 * @param {() => Date} [deps.now]
 */
export function createPatrolEngine({ repository, newId, preparePhoto, now = () => new Date() }) {
  const prepare = preparePhoto ?? (async (photo) => ({ photo, storageLow: false }));

  async function summarize(sessionId) {
    const session = await repository.getSession(sessionId);
    const points = await repository.listTrackPoints(sessionId);
    const incidents = await repository.listIncidents(sessionId);
    const end = session.endedAt ? new Date(session.endedAt) : now();
    return {
      session,
      durationMs: Math.max(0, end - new Date(session.startedAt)),
      distanceMeters: trackDistanceMeters(points),
      trackPointCount: points.length,
      incidentCount: incidents.length,
      lastPoint: points.at(-1) ?? null,
      pendingCount: await repository.countPending(session.rangerId),
    };
  }

  return {
    summarize,

    getActiveSession: (rangerId) => repository.getActiveSession(rangerId),

    /** Everything about one finished patrol, for the history detail popup. */
    async getDetail(sessionId) {
      const summary = await summarize(sessionId);
      return {
        ...summary,
        incidents: await repository.listIncidents(sessionId),
        pendingCount: await repository.countPendingForSession(sessionId),
      };
    },

    /** Finished patrols, newest first, each with its stats and how many of its items still await upload. */
    async listHistory(rangerId) {
      const sessions = await repository.listCompletedSessions(rangerId);
      const history = [];
      for (const session of sessions) {
        const summary = await summarize(session.id);
        history.push({ ...summary, pendingCount: await repository.countPendingForSession(session.id) });
      }
      return history;
    },

    /** Steps 1-2: create an ACTIVE session. Only one may be active on the device. */
    async startPatrol({ rangerId, assignment }) {
      if (await repository.getActiveSession(rangerId)) {
        throw Object.assign(new Error('A patrol is already active'), { code: PATROL_ERRORS.ALREADY_ACTIVE });
      }
      const session = {
        id: newId(),
        rangerId,
        parkName: assignment.parkName,
        sectorName: assignment.sectorName,
        status: PATROL_STATUS.ACTIVE,
        startedAt: now().toISOString(),
        endedAt: null,
        syncedStatus: null,
      };
      await repository.insertSession(session);
      return session;
    },

    /** Step 4: store the point, or skip it when the fix is weak (A4). */
    async recordFix(sessionId, fix) {
      if (!isAccurateFix(fix)) return { recorded: false };
      const point = {
        id: newId(),
        sessionId,
        latitude: fix.latitude,
        longitude: fix.longitude,
        accuracyM: fix.accuracy,
        recordedAt: new Date(fix.timestamp ?? now()).toISOString(),
        syncStatus: SYNC_STATUS.PENDING,
      };
      await repository.insertTrackPoint(point);
      return { recorded: true, point };
    },

    /**
     * Steps 6-9: save an incident on the phone. A missing GPS fix falls back to the last known
     * position with a location warning (E1); a low-storage phone gets a compressed photo (E2).
     * Text and location are never dropped.
     * @param {{ sessionId: string, incidentType: string, note?: string, photo?: object|null, fix?: object|null }} input
     */
    async logIncident({ sessionId, incidentType, note, photo, fix }) {
      let location = fix && Number.isFinite(fix.latitude) ? fix : null;
      let locationWarning = false;
      let locationFixAt = null;

      if (!location) {
        const last = await repository.getLastTrackPoint(sessionId);
        if (!last) {
          throw Object.assign(new Error('No GPS position known yet'), { code: PATROL_ERRORS.NO_LOCATION });
        }
        location = last;
        locationWarning = true;
        locationFixAt = last.recordedAt;
      }

      let storedPhoto = null;
      let storageWarning = false;
      if (photo) {
        const prepared = await prepare(photo);
        storedPhoto = prepared.photo;
        storageWarning = prepared.storageLow;
      }

      const incident = {
        id: newId(),
        sessionId,
        incidentType,
        note: note?.trim() ? note.trim().slice(0, PATROL_RULES.MAX_NOTE_LENGTH) : null,
        latitude: location.latitude,
        longitude: location.longitude,
        locationWarning,
        locationFixAt,
        occurredAt: now().toISOString(),
        photo: storedPhoto,
        photoPath: null,
        storageWarning,
        syncStatus: SYNC_STATUS.PENDING,
        attempts: 0,
        lastError: null,
      };
      await repository.insertIncident(incident);
      return {
        incident,
        locationWarning,
        storageWarning,
        pendingCount: await repository.countPending((await repository.getSession(sessionId)).rangerId),
      };
    },

    /** Steps 10-11: stop the patrol and return its summary. */
    async endPatrol(sessionId) {
      await repository.updateSession(sessionId, {
        status: PATROL_STATUS.COMPLETED,
        endedAt: now().toISOString(),
      });
      return summarize(sessionId);
    },
  };
}
