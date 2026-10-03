import { config } from '../constants/config';
import { getAccessToken } from '../services/supabase';

const REQUEST_TIMEOUT_MS = 15000;

export const API_ERROR_CODES = Object.freeze({
  NETWORK: 'NETWORK_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR',
});

/** Error thrown for every failed API call, with the backend's stable error code. */
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isNetworkError() {
    return this.code === API_ERROR_CODES.NETWORK;
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

/**
 * Call the backend REST API and unwrap its { success, data } envelope.
 * @param {string} path Path below the API base URL, e.g. "/incidents/mine".
 * @param {{ method?: string, body?: object, auth?: boolean }} [options]
 * @returns {Promise<any>} The `data` payload.
 * @throws {ApiError}
 */
export async function apiRequest(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = await getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${config.apiUrl}${path}`, {
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

  const json = await parseJson(response);
  if (response.ok && json?.success) return json.data;

  if (response.status === 401 && auth && onUnauthorized) onUnauthorized();
  throw new ApiError(
    response.status,
    json?.error?.code ?? API_ERROR_CODES.UNKNOWN,
    json?.error?.message ?? 'Request failed',
    json?.error?.details,
  );
}
