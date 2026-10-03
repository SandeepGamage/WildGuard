const { unwrap } = require('./support');
const { toNotification } = require('../models/notification.model');

/** Data access for in-app notifications (also the simulated push log). */
class NotificationRepository {
  constructor(db) {
    this.db = db;
  }

  /** @param {object[]} rows Notification rows in snake_case column form. */
  async createMany(rows) {
    if (rows.length === 0) return [];
    const result = await this.db.from('notifications').insert(rows).select('*');
    return unwrap(result).map(toNotification);
  }

  /** Notifications addressed to the user, or broadcast to the user's sector. */
  async listForUser({ userId, sectorId }, { limit, offset }) {
    const target = sectorId
      ? `recipient_id.eq.${userId},target_sector_id.eq.${sectorId}`
      : `recipient_id.eq.${userId}`;
    const result = await this.db
      .from('notifications')
      .select('*')
      .or(target)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    return unwrap(result).map(toNotification);
  }

  /** @returns {Promise<object|null>} Updated notification, or null if it is not the user's. */
  async markRead(id, userId) {
    const result = await this.db
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .eq('recipient_id', userId)
      .select('*')
      .maybeSingle();
    const row = unwrap(result);
    return row ? toNotification(row) : null;
  }
}

module.exports = { NotificationRepository };
