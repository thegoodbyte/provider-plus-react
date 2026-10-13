import { api, referralsApi } from './api';

afterEach(() => jest.restoreAllMocks());

it('keeps update errors in the settings form instead of remounting it with the global overlay', async () => {
  const failure = { response: { status: 503 } };
  const patch = jest.spyOn(api, 'patch').mockRejectedValue(failure);
  await expect(referralsApi.update('partner', { commissionPackages: [] })).rejects.toBe(failure);
  expect(patch).toHaveBeenCalledWith('/referrals/partner', { commissionPackages: [] }, { suppressGlobalError: true });
});

it('keeps create failures available for inline retry', async () => {
  const post = jest.spyOn(api, 'post').mockResolvedValue({ data: { _id: 'partner' } });
  const data: any = { name: 'Partner', referralCode: 'PA', rateSchedule: [] };
  await referralsApi.create(data);
  expect(post).toHaveBeenCalledWith('/referrals', data, { suppressGlobalError: true });
});
