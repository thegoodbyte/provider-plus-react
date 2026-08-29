import { authFetch, authService } from './authService';
import { cacheService } from './cacheService';

jest.mock('./cacheService', () => ({ cacheService: { clear: jest.fn() } }));
const fetchMock = jest.fn();
const response = (ok: boolean, status = 200, data: any = {}, statusText = '') => ({ ok, status, statusText, json: jest.fn().mockResolvedValue(data) });
const session = { access_token: 'new-token', user: { id: 'u1', email: 'ada@example.com', role: 'admin' } };

describe('authService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    (global as any).fetch = fetchMock;
  });

  it('logs in, clears cached API data, and stores the session', async () => {
    fetchMock.mockResolvedValue(response(true, 200, session));
    await expect(authService.login('ada@example.com', 'secret')).resolves.toEqual(session);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/auth/login'), expect.objectContaining({ method: 'POST', body: JSON.stringify({ email: 'ada@example.com', password: 'secret' }) }));
    expect(cacheService.clear).toHaveBeenCalled();
    expect(authService.getToken()).toBe('new-token');
    expect(authService.getUser()).toEqual(session.user);
    expect(authService.isAuthenticated()).toBe(true);
  });

  it.each([
    [401, '', 'Invalid credentials'],
    [503, '', 'Server error. Please try again later.'],
    [400, 'Bad Request', 'Error: Bad Request'],
  ])('maps HTTP %s login errors', async (status, statusText, message) => {
    fetchMock.mockResolvedValue(response(false, status as number, {}, statusText as string));
    await expect(authService.login('x', 'y')).rejects.toThrow(message as string);
  });

  it('maps fetch and unexpected failures to a connection error', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(authService.login('x', 'y')).rejects.toThrow('CONNECTION_ERROR');
    fetchMock.mockRejectedValueOnce(new Error('unexpected'));
    await expect(authService.login('x', 'y')).rejects.toThrow('CONNECTION_ERROR');
  });

  it('starts medical staff preview while preserving the original session once', async () => {
    authService.storeSession({ access_token: 'original', user: { email: 'admin@example.com', role: 'admin' } });
    fetchMock.mockResolvedValue(response(true, 200, session));
    await expect(authService.startMedicalStaffPreview()).resolves.toEqual(session);
    expect(localStorage.getItem('originalToken')).toBe('original');
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/auth/impersonate/medical-staff'), expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer original' }) }));
    fetchMock.mockResolvedValue(response(true, 200, session));
    await authService.startMedicalStaffPreview();
    expect(localStorage.getItem('originalToken')).toBe('original');
  });

  it('rejects unauthenticated and failed medical previews', async () => {
    await expect(authService.startMedicalStaffPreview()).rejects.toThrow('Not authenticated');
    authService.storeSession({ access_token: 'token', user: { email: 'a@b.c', role: 'admin' } });
    fetchMock.mockResolvedValue(response(false));
    await expect(authService.startMedicalStaffPreview()).rejects.toThrow('Unable to start medical staff preview');
  });

  it('starts user impersonation and uses a server-provided failure message', async () => {
    authService.storeSession({ access_token: 'original', user: { email: 'a@b.c', role: 'admin' } });
    fetchMock.mockResolvedValueOnce(response(true, 200, session));
    await authService.startUserImpersonation('user/with space');
    expect(fetchMock.mock.calls[0][0]).toContain('user%2Fwith%20space');
    fetchMock.mockResolvedValueOnce(response(false, 403, { message: 'Role forbidden' }));
    await expect(authService.startUserImpersonation('u2')).rejects.toThrow('Role forbidden');
    const broken = response(false, 403, {}); broken.json.mockRejectedValueOnce(new Error('invalid json'));
    fetchMock.mockResolvedValueOnce(broken);
    await expect(authService.startUserImpersonation('u3')).rejects.toThrow('Unable to impersonate user');
  });

  it('requires a session before user impersonation', async () => {
    await expect(authService.startUserImpersonation('u1')).rejects.toThrow('Not authenticated');
  });

  it('stops impersonation and restores the original user', () => {
    expect(authService.stopImpersonation()).toBeNull();
    localStorage.setItem('originalToken', 'original');
    localStorage.setItem('originalUser', JSON.stringify({ email: 'owner@example.com', role: 'admin' }));
    expect(authService.stopImpersonation()).toEqual({ email: 'owner@example.com', role: 'admin' });
    expect(authService.getToken()).toBe('original');
    expect(localStorage.getItem('originalToken')).toBeNull();
  });

  it('logs out every active and original session value', () => {
    ['token', 'user', 'originalToken', 'originalUser'].forEach((key) => localStorage.setItem(key, 'value'));
    authService.logout();
    expect(cacheService.clear).toHaveBeenCalled();
    expect(authService.getToken()).toBeNull();
    expect(authService.getUser()).toBeNull();
    expect(authService.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('originalToken')).toBeNull();
  });

  it('adds authentication headers without overwriting caller headers', async () => {
    localStorage.setItem('token', 'abc');
    fetchMock.mockResolvedValue(response(true));
    await authFetch('/resource', { method: 'PATCH', headers: { 'X-Trace': 'one' } });
    expect(fetchMock).toHaveBeenCalledWith('/resource', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Trace': 'one', Authorization: 'Bearer abc' } });
    localStorage.removeItem('token');
    await authFetch('/public');
    expect(fetchMock).toHaveBeenLastCalledWith('/public', { headers: { 'Content-Type': 'application/json' } });
  });
});
