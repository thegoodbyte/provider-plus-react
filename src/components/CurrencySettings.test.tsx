import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CurrencySettings from './CurrencySettings';
import { configSummaryApi, paymentsApi } from '../services/api';
import { currencyService } from '../services/currencyService';

jest.mock('../services/api', () => ({
  configSummaryApi: { get: jest.fn() },
  paymentsApi: { convert: jest.fn() },
}));

jest.mock('../services/currencyService', () => ({
  currencyService: {
    getExchangeRateInfo: jest.fn().mockResolvedValue({
      rates: { USD: 1, EUR: 1.1, CZK: 0.04, PLN: 0.25, lastUpdated: Date.now() },
      lastUpdated: 'now',
      nextUpdate: 'later',
    }),
    forceRefreshRates: jest.fn(),
    convertToUSD: jest.fn(),
    convertFromUSD: jest.fn(),
  },
}));

describe('CurrencySettings converter', () => {
  it('looks up 4500 PLN to USD using Revolut in the popup', async () => {
    (currencyService.getExchangeRateInfo as jest.Mock).mockResolvedValue({
      rates: { USD: 1, EUR: 1.1, CZK: 0.04, PLN: 0.25, lastUpdated: Date.now() },
      lastUpdated: 'now',
      nextUpdate: 'later',
    });
    (configSummaryApi.get as jest.Mock).mockResolvedValue({ data: { integrations: { exchangeRateProviderLabel: 'Revolut' } } });
    (paymentsApi.convert as jest.Mock).mockResolvedValue({ data: { amount: 1125.5, from: 'PLN', to: 'USD', provider: 'Revolut' } });

    render(<CurrencySettings onClose={jest.fn()} />);

    expect(screen.getByRole('heading', { name: /Revolut Currency Converter/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Amount')).toHaveValue(4500);
    expect(screen.getByLabelText('From')).toHaveValue('PLN');
    expect(screen.getByLabelText('To')).toHaveValue('USD');

    fireEvent.click(screen.getByRole('button', { name: 'Convert' }));

    await waitFor(() => expect(paymentsApi.convert).toHaveBeenCalledWith(4500, 'PLN', 'USD'));
    expect(await screen.findByText('$1,125.50')).toBeInTheDocument();
    expect(screen.getAllByText('Revolut').length).toBeGreaterThan(0);
  });
});
