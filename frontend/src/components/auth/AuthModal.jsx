import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './useAuth';

function AuthNotice({ children }) {
  if (!children) {
    return null;
  }

  return (
    <div className="rounded-lg border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.08)] px-3 py-2 text-sm text-[#FBBF24]">
      {children}
    </div>
  );
}

function AuthModalCard({
  authError,
  authMode,
  closeAuthModal,
  googleSigninAvailable,
  isSubmitting,
  login,
  openAuthModal,
  openPasswordReset,
  register,
  setAuthMode,
  startGoogle,
}) {
  const [formValues, setFormValues] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [showEmailForm, setShowEmailForm] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    const payload = {
      email: formValues.email.trim(),
      password: formValues.password,
    };

    if (authMode === 'register') {
      await register({
        ...payload,
        name: formValues.name.trim(),
      });
      return;
    }

    await login(payload);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="w-full max-w-[460px] rounded-2xl border border-border bg-surface shadow-[0_24px_80px_rgba(3,7,18,0.45)]"
    >
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div className="space-y-1">
          <p id="auth-modal-title" className="font-display text-2xl text-text-primary">
            {authMode === 'register' ? 'Create your account' : 'Sign in to StockPulse'}
          </p>
          <p className="font-body text-sm text-text-secondary">
            Browsing stays open. Sign in raises your AI allowance and unlocks future account features.
          </p>
        </div>
        <button
          type="button"
          onClick={closeAuthModal}
          className="rounded-full border border-border px-2.5 py-1 text-sm text-text-tertiary transition-colors hover:border-border-hover hover:text-text-primary"
          aria-label="Close auth modal"
        >
          Close
        </button>
      </div>

      <div className="space-y-4 px-5 py-5">
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-elevated p-1">
          <button
            type="button"
            onClick={() => setAuthMode('login')}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              authMode === 'login'
                ? 'bg-surface text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setAuthMode('register')}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              authMode === 'register'
                ? 'bg-surface text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Create account
          </button>
        </div>

        <button
          type="button"
          onClick={startGoogle}
          disabled={!googleSigninAvailable || isSubmitting}
          className="flex w-full items-center justify-center gap-3 rounded-full bg-accent px-4 py-3 text-sm font-semibold text-text-inverse transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(3,7,18,0.18)] text-[11px] font-bold">
            G
          </span>
          Continue with Google
        </button>

        {!googleSigninAvailable && (
          <AuthNotice>
            Google sign-in is not configured for this environment yet. Use email/password for now.
          </AuthNotice>
        )}

        {!showEmailForm ? (
          <button
            type="button"
            onClick={() => setShowEmailForm(true)}
            className="w-full rounded-full border border-border px-4 py-3 text-sm font-medium text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary"
          >
            Use email instead
          </button>
        ) : (
          <form className="space-y-4 rounded-2xl border border-border bg-base/60 p-4" onSubmit={handleSubmit}>
            {authMode === 'register' && (
              <label className="block space-y-2">
                <span className="font-body text-sm text-text-secondary">Name</span>
                <input
                  type="text"
                  value={formValues.name}
                  onChange={(event) => setFormValues((current) => ({ ...current, name: event.target.value }))}
                  autoComplete="name"
                  className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-text-primary outline-none transition-colors focus:border-accent"
                  placeholder="Your name"
                />
              </label>
            )}

            <label className="block space-y-2">
              <span className="font-body text-sm text-text-secondary">Email</span>
                <input
                  type="email"
                  value={formValues.email}
                  onChange={(event) => setFormValues((current) => ({ ...current, email: event.target.value }))}
                  autoComplete="email"
                  className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-text-primary outline-none transition-colors focus:border-accent"
                  placeholder="you@example.com"
                  required
              />
            </label>

            <label className="block space-y-2">
              <span className="font-body text-sm text-text-secondary">Password</span>
                <input
                  type="password"
                  value={formValues.password}
                  onChange={(event) => setFormValues((current) => ({ ...current, password: event.target.value }))}
                  autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                  className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-text-primary outline-none transition-colors focus:border-accent"
                  placeholder="At least 8 characters"
                  required
                />
            </label>

            {authMode === 'login' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={openPasswordReset}
                  className="text-sm text-accent transition-colors hover:text-accent-hover"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {authError && (
              <AuthNotice>{authError}</AuthNotice>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 rounded-full bg-accent px-4 py-3 text-sm font-semibold text-text-inverse transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {authMode === 'register' ? 'Create account' : 'Sign in with email'}
              </button>
              <button
                type="button"
                onClick={() => setShowEmailForm(false)}
                className="rounded-full border border-border px-4 py-3 text-sm font-medium text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary"
              >
                Back
              </button>
            </div>
          </form>
        )}

        <div className="flex items-center justify-between gap-4 text-xs text-text-tertiary">
          <span>Google is the primary path in V1.</span>
          <button
            type="button"
            onClick={() => openAuthModal(authMode === 'login' ? 'register' : 'login')}
            className="text-accent transition-colors hover:text-accent-hover"
          >
            {authMode === 'login' ? 'Need an account?' : 'Already have an account?'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AuthModal() {
  const navigate = useNavigate();
  const {
    authMode,
    authError,
    closeAuthModal,
    googleSigninAvailable,
    isAuthModalOpen,
    isSubmitting,
    login,
    openAuthModal,
    register,
    setAuthMode,
    startGoogle,
  } = useAuth();

  function handleOpenPasswordReset() {
    closeAuthModal();
    navigate('/reset-password');
  }

  if (!isAuthModalOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(3,7,18,0.72)] px-4 py-8 backdrop-blur-sm">
      <AuthModalCard
        key={`${authMode}-${isAuthModalOpen ? 'open' : 'closed'}`}
        authError={authError}
        authMode={authMode}
        closeAuthModal={closeAuthModal}
        googleSigninAvailable={googleSigninAvailable}
        isSubmitting={isSubmitting}
        login={login}
        openAuthModal={openAuthModal}
        openPasswordReset={handleOpenPasswordReset}
        register={register}
        setAuthMode={setAuthMode}
        startGoogle={startGoogle}
      />
    </div>
  );
}
