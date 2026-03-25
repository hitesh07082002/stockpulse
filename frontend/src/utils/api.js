const RAW_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
export const MAX_COPILOT_HISTORY_TURNS = 6;
export const MAX_COPILOT_HISTORY_MESSAGES = MAX_COPILOT_HISTORY_TURNS * 2;

function resolveBaseURL() {
  if (RAW_BASE_URL.startsWith('http://') || RAW_BASE_URL.startsWith('https://')) {
    return RAW_BASE_URL;
  }

  if (typeof window !== 'undefined') {
    return new URL(RAW_BASE_URL, window.location.origin).toString().replace(/\/$/, '');
  }

  return `http://localhost${RAW_BASE_URL.startsWith('/') ? RAW_BASE_URL : `/${RAW_BASE_URL}`}`;
}

function buildURL(path, params) {
  const url = new URL(`${resolveBaseURL()}${path}`);

  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, value);
      }
    }

    if (searchParams.size > 0) {
      url.search = searchParams.toString();
    }
  }

  return url.toString();
}

async function buildApiError(response) {
  let errorPayload = null;
  let messageText = `API error: ${response.status} ${response.statusText}`;

  try {
    errorPayload = await response.json();
    if (errorPayload?.message) {
      messageText = errorPayload.message;
    } else if (errorPayload?.error) {
      messageText = errorPayload.error;
    } else if (errorPayload?.detail) {
      messageText = errorPayload.detail;
    }
  } catch {
    // Fall back to the generic HTTP error above.
  }

  const error = new Error(messageText);
  error.status = response.status;
  error.statusText = response.statusText;
  error.payload = errorPayload;

  return error;
}

function getCSRFToken() {
  if (typeof document === 'undefined') {
    return '';
  }

  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export function normalizeCopilotHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const role = entry.role === 'assistant' || entry.role === 'user' ? entry.role : null;
      const content = typeof entry.content === 'string'
        ? entry.content.trim()
        : typeof entry.content === 'number'
          ? String(entry.content).trim()
          : '';

      if (!role || !content) {
        return null;
      }

      return { role, content };
    })
    .filter(Boolean)
    .slice(-MAX_COPILOT_HISTORY_MESSAGES);
}

function extractRemainingQuota(payload) {
  const candidates = [
    payload?.remaining_quota,
    payload?.remaining_daily,
    payload?.remainingQuota,
    payload?.remaining,
    payload?.quota_remaining,
  ];

  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null || candidate === '') {
      continue;
    }

    const parsed = Number(candidate);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function parseNumericField(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeCopilotStreamEvent(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  if (payload.type === 'meta') {
    return {
      ...payload,
      type: 'meta',
      remainingQuota: extractRemainingQuota(payload),
    };
  }

  if (payload.type === 'text') {
    return {
      type: 'text',
      content: String(payload.content ?? payload.text ?? payload.delta ?? ''),
    };
  }

  if (payload.type === 'error') {
    return {
      ...payload,
      type: 'error',
      message: String(payload.message ?? payload.content ?? payload.error ?? 'Stream error'),
      code: payload.code ?? payload.error_code ?? null,
      status: parseNumericField(payload.status),
      provider: payload.provider ?? null,
      retryable: payload.retryable === undefined ? null : Boolean(payload.retryable),
      partial: Boolean(payload.partial),
      remainingQuota: extractRemainingQuota(payload),
    };
  }

  if (payload.type === 'done') {
    return {
      ...payload,
      type: 'done',
      remainingQuota: extractRemainingQuota(payload),
    };
  }

  if (typeof payload.content === 'string' || typeof payload.text === 'string' || typeof payload.delta === 'string') {
    return {
      type: 'text',
      content: String(payload.content ?? payload.text ?? payload.delta ?? ''),
    };
  }

  return null;
}

function parseSseRecord(rawLines) {
  if (!rawLines.length) {
    return null;
  }

  const data = rawLines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).replace(/^\s/, ''))
    .join('\n')
    .trim();

  if (!data) {
    return null;
  }

  try {
    return normalizeCopilotStreamEvent(JSON.parse(data));
  } catch {
    return null;
  }
}

async function get(path, params) {
  const response = await fetch(buildURL(path, params), {
    credentials: 'include',
  });

  if (!response.ok) {
    throw await buildApiError(response);
  }

  return response.json();
}

