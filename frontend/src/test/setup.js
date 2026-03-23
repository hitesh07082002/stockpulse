import '@testing-library/jest-dom/vitest';
import { beforeEach, afterEach, vi } from 'vitest';

const storage = new Map();
const defaultAnonymousSession = {
  is_authenticated: false,
  user: null,
  limits: {
    anonymous_daily: 10,
    authenticated_daily: 50,
    current_daily: 10,
  },
  google_signin_available: true,
  has_refresh_session: false,
};

function createJsonResponse(payload, { ok = true, status = 200, statusText = 'OK' } = {}) {
  return {
    ok,
    status,
    statusText,
    async json() {
      return payload;
    },
  };
}

Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      storage.set(key, String(value));
    },
    removeItem(key) {
      storage.delete(key);
    },
    clear() {
      storage.clear();
    },
  },
  configurable: true,
});

beforeEach(() => {
  storage.clear();
  document.cookie = 'csrftoken=test-csrf-token; path=/';

  Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
    value: vi.fn(),
    configurable: true,
  });

  globalThis.fetch = vi.fn(async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init.method || 'GET').toUpperCase();

    if (url.includes('/api/auth/session/') && method === 'GET') {
      return createJsonResponse(defaultAnonymousSession);
    }

    if (url.includes('/api/auth/refresh/') && method === 'POST') {
      return createJsonResponse(
        { error: 'No refresh session available.' },
        { ok: false, status: 401, statusText: 'Unauthorized' },
      );
    }

    throw new Error(`Unhandled fetch mock for ${method} ${url}`);
  });
});

afterEach(() => {
  storage.clear();
  vi.clearAllMocks();
});
