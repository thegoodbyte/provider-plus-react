import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { canUseApiDebug, initializeApiDebug, setApiDebugEnabled } from '../utils/apiDebug';
import { getForbiddenErrorPresentation } from '../utils/apiErrorPresentation';
import './ApiErrorHandler.css';

interface ApiError {
  title?: string;
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
  const { user } = useAuth();
  const [error, setError] = useState<ApiError | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
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

        if (error.response) {
          // Server responded with error
          if (debugEnabled) apiError.code = `${error.response.status}`;
          const responseMessage = error.response.data?.message;

          switch (error.response.status) {
            case 404:
              apiError.message = debugEnabled ? 'Requested resource not found' : 'The requested information is not available.';
              break;
            case 403:
              const forbidden = getForbiddenErrorPresentation(window.location.pathname, responseMessage, debugEnabled);
              apiError.title = forbidden.title;
              apiError.message = forbidden.message;
              break;
            case 500:
              apiError.message = 'Server error occurred. Please try again later.';
              break;
            case 502:
              apiError.message = 'API gateway error. The backend did not return a valid response.';
              break;
            case 503:
              apiError.message = !debugEnabled
                ? 'The service is temporarily unavailable. Please try again shortly.'
                : /storage|s3|configured|configuration|upload/i.test(responseMessage || '')
                ? [
                    'Upload error: storage is misconfigured.',
                    error.response.data?.details?.storageDetails?.errorName
                      ? `Storage error: ${error.response.data.details.storageDetails.errorName}.`
                      : '',
                    'Open the browser console for full diagnostics.',
                  ].filter(Boolean).join(' ')
                : responseMessage || 'Service temporarily unavailable';
              break;
            default:
              apiError.message = debugEnabled ? responseMessage || 'An error occurred while loading data' : 'This action could not be completed. Please try again.';
          }
        } else if (error.request) {
          // No response received
          apiError.isNetworkError = true;
          apiError.message = debugEnabled ? 'The API request failed before the browser received a valid response. This may be a backend deploy, gateway, or CORS issue.' : 'The server could not be reached. Please check your connection and try again.';
          if (debugEnabled) apiError.code = 'NETWORK_ERROR';
        } else {
          // Request setup error
          apiError.message = debugEnabled ? error.message || 'An unexpected error occurred' : 'This action could not be completed. Please try again.';
        }

        // Add request details
        if (debugEnabled && error.config) {
          apiError.url = error.config.url;
          apiError.method = error.config.method?.toUpperCase();
        }

        setShowDetails(false);
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
    setShowDetails(false);
  };

  const handleRetry = async () => {
    setRetryCount(prev => prev + 1);
    clearError();

    // Trigger a simple health check
    try {
      await api.get('/', { suppressGlobalError: true } as any);
    } catch (err) {
      // Error will be caught by interceptor
    }
  };

  const handleGoHome = () => {
    clearError();
    window.location.href = '/';
  };

  if (!error) {
    return (
      <ApiErrorContext.Provider value={{ error, clearError }}>
        {children}
      </ApiErrorContext.Provider>
    );
  }

  return (
    <ApiErrorContext.Provider value={{ error, clearError }}>
      <div className="api-error-overlay">
        <div className="api-error-backdrop" />
        <div className="api-error-modal">
          <div className="api-error-icon">
            🔌
          </div>

          <h2 className="api-error-title">{error.isNetworkError ? 'Connection to server lost' : error.title || 'Request could not be completed'}</h2>

          <p className="api-error-message">{error.message}</p>

          {showDetails && (
            <div className="api-error-expanded">
              <div className="api-error-details">
                <p>
                  <span className="api-error-label">Message:</span>
                  <span>{error.message}</span>
                </p>
                {error.url && <p><span className="api-error-label">Endpoint:</span><code>{error.method} {error.url}</code></p>}
                {error.code && <p><span className="api-error-label">Error Code:</span><code>{error.code}</code></p>}
                <p><span className="api-error-label">Time:</span>{error.timestamp.toLocaleTimeString()}</p>
              </div>
              <div className="api-error-help">
                <p>If this problem persists:</p>
                <ul>
                  <li>Refresh the page to load the latest deployed version</li>
                  <li>Retry after a minute in case the server is restarting</li>
                  <li>Contact support with the endpoint and time shown above</li>
                </ul>
              </div>
            </div>
          )}

          <div className="api-error-actions">
            <button onClick={handleRetry} className="api-error-retry">
              🔄 Retry {retryCount > 0 && `(${retryCount})`}
            </button>
            <button onClick={clearError} className="api-error-dismiss">
              Dismiss
            </button>
          </div>

          {debugEnabled && <button type="button" className="api-error-more" onClick={() => setShowDetails((visible) => !visible)} aria-expanded={showDetails}>
            {showDetails ? 'Hide details' : 'More info'}
          </button>}
          {debugAllowed && <button type="button" className="api-error-more" onClick={() => { const enabled = setApiDebugEnabled(!debugEnabled, user); setDebugEnabled(enabled); setShowDetails(false); }}>
            API debug: {debugEnabled ? 'on' : 'off'}
          </button>}
          {showDetails && <button type="button" onClick={handleGoHome} className="api-error-home-link">Go to home</button>}
        </div>

        <div className="api-error-content">
          {children}
        </div>
      </div>
    </ApiErrorContext.Provider>
  );
};

export default ApiErrorHandler;
