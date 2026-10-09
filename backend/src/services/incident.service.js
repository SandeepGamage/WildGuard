const {
  INCIDENT_SOURCE,
  INCIDENT_STATUS,
  INCIDENT_TYPES,
  OCCURRED_WHEN,
  URGENCY,
} = require('../constants/domain');
const { badRequest, notFound } = require('../errors/AppError');
const { presentForVillager } = require('../models/incident.model');
const { EARLIER_TODAY_OFFSET_MS, MAX_CAPTURE_AGE_MS, MAX_CLOCK_SKEW_MS } = require('../utils/time');

/**
 * Report creation and the villager's own report history. Both the app and the
 * SMS channel go through `submit`, so duplicate detection, urgency and
 * idempotency behave identically.
 */
class IncidentService {
  /**
   * @param {object} deps
   * @param {object} deps.incidentRepository
   * @param {object} deps.verificationRepository
   * @param {object} deps.villageRepository
   * @param {object} deps.locationResolver
   * @param {object} deps.duplicateDetector
   * @param {object} deps.notificationService
   * @param {object} deps.photoService
   * @param {object} deps.logger
   * @param {() => Date} [deps.clock]
   */
  constructor(deps) {
    Object.assign(this, deps);
    this.clock = deps.clock ?? (() => new Date());
  }

  /**
   * Create a report from the mobile app for the authenticated villager.
   * Safe to retry: the same clientRequestId returns the original report.
   * @returns {Promise<{ report: object, created: boolean }>}
   */
  async createFromApp(user, input) {
    this.photoService.assertOwnedPath(user.id, input.photoPath);
    const location = await this.#locationFromApp(user, input);

    const { incident, created } = await this.submit({
      source: INCIDENT_SOURCE.APP,
      reporterId: user.id,
      reporterPhone: user.profile.phone,
      clientRequestId: input.clientRequestId,
      incidentType: input.incidentType,
      elephantCountBand: input.elephantCountBand,
      occurredWhen: input.occurredWhen,
      capturedAt: input.capturedAt,
      photoPath: input.photoPath,
      location,
    });
    return { report: presentForVillager(incident), created };
  }

  /**
   * Shared persistence path for every channel.
   * @param {object} command Normalised report command (see createFromApp / SmsService).
   * @returns {Promise<{ incident: object, created: boolean }>}
   */
  async submit(command) {
    if (command.reporterId && command.clientRequestId) {
      const existing = await this.incidentRepository.findByClientRequestId(
        command.reporterId,
        command.clientRequestId,
      );
      if (existing) return { incident: existing, created: false };
    }

    const location = await this.#resolveCoordinates(command.location);
    const occurredAt = this.#occurredAt(command);
    const duplicateOfId = await this.duplicateDetector.detect({
      incidentType: command.incidentType,
      latitude: location.latitude,
      longitude: location.longitude,
      occurredAt,
    });
    const urgency = command.incidentType === INCIDENT_TYPES.PERSON_INJURED ? URGENCY.URGENT : URGENCY.NORMAL;

    const { incident, created } = await this.incidentRepository.insert({
      client_request_id: command.clientRequestId ?? null,
      reporter_id: command.reporterId ?? null,
      reporter_phone: command.reporterPhone ?? null,
      source: command.source,
      incident_type: command.incidentType,
      status: duplicateOfId ? INCIDENT_STATUS.DUPLICATE : INCIDENT_STATUS.PENDING,
      urgency,
      village_id: location.villageId,
      latitude: location.latitude,
      longitude: location.longitude,
      raw_location_text: location.rawLocationText ?? null,
      elephant_count_band: command.elephantCountBand ?? null,
      occurred_when: command.occurredWhen ?? OCCURRED_WHEN.NOW,
      occurred_at: occurredAt.toISOString(),
      photo_path: command.photoPath ?? null,
      duplicate_of_id: duplicateOfId,
      call_back_required: Boolean(location.callBackRequired),
    });

    if (created && urgency === URGENCY.URGENT) {
      await this.#notifySafely(() => this.notificationService.notifyUrgentIncident(incident));
    }
    return { incident, created };
  }

  async listMine(user, pagination) {
    const incidents = await this.incidentRepository.listByReporter(user.id, pagination);
    return incidents.map((incident) => presentForVillager(incident));
  }

  /** A villager can open only their own report; anything else is reported as not found. */
  async getMine(user, id) {
    const incident = await this.incidentRepository.findById(id);
    if (!incident || incident.reporterId !== user.id) {
      throw notFound('REPORT_NOT_FOUND', 'Report not found.');
    }
    const record = await this.verificationRepository.findLatestForIncident(
      incident.duplicateOfId ?? incident.id,
    );
    const photoUrl = await this.photoService.signedUrl(incident.photoPath);
    return presentForVillager(incident, {
      photoUrl,
      outcome: record ? { rejectionReason: record.rejectionReason } : null,
    });
  }

  /** Village chosen by the reporter, or the nearest village to the GPS fix. */
  async #locationFromApp(user, input) {
    if (input.villageId) {
      return { villageId: input.villageId };
    }

    const match = await this.locationResolver.resolveByGps(input.latitude, input.longitude);
    if (match) {
      return { villageId: match.village.id, latitude: input.latitude, longitude: input.longitude };
    }

    const fallbackVillageId = user.profile.registeredVillageId;
    if (!fallbackVillageId) {
      throw badRequest('LOCATION_UNRESOLVED', 'Location unavailable. Choose your village instead.');
    }
    return {
      villageId: fallbackVillageId,
      callBackRequired: true,
    };
  }

  /** Make sure duplicate detection always has coordinates, even for village-only reports. */
  async #resolveCoordinates(location) {
    const village = await this.villageRepository.findById(location.villageId);
    if (!village) throw badRequest('VILLAGE_NOT_FOUND', 'The selected village was not found.');
    return {
      ...location,
      latitude: location.latitude ?? village.latitude,
      longitude: location.longitude ?? village.longitude,
    };
  }

  /**
   * When the event happened. Offline reports keep the time the reporter tapped
   * Send; "earlier today" is recorded as roughly three hours before that.
   */
  #occurredAt({ capturedAt, occurredWhen }) {
    const now = this.clock().getTime();
    let captured = capturedAt ? new Date(capturedAt).getTime() : now;
    if (captured > now + MAX_CLOCK_SKEW_MS || captured < now - MAX_CAPTURE_AGE_MS) captured = now;
    const offset = occurredWhen === OCCURRED_WHEN.EARLIER_TODAY ? EARLIER_TODAY_OFFSET_MS : 0;
    return new Date(Math.min(captured - offset, now));
  }

  /** Notification problems must never lose or fail a received report. */
  async #notifySafely(task) {
    try {
      await task();
    } catch (error) {
      this.logger.error('Notification failed', { message: error.message });
    }
  }
}

module.exports = { IncidentService };
