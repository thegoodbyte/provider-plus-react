import React from 'react';
import { useCurrency } from '../hooks/useCurrency';

interface CurrencyDisplayProps {
  amount: number;
  currency: 'EUR' | 'USD' | 'CZK' | 'PLN' | 'GBP';
  showUSD?: boolean;
}

const CurrencyDisplay: React.FC<CurrencyDisplayProps> = ({ amount, currency, showUSD = true }) => {
  const { useCurrencyDisplay, formatCurrency, error } = useCurrency();

  // Always call both hooks unconditionally
  const display = useCurrencyDisplay(amount, currency);

  if (!showUSD || currency === 'USD') {
    return <span>{formatCurrency(amount, currency)}</span>;
  }

  return (
    <span title={error ? 'USD conversion unavailable' : display.isLoading ? 'Loading USD conversion...' : undefined}>
      {display.formatted}
    </span>
  );
};

export default CurrencyDisplay;
