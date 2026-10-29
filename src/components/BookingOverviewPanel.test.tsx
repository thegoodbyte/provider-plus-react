import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import BookingOverviewPanel, { formatBookingDate, formatHistoryDateTime, retreatTown, sentConfirmationStep, bookingStartDays } from './BookingOverviewPanel';
import { paymentsApi } from '../services/api';
import { useBookingRequirements } from './useBookingRequirements';
import { BookingType } from '../constants/eventTypes';

jest.mock('../services/api', () => ({ paymentsApi: { getFinancialSummary: jest.fn() } }));
jest.mock('./useBookingRequirements', () => ({ useBookingRequirements: jest.fn() }));
const requirement = { key: 'ekg', label: 'Entry EKG', required: true, uploaded: false, satisfied: false, reviewed: false, relatedItems: [] };
const summary = { sourceState:'verified_ledger',paidInFull:false,currency: 'USD', price: 100, netPaid: 40, balance: 60, overpayment: 0 };
const base = { bookingId: 'b', booking: { bookingNumber: 3, bookingHash: 'booking-hash', totalAmount: 100, currency: 'USD', registrationDate: '2026-01-01', bookingConfirmationHistory: [] }, client: { _id: 'c', email: 'a@b.com', phone: '1', country: 'CZ' }, retreat: { _id: 'r', name: 'Retreat', locationTown: 'Mistrovice', startDate: '2026-09-01', endDate: '2026-09-08' }, clientName: 'Ada', bookingTypeCode: 'F', retreatCode: 'RET', retreatAddress: 'Address', onEditClient: jest.fn(), onBookingRefresh: jest.fn(), onOpenTab: jest.fn(), onSendConfirmation: jest.fn() };
beforeEach(() => {
  jest.clearAllMocks();
  (paymentsApi.getFinancialSummary as jest.Mock).mockResolvedValue({ data: summary });
  (useBookingRequirements as jest.Mock).mockReturnValue({ rows: [requirement], items: [], loading: false, error: '', reload: jest.fn() });
});

it('formats dates and towns safely', () => {
  expect(formatBookingDate()).toBe('N/A'); expect(formatBookingDate('bad')).toBe('N/A'); expect(formatHistoryDateTime('bad')).toBe('N/A'); expect(retreatTown({ house: { city: 'Town' } })).toBe('Town');
});

it('fetches a condensed payment summary for the exact booking, and refreshes it on demand', async () => {
  render(<BookingOverviewPanel {...base} refreshKey={4} />);
  await waitFor(() => expect(paymentsApi.getFinancialSummary).toHaveBeenCalledWith('b'));
  expect(await screen.findByText('$60.00')).toBeInTheDocument();
  expect(screen.getByText('$40.00')).toBeInTheDocument();
  expect(screen.getByText('40% paid')).toBeInTheDocument();
  expect(useBookingRequirements).toHaveBeenCalledWith({ bookingId: 'b', clientId: 'c', retreatId: 'r', refreshKey: 4 });
  fireEvent.click(screen.getByRole('button', { name: 'Refresh payment summary' }));
  await waitFor(() => expect(paymentsApi.getFinancialSummary).toHaveBeenCalledTimes(2));
});

