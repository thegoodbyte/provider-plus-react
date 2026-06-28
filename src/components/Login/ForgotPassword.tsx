import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { usersApi } from '../../services/usersApi';
import './Login.css';

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const response = await usersApi.requestPasswordReset(email);
      setMessage(response.message);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Unable to request a password change right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>Change Password</h2>
        <p className="login-help-text">Enter your email address and we will send a secure, time-limited password change link.</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="reset-email">Email Address:</label>
            <input
              type="email"
              id="reset-email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter your email address"
              required
              disabled={loading}
              autoComplete="email"
            />
          </div>

          {message && <div className="success-message">{message}</div>}
          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? 'Sending...' : 'Send Secure Link'}
          </button>
        </form>

        <div className="login-footer-link">
          <Link to="/">Back to login</Link>
        </div>
      </div>
    </div>
  );
};
