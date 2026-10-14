export function emailSendFeedback(record: any) {
  if (record?.status === 'sent') return { type: 'success' as const, text: record.provider === 'development_capture' ? 'Email captured in the development inbox.' : 'Email sent.', uncertain: false };
  if (record?.status === 'failed' && record.integrationSafeRetry === true) return { type: 'error' as const, text: 'Email was not sent. Check Communications settings before sending again.', uncertain: false };
  return { type: 'error' as const, text: 'Email delivery could not be confirmed. Check sent messages before sending again.', uncertain: true };
}
export const uncertainWrite = (error: any) => !/^(Outbound email is disabled in this environment\.|email resource is disabled or in capture mode)$/.test(error?.response?.data?.message || '') && ((!error?.response && !!error?.request) || error?.response?.status >= 500);
