const { randomUUID } = require('node:crypto');
const {
  CommunityIncident,
  Village,
  Profile,
  Sector,
  VerificationRecord,
  Sequence,
} = require('../../models/mongo/schemas');
const { toIncident } = require('../../models/incident.model');
const { INCIDENT_STATUS, UNDECIDED_STATUSES, LIMITS } = require('../../constants/domain');
const { distanceM } = require('./village.mongo.repository');

class MongoIncidentRepository {
  async insert(values) {
    if (values.client_request_id && values.reporter_id) {
      const existing = await this.findByClientRequestId(
        values.reporter_id,
        values.client_request_id,
      );
      if (existing) return { incident: existing, created: false };
    }

    let gnDivisionId = values.gn_division_id || null;
    let sectorId = values.sector_id || null;
    if (values.village_id && (!gnDivisionId || !sectorId)) {
      const v = await Village.findOne({ id: values.village_id }).lean();
      if (v) {
        gnDivisionId = gnDivisionId || v.gn_division_id;
        sectorId = sectorId || v.sector_id;
      }
    }

    const seqDoc = await Sequence.findOneAndUpdate(
      { name: 'incident_tracking_code' },
      { $inc: { seq: 1 } },
      { upsert: true, new: true },
    );
    const trackingCode = `C-${String(seqDoc.seq).padStart(4, '0')}`;
    const id = values.id || randomUUID();

    const docData = {
      id,
      tracking_code: trackingCode,
      client_request_id: values.client_request_id || null,
      reporter_id: values.reporter_id || null,
      reporter_phone: values.reporter_phone || null,
      source: values.source || 'APP',
      incident_type: values.incident_type,
      status: values.status || INCIDENT_STATUS.PENDING,
      urgency: values.urgency || 'NORMAL',
      village_id: values.village_id || null,
      gn_division_id: gnDivisionId,
      sector_id: sectorId,
      latitude: values.latitude ?? null,
      longitude: values.longitude ?? null,
      location:
        values.longitude != null && values.latitude != null
          ? { type: 'Point', coordinates: [values.longitude, values.latitude] }
          : undefined,
      raw_location_text: values.raw_location_text || null,
      elephant_count_band: values.elephant_count_band || null,
      occurred_when: values.occurred_when || 'NOW',
      occurred_at: values.occurred_at ? new Date(values.occurred_at) : new Date(),
      captured_at: values.captured_at ? new Date(values.captured_at) : null,
      photo_path: values.photo_path || null,
      duplicate_of_id: values.duplicate_of_id || null,
      call_back_required: Boolean(values.call_back_required),
      field_action_required: Boolean(values.field_action_required),
      review_started_at: values.review_started_at ? new Date(values.review_started_at) : null,
    };

    try {
      const created = await CommunityIncident.create(docData);
      const withEmbeds = await this.#embedSingle(created.toObject());
      return { incident: toIncident(withEmbeds), created: true };
    } catch (err) {
      if (err.code === 11000 && values.client_request_id && values.reporter_id) {
        const existing = await this.findByClientRequestId(
          values.reporter_id,
          values.client_request_id,
        );
        if (existing) return { incident: existing, created: false };
      }
      throw err;
    }
  }

  async findById(id) {
    const doc = await CommunityIncident.findOne({ id }).lean();
    if (!doc) return null;
    const embedded = await this.#embedSingle(doc);
    return toIncident(embedded);
  }

  async findByIds(ids) {
    if (!ids || ids.length === 0) return [];
    const docs = await CommunityIncident.find({ id: { $in: ids } }).lean();
    const embedded = await this.#embedMany(docs);
    return embedded.map(toIncident);
  }

  async findByClientRequestId(reporterId, clientRequestId) {
    const doc = await CommunityIncident.findOne({
      reporter_id: reporterId,
      client_request_id: clientRequestId,
    }).lean();
    if (!doc) return null;
    const embedded = await this.#embedSingle(doc);
    return toIncident(embedded);
  }

