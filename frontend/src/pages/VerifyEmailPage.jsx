import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../components/auth/useAuth';
import { confirmEmailVerification, resendEmailVerification } from '../utils/api';

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

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { openAuthModal } = useAuth();
  const confirmAttemptedRef = useRef(false);

  const uid = searchParams.get('uid');
  const token = searchParams.get('token');
  const queryEmail = searchParams.get('email') || '';
  const hasVerificationParams = Boolean(uid || token);
  const isConfirmMode = Boolean(uid && token);

  const [email, setEmail] = useState(queryEmail);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(queryEmail ? 'We sent a verification link to your inbox.' : '');
  const [verificationState, setVerificationState] = useState(
    isConfirmMode ? 'pending' : 'idle'
  );

  useEffect(() => {
    setEmail(queryEmail);
  }, [queryEmail]);

  useEffect(() => {
    if (!isConfirmMode || confirmAttemptedRef.current) {
      return;
    }

    confirmAttemptedRef.current = true;
    setIsSubmitting(true);
    setError('');

    confirmEmailVerification({ uid, token })
      .then(() => {
        setVerificationState('success');
      })
      .catch((confirmError) => {
        setVerificationState('error');
        setError(confirmError.message || 'This verification link is invalid or has expired.');
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  }, [isConfirmMode, token, uid]);

  const pageMeta = useMemo(() => {
    if (verificationState === 'pending') {
      return {
        eyebrow: 'Verifying',
        title: 'Confirming your email',
        description: 'We are checking your verification link now.',
      };
    }

    if (verificationState === 'success') {
      return {
        eyebrow: 'Email verified',
        title: 'Your account is ready',
        description: 'You can sign in now with your verified email/password account.',
      };
    }

    if (hasVerificationParams && !isConfirmMode) {
      return {
        eyebrow: 'Verification issue',
        title: 'This link is incomplete',
        description: 'Request a fresh verification email and use the latest link we send.',
      };
    }

    return {
      eyebrow: 'Account security',
      title: 'Verify your email',
      description: 'Open the verification link from your inbox to activate email/password sign-in.',
    };
  }, [hasVerificationParams, isConfirmMode, verificationState]);

  async function handleResend(event) {
    event?.preventDefault?.();
    setIsSubmitting(true);
    setError('');

    try {
      const response = await resendEmailVerification({ email: email.trim() });
      setNotice(response.message || 'If an account exists for that email, we sent a verification link.');
    } catch (resendError) {
      setError(resendError.message || 'Verification email is unavailable right now. Try again shortly.');
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

          {verificationState === 'pending' ? (
            <div className="space-y-4">
              <InlineNotice>One moment while we validate your link.</InlineNotice>
              <div className="skeleton h-11 w-full rounded-full" />
            </div>
          ) : verificationState === 'success' ? (
            <div className="space-y-4">
              <InlineNotice tone="success">
                Your email has been verified successfully.
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
          ) : hasVerificationParams && !isConfirmMode ? (
            <div className="space-y-4">
              <InlineNotice tone="error">
                The verification link is missing part of the information needed to confirm it.
              </InlineNotice>
              <button
                type="button"
                onClick={() => navigate('/verify-email')}
                className="min-h-11 rounded-full bg-accent px-4 py-3 text-sm font-semibold text-text-inverse transition-colors hover:bg-accent-hover"
              >
                Request a new link
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {email ? (
                <>
                  <InlineNotice>
                    We’re waiting on a click from the inbox for <strong>{email}</strong>.
                  </InlineNotice>
                  {notice && <InlineNotice tone="success">{notice}</InlineNotice>}
                  {error && <InlineNotice tone="error">{error}</InlineNotice>}
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleResend}
                      className="min-h-11 rounded-full border border-border px-4 py-3 text-sm font-medium text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Resend verification email
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenSignin}
                      className="min-h-11 rounded-full bg-accent px-4 py-3 text-sm font-semibold text-text-inverse transition-colors hover:bg-accent-hover"
                    >
                      Back to sign in
                    </button>
                  </div>
                </>
              ) : (
                <form className="space-y-4" onSubmit={handleResend}>
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

                  {notice && <InlineNotice tone="success">{notice}</InlineNotice>}
                  {error && <InlineNotice tone="error">{error}</InlineNotice>}

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="min-h-11 rounded-full bg-accent px-4 py-3 text-sm font-semibold text-text-inverse transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Send verification link
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
          )}
        </div>
      </PageCard>
    </section>
  );
}
