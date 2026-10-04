const { randomUUID } = require('node:crypto');
const { Notification } = require('../../models/mongo/schemas');
const { toNotification } = require('../../models/notification.model');

class MongoNotificationRepository {
  async createMany(rows) {
    if (!rows || rows.length === 0) return [];
    const docs = rows.map((r) => ({
      id: r.id || randomUUID(),
      recipient_id: r.recipient_id || null,
      target_sector_id: r.target_sector_id || null,
      type: r.type,
      title: r.title,
      body: r.body,
      incident_id: r.incident_id || null,
      read_at: r.read_at || null,
      created_at: r.created_at ? new Date(r.created_at) : new Date(),
    }));
    const created = await Notification.insertMany(docs);
    return created.map((d) => toNotification(d.toObject()));
  }

  async listForUser({ userId, sectorId }, { limit = 20, offset = 0 } = {}) {
    const conditions = [{ recipient_id: userId }];
    if (sectorId) {
      conditions.push({ target_sector_id: sectorId });
    }

    const docs = await Notification.find({ $or: conditions })
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    return docs.map(toNotification);
  }

  async markRead(id, userId) {
    const doc = await Notification.findOneAndUpdate(
      { id, recipient_id: userId },
      { $set: { read_at: new Date() } },
      { new: true },
    ).lean();

    return doc ? toNotification(doc) : null;
  }
}

module.exports = { MongoNotificationRepository };