  async findDuplicateId({ incidentType, latitude, longitude, occurredAt, radiusM, windowMinutes }) {
    const targetTime = new Date(occurredAt).getTime();
    const minTime = new Date(targetTime - windowMinutes * 60000);
    const maxTime = new Date(targetTime + windowMinutes * 60000);

    const candidates = await CommunityIncident.find({
      incident_type: incidentType,
      duplicate_of_id: null,
      status: { $in: UNDECIDED_STATUSES },
      occurred_at: { $gte: minTime, $lte: maxTime },
    })
      .sort({ occurred_at: 1 })
      .lean();

    for (const item of candidates) {
      if (item.latitude != null && item.longitude != null) {
        const d = distanceM(item.latitude, item.longitude, latitude, longitude);
        if (d <= radiusM) {
          return item.id;
        }
      }
    }
    return null;
  }

  async listByReporter(reporterId, { limit, offset }) {
    const docs = await CommunityIncident.find({ reporter_id: reporterId })
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(limit)
      .lean();
    const embedded = await this.#embedMany(docs);
    return embedded.map(toIncident);
  }

  async listQueueRoots(divisionIds) {
    if (!divisionIds || divisionIds.length === 0) return [];
    const docs = await CommunityIncident.find({
      duplicate_of_id: null,
      status: { $in: UNDECIDED_STATUSES },
      gn_division_id: { $in: divisionIds },
    })
      .sort({ created_at: -1 })
      .limit(LIMITS.QUEUE_MAX_ROWS)
      .lean();
    const embedded = await this.#embedMany(docs);
    return embedded.map(toIncident);
  }

  async listMapRoots(divisionIds, since) {
    if (!divisionIds || divisionIds.length === 0) return [];
    const filter = {
      duplicate_of_id: null,
      status: { $in: [...UNDECIDED_STATUSES, INCIDENT_STATUS.VERIFIED] },
      gn_division_id: { $in: divisionIds },
    };
    if (since) {
      filter.created_at = { $gte: new Date(since) };
    }
    const docs = await CommunityIncident.find(filter)
      .sort({ created_at: -1 })
      .lean();
    const embedded = await this.#embedMany(docs);
    return embedded.map(toIncident);
  }

  async listDuplicatesOf(rootIds) {
    if (!rootIds || rootIds.length === 0) return [];
    const docs = await CommunityIncident.find({ duplicate_of_id: { $in: rootIds } })
      .sort({ created_at: 1 })
      .lean();
    const embedded = await this.#embedMany(docs);
    return embedded.map(toIncident);
  }

  async countVerifiedRoots(divisionIds) {
    if (!divisionIds || divisionIds.length === 0) return 0;
    return CommunityIncident.countDocuments({
      duplicate_of_id: null,
      status: INCIDENT_STATUS.VERIFIED,
      gn_division_id: { $in: divisionIds },
    });
  }

  async startReview(incidentId, officerId) {
    const root = await this.#resolveRoot(incidentId);
    if (!root) return { ok: false, code: 'INCIDENT_NOT_FOUND' };

    const inScope = await this.#officerInScope(officerId, root.gn_division_id);
    if (!inScope) return { ok: false, code: 'OUT_OF_SCOPE' };

    const now = new Date();
    if (root.status === INCIDENT_STATUS.PENDING) {
      await CommunityIncident.updateOne(
        { id: root.id },
        { $set: { status: INCIDENT_STATUS.UNDER_REVIEW, review_started_at: root.review_started_at || now } },
      );
    }

    await CommunityIncident.updateMany(
      { duplicate_of_id: root.id, review_started_at: null },
      { $set: { review_started_at: now } },
    );

    return { ok: true, incident_id: root.id };
  }

