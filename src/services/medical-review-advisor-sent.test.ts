import { api, medicalReviewRequestsApi } from './api';

it('posts the selected request IDs to the advisor delivery endpoint', async () => {
  const previousAdapter = api.defaults.adapter;
  const adapter = jest.fn(async config => ({
    data: { updated: 1 },
    status: 201,
    statusText: 'Created',
    headers: {},
    config,
  }));
  api.defaults.adapter = adapter;

  try {
    const requestIds = ['507f1f77bcf86cd799439011'];
    const response = await medicalReviewRequestsApi.markAdvisorSent(requestIds);

    expect(adapter).toHaveBeenCalledTimes(1);
    expect(adapter).toHaveBeenCalledWith(expect.objectContaining({
      method: 'post',
      url: '/medical-review-requests/mark-advisor-sent',
      data: JSON.stringify({ requestIds }),
    }));
    expect(response.data).toEqual({ updated: 1 });
  } finally {
    api.defaults.adapter = previousAdapter;
  }
});