it('shows every reference section expanded, with no clicks needed, and opens the requirements tab deliberately', async () => {
  render(<BookingOverviewPanel {...base} retreatAddress="123 Main St" />);
  await screen.findByText('$60.00');
  expect(screen.getByText('Entry EKG')).toBeVisible();
  expect(screen.getByText('123 Main St')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Open all requirements' })); expect(base.onOpenTab).toHaveBeenCalledWith('requirements');
});

it('shows paid-in-full state once the balance clears', async () => {
  (paymentsApi.getFinancialSummary as jest.Mock).mockResolvedValue({ data: { sourceState:'verified_ledger',paidInFull:true,currency: 'USD', price: 100, netPaid: 100, balance: 0, overpayment: 0 } });
  render(<BookingOverviewPanel {...base} />);
  expect(await screen.findByText('Paid in full')).toBeInTheDocument();
});

it('shows overpayment as client credit, not a balance due', async () => {
  (paymentsApi.getFinancialSummary as jest.Mock).mockResolvedValue({ data: { sourceState:'verified_ledger',paidInFull:true,currency: 'USD', price: 100, netPaid: 120, balance: 0, overpayment: 20 } });
  render(<BookingOverviewPanel {...base} />);
  expect(await screen.findByText('Overpaid · credit')).toBeInTheDocument();
  expect(screen.getByText('$20.00')).toBeInTheDocument();expect(screen.getByText('Paid in full · credit available')).toBeVisible();expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow','100');
});

it('surfaces a financial summary fetch failure without crashing the rest of the panel', async () => {
  (paymentsApi.getFinancialSummary as jest.Mock).mockRejectedValue(new Error('down'));
  render(<BookingOverviewPanel {...base} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Financial summary unavailable.');
  expect(screen.getByText('Entry EKG')).toBeVisible();
});

it('preserves client contact, referral and accommodation details and edit/confirmation actions', async () => {
  render(<BookingOverviewPanel {...base} client={{ ...base.client, referralId: { _id: 'friend', name: 'Friend' }, referralAttributionType: 'self_identified' }} booking={{ ...base.booking, roomType: 'private_ensuite', roomNumber: 'Room 3' }} />);
  await screen.findByText('$60.00');
  const rail = within(screen.getByRole('complementary', { name: 'Booking client summary' }));
  expect(rail.getByRole('link', { name: 'a@b.com' })).toHaveAttribute('href', 'mailto:a@b.com'); expect(rail.getByText('Friend · Self-identified')).toBeInTheDocument();
  expect(rail.getByText('Private room, private bathroom · Room 3')).toBeInTheDocument();
  fireEvent.click(rail.getByRole('button', { name: 'Edit' })); expect(base.onEditClient).toHaveBeenCalled();
  fireEvent.click(rail.getByRole('button', { name: 'Send confirmation' })); expect(base.onSendConfirmation).toHaveBeenCalled();
});

it('recognizes both legacy and completed booking-flow confirmation history', async () => {
  (useBookingRequirements as jest.Mock).mockReturnValue({ rows: [requirement], items: [{ key: 'booking_confirmation_sent', status: 'sent', emailSentAt: '2026-01-03' }], loading: false, error: '' });
  render(<BookingOverviewPanel {...base} />);
  await screen.findByText('$60.00');
  expect(screen.getAllByText('Sent').length).toBeGreaterThan(0); expect(screen.getByText(/^Last sent /)).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Send again' })).toBeEnabled();
  expect(sentConfirmationStep([{ key: 'booking_confirmation_sent', status: 'pending' } as any])).toBeUndefined();
});

it('shows legacy confirmation history even without a completed flow item', async () => {
  render(<BookingOverviewPanel {...base} booking={{ ...base.booking, bookingConfirmationHistory: [{ sentAt: '2026-01-02' }] }} />);
  await screen.findByText('$60.00');
  expect(screen.getAllByText('Sent').length).toBeGreaterThan(0);
});

it('does not claim requirements complete or confirmation unsent while source loading fails', async () => {
  const reload = jest.fn(); (useBookingRequirements as jest.Mock).mockReturnValue({ rows: [], items: [], loading: false, error: 'Requirements unavailable', reload });
  render(<BookingOverviewPanel {...base} />);
  await screen.findByText('$60.00');
  expect(screen.getByText('Requirements unavailable')).toBeInTheDocument(); expect(screen.queryByText('No outstanding required items.')).not.toBeInTheDocument();
  expect(screen.getByText('Status unavailable')).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Send confirmation' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Retry requirements' })); expect(reload).toHaveBeenCalled();
});

it('keeps booster dates instead of the containing retreat dates in both the main column and the header', async () => {
  render(<BookingOverviewPanel {...base} booking={{ ...base.booking, bookingType: BookingType.BOOSTER, boosterStartDate: '2026-09-03', boosterEndDate: '2026-09-04', checkInDate: '2026-09-01', checkOutDate: '2026-09-08' }} />);
  await screen.findByText('$60.00');
  expect(screen.getAllByText('Sep 3, 2026').length).toBeGreaterThan(0); expect(screen.getAllByText('Sep 4, 2026').length).toBeGreaterThan(0);
  expect(screen.getByText('Check-in').closest('div')).toHaveTextContent('Sep 3, 2026');
  expect(screen.getByText('Check-out').closest('div')).toHaveTextContent('Sep 4, 2026');
});

