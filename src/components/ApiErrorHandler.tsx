import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { canUseApiDebug, initializeApiDebug, setApiDebugEnabled } from '../utils/apiDebug';
import { getForbiddenErrorPresentation } from '../utils/apiErrorPresentation';
import './ApiErrorHandler.css';
import { apiErrorMessage } from '../utils/apiErrorMessage';

interface ApiError {
  title?: string;
  isPacketAccessError?: boolean;
  message: string;
  isNetworkError?: boolean;
  code?: string;
  timestamp: Date;
  url?: string;
  method?: string;
}

interface ApiErrorHandlerProps {
  children: React.ReactNode;
}

export const ApiErrorContext = React.createContext<{
  error: ApiError | null;
  clearError: () => void;
}>({
  error: null,
  clearError: () => {},
});

const ApiErrorHandler: React.FC<ApiErrorHandlerProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const [error, setError] = useState<ApiError | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const [debugEnabled, setDebugEnabled] = useState(() => initializeApiDebug(user));
  const debugAllowed = canUseApiDebug(user);

  useEffect(() => {
    setDebugEnabled(initializeApiDebug(user));
  }, [user]);

  useEffect(() => {
    // Add response interceptor to catch API errors
    const interceptor = api.interceptors.response.use(
      (response) => response,
      (error) => {
        if ((error.config as any)?.suppressGlobalError) {
          return Promise.reject(error);
        }

        // Don't show error for 401 (handled by auth service)
        if (error.response?.status === 401) {
          return Promise.reject(error);
        }

        const apiError: ApiError = {
          message: 'Error loading data',
          timestamp: new Date(),
        };

        if (error.response?.status === 403) {
          Object.assign(apiError, getForbiddenErrorPresentation(window.location.pathname, undefined, false));
        } else {
          apiError.message = apiErrorMessage(error, 'Could not load this information.');
          apiError.isNetworkError = !error.response && !!error.request;
        }
        if (debugEnabled) apiError.code = String(error.response?.status || 'NETWORK_ERROR');

        // Add request details
        if (debugEnabled && error.config) {
          apiError.url = error.config.url;
          apiError.method = error.config.method?.toUpperCase();
        }


        setError(apiError);
        return Promise.reject(error);
      }
    );

    // Cleanup
    return () => {
      api.interceptors.response.eject(interceptor);
    };
  }, [debugEnabled]);

  const clearError = () => {
    setError(null);
    setRetryCount(0);

  };

  const handleRetry = async () => {
    setRetryCount(prev => prev + 1);

    // Trigger a simple health check
    try {
      await api.get('/', { suppressGlobalError: true } as any);
      clearError();
    } catch (err) {
      setError({ message: 'The server could not be reached. Check your connection.', isNetworkError: true, timestamp: new Date() });
    }
  };

  return (
    <ApiErrorContext.Provider value={{ error, clearError }}>
      {children}
      {error && <div className={error.isPacketAccessError ? 'api-error-overlay' : 'api-feedback-banner'}>
        {error.isPacketAccessError && <div className="api-error-backdrop" />}
        <section role={error.isPacketAccessError ? 'alertdialog' : 'alert'} aria-modal={error.isPacketAccessError || undefined} aria-label={error.title || 'Connection and loading feedback'} className={error.isPacketAccessError ? 'api-error-modal' : 'api-feedback-card'}>
          {error.title && <h2>{error.title}</h2>}
          <p>{error.message}</p>
          <div className="flex flex-wrap gap-3 mt-3">
            {error.isPacketAccessError ? <button onClick={logout}>Sign out</button> : <>
              {error.isNetworkError && <button onClick={handleRetry}>Check connection{retryCount > 0 ? ` (${retryCount})` : ''}</button>}
              <button onClick={clearError}>Dismiss loading message</button>
            </>}
            {debugAllowed && <button onClick={() => { const enabled = setApiDebugEnabled(!debugEnabled, user); setDebugEnabled(enabled); }}>API debug: {debugEnabled ? 'on' : 'off'}</button>}
          </div>
          {debugEnabled && <details><summary>Request details</summary><p>{error.method} {error.url} · {error.code}</p></details>}
        </section>
      </div>}
    </ApiErrorContext.Provider>
  );
};

export default ApiErrorHandler;
