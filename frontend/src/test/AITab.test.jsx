import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AITab from '../components/tabs/AITab';

const useAuthMock = vi.fn();
const sendChatMessageMock = vi.fn();

vi.mock('../components/auth/useAuth', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../utils/api', async () => {
  const actual = await vi.importActual('../utils/api');
  return {
    ...actual,
    sendChatMessage: (...args) => sendChatMessageMock(...args),
  };
});

function renderTab(props = {}) {
  return render(
    <AITab
      ticker="AAPL"
      company={{ name: 'Apple Inc.' }}
      {...props}
    />,
  );
}

function setupAuth({
  isAuthenticated = false,
  anonymousDaily = 10,
  authenticatedDaily = 50,
  currentDaily = 10,
} = {}) {
  const openAuthModal = vi.fn();

  useAuthMock.mockReturnValue({
    isAuthenticated,
    limits: {
      anonymous_daily: anonymousDaily,
      authenticated_daily: authenticatedDaily,
      current_daily: currentDaily,
    },
    openAuthModal,
  });

  return { openAuthModal };
}

async function submitPrompt(prompt) {
  const input = screen.getByPlaceholderText(/ask a question/i);
  fireEvent.change(input, { target: { value: prompt } });
  fireEvent.click(screen.getByRole('button', { name: /^send$/i }));
}

describe('AITab', () => {
  beforeEach(() => {
    sendChatMessageMock.mockReset();
    useAuthMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('sends bounded history and surfaces stream meta context', async () => {
    setupAuth({ isAuthenticated: true, currentDaily: 50, authenticatedDaily: 50 });

    sendChatMessageMock.mockImplementation(async function* (_ticker, message, history) {
      yield {
        type: 'meta',
        company_name: 'Apple Inc.',
        quote_freshness: 'Quote updated 5m ago',
        coverage_summary: 'Coverage: 10 annual, 8 quarterly',
        remainingQuota: 41,
        history,
      };
      yield { type: 'text', content: `Answer: ${message}.` };
      yield { type: 'done', remainingQuota: 41 };
    });

    renderTab();

    for (const prompt of [
      'Prompt 1',
      'Prompt 2',
      'Prompt 3',
      'Prompt 4',
      'Prompt 5',
      'Prompt 6',
      'Prompt 7',
    ]) {
      await submitPrompt(prompt);
      await screen.findByText(new RegExp(`Answer: ${prompt}\\.`));
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/ask a question/i)).not.toBeDisabled();
      });
    }

    expect(sendChatMessageMock).toHaveBeenCalledTimes(7);
    const latestCall = sendChatMessageMock.mock.calls.at(-1);
    expect(latestCall[0]).toBe('AAPL');
    expect(latestCall[1]).toBe('Prompt 7');
    expect(latestCall[2]).toHaveLength(12);
    expect(latestCall[2][0]).toEqual({ role: 'user', content: 'Prompt 1' });
    expect(latestCall[2][11]).toEqual({ role: 'assistant', content: 'Answer: Prompt 6.' });

    expect(screen.getByText(/Coverage: 10 annual, 8 quarterly/i)).toBeInTheDocument();
    expect(screen.getByText(/41 left today/i)).toBeInTheDocument();
  });

  it('shows the anonymous upgrade CTA when the quota is exhausted', async () => {
    const { openAuthModal } = setupAuth({ isAuthenticated: false });

    sendChatMessageMock.mockImplementation(async function* () {
      yield {
        type: 'error',
        code: 'quota_exhausted',
        message: 'Daily limit reached',
        remainingQuota: 0,
      };
    });

    renderTab();

    await submitPrompt('Is this stock overvalued?');

    await screen.findByText(/daily limit reached/i);
    const upgradeButton = screen.getByRole('button', { name: /sign in for 50 daily prompts/i });
    fireEvent.click(upgradeButton);

    expect(openAuthModal).toHaveBeenCalledWith('login');
  });
});
