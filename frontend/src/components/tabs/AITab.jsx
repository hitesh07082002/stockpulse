import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from '../../lib/remarkGfm';
import {
  normalizeCopilotHistory,
  sendChatMessage,
} from '../../utils/api';
import { useAuth } from '../auth/useAuth';

/* ────────────────────────────────────────────
   Suggested Prompts
   ──────────────────────────────────────────── */

const SUGGESTED_PROMPTS = [
  'Why did revenue change in 2020?',
  'Is this stock overvalued?',
  'Summarize key financial trends',
  'Compare margins to sector average',
];

function flattenMarkdownText(children) {
  return React.Children.toArray(children)
    .map((child) => {
      if (typeof child === 'string') {
        return child;
      }
      if (typeof child === 'number') {
        return String(child);
      }
      if (React.isValidElement(child)) {
        return flattenMarkdownText(child.props.children);
      }
      return '';
    })
    .join('');
}

function normalizeTableCells(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function parseMarkdownTable(content) {
  if (!content || !content.includes('|')) {
    return null;
  }

  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 3) {
    return null;
  }

  const separatorPattern = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/;
  if (!separatorPattern.test(lines[1])) {
    return null;
  }

  const header = normalizeTableCells(lines[0]);
  if (header.length < 2) {
    return null;
  }

  const rows = lines.slice(2).map(normalizeTableCells);
  if (!rows.length || rows.some((row) => row.length !== header.length)) {
    return null;
  }

  return { header, rows };
}

