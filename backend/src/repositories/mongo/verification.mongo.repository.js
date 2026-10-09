const { VerificationRecord, Profile, CommunityIncident, Village } = require('../../models/mongo/schemas');
const { toVerificationRecord } = require('../../models/verification.model');

class MongoVerificationRepository {
  async findLatestForIncident(incidentId) {
    const doc = await VerificationRecord.findOne({ incident_id: incidentId })
      .sort({ verified_at: -1 })
      .lean();
    if (!doc) return null;

    const officer = doc.officer_id ? await Profile.findOne({ id: doc.officer_id }).lean() : null;
    return toVerificationRecord({
      ...doc,
      officer: officer ? { full_name: officer.full_name } : null,
    });
  }

  async listByOfficer(officerId, { decision, limit, offset }) {
    const filter = { officer_id: officerId };
    if (decision) filter.decision = decision;

    const records = await VerificationRecord.find(filter)
      .sort({ verified_at: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    if (records.length === 0) return [];

    const incidentIds = records.map((r) => r.incident_id);
    const incidents = await CommunityIncident.find({ id: { $in: incidentIds } }).lean();
    const villageIds = [...new Set(incidents.map((i) => i.village_id).filter(Boolean))];
    const villages = villageIds.length ? await Village.find({ id: { $in: villageIds } }).lean() : [];

    const villageMap = new Map(villages.map((v) => [v.id, v]));
    const incidentMap = new Map(
      incidents.map((inc) => [
        inc.id,
        {
          id: inc.id,
          tracking_code: inc.tracking_code,
          incident_type: inc.incident_type,
          village: inc.village_id ? villageMap.get(inc.village_id) : null,
        },
      ]),
    );

    return records.map((record) => {
      const inc = incidentMap.get(record.incident_id);
      return toVerificationRecord({
        ...record,
        incident: inc || null,
      });
    });
  }
}

module.exports = { MongoVerificationRepository };
