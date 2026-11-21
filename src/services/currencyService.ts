interface ExchangeRates {
  EUR: number;
  USD: number;
  CZK: number;
  PLN: number;
  GBP?: number; // Older caches/fallbacks have no published pound rate.
  lastUpdated: string;
}

interface ExchangeRateResponse {
  success: boolean;
  timestamp: number;
  base: string;
  date: string;
  rates: {
    [key: string]: number;
  };
}

class CurrencyService {
  private readonly STORAGE_KEY = 'exchange_rates';
  private readonly CACHE_DURATION = 4 * 60 * 60 * 1000; // 4 hours in milliseconds
  private readonly FALLBACK_RATES: ExchangeRates = {
    EUR: 1.08,
    USD: 1.0,
    CZK: 0.044,
    PLN: 0.24,
    lastUpdated: new Date().toISOString()
  };

  // Using a free API - you can replace with your preferred service
  private readonly API_URL = 'https://api.exchangerate-api.com/v4/latest/USD';
  private readonly BACKUP_API_URL = 'https://api.fxratesapi.com/latest?base=USD&symbols=EUR,CZK,PLN,GBP';

  async getExchangeRates(): Promise<ExchangeRates> {
    try {
      // Try to get cached rates first
      const cached = this.getCachedRates();
      if (cached && this.isCacheValid(cached)) {
        return cached;
      }

      // Fetch new rates from API
      const rates = await this.fetchRatesFromAPI();
      this.cacheRates(rates);
      return rates;
    } catch (error) {
      console.warn('Failed to fetch exchange rates, using cached or fallback rates:', error);
      const cached = this.getCachedRates();
      return cached || this.FALLBACK_RATES;
    }
  }

  private async fetchRatesFromAPI(): Promise<ExchangeRates> {
    try {
      // Try primary API first
      const response = await fetch(this.API_URL);
      if (response.ok) {
        const data: ExchangeRateResponse = await response.json();
        return {
          EUR: 1 / data.rates.EUR, // Convert to USD rate
          USD: 1.0,
          CZK: 1 / data.rates.CZK,
          PLN: 1 / data.rates.PLN,
          ...(Number.isFinite(data.rates.GBP) && data.rates.GBP > 0 ? { GBP: 1 / data.rates.GBP } : {}),
          lastUpdated: new Date().toISOString()
        };
      }
    } catch (error) {
      console.warn('Primary API failed, trying backup:', error);
    }

    try {
      // Try backup API
      const response = await fetch(this.BACKUP_API_URL);
      if (response.ok) {
        const data = await response.json();
        return {
          EUR: 1 / data.rates.EUR,
          USD: 1.0,
          CZK: 1 / data.rates.CZK,
          PLN: 1 / data.rates.PLN,
          ...(Number.isFinite(data.rates.GBP) && data.rates.GBP > 0 ? { GBP: 1 / data.rates.GBP } : {}),
          lastUpdated: new Date().toISOString()
        };
      }
    } catch (error) {
      console.warn('Backup API failed:', error);
    }

    throw new Error('All exchange rate APIs failed');
  }

  private getCachedRates(): ExchangeRates | null {
    try {
      const cached = localStorage.getItem(this.STORAGE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  }

  private cacheRates(rates: ExchangeRates): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(rates));
    } catch (error) {
      console.warn('Failed to cache exchange rates:', error);
    }
  }

  private isCacheValid(rates: ExchangeRates): boolean {
    const lastUpdated = new Date(rates.lastUpdated).getTime();
    const now = Date.now();
    return (now - lastUpdated) < this.CACHE_DURATION;
  }

  async convertToUSD(amount: number, fromCurrency: 'EUR' | 'USD' | 'CZK' | 'PLN' | 'GBP'): Promise<number> {
    if (fromCurrency === 'USD') {
      return amount;
    }

    let rates = await this.getExchangeRates();
    if (fromCurrency === 'GBP' && !rates.GBP) rates = await this.forceRefreshRates();
    const rate = rates[fromCurrency];
    if (!Number.isFinite(rate) || !rate || rate <= 0) throw new Error(`Published ${fromCurrency} exchange rate is unavailable.`);
    return amount * rate;
  }

  async convertFromUSD(amount: number, toCurrency: 'EUR' | 'USD' | 'CZK' | 'PLN' | 'GBP'): Promise<number> {
    if (toCurrency === 'USD') {
      return amount;
    }

    let rates = await this.getExchangeRates();
    if (toCurrency === 'GBP' && !rates.GBP) rates = await this.forceRefreshRates();
    const rate = rates[toCurrency];
    if (!Number.isFinite(rate) || !rate || rate <= 0) throw new Error(`Published ${toCurrency} exchange rate is unavailable.`);
    return amount / rate;
  }

  formatCurrencyWithUSD(amount: number, currency: 'EUR' | 'USD' | 'CZK' | 'PLN' | 'GBP', usdAmount?: number): string {
    const symbols: { [key: string]: string } = {
      EUR: '€',
      USD: '$',
      CZK: 'Kč',
      PLN: 'zł',
      GBP: '£'
    };

    const symbol = symbols[currency];
    const formattedAmount = `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    if (currency === 'USD' || usdAmount === undefined) {
      return formattedAmount;
    }

    const formattedUSD = `$${usdAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return `${formattedAmount} (${formattedUSD})`;
  }

  async getExchangeRateInfo(): Promise<{ rates: ExchangeRates; lastUpdated: string; nextUpdate: string }> {
    const rates = await this.getExchangeRates();
    const lastUpdated = new Date(rates.lastUpdated);
    const nextUpdate = new Date(lastUpdated.getTime() + this.CACHE_DURATION);

    return {
      rates,
      lastUpdated: lastUpdated.toLocaleString(),
      nextUpdate: nextUpdate.toLocaleString()
    };
  }

  async forceRefreshRates(): Promise<ExchangeRates> {
    try {
      localStorage.removeItem(this.STORAGE_KEY); // Clear cache
      const rates = await this.fetchRatesFromAPI();
      this.cacheRates(rates);
      return rates;
    } catch (error) {
      console.error('Failed to refresh exchange rates:', error);
      throw error;
    }
  }
}

export const currencyService = new CurrencyService();
export type { ExchangeRates };
