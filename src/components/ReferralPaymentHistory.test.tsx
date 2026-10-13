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
