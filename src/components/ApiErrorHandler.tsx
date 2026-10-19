import { AlertCircle } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { canUseApiDebug, initializeApiDebug, setApiDebugEnabled } from '../utils/apiDebug';
import { getForbiddenErrorPresentation } from '../utils/apiErrorPresentation';
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
      {error && <div className={error.isPacketAccessError ? 'fixed inset-0 z-[10000] flex items-center justify-center p-4' : 'fixed bottom-4 right-4 z-[10010] w-[calc(100%_-_2rem)] max-w-sm'}>
        {error.isPacketAccessError && <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />}
        <section role={error.isPacketAccessError ? 'alertdialog' : 'alert'} aria-modal={error.isPacketAccessError || undefined} aria-label={error.title || 'Connection and loading feedback'} className={error.isPacketAccessError ? 'relative z-[10001] w-full max-w-md rounded-xl bg-white p-6 shadow-2xl' : 'rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 shadow-lg'}>
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
            <div className="min-w-0 flex-1">
              {error.title && <h2 className="font-semibold text-slate-900">{error.title}</h2>}
              <p className={error.isPacketAccessError ? 'mt-1 text-sm text-slate-600' : 'text-sm'}>{error.message}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {error.isPacketAccessError ? <button onClick={logout} className="min-h-10 rounded-lg bg-slate-700 px-4 text-sm font-semibold text-white hover:bg-slate-900">Sign out</button> : <>
              {error.isNetworkError && <button onClick={handleRetry} className="min-h-9 rounded-lg border border-red-300 bg-white px-3 text-sm font-semibold text-red-700 hover:bg-red-100">Check connection{retryCount > 0 ? ` (${retryCount})` : ''}</button>}
              <button onClick={clearError} className="min-h-9 rounded-lg border border-red-300 bg-white px-3 text-sm font-semibold text-red-700 hover:bg-red-100">Dismiss loading message</button>
            </>}
            {debugAllowed && <button onClick={() => { const enabled = setApiDebugEnabled(!debugEnabled, user); setDebugEnabled(enabled); }} className={`min-h-9 rounded-lg border px-3 text-sm font-semibold hover:bg-black/5 ${error.isPacketAccessError ? 'border-slate-300 text-slate-700' : 'border-red-300 text-red-700'}`}>API debug: {debugEnabled ? 'on' : 'off'}</button>}
          </div>
          {debugEnabled && <details className={`mt-3 text-xs ${error.isPacketAccessError ? 'text-slate-500' : 'text-red-700'}`}><summary>Request details</summary><p>{error.method} {error.url} · {error.code}</p></details>}
        </section>
      </div>}
    </ApiErrorContext.Provider>
  );
};

export default ApiErrorHandler;
