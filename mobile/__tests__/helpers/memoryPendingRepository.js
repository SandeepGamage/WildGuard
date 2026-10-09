/** In-memory stand-in for the SQLite pending-report store (same interface). */
export function createMemoryPendingRepository() {
  const items = new Map();
  return {
    items,
    async add(item) {
      items.set(item.clientRequestId, { ...item });
    },
    async listForUser(userId) {
      return [...items.values()].filter((item) => item.userId === userId);
    },
    async update(clientRequestId, fields) {
      const current = items.get(clientRequestId);
      if (current) items.set(clientRequestId, { ...current, ...fields });
    },
    async remove(clientRequestId) {
      items.delete(clientRequestId);
    },
  };
}
