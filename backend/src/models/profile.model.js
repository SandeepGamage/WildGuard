/**
 * Map a profiles row (+ officer division assignments) to the domain shape.
 * @param {object} row profiles row.
 * @param {Array<{ id: string, name?: string }>} [divisions] Assigned GN divisions.
 */
function toProfile(row, divisions = []) {
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    role: row.role,
    language: row.language,
    registeredVillageId: row.registered_village_id,
    sectorId: row.sector_id,
    isActive: row.is_active,
    divisions,
    divisionIds: divisions.map((division) => division.id),
  };
}

/** Public profile shape returned by /auth/me. */
function presentProfile(profile) {
  return {
    id: profile.id,
    fullName: profile.fullName,
    phone: profile.phone,
    role: profile.role,
    language: profile.language,
    registeredVillageId: profile.registeredVillageId,
    divisions: profile.divisions ?? [],
    divisionIds: profile.divisionIds,
  };
}

module.exports = { toProfile, presentProfile };
