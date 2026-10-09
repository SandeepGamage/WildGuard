const { normalizeText, editDistance } = require('../utils/text');
const { LIMITS } = require('../constants/domain');

const MIN_FUZZY_LENGTH = 6;

/** Resolves free-text place names (SMS) and GPS fixes (app) to gazetteer villages. */
class LocationResolver {
  /** @param {{ villageRepository: object }} deps */
  constructor({ villageRepository }) {
    this.villageRepository = villageRepository;
  }

  /**
   * Match a place name against English/Sinhala/Tamil names and aliases.
   * Exact matches win; otherwise a single one-character typo is tolerated.
   * @param {string} text
   * @returns {Promise<object|null>} Village or null when the place is not recognised.
   */
  async resolveByName(text) {
    const wanted = normalizeText(text);
    if (!wanted) return null;

    const villages = await this.villageRepository.listActive();
    const namesOf = (village) =>
      [village.nameEn, village.nameSi, village.nameTa, ...village.aliases].filter(Boolean).map(normalizeText);

    const exact = villages.find((village) => namesOf(village).includes(wanted));
    if (exact) return exact;
    if (wanted.length < MIN_FUZZY_LENGTH) return null;

    const near = villages.filter((village) =>
      namesOf(village).some((name) => name.length >= MIN_FUZZY_LENGTH && editDistance(name, wanted) <= 1),
    );
    return near.length === 1 ? near[0] : null;
  }

  /**
   * @returns {Promise<{ village: object, distanceM: number }|null>} Nearest village to the GPS fix.
   */
  async resolveByGps(latitude, longitude) {
    const nearest = await this.villageRepository.findNearest(
      latitude,
      longitude,
      LIMITS.NEAREST_VILLAGE_MAX_M,
    );
    if (!nearest) return null;
    const village = await this.villageRepository.findById(nearest.id);
    return village ? { village, distanceM: nearest.distanceM } : null;
  }
}

module.exports = { LocationResolver };
