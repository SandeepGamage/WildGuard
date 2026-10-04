const { SmsLog } = require('../../models/mongo/schemas');

class MongoSmsLogRepository {
  async create({ direction, phone, message, parsedType, parsedLocation, incidentId, status }) {
    await SmsLog.create({
      direction,
      phone,
      message,
      parsed_type: parsedType ?? null,
      parsed_location: parsedLocation ?? null,
      incident_id: incidentId ?? null,
      status,
      created_at: new Date(),
    });
  }
}

module.exports = { MongoSmsLogRepository };
