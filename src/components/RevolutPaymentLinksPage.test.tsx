import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import RevolutPaymentLinksPage from './RevolutPaymentLinksPage';
import { revolutPaymentLinksApi } from '../services/api';

jest.mock('../services/api', () => ({
  revolutPaymentLinksApi: { list: jest.fn(), create: jest.fn(), update: jest.fn() },
}));

const link = {
  _id: 'link-1', name: '3400 PLN payment',
  checkoutUrl: 'https://checkout.revolut.com/pay/3df332ae-ffe2-44bd-b662-080d4a2b0227',
  externalId: '3df332ae-ffe2-44bd-b662-080d4a2b0227', amount: 3400, currency: 'PLN',
  paymentLimit: 100, observedPaymentCount: 7, paymentCountOverride: 9,
  effectivePaymentCount: 9, remainingPayments: 91, overrideActive: true,
  status: 'active', countSource: 'manual',
};

describe('RevolutPaymentLinksPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (revolutPaymentLinksApi.list as jest.Mock).mockResolvedValue({ data: [link] });
    (revolutPaymentLinksApi.create as jest.Mock).mockResolvedValue({ data: link });
    (revolutPaymentLinksApi.update as jest.Mock).mockResolvedValue({ data: link });
  });

  it('shows effective, observed, override, limit, and remaining counts separately', async () => {
    render(<RevolutPaymentLinksPage />);
    expect(await screen.findByText('3400 PLN payment')).toBeInTheDocument();
    expect(screen.getByText('9 / 100')).toBeInTheDocument();
    expect(screen.getByText('Observed: 7 · Override: 9')).toBeInTheDocument();
    expect(screen.getByText('91 remaining')).toBeInTheDocument();
    expect(screen.getByText('overridden')).toBeInTheDocument();
  });

  it('clears an override by sending null while preserving the observed count', async () => {
    render(<RevolutPaymentLinksPage />);
    await screen.findByText('3400 PLN payment');
    fireEvent.click(screen.getByTitle('Edit'));
    const override = screen.getByLabelText('Override count');
    fireEvent.change(override, { target: { value: '' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Save link' }).closest('form')!);
    await waitFor(() => expect(revolutPaymentLinksApi.update).toHaveBeenCalledWith('link-1', expect.objectContaining({
      observedPaymentCount: 7,
      paymentCountOverride: null,
      paymentLimit: 100,
    })));
  });

  it('prefills the first catalog entry with the requested 3400 PLN amount and 100 limit', async () => {
    (revolutPaymentLinksApi.list as jest.Mock).mockResolvedValue({ data: [] });
    render(<RevolutPaymentLinksPage />);
    await screen.findByText('No Revolut payment links yet. Add your first reusable link.');
    fireEvent.click(screen.getByRole('button', { name: 'Add link' }));
    expect(screen.getByLabelText('Amount')).toHaveValue(3400);
    expect(screen.getByLabelText('Currency')).toHaveValue('PLN');
    expect(screen.getByLabelText('Payment limit')).toHaveValue(100);
  });
});
