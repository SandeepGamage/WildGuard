const { unwrap } = require('./support');
const { toIncident } = require('../models/incident.model');
const { INCIDENT_STATUS, UNDECIDED_STATUSES, LIMITS } = require('../constants/domain');

const IDEMPOTENCY_CONSTRAINT = 'community_incidents_idempotency';
const SELECT =
  '*, village:villages(id, name_en, name_si, name_ta), sector:sectors(id, name), reporter:profiles(id, full_name, phone)';

/** Data access for community_incidents and the workflow RPCs. */
class IncidentRepository {
  /** @param {import('@supabase/supabase-js').SupabaseClient} db Service-role client. */
  constructor(db) {
    this.db = db;
  }

  /**
   * Insert a report. A retried submission (same reporter + client request id)
   * returns the original row instead of creating a second incident.
   * @returns {Promise<{ incident: object, created: boolean }>}
   */
  async insert(values) {
    const result = await this.db.from('community_incidents').insert(values).select(SELECT).single();
    if (result.error?.code === '23505' && result.error.message.includes(IDEMPOTENCY_CONSTRAINT)) {
      const existing = await this.findByClientRequestId(values.reporter_id, values.client_request_id);
      if (existing) return { incident: existing, created: false };
    }
    return { incident: toIncident(unwrap(result)), created: true };
  }

  async findById(id) {
    const result = await this.db.from('community_incidents').select(SELECT).eq('id', id).maybeSingle();
    return toIncident(unwrap(result));
  }

  async findByIds(ids) {
    if (ids.length === 0) return [];
    const result = await this.db.from('community_incidents').select(SELECT).in('id', ids);
    return unwrap(result).map(toIncident);
  }

  async findByClientRequestId(reporterId, clientRequestId) {
    const result = await this.db
      .from('community_incidents')
      .select(SELECT)
      .eq('reporter_id', reporterId)
      .eq('client_request_id', clientRequestId)
      .maybeSingle();
    return toIncident(unwrap(result));
  }

  /** @returns {Promise<string|null>} Id of the root incident this report duplicates. */
  async findDuplicateId({ incidentType, latitude, longitude, occurredAt, radiusM, windowMinutes }) {
    const result = await this.db.rpc('find_duplicate_incident', {
      p_incident_type: incidentType,
      p_latitude: latitude,
      p_longitude: longitude,
      p_occurred_at: occurredAt,
      p_radius_m: radiusM,
      p_window_minutes: windowMinutes,
    });
    return unwrap(result) ?? null;
  }

  async listByReporter(reporterId, { limit, offset }) {
    const result = await this.db
      .from('community_incidents')
      .select(SELECT)
      .eq('reporter_id', reporterId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    return unwrap(result).map(toIncident);
  }

  /** Undecided root reports (duplicates are folded into their root). */
  async listQueueRoots(divisionIds) {
    if (divisionIds.length === 0) return [];
    const result = await this.db
      .from('community_incidents')
      .select(SELECT)
      .is('duplicate_of_id', null)
      .in('status', UNDECIDED_STATUSES)
      .in('gn_division_id', divisionIds)
      .order('created_at', { ascending: false })
      .limit(LIMITS.QUEUE_MAX_ROWS);
    return unwrap(result).map(toIncident);
  }

  /** Root reports for the live map: everything except rejected/duplicate rows. */
  async listMapRoots(divisionIds, since) {
    if (divisionIds.length === 0) return [];
    const result = await this.db
      .from('community_incidents')
      .select(SELECT)
      .is('duplicate_of_id', null)
      .in('status', [...UNDECIDED_STATUSES, INCIDENT_STATUS.VERIFIED])
      .in('gn_division_id', divisionIds)
      .gte('created_at', since)
      .order('created_at', { ascending: false });
    return unwrap(result).map(toIncident);
  }

  async listDuplicatesOf(rootIds) {
    if (rootIds.length === 0) return [];
    const result = await this.db
      .from('community_incidents')
      .select(SELECT)
      .in('duplicate_of_id', rootIds)
      .order('created_at', { ascending: true });
    return unwrap(result).map(toIncident);
  }

  async countVerifiedRoots(divisionIds) {
    if (divisionIds.length === 0) return 0;
    const result = await this.db
      .from('community_incidents')
      .select('id', { count: 'exact', head: true })
      .is('duplicate_of_id', null)
      .eq('status', INCIDENT_STATUS.VERIFIED)
      .in('gn_division_id', divisionIds);
    unwrap(result);
    return result.count ?? 0;
  }

  /** Atomic decision; see supabase/migrations/*_functions.sql (review_incident). */
  async reviewIncident({ incidentId, officerId, decision, method, notes, rejectionReason, fieldAction }) {
    const result = await this.db.rpc('review_incident', {
      p_incident_id: incidentId,
      p_officer_id: officerId,
      p_decision: decision,
      p_method: method ?? null,
      p_notes: notes ?? null,
      p_rejection_reason: rejectionReason ?? null,
      p_field_action: fieldAction,
    });
    return unwrap(result);
  }

  async startReview(incidentId, officerId) {
    const result = await this.db.rpc('start_incident_review', {
      p_incident_id: incidentId,
      p_officer_id: officerId,
    });
    return unwrap(result);
  }
}

module.exports = { IncidentRepository };
