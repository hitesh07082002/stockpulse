import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../components/auth/useAuth';
import { confirmPasswordReset, requestPasswordReset } from '../utils/api';

function PageCard({ children }) {
  return (
    <div className="w-full max-w-[520px] rounded-2xl border border-border bg-surface shadow-[0_24px_80px_rgba(3,7,18,0.32)]">
      {children}
    </div>
  );
}

function InlineNotice({ tone = 'neutral', children }) {
  const toneClasses = tone === 'error'
    ? 'border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.08)] text-[rgb(248,113,113)]'
    : tone === 'success'
      ? 'border-[rgba(16,185,129,0.35)] bg-[rgba(16,185,129,0.08)] text-[rgb(110,231,183)]'
      : 'border-border bg-elevated text-text-secondary';

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${toneClasses}`}>
      {children}
    </div>
  );
}

export default function PasswordResetPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { openAuthModal } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successState, setSuccessState] = useState(null);

  const uid = searchParams.get('uid');
  const token = searchParams.get('token');
  const hasResetParams = Boolean(uid || token);
  const isConfirmMode = Boolean(uid && token);

  const pageMeta = useMemo(() => {
    if (successState === 'request') {
      return {
        eyebrow: 'Email sent',
        title: 'Check your inbox',
        description: 'If the address matches an account, a reset link is on its way. The link expires quickly for safety.',
      };
    }

    if (successState === 'confirm') {
      return {
        eyebrow: 'Password updated',
        title: 'You can sign in now',
        description: 'Your password has been changed. Use your new password the next time you sign in.',
      };
    }

    if (hasResetParams && !isConfirmMode) {
      return {
        eyebrow: 'Reset link issue',
        title: 'This link is incomplete',
        description: 'Request a fresh reset email and use the latest link we send you.',
      };
    }

    if (isConfirmMode) {
      return {
        eyebrow: 'Secure reset',
        title: 'Choose a new password',
        description: 'Pick a strong password you have not used elsewhere. This reset link works once and expires automatically.',
      };
    }

    return {
      eyebrow: 'Account recovery',
      title: 'Reset your password',
      description: 'Enter the email tied to your StockPulse account and we will send a secure reset link.',
    };
  }, [hasResetParams, isConfirmMode, successState]);

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      if (isConfirmMode) {
        if (password !== passwordConfirmation) {
          throw new Error('Passwords do not match.');
        }

        await confirmPasswordReset({
          uid,
          token,
          password,
        });
        setSuccessState('confirm');
        return;
      }

      await requestPasswordReset({ email: email.trim() });
      setSuccessState('request');
    } catch (requestError) {
      setError(requestError.message || 'Password reset is unavailable right now. Try again shortly.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleOpenSignin() {
    navigate('/');
    openAuthModal('login');
  }

  return (
    <section className="mx-auto flex min-h-[var(--shell-content-min-height)] w-full max-w-[1280px] items-center justify-center py-8 sm:py-12">
      <PageCard>
        <div className="space-y-6 px-6 py-7 sm:px-8 sm:py-8">
          <div className="space-y-3">
            <p className="font-data text-xs uppercase tracking-[0.18em] text-accent">
              {pageMeta.eyebrow}
            </p>
            <div className="space-y-2">
              <h1 className="font-display text-3xl text-text-primary sm:text-4xl">
                {pageMeta.title}
              </h1>
              <p className="max-w-[44ch] font-body text-sm leading-6 text-text-secondary sm:text-base">
                {pageMeta.description}
              </p>
            </div>
          </div>

          {successState === 'request' ? (
            <div className="space-y-4">
              <InlineNotice tone="success">
                If the email is on file, the reset link has been sent from StockPulse.
              </InlineNotice>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    setSuccessState(null);
                    setEmail('');
                  }}
                  className="min-h-11 rounded-full border border-border px-4 py-3 text-sm font-medium text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary"
                >
                  Send another link
                </button>
                <button
                  type="button"
                  onClick={handleOpenSignin}
                  className="min-h-11 rounded-full bg-accent px-4 py-3 text-sm font-semibold text-text-inverse transition-colors hover:bg-accent-hover"
                >
                  Back to sign in
                </button>
              </div>
            </div>
          ) : successState === 'confirm' ? (
            <div className="space-y-4">
              <InlineNotice tone="success">
                Your password was updated successfully.
              </InlineNotice>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleOpenSignin}
                  className="min-h-11 rounded-full bg-accent px-4 py-3 text-sm font-semibold text-text-inverse transition-colors hover:bg-accent-hover"
                >
                  Sign in
                </button>
                <Link
                  to="/"
                  className="flex min-h-11 items-center justify-center rounded-full border border-border px-4 py-3 text-sm font-medium text-text-secondary no-underline transition-colors hover:border-border-hover hover:text-text-primary"
                >
                  Back to home
                </Link>
              </div>
            </div>
          ) : hasResetParams && !isConfirmMode ? (
            <div className="space-y-4">
              <InlineNotice tone="error">
                The reset link is missing part of the information needed to verify it.
              </InlineNotice>
              <button
                type="button"
                onClick={() => navigate('/reset-password')}
                className="min-h-11 rounded-full bg-accent px-4 py-3 text-sm font-semibold text-text-inverse transition-colors hover:bg-accent-hover"
              >
                Request a new link
              </button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              {isConfirmMode ? (
                <>
                  <label className="block space-y-2">
                    <span className="font-body text-sm text-text-secondary">New password</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-border bg-elevated px-4 py-3 text-text-primary outline-none transition-colors focus:border-accent"
                    placeholder="At least 8 characters"
                    required
                  />
                  </label>
                  <label className="block space-y-2">
                    <span className="font-body text-sm text-text-secondary">Confirm password</span>
                  <input
                    type="password"
                    value={passwordConfirmation}
                    onChange={(event) => setPasswordConfirmation(event.target.value)}
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-border bg-elevated px-4 py-3 text-text-primary outline-none transition-colors focus:border-accent"
                    placeholder="Re-enter your new password"
                    required
                  />
                  </label>
                </>
              ) : (
                <label className="block space-y-2">
                  <span className="font-body text-sm text-text-secondary">Email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    className="w-full rounded-xl border border-border bg-elevated px-4 py-3 text-text-primary outline-none transition-colors focus:border-accent"
                    placeholder="you@example.com"
                    required
                  />
                </label>
              )}

              {error && <InlineNotice tone="error">{error}</InlineNotice>}

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-11 rounded-full bg-accent px-4 py-3 text-sm font-semibold text-text-inverse transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isConfirmMode ? 'Update password' : 'Send reset link'}
                </button>
                <button
                  type="button"
                  onClick={handleOpenSignin}
                  className="min-h-11 rounded-full border border-border px-4 py-3 text-sm font-medium text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary"
                >
                  Back to sign in
                </button>
              </div>
            </form>
          )}
        </div>
      </PageCard>
    </section>
  );
}
