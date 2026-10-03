const { unwrap } = require('./support');
const { toProfile } = require('../models/profile.model');
const { USER_ROLES } = require('../constants/domain');

/** Data access for profiles and officer division assignments. */
class ProfileRepository {
  constructor(db) {
    this.db = db;
  }

  async findById(id) {
    const result = await this.db
      .from('profiles')
      .select('*, officer_gn_divisions(gn_division_id, gn_divisions(name))')
      .eq('id', id)
      .maybeSingle();
    const row = unwrap(result);
    return this.#toDomain(row);
  }

  async findByPhone(phone) {
    const result = await this.db
      .from('profiles')
      .select('*, officer_gn_divisions(gn_division_id, gn_divisions(name))')
      .eq('phone', phone)
      .maybeSingle();
    return this.#toDomain(unwrap(result));
  }

  async create({ id, fullName, phone, language, registeredVillageId }) {
    const result = await this.db
      .from('profiles')
      .insert({
        id,
        full_name: fullName,
        phone,
        language,
        registered_village_id: registeredVillageId,
        role: USER_ROLES.VILLAGER,
      })
      .select('*')
      .single();
    return toProfile(unwrap(result));
  }

  async listOfficersByDivision(gnDivisionId) {
    const result = await this.db
      .from('officer_gn_divisions')
      .select('officer_id, profiles!inner(is_active, role)')
      .eq('gn_division_id', gnDivisionId)
      .eq('profiles.is_active', true)
      .eq('profiles.role', USER_ROLES.COMMUNITY_LIAISON_OFFICER);
    return unwrap(result).map((row) => row.officer_id);
  }

  async listRangersBySector(sectorId) {
    const result = await this.db
      .from('profiles')
      .select('id')
      .eq('role', USER_ROLES.FIELD_RANGER)
      .eq('sector_id', sectorId)
      .eq('is_active', true);
    return unwrap(result).map((row) => row.id);
  }

  #toDomain(row) {
    if (!row) return null;
    const divisions = (row.officer_gn_divisions ?? []).map((item) => ({
      id: item.gn_division_id,
      name: item.gn_divisions?.name,
    }));
    return toProfile(row, divisions);
  }
}

module.exports = { ProfileRepository };
