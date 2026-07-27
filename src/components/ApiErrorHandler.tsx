import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import './ApiErrorHandler.css';

interface ApiError {
  message: string;
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
  const [error, setError] = useState<ApiError | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

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
          apiError.code = `${error.response.status}`;
          const responseMessage = error.response.data?.message;

          switch (error.response.status) {
            case 404:
              apiError.message = 'Requested resource not found';
              break;
            case 500:
              apiError.message = 'Server error occurred. Please try again later.';
              break;
            case 502:
              apiError.message = 'API gateway error. The backend did not return a valid response.';
              break;
            case 503:
              apiError.message = /storage|s3|configured|configuration|upload/i.test(responseMessage || '')
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
              apiError.message = responseMessage || 'An error occurred while loading data';
          }
        } else if (error.request) {
          // No response received
          apiError.message = 'The API request failed before the browser received a valid response. This is usually a backend deploy/gateway issue or a CORS-blocked server error.';
          apiError.code = 'NETWORK_ERROR';
        } else {
          // Request setup error
          apiError.message = error.message || 'An unexpected error occurred';
        }

        // Add request details
        if (error.config) {
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
  }, []);

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

          <h2 className="api-error-title">Connection to server lost</h2>

          <p className="api-error-message">Please retry the connection or dismiss this message.</p>

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

          <button type="button" className="api-error-more" onClick={() => setShowDetails((visible) => !visible)} aria-expanded={showDetails}>
            {showDetails ? 'Hide details' : 'More info'}
          </button>
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
