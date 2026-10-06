import { config } from '../config';
import { getToken } from './token';

const REQUEST_TIMEOUT_MS = 30000;

export const API_ERROR_CODES = Object.freeze({
  NETWORK: 'NETWORK_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR',
});

/** Error thrown for every failed API call, carrying the backend's stable error code. */
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let onUnauthorized = null;

/** The auth layer registers a handler that signs the user out when the session is rejected. */
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

async function parseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function send(path, { method = 'GET', body, auth = true, accept = 'application/json' } = {}) {
  const headers = { Accept: accept };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = auth ? getToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${config.apiUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, API_ERROR_CODES.NETWORK, 'Network request failed');
  } finally {
    clearTimeout(timer);
  }
}

async function failure(response, auth) {
  const json = await parseJson(response);
  if (response.status === 401 && auth && onUnauthorized) onUnauthorized();
  return new ApiError(
    response.status,
    json?.error?.code ?? API_ERROR_CODES.UNKNOWN,
    json?.error?.message ?? 'Request failed',
    json?.error?.details,
  );
}

/**
 * Call the backend REST API and unwrap its { success, data } envelope.
 * @param {string} path Path below the API base URL, e.g. "/analytics/parks".
 * @param {{ method?: string, body?: object, auth?: boolean }} [options]
 * @returns {Promise<any>} The `data` payload.
 * @throws {ApiError}
 */
export async function apiRequest(path, options = {}) {
  const auth = options.auth ?? true;
  const response = await send(path, options);
  if (response.ok) {
    const json = await parseJson(response);
    if (json?.success) return json.data;
  }
  throw await failure(response, auth);
}

const FILENAME_PATTERN = /filename="?([^";]+)"?/i;

/**
 * Download a file (an exported report). Failures come back as JSON, so they
 * use the same ApiError shape as apiRequest.
 * @returns {Promise<{ blob: Blob, filename: string|null }>}
 */
export async function apiDownload(path) {
  const response = await send(path, { accept: '*/*' });
  if (!response.ok) throw await failure(response, true);
  const disposition = response.headers.get('content-disposition') ?? '';
  return { blob: await response.blob(), filename: FILENAME_PATTERN.exec(disposition)?.[1] ?? null };
}
