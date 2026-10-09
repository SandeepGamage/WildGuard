const { PATROL_STATUS } = require('../constants/domain');
const { badRequest, conflict, forbidden } = require('../errors/AppError');

/** UC1c – receives patrol data synced from a ranger's phone and acknowledges what it stored. */
class PatrolService {
  /** @param {{ patrolRepository: object, photoService: object }} deps */
  constructor({ patrolRepository, photoService }) {
    this.patrolRepository = patrolRepository;
    this.photoService = photoService;
  }

  /**
   * Store one batch. The sector always comes from the ranger's profile, never from the phone.
   * Returns the ids that were stored so the phone marks exactly those as SYNCED.
   * @param {{ id: string, profile: { sectorId: string|null } }} user
   * @param {{ session: object, trackPoints: object[], incidents: object[] }} batch Already validated by Zod.
   */
  async sync(user, { session, trackPoints, incidents }) {
    const sectorId = user.profile.sectorId;
    if (!sectorId) throw forbidden('NO_SECTOR_ASSIGNMENT', 'You have no patrol sector assigned.');

    incidents.forEach((incident) => this.photoService.assertOwnedPath(user.id, incident.photoPath));
    if (session.status === PATROL_STATUS.COMPLETED && !session.endedAt) {
      throw badRequest('INVALID_PATROL', 'A completed patrol needs an end time.');
    }

    const existing = await this.patrolRepository.findSession(session.id);
    if (existing && existing.ranger_id !== user.id) {
      throw conflict('PATROL_OWNERSHIP', 'This patrol belongs to another ranger.');
    }

    await this.patrolRepository.upsertSession(user.id, { ...session, sectorId: existing?.sector_id ?? sectorId });
    await this.patrolRepository.upsertTrackPoints(user.id, session.id, trackPoints);
    await this.patrolRepository.upsertIncidents(user.id, session.id, existing?.sector_id ?? sectorId, incidents);

    return {
      sessionId: session.id,
      status: session.status,
      trackPointIds: trackPoints.map((p) => p.id),
      incidentIds: incidents.map((i) => i.id),
    };
  }
}

module.exports = { PatrolService };
