/** Map a villages row (full or embedded subset) to the domain shape. */
function toVillage(row) {
  if (!row) return null;
  return {
    id: row.id,
    nameEn: row.name_en,
    nameSi: row.name_si ?? null,
    nameTa: row.name_ta ?? null,
    aliases: row.aliases ?? [],
    gnDivisionId: row.gn_division_id ?? null,
    sectorId: row.sector_id ?? null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
  };
}

/** Public village shape returned by the API. */
function presentVillage(village) {
  if (!village) return null;
  return {
    id: village.id,
    nameEn: village.nameEn,
    nameSi: village.nameSi,
    nameTa: village.nameTa,
    latitude: village.latitude,
    longitude: village.longitude,
  };
}

module.exports = { toVillage, presentVillage };
