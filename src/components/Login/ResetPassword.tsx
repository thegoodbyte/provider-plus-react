import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usersApi } from '../../services/usersApi';
import './Login.css';

const validatePassword = (password: string) => {
  if (password.length < 8) return 'Password must be at least 8 characters long.';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
  return '';
};

export const ResetPassword: React.FC = () => {
  const { token = '' } = useParams<{ token: string }>();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [validating, setValidating] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const expiryText = useMemo(() => {
    if (!expiresAt) return '';
    const date = new Date(expiresAt);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
  }, [expiresAt]);

  useEffect(() => {
    let active = true;
    const validate = async () => {
      setValidating(true);
      setError('');
      try {
        const response = await usersApi.validatePasswordResetToken(token);
        if (!active) return;
        setIsValid(Boolean(response.data.valid));
        setMaskedEmail(response.data.email || '');
        setExpiresAt(response.data.expiresAt || '');
        if (!response.data.valid) {
          setError('This password change link is invalid, expired, or already used.');
        }
      } catch (validateError: any) {
        if (active) setError(validateError?.response?.data?.message || 'Unable to validate this password change link.');
      } finally {
        if (active) setValidating(false);
      }
    };
    validate();
    return () => {
      active = false;
    };
  }, [token]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      const response = await usersApi.resetPasswordWithToken(token, password);
      setMessage(response.message);
      setIsValid(false);
      setPassword('');
      setConfirmPassword('');
    } catch (saveError: any) {
      setError(saveError?.response?.data?.message || 'Unable to change password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>Set New Password</h2>

        {validating ? (
          <div className="connection-warning">Checking secure link...</div>
        ) : (
          <>
            {maskedEmail && <p className="login-help-text">Account: {maskedEmail}</p>}
            {expiryText && <p className="login-help-text">Link expires: {expiryText}</p>}

            {isValid && !message && (
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="new-password">New Password:</label>
                  <input
                    type="password"
                    id="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
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

                <button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Change Password'}
                </button>
              </form>
            )}
          </>
        )}

        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}

        <div className="login-footer-link">
          <Link to="/">Back to login</Link>
          {!isValid && !message && <span> · </span>}
          {!isValid && !message && <Link to="/users/forgot-password">Request a new link</Link>}
        </div>
      </div>
    </div>
  );
};
