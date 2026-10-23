import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RequestBookingReviewPage from './RequestBookingReviewPage';
import { paymentRequestsApi } from '../services/api';
jest.mock('../services/api', () => ({ paymentRequestsApi: { getBookingLinkReview: jest.fn(), linkBooking: jest.fn() } }));
const row = { request: { _id:'r',invoiceNumber:'1392',clientId:{_id:'c',firstName:'Ewa',lastName:'Franus'} },message:'Review existing booking',candidates:[{_id:'b',bookingNumber:1909,status:'confirmed',currency:'PLN',evidence:'Same client and retreat — staff review required',blockedReason:null}] };
const mount = () => render(<MemoryRouter initialEntries={['/admin/payment-requests/booking-review?requestId=r']}><RequestBookingReviewPage /></MemoryRouter>);
beforeEach(() => { jest.clearAllMocks(); (paymentRequestsApi.getBookingLinkReview as jest.Mock).mockResolvedValue({data:[row]}); });
it('requires explicit confirmation, links and refreshes the review',async()=>{
 mount();expect(await screen.findByRole('link',{name:'Booking #1909'})).toHaveAttribute('href','/admin/bookings/b');
 expect(screen.getByRole('link',{name:'Client bookings'})).toHaveAttribute('href','/admin/clients/c?tab=bookings');
 expect(paymentRequestsApi.linkBooking).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Link request #1392 to booking #1909'}));
 const confirm=screen.getByRole('button',{name:'Confirm booking link'});expect(confirm).toBeDisabled();
 fireEvent.click(screen.getByRole('checkbox'));expect(confirm).toBeEnabled();
 (paymentRequestsApi.linkBooking as jest.Mock).mockResolvedValue({data:{}});(paymentRequestsApi.getBookingLinkReview as jest.Mock).mockResolvedValue({data:[]});fireEvent.click(confirm);
 await screen.findByText('No requests need booking link review.');expect(paymentRequestsApi.linkBooking).toHaveBeenCalledWith('r','b');expect(paymentRequestsApi.getBookingLinkReview).toHaveBeenCalledWith('r');
});
it('shows blocked candidates without an action',async()=>{
 (paymentRequestsApi.getBookingLinkReview as jest.Mock).mockResolvedValue({data:[{...row,candidates:[{...row.candidates[0],blockedReason:'Currencies differ'}]}]});mount();
 await screen.findByText('Currencies differ');expect(screen.queryByRole('button',{name:/Link request/})).not.toBeInTheDocument();
});
it('keeps the selection and shows a server conflict for staff review',async()=>{
 (paymentRequestsApi.linkBooking as jest.Mock).mockRejectedValue({response:{data:{message:'Request changed'}}});mount();fireEvent.click(await screen.findByRole('button',{name:'Link request #1392 to booking #1909'}));fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'Confirm booking link'}));
 await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Request changed'));expect(screen.getByRole('dialog')).toBeInTheDocument();
});
