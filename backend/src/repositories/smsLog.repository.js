const { unwrap } = require('./support');

/** Data access for the simulated SMS gateway log. */
class SmsLogRepository {
  constructor(db) {
    this.db = db;
  }

  async create({ direction, phone, message, parsedType, parsedLocation, incidentId, status }) {
    const result = await this.db.from('sms_logs').insert({
      direction,
      phone,
      message,
      parsed_type: parsedType ?? null,
      parsed_location: parsedLocation ?? null,
      incident_id: incidentId ?? null,
      status,
    });
    unwrap(result);
  }
}

module.exports = { SmsLogRepository };
