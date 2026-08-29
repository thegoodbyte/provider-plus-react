import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { paymentRequestsApi } from '../services/api';
import SearchablePaymentRequestSelect from './SearchablePaymentRequestSelect';

jest.mock('../services/api', () => ({ paymentRequestsApi: { getAllFresh: jest.fn() } }));
const getAllFresh = paymentRequestsApi.getAllFresh as jest.Mock;
const requests: any[] = [
  { _id: 'p1', invoiceNumber: 'INV-100', clientId: { _id: 'c1', firstName: 'Ada', lastName: 'Lovelace' }, retreatId: { _id: 'r1', name: 'Poland', location: 'Poznan' }, fullPriceQuote: 1000, currency: 'EUR', paymentDate: '2026-08-01' },
  { _id: 'p2', display_id: 22, clientId: 'c2', retreatId: 'r2', fullPriceQuote: 990, currency: 'USD' },
  { _id: 'p3', clientId: {}, retreatId: {}, fullPriceQuote: 50, currency: 'PLN' },
];

describe('SearchablePaymentRequestSelect', () => {
  beforeEach(() => { jest.clearAllMocks(); getAllFresh.mockResolvedValue({ data: requests }); });

  it('loads, searches invoice/client/retreat metadata and selects a request', async () => {
    const onSelect = jest.fn();
    render(<SearchablePaymentRequestSelect onPaymentRequestSelect={onSelect} className="wide" />);
    fireEvent.click(screen.getByRole('button', { name: /Search invoice/ }));
    expect(await screen.findByText('INV-100')).toBeInTheDocument();
    const input = screen.getByPlaceholderText('Search invoice, client, or retreat');
    fireEvent.change(input, { target: { value: 'ada' } });
    expect(screen.getByText('Ada Lovelace - Poland - Poznan')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: '2026-08' } });
    expect(screen.getByText('INV-100')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'eur' } });
    fireEvent.click(screen.getByText('INV-100'));
    expect(onSelect).toHaveBeenCalledWith('p1', requests[0]);
  });

  it('filters requests to the supplied client and retreat', async () => {
    render(<SearchablePaymentRequestSelect clientId="c2" retreatId="r2" onPaymentRequestSelect={jest.fn()} />);
    fireEvent.click(screen.getByRole('button'));
    expect(await screen.findByText('#22')).toBeInTheDocument();
    expect(screen.queryByText('INV-100')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '990' } });
    expect(screen.getByText('#22')).toBeInTheDocument();
  });

  it('renders the selected request and toggles the menu', async () => {
    render(<SearchablePaymentRequestSelect selectedPaymentRequestId="p2" onPaymentRequestSelect={jest.fn()} />);
    expect(await screen.findByText('#22 - c2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('shows empty results for invalid API data and loading errors', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    getAllFresh.mockResolvedValueOnce({ data: {} });
    const { unmount } = render(<SearchablePaymentRequestSelect onPaymentRequestSelect={jest.fn()} />);
    fireEvent.click(screen.getByRole('button'));
    expect(await screen.findByText('No payment requests found')).toBeInTheDocument();
    unmount();
    getAllFresh.mockRejectedValueOnce(new Error('offline'));
    render(<SearchablePaymentRequestSelect onPaymentRequestSelect={jest.fn()} />);
    fireEvent.click(screen.getByRole('button'));
    expect(await screen.findByText('No payment requests found')).toBeInTheDocument();
    await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('Error loading payment requests:', expect.any(Error)));
    errorSpy.mockRestore();
  });
});
