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
    expect(await screen.findByRole('alert')).toHaveTextContent('Temporary list failure');
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

  it('shows section save buttons, explains precedence and keeps saved settings open', async () => {
    const commissionPackages = [{ key: 'summer', name: 'Summer 10%', effectiveFrom: '2026-06-01', bookingCurrency: 'EUR', kind: 'percentage', ratePercent: 10 }];
    (referralsApi.getAll as jest.Mock).mockResolvedValue({ data: [{ ...partner, commissionPackages }] });
    view('/admin/referrals/r1/edit');
    await screen.findByRole('heading', { name: 'Edit Ada Partners' });
    const packages = screen.getByRole('region', { name: 'Commission packages' });
    expect(within(packages).getByRole('button', { name: 'Save commission packages' })).toBeVisible();
    expect(screen.getByText(/this rate schedule is saved but does not apply/)).toBeVisible();
    fireEvent.change(within(packages).getByLabelText('Rate %'), { target: { value: '15' } });
    fireEvent.click(within(packages).getByRole('button', { name: 'Save commission packages' }));
    await waitFor(() => expect(referralsApi.update).toHaveBeenCalledWith('r1', expect.objectContaining({ commissionPackages: [expect.objectContaining({ ratePercent: 15 })], rateSchedule: [] })));
    expect(await screen.findByText('Referral saved. Rate schedule and commission packages are saved together.')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Partner details' })).toBeVisible();
    expect(within(packages).getByLabelText('Rate %')).toHaveValue(15);
    fireEvent.change(within(packages).getByLabelText('Rate %'), { target: { value: '16' } });
    expect(screen.queryByText('Referral saved. Rate schedule and commission packages are saved together.')).not.toBeInTheDocument();
  });

  it('saves a rate from its section and preserves edits on failure for retry', async () => {
    view('/admin/referrals/r1/edit');
    await screen.findByRole('heading', { name: 'Edit Ada Partners' });
    const rates = screen.getByRole('region', { name: 'Rate schedule' });
    fireEvent.click(within(rates).getByRole('button', { name: '+ Add rate rule' }));
    fireEvent.change(within(rates).getByLabelText('Rate %'), { target: { value: '12' } });
    (referralsApi.update as jest.Mock).mockRejectedValueOnce({ response: { data: { message: 'Could not store settings. Retry.' } } });
    fireEvent.click(within(rates).getByRole('button', { name: 'Save rate schedule' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not store settings. Retry.');
    expect(within(rates).getByLabelText('Rate %')).toHaveValue(12);
    expect(screen.queryByText('Referral saved. Rate schedule and commission packages are saved together.')).not.toBeInTheDocument();
    fireEvent.click(within(rates).getByRole('button', { name: 'Save rate schedule' }));
    await screen.findByText('Referral saved. Rate schedule and commission packages are saved together.');
    expect(referralsApi.update).toHaveBeenLastCalledWith('r1', expect.objectContaining({ rateSchedule: [expect.objectContaining({ tiers: [{ minPrice: 0, ratePercent: 12 }] })] }));
  });

  it('disables every save action while saving to prevent duplicate submissions', async () => {
    let complete: (value: any) => void = () => {};
    (referralsApi.update as jest.Mock).mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    view('/admin/referrals/r1/edit');
    await screen.findByRole('heading', { name: 'Edit Ada Partners' });
    fireEvent.click(screen.getByRole('button', { name: 'Save commission packages' }));
    expect(screen.getAllByRole('button', { name: 'Saving…' })).toHaveLength(3);
    screen.getAllByRole('button', { name: 'Saving…' }).forEach(button => expect(button).toBeDisabled());
    expect(referralsApi.update).toHaveBeenCalledTimes(1);
    complete({ data: partner });
    await screen.findByText('Referral saved. Rate schedule and commission packages are saved together.');
  });

  it('saves influence rates and repeat-credit rules, including an explicit zero', async () => {
    view('/admin/referrals/r1/edit');
    await screen.findByRole('heading', { name: 'Edit Ada Partners' });
    fireEvent.change(screen.getByLabelText(/Influence commission %/), { target: { value: '20' } });
    fireEvent.click(screen.getByLabelText('Allow explicitly credited repeat bookings'));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(referralsApi.update).toHaveBeenCalledWith('r1', expect.objectContaining({ influenceCommissionPercentage: 20, allowRepeatBookingCredit: false })));
    fireEvent.change(screen.getByLabelText(/Influence commission %/), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(referralsApi.update).toHaveBeenLastCalledWith('r1', expect.objectContaining({ influenceCommissionPercentage: 0 })));
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

  it('lets an admin build a dated, price-tiered rate schedule for a referral partner', async () => {
    view('/admin/referrals/new');
    await screen.findByRole('form', { name: 'Referral settings' });

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
  it('saves a fixed USD package with configurable booking dates', async () => {
    view('/admin/referrals/r1/edit');
    await screen.findByRole('heading', { name: 'Edit Ada Partners' });
    fireEvent.click(screen.getByRole('button', { name: 'Add commission package' }));
    fireEvent.change(screen.getByLabelText('Key'), { target: { value: 'C' } });
    fireEvent.change(screen.getByLabelText('Name', { exact: true }), { target: { value: 'Package C' } });
    fireEvent.change(screen.getByLabelText('Calculation'), { target: { value: 'fixed' } });
    fireEvent.change(screen.getByLabelText('From', { exact: true }), { target: { value: '2026-09-23' } });
    fireEvent.change(screen.getByLabelText('Amount', { exact: true }), { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(referralsApi.update).toHaveBeenCalledWith('r1', expect.objectContaining({ commissionPackages: [expect.objectContaining({ key: 'C', effectiveFrom: '2026-09-23', kind: 'fixed', amount: 500, currency: 'USD' })] })));
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
