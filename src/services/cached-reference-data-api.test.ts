import { api, referralsApi, expenseTypesApi, paymentRequestTypesApi, launcherConfigApi } from './api';
import { cacheService } from './cacheService';

afterEach(() => {
  jest.restoreAllMocks();
  cacheService.clear();
});

it('caches referralsApi.getAll and reuses the cached response', async () => {
  const get = jest.spyOn(api, 'get').mockResolvedValue({ data: [{ _id: 'r1' }] });
  await referralsApi.getAll();
  await referralsApi.getAll();
  expect(get).toHaveBeenCalledTimes(1);
});

it('bypasses the cache for referralsApi.getAll when suppressGlobalError opts into a fresh read', async () => {
  const get = jest.spyOn(api, 'get').mockResolvedValue({ data: [{ _id: 'r1' }] });
  await referralsApi.getAll({ suppressGlobalError: true });
  await referralsApi.getAll({ suppressGlobalError: true });
  expect(get).toHaveBeenCalledTimes(2);
});

it('clears the referrals cache after create/update/delete', async () => {
  const get = jest.spyOn(api, 'get').mockResolvedValue({ data: [{ _id: 'r1' }] });
  jest.spyOn(api, 'post').mockResolvedValue({ data: { _id: 'r2' } });
  jest.spyOn(api, 'patch').mockResolvedValue({ data: { _id: 'r1' } });
  jest.spyOn(api, 'delete').mockResolvedValue({ data: {} });
  await referralsApi.getAll();
  await referralsApi.create({ name: 'New partner' } as any);
  await referralsApi.getAll();
  expect(get).toHaveBeenCalledTimes(2);
  await referralsApi.update('r1', {});
  await referralsApi.getAll();
  expect(get).toHaveBeenCalledTimes(3);
  await referralsApi.delete('r1');
  await referralsApi.getAll();
  expect(get).toHaveBeenCalledTimes(4);
});

it('caches expenseTypesApi.getAll and clears it on mutation', async () => {
  const get = jest.spyOn(api, 'get').mockResolvedValue({ data: [{ _id: 't1', isActive: true }] });
  jest.spyOn(api, 'post').mockResolvedValue({ data: { _id: 't2' } });
  await expenseTypesApi.getAll();
  await expenseTypesApi.getAll();
  expect(get).toHaveBeenCalledTimes(1);
  await expenseTypesApi.create({ name: 'New type' } as any);
  await expenseTypesApi.getAll();
  expect(get).toHaveBeenCalledTimes(2);
});

it('caches paymentRequestTypesApi.getAll and clears it on mutation', async () => {
  const get = jest.spyOn(api, 'get').mockResolvedValue({ data: [{ key: 'deposit', label: 'Deposit' }] });
  jest.spyOn(api, 'post').mockResolvedValue({ data: {} });
  await paymentRequestTypesApi.getAll();
  await paymentRequestTypesApi.getAll();
  expect(get).toHaveBeenCalledTimes(1);
  await paymentRequestTypesApi.create({ key: 'new', label: 'New' });
  await paymentRequestTypesApi.getAll();
  expect(get).toHaveBeenCalledTimes(2);
});

it('caches launcherConfigApi.get and clears it after save', async () => {
  const get = jest.spyOn(api, 'get').mockResolvedValue({ data: { assignments: [] } });
  jest.spyOn(api, 'patch').mockResolvedValue({ data: { assignments: [] } });
  await launcherConfigApi.get();
  await launcherConfigApi.get();
  expect(get).toHaveBeenCalledTimes(1);
  await launcherConfigApi.save([]);
  await launcherConfigApi.get();
  expect(get).toHaveBeenCalledTimes(2);
});
