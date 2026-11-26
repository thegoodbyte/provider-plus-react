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

import { medicalReviewRequestsApi } from './api';
import { authService } from './authService';
it('quick links ignore unrelated expired login tokens without changing ordinary authenticated requests', async () => {
  const token=jest.spyOn(authService,'getToken').mockReturnValue('expired-admin-token');
  const previous=api.defaults.adapter;const captures:any[]=[];
  api.defaults.adapter=async config=>{captures.push(config);return {data:{},status:200,statusText:'OK',headers:{},config}};
  try {
    await medicalReviewRequestsApi.getQuickAccess(5001,'synthetic-link');
    await medicalReviewRequestsApi.submitQuickAccessDecision(5001,'synthetic-link',{reviewDecision:'OK',medicalStaffNotes:'Reviewed'});
    expect(captures.slice(0,2).every(config=>!config.headers.Authorization&&!config.headers['X-Work-Mode'])).toBe(true);
    await api.get('/normal-authenticated-route');expect(captures[2].headers.Authorization).toBe('Bearer expired-admin-token');
  } finally {api.defaults.adapter=previous;token.mockRestore()}
});
