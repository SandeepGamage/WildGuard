/**
 * Village name in the active language, falling back to English when the
 * Sinhala/Tamil name has not been provided.
 * @param {{ nameEn: string, nameSi?: string|null, nameTa?: string|null }|null|undefined} village
 * @param {'en'|'si'|'ta'} language
 */
export function villageName(village, language) {
  if (!village) return '';
  if (language === 'si' && village.nameSi) return village.nameSi;
  if (language === 'ta' && village.nameTa) return village.nameTa;
  return village.nameEn;
}
