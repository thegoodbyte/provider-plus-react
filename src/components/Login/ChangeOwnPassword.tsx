import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usersApi } from '../../services/usersApi';
import { useAuth } from '../../context/AuthContext';
import './Login.css';

const validatePassword = (password: string) => {
  if (password.length < 8) return 'Password must be at least 8 characters long.';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
  return '';
};

export const ChangeOwnPassword: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const isImpersonating = Boolean(user?.impersonatedBy || user?.originalRole);

  useEffect(() => {
    if (isImpersonating) {
      navigate('/', { replace: true });
    }
  }, [isImpersonating, navigate]);

  if (isImpersonating) {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      const response = await usersApi.changePassword({ oldPassword, newPassword });
      setMessage(response.message || 'Password changed successfully.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (changeError: any) {
      setError(changeError?.response?.data?.message || 'Unable to change password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>Change Password</h2>
        <p className="login-help-text">Enter your current password and choose a new secure password.</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="current-password">Current Password:</label>
            <input
              type="password"
              id="current-password"
              value={oldPassword}
              onChange={(event) => setOldPassword(event.target.value)}
              required
              disabled={saving}
              autoComplete="current-password"
            />
          </div>

          <div className="form-group">
            <label htmlFor="new-password">New Password:</label>
            <input
              type="password"
              id="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
              disabled={saving}
              autoComplete="new-password"
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirm-password">Confirm New Password:</label>
            <input
              type="password"
              id="confirm-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              disabled={saving}
              autoComplete="new-password"
            />
          </div>

          {message && <div className="success-message">{message}</div>}
          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Change Password'}
          </button>
        </form>

        <div className="login-footer-link">
          <Link to="/">Back to app</Link>
        </div>
      </div>
    </div>
  );
};
