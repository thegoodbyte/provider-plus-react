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

  useEffect(() => {
    // Add response interceptor to catch API errors
    const interceptor = api.interceptors.response.use(
      (response) => response,
      (error) => {
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

          switch (error.response.status) {
            case 404:
              apiError.message = 'Requested resource not found';
              break;
            case 500:
              apiError.message = 'Server error occurred. Please try again later.';
              break;
            case 503:
              apiError.message = 'Service temporarily unavailable';
              break;
            default:
              apiError.message = error.response.data?.message || 'An error occurred while loading data';
          }
        } else if (error.request) {
          // No response received
          apiError.message = 'Cannot connect to server. Please check your connection.';
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
  };

  const handleRetry = async () => {
    setRetryCount(prev => prev + 1);
    clearError();

    // Trigger a simple health check
    try {
      await api.get('/');
    } catch (err) {
      // Error will be caught by interceptor
    }
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
            {error.code === 'NETWORK_ERROR' ? '🔌' : '⚠️'}
          </div>

          <h2 className="api-error-title">
            {error.code === 'NETWORK_ERROR' ? 'Connection Error' : 'Error Loading Data'}
          </h2>

          <p className="api-error-message">{error.message}</p>

          {error.url && (
            <div className="api-error-details">
              <p>
                <span className="api-error-label">Endpoint:</span>
                <code>{error.method} {error.url}</code>
              </p>
              {error.code && (
                <p>
                  <span className="api-error-label">Error Code:</span>
                  <code>{error.code}</code>
                </p>
              )}
              <p>
                <span className="api-error-label">Time:</span>
                {error.timestamp.toLocaleTimeString()}
              </p>
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

          <div className="api-error-help">
            <p>If this problem persists, please:</p>
            <ul>
              <li>Check your internet connection</li>
              <li>Verify the backend server is running on port <strong>{process.env.REACT_APP_PROVIDER_PLUS_API_URL?.split(':').pop()?.split('/')[0] || process.env.REACT_APP_API_URL?.split(':').pop()?.split('/')[0] || '3001'}</strong></li>
              <li>Contact support if the issue continues</li>
            </ul>
          </div>
        </div>

        <div className="api-error-content">
          {children}
        </div>
      </div>
    </ApiErrorContext.Provider>
  );
};

export default ApiErrorHandler;
