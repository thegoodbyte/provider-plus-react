import { fireEvent, render, screen } from '@testing-library/react';
import RevolutPaymentLinkPicker from './RevolutPaymentLinkPicker';
import { revolutPaymentLinksApi } from '../services/api';

jest.mock('../services/api', () => ({ revolutPaymentLinksApi: { list: jest.fn() } }));
const catalog: any[] = [{ _id:'r1', name:'3400 PLN payment', checkoutUrl:'https://checkout.revolut.com/pay/3df332ae-ffe2-44bd-b662-080d4a2b0227', amount:3400, currency:'PLN', status:'active', remainingPayments:99 }];

describe('RevolutPaymentLinkPicker', () => {
  beforeEach(() => (revolutPaymentLinksApi.list as jest.Mock).mockResolvedValue({ data: catalog }));
  it('chooses a catalog link and returns its checkout URL', async () => {
    const onChange = jest.fn(); render(<RevolutPaymentLinkPicker value="" amount="3400" currency="PLN" onChange={onChange} />);
    await screen.findByRole('option', { name:/3400 PLN payment/ });
    fireEvent.change(screen.getByLabelText('Choose from payment-link catalog'), { target:{ value:'r1' } });
    expect(onChange).toHaveBeenCalledWith(catalog[0].checkoutUrl);
    expect(screen.getByText(/99 uses left/)).toBeInTheDocument();
  });
  it('keeps manual paste available when the catalog cannot load', async () => {
    (revolutPaymentLinksApi.list as jest.Mock).mockRejectedValue(new Error('offline'));
    const onChange = jest.fn(); render(<RevolutPaymentLinkPicker value="" onChange={onChange} />);
    expect(await screen.findByText(/Catalog unavailable/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Revolut payment link'), { target:{ value:'https://revolut.me/custom' } });
    expect(onChange).toHaveBeenCalledWith('https://revolut.me/custom');
  });
});
