import { ApiError } from '../api/client';
import { PATROL_RULES } from '../constants/patrol';
import { isNetworkError } from './reportSync.core';

export const FLUSH_STATE = Object.freeze({ IDLE: 'IDLE', SYNCED: 'SYNCED', FAILED: 'FAILED' });

const omitNull = (object) =>
  Object.fromEntries(Object.entries(object).filter(([, value]) => value !== null && value !== undefined));

const toApiPoint = (p) =>
  omitNull({
    id: p.id,
    latitude: p.latitude,
    longitude: p.longitude,
    accuracyM: p.accuracyM,
    recordedAt: p.recordedAt,
  });

const toApiIncident = (i) =>
  omitNull({
    id: i.id,
    incidentType: i.incidentType,
    note: i.note,
    latitude: i.latitude,
    longitude: i.longitude,
    locationWarning: i.locationWarning,
    locationFixAt: i.locationFixAt,
    occurredAt: i.occurredAt,
    photoPath: i.photoPath,
  });

const toApiSession = (s) =>
  omitNull({ id: s.id, status: s.status, startedAt: s.startedAt, endedAt: s.endedAt });

/**
 * UC1c – uploads everything still PENDING in batches of up to 50. An item becomes
 * SYNCED only after the server acknowledges its id, so a failure loses nothing.
 *
 * @param {object} deps
 * @param {object} deps.repository Local patrol store.
 * @param {(body: object) => Promise<{ trackPointIds: string[], incidentIds: string[] }>} deps.syncPatrol API call.
 * @param {(photo: object) => Promise<string>} deps.uploadPhoto Returns the storage path.
 */
export function createPatrolSync({ repository, syncPatrol, uploadPhoto }) {
  async function ensurePhoto(incident) {
    if (!incident.photo || incident.photoPath) return incident;
    try {
      const photoPath = await uploadPhoto(incident.photo);
      await repository.updateIncident(incident.id, { photoPath });
      return { ...incident, photoPath };
    } catch (error) {
      // A connection problem is retried later. Anything else must not block the
      // incident, so it goes up without the photo.
      if (isNetworkError(error) || !(error instanceof ApiError)) throw error;
      await repository.updateIncident(incident.id, { photo: null });
      return { ...incident, photo: null };
    }
  }

  async function syncSession(session) {
    let uploaded = 0;
    let sentSession = false;
    const limit = PATROL_RULES.BATCH_SIZE;

    for (;;) {
      const points = await repository.listPendingTrackPoints(session.id, limit);
      const pendingIncidents = await repository.listPendingIncidents(session.id, limit);
      const sessionNeedsSync = session.syncedStatus !== session.status && !sentSession;
      if (points.length === 0 && pendingIncidents.length === 0 && !sessionNeedsSync) return uploaded;

      let incidents;
      try {
        incidents = [];
        for (const incident of pendingIncidents) incidents.push(await ensurePhoto(incident));
        const ack = await syncPatrol({
          session: toApiSession(session),
          trackPoints: points.map(toApiPoint),
          incidents: incidents.map(toApiIncident),
        });
        await repository.markTrackPointsSynced(ack.trackPointIds);
        await repository.markIncidentsSynced(ack.incidentIds);
        // A server that acknowledges none of what was sent would otherwise make this loop forever.
        const sent = new Set([...points, ...incidents].map((item) => item.id));
        const progressed = [...ack.trackPointIds, ...ack.incidentIds].some((id) => sent.has(id));
        if (sent.size > 0 && !progressed) {
          throw Object.assign(new Error('Server acknowledged nothing'), { code: 'NO_ACK' });
        }
        await repository.updateSession(session.id, { syncedStatus: session.status });
        sentSession = true;
        uploaded += ack.trackPointIds.length + ack.incidentIds.length;
      } catch (error) {
        for (const incident of pendingIncidents) {
          await repository.updateIncident(incident.id, {
            attempts: incident.attempts + 1,
            lastError: error.code ?? 'ERROR',
          });
        }
        throw error;
      }
    }
  }

  return {
    /**
     * Upload all pending patrol data for this ranger.
     * @returns {Promise<{ state: string, uploaded: number, error?: Error }>}
     */
    async flush(rangerId) {
      const sessions = await repository.listSessionsToSync(rangerId);
      if (sessions.length === 0) return { state: FLUSH_STATE.IDLE, uploaded: 0 };

      let uploaded = 0;
      try {
        for (const session of sessions) uploaded += await syncSession(session);
      } catch (error) {
        return { state: FLUSH_STATE.FAILED, uploaded, error };
      }
      return { state: FLUSH_STATE.SYNCED, uploaded };
    },
  };
}
