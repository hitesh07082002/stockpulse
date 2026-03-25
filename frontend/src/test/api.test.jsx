import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_COPILOT_HISTORY_MESSAGES,
  normalizeCopilotHistory,
  sendChatMessage,
} from '../utils/api';

function createStreamResponse(chunks, init = {}) {
  const encoder = new TextEncoder();
  let index = 0;

  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? 'OK',
    body: {
      getReader() {
        return {
          async read() {
            if (index >= chunks.length) {
              return { done: true, value: undefined };
            }

            return {
              done: false,
              value: encoder.encode(chunks[index++]),
            };
          },
        };
      },
    },
  };
}

describe('copilot API helpers', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the most recent bounded turns when normalizing history', () => {
    const history = Array.from({ length: 14 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `turn-${index + 1}`,
    }));

    const normalized = normalizeCopilotHistory(history);

    expect(normalized).toHaveLength(MAX_COPILOT_HISTORY_MESSAGES);
    expect(normalized[0]).toEqual({ role: 'user', content: 'turn-3' });
    expect(normalized.at(-1)).toEqual({ role: 'assistant', content: 'turn-14' });
  });

  it('sends bounded history and parses meta/text/done stream events', async () => {
    const history = Array.from({ length: 14 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `turn-${index + 1}`,
    }));

    const fetchMock = vi.fn(async (_input, init = {}) => {
      const payload = JSON.parse(init.body);

      expect(payload.message).toBe('Why is revenue up?');
      expect(payload.history).toHaveLength(MAX_COPILOT_HISTORY_MESSAGES);
      expect(payload.history[0]).toEqual({ role: 'user', content: 'turn-3' });
      expect(payload.history.at(-1)).toEqual({ role: 'assistant', content: 'turn-14' });

      return createStreamResponse([
        'data: {"type":"meta","ticker":"AAPL","company_name":"Apple Inc.","quote_freshness":"Quote updated 5m ago","coverage_summary":"Coverage: 10 annual, 8 quarterly","remaining_quota":4}\n\n',
        'data: {"type":"text","content":"Apple is still compounding."}\n\n',
        'data: {"type":"done","remaining_quota":4,"truncated":false,"can_continue":false,"auto_continued":true,"continuation_count":1}\n\n',
      ]);
    });

    vi.stubGlobal('fetch', fetchMock);

    const events = [];
    for await (const event of sendChatMessage('AAPL', 'Why is revenue up?', history)) {
      events.push(event);
    }

    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({
      type: 'meta',
      ticker: 'AAPL',
      company_name: 'Apple Inc.',
      remainingQuota: 4,
    });
    expect(events[1]).toMatchObject({
      type: 'text',
      content: 'Apple is still compounding.',
    });
    expect(events[2]).toMatchObject({
      type: 'done',
      remainingQuota: 4,
      truncated: false,
      canContinue: false,
      autoContinued: true,
      continuationCount: 1,
    });
  });

  it('yields a normalized error event from the stream', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => createStreamResponse([
      'data: {"type":"error","code":"quota_exhausted","message":"Daily limit reached","remaining_quota":0,"status":429,"provider":"gemini","retryable":true,"partial":false}\n\n',
    ])));

    const events = [];
    for await (const event of sendChatMessage('AAPL', 'Why is revenue up?')) {
      events.push(event);
    }

    expect(events).toEqual([
      expect.objectContaining({
        type: 'error',
        code: 'quota_exhausted',
        message: 'Daily limit reached',
        remainingQuota: 0,
        status: 429,
        provider: 'gemini',
        retryable: true,
        partial: false,
      }),
    ]);
  });

  it('throws a retryable error when the stream ends without a terminal event', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => createStreamResponse([
      'data: {"type":"meta","ticker":"AAPL"}\n\n',
      'data: {"type":"text","content":"Partial"}\n\n',
    ])));

    await expect(async () => {
      for await (const _event of sendChatMessage('AAPL', 'Why is revenue up?')) {
        // consume stream
      }
    }).rejects.toMatchObject({
      message: 'The response stream ended unexpectedly. Please try again.',
      payload: {
        code: 'stream_ended_unexpectedly',
        retryable: true,
      },
    });
  });
});
