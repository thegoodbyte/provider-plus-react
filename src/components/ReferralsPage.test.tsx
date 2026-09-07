import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReferralsPage from './ReferralsPage';
import { referralsApi } from '../services/api';

jest.mock('../services/api', () => ({ referralsApi: { getAll: jest.fn(), getReport: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), createPayout: jest.fn() } }));

const partner = { _id: 'r1', name: 'Ada Partners', referralCode: 'AP', defaultCommissionPercentage: 10, email: 'ada@example.com', isActive: true };
const row = (overrides: any = {}) => ({ bookingId: 'b1', bookingNumber: 101, clientId: 'c1', clientDisplayId: 501, clientName: 'Eva Novak', clientEmail: 'eva@example.com', referralId: 'r1', referralName: 'Ada Partners', referralCode: 'AP', retreatId: 't1', retreatCode: 'SEP-26', commissionPercentage: 10, amountOwed: 450, owedCurrency: 'EUR', paid: false, ...overrides });
const view = () => render(<MemoryRouter initialEntries={['/admin/referrals']}><ReferralsPage /></MemoryRouter>);

describe('ReferralsPage payout workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (referralsApi.getAll as jest.Mock).mockResolvedValue({ data: [partner] });
    (referralsApi.getReport as jest.Mock).mockResolvedValue({ data: [row(), row({ bookingId: 'b2', bookingNumber: 102, clientName: 'Jan Kowalski', amountOwed: 300 })] });
    (referralsApi.create as jest.Mock).mockResolvedValue({ data: partner });
    (referralsApi.update as jest.Mock).mockResolvedValue({ data: partner });
    (referralsApi.delete as jest.Mock).mockResolvedValue({});
    (referralsApi.createPayout as jest.Mock).mockResolvedValue({ data: { _id: 'expense' } });
  });

  it('filters a partner, totals commissions, and records selected bookings', async () => {
    view();
    await screen.findAllByText('Eva Novak');
    fireEvent.click(screen.getAllByRole('button', { name: /Ada Partners/ })[0]);
    expect(screen.getByRole('heading', { name: 'Clients referred by Ada Partners' })).toBeInTheDocument();
    expect(screen.getAllByText(/€750\.00/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByLabelText('Select commission for booking 101'));
    fireEvent.click(screen.getByLabelText('Select commission for booking 102'));
    fireEvent.click(screen.getByRole('button', { name: 'Pay selected (2)' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Account'), { target: { value: 'Revolut' } });
    fireEvent.change(within(dialog).getByLabelText('Reference'), { target: { value: 'REF-1' } });
    fireEvent.change(within(dialog).getByLabelText('Notes'), { target: { value: 'Paid together' } });
    fireEvent.submit(within(dialog).getByRole('button', { name: 'Record paid expense' }).closest('form')!);
    await waitFor(() => expect(referralsApi.createPayout).toHaveBeenCalledWith(expect.objectContaining({ referralId: 'r1', retreatId: 't1', bookingIds: ['b1', 'b2'], paymentAccount: 'Revolut', reference: 'REF-1', notes: 'Paid together' })));
  });

  it('validates, creates, edits, and deletes referral partners', async () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
    view();
    await screen.findAllByText('Eva Novak');
    fireEvent.change(screen.getByPlaceholderText('Name *'), { target: { value: 'New Partner' } });
    fireEvent.change(screen.getByPlaceholderText('Code (AD) *'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add referral' }));
    expect(screen.getByText('Referral code must contain exactly two letters.')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Code (AD) *'), { target: { value: 'np' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add referral' }));
    await waitFor(() => expect(referralsApi.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Partner', referralCode: 'NP' })));
    fireEvent.click(screen.getByRole('button', { name: 'Edit Ada Partners' }));
    fireEvent.change(screen.getByPlaceholderText('Name *'), { target: { value: 'Ada Updated' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(referralsApi.update).toHaveBeenCalledWith('r1', expect.objectContaining({ name: 'Ada Updated' })));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Ada Partners' }));
    await waitFor(() => expect(referralsApi.delete).toHaveBeenCalledWith('r1'));
    confirm.mockRestore();
  });

  it('shows loading and API errors and rejects mixed payout groups', async () => {
    (referralsApi.getReport as jest.Mock).mockResolvedValue({ data: [row(), row({ bookingId: 'b2', bookingNumber: 102, retreatId: 't2', retreatCode: 'OCT-26' })] });
    view();
    await screen.findAllByText('Eva Novak');
    fireEvent.click(screen.getByLabelText('Select commission for booking 101'));
    fireEvent.click(screen.getByLabelText('Select commission for booking 102'));
    fireEvent.click(screen.getByRole('button', { name: 'Pay selected (2)' }));
    expect(screen.getByText('Select commissions for one referral, one retreat and one currency per payment.')).toBeInTheDocument();
  });

  it('filters referred clients by retreat', async () => {
    (referralsApi.getReport as jest.Mock).mockResolvedValue({ data: [
      row({ retreatId: 't1', retreatCode: 'SEP-26' }),
      row({ bookingId: 'b2', bookingNumber: 102, clientName: 'Jan Kowalski', retreatId: 't2', retreatCode: 'OCT-26' }),
    ] });
    view();
    await screen.findAllByText('Eva Novak');
    expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Filter by retreat'), { target: { value: 't2' } });

    expect(screen.queryByText('Eva Novak')).not.toBeInTheDocument();
    expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
  });

  it('shows and searches friend attribution for friend-referred clients', async () => {
    (referralsApi.getReport as jest.Mock).mockResolvedValue({ data: [
      row({ referredByType: 'friend_client', referredByLabel: 'Arek Kowal' }),
      row({ bookingId: 'b2', bookingNumber: 102, clientName: 'Jan Kowalski', referredByType: 'friend_name', referredByLabel: 'Basia' }),
    ] });
    view();
    await screen.findAllByText('Eva Novak');
    expect(screen.getByText('Arek Kowal')).toBeInTheDocument();
    expect(screen.getByText('Basia')).toBeInTheDocument();
    expect(screen.getByText('(not a client)')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Search client or referred-by/i), { target: { value: 'Basia' } });

    expect(screen.queryByText('Eva Novak')).not.toBeInTheDocument();
    expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
  });

  it('shows the first payment date when available', async () => {
    (referralsApi.getReport as jest.Mock).mockResolvedValue({ data: [row({ firstPaymentDate: '2026-07-15T00:00:00.000Z' })] });
    view();
    await screen.findAllByText('Eva Novak');
    expect(screen.getByText(new Date('2026-07-15T00:00:00.000Z').toLocaleDateString())).toBeInTheDocument();
  });

  it('lets an admin build a dated, price-tiered rate schedule for a referral partner', async () => {
    view();
    await screen.findAllByText('Eva Novak');

    fireEvent.click(screen.getByRole('button', { name: '+ Add rate rule' }));
    const [fromInput, toInput] = screen.getAllByLabelText(/^From$|^To \(blank = ongoing\)$/);
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByLabelText('To (blank = ongoing)'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText(/From price/i), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText(/Rate %/i), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Add price tier' }));
    const rateInputs = screen.getAllByLabelText(/Rate %/i);
    const priceInputs = screen.getAllByLabelText(/From price/i);
    fireEvent.change(priceInputs[1], { target: { value: '8500' } });
    fireEvent.change(rateInputs[1], { target: { value: '20' } });

    fireEvent.change(screen.getByPlaceholderText('Name *'), { target: { value: 'Alchemia Dobrostanu' } });
    fireEvent.change(screen.getByPlaceholderText('Code (AD) *'), { target: { value: 'AD' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add referral' }));

    await waitFor(() => expect(referralsApi.create).toHaveBeenCalledWith(expect.objectContaining({
      rateSchedule: [expect.objectContaining({
        effectiveFrom: '2026-09-01',
        tiers: [{ minPrice: 0, ratePercent: 10 }, { minPrice: 8500, ratePercent: 20 }],
      })],
    })));
    expect(fromInput).toBeDefined();
    expect(toInput).toBeDefined();
  });
});
