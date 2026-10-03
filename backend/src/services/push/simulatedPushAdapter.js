/**
 * Push adapter used for the assignment: it only logs what a real push provider
 * (Expo Push, FCM, ...) would send. A real adapter must expose the same
 * `send` signature so NotificationService never changes.
 * @param {{ info: Function }} logger
 */
function createSimulatedPushAdapter(logger) {
  return {
    /**
     * @param {{ recipientIds: string[], sectorId?: string|null, title: string, body: string, data?: object }} message
     */
    async send({ recipientIds, sectorId = null, title, data = {} }) {
      logger.info('SIMULATED PUSH', {
        recipients: recipientIds.length,
        sectorId,
        title,
        type: data.type,
        trackingCode: data.trackingCode,
      });
      return { delivered: recipientIds.length };
    },
  };
}

module.exports = { createSimulatedPushAdapter };
