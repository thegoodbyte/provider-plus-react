import { getIbogaReadyPaymentUrl, getPolishWebsitePaymentUrl, getPreferredPaymentUrl } from './paymentRequestLinks';

describe('payment request client links', () => {
  const request = { publicHash: 'safe-hash-123' };
  it('builds both public destinations from the same non-identifying hash', () => {
    expect(getIbogaReadyPaymentUrl(request)).toBe('https://www.ibogaready.com/payment/safe-hash-123');
    expect(getPolishWebsitePaymentUrl(request)).toBe('https://ibogaspirit.pl/clients/payment/request/safe-hash-123?lang=pl');
  });
  it('uses the Polish website for Polish clients and IbogaReady otherwise', () => {
    expect(getPreferredPaymentUrl({ ...request, clientId: { language: 'PL' } })).toContain('ibogaspirit.pl');
    expect(getPreferredPaymentUrl({ ...request, clientId: { preferredLanguage: 'en' } })).toContain('ibogaready.com');
  });
  it('does not create a public URL without a hash', () => {
    expect(getPreferredPaymentUrl({ clientId: { language: 'pl' } })).toBe('');
  });
});

