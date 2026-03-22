const BASE_URL = 'http://localhost:8000/api';

function buildURL(path, params) {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        searchParams.append(key, value);
      }
    }
    const qs = searchParams.toString();
    if (qs) {
      url.search = qs;
    }
  }
  return url.toString();
}

async function get(path, params) {
  const url = buildURL(path, params);
  const response = await fetch(url, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
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

export async function fetchDCFInputs(ticker) {
  return get(`/companies/${ticker}/dcf-inputs/`);
}

export async function fetchScreener(params) {
  return get('/screener/', params);
}

export async function* sendChatMessage(ticker, message) {
  const url = `${BASE_URL}/companies/${ticker}/chat/`;
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;

      const json = line.slice(6);
      let parsed;
      try {
        parsed = JSON.parse(json);
      } catch {
        continue;
      }

      if (parsed.type === 'text') {
        yield parsed.content;
      } else if (parsed.type === 'done') {
        return;
      } else if (parsed.type === 'error') {
        throw new Error(parsed.content || 'Stream error');
      }
    }
  }
}
