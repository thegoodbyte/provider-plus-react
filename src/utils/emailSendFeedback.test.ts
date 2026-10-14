import { emailSendFeedback, uncertainWrite } from './emailSendFeedback';
it.each(['queued', 'failed', undefined])('never describes %s as successful delivery', status => {
  expect(emailSendFeedback({ status })).toMatchObject({ type: 'error', uncertain: true });
});
it('describes actual acceptance without provider diagnostics', () => {
  expect(emailSendFeedback({ status: 'sent', gmailMessageId: 'internal', errorMessage: 'secret' }).text).toBe('Email sent.');
});
it('distinguishes capture from live delivery', () => {
  expect(emailSendFeedback({ status: 'sent', provider: 'development_capture' }).text).toContain('development inbox');
});
it('permits a verified preflight failure to be corrected', () => {
  expect(emailSendFeedback({ status: 'failed', integrationSafeRetry: true }).uncertain).toBe(false);
  expect(uncertainWrite({ response: { status: 503, data: { message: 'Outbound email is disabled in this environment.' } } })).toBe(false);
});
it('treats timeout and an unknown server failure as uncertain', () => {
  expect(uncertainWrite({ request: {} })).toBe(true);
  expect(uncertainWrite({ response: { status: 500 } })).toBe(true);
});
