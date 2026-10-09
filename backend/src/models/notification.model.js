/** Map a notifications row to the domain/API shape. */
function toNotification(row) {
  return {
    id: row.id,
    recipientId: row.recipient_id,
    targetSectorId: row.target_sector_id,
    incidentId: row.incident_id,
    type: row.notification_type,
    title: row.title,
    body: row.body,
    payload: row.payload,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

module.exports = { toNotification };
