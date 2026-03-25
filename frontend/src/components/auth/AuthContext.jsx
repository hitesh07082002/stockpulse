import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  fetchAuthSession,
  loginAuth,
  logoutAuth,
  refreshAuth,
  registerAuth,
  startGoogleAuth,
} from '../../utils/api';
import { AuthContext } from './auth-context';

const FALLBACK_SESSION = {
  is_authenticated: false,
  user: null,
  limits: {
    anonymous_daily: 10,
    authenticated_daily: 50,
    current_daily: 10,
  },
  google_signin_available: true,
  has_refresh_session: false,
};

function clearAuthParams(navigate, location) {
  const searchParams = new URLSearchParams(location.search);
  if (!searchParams.has('auth') && !searchParams.has('auth_message')) {
    return;
  }

  searchParams.delete('auth');
  searchParams.delete('auth_message');
  const search = searchParams.toString();
  navigate(
    {
      pathname: location.pathname,
      search: search ? `?${search}` : '',
    },
    { replace: true },
  );
}

export function AuthProvider({ children }) {
  const location = useLocation();
  const navigate = useNavigate();

  const [session, setSession] = useState(FALLBACK_SESSION);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState(null);

  const hydrateSession = useCallback(async ({ allowRefresh = true } = {}) => {
    const liveSession = await fetchAuthSession();
    if (!liveSession.is_authenticated && liveSession.has_refresh_session && allowRefresh) {
      try {
        const refreshedSession = await refreshAuth();
        setSession(refreshedSession);
        return refreshedSession;
      } catch {
        setSession(liveSession);
        return liveSession;
      }
    }

    setSession(liveSession);
    return liveSession;
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function bootstrapAuth() {
      try {
        const liveSession = await hydrateSession({ allowRefresh: true });
        if (!isMounted) {
          return;
        }
        setSession(liveSession);
      } catch {
        if (isMounted) {
          setSession(FALLBACK_SESSION);
        }
      } finally {
        if (isMounted) {
          setIsBootstrapping(false);
        }
      }
    }

    bootstrapAuth();

    return () => {
      isMounted = false;
    };
  }, [hydrateSession]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const authStatus = params.get('auth');
    const authMessage = params.get('auth_message');

    if (!authStatus) {
      return;
    }

    if (authStatus === 'google-success') {
      setAuthNotice({
        tone: 'success',
        message: 'Signed in with Google.',
      });
      hydrateSession({ allowRefresh: false }).catch(() => {});
    }

    if (authStatus === 'google-error') {
      setAuthError(authMessage || 'Sign-in failed. Try again or use email/password.');
      setAuthMode('login');
      setIsAuthModalOpen(true);
      setAuthNotice({
        tone: 'error',
        message: authMessage || 'Sign-in failed. Try again or use email/password.',
      });
    }

    clearAuthParams(navigate, location);
  }, [hydrateSession, location, navigate]);

  const handleLogin = useCallback(async (payload) => {
    setIsSubmitting(true);
    setAuthError('');

    try {
      const liveSession = await loginAuth(payload);
      setSession(liveSession);
      setIsAuthModalOpen(false);
      return liveSession;
    } catch (error) {
      if (error?.payload?.code === 'email_verification_required') {
        const email = error?.payload?.email || payload.email.trim();
        setIsAuthModalOpen(false);
        setAuthNotice({
          tone: 'neutral',
          message: error.message || 'Verify your email before signing in.',
        });
        navigate(`/verify-email?email=${encodeURIComponent(email)}`);
        return null;
      }
      setAuthError(error.message || 'Sign-in failed. Try again or use email/password.');
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [navigate]);

  const handleRegister = useCallback(async (payload) => {
    setIsSubmitting(true);
    setAuthError('');

    try {
      const registration = await registerAuth(payload);
      setIsAuthModalOpen(false);
      setAuthNotice({
        tone: 'success',
        message: registration.message || 'Check your inbox to verify your email.',
      });
      navigate(`/verify-email?email=${encodeURIComponent(registration.email || payload.email.trim())}`);
      return registration;
    } catch (error) {
      if (error?.payload?.code === 'verification_delivery_failed' && error?.payload?.email) {
        setIsAuthModalOpen(false);
        setAuthNotice({
          tone: 'error',
          message: error.message || 'We could not send your verification email yet.',
        });
        navigate(`/verify-email?email=${encodeURIComponent(error.payload.email)}`);
        return null;
      }
      setAuthError(error.message || 'Registration failed. Try again.');
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [navigate]);

  const handleLogout = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await logoutAuth();
      setSession(FALLBACK_SESSION);
      setAuthNotice({
        tone: 'neutral',
        message: 'Signed out.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const openAuthModal = useCallback((mode = 'login') => {
    setAuthMode(mode);
    setAuthError('');
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthError('');
    setIsAuthModalOpen(false);
  }, []);

  const beginGoogleAuth = useCallback(() => {
    setAuthError('');
    startGoogleAuth(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);

  const value = useMemo(() => ({
    session,
    user: session.user,
    limits: session.limits,
    isAuthenticated: session.is_authenticated,
    isBootstrapping,
    isSubmitting,
    isAuthModalOpen,
    authMode,
    authError,
    authNotice,
    googleSigninAvailable: session.google_signin_available,
    setAuthMode,
    setAuthNotice,
    openAuthModal,
    closeAuthModal,
    login: handleLogin,
    register: handleRegister,
    logout: handleLogout,
    startGoogle: beginGoogleAuth,
    refreshSession: hydrateSession,
  }), [
    authError,
    authMode,
    authNotice,
    beginGoogleAuth,
    closeAuthModal,
    handleLogin,
    handleLogout,
    handleRegister,
    hydrateSession,
    isAuthModalOpen,
    isBootstrapping,
    isSubmitting,
    openAuthModal,
    session,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
