import { ApiError } from '../api/client';
import { asksElephantCount } from '../constants/incidentTypes';

export const SUBMIT_STATE = Object.freeze({ SENT: 'SENT', QUEUED: 'QUEUED', FAILED: 'FAILED' });

const QUEUED = 'QUEUED';
const FAILED = 'FAILED';
const UNAUTHENTICATED_STATUS = 401;
const RATE_LIMITED_STATUS = 429;
const SERVER_ERROR_FROM = 500;
const MAX_PHOTO_ATTEMPTS = 3;

const NETWORK_MESSAGE = /network|fetch|timeout|timed out|abort/i;

export function isNetworkError(error) {
  if (error instanceof ApiError) return error.isNetworkError;
  return NETWORK_MESSAGE.test(error?.message ?? '');
}

/** Retry later when the failure is not the report's fault. */
export function isRetryable(error) {
  if (isNetworkError(error)) return true;
  if (!(error instanceof ApiError)) return true;
  return (
    error.status === UNAUTHENTICATED_STATUS ||
    error.status === RATE_LIMITED_STATUS ||
    error.status >= SERVER_ERROR_FROM
  );
}

/** Turn the form state into the API request body (server derives everything else). */
export function toApiPayload(draft) {
  const payload = {
    incidentType: draft.incidentType,
    occurredWhen: draft.occurredWhen,
  };
  if (asksElephantCount(draft.incidentType) && draft.elephantCountBand) {
    payload.elephantCountBand = draft.elephantCountBand;
  }
  if (draft.villageId) payload.villageId = draft.villageId;
  else {
    payload.latitude = draft.coordinates.latitude;
    payload.longitude = draft.coordinates.longitude;
  }
  return payload;
}

/**
 * Reliable report submission: persist locally first, then try the network, and
 * retry later when it fails. Dependencies are injected so the logic is testable
 * without SQLite or a server.
 *
 * @param {object} deps
 * @param {object} deps.repository Pending-report store (add/listForUser/update/remove).
 * @param {(body: object) => Promise<object>} deps.createIncident API call (idempotent by clientRequestId).
 * @param {(photo: object) => Promise<string>} deps.uploadPhoto Uploads a photo and returns its storage path.
 * @param {() => string} deps.newId Generates the client request id.
 * @param {() => Date} [deps.now]
 */
export function createReportSync({ repository, createIncident, uploadPhoto, newId, now = () => new Date() }) {
  async function syncOne(item) {
    try {
      let photoPath = item.photoPath;

      if (item.photo && !photoPath) {
        try {
          photoPath = await uploadPhoto(item.photo);
          await repository.update(item.clientRequestId, { photoPath });
        } catch (error) {
          // A photo problem must never lose the report: keep retrying while the
          // network is the cause, then send the text report without the photo.
          if (isNetworkError(error) && item.attempts < MAX_PHOTO_ATTEMPTS) throw error;
          photoPath = null;
          await repository.update(item.clientRequestId, { photo: null });
        }
      }

      const body = { ...item.payload, ...(photoPath ? { photoPath } : {}) };
      const report = await createIncident(body);
      await repository.remove(item.clientRequestId);
      return { state: SUBMIT_STATE.SENT, report };
    } catch (error) {
      const attempts = item.attempts + 1;
      if (isRetryable(error)) {
        await repository.update(item.clientRequestId, {
          attempts,
          lastError: error.code ?? 'ERROR',
        });
        return { state: SUBMIT_STATE.QUEUED };
      }
      await repository.update(item.clientRequestId, {
        attempts,
        status: FAILED,
        lastError: error.code ?? 'ERROR',
      });
      return { state: SUBMIT_STATE.FAILED, code: error.code };
    }
  }

  return {
    /**
     * Save the report on the phone, then try to send it.
     * @returns {Promise<{ state: 'SENT', report: object } | { state: 'QUEUED' } | { state: 'FAILED', code: string }>}
     */
    async submit({ userId, draft, photo }) {
      const clientRequestId = newId();
      const item = {
        clientRequestId,
        userId,
        payload: { clientRequestId, ...toApiPayload(draft), capturedAt: now().toISOString() },
        photo: photo ?? null,
        photoPath: null,
        status: QUEUED,
        attempts: 0,
        lastError: null,
        createdAt: now().toISOString(),
      };
      await repository.add(item);
      return syncOne(item);
    },

    /** Retry everything still waiting for this user. Returns how many reports were delivered. */
    async flush(userId) {
      const items = (await repository.listForUser(userId)).filter((item) => item.status === QUEUED);
      let delivered = 0;
      for (const item of items) {
        const result = await syncOne(item);
        if (result.state === SUBMIT_STATE.SENT) delivered += 1;
      }
      return delivered;
    },

    listPending: (userId) => repository.listForUser(userId),

    discard: (clientRequestId) => repository.remove(clientRequestId),
  };
}
