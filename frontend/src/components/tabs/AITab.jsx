import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { sendChatMessage } from '../../utils/api';

/* ────────────────────────────────────────────
   Suggested Prompts
   ──────────────────────────────────────────── */

const SUGGESTED_PROMPTS = [
  'Why did revenue change in 2020?',
  'Is this stock overvalued?',
  'Summarize key financial trends',
  'Compare margins to sector average',
];

/* ────────────────────────────────────────────
   AITab Component
   ──────────────────────────────────────────── */

function AITab({ ticker, company }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState('');
  const [queryCount, setQueryCount] = useState(0);

  const messageEndRef = useRef(null);
  const messageAreaRef = useRef(null);

  /* Auto-scroll to bottom on new messages / streaming updates */
  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  /* ---- Send handler ---- */
  async function handleSend(messageText) {
    const text = (messageText || '').trim();
    if (!text || isStreaming) return;

    setError('');
    setInput('');
    setQueryCount((prev) => prev + 1);

    /* Append user message and an empty AI placeholder */
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: text },
      { role: 'ai', content: '' },
    ]);

    setIsStreaming(true);

    try {
      const stream = sendChatMessage(ticker, text);
      for await (const chunk of stream) {
        setMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          updated[lastIdx] = {
            ...updated[lastIdx],
            content: updated[lastIdx].content + chunk,
          };
          return updated;
        });
      }
    } catch (err) {
      if (err.message && err.message.includes('429')) {
        setError(
          `You've used ${queryCount}/50 queries today. Daily limit reached. Sign in for more.`
        );
      } else {
        setError('Something went wrong. Please try again.');
      }
      /* Remove the empty AI placeholder if nothing was streamed */
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'ai' && last.content === '') {
          return prev.slice(0, -1);
        }
        return prev;
      });
    }

    setIsStreaming(false);
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

  return (
    <div className="flex flex-col h-[600px] bg-surface border border-border rounded-lg overflow-hidden">
      {/* ===== Header ===== */}
      <div className="px-4 py-3 border-b border-border flex justify-between items-center">
        <span className="font-display text-lg font-semibold text-text-primary">
          Ask about {companyName}'s financials
        </span>
        <span className="text-xs font-data text-text-tertiary bg-elevated px-2 py-1 rounded-full">
          {queryCount} / 50 queries today
        </span>
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
        </div>
      )}

      {/* ===== Message area ===== */}
      {hasMessages && (
        <div
          className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col min-h-0"
          ref={messageAreaRef}
        >
          {messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            const isLastAI =
              msg.role === 'ai' && idx === messages.length - 1 && isStreaming;

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
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                      {isLastAI && (
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
              {error}
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
