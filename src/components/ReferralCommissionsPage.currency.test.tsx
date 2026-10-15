import{render,screen,fireEvent,waitFor,within}from'@testing-library/react';
import{MemoryRouter}from'react-router-dom';
import ReferralCommissionsPage from './ReferralCommissionsPage';
import{referralsApi}from'../services/api';
jest.mock('../services/api',()=>({referralsApi:{quotePayout:jest.fn(),createPayout:jest.fn()}}));
const row:any={bookingId:'b1',bookingNumber:1184,clientId:'c1',clientName:'Synthetic',referralId:'r1',referralName:'Partner',retreatId:'t1',retreatCode:'TEST',commissionPercentage:20,amountOwed:1700,owedCurrency:'PLN',payoutCurrency:'USD',payoutAmount:425,payoutEstimate:true,exchangeRateDate:'2026-10-13',exchangeRateSource:'ECB reference rate'};
const quote={amount:425,currency:'USD',originalTotals:{PLN:1700},items:[{exchangeRateDate:'2026-10-13',exchangeRateSource:'ECB reference rate'}]};
beforeEach(()=>{jest.clearAllMocks();(referralsApi.quotePayout as jest.Mock).mockResolvedValue({data:quote});(referralsApi.createPayout as jest.Mock).mockResolvedValue({});});
function view(){render(<MemoryRouter><ReferralCommissionsPage rows={[]} report={[row]} loading={false} base="/admin/referrals" onChanged={async()=>{}}/></MemoryRouter>);}
it('retains the original commission, shows a dated payout estimate and records the confirmed quote',async()=>{
 view();expect(screen.queryByRole('columnheader',{name:'Referred by'})).toBeNull();expect(screen.getAllByText(/1,700.00/).length).toBeGreaterThan(0);expect(screen.getByText(/425.00 estimated payout/)).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Pay',exact:true}));const dialog=within(screen.getByRole('dialog'));await waitFor(()=>expect(dialog.getByRole('button',{name:'Record paid expense'})).toBeEnabled());
 expect(screen.getByRole('dialog')).toHaveTextContent('425.00');expect(screen.getByRole('dialog')).toHaveTextContent('Original commissions: PLN');
 fireEvent.click(dialog.getByRole('button',{name:'Record paid expense'}));await waitFor(()=>expect(referralsApi.createPayout).toHaveBeenCalledWith(expect.objectContaining({expectedPayoutAmount:425,expectedPayoutCurrency:'USD'})));
});
it('blocks recording on rate failure and retries only the quote',async()=>{
 (referralsApi.quotePayout as jest.Mock).mockRejectedValueOnce(new Error('offline'));view();fireEvent.click(screen.getByRole('button',{name:'Pay',exact:true}));const dialog=within(screen.getByRole('dialog'));
 await dialog.findByText('Could not load the payment-date conversion.');expect(dialog.getByRole('button',{name:'Record paid expense'})).toBeDisabled();expect(referralsApi.createPayout).not.toHaveBeenCalled();
 fireEvent.click(dialog.getByRole('button',{name:'Refresh payment quote'}));await waitFor(()=>expect(dialog.getByRole('button',{name:'Record paid expense'})).toBeEnabled());expect(referralsApi.quotePayout).toHaveBeenCalledTimes(2);expect(referralsApi.createPayout).not.toHaveBeenCalled();
});
it('requests a fresh quote when the payment date changes',async()=>{
 view();fireEvent.click(screen.getByRole('button',{name:'Pay',exact:true}));await waitFor(()=>expect(referralsApi.quotePayout).toHaveBeenCalledTimes(1));fireEvent.change(screen.getByLabelText('Payment date'),{target:{value:'2026-06-20'}});await waitFor(()=>expect(referralsApi.quotePayout).toHaveBeenLastCalledWith(expect.objectContaining({expenseDate:'2026-06-20'})));
});

it('explains an uncovered first-payment date and links directly to partner settings without offering payment',()=>{
 const missing={...row,commissionIssue:'No commission package covers this booking date.',commissionPercentage:0,firstPaymentDate:'2026-03-21T12:00:00.000Z',registrationDate:'2026-07-10',packageName:'Needs configuration'};
 render(<MemoryRouter><ReferralCommissionsPage rows={[]} report={[missing]} loading={false} base="/admin/referrals" onChanged={async()=>{}}/></MemoryRouter>);
 expect(screen.getByText(/First completed payment: 21 Mar 2026/)).toBeVisible();
 expect(screen.getByText(/add or extend a package and enter the agreed percentage/)).toBeVisible();
 expect(screen.getByRole('link',{name:/Configure commission for Partner, booking 1184/})).toHaveAttribute('href','/admin/referrals/r1/edit');
 expect(screen.queryByRole('button',{name:'Pay',exact:true})).toBeNull();
 expect(screen.queryByText(/· 0%/)).toBeNull();
 expect(screen.getByRole('checkbox',{name:/Select commission/})).toBeDisabled();
});
