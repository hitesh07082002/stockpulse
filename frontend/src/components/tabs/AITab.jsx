import React, { useEffect, useRef } from 'react';
import { useAuth } from '../auth/useAuth';
import { CopilotMarkdown } from './ai/CopilotMarkdown';
import { useCopilotChat } from './ai/useCopilotChat';

const SUGGESTED_PROMPTS = [
  'Why did revenue change in 2020?',
  'Is this stock overvalued?',
  'Summarize key financial trends',
  'Compare margins to sector average',
];

function AITab({ ticker, company }) {
  const {
    isAuthenticated,
    limits,
    openAuthModal,
  } = useAuth();
  const {
    error,
    errorCode,
    errorStatus,
    handleKeyDown,
    handleSend,
    input,
    isStreaming,
    messages,
    remainingQuota,
    setInput,
    streamMeta,
  } = useCopilotChat({ ticker });

  const messageEndRef = useRef(null);

  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const hasMessages = messages.length > 0;
  const canSend = input.trim().length > 0 && !isStreaming;
  const companyName = (company && company.name) || ticker;
  const anonymousLimit = limits?.anonymous_daily || 10;
  const authenticatedLimit = limits?.authenticated_daily || 50;
  const currentLimit = isAuthenticated ? authenticatedLimit : anonymousLimit;
  const quotaLabel = remainingQuota !== null ? `${remainingQuota} left today` : null;
  const shouldShowUpgradePrompt = !isAuthenticated && (
    errorStatus === 429 || /limit|quota/i.test(`${errorCode} ${error}`)
  );
  const metaSummaryParts = [
    streamMeta?.company_name,
    streamMeta?.quote_freshness,
    streamMeta?.coverage_summary,
  ].filter(Boolean);

  return (
    <div className="flex h-[600px] flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex flex-col gap-2 border-b border-border px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <span className="font-display text-lg font-semibold text-text-primary">
            Ask about {companyName}&apos;s financials
          </span>
          <span className="whitespace-nowrap rounded-full bg-elevated px-2 py-1 text-xs font-data text-text-tertiary">
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

      {!hasMessages && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
          <span className="font-display text-lg font-bold text-text-primary">
            Get started
          </span>
          <div className="flex max-w-[600px] flex-wrap justify-center gap-2">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                className="cursor-pointer rounded-full border border-border bg-elevated px-4 py-2 text-sm text-text-secondary transition hover:border-accent hover:text-accent"
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

      {hasMessages && (
        <div className="flex min-h-0 flex-1 flex-col space-y-4 overflow-y-auto p-4">
          {messages.map((message, index) => {
            const isUser = message.role === 'user';
            const isAssistant = message.role === 'assistant';
            const isStreamingAssistant = isAssistant && index === messages.length - 1 && isStreaming;

            if (isAssistant && !message.content && !isStreamingAssistant) {
              return null;
            }

            return (
              <div
                key={message.id}
                className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={isUser
                    ? 'ml-auto max-w-[80%] rounded-2xl bg-accent-muted px-4 py-2 text-text-primary'
                    : 'mr-auto max-w-[80%] rounded-2xl bg-elevated px-4 py-3 text-text-primary'}
                >
                  {isUser ? (
                    message.content
                  ) : (
                    <div className="leading-relaxed">
                      {message.content ? (
                        <CopilotMarkdown content={message.content} />
                      ) : isStreamingAssistant ? (
                        <span className="text-text-tertiary">Thinking...</span>
                      ) : null}
                      {isStreamingAssistant && message.content && (
                        <span className="ml-1 inline-block h-4 w-0.5 animate-[blink_1s_infinite] bg-accent" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {error && (
            <div className={error.includes('limit')
              ? 'rounded-lg bg-[#F59E0B]/10 p-4 text-center text-sm text-[#F59E0B]'
              : 'rounded-lg bg-error/10 p-3 text-sm text-error'}
            >
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

          <div ref={messageEndRef} />
        </div>
      )}

      <div className="flex gap-2 border-t border-border p-4">
        <input
          type="text"
          placeholder="Ask a question..."
          value={input}
          onChange={(event) => {
            if (event.target.value.length <= 1000) {
              setInput(event.target.value);
            }
          }}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
          className={`flex-1 rounded-lg border border-border bg-elevated px-4 py-2 text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none${
            isStreaming ? ' opacity-50' : ''
          }`}
        />
        <button
          onClick={() => handleSend(input)}
          disabled={!canSend}
          className="rounded-lg bg-accent px-4 py-2 font-medium text-text-inverse transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default AITab;
