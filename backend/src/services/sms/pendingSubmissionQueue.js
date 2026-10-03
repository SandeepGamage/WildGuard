const DEFAULT_RETRY_MS = 30 * 1000;
const DEFAULT_MAX_ATTEMPTS = 20;

/**
 * Holds SMS reports whose database save failed (UC3.1 E2) and retries them in
 * the background, so the sender is never asked to resend.
 *
 * This queue lives in memory: it survives a temporary database outage but not
 * a process restart. A production deployment would back it with a durable queue.
 */
class PendingSubmissionQueue {
  /**
   * @param {object} deps
   * @param {(command: object) => Promise<unknown>} deps.submit Persists one report.
   * @param {{ warn: Function, error: Function, info: Function }} deps.logger
   * @param {number} [deps.retryMs]
   * @param {number} [deps.maxAttempts]
   */
  constructor({ submit, logger, retryMs = DEFAULT_RETRY_MS, maxAttempts = DEFAULT_MAX_ATTEMPTS }) {
    this.submit = submit;
    this.logger = logger;
    this.retryMs = retryMs;
    this.maxAttempts = maxAttempts;
    this.items = [];
    this.timer = null;
  }

  enqueue(command) {
    this.items.push({ command, attempts: 0 });
    this.#schedule();
  }

  get size() {
    return this.items.length;
  }

  /** Try every queued report once. Exposed for tests and for graceful shutdown. */
  async flush() {
    const batch = this.items;
    this.items = [];
    for (const item of batch) {
      try {
        await this.submit(item.command);
        this.logger.info('Queued SMS report saved after retry');
      } catch (error) {
        item.attempts += 1;
        if (item.attempts >= this.maxAttempts) {
          this.logger.error('Dropping queued SMS report after repeated failures', { message: error.message });
        } else {
          this.items.push(item);
        }
      }
    }
    this.timer = null;
    if (this.items.length > 0) this.#schedule();
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  #schedule() {
    if (this.timer) return;
    this.timer = setTimeout(() => this.flush(), this.retryMs);
    this.timer.unref?.();
  }
}

module.exports = { PendingSubmissionQueue };