it('retries a failed financial read and never marks a missing price paid', async () => {
  (paymentsApi.getFinancialSummary as jest.Mock).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({data:{...summary,price:0,netPaid:0,balance:0}});
  render(<BookingOverviewPanel {...base}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Retry payment summary'}));
  expect(await screen.findByText('No booking price recorded')).toBeVisible();
  expect(screen.queryByText('Paid in full')).not.toBeInTheDocument();
});
it('rejects invalid financial payloads instead of displaying fabricated paid state',async()=>{
  (paymentsApi.getFinancialSummary as jest.Mock).mockResolvedValue({data:{...summary,currency:'invalid'}});
  render(<BookingOverviewPanel {...base}/>);expect(await screen.findByRole('alert')).toHaveTextContent('Financial summary unavailable');
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
});
it('ignores a late response for the previous booking and refetches the current booking',async()=>{
  let finish: (value:any)=>void = ()=>{};
  (paymentsApi.getFinancialSummary as jest.Mock).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;})).mockResolvedValueOnce({data:{...summary,price:200,netPaid:0,balance:200}});
  const view=render(<BookingOverviewPanel {...base}/>);view.rerender(<BookingOverviewPanel {...base} bookingId="second"/>);
  expect((await screen.findAllByText('$200.00'))[0]).toBeVisible();finish({data:{...summary,netPaid:100,balance:0}});
  await waitFor(()=>expect(screen.queryByText('Paid in full')).not.toBeInTheDocument());
  expect(paymentsApi.getFinancialSummary).toHaveBeenLastCalledWith('second');
});
it('opens the existing payment tab and labels confirmation as unknown on error',async()=>{
  (useBookingRequirements as jest.Mock).mockReturnValue({rows:Array.from({length:7},(_,n)=>({...requirement,key:String(n),label:`Required ${n}`})),items:[],loading:false,error:'Unavailable',reload:jest.fn()});
  render(<BookingOverviewPanel {...base}/>);await screen.findByText('$60.00');
  fireEvent.click(screen.getByRole('button',{name:'View payments'}));expect(base.onOpenTab).toHaveBeenCalledWith('payments');
  expect(screen.getByText('Confirmation unavailable')).toBeVisible();expect(screen.queryByText('Confirmation not sent')).not.toBeInTheDocument();
});
it('uses retreat calendar dates for full stays despite legacy check-in timestamps',async()=>{
  render(<BookingOverviewPanel {...base} booking={{...base.booking,checkInDate:'2026-08-01',checkOutDate:'2026-10-01'}}/>);await screen.findByText('$60.00');
  expect(screen.getByText('Check-in').closest('div')).toHaveTextContent('Sep 1, 2026');expect(screen.getByText('Check-out').closest('div')).toHaveTextContent('Sep 8, 2026');
});
it('uses calendar days for countdown across midnight, month end and DST',()=>{
  expect(bookingStartDays('2026-03-30',new Date(2026,2,29,23,59))).toBe(1);
  expect(bookingStartDays('2026-11-01',new Date(2026,9,31,23,59))).toBe(1);
  expect(bookingStartDays('2026-10-29',new Date(2026,9,29,23,59))).toBe(0);
  expect(bookingStartDays('bad')).toBeNull();
});

it('shows the complete outstanding count when only the first five labels fit',async()=>{
  (useBookingRequirements as jest.Mock).mockReturnValue({rows:Array.from({length:7},(_,n)=>({...requirement,key:String(n),label:`Required ${n}`})),items:[],loading:false,error:'',reload:jest.fn()});
  render(<BookingOverviewPanel {...base}/>);await screen.findByText('$60.00');
  expect(screen.getByText('7 required items need attention.')).toBeVisible();expect(screen.getByText('+2 more · open all requirements to review.')).toBeVisible();
});

it('never calls unreconciled cached history fully paid, even if it has a zero displayed balance',async()=>{
 (paymentsApi.getFinancialSummary as jest.Mock).mockResolvedValue({data:{...summary,netPaid:100,balance:0,sourceState:'unreconciled_history'}});
 render(<BookingOverviewPanel {...base}/>);expect(await screen.findByText('Payment history needs reconciliation. Open payments to review.')).toBeVisible();expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();expect(screen.queryByText('Paid in full')).not.toBeInTheDocument();
});

it('shows saved stay instants on the retreat calendar day, independent of the viewer timezone',()=>{
 expect(formatBookingDate('2099-03-28T16:30:00Z')).toBe('Mar 28, 2099');
 expect(formatBookingDate('2099-03-30T22:00:00Z')).toBe('Mar 31, 2099');
});