function MarkdownParagraph({ children }) {
  const content = flattenMarkdownText(children).trim();
  const table = parseMarkdownTable(content);

  if (!table) {
    return <p>{children}</p>;
  }

  return (
    <div className="my-3 overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead className="bg-elevated text-text-secondary">
          <tr>
            {table.header.map((cell) => (
              <th key={cell} className="border-b border-border px-3 py-2 font-data font-medium">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={`${rowIndex}-${row.join('|')}`} className="border-b border-border last:border-b-0">
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`} className="px-3 py-2 font-data text-text-primary">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ────────────────────────────────────────────
   AITab Component
   ──────────────────────────────────────────── */

function AITab({ ticker, company }) {
  const {
    isAuthenticated,
    limits,
    openAuthModal,
  } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [errorStatus, setErrorStatus] = useState(null);
  const [streamMeta, setStreamMeta] = useState(null);
  const [remainingQuota, setRemainingQuota] = useState(null);

  const messageEndRef = useRef(null);
  const messageIdRef = useRef(0);

  /* Auto-scroll to bottom on new messages / streaming updates */
  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  function nextMessageId() {
    messageIdRef.current += 1;
    return `${Date.now()}-${messageIdRef.current}`;
  }

  function createMessage(role, content, status = 'complete') {
    return {
      id: nextMessageId(),
      role,
      content,
      status,
    };
  }

  function updateLastAssistantMessage(updater) {
    setMessages((prev) => {
      if (!prev.length) {
        return prev;
      }

      const updated = [...prev];
      const lastIndex = updated.length - 1;
      const lastMessage = updated[lastIndex];
      if (!lastMessage || lastMessage.role !== 'assistant') {
        return prev;
      }

      updated[lastIndex] = updater(lastMessage);
      return updated;
    });
  }

  function finalizeAssistantMessage() {
    updateLastAssistantMessage((message) => ({
      ...message,
      status: 'complete',
    }));
  }

  function removeEmptyAssistantPlaceholder() {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === 'assistant' && !last.content) {
        return prev.slice(0, -1);
      }
      return prev;
    });
  }

  function getStreamRemainingQuota(payload) {
    const candidates = [
      payload?.remainingQuota,
      payload?.remaining_quota,
      payload?.remaining_daily,
      payload?.remaining,
    ];

    for (const candidate of candidates) {
      if (candidate === undefined || candidate === null || candidate === '') {
        continue;
      }

      const value = Number(candidate);
      if (Number.isFinite(value)) {
        return value;
      }
    }

    if (payload?.limit !== undefined && payload?.used !== undefined) {
      const limit = Number(payload.limit);
      const used = Number(payload.used);
      if (Number.isFinite(limit) && Number.isFinite(used)) {
        return Math.max(limit - used, 0);
      }
    }

    return null;
  }

  function buildConversationHistory() {
    return normalizeCopilotHistory(messages);
  }

  /* ---- Send handler ---- */
  async function handleSend(messageText) {
    const text = (messageText || '').trim();
    if (!text || isStreaming) return;

    setError('');
    setErrorCode('');
    setErrorStatus(null);
    setStreamMeta(null);
    setInput('');

    const history = buildConversationHistory();

    /* Append user message and an empty assistant placeholder */
    setMessages((prev) => [
      ...prev,
      createMessage('user', text),
      createMessage('assistant', '', 'streaming'),
    ]);

    setIsStreaming(true);

    try {
      const stream = sendChatMessage(ticker, text, history);
      for await (const event of stream) {
        if (!event || typeof event !== 'object') {
          continue;
        }

        if (event.type === 'meta') {
          setStreamMeta(event);
          const streamRemaining = getStreamRemainingQuota(event);
          if (streamRemaining !== null) {
            setRemainingQuota(streamRemaining);
          }
          continue;
        }

        if (event.type === 'text') {
          if (!event.content) {
            continue;
          }

          updateLastAssistantMessage((message) => ({
            ...message,
            content: `${message.content}${event.content}`,
          }));
          continue;
        }

        if (event.type === 'done') {
          const streamRemaining = getStreamRemainingQuota(event);
          if (streamRemaining !== null) {
            setRemainingQuota(streamRemaining);
          }
          finalizeAssistantMessage();
          return;
        }

        if (event.type === 'error') {
          setError(event.message || 'Something went wrong. Please try again.');
          setErrorCode(event.code || '');
          setErrorStatus(event.status || null);
          const streamRemaining = getStreamRemainingQuota(event);
          if (streamRemaining !== null) {
            setRemainingQuota(streamRemaining);
          }
          finalizeAssistantMessage();
          return;
        }
      }
    } catch (err) {
      const payload = err?.payload || {};
      const streamRemaining = getStreamRemainingQuota(payload);
      if (streamRemaining !== null) {
        setRemainingQuota(streamRemaining);
      }

      const fallbackMessage = err?.message || 'Something went wrong. Please try again.';
      setError(fallbackMessage);
      setErrorCode(payload?.code || (err?.status === 429 ? 'quota_exhausted' : ''));
      setErrorStatus(err?.status || null);
      removeEmptyAssistantPlaceholder();
    } finally {
      setIsStreaming(false);
    }
  }

  /* ---- Input key handler ---- */
  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  }

  /* ---- Derived state ---- */
  const hasMessages = messages.length > 0;
  const canSend = input.trim().length > 0 && !isStreaming;
  const companyName = (company && company.name) || ticker;
  const anonymousLimit = limits?.anonymous_daily || 10;
  const authenticatedLimit = limits?.authenticated_daily || 50;
  const currentLimit = isAuthenticated ? authenticatedLimit : anonymousLimit;
  const hasQuotaSignal = remainingQuota !== null;
  const quotaLabel = hasQuotaSignal
    ? `${remainingQuota} left today`
    : null;
  const shouldShowUpgradePrompt = !isAuthenticated && (
    errorStatus === 429 || /limit|quota/i.test(`${errorCode} ${error}`)
  );
  const metaSummaryParts = [];

  if (streamMeta?.company_name) {
    metaSummaryParts.push(streamMeta.company_name);
  }

  if (streamMeta?.quote_freshness) {
    metaSummaryParts.push(streamMeta.quote_freshness);
  }

  if (streamMeta?.coverage_summary) {
    metaSummaryParts.push(streamMeta.coverage_summary);
  }

  return (
    <div className="flex flex-col h-[600px] bg-surface border border-border rounded-lg overflow-hidden">
      {/* ===== Header ===== */}
      <div className="px-4 py-3 border-b border-border flex flex-col gap-2">
        <div className="flex justify-between items-start gap-3">
          <span className="font-display text-lg font-semibold text-text-primary">
            Ask about {companyName}'s financials
          </span>
          <span className="text-xs font-data text-text-tertiary bg-elevated px-2 py-1 rounded-full whitespace-nowrap">
            {isAuthenticated
              ? `Signed in: ${currentLimit}/day`
              : `Free: ${anonymousLimit}/day · Sign in: ${authenticatedLimit}/day`}
            {quotaLabel ? ` · ${quotaLabel}` : ''}
          </span>
        </div>
        {metaSummaryParts.length > 0 && (
          <div className="flex flex-wrap gap-2 text-[11px] font-data text-text-tertiary">
            {metaSummaryParts.map((part) => (
              <span key={part} className="rounded-full border border-border bg-elevated px-2 py-1">
                {part}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ===== Suggested prompts (when empty) ===== */}
      {!hasMessages && (
        <div className="flex flex-col items-center justify-center flex-1 p-8 gap-4">
          <span className="font-display text-lg font-bold text-text-primary">
            Get started
          </span>
          <div className="flex flex-wrap gap-2 justify-center max-w-[600px]">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                className="px-4 py-2 bg-elevated border border-border rounded-full text-sm text-text-secondary hover:text-accent hover:border-accent cursor-pointer transition"
                onClick={() => handleSend(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>
          {!isAuthenticated && (
            <button
              type="button"
              onClick={() => openAuthModal('login')}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary"
            >
              Sign in for {authenticatedLimit} daily prompts
            </button>
          )}
        </div>
      )}

      {/* ===== Message area ===== */}
      {hasMessages && (
        <div
          className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col min-h-0"
        >
          {messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            const isAssistant = msg.role === 'assistant';
            const isStreamingAssistant =
              isAssistant && idx === messages.length - 1 && isStreaming;

            return (
              <div
                key={idx}
                className={`flex w-full ${
                  isUser ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={
                  isUser
                      ? 'bg-accent-muted rounded-2xl px-4 py-2 ml-auto max-w-[80%] text-text-primary'
                      : 'bg-elevated rounded-2xl px-4 py-3 mr-auto max-w-[80%] text-text-primary'
                  }
                >
                  {isUser ? (
                    msg.content
                  ) : (
                    <div className="leading-relaxed">
                      {msg.content ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: MarkdownParagraph }}>
                          {msg.content}
                        </ReactMarkdown>
                      ) : isStreamingAssistant ? (
                        <span className="text-text-tertiary">Thinking...</span>
                      ) : (
                        <span className="text-text-tertiary">No response returned.</span>
                      )}
                      {isStreamingAssistant && msg.content && (
                        <span className="inline-block w-0.5 h-4 bg-accent ml-1 animate-[blink_1s_infinite]" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Inline error */}
          {error && (
            <div className={
              error.includes('limit')
                ? 'bg-[#F59E0B]/10 text-[#F59E0B] rounded-lg p-4 text-center text-sm'
                : 'bg-error/10 text-error rounded-lg p-3 text-sm'
            }>
              <div className="space-y-3">
                <div>{error}</div>
                {shouldShowUpgradePrompt && (
                  <button
                    type="button"
                    onClick={() => openAuthModal('login')}
                    className="rounded-full border border-[rgba(245,158,11,0.35)] px-4 py-2 text-sm font-medium text-[#FBBF24] transition-colors hover:border-[#FBBF24] hover:text-[#FDE68A]"
                  >
                    Sign in for {authenticatedLimit} daily prompts
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={messageEndRef} />
        </div>
      )}

      {/* ===== Input bar ===== */}
      <div className="p-4 border-t border-border flex gap-2">
        <input
          type="text"
          placeholder="Ask a question..."
          value={input}
          onChange={(e) => {
            if (e.target.value.length <= 1000) {
              setInput(e.target.value);
            }
          }}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
          className={`flex-1 bg-elevated border border-border rounded-lg px-4 py-2 text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none${
            isStreaming ? ' opacity-50' : ''
          }`}
        />
        <button
          onClick={() => handleSend(input)}
          disabled={!canSend}
          className="bg-accent hover:bg-accent-hover text-text-inverse px-4 py-2 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default AITab;
