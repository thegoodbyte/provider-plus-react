import React, { useState, useEffect } from 'react';
import { FiArrowRight, FiEye, FiEyeOff, FiLayers } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../config/api.config';
import './Login.css';

export const Login: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const { login } = useAuth();

  // Check API connection on mount
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/health`, {
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
      await login(email, password);
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
        setError('Invalid email or password');
      } else {
        // For any other error, check if it's likely a connection issue
        setError('Connection error - Unable to reach the server. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container login-welcome">
      <aside className="login-story" aria-label="Provider Plus workspace">
        <div className="login-story-brand"><FiLayers size={24} /> Provider Plus</div>
        <div className="login-story-content"><span className="login-eyebrow">A little clarity. A better day.</span><h1>Thoughtful care.<br />Seamless operations.</h1><p>Your clients, retreats and team.<br />One calm place to bring it all together.</p><div className="login-story-visual" aria-hidden="true"><div className="login-orbit orbit-one" /><div className="login-orbit orbit-two" /><div className="login-orbit orbit-three" /><FiLayers size={52} /></div></div>
        <span className="login-story-footer">Built around your team. Focused on your clients.</span>
      </aside>
      <div className="login-box">
        <div className="login-form-brand"><FiLayers size={22} /> Provider Plus</div>
        <span className="login-eyebrow">YOUR WORKSPACE AWAITS</span>
        <h2>Welcome back</h2>
        <p className="login-help-text">Sign in to keep things moving.</p>

        {/* Connection Status Indicator */}
        {connectionStatus === 'error' && (
          <div className="connection-warning" role="status">
            We’re having trouble connecting. Please try again in a moment.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email address</label>
            <input
              autoComplete="username"
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="login-password-field">
            <input
              autoComplete="current-password"
              type={showPassword ? 'text' : 'password'}
              id="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
            <button type="button" className="login-password-toggle" disabled={loading} onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>{showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}</button>
            </div>
          </div>

          {error && <div className="error-message" role="alert">{error}</div>}

          <button type="submit" disabled={loading} aria-busy={loading}>
            {loading ? 'Signing in…' : <>Sign in <FiArrowRight size={18} /></>}
          </button>
        </form>

        <div className="login-footer-link">
          <Link to="/users/forgot-password">Forgot password?</Link>
        </div>
      </div>
    </div>
  );
};
