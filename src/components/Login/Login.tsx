import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import './Login.css';

export const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const { login } = useAuth();

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3005';
  const apiPort = API_BASE_URL.split(':').pop()?.split('/')[0] || '3005';

  // Check API connection on mount
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/`, {
          method: 'GET',
        });
        setConnectionStatus(response.ok ? 'connected' : 'error');
      } catch (err) {
        setConnectionStatus('error');
      }
    };

    checkConnection();
  }, [API_BASE_URL]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      // Redirect handled by App component
    } catch (err: any) {
      // Check for connection error
      if (err?.message === 'CONNECTION_ERROR' ||
          err?.message === 'Failed to fetch' ||
          err?.message?.includes('NetworkError') ||
          err?.message?.includes('Failed to fetch')) {
        setError('Connection error - Unable to reach the server. Please check your connection and try again.');
      } else if (err?.message?.startsWith('Server error')) {
        setError(err.message);
      } else if (err?.message === 'Invalid credentials') {
        setError('Invalid username or password');
      } else {
        // For any other error, check if it's likely a connection issue
        setError('Connection error - Unable to reach the server. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>Provider Plus Login</h2>

        {/* Connection Status Indicator */}
        {connectionStatus === 'error' && (
          <div className="connection-warning">
            ⚠️ Cannot connect to server on port {apiPort}
            <br />
            <small>Please ensure the backend is running</small>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username:</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password:</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};