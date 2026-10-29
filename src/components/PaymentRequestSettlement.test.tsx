import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PaymentRequestSettlement from './PaymentRequestSettlement';
import { paymentRequestsApi } from '../services/api';
jest.mock('../services/api',()=>({paymentRequestsApi:{getSettlement:jest.fn()}}));
const payments=[{_id:'p1',display_id:1911,amount:1500,currency:'PLN',status:'completed',paymentDate:'2026-10-20'},{_id:'p2',display_id:1912,amount:2500,currency:'PLN',status:'completed',paymentDate:'2026-10-21'}];
const open=()=>render(<MemoryRouter><PaymentRequestSettlement requestId="request" /></MemoryRouter>);
it('shows partial payment and the actual receipt amount',async()=>{
 (paymentRequestsApi.getSettlement as jest.Mock).mockResolvedValue({data:{requestedAmount:3800,amountReceived:1500,amountOutstanding:2300,amountOverpaid:0,currency:'PLN',settlementStatus:'partial',payments:[payments[0]]}});open();
 await screen.findByText(/Partially paid/);expect(screen.getByText('3,800.00 PLN')).toBeInTheDocument();expect(screen.getByText('2,300.00 PLN')).toBeInTheDocument();expect(screen.getByRole('link',{name:'Payment #1911'})).toHaveAttribute('href','/admin/payments/p1');
});
it('shows both receipts, the unchanged invoice and the overpayment',async()=>{
 (paymentRequestsApi.getSettlement as jest.Mock).mockResolvedValue({data:{requestedAmount:3800,amountReceived:4000,amountOutstanding:0,amountOverpaid:200,currency:'PLN',settlementStatus:'overpaid',payments}});open();
 await screen.findByText(/Overpayment: 200.00 PLN/);expect(screen.getByText('3,800.00 PLN')).toBeInTheDocument();expect(screen.getByText('4,000.00 PLN')).toBeInTheDocument();expect(screen.getByText('1,500.00 PLN')).toBeInTheDocument();expect(screen.getByText('2,500.00 PLN')).toBeInTheDocument();expect(screen.getAllByRole('link')).toHaveLength(2);
});
it('does not invent a balance when the settlement cannot load',async()=>{(paymentRequestsApi.getSettlement as jest.Mock).mockRejectedValue(new Error('Unavailable'));open();await screen.findByRole('alert');expect(screen.queryByText('0.00 PLN')).not.toBeInTheDocument();});
it('warns that a paid PR is not a paid booking and links the explicit repair, without writing',async()=>{
 (paymentRequestsApi.getSettlement as jest.Mock).mockResolvedValue({data:{requestedAmount:6600,amountReceived:6600,amountOutstanding:0,amountOverpaid:0,currency:'PLN',settlementStatus:'settled',payments:[payments[0]],bookingAllocation:{needsReview:true,unallocatedPaymentIds:['p1']}}});open();
 expect(await screen.findByRole('alert')).toHaveTextContent('A paid request alone does not mean the booking is paid in full');expect(screen.getByRole('link',{name:'Review and finish payment allocation'})).toHaveAttribute('href','/admin/payment-requests/booking-review?requestId=request');
});
it('removes the warning after a fresh load confirms the allocation is complete',async()=>{
 (paymentRequestsApi.getSettlement as jest.Mock).mockResolvedValue({data:{requestedAmount:6600,amountReceived:6600,amountOutstanding:0,amountOverpaid:0,currency:'PLN',settlementStatus:'settled',payments,bookingAllocation:{needsReview:false}}});open();await screen.findByText('6,600.00 PLN');expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
