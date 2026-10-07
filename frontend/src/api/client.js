const BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const TOKEN_KEY = 'cartpilot.token';
const SESSION_KEY = 'cartpilot.session';

function storage(kind) {
  try {
    return kind === 'session' ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

export function getToken() {
  try {
    return storage('local')?.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) storage('local')?.setItem(TOKEN_KEY, token);
    else storage('local')?.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: the session simply won't persist */
  }
}

let memorySession = null;
/** Browser-session id used by the backend for funnel analytics (conversion, abandonment). */
function sessionId() {
  try {
    const store = storage('session');
    let id = store?.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID().replace(/-/g, '');
      store?.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    memorySession ||= Math.random().toString(36).slice(2).padEnd(16, '0');
    return memorySession;
  }
}

export class ApiError extends Error {
  constructor(status, message, payload) {
    super(message);
    this.status = status;
    this.code = payload?.code;
    this.details = payload?.details;
  }
}

let unauthorizedHandler = null;
export function onUnauthorized(handler) {
  unauthorizedHandler = handler;
}

export async function api(path, { method = 'GET', body, query } = {}) {
  const url = new URL(`${BASE_URL}${path}`, window.location.origin);
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  }
  const headers = { 'X-Session-Id': sessionId() };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Is the API running?');
  }
  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && token) unauthorizedHandler?.();
    throw new ApiError(response.status, data?.error?.message || response.statusText, data?.error);
  }
  return data;
}

export const trackEvent = (type) => api('/events', { method: 'POST', body: { type } }).catch(() => {});
