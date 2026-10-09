const {
  INCIDENT_SOURCE,
  INCIDENT_STATUS,
  LANGUAGES,
  OCCURRED_WHEN,
  SMS_DIRECTION,
  SMS_LOG_STATUS,
} = require('../../constants/domain');
const { AppError, badRequest } = require('../../errors/AppError');
const { normalizePhone } = require('../../utils/phone');

/**
 * Orchestrates the SMS channel (UC3a): parse -> resolve place -> duplicate check
 * and save (IncidentService) -> reply. The gateway is simulated; a real gateway
 * would call `handleInbound` from its webhook.
 */
class SmsService {
  /**
   * @param {object} deps
   * @param {object} deps.messageParser
   * @param {object} deps.locationResolver
   * @param {object} deps.incidentService
   * @param {object} deps.smsResponseService
   * @param {object} deps.smsLogRepository
   * @param {object} deps.profileRepository
   * @param {object} deps.villageRepository
   * @param {object} deps.pendingQueue
   * @param {object} deps.logger
   */
  constructor(deps) {
    Object.assign(this, deps);
  }

  /**
   * Process one inbound SMS and return the reply that would be texted back.
   * @param {{ phone: string, message: string }} sms
   */
  async handleInbound({ phone, message }) {
    const senderPhone = normalizePhone(phone);
    if (!senderPhone) throw badRequest('INVALID_PHONE', 'Enter a valid mobile number.');

    const sender = await this.profileRepository.findByPhone(senderPhone);
    const parsed = this.messageParser.parse(message);

    if (!parsed.ok) {
      return this.#reject({ senderPhone, message, reply: this.smsResponseService.formatHelp() });
    }

    const resolved = await this.#resolvePlace(parsed.locationText, sender);
    if (!resolved) {
      return this.#reject({
        senderPhone,
        message,
        reply: this.smsResponseService.unknownPlace(),
        parsed,
      });
    }

    const language = sender?.language ?? parsed.replyLanguage ?? LANGUAGES.EN;
    const command = {
      source: INCIDENT_SOURCE.SMS,
      reporterId: sender?.id ?? null,
      reporterPhone: senderPhone,
      incidentType: parsed.incidentType,
      occurredWhen: OCCURRED_WHEN.NOW,
      location: {
        villageId: resolved.village.id,
        rawLocationText: parsed.locationText || null,
        callBackRequired: resolved.callBackRequired,
      },
    };

    const saved = await this.#save(command);
    const reply = this.smsResponseService.acknowledgement({
      language,
      trackingCode: saved?.incident.trackingCode ?? null,
      incidentType: parsed.incidentType,
      callBackRequired: resolved.callBackRequired,
    });

    await this.#log({
      direction: SMS_DIRECTION.INBOUND,
      phone: senderPhone,
      message,
      parsed,
      saved,
      status: SMS_LOG_STATUS.ACCEPTED,
    });
    await this.#log({
      direction: SMS_DIRECTION.OUTBOUND,
      phone: senderPhone,
      message: reply,
      saved,
      status: SMS_LOG_STATUS.ACCEPTED,
    });

    return {
      accepted: true,
      reply,
      trackingCode: saved?.incident.trackingCode ?? null,
      queued: saved === null,
      callBackRequired: resolved.callBackRequired,
      duplicate: saved?.incident.status === INCIDENT_STATUS.DUPLICATE,
      incidentId: saved?.incident.id ?? null,
    };
  }

  /**
   * Place from the message; otherwise the sender's registered village with a
   * call-back flag (UC3.1 A2). Returns null when neither is available.
   */
  async #resolvePlace(locationText, sender) {
    const village = await this.locationResolver.resolveByName(locationText);
    if (village) return { village, callBackRequired: false };

    if (!sender?.registeredVillageId) return null;
    const registered = await this.villageRepository.findById(sender.registeredVillageId);
    return registered ? { village: registered, callBackRequired: true } : null;
  }

  /**
   * Save the report; if the database is down, queue it and still acknowledge (UC3.1 E2).
   * @returns {Promise<{ incident: object }|null>} null when the report was queued.
   */
  async #save(command) {
    try {
      return await this.incidentService.submit(command);
    } catch (error) {
      if (error instanceof AppError) throw error;
      this.logger.warn('SMS report could not be saved; queued for retry', { message: error.message });
      this.pendingQueue.enqueue(command);
      return null;
    }
  }

  async #reject({ senderPhone, message, reply, parsed }) {
    await this.#log({
      direction: SMS_DIRECTION.INBOUND,
      phone: senderPhone,
      message,
      parsed,
      status: SMS_LOG_STATUS.REJECTED_FORMAT,
    });
    await this.#log({
      direction: SMS_DIRECTION.OUTBOUND,
      phone: senderPhone,
      message: reply,
      status: SMS_LOG_STATUS.ACCEPTED,
    });
    return {
      accepted: false,
      reply,
      trackingCode: null,
      queued: false,
      callBackRequired: false,
      duplicate: false,
    };
  }

  /** Logging problems must never change the reply the sender receives. */
  async #log({ direction, phone, message, parsed, saved, status }) {
    try {
      await this.smsLogRepository.create({
        direction,
        phone,
        message,
        parsedType: parsed?.incidentType,
        parsedLocation: parsed?.locationText,
        incidentId: saved?.incident.id,
        status,
      });
    } catch (error) {
      this.logger.error('SMS log write failed', { message: error.message });
    }
  }
}

module.exports = { SmsService };
