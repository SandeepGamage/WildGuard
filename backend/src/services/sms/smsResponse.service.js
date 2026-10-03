const { SMS_MESSAGES } = require('../../constants/smsMessages');
const {
  INCIDENT_STATUS,
  INCIDENT_TYPES,
  LANGUAGES,
  SMS_DIRECTION,
  SMS_LOG_STATUS,
} = require('../../constants/domain');

const fill = (template, values) =>
  Object.entries(values).reduce((text, [key, value]) => text.replace(`{${key}}`, value), template);

const pick = (templates, language) => templates[language] ?? templates[LANGUAGES.EN];

function adviceFor(incidentType, language) {
  if (incidentType === INCIDENT_TYPES.ELEPHANT_NEAR_VILLAGE)
    return pick(SMS_MESSAGES.adviceElephant, language);
  if (incidentType === INCIDENT_TYPES.PERSON_INJURED) return pick(SMS_MESSAGES.adviceInjured, language);
  return pick(SMS_MESSAGES.adviceGeneral, language);
}

/** Builds every outbound SMS text and records outbound messages in the SMS log. */
class SmsResponseService {
  /** @param {{ smsLogRepository: object }} deps */
  constructor({ smsLogRepository }) {
    this.smsLogRepository = smsLogRepository;
  }

  /** "Report C-0142 received. An officer will check it. Stay away from the elephant." */
  acknowledgement({ language, trackingCode, incidentType, callBackRequired }) {
    const advice = adviceFor(incidentType, language);
    const template = trackingCode ? SMS_MESSAGES.acknowledgement : SMS_MESSAGES.acknowledgementQueued;
    const text = fill(pick(template, language), { code: trackingCode ?? '', advice });
    return callBackRequired ? `${text} ${pick(SMS_MESSAGES.callBackNote, language)}` : text;
  }

  /** Format + example in English, Sinhala and Tamil. */
  formatHelp() {
    return SMS_MESSAGES.formatHelp.join('\n');
  }

  unknownPlace() {
    return SMS_MESSAGES.unknownPlace.join('\n');
  }

  outcome({ language, trackingCode, decision }) {
    const template =
      decision === INCIDENT_STATUS.VERIFIED ? SMS_MESSAGES.outcomeVerified : SMS_MESSAGES.outcomeRejected;
    return fill(pick(template, language), { code: trackingCode });
  }

  /** Simulated outcome SMS to a reporter who used the SMS channel (UC3.2 step 8). */
  async sendOutcome(incident, decision) {
    const message = this.outcome({
      language: LANGUAGES.EN,
      trackingCode: incident.trackingCode,
      decision,
    });
    await this.smsLogRepository.create({
      direction: SMS_DIRECTION.OUTBOUND,
      phone: incident.reporterPhone,
      message,
      incidentId: incident.id,
      status: SMS_LOG_STATUS.ACCEPTED,
    });
    return message;
  }
}

module.exports = { SmsResponseService };
