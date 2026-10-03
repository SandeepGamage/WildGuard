const { presentVillage } = require('../models/village.model');

/** Read access to the village gazetteer used by the village picker. */
class VillageService {
  /** @param {{ villageRepository: object }} deps */
  constructor({ villageRepository }) {
    this.villageRepository = villageRepository;
  }

  async list() {
    const villages = await this.villageRepository.listActive();
    return villages.map(presentVillage);
  }
}

module.exports = { VillageService };
