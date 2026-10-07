import { PATROL_STATUS, SYNC_STATUS } from '../constants/patrol';

/**
 * Patrol store over a plain JSON document ({ sessions, points, incidents }).
 * The web preview persists it in localStorage and the tests keep it in memory; native
 * builds use the SQLite repository with the same interface.
 *
 * @param {{ load: () => object, save: (data: object) => void }} storage
 */
export function createCollectionPatrolRepository(storage) {
  const read = () => ({ sessions: [], points: [], incidents: [], ...storage.load() });
  const write = (data) => storage.save(data);
  const mutate = (change) => {
    const data = read();
    const result = change(data);
    write(data);
    return result;
  };
  const pending = (row) => row.syncStatus === SYNC_STATUS.PENDING;

  return {
    async insertSession(session) {
      mutate((data) => data.sessions.push({ ...session }));
    },
    async getSession(id) {
      return read().sessions.find((s) => s.id === id) ?? null;
    },
    async getActiveSession(rangerId) {
      return read().sessions.find((s) => s.rangerId === rangerId && s.status === PATROL_STATUS.ACTIVE) ?? null;
    },
    async updateSession(id, fields) {
      mutate((data) => {
        data.sessions = data.sessions.map((s) => (s.id === id ? { ...s, ...fields } : s));
      });
    },

    async insertTrackPoint(point) {
      mutate((data) => data.points.push({ ...point }));
    },
    async listTrackPoints(sessionId) {
      return read()
        .points.filter((p) => p.sessionId === sessionId)
        .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
    },
    async getLastTrackPoint(sessionId) {
      return (await this.listTrackPoints(sessionId)).at(-1) ?? null;
    },
    async listPendingTrackPoints(sessionId, limit) {
      return (await this.listTrackPoints(sessionId)).filter(pending).slice(0, limit);
    },
    async markTrackPointsSynced(ids) {
      mutate((data) => {
        data.points = data.points.map((p) => (ids.includes(p.id) ? { ...p, syncStatus: SYNC_STATUS.SYNCED } : p));
      });
    },

    async insertIncident(incident) {
      mutate((data) => data.incidents.push({ ...incident }));
    },
    async listIncidents(sessionId) {
      return read()
        .incidents.filter((i) => i.sessionId === sessionId)
        .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    },
    async listPendingIncidents(sessionId, limit) {
      return (await this.listIncidents(sessionId)).filter(pending).slice(0, limit);
    },
    async updateIncident(id, fields) {
      mutate((data) => {
        data.incidents = data.incidents.map((i) => (i.id === id ? { ...i, ...fields } : i));
      });
    },
    async markIncidentsSynced(ids) {
      mutate((data) => {
        data.incidents = data.incidents.map((i) =>
          ids.includes(i.id) ? { ...i, syncStatus: SYNC_STATUS.SYNCED } : i,
        );
      });
    },

    /** Items still waiting for the server: unsent track points, incidents and session changes. */
    async countPending(rangerId) {
      const data = read();
      const ids = new Set(data.sessions.filter((s) => s.rangerId === rangerId).map((s) => s.id));
      const unsentSessions = data.sessions.filter(
        (s) => s.rangerId === rangerId && s.syncedStatus !== s.status,
      ).length;
      return (
        data.points.filter((p) => ids.has(p.sessionId) && pending(p)).length +
        data.incidents.filter((i) => ids.has(i.sessionId) && pending(i)).length +
        unsentSessions
      );
    },

    async listSessionsToSync(rangerId) {
      const data = read();
      return data.sessions
        .filter(
          (s) =>
            s.rangerId === rangerId &&
            (s.syncedStatus !== s.status ||
              data.points.some((p) => p.sessionId === s.id && pending(p)) ||
              data.incidents.some((i) => i.sessionId === s.id && pending(i))),
        )
        .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    },

    /** Most recent finished patrol, for the summary screen. */
    async getLatestCompletedSession(rangerId) {
      return (
        read()
          .sessions.filter((s) => s.rangerId === rangerId && s.status === PATROL_STATUS.COMPLETED)
          .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] ?? null
      );
    },
  };
}
