import { quoteBookingUsd, retreatExpectedUsd } from './retreatUsdTotals';
import { paymentsApi } from '../services/api';
jest.mock('../services/api', () => ({ paymentsApi: { convertToUsd: jest.fn() } }));
describe('retreat USD quotes', () => {
  it('uses the API quote for each currency, preserving zero', async () => {
    (paymentsApi.convertToUsd as jest.Mock).mockResolvedValueOnce({ data: { usd_amount: 2111 } }).mockResolvedValueOnce({ data: { usd_amount: 0 } });
    expect(await quoteBookingUsd(45000, 'CZK')).toBe(2111);
    expect(await quoteBookingUsd(0, 'PLN')).toBe(0);
    expect(await quoteBookingUsd(123, 'USD')).toBe(123);
  });
  it('reports missing conversions rather than using invented rates', async () => {
    (paymentsApi.convertToUsd as jest.Mock).mockResolvedValueOnce({ data: { usd_amount: null, unavailable: true } }).mockRejectedValueOnce(new Error('offline'));
    expect(await quoteBookingUsd(9000, 'PLN')).toBeNull();
    expect(await quoteBookingUsd(1000, 'EUR')).toBeNull();
  });
  it('adds converted active bookings and excludes cancellations', () => {
    expect(retreatExpectedUsd([{status:'confirmed', totalAmountUSD: 2111}, {status:'pending', totalAmountUSD: 1500}, {status:'cancelled', totalAmountUSD: 500}])).toBe(3611);
    expect(retreatExpectedUsd([{status:'confirmed', totalAmountUSD: null}])).toBeNull();
    expect(retreatExpectedUsd([{status:'cancelled', totalAmountUSD: null}])).toBe(0);
  });
});
