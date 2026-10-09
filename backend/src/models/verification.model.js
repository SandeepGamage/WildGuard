const { toVillage, presentVillage } = require('./village.model');

/** Map a verification_records row (with optional officer/incident embeds). */
function toVerificationRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    incidentId: row.incident_id,
    officerId: row.officer_id,
    officerName: row.officer?.full_name ?? null,
    decision: row.decision,
    method: row.method,
    notes: row.notes,
    rejectionReason: row.rejection_reason,
    fieldActionRequired: row.field_action_required,
    verifiedAt: row.verified_at,
    incident: row.incident
      ? {
          id: row.incident.id,
          trackingCode: row.incident.tracking_code,
          incidentType: row.incident.incident_type,
          village: toVillage(row.incident.village),
        }
      : null,
  };
}

/** Officer-facing record (includes notes; never sent to villagers). */
function presentVerification(record) {
  if (!record) return null;
  return {
    decision: record.decision,
    method: record.method,
    notes: record.notes,
    rejectionReason: record.rejectionReason,
    fieldActionRequired: record.fieldActionRequired,
    verifiedAt: record.verifiedAt,
    officerName: record.officerName,
  };
}

/** One row of the officer's decision history. */
function presentHistoryItem(record) {
  return {
    incidentId: record.incidentId,
    trackingCode: record.incident?.trackingCode ?? null,
    incidentType: record.incident?.incidentType ?? null,
    village: presentVillage(record.incident?.village),
    decision: record.decision,
    fieldActionRequired: record.fieldActionRequired,
    verifiedAt: record.verifiedAt,
  };
}

module.exports = { toVerificationRecord, presentVerification, presentHistoryItem };
