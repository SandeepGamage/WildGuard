const { INCIDENT_TYPES, LANGUAGES } = require('./domain');

/**
 * SMS keyword dictionary. The first word of a message selects the incident
 * type; the reply language follows the language of the keyword.
 *
 * Only words that are certain are listed. Sinhala and Tamil keywords for the
 * other incident types should be added here after review by native speakers.
 */
const SMS_KEYWORDS = Object.freeze([
  { keyword: 'ELEPHANT', language: LANGUAGES.EN, incidentType: INCIDENT_TYPES.ELEPHANT_NEAR_VILLAGE },
  { keyword: 'ALIYA', language: LANGUAGES.SI, incidentType: INCIDENT_TYPES.ELEPHANT_NEAR_VILLAGE },
  { keyword: 'අලියා', language: LANGUAGES.SI, incidentType: INCIDENT_TYPES.ELEPHANT_NEAR_VILLAGE },
  { keyword: 'අලි', language: LANGUAGES.SI, incidentType: INCIDENT_TYPES.ELEPHANT_NEAR_VILLAGE },
  { keyword: 'YANAI', language: LANGUAGES.TA, incidentType: INCIDENT_TYPES.ELEPHANT_NEAR_VILLAGE },
  { keyword: 'யானை', language: LANGUAGES.TA, incidentType: INCIDENT_TYPES.ELEPHANT_NEAR_VILLAGE },
  { keyword: 'CROP', language: LANGUAGES.EN, incidentType: INCIDENT_TYPES.CROP_DAMAGE },
  { keyword: 'HOUSE', language: LANGUAGES.EN, incidentType: INCIDENT_TYPES.PROPERTY_DAMAGE },
  { keyword: 'INJURED', language: LANGUAGES.EN, incidentType: INCIDENT_TYPES.PERSON_INJURED },
  { keyword: 'SNARE', language: LANGUAGES.EN, incidentType: INCIDENT_TYPES.SNARE_POACHING },
  { keyword: 'ANIMAL', language: LANGUAGES.EN, incidentType: INCIDENT_TYPES.OTHER_ANIMAL },
]);

module.exports = { SMS_KEYWORDS };
