import { api, clientsApi } from './api';

afterEach(() => jest.restoreAllMocks());
it('passes the editor error policy through update and preserves the rejection', async () => {
  const failure = { response: { status: 400, data: { message: 'Duplicate email' } } };
  const patch = jest.spyOn(api, 'patch').mockRejectedValue(failure);
  await expect(clientsApi.update('c1', { email: 'taken@example.invalid' }, { suppressGlobalError: true })).rejects.toBe(failure);
  expect(patch).toHaveBeenCalledWith('/clients/c1', { email: 'taken@example.invalid' }, { suppressGlobalError: true });
});
it('passes local create error handling while continuing to strip the login PIN', async () => {
  const post = jest.spyOn(api, 'post').mockResolvedValue({ data: { _id: 'c1' } });
  await clientsApi.quickAdd({ email: 'new@example.invalid', loginPin: '123456' }, { suppressGlobalError: true });
  expect(post).toHaveBeenCalledWith('/clients/quick-add', { email: 'new@example.invalid' }, { suppressGlobalError: true });
});
