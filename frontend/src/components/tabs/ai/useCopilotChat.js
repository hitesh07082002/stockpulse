import { useRef, useState } from 'react';
import {
  normalizeCopilotHistory,
  sendChatMessage,
} from '../../../utils/api';

const CONTINUE_PROMPT = 'Continue from exactly where you stopped. Do not repeat earlier points.';

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

export function useCopilotChat({ ticker }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [errorStatus, setErrorStatus] = useState(null);
  const [streamMeta, setStreamMeta] = useState(null);
  const [remainingQuota, setRemainingQuota] = useState(null);
  const [canContinue, setCanContinue] = useState(false);

  const messageIdRef = useRef(0);

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

  function settleAssistantMessage() {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.role !== 'assistant') {
        return prev;
      }

      if (!last.content) {
        return prev.slice(0, -1);
      }

      const updated = [...prev];
      updated[updated.length - 1] = {
        ...last,
        status: 'complete',
      };
      return updated;
    });
  }

  function startAssistantMessage({ userText = null, resumeLastAssistant = false }) {
    setMessages((prev) => {
      if (resumeLastAssistant) {
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        const lastMessage = updated[lastIndex];
        if (lastMessage?.role === 'assistant') {
          updated[lastIndex] = {
            ...lastMessage,
            status: 'streaming',
          };
          return updated;
        }

        return [...prev, createMessage('assistant', '', 'streaming')];
      }

      return [
        ...prev,
        createMessage('user', userText),
        createMessage('assistant', '', 'streaming'),
      ];
    });
  }

  function buildConversationHistory() {
    return normalizeCopilotHistory(messages);
  }

  async function streamAssistantReply(messageText, { showUserMessage = true } = {}) {
    const text = (messageText || '').trim();
    if (!text || isStreaming) return;

    setError('');
    setErrorCode('');
    setErrorStatus(null);
    setCanContinue(false);
    if (showUserMessage) {
      setStreamMeta(null);
      setInput('');
    }

    const history = buildConversationHistory();

    startAssistantMessage({
      userText: text,
      resumeLastAssistant: !showUserMessage,
    });

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
          setCanContinue(Boolean(event.canContinue));
          settleAssistantMessage();
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
          setCanContinue(Boolean(event.canContinue));
          settleAssistantMessage();
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
      setCanContinue(false);
      settleAssistantMessage();
    } finally {
      setIsStreaming(false);
    }
  }

  async function handleSend(messageText) {
    await streamAssistantReply(messageText, { showUserMessage: true });
  }

  async function handleContinue() {
    await streamAssistantReply(CONTINUE_PROMPT, { showUserMessage: false });
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend(input);
    }
  }

  return {
    error,
    errorCode,
    errorStatus,
    handleKeyDown,
    handleSend,
    handleContinue,
    input,
    isStreaming,
    messages,
    remainingQuota,
    setInput,
    streamMeta,
    canContinue,
  };
}
