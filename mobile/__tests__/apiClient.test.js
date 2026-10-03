import { API_ERROR_CODES, ApiError, apiRequest, setUnauthorizedHandler } from '../src/api/client';
import { getAccessToken } from '../src/services/supabase';
import { friendlyError } from '../src/utils/errors';
import i18n from '../src/i18n';

const t = i18n.t.bind(i18n);

function mockFetch(response) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: response.status < 400,
    status: response.status,
    json: async () => response.body,
  });
}

describe('API client', () => {
  afterEach(() => {
    setUnauthorizedHandler(null);
    jest.clearAllMocks();
  });

  it('unwraps the success envelope and sends the bearer token', async () => {
    getAccessToken.mockResolvedValueOnce('token-123');
    mockFetch({ status: 200, body: { success: true, data: { hello: 'world' }, message: 'OK' } });

    await expect(apiRequest('/incidents/mine')).resolves.toEqual({ hello: 'world' });

    const [url, options] = global.fetch.mock.calls[0];
    expect(url.endsWith('/incidents/mine')).toBe(true);
    expect(options.headers.Authorization).toBe('Bearer token-123');
  });

  it('sends JSON bodies and skips the token for public calls', async () => {
    mockFetch({ status: 201, body: { success: true, data: { id: 1 } } });
    await apiRequest('/auth/register', { method: 'POST', body: { a: 1 }, auth: false });

    const [, options] = global.fetch.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(options.body).toBe(JSON.stringify({ a: 1 }));
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(options.headers.Authorization).toBeUndefined();
    expect(getAccessToken).not.toHaveBeenCalled();
  });

  it('throws an ApiError carrying the backend code and details', async () => {
    mockFetch({
      status: 409,
      body: {
        success: false,
        error: { code: 'INCIDENT_ALREADY_REVIEWED', message: 'reviewed', details: { status: 'VERIFIED' } },
      },
    });

    const error = await apiRequest('/x').catch((failure) => failure);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: 'INCIDENT_ALREADY_REVIEWED',
      details: { status: 'VERIFIED' },
    });
  });

  it('turns a dropped connection into a NETWORK_ERROR', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    const error = await apiRequest('/x').catch((failure) => failure);
    expect(error.code).toBe(API_ERROR_CODES.NETWORK);
    expect(error.isNetworkError).toBe(true);
  });

  it('copes with a non-JSON error body', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('not json');
      },
    });
    const error = await apiRequest('/x').catch((failure) => failure);
    expect(error).toMatchObject({ status: 502, code: API_ERROR_CODES.UNKNOWN });
  });

  it('signals the auth layer when the session is rejected', async () => {
    const handler = jest.fn();
    setUnauthorizedHandler(handler);
    mockFetch({ status: 401, body: { success: false, error: { code: 'UNAUTHENTICATED', message: 'x' } } });
    await apiRequest('/x').catch(() => {});
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not sign the user out for a 401 on a public call', async () => {
    const handler = jest.fn();
    setUnauthorizedHandler(handler);
    mockFetch({ status: 401, body: { success: false, error: { code: 'X', message: 'x' } } });
    await apiRequest('/x', { auth: false }).catch(() => {});
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('friendly errors', () => {
  it('maps known codes to translated messages and hides raw messages', () => {
    expect(friendlyError({ code: 'NETWORK_ERROR', message: 'TypeError: fetch failed' }, t)).toBe(
      'Could not reach the server. Check your connection and try again.',
    );
    expect(friendlyError({ code: 'PHONE_ALREADY_REGISTERED' }, t)).toBe(
      'This mobile number is already registered. Try signing in.',
    );
  });

  it('falls back to a generic message for unknown failures', () => {
    expect(friendlyError(new Error('secret stack trace'), t)).toBe('Something went wrong. Please try again.');
    expect(friendlyError(undefined, t)).toBe('Something went wrong. Please try again.');
  });
});
