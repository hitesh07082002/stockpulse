const RAW_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

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

async function get(path, params) {
  const response = await fetch(buildURL(path, params), {
    credentials: 'include',
  });

  if (!response.ok) {
    let messageText = `API error: ${response.status} ${response.statusText}`;
    try {
      const errorPayload = await response.json();
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

    throw new Error(messageText);
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

export async function* sendChatMessage(ticker, message) {
  const response = await fetch(buildURL(`/companies/${ticker}/copilot/`), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    let messageText = `API error: ${response.status} ${response.statusText}`;
    try {
      const errorPayload = await response.json();
      if (errorPayload?.message) {
        messageText = errorPayload.message;
      } else if (errorPayload?.error) {
        messageText = errorPayload.error;
      }
    } catch {
      // Fall back to the generic HTTP error above.
    }
    throw new Error(messageText);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;

      const json = line.slice(6);

      try {
        const parsed = JSON.parse(json);

        if (parsed.type === 'text') {
          yield parsed.content;
        } else if (parsed.type === 'done') {
          return;
        } else if (parsed.type === 'error') {
          throw new Error(parsed.content || 'Stream error');
        }
      } catch {
        continue;
      }
    }
  }
}
