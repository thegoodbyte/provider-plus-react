import { api } from './api';
it.each(['post', 'patch', 'put', 'delete'])('leaves %s failures with their screen', async method => {
  let captured: any;
  await api.request({ method, url: '/test-policy', adapter: async config => { captured = config; return { data: {}, status: 200, statusText: 'OK', headers: {}, config }; } });
  expect(captured.suppressGlobalError).toBe(true);
});
it('preserves explicit global recovery policy', async () => {
  let captured: any;
  await api.request({ method: 'post', url: '/test-policy', suppressGlobalError: false, adapter: async config => { captured = config; return { data: {}, status: 200, statusText: 'OK', headers: {}, config }; } } as any);
  expect(captured.suppressGlobalError).toBe(false);
});
it('retains global loading feedback for unowned reads', async () => {
  let captured: any;
  await api.get('/test-policy', { adapter: async config => { captured = config; return { data: {}, status: 200, statusText: 'OK', headers: {}, config }; } });
  expect(captured.suppressGlobalError).toBeUndefined();
});
