/** The access token lives in localStorage so a refresh keeps the manager signed in. */
export const TOKEN_STORAGE_KEY = 'wildguard_web_token';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // Storage blocked (private mode): the session lasts until the tab closes.
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Nothing stored.
  }
}
