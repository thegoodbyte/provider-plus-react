import { currencyService } from './currencyService';

const fetchMock = jest.fn();
const ok = (rates: any) => ({ ok: true, json: jest.fn().mockResolvedValue({ rates }) });
const failed = { ok: false, json: jest.fn() };

describe('currencyService', () => {
  beforeEach(() => {
    jest.clearAllMocks(); localStorage.clear(); (global as any).fetch = fetchMock;
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('returns a fresh cached rate without fetching', async () => {
    const rates = { EUR: 1.1, USD: 1, CZK: 0.04, PLN: 0.25, lastUpdated: new Date().toISOString() };
    localStorage.setItem('exchange_rates', JSON.stringify(rates));
    await expect(currencyService.getExchangeRates()).resolves.toEqual(rates);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches and caches primary rates and performs both conversion directions', async () => {
    fetchMock.mockResolvedValue(ok({ EUR: 0.8, CZK: 20, PLN: 4 }));
    const rates = await currencyService.forceRefreshRates();
    expect(rates).toEqual(expect.objectContaining({ EUR: 1.25, USD: 1, CZK: 0.05, PLN: 0.25 }));
    expect(JSON.parse(localStorage.getItem('exchange_rates') || '{}')).toEqual(rates);
    await expect(currencyService.convertToUSD(10, 'EUR')).resolves.toBe(12.5);
    await expect(currencyService.convertFromUSD(10, 'PLN')).resolves.toBe(40);
    await expect(currencyService.convertToUSD(10, 'USD')).resolves.toBe(10);
    await expect(currencyService.convertFromUSD(10, 'USD')).resolves.toBe(10);
  });

  it('uses the backup API when the primary request throws', async () => {
    fetchMock.mockRejectedValueOnce(new Error('primary offline')).mockResolvedValueOnce(ok({ EUR: 0.5, CZK: 25, PLN: 5 }));
    await expect(currencyService.forceRefreshRates()).resolves.toEqual(expect.objectContaining({ EUR: 2, CZK: 0.04, PLN: 0.2 }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('uses stale cached values, then fallback values, when all APIs fail', async () => {
    const stale = { EUR: 2, USD: 1, CZK: 0.1, PLN: 0.3, lastUpdated: '2000-01-01T00:00:00.000Z' };
    localStorage.setItem('exchange_rates', JSON.stringify(stale));
    fetchMock.mockResolvedValue(failed);
    await expect(currencyService.getExchangeRates()).resolves.toEqual(stale);
    localStorage.removeItem('exchange_rates');
    await expect(currencyService.getExchangeRates()).resolves.toEqual(expect.objectContaining({ EUR: 1.08, USD: 1, CZK: 0.044, PLN: 0.24 }));
  });

  it('handles malformed cache data and propagates forced refresh failures', async () => {
    localStorage.setItem('exchange_rates', '{bad json');
    fetchMock.mockResolvedValue(failed);
    await expect(currencyService.forceRefreshRates()).rejects.toThrow('All exchange rate APIs failed');
    expect(console.error).toHaveBeenCalledWith('Failed to refresh exchange rates:', expect.any(Error));
  });

  it('formats supported currencies with optional USD context', () => {
    expect(currencyService.formatCurrencyWithUSD(1234.5, 'EUR', 1400)).toBe('€1,234.50 ($1,400.00)');
    expect(currencyService.formatCurrencyWithUSD(10, 'USD', 10)).toBe('$10.00');
    expect(currencyService.formatCurrencyWithUSD(10, 'CZK')).toBe('Kč10.00');
    expect(currencyService.formatCurrencyWithUSD(10, 'PLN', 2.5)).toBe('zł10.00 ($2.50)');
  });

  it('reports the rate update window', async () => {
    localStorage.setItem('exchange_rates', JSON.stringify({ EUR: 1, USD: 1, CZK: 1, PLN: 1, lastUpdated: new Date().toISOString() }));
    await expect(currencyService.getExchangeRateInfo()).resolves.toEqual({
      rates: expect.objectContaining({ EUR: 1 }), lastUpdated: expect.any(String), nextUpdate: expect.any(String),
    });
  });
});
