import { useState, useCallback } from 'react';
import { currencyService } from '../services/currencyService';

interface CurrencyDisplay {
  formatted: string;
  usdAmount?: number;
  isLoading: boolean;
}

interface CurrencyHookReturn {
  formatCurrency: (amount: number, currency: 'EUR' | 'USD' | 'CZK' | 'PLN') => string;
  useCurrencyDisplay: (amount: number, currency: 'EUR' | 'USD' | 'CZK' | 'PLN') => CurrencyDisplay;
  convertToUSD: (amount: number, currency: 'EUR' | 'USD' | 'CZK' | 'PLN') => Promise<number>;
  isLoading: boolean;
  error: string | null;
  refreshRates: () => Promise<void>;
}

export const useCurrency = (): CurrencyHookReturn => {
  const [usdAmountCache, setUsdAmountCache] = useState<Map<string, { amount: number; timestamp: number }>>(new Map());
  const [loadingConversions, setLoadingConversions] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatCurrency = useCallback((amount: number, currency: 'EUR' | 'USD' | 'CZK' | 'PLN'): string => {
    const symbols: { [key: string]: string } = {
      EUR: '€',
      USD: '$',
      CZK: 'Kč',
      PLN: 'zł'
    };

    const symbol = symbols[currency];
    return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, []);

  const convertToUSD = useCallback(async (amount: number, currency: 'EUR' | 'USD' | 'CZK' | 'PLN'): Promise<number> => {
    if (currency === 'USD') {
      return amount;
    }

    const cacheKey = `${amount}-${currency}`;
    const cached = usdAmountCache.get(cacheKey);
    const now = Date.now();

    // Use cached value if it's less than 1 hour old
    if (cached && (now - cached.timestamp) < 60 * 60 * 1000) {
      return cached.amount;
    }

    try {
      setLoadingConversions(prev => new Set(prev).add(cacheKey));

      const usdAmount = await currencyService.convertToUSD(amount, currency);

      // Cache the result
      setUsdAmountCache(prev => {
        const newCache = new Map(prev);
        newCache.set(cacheKey, { amount: usdAmount, timestamp: now });
        // Keep cache size reasonable (max 100 entries)
        if (newCache.size > 100) {
          const firstKey = newCache.keys().next().value;
          newCache.delete(firstKey);
        }
        return newCache;
      });

      setLoadingConversions(prev => {
        const newSet = new Set(prev);
        newSet.delete(cacheKey);
        return newSet;
      });

      return usdAmount;
    } catch (err) {
      console.error('Failed to convert to USD:', err);
      setError('Failed to convert currency');
      setLoadingConversions(prev => {
        const newSet = new Set(prev);
        newSet.delete(cacheKey);
        return newSet;
      });
      return amount; // Fallback to original amount
    }
  }, [usdAmountCache]);

  const useCurrencyDisplay = useCallback((amount: number, currency: 'EUR' | 'USD' | 'CZK' | 'PLN'): CurrencyDisplay => {
    const formattedAmount = formatCurrency(amount, currency);

    if (currency === 'USD') {
      return {
        formatted: formattedAmount,
        usdAmount: amount,
        isLoading: false
      };
    }

    // Check if we have a cached USD amount
    const cacheKey = `${amount}-${currency}`;
    const cached = usdAmountCache.get(cacheKey);
    const now = Date.now();
    const isLoadingThis = loadingConversions.has(cacheKey);

    if (cached && (now - cached.timestamp) < 60 * 60 * 1000) {
      return {
        formatted: `${formattedAmount} (${formatCurrency(cached.amount, 'USD')})`,
        usdAmount: cached.amount,
        isLoading: false
      };
    }

    // If no cached value and not already loading, start conversion
    if (!isLoadingThis) {
      convertToUSD(amount, currency).catch(() => {
        // Error handling is done in convertToUSD
      });
    }

    return {
      formatted: isLoadingThis ? `${formattedAmount} (...)` : formattedAmount,
      usdAmount: undefined,
      isLoading: isLoadingThis
    };
  }, [formatCurrency, usdAmountCache, loadingConversions, convertToUSD]);

  const refreshRates = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      await currencyService.forceRefreshRates();
      setUsdAmountCache(new Map()); // Clear cache to force recalculation
      setLoadingConversions(new Set()); // Clear loading states
    } catch (err) {
      setError('Failed to refresh exchange rates');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    formatCurrency,
    useCurrencyDisplay,
    convertToUSD,
    isLoading,
    error,
    refreshRates
  };
};

export default useCurrency;