import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReferralsPage from './ReferralsPage';
import { api, referralsApi } from '../services/api';

jest.mock('../services/api', () => ({ api: { get: jest.fn().mockResolvedValue({ data: null }), put: jest.fn().mockResolvedValue({ data: {} }) }, referralsApi: { getAssignmentNotifications: jest.fn(), getAll: jest.fn(), getReport: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), createPayout: jest.fn(), getPayouts: jest.fn() } }));

const partner = { _id: 'r1', name: 'Ada Partners', referralCode: 'AP', defaultCommissionPercentage: 10, email: 'ada@example.com', isActive: true };
const row = (overrides: any = {}) => ({ bookingId: 'b1', bookingNumber: 101, clientId: 'c1', clientDisplayId: 501, clientName: 'Eva Novak', clientEmail: 'eva@example.com', referralId: 'r1', referralName: 'Ada Partners', referralCode: 'AP', retreatId: 't1', retreatCode: 'SEP-26', commissionPercentage: 10, amountOwed: 450, owedCurrency: 'EUR', paid: false, ...overrides });
const view = (path = '/admin/referrals/commissions') => render(<MemoryRouter initialEntries={[path]}><ReferralsPage /></MemoryRouter>);

describe('ReferralsPage payout workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.get as jest.Mock).mockResolvedValue({ data: null });
    (api.put as jest.Mock).mockResolvedValue({ data: {} });
    (referralsApi.getAssignmentNotifications as jest.Mock).mockResolvedValue({ data: [] });
    (referralsApi.getAll as jest.Mock).mockResolvedValue({ data: [partner] });
    (referralsApi.getReport as jest.Mock).mockResolvedValue({ data: [row(), row({ bookingId: 'b2', bookingNumber: 102, clientName: 'Jan Kowalski', amountOwed: 300 })] });
    (referralsApi.create as jest.Mock).mockResolvedValue({ data: partner });
    (referralsApi.update as jest.Mock).mockResolvedValue({ data: partner });
    (referralsApi.delete as jest.Mock).mockResolvedValue({});
    (referralsApi.getPayouts as jest.Mock).mockResolvedValue({ data: [] });
    (referralsApi.createPayout as jest.Mock).mockResolvedValue({ data: { _id: 'expense' } });
  });

  it('opens a searchable directory with no editor or commissions, then navigates to detail and settings', async () => {
    (referralsApi.getAll as jest.Mock).mockResolvedValue({ data: [partner, { ...partner, _id: 'r2', name: 'Inactive Friend', referralCode: 'IF', isActive: false }] });
    view('/admin/referrals');
    await screen.findByRole('link', { name: 'Ada Partners' });
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Partner status'), { target: { value: 'inactive' } });
    expect(screen.queryByRole('link', { name: 'Ada Partners' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Partner status'), { target: { value: 'all' } });
    fireEvent.change(screen.getByLabelText('Search partners'), { target: { value: 'AP' } });
    expect(screen.queryByRole('link', { name: 'Inactive Friend' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Ada Partners' }));
    expect(await screen.findByRole('region', { name: 'Partner overview' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'View commissions' })).toHaveAttribute('href', '/admin/referrals/commissions?referralId=r1');
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Edit Ada Partners' }));
    expect(await screen.findByRole('form', { name: 'Referral settings' })).toBeVisible();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Referral portal access' })).not.toBeInTheDocument();
  });

  it('keeps the editor usable when commission summaries are unavailable and does not request a report', async () => {
    (referralsApi.getReport as jest.Mock).mockRejectedValue(new Error('Summary unavailable'));
    view('/admin/referrals/r1/edit');
    await screen.findByRole('form', { name: 'Referral settings' });
    expect(referralsApi.getReport).not.toHaveBeenCalled();
  });

  it('shows missing partner and retryable list failures without creating an empty edit form', async () => {
    (referralsApi.getAll as jest.Mock).mockRejectedValueOnce(new Error('Temporary list failure'));
    view('/admin/referrals/missing/edit');
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load referral partners.');
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry', exact: true }));
    await screen.findByText('This referral partner could not be found.');
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('redirects legacy referral links to the commission screen preserving partner scope', async () => {
    view('/admin/referrals?referralId=r1');
    await screen.findByRole('heading', { name: 'Clients referred by Ada Partners' });
    expect(screen.getByLabelText('Filter by referral')).toHaveValue('r1');
    expect(screen.getByRole('link', { name: 'Payment history', exact: true })).toHaveAttribute('href', '/admin/referrals/payments?referralId=r1');
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('preserves the unprefixed referral route and provides a dedicated payment screen', async () => {
    view('/referrals?view=payments&referralId=r1');
    await screen.findByRole('heading', { name: 'Referral payment history' });
    expect(screen.getByRole('link', { name: 'Partners', exact: true })).toHaveAttribute('href', '/referrals');
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });





  it('provides one date-based setup and saves 19% followed by 20%', async () => {
    view('/admin/referrals/r1/edit');
    await screen.findByRole('heading', { name: 'Edit Ada Partners' });
    expect(screen.queryByRole('region', { name: 'Rate schedule' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Influence commission/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add commission package' }));
    fireEvent.change(screen.getByLabelText('Package From'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('Package To (blank = ongoing)'), { target: { value: '2026-12-31' } });
    fireEvent.change(screen.getByLabelText('Starting percentage'), { target: { value: '19' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add percentage change' }));
    fireEvent.change(screen.getByLabelText('Rate From'), { target: { value: '2026-06-15' } });
    fireEvent.change(screen.getByLabelText('New percentage'), { target: { value: '20' } });
    expect(screen.getByText('2026-01-01 to 2026-06-14 · 19%')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(referralsApi.update).toHaveBeenCalledWith('r1', expect.objectContaining({ commissionMode: 'dated_percentage', commissionPackages: [expect.objectContaining({ bookingCurrency: '*', rates: [{ effectiveFrom: '2026-01-01', ratePercent: 19 }, { effectiveFrom: '2026-06-15', ratePercent: 20 }] })] })));
    expect(await screen.findByText('Referral saved.')).toBeInTheDocument();
  });

  it('preserves percentages after a failed save and permits retry', async () => {
    view('/admin/referrals/r1/edit');
    await screen.findByRole('heading', { name: 'Edit Ada Partners' });
    fireEvent.click(screen.getByRole('button', { name: 'Add commission package' }));
    fireEvent.change(screen.getByLabelText('Package From'), { target: { value: '2026-06-15' } });
    fireEvent.change(screen.getByLabelText('Starting percentage'), { target: { value: '20' } });
    (referralsApi.update as jest.Mock).mockRejectedValueOnce({ response: { status: 503 } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save referral. The service is temporarily unavailable.');
    expect(screen.getByLabelText('Starting percentage')).toHaveValue(20);
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByText('Referral saved.');
  });

  it('has one save button and blocks duplicate submissions while pending', async () => {
    let complete: (value: any) => void = () => {};
    (referralsApi.update as jest.Mock).mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    view('/admin/referrals/r1/edit');
    await screen.findByRole('heading', { name: 'Edit Ada Partners' });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getAllByRole('button', { name: 'Saving…' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(referralsApi.update).toHaveBeenCalledTimes(1);
    complete({ data: partner });
    await screen.findByText('Referral saved.');
  });

  it('keeps an existing fixed/currency agreement unchanged until explicitly replaced', async () => {
    const existing = { ...partner, influenceCommissionPercentage: 0, commissionPackages: [{ key: 'fixed', name: 'Fixed USD', kind: 'fixed', amount: 500, currency: 'USD', bookingCurrency: '*', effectiveFrom: '2026-01-01' }] };
    (referralsApi.getAll as jest.Mock).mockResolvedValue({ data: [existing] });
    view('/admin/referrals/r1/edit');
    await screen.findByRole('heading', { name: 'Edit Ada Partners' });
    expect(screen.getByRole('region', { name: 'Existing commission agreement' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Contact phone'), { target: { value: '+420 777 123 456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(referralsApi.update).toHaveBeenCalled());
    const body = (referralsApi.update as jest.Mock).mock.calls[0][1];
    expect(body).not.toHaveProperty('commissionPackages');
    expect(body).not.toHaveProperty('influenceCommissionPercentage');
    fireEvent.click(screen.getByRole('button', { name: 'Use date-based percentages' }));
    expect(screen.getByRole('region', { name: 'Commission packages' })).toBeInTheDocument();
  });

  it('rejects overlapping package dates before calling the API', async () => {
    view('/admin/referrals/r1/edit');
    await screen.findByRole('heading', { name: 'Edit Ada Partners' });
    for (let index = 0; index < 2; index++) {
      fireEvent.click(screen.getByRole('button', { name: 'Add commission package' }));
      fireEvent.change(screen.getAllByLabelText('Package From')[index], { target: { value: '2026-06-15' } });
      fireEvent.change(screen.getAllByLabelText('Starting percentage')[index], { target: { value: '20' } });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Package dates overlap');
    expect(referralsApi.update).not.toHaveBeenCalled();
  });

  it('filters a partner, totals commissions, and records selected bookings', async () => {
    view();
    await screen.findAllByText('Eva Novak');
    fireEvent.change(screen.getByLabelText('Filter by referral'), { target: { value: 'r1' } });
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

  it('validates and creates a partner on its dedicated screen', async () => {
    view('/admin/referrals/new');
    await screen.findByRole('form', { name: 'Referral settings' });
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Name *'), { target: { value: 'New Partner' } });
    fireEvent.change(screen.getByPlaceholderText('Code (AD) *'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add referral' }));
    expect(screen.getByText('Referral code must contain exactly two letters.')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Code (AD) *'), { target: { value: 'np' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add referral' }));
    await waitFor(() => expect(referralsApi.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Partner', referralCode: 'NP' })));
    await screen.findByRole('heading', { name: 'Edit Ada Partners' });
  });

  it('deletes a partner from its overview and returns to the directory', async () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
    view('/admin/referrals/r1');
    await screen.findByRole('button', { name: 'Delete Ada Partners' });
    fireEvent.click(screen.getByRole('button', { name: 'Delete Ada Partners' }));
    await waitFor(() => expect(referralsApi.delete).toHaveBeenCalledWith('r1'));
    await screen.findByRole('heading', { name: 'Referral partners' });
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

  it('shows the booking date used for commission selection', async () => {
    (referralsApi.getReport as jest.Mock).mockResolvedValue({ data: [row({ registrationDate: '2026-07-15T00:00:00.000Z', firstPaymentDate: '2026-08-01T00:00:00.000Z' })] });
    view();
    await screen.findAllByText('Eva Novak');
    expect(screen.getByText(new Date('2026-07-15T00:00:00.000Z').toLocaleDateString())).toBeInTheDocument();
  });

  it('provisions a separate partner account without changing the referral record', async () => {
    view('/admin/referrals/r1/access');
    await screen.findByRole('heading', { name: 'Portal access' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create referral login and PIN' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Create referral login and PIN' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/referrals/r1/portal-account', { email: 'ada@example.com', active: true, resetPin: true }));
    expect(referralsApi.update).not.toHaveBeenCalled();
  });

});
