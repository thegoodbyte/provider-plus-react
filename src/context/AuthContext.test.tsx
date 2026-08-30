import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { authService } from '../services/authService';
import { APP_MODE_STORAGE_KEY } from '../utils/appModeStorage';

jest.mock('../services/authService', () => ({ authService: {
  getToken: jest.fn(), getUser: jest.fn(), storeSession: jest.fn(), logout: jest.fn(),
  login: jest.fn(), startMedicalStaffPreview: jest.fn(), startUserImpersonation: jest.fn(), stopImpersonation: jest.fn(),
} }));

describe('AuthProvider session replacement', () => {
  beforeEach(() => {
    jest.clearAllMocks(); localStorage.clear();
    (authService.getToken as jest.Mock).mockReturnValue(null);
    (authService.getUser as jest.Mock).mockReturnValue(null);
  });

  it('clears an admin app mode when a medical review link replaces the session', () => {
    localStorage.setItem(APP_MODE_STORAGE_KEY, JSON.stringify({ mode: 'shopping' }));
    const wrapper = ({ children }: any) => <AuthProvider>{children}</AuthProvider>;
    const { result } = renderHook(() => useAuth(), { wrapper });
    act(() => result.current.storeSession({ access_token: 'group-token', user: { role: 'medical_advisor', accessType: 'medical_review_group_link' } }));
    expect(localStorage.getItem(APP_MODE_STORAGE_KEY)).toBeNull();
    expect(authService.storeSession).toHaveBeenCalledWith(expect.objectContaining({ access_token: 'group-token' }));
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('preserves app mode for an ordinary login session replacement', () => {
    localStorage.setItem(APP_MODE_STORAGE_KEY, JSON.stringify({ mode: 'retreat', retreatId: 'r1' }));
    const wrapper = ({ children }: any) => <AuthProvider>{children}</AuthProvider>;
    const { result } = renderHook(() => useAuth(), { wrapper });
    act(() => result.current.storeSession({ access_token: 'token', user: { role: 'admin' } }));
    expect(localStorage.getItem(APP_MODE_STORAGE_KEY)).not.toBeNull();
  });
});
