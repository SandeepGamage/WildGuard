const { Profile, GnDivision } = require('../../models/mongo/schemas');
const { toProfile } = require('../../models/profile.model');
const { USER_ROLES } = require('../../constants/domain');

class MongoProfileRepository {
  async findById(id) {
    const doc = await Profile.findOne({ id }).lean();
    if (!doc) return null;
    return this.#toDomain(doc);
  }

  async findByPhone(phone) {
    const doc = await Profile.findOne({ phone }).lean();
    if (!doc) return null;
    return this.#toDomain(doc);
  }

  async create({ id, fullName, phone, language, registeredVillageId }) {
    const doc = await Profile.create({
      id,
      full_name: fullName,
      phone,
      language: language || 'en',
      registered_village_id: registeredVillageId,
      role: USER_ROLES.VILLAGER,
      is_active: true,
      division_ids: [],
    });
    return toProfile(doc.toObject());
  }

  async listOfficersByDivision(gnDivisionId) {
    const docs = await Profile.find({
      role: USER_ROLES.COMMUNITY_LIAISON_OFFICER,
      is_active: true,
      division_ids: gnDivisionId,
    })
      .select('id')
      .lean();
    return docs.map((d) => d.id);
  }

  async listRangersBySector(sectorId) {
    const docs = await Profile.find({
      role: USER_ROLES.FIELD_RANGER,
      sector_id: sectorId,
      is_active: true,
    })
      .select('id')
      .lean();
    return docs.map((d) => d.id);
  }

  async #toDomain(doc) {
    if (!doc) return null;
    let divisions = [];
    if (doc.division_ids && doc.division_ids.length > 0) {
      const gnDocs = await GnDivision.find({ id: { $in: doc.division_ids } }).lean();
      divisions = doc.division_ids.map((divId) => {
        const found = gnDocs.find((g) => g.id === divId);
        return {
          id: divId,
          name: found ? found.name : undefined,
        };
      });
    }
    return toProfile(doc, divisions);
  }
}

module.exports = { MongoProfileRepository };
