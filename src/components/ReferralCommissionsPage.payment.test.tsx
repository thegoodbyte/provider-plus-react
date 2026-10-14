import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReferralCommissionsPage from './ReferralCommissionsPage';
import { referralsApi } from '../services/api';
jest.mock('../services/api', () => ({ referralsApi: { createPayout: jest.fn() } }));
const reference = 'julian.B-48574403692_BEN061726-1184';
const first: any = { bookingId: 'b1', bookingNumber: 1184, clientName: 'Julian B', clientId: 'c1', referralId: 'r1', referralName: 'Partner', retreatId: 't1', retreatCode: 'BEN-06-17-26', commissionPercentage: 20, amountOwed: 1700, owedCurrency: 'PLN', refereeId: reference };
const second = { ...first, bookingId: 'b2', bookingNumber: 1185, clientName: 'Anna N', amountOwed: 300, refereeId: 'anna.N-48123456789_BEN061726-1185' };
const writeText = jest.fn();
function view(report: any[] = [first, second], query = '') {
 return render(<MemoryRouter initialEntries={['/admin/referrals/commissions'+query]}><ReferralCommissionsPage rows={[]} report={report} loading={false} base="/admin/referrals" onChanged={async () => {}} /></MemoryRouter>);
}
beforeEach(() => { jest.clearAllMocks(); Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } }); writeText.mockResolvedValue(undefined); (referralsApi.createPayout as jest.Mock).mockResolvedValue({ data: {} }); });
it('shows and copies the exact canonical reference without recording a payment', async () => {
 view([first]);fireEvent.click(screen.getByRole('button', { name: 'Pay', exact: true }));
 const dialog = within(screen.getByRole('dialog'));
 expect(dialog.getByText(reference)).toBeVisible();expect(dialog.getByLabelText('Reference')).toHaveValue(reference);
 fireEvent.click(dialog.getByRole('button', { name: 'Copy reference for booking 1184' }));
 expect(await dialog.findByRole('status')).toHaveTextContent('Reference copied.');
 expect(writeText).toHaveBeenCalledWith(reference);expect(referralsApi.createPayout).not.toHaveBeenCalled();
 fireEvent.click(dialog.getByRole('button', { name: 'Record paid expense' }));
 await waitFor(() => expect(referralsApi.createPayout).toHaveBeenCalledWith(expect.objectContaining({ reference, bookingIds: ['b1'] })));
});
it('retains readable text and provides recovery if clipboard is unavailable', async () => {
 writeText.mockRejectedValue(new Error('denied'));view([first]);fireEvent.click(screen.getByRole('button', { name: 'Pay', exact: true }));
 const dialog=within(screen.getByRole('dialog'));fireEvent.click(dialog.getByRole('button', { name: 'Copy reference for booking 1184' }));
 expect(await dialog.findByText(/Could not copy the reference/)).toBeVisible();expect(dialog.getByText(reference)).toBeVisible();
 expect(referralsApi.createPayout).not.toHaveBeenCalled();
});
it('updates selected totals and preserves individual grouped references', async () => {
 view();fireEvent.click(screen.getByLabelText('Select commission for booking 1184'));
 expect(screen.getByRole('region', { name: 'Selected payment total' })).toHaveTextContent('1,700.00');
 fireEvent.click(screen.getByLabelText('Select commission for booking 1185'));
 expect(screen.getByRole('region', { name: 'Selected payment total' })).toHaveTextContent('2,000.00');
 fireEvent.click(screen.getByRole('button', { name: 'Pay selected (2)' }));
 const dialog=within(screen.getByRole('dialog'));expect(dialog.getByLabelText('Reference')).toHaveValue(reference+'; '+second.refereeId);
 expect(dialog.getByText(reference)).toBeVisible();expect(dialog.getByText(second.refereeId)).toBeVisible();
 await waitFor(() => expect(screen.getByRole('dialog')).toHaveTextContent('2,000.00'));
});
it('shows retreat totals and pay action without requiring a referral filter, excluding paid rows', () => {
 view([first, second, { ...first, bookingId:'paid', bookingNumber:999, amountOwed:99999, paid:true }]);
 fireEvent.change(screen.getByLabelText('Filter by retreat'), { target:{ value:'t1' } });
 expect(screen.getByText('Retreat total to pay').parentElement).toHaveTextContent('2,000.00');
 expect(screen.getByRole('button', { name:'Pay retreat' })).toBeVisible();
 expect(screen.getByLabelText('Select commission for booking 999')).toBeDisabled();
 fireEvent.click(screen.getByRole('button', { name:'Pay retreat' }));expect(screen.getByRole('dialog')).toHaveTextContent('2 commission items');
});
it('keeps currency totals separate and rejects mixed-currency payout selection', () => {
 view([first, { ...second, owedCurrency:'EUR' }]);
 fireEvent.click(screen.getByLabelText('Select commission for booking 1184'));fireEvent.click(screen.getByLabelText('Select commission for booking 1185'));
 const total=screen.getByRole('region', { name:'Selected payment total' });expect(total).toHaveTextContent('PLN');expect(total).toHaveTextContent('€');
 fireEvent.click(screen.getByRole('button', { name:'Pay selected (2)' }));expect(screen.getByRole('alert')).toHaveTextContent('one currency');expect(screen.queryByRole('dialog')).toBeNull();
});
it('does not invent a reference when the report lacks one', () => {
 view([{ ...first, refereeId:undefined }]);fireEvent.click(screen.getByRole('button', { name:'Pay', exact:true }));
 const dialog=within(screen.getByRole('dialog'));expect(dialog.getByText(/No generated reference/)).toBeVisible();expect(dialog.getByLabelText('Reference')).toHaveValue('');
});
it('clears selected items and updates totals when changing retreats', () => {
 view([first,{...second,retreatId:'t2',retreatCode:'OTHER',amountOwed:500},{...first,bookingId:'issue',bookingNumber:998,commissionIssue:'Missing rate',amountOwed:9999}]);
 fireEvent.change(screen.getByLabelText('Filter by retreat'),{target:{value:'t1'}});
 fireEvent.click(screen.getByLabelText('Select commission for booking 1184'));
 expect(screen.getByRole('region',{name:'Selected payment total'})).toHaveTextContent('1,700.00');
 expect(screen.getByLabelText('Select commission for booking 998')).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Filter by retreat'),{target:{value:'t2'}});
 expect(screen.queryByRole('region',{name:'Selected payment total'})).toBeNull();
 expect(screen.getByText('Retreat total to pay').parentElement).toHaveTextContent('500.00');
});
