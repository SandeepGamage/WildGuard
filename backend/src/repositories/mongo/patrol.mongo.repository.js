const { PatrolSession, PatrolTrackPoint, PatrolIncident } = require('../../models/mongo/schemas');
const { conflict } = require('../../errors/AppError');

const OWNERSHIP_MESSAGE = 'One of the records belongs to another ranger.';

/** Persistence for UC1. Every write is an upsert by client id, so retries never duplicate data. */
class MongoPatrolRepository {
  async upsertSession(rangerId, session) {
    const existing = await PatrolSession.findOne({ id: session.id }).select('ranger_id').lean();
    if (existing && existing.ranger_id !== rangerId) throw conflict('PATROL_OWNERSHIP', OWNERSHIP_MESSAGE);

    await PatrolSession.updateOne(
      { id: session.id },
      {
        $set: { status: session.status, ended_at: session.endedAt ?? null },
        $setOnInsert: {
          id: session.id,
          ranger_id: rangerId,
          sector_id: session.sectorId,
          started_at: session.startedAt,
        },
      },
      { upsert: true },
    );
  }

  /** @returns {Promise<{ ranger_id: string, sector_id: string } | null>} */
  findSession(sessionId) {
    return PatrolSession.findOne({ id: sessionId }).select('ranger_id sector_id').lean();
  }

  async upsertTrackPoints(rangerId, sessionId, points) {
    if (points.length === 0) return;
    await this.#assertNotOwnedByOthers(PatrolTrackPoint, rangerId, points);
    await PatrolTrackPoint.bulkWrite(
      points.map((p) => ({
        updateOne: {
          filter: { id: p.id },
          update: {
            $setOnInsert: {
              id: p.id,
              session_id: sessionId,
              ranger_id: rangerId,
              latitude: p.latitude,
              longitude: p.longitude,
              accuracy_m: p.accuracyM ?? null,
              recorded_at: p.recordedAt,
            },
          },
          upsert: true,
        },
      })),
    );
  }

  async upsertIncidents(rangerId, sessionId, sectorId, incidents) {
    if (incidents.length === 0) return;
    await this.#assertNotOwnedByOthers(PatrolIncident, rangerId, incidents);
    await PatrolIncident.bulkWrite(
      incidents.map((i) => ({
        updateOne: {
          filter: { id: i.id },
          update: {
            $setOnInsert: {
              id: i.id,
              session_id: sessionId,
              ranger_id: rangerId,
              sector_id: sectorId,
              incident_type: i.incidentType,
              note: i.note ?? null,
              latitude: i.latitude,
              longitude: i.longitude,
              location_warning: i.locationWarning ?? false,
              location_fix_at: i.locationFixAt ?? null,
              occurred_at: i.occurredAt,
              photo_path: i.photoPath ?? null,
            },
          },
          upsert: true,
        },
      })),
    );
  }

  async #assertNotOwnedByOthers(Model, rangerId, rows) {
    const foreign = await Model.exists({ id: { $in: rows.map((r) => r.id) }, ranger_id: { $ne: rangerId } });
    if (foreign) throw conflict('PATROL_OWNERSHIP', OWNERSHIP_MESSAGE);
  }
}

/** UC4 read side: completed patrols and logged incidents, shaped for the analytics service. */
class MongoPatrolDataSource {
  async listTracks(filter) {
    const sessions = await PatrolSession.find({
      sector_id: { $in: filter.sectorIds },
      status: 'COMPLETED',
      started_at: { $gte: filter.dateFrom, $lt: filter.dateTo },
    }).lean();
    return sessions.map((s) => ({
      sectorId: s.sector_id,
      startedAt: s.started_at,
      endedAt: s.ended_at,
      hours: Math.max(0, (new Date(s.ended_at) - new Date(s.started_at)) / 3600000),
    }));
  }

  async listIncidents(filter) {
    const docs = await PatrolIncident.find({
      sector_id: { $in: filter.sectorIds },
      occurred_at: { $gte: filter.dateFrom, $lt: filter.dateTo },
    }).lean();
    return docs.map((d) => ({
      incidentType: d.incident_type,
      occurredAt: d.occurred_at,
      latitude: d.latitude,
      longitude: d.longitude,
      sectorId: d.sector_id,
    }));
  }
}

module.exports = { MongoPatrolRepository, MongoPatrolDataSource };
