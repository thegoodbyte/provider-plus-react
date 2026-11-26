import { api, clientsApi } from './api';
import { cacheService } from './cacheService';

afterEach(() => { jest.restoreAllMocks(); cacheService.clear(); });
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

// PPVC-1075: "updating client email address is not taking effect." One theory
// investigated was that a stale `cachedGet` entry for `clients:${id}` (or
// `clients:all`) could keep showing an old email on some other screen after a
// successful update elsewhere. `clientsApi.update` calls
// `cacheService.clearPattern('clients:')` before issuing the PATCH -- this
// proves that invalidation actually makes the *next* read (through the
// cache, i.e. without `suppressGlobalError`) hit the network again and get
// the fresh value, rather than replaying a cached stale one.
it('invalidates the cached client detail and list after an update, so the next read is fresh', async () => {
  const get = jest.spyOn(api, 'get')
    .mockResolvedValueOnce({ data: { _id: 'c1', email: 'old@example.invalid' } }) // getOne, first (caches)
    .mockResolvedValueOnce({ data: [{ _id: 'c1', email: 'old@example.invalid' }] }) // getAll, first (caches)
    .mockResolvedValueOnce({ data: { _id: 'c1', email: 'new@example.invalid' } }) // getOne, after update
    .mockResolvedValueOnce({ data: [{ _id: 'c1', email: 'new@example.invalid' }] }); // getAll, after update
  const patch = jest.spyOn(api, 'patch').mockResolvedValue({ data: { _id: 'c1', email: 'new@example.invalid' } });

  // Warm both caches with the old email.
  await expect(clientsApi.getOne('c1')).resolves.toEqual({ data: { _id: 'c1', email: 'old@example.invalid' } });
  await expect(clientsApi.getAll()).resolves.toEqual({ data: [{ _id: 'c1', email: 'old@example.invalid' }] });
  expect(get).toHaveBeenCalledTimes(2);

  // A second read within the TTL would hit the cache, not the network --
  // confirm that baseline before the update invalidates it.
  await expect(clientsApi.getOne('c1')).resolves.toEqual({ data: { _id: 'c1', email: 'old@example.invalid' } });
  expect(get).toHaveBeenCalledTimes(2);

  await clientsApi.update('c1', { email: 'new@example.invalid' });
  expect(patch).toHaveBeenCalledWith('/clients/c1', { email: 'new@example.invalid' }, undefined);

  // Reads after the update must go back to the network and return the fresh value.
  await expect(clientsApi.getOne('c1')).resolves.toEqual({ data: { _id: 'c1', email: 'new@example.invalid' } });
  await expect(clientsApi.getAll()).resolves.toEqual({ data: [{ _id: 'c1', email: 'new@example.invalid' }] });
  expect(get).toHaveBeenCalledTimes(4);
});
