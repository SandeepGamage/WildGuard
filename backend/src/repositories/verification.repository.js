const { unwrap } = require('./support');
const { toVerificationRecord } = require('../models/verification.model');

/** Data access for the verification audit trail. */
class VerificationRepository {
  constructor(db) {
    this.db = db;
  }

  async findLatestForIncident(incidentId) {
    const result = await this.db
      .from('verification_records')
      .select('*, officer:profiles(full_name)')
      .eq('incident_id', incidentId)
      .order('verified_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return toVerificationRecord(unwrap(result));
  }

  async listByOfficer(officerId, { decision, limit, offset }) {
    let query = this.db
      .from('verification_records')
      .select(
        '*, incident:community_incidents(id, tracking_code, incident_type, village:villages(id, name_en, name_si, name_ta))',
      )
      .eq('officer_id', officerId)
      .order('verified_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (decision) query = query.eq('decision', decision);
    return unwrap(await query).map(toVerificationRecord);
  }
}

module.exports = { VerificationRepository };
