const { INCIDENT_SOURCE, LIMITS, URGENCY, VERIFICATION_DECISIONS } = require('../constants/domain');
const { conflict, forbidden, notFound } = require('../errors/AppError');
const {
  markerState,
  presentMapMarker,
  presentOfficerDetail,
  presentQueueItem,
} = require('../models/incident.model');
const { presentHistoryItem, presentVerification } = require('../models/verification.model');
const { DAY_MS } = require('../utils/time');

const countDuplicates = (duplicates) => {
  const counts = new Map();
  duplicates.forEach((item) => counts.set(item.duplicateOfId, (counts.get(item.duplicateOfId) ?? 0) + 1));
  return counts;
};

/** Everything a Community Liaison Officer can do, always limited to their GN divisions. */
class OfficerService {
  /**
   * @param {object} deps
   * @param {object} deps.incidentRepository
   * @param {object} deps.verificationRepository
   * @param {object} deps.collarRepository
   * @param {object} deps.notificationService
   * @param {object} deps.smsResponseService
   * @param {object} deps.photoService
   * @param {object} deps.logger
   * @param {() => Date} [deps.clock]
   */
  constructor(deps) {
    Object.assign(this, deps);
    this.clock = deps.clock ?? (() => new Date());
  }

  /** Pending reports: urgent first, duplicates folded into their original. */
  async getQueue(officer) {
    const divisionIds = officer.profile.divisionIds;
    const roots = await this.incidentRepository.listQueueRoots(divisionIds);
    const duplicates = await this.incidentRepository.listDuplicatesOf(roots.map((root) => root.id));
    const counts = countDuplicates(duplicates);

    const items = roots
      .map((root) => presentQueueItem(root, counts.get(root.id) ?? 0))
      .sort(
        (a, b) =>
          Number(b.urgency === URGENCY.URGENT) - Number(a.urgency === URGENCY.URGENT) ||
          new Date(b.createdAt) - new Date(a.createdAt),
      );
    const verified = await this.incidentRepository.countVerifiedRoots(divisionIds);

    return {
      items,
      counts: {
        pending: items.length,
        urgent: items.filter((item) => item.urgency === URGENCY.URGENT).length,
        verified,
      },
    };
  }

  /** Full detail of a report (its original, if the id is a duplicate). */
  async getIncident(officer, id) {
    const root = await this.#loadRootInScope(officer, id);
    const [duplicates, collars, verification, photoUrl] = await Promise.all([
      this.incidentRepository.listDuplicatesOf([root.id]),
      this.collarRepository.findNearby(root.latitude, root.longitude, LIMITS.NEARBY_COLLAR_RADIUS_M),
      this.verificationRepository.findLatestForIncident(root.id),
      this.photoService.signedUrl(root.photoPath),
    ]);
    return presentOfficerDetail(root, {
      duplicates,
      collars,
      verification: presentVerification(verification),
      photoUrl,
    });
  }

  /** Marks the report group as "being checked" so reporters see progress. */
  async startReview(officer, id) {
    await this.#loadRootInScope(officer, id);
    const result = await this.incidentRepository.startReview(id, officer.id);
    if (!result.ok) throw this.#toError(result);
    return { incidentId: result.incident_id };
  }

  verify(officer, id, { method, notes, fieldActionRequired }) {
    return this.#decide(officer, id, {
      decision: VERIFICATION_DECISIONS.VERIFIED,
      method,
      notes,
      fieldAction: fieldActionRequired,
    });
  }

  reject(officer, id, { reason, notes }) {
    return this.#decide(officer, id, {
      decision: VERIFICATION_DECISIONS.REJECTED,
      notes,
      rejectionReason: reason,
      fieldAction: false,
    });
  }

  /** Live map: active reports only (rejected ones stay in history). */
  async getMap(officer) {
    const since = new Date(this.clock().getTime() - LIMITS.MAP_WINDOW_DAYS * DAY_MS).toISOString();
    const roots = await this.incidentRepository.listMapRoots(officer.profile.divisionIds, since);
    const duplicates = await this.incidentRepository.listDuplicatesOf(roots.map((root) => root.id));
    const counts = countDuplicates(duplicates);
    return roots.map((root) => presentMapMarker(root, counts.get(root.id) ?? 0));
  }

  async getHistory(officer, query) {
    const records = await this.verificationRepository.listByOfficer(officer.id, query);
    return records.map(presentHistoryItem);
  }

  async #decide(officer, id, params) {
    const result = await this.incidentRepository.reviewIncident({
      incidentId: id,
      officerId: officer.id,
      ...params,
    });
    if (!result.ok) throw this.#toError(result);

    const affected = await this.incidentRepository.findByIds(result.affected_incident_ids);
    const root = affected.find((incident) => incident.id === result.incident_id);

    await this.#safely('reporter outcome', () => this.#informReporters(affected, params.decision));
    const fieldTeamNotified = result.field_action_required
      ? await this.#safely('field team', () => this.notificationService.notifyFieldTeam(root))
      : false;

    return {
      incidentId: result.incident_id,
      status: result.status,
      fieldActionRequired: result.field_action_required,
      markerState: markerState({ status: result.status, fieldActionRequired: result.field_action_required }),
      reportsUpdated: affected.length,
      fieldTeamNotified,
    };
  }

  /** In-app outcome for registered reporters; simulated outcome SMS for SMS reporters. */
  async #informReporters(incidents, decision) {
    await this.notificationService.notifyReporterOutcome(incidents, decision);
    const smsReporters = incidents.filter((incident) => incident.source === INCIDENT_SOURCE.SMS);
    await Promise.all(
      smsReporters.map((incident) => this.smsResponseService.sendOutcome(incident, decision)),
    );
  }

  async #loadRootInScope(officer, id) {
    let incident = await this.incidentRepository.findById(id);
    if (incident?.duplicateOfId) incident = await this.incidentRepository.findById(incident.duplicateOfId);
    if (!incident) throw notFound('INCIDENT_NOT_FOUND', 'Report not found.');
    if (!officer.profile.divisionIds.includes(incident.gnDivisionId)) {
      throw forbidden('OUT_OF_SCOPE', 'This report is outside your assigned divisions.');
    }
    return incident;
  }

  #toError(result) {
    switch (result.code) {
      case 'ALREADY_REVIEWED':
        return conflict('INCIDENT_ALREADY_REVIEWED', 'This report has already been reviewed.', {
          status: result.status,
          reviewedByName: result.reviewed_by_name ?? null,
          reviewedAt: result.reviewed_at ?? null,
        });
      case 'OUT_OF_SCOPE':
        return forbidden('OUT_OF_SCOPE', 'This report is outside your assigned divisions.');
      default:
        return notFound('INCIDENT_NOT_FOUND', 'Report not found.');
    }
  }

  /** Follow-up notifications must not undo a decision that is already saved. */
  async #safely(label, task) {
    try {
      await task();
      return true;
    } catch (error) {
      this.logger.error(`Notification failed: ${label}`, { message: error.message });
      return false;
    }
  }
}

module.exports = { OfficerService };