  async reviewIncident({ incidentId, officerId, decision, method, notes, rejectionReason, fieldAction }) {
    const root = await this.#resolveRoot(incidentId);
    if (!root) return { ok: false, code: 'INCIDENT_NOT_FOUND' };

    const inScope = await this.#officerInScope(officerId, root.gn_division_id);
    if (!inScope) return { ok: false, code: 'OUT_OF_SCOPE' };

    if (!UNDECIDED_STATUSES.includes(root.status)) {
      const prev = await VerificationRecord.findOne({ incident_id: root.id })
        .sort({ verified_at: -1 })
        .lean();
      const officer = prev ? await Profile.findOne({ id: prev.officer_id }).lean() : null;
      return {
        ok: false,
        code: 'ALREADY_REVIEWED',
        status: root.status,
        reviewed_by_name: officer?.full_name ?? null,
        reviewed_at: prev?.verified_at?.toISOString() ?? null,
      };
    }

    const fieldActionRequired = decision === 'VERIFIED' && Boolean(fieldAction);
    const now = new Date();

    await VerificationRecord.create({
      id: randomUUID(),
      incident_id: root.id,
      officer_id: officerId,
      decision,
      method: method || null,
      notes: notes || null,
      rejection_reason: rejectionReason || null,
      field_action_required: fieldActionRequired,
      verified_at: now,
    });

    await CommunityIncident.updateMany(
      {
        $or: [
          { id: root.id },
          { duplicate_of_id: root.id, status: 'DUPLICATE' },
        ],
      },
      {
        $set: {
          status: decision,
          field_action_required: fieldActionRequired,
          call_back_required: false,
          updated_at: now,
        },
      },
    );

    const members = await CommunityIncident.find({
      $or: [{ id: root.id }, { duplicate_of_id: root.id }],
    })
      .select('id reporter_id')
      .lean();

    return {
      ok: true,
      incident_id: root.id,
      status: decision,
      field_action_required: fieldActionRequired,
      sector_id: root.sector_id,
      gn_division_id: root.gn_division_id,
      tracking_code: root.tracking_code,
      affected_incident_ids: members.map((m) => m.id),
      reporter_ids: [...new Set(members.map((m) => m.reporter_id).filter(Boolean))],
    };
  }

  async #resolveRoot(incidentId) {
    const row = await CommunityIncident.findOne({ id: incidentId }).lean();
    if (!row) return null;
    if (row.duplicate_of_id) {
      return CommunityIncident.findOne({ id: row.duplicate_of_id }).lean();
    }
    return row;
  }

  async #officerInScope(officerId, gnDivisionId) {
    const profile = await Profile.findOne({ id: officerId }).lean();
    return Boolean(profile?.division_ids?.includes(gnDivisionId));
  }

  async #embedSingle(doc) {
    if (!doc) return null;
    const [embedded] = await this.#embedMany([doc]);
    return embedded;
  }

  async #embedMany(docs) {
    if (!docs || docs.length === 0) return [];
    const villageIds = [...new Set(docs.map((d) => d.village_id).filter(Boolean))];
    const sectorIds = [...new Set(docs.map((d) => d.sector_id).filter(Boolean))];
    const reporterIds = [...new Set(docs.map((d) => d.reporter_id).filter(Boolean))];

    const [villages, sectors, profiles] = await Promise.all([
      villageIds.length ? Village.find({ id: { $in: villageIds } }).lean() : [],
      sectorIds.length ? Sector.find({ id: { $in: sectorIds } }).lean() : [],
      reporterIds.length ? Profile.find({ id: { $in: reporterIds } }).lean() : [],
    ]);

    const villageMap = new Map(villages.map((v) => [v.id, v]));
    const sectorMap = new Map(sectors.map((s) => [s.id, s]));
    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    return docs.map((d) => {
      const v = d.village_id ? villageMap.get(d.village_id) : null;
      const s = d.sector_id ? sectorMap.get(d.sector_id) : null;
      const p = d.reporter_id ? profileMap.get(d.reporter_id) : null;
      return {
        ...d,
        village: v
          ? {
              id: v.id,
              name_en: v.name_en,
              name_si: v.name_si,
              name_ta: v.name_ta,
              latitude: v.latitude,
              longitude: v.longitude,
            }
          : null,
        sector: s ? { id: s.id, name: s.name } : null,
        reporter: p ? { id: p.id, full_name: p.full_name, phone: p.phone } : null,
      };
    });
  }
}

module.exports = { MongoIncidentRepository };
