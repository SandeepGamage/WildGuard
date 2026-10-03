const { toVillage, presentVillage } = require('./village.model');
const { INCIDENT_STATUS, REPORT_PROGRESS, MAP_MARKER_STATES } = require('../constants/domain');
const { maskPhone } = require('../utils/phone');

/** Map a community_incidents row (with optional village/reporter embeds) to the domain shape. */
function toIncident(row) {
  if (!row) return null;
  return {
    id: row.id,
    trackingCode: row.tracking_code,
    clientRequestId: row.client_request_id,
    reporterId: row.reporter_id,
    reporterPhone: row.reporter_phone,
    source: row.source,
    incidentType: row.incident_type,
    status: row.status,
    urgency: row.urgency,
    villageId: row.village_id,
    village: toVillage(row.village),
    gnDivisionId: row.gn_division_id,
    sectorId: row.sector_id,
    latitude: row.latitude,
    longitude: row.longitude,
    rawLocationText: row.raw_location_text,
    elephantCountBand: row.elephant_count_band,
    occurredWhen: row.occurred_when,
    occurredAt: row.occurred_at,
    photoPath: row.photo_path,
    duplicateOfId: row.duplicate_of_id,
    callBackRequired: row.call_back_required,
    fieldActionRequired: row.field_action_required,
    reviewStartedAt: row.review_started_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sector: row.sector ? { id: row.sector.id, name: row.sector.name } : null,
    reporter: row.reporter
      ? { id: row.reporter.id, fullName: row.reporter.full_name, phone: row.reporter.phone }
      : null,
  };
}

/** Internal status -> what the villager sees: Received / Being checked / Outcome. */
function reportProgress(incident) {
  if (incident.status === INCIDENT_STATUS.VERIFIED || incident.status === INCIDENT_STATUS.REJECTED) {
    return REPORT_PROGRESS.OUTCOME;
  }
  if (incident.status === INCIDENT_STATUS.UNDER_REVIEW || incident.reviewStartedAt) {
    return REPORT_PROGRESS.BEING_CHECKED;
  }
  return REPORT_PROGRESS.RECEIVED;
}

/** Marker colour state for the officer live map. Rejected incidents are never shown. */
function markerState(incident) {
  if (incident.status === INCIDENT_STATUS.VERIFIED) {
    return incident.fieldActionRequired ? MAP_MARKER_STATES.ACTION_NEEDED : MAP_MARKER_STATES.VERIFIED;
  }
  return MAP_MARKER_STATES.UNVERIFIED;
}

const base = (incident) => ({
  id: incident.id,
  trackingCode: incident.trackingCode,
  incidentType: incident.incidentType,
  urgency: incident.urgency,
  village: presentVillage(incident.village),
  occurredAt: incident.occurredAt,
  createdAt: incident.createdAt,
});

/**
 * Villager-facing view. Internal statuses, officer identity and notes are never exposed.
 * @param {object} incident Domain incident.
 * @param {{ photoUrl?: string|null, outcome?: object|null }} [extras]
 */
function presentForVillager(incident, { photoUrl = null, outcome = null } = {}) {
  const progress = reportProgress(incident);
  const decided = progress === REPORT_PROGRESS.OUTCOME;
  return {
    ...base(incident),
    source: incident.source,
    elephantCountBand: incident.elephantCountBand,
    progress,
    outcome: decided
      ? {
          decision: incident.status,
          fieldActionRequired: incident.status === INCIDENT_STATUS.VERIFIED && incident.fieldActionRequired,
          rejectionReason: outcome?.rejectionReason ?? null,
        }
      : null,
    photoUrl,
  };
}

/** Officer queue row for a root incident and its grouped duplicates. */
function presentQueueItem(incident, duplicateCount) {
  return {
    ...base(incident),
    status: incident.status,
    groupedCount: duplicateCount + 1,
    callBackRequired: incident.callBackRequired,
  };
}

/** Marker for the officer map. Contains no reporter details. */
function presentMapMarker(incident, duplicateCount) {
  return {
    ...base(incident),
    status: incident.status,
    markerState: markerState(incident),
    latitude: incident.latitude,
    longitude: incident.longitude,
    groupedCount: duplicateCount + 1,
    fieldActionRequired: incident.fieldActionRequired,
    verifiedAt: incident.status === INCIDENT_STATUS.VERIFIED ? incident.updatedAt : null,
  };
}

function presentReporter(incident) {
  const phone = incident.reporter?.phone ?? incident.reporterPhone ?? null;
  return {
    name: incident.reporter?.fullName ?? null,
    phone,
    phoneMasked: maskPhone(phone),
  };
}

/** Full officer detail for an in-scope incident. */
function presentOfficerDetail(incident, { duplicates, collars, verification, photoUrl }) {
  return {
    ...base(incident),
    status: incident.status,
    source: incident.source,
    latitude: incident.latitude,
    longitude: incident.longitude,
    elephantCountBand: incident.elephantCountBand,
    callBackRequired: incident.callBackRequired,
    fieldActionRequired: incident.fieldActionRequired,
    rawLocationText: incident.rawLocationText,
    sectorName: incident.sector?.name ?? null,
    groupedCount: duplicates.length + 1,
    reporter: presentReporter(incident),
    related: duplicates.map((item) => ({
      id: item.id,
      trackingCode: item.trackingCode,
      createdAt: item.createdAt,
      reporterName: item.reporter?.fullName ?? null,
    })),
    nearbyCollars: collars,
    verification,
    photoUrl,
  };
}

module.exports = {
  toIncident,
  reportProgress,
  markerState,
  presentForVillager,
  presentQueueItem,
  presentMapMarker,
  presentOfficerDetail,
};