async function post(path, body, options = {}) {
  const response = await fetch(buildURL(path), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(getCSRFToken() ? { 'X-CSRFToken': getCSRFToken() } : {}),
      ...(options.headers || {}),
    },
    body: JSON.stringify(body ?? {}),
  });

  if (!response.ok) {
    throw await buildApiError(response);
  }

  return response.json();
}

export async function fetchCompanies(params) {
  return get('/companies/', params);
}

export async function fetchCompany(ticker) {
  return get(`/companies/${ticker}/`);
}

export async function fetchFinancials(ticker, params) {
  return get(`/companies/${ticker}/financials/`, params);
}

export async function fetchPrices(ticker, range) {
  return get(`/companies/${ticker}/prices/`, { range });
}

export async function fetchValuationInputs(ticker) {
  return get(`/companies/${ticker}/valuation-inputs/`);
}

export async function fetchScreener(params) {
  return get('/screener/', params);
}

export async function fetchAuthSession() {
  return get('/auth/session/');
}

export async function registerAuth(payload) {
  return post('/auth/register/', payload);
}

export async function loginAuth(payload) {
  return post('/auth/login/', payload);
}

export async function requestPasswordReset(payload) {
  return post('/auth/password-reset/request/', payload);
}

export async function confirmPasswordReset(payload) {
  return post('/auth/password-reset/confirm/', payload);
}

export async function refreshAuth() {
  return post('/auth/refresh/', {});
}

export async function logoutAuth() {
  return post('/auth/logout/', {});
}

export function startGoogleAuth(nextPath) {
  const currentPath = nextPath || (typeof window !== 'undefined'
    ? `${window.location.pathname}${window.location.search}`
    : '/');
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
  const target = buildURL('/auth/google/start/', {
    next: currentPath,
    origin,
  });

  if (typeof window !== 'undefined') {
    window.location.assign(target);
  }
}

export async function* sendChatMessage(ticker, message, history = []) {
  const response = await fetch(buildURL(`/companies/${ticker}/copilot/`), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(getCSRFToken() ? { 'X-CSRFToken': getCSRFToken() } : {}),
    },
    body: JSON.stringify({
      message,
      history: normalizeCopilotHistory(history),
    }),
  });

  if (!response.ok) {
    throw await buildApiError(response);
  }

  if (!response.body || typeof response.body.getReader !== 'function') {
    throw new Error('Streaming response unavailable.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventLines = [];
  let sawTerminalEvent = false;

  function flushEventLines() {
    const event = parseSseRecord(eventLines);
    eventLines = [];
    return event;
  }

  function processBufferChunk(chunk) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.replace(/\r/g, '').split('\n');
    buffer = lines.pop() || '';

    const events = [];
    for (const line of lines) {
      if (!line) {
        const event = flushEventLines();
        if (event) {
          events.push(event);
        }
        continue;
      }

      if (line.startsWith('data:')) {
        eventLines.push(line);
      }
    }

    return events;
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    const events = processBufferChunk(value);
    for (const event of events) {
      if (event.type === 'error') {
        sawTerminalEvent = true;
        yield event;
        return;
      }

      if (event.type === 'done') {
        sawTerminalEvent = true;
        yield event;
        return;
      }

      yield event;
    }
  }

  buffer += decoder.decode();
  if (buffer) {
    const lines = buffer.replace(/\r/g, '').split('\n');
    buffer = lines.pop() || '';
    if (buffer) {
      if (buffer.startsWith('data:')) {
        eventLines.push(buffer);
      }
      buffer = '';
    }
    for (const line of lines) {
      if (!line) {
        const event = flushEventLines();
        if (event) {
          if (event.type === 'error' || event.type === 'done') {
            sawTerminalEvent = true;
          }
          yield event;
        }
        continue;
      }

      if (line.startsWith('data:')) {
        eventLines.push(line);
      }
    }
  }

  const finalEvent = flushEventLines();
  if (finalEvent) {
    if (finalEvent.type === 'error' || finalEvent.type === 'done') {
      sawTerminalEvent = true;
    }
    yield finalEvent;
  }

  if (!sawTerminalEvent) {
    const error = new Error('The response stream ended unexpectedly. Please try again.');
    error.payload = {
      code: 'stream_ended_unexpectedly',
      retryable: true,
    };
    throw error;
  }
}
