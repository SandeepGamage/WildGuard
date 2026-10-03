const { NOTIFICATION_TYPES, INCIDENT_STATUS } = require('../constants/domain');

const villageName = (incident) => incident.village?.nameEn ?? 'your area';

/**
 * Creates notification records and hands them to a push adapter.
 * Verification logic depends on this abstraction only, never on a push SDK.
 */
class NotificationService {
  /**
   * @param {object} deps
   * @param {object} deps.notificationRepository
   * @param {object} deps.profileRepository
   * @param {{ send: Function }} deps.pushAdapter
   */
  constructor({ notificationRepository, profileRepository, pushAdapter }) {
    this.notificationRepository = notificationRepository;
    this.profileRepository = profileRepository;
    this.pushAdapter = pushAdapter;
  }

  /** A person-injured report notifies the divisional liaison officers immediately. */
  async notifyUrgentIncident(incident) {
    const officerIds = await this.profileRepository.listOfficersByDivision(incident.gnDivisionId);
    const title = 'Urgent report: person injured';
    const body = `Report ${incident.trackingCode} from ${villageName(incident)} needs immediate review.`;
    const payload = { type: NOTIFICATION_TYPES.URGENT_INCIDENT, trackingCode: incident.trackingCode };

    await this.notificationRepository.createMany(
      officerIds.map((recipientId) =>
        this.#row({ recipientId, incident, type: NOTIFICATION_TYPES.URGENT_INCIDENT, title, body, payload }),
      ),
    );
    await this.pushAdapter.send({ recipientIds: officerIds, title, body, data: payload });
  }

  /** Verified incident that needs action: notify the rangers of the incident's sector. */
  async notifyFieldTeam(incident) {
    const rangerIds = await this.profileRepository.listRangersBySector(incident.sectorId);
    const title = 'Verified incident needs field action';
    const body = `${incident.trackingCode} near ${villageName(incident)} was verified by a liaison officer.`;
    const payload = {
      type: NOTIFICATION_TYPES.FIELD_ACTION,
      trackingCode: incident.trackingCode,
      incidentType: incident.incidentType,
    };

    await this.notificationRepository.createMany([
      this.#row({
        targetSectorId: incident.sectorId,
        incident,
        type: NOTIFICATION_TYPES.FIELD_ACTION,
        title,
        body,
        payload,
      }),
    ]);
    await this.pushAdapter.send({
      recipientIds: rangerIds,
      sectorId: incident.sectorId,
      title,
      body,
      data: payload,
    });
    return { rangersNotified: rangerIds.length };
  }

  /** Tell each registered reporter in the group the outcome of the review. */
  async notifyReporterOutcome(incidents, decision) {
    const verified = decision === INCIDENT_STATUS.VERIFIED;
    const rows = incidents
      .filter((incident) => incident.reporterId)
      .map((incident) => {
        const payload = {
          type: NOTIFICATION_TYPES.INCIDENT_OUTCOME,
          trackingCode: incident.trackingCode,
          decision,
        };
        return this.#row({
          recipientId: incident.reporterId,
          incident,
          type: NOTIFICATION_TYPES.INCIDENT_OUTCOME,
          title: verified
            ? `Report ${incident.trackingCode} checked: confirmed`
            : `Report ${incident.trackingCode} could not be confirmed`,
          body: verified
            ? 'A liaison officer confirmed your report. Thank you for helping keep people and wildlife safe.'
            : 'Thank you for reporting. We could not confirm this report; please report again if the situation continues.',
          payload,
        });
      });
    const created = await this.notificationRepository.createMany(rows);
    await this.pushAdapter.send({
      recipientIds: rows.map((row) => row.recipient_id),
      title: 'Report outcome',
      body: 'Your report has an outcome.',
      data: { type: NOTIFICATION_TYPES.INCIDENT_OUTCOME },
    });
    return created;
  }

  list(user, pagination) {
    return this.notificationRepository.listForUser(
      { userId: user.id, sectorId: user.profile.sectorId },
      pagination,
    );
  }

  markRead(user, id) {
    return this.notificationRepository.markRead(id, user.id);
  }

  #row({ recipientId = null, targetSectorId = null, incident, type, title, body, payload }) {
    return {
      recipient_id: recipientId,
      target_sector_id: targetSectorId,
      incident_id: incident.id,
      notification_type: type,
      title,
      body,
      payload,
    };
  }
}

module.exports = { NotificationService };
