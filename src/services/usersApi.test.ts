import { api } from './api';
import { usersApi } from './usersApi';

jest.mock('./api', () => ({ api: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() } }));
const mockedApi = api as any;

describe('usersApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const method of ['get', 'post', 'put', 'delete']) mockedApi[method].mockResolvedValue({ data: { marker: method } });
  });

  it('calls user read endpoints', async () => {
    await expect(usersApi.getAll()).resolves.toEqual({ data: { marker: 'get' } });
    await usersApi.getById('u1');
    await usersApi.getProfile();
    expect(mockedApi.get.mock.calls).toEqual([['/users'], ['/users/u1'], ['/users/profile']]);
  });

  it('creates, updates and deletes users', async () => {
    const createData: any = { email: 'a@b.c', password: 'secret', role: 'admin' };
    const updateData: any = { firstName: 'Ada', isActive: true };
    await usersApi.create(createData);
    await usersApi.update('u1', updateData);
    await expect(usersApi.delete('u1')).resolves.toEqual({ marker: 'delete' });
    expect(mockedApi.post).toHaveBeenCalledWith('/users', createData);
    expect(mockedApi.put).toHaveBeenCalledWith('/users/u1', updateData);
    expect(mockedApi.delete).toHaveBeenCalledWith('/users/u1');
  });

  it('updates profiles and changes passwords', async () => {
    const profile = { firstName: 'Ada', email: 'ada@example.com' };
    const passwords = { oldPassword: 'old', newPassword: 'new' };
    await usersApi.updateProfile(profile);
    await expect(usersApi.changePassword(passwords)).resolves.toEqual({ marker: 'put' });
    expect(mockedApi.put).toHaveBeenNthCalledWith(1, '/users/profile', profile);
    expect(mockedApi.put).toHaveBeenNthCalledWith(2, '/users/change-password', passwords);
  });

  it('handles every password-reset workflow and encodes tokens', async () => {
    await expect(usersApi.requestPasswordReset('ada@example.com')).resolves.toEqual({ marker: 'post' });
    await usersApi.validatePasswordResetToken('token/with space');
    await expect(usersApi.resetPasswordWithToken('token/with space', 'new')).resolves.toEqual({ marker: 'post' });
    await usersApi.resetPassword('u1', 'admin-new');
    expect(mockedApi.post).toHaveBeenNthCalledWith(1, '/users/forgot-password', { email: 'ada@example.com' });
    expect(mockedApi.get).toHaveBeenCalledWith('/users/change-password/token%2Fwith%20space');
    expect(mockedApi.post).toHaveBeenNthCalledWith(2, '/users/change-password/token%2Fwith%20space', { password: 'new' });
    expect(mockedApi.post).toHaveBeenNthCalledWith(3, '/users/u1/reset-password', { password: 'admin-new' });
  });
});
