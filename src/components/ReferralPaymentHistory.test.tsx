import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReferralPaymentHistory from './ReferralPaymentHistory';
import ReferralExpenseDetails from './ReferralExpenseDetails';
import { referralsApi } from '../services/api';
jest.mock('../services/api', () => ({ referralsApi: { getPayouts: jest.fn(), voidPayout: jest.fn() } }));
const paid: any = { _id: 'e1', referralId: { _id: 'r1', name: 'Renamed partner', referralCode: 'NEW' }, retreatId: { _id: 't1', code: 'OCT-26' }, status: 'paid', amount: 50, currency: 'USD', expenseDate: '2026-10-13', paymentMethod: 'bank_transfer', paymentAccount: 'Business account', receiptNumber: 'REF-123', referralPayment: { referralName: 'Original partner', referralCode: 'OLD', recordedBy: 'staff@example.test' }, referralPayoutItems: [{ bookingId: 'b1', clientId: 'c1', clientName: 'Synthetic client', bookingNumber: 1259, amount: 50, currency: 'USD' }] };
const show = (props: any = {}) => render(<MemoryRouter><ReferralPaymentHistory prefix="/admin" {...props} /></MemoryRouter>);
beforeEach(() => { (referralsApi.getPayouts as jest.Mock).mockResolvedValue({ data: [paid, { ...paid, _id: 'e2', receiptNumber: 'REF-456', amount: 20, currency: 'EUR', referralId: 'r2', referralPayment: { referralName: 'Second partner', referralCode: 'TWO' }, referralPayoutItems: [] }] }); });
it('shows historical partner snapshots, separate currency totals and expense/booking links', async () => {
  show();
  await screen.findByText('Original partner');
  expect(screen.queryByText('Renamed partner')).not.toBeInTheDocument();
  expect(screen.getAllByText('$50.00').length).toBeGreaterThan(0);
  expect(screen.getAllByText('€20.00').length).toBeGreaterThan(0);
  expect(screen.getAllByRole('link', { name: 'View expense' })[0]).toHaveAttribute('href','/admin/expenses/e1');
  expect(screen.getByRole('link', { name: /1259/ })).toHaveAttribute('href','/admin/bookings/b1');
  fireEvent.change(screen.getByLabelText('Search referral payments'), { target: { value: 'REF-123' } });
  expect(screen.queryByText('Second partner')).not.toBeInTheDocument();
});
it('voids an incorrect record with a reason and refreshes the commission projection', async () => {
  const prompt = jest.spyOn(window, 'prompt').mockReturnValue('Wrong amount recorded');
  const onChanged = jest.fn().mockResolvedValue(undefined);
  (referralsApi.voidPayout as jest.Mock).mockResolvedValue({ data: {} });
  (referralsApi.getPayouts as jest.Mock).mockResolvedValueOnce({ data: [paid] }).mockResolvedValue({ data: [{ ...paid, amount: 0, status: 'rejected', referralPayment: { ...paid.referralPayment, originalAmount: 50, voidedAt: '2026-10-13', voidReason: 'Wrong amount recorded' } }] });
  show({ onChanged }); await screen.findByText('Original partner');
  fireEvent.click(screen.getByRole('button', { name: 'Void incorrect record' }));
  await screen.findByText('Voided');
  expect(referralsApi.voidPayout).toHaveBeenCalledWith('e1','Wrong amount recorded');
  await waitFor(() => expect(onChanged).toHaveBeenCalled());
  expect(screen.queryByText('Recorded paid · USD')).not.toBeInTheDocument();
  prompt.mockRestore();
});
it('links the expense back to the filtered payment register and allocated client', () => {
  render(<MemoryRouter><ReferralExpenseDetails expense={paid} prefix="/admin" /></MemoryRouter>);
  expect(screen.getByRole('link', { name: /referral/ })).toHaveAttribute('href','/admin/referrals?view=payments&referralId=r1');
  expect(screen.getByRole('link', { name: 'Synthetic client' })).toHaveAttribute('href','/admin/clients/c1');
});

it('shows legacy expenses without fake booking links or unsupported correction actions', async () => {
  (referralsApi.getPayouts as jest.Mock).mockResolvedValue({ data: [{ ...paid, _id: 'legacy', referralId: undefined, retreatId: undefined, vendor: 'Older partner', referralPayment: undefined, referralPayoutItems: [] }] });
  show();
  await screen.findByText('Older partner');
  expect(screen.getByText('Legacy expense · booking allocation review needed')).toBeVisible();
  expect(screen.getByText('Retreat not recorded')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Void incorrect record' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'View expense' })).toHaveAttribute('href', '/admin/expenses/legacy');
  expect(screen.getAllByRole('link')).toHaveLength(1);
});

it('filters inclusive expense dates and payment methods, and can show all partners again', async () => {
  (referralsApi.getPayouts as jest.Mock).mockResolvedValue({ data: [paid, { ...paid, _id: 'e2', referralId: 'r2', amount: 20, expenseDate: '2026-10-12', referralPayment: { referralName: 'Earlier partner' } }] });
  show({ initialReferral: 'r1' });
  await screen.findByText('Original partner');
  expect(screen.queryByText('Earlier partner')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Show all payments' }));
  expect(screen.getByText('Earlier partner')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Payment from date'), { target: { value: '2026-10-13' } });
  fireEvent.change(screen.getByLabelText('Payment through date'), { target: { value: '2026-10-13' } });
  expect(screen.queryByText('Earlier partner')).not.toBeInTheDocument();
  expect(screen.getByText('Original partner')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Search referral payments'), { target: { value: 'bank transfer' } });
  expect(screen.getByText('Original partner')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Search referral payments'), { target: { value: 'cash' } });
  expect(screen.getByText('No referral payments match these filters.')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Show all payments' }));
  expect(screen.getByLabelText('Payment from date')).toHaveValue('');
  expect(screen.getByText('Earlier partner')).toBeInTheDocument();
});

it('excludes pending and voided amounts from totals and preserves records on refresh failure', async () => {
  (referralsApi.getPayouts as jest.Mock).mockResolvedValue({ data: [paid, { ...paid, _id: 'pending', amount: 9999, status: 'pending', referralPayment: { referralName: 'Pending partner' } }, { ...paid, _id: 'voided', amount: 0, status: 'rejected', referralPayment: { originalAmount: 8000, voidedAt: '2026-10-14' } }] });
  show(); await screen.findByText('Original partner');
  expect(screen.getByText('3 payment records · 1 paid')).toBeVisible();
  expect(screen.getByText('Recorded paid · USD').parentElement).toHaveTextContent('$50.00');
  (referralsApi.getPayouts as jest.Mock).mockRejectedValueOnce({ response: { data: { message: 'History unavailable. Retry.' } } });
  fireEvent.click(screen.getByRole('button', { name: 'Refresh payments' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('History unavailable. Retry.');
  expect(screen.getByText('Original partner')).toBeVisible();
});
it('retains planned history but excludes it from actual paid totals and filters', async () => {
 (referralsApi.getPayouts as jest.Mock).mockResolvedValueOnce({ data: [{ ...paid, expenseKind: 'planned', amount: 4500 }] });
 show(); await screen.findByText('Original partner');
 expect(screen.queryByText('Recorded paid · USD')).toBeNull();
 expect(screen.getByText('Planned expense · not a recorded payment')).toBeVisible();
 fireEvent.change(screen.getByLabelText('Payment record status'), { target: { value: 'paid' } });
 expect(screen.queryByText('Original partner')).toBeNull();
});
