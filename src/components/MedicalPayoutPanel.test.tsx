import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MedicalPayoutPanel from './MedicalPayoutPanel';
import { medicalPayoutsApi } from '../services/api';
jest.mock('../services/api',()=>({medicalPayoutsApi:{summary:jest.fn(),recipients:jest.fn(),approve:jest.fn(),pay:jest.fn(),void:jest.fn(),exclude:jest.fn(),saveSettings:jest.fn(),resume:jest.fn()}}));
const rules={dateBasis:'retreat_start',cutoffDate:'2026-10-15',beforeRate:50,afterRate:200,eligibility:'confirmed',includeBoosters:false,scope:'per_retreat'};
const snapshot={available:true,quoteHash:'quote',policyVersion:0,basisDate:'2026-10-20',package:'flat_retreat',rate:200,totalAmount:200,participantCount:1,participants:[{clientId:'client',name:'Fixture',bookingNumber:761}]};
const initial:any={policy:{version:0,rules},estimate:snapshot,obligation:null,history:[],legacyExpenses:[],paidAmount:0,remainingAmount:0,state:'not_approved'};
const approved:any={...initial,obligation:{revision:1,recipient:{id:'doctor',name:'Dr Fixture'},snapshot,versions:[]},remainingAmount:200,state:'approved'};
const renderPanel=(manage=true,onPaymentChanged=jest.fn())=>render(<MemoryRouter initialEntries={['/admin/retreats/retreat?tab=expenses']}><MedicalPayoutPanel retreatId="retreat" canManage={manage} onPaymentChanged={onPaymentChanged}/></MemoryRouter>);
beforeEach(()=>{jest.clearAllMocks();sessionStorage.clear();(medicalPayoutsApi.summary as jest.Mock).mockResolvedValue({data:initial});(medicalPayoutsApi.recipients as jest.Mock).mockResolvedValue({data:[{_id:'doctor',name:'Dr Fixture',role:'medical'}]});});
it('shows a read-only estimate without creating an approval or expense on load',async()=>{renderPanel();expect(await screen.findByText('Current estimate')).toBeInTheDocument();expect(medicalPayoutsApi.approve).not.toHaveBeenCalled();expect(medicalPayoutsApi.pay).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:'Record medical payment'})).not.toBeInTheDocument();});
it('requires a selected recipient and sends the exact reviewed quote/revision for approval',async()=>{
 (medicalPayoutsApi.approve as jest.Mock).mockResolvedValue({data:approved});renderPanel();fireEvent.click(await screen.findByRole('button',{name:'Review calculation'}));
 expect(screen.getByRole('button',{name:'Approve medical fee'})).toBeDisabled();fireEvent.change(screen.getByLabelText('Payout recipient'),{target:{value:'doctor'}});fireEvent.click(screen.getByRole('button',{name:'Approve medical fee'}));
 await waitFor(()=>expect(medicalPayoutsApi.approve).toHaveBeenCalledWith('retreat',expect.objectContaining({recipientId:'doctor',quoteHash:'quote',expectedRevision:0})));
 expect(await screen.findByRole('button',{name:'Record medical payment'})).toBeInTheDocument();
});
it('records a partial payment and refreshes the expense view',async()=>{
 (medicalPayoutsApi.summary as jest.Mock).mockResolvedValue({data:approved});(medicalPayoutsApi.pay as jest.Mock).mockResolvedValue({data:{...approved,paidAmount:50,remainingAmount:150}});const changed=jest.fn();renderPanel(true,changed);
 fireEvent.click(await screen.findByRole('button',{name:'Record medical payment'}));fireEvent.change(screen.getByLabelText('Fee amount applied (USD)'),{target:{value:'50'}});fireEvent.click(screen.getByRole('button',{name:'Confirm recorded payment'}));
 await waitFor(()=>expect(medicalPayoutsApi.pay).toHaveBeenCalledWith('retreat',expect.objectContaining({feeAmountUsd:50,payoutAmount:50,currency:'USD',expectedRevision:1,requestId:expect.any(String)})));
 expect(changed).toHaveBeenCalledTimes(1);
});
it('retries an uncertain payment with identical body and identifier',async()=>{
 (medicalPayoutsApi.summary as jest.Mock).mockResolvedValue({data:approved});(medicalPayoutsApi.pay as jest.Mock).mockRejectedValueOnce(new Error('connection lost')).mockResolvedValueOnce({data:{...approved,paidAmount:200,remainingAmount:0}});renderPanel();
 fireEvent.click(await screen.findByRole('button',{name:'Record medical payment'}));fireEvent.click(screen.getByRole('button',{name:'Confirm recorded payment'}));
 fireEvent.click(await screen.findByRole('button',{name:'Retry same payment'}));await waitFor(()=>expect(medicalPayoutsApi.pay).toHaveBeenCalledTimes(2));
 expect((medicalPayoutsApi.pay as jest.Mock).mock.calls[1][1]).toEqual((medicalPayoutsApi.pay as jest.Mock).mock.calls[0][1]);await waitFor(()=>expect(sessionStorage.getItem('medical-payout-pending:retreat')).toBeNull());
});
it('restores pending payment details after reload',async()=>{
 const pending={feeAmountUsd:50,payoutAmount:50,currency:'USD',paymentDate:'2026-10-19',paymentMethod:'cash',requestId:'retry-id-761',expectedRevision:1};sessionStorage.setItem('medical-payout-pending:retreat',JSON.stringify(pending));(medicalPayoutsApi.summary as jest.Mock).mockResolvedValue({data:approved});renderPanel();
 fireEvent.click(await screen.findByRole('button',{name:'Retry pending payment'}));expect(screen.getByLabelText('Fee amount applied (USD)')).toHaveValue(50);expect(screen.getByLabelText('Fee amount applied (USD)')).toBeDisabled();
});
it('requires explicit review of older expenses and does not count/link them automatically',async()=>{
 (medicalPayoutsApi.summary as jest.Mock).mockResolvedValue({data:{...approved,legacyExpenses:[{_id:'old',amount:100,currency:'USD',expenseDate:'2026-10-01',vendor:'Old doctor'}]}});renderPanel();
 expect(await screen.findByRole('button',{name:'Record medical payment'})).toBeDisabled();expect(screen.getByRole('button',{name:'Link this existing payment'})).toBeEnabled();expect(medicalPayoutsApi.pay).not.toHaveBeenCalled();
});
it('hides all approval/payment/policy mutations for read-only staff',async()=>{
 (medicalPayoutsApi.summary as jest.Mock).mockResolvedValue({data:approved});renderPanel(false);fireEvent.click(await screen.findByRole('button',{name:'Review calculation'}));
 expect(screen.queryByLabelText('Payout recipient')).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'Record medical payment'})).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'Save new policy version'})).not.toBeInTheDocument();
});
it('shows a recoverable error without presenting an empty paid balance',async()=>{
 (medicalPayoutsApi.summary as jest.Mock).mockRejectedValue(new Error('offline'));renderPanel();expect(await screen.findByRole('alert')).toBeInTheDocument();expect(screen.queryByText('Paid against fee')).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'Retry medical payouts'})).toBeEnabled();
});

it('recovers an incomplete server entry after the browser draft is gone',async()=>{
 (medicalPayoutsApi.summary as jest.Mock).mockResolvedValue({data:{...approved,pendingEntries:[{requestId:'server-pending-761',feeAmountUsd:50,recordedBy:'admin@example.test'}]}});
 (medicalPayoutsApi.resume as jest.Mock).mockResolvedValue({data:{...approved,pendingEntries:[],paidAmount:50,remainingAmount:150}});renderPanel();
 fireEvent.click(await screen.findByRole('button',{name:'Retry incomplete payment entry'}));
 await waitFor(()=>expect(medicalPayoutsApi.resume).toHaveBeenCalledWith('retreat','server-pending-761'));
 await waitFor(()=>expect(screen.queryByRole('button',{name:'Retry incomplete payment entry'})).not.toBeInTheDocument());
});
