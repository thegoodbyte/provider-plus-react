import { render, screen } from '@testing-library/react';
import CurrencyDisplay from './CurrencyDisplay';
import { currencyService } from '../services/currencyService';
jest.mock('../services/currencyService', () => ({ currencyService: { convertToUSD: jest.fn(), forceRefreshRates: jest.fn() } }));
it('keeps the GBP amount without a fabricated USD equivalent and stops retrying a missing rate', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  (currencyService.convertToUSD as jest.Mock).mockRejectedValue(new Error('GBP rate unavailable'));
  render(<CurrencyDisplay amount={100} currency="GBP" />);
  expect(await screen.findByTitle('USD conversion unavailable')).toHaveTextContent('£100.00');
  expect(currencyService.convertToUSD).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/\$100/)).not.toBeInTheDocument();
  jest.restoreAllMocks();
});
