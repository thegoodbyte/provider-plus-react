import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import BookingOverviewPanel, { formatBookingDate, formatHistoryDateTime, retreatTown, sentConfirmationStep } from './BookingOverviewPanel';
import BookingPaymentManagement from './BookingPaymentManagement';
import { useBookingRequirements } from './useBookingRequirements';
import { BookingType } from '../constants/eventTypes';

jest.mock('./BookingPaymentManagement',()=>({__esModule:true,default:jest.fn((props:any)=><div><h3>Payments</h3><button onClick={props.onPaymentUpdate}>Payment updated</button></div>)}));
jest.mock('./useBookingRequirements',()=>({useBookingRequirements:jest.fn()}));
const requirement={key:'ekg',label:'Entry EKG',required:true,uploaded:false,satisfied:false,reviewed:false,relatedItems:[]};
const base={bookingId:'b',booking:{bookingNumber:3,bookingHash:'booking-hash',totalAmount:100,currency:'USD',registrationDate:'2026-01-01',bookingConfirmationHistory:[]},client:{_id:'c',email:'a@b.com',phone:'1',country:'CZ'},retreat:{_id:'r',name:'Retreat',locationTown:'Mistrovice',startDate:'2026-09-01',endDate:'2026-09-08'},clientName:'Ada',bookingTypeCode:'F',retreatCode:'RET',retreatAddress:'Address',onEditClient:jest.fn(),onBookingRefresh:jest.fn(),onOpenTab:jest.fn(),onSendConfirmation:jest.fn()};
beforeEach(()=>{
 jest.clearAllMocks();
 (BookingPaymentManagement as jest.Mock).mockImplementation((props:any)=><div><h3>Payments</h3><button onClick={props.onPaymentUpdate}>Payment updated</button></div>);
 (useBookingRequirements as jest.Mock).mockReturnValue({rows:[requirement],items:[],loading:false,error:'',reload:jest.fn()});
});
it('formats dates and towns safely',()=>{
 expect(formatBookingDate()).toBe('N/A');expect(formatBookingDate('bad')).toBe('N/A');expect(formatHistoryDateTime('bad')).toBe('N/A');expect(retreatTown({house:{city:'Town'}})).toBe('Town');
});
it('uses the shared payment manager as the first section with the exact booking context and refresh callback',()=>{
 render(<BookingOverviewPanel {...base} refreshKey={4}/>);
 const props=(BookingPaymentManagement as jest.Mock).mock.calls[0][0];
 expect(props).toMatchObject({bookingId:'b',bookingNumber:3,bookingHash:'booking-hash',clientId:'c',retreatId:'r',totalAmount:100,currency:'USD'});
 expect(screen.getByRole('region',{name:'Booking payments'}).parentElement?.firstElementChild).toBe(screen.getByRole('region',{name:'Booking payments'}));
 fireEvent.click(screen.getByRole('button',{name:'Payment updated'}));expect(base.onBookingRefresh).toHaveBeenCalledTimes(1);
 expect(useBookingRequirements).toHaveBeenCalledWith({bookingId:'b',clientId:'c',retreatId:'r',refreshKey:4});
});
it('starts the three reference sections collapsed and opens the requirements tab deliberately',()=>{
 render(<BookingOverviewPanel {...base}/>);
 for(const name of ['Requirements next up','Retreat information','Booking dates'])expect(screen.getByText(name).closest('details')).not.toHaveAttribute('open');
 fireEvent.click(screen.getByText('Requirements next up'));
 expect(screen.getByText('Requirements next up').closest('details')).toHaveAttribute('open');
 expect(screen.getByText('Entry EKG')).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Open all requirements'}));expect(base.onOpenTab).toHaveBeenCalledWith('requirements');
 fireEvent.click(screen.getByText('Requirements next up'));expect(screen.getByText('Requirements next up').closest('details')).not.toHaveAttribute('open');
});
it('preserves client contact, referral and accommodation details and edit/confirmation actions',()=>{
 render(<BookingOverviewPanel {...base} client={{...base.client,referralId:{_id:'friend',name:'Friend'},referralAttributionType:'self_identified'}} booking={{...base.booking,roomType:'private_ensuite',roomNumber:'Room 3'}}/>);
 const rail=within(screen.getByRole('complementary',{name:'Booking client summary'}));
 expect(rail.getByRole('link',{name:'a@b.com'})).toHaveAttribute('href','mailto:a@b.com');expect(rail.getByText('Friend · Self-identified')).toBeInTheDocument();
 expect(rail.getByText('Private room, private bathroom · Room 3')).toBeInTheDocument();
 fireEvent.click(rail.getByRole('button',{name:'Edit'}));expect(base.onEditClient).toHaveBeenCalled();
 fireEvent.click(rail.getByRole('button',{name:'Send confirmation'}));expect(base.onSendConfirmation).toHaveBeenCalled();
});
it('recognizes both legacy and completed booking-flow confirmation history',()=>{
 (useBookingRequirements as jest.Mock).mockReturnValue({rows:[requirement],items:[{key:'booking_confirmation_sent',status:'sent',emailSentAt:'2026-01-03'}],loading:false,error:''});
 render(<BookingOverviewPanel {...base}/>);expect(screen.getByText('Sent')).toBeInTheDocument();expect(screen.getByText(/^Last sent /)).toBeInTheDocument();expect(screen.getByRole('button',{name:'Send again'})).toBeEnabled();
 expect(sentConfirmationStep([{key:'booking_confirmation_sent',status:'pending'} as any])).toBeUndefined();
});
it('shows legacy confirmation history even without a completed flow item',()=>{
 render(<BookingOverviewPanel {...base} booking={{...base.booking,bookingConfirmationHistory:[{sentAt:'2026-01-02'}]}}/>);expect(screen.getByText('Sent')).toBeInTheDocument();
});
it('does not claim requirements complete or confirmation unsent while source loading fails',()=>{
 const reload=jest.fn();(useBookingRequirements as jest.Mock).mockReturnValue({rows:[],items:[],loading:false,error:'Requirements unavailable',reload});
 render(<BookingOverviewPanel {...base}/>);fireEvent.click(screen.getByText('Requirements next up'));
 expect(screen.getByRole('alert')).toHaveTextContent('Requirements unavailable');expect(screen.queryByText('No outstanding required items.')).not.toBeInTheDocument();
 expect(screen.getByText('Status unavailable')).toBeInTheDocument();expect(screen.getByRole('button',{name:'Send confirmation'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Retry requirements'}));expect(reload).toHaveBeenCalled();
});
it('keeps booster dates instead of the containing retreat dates in both details and rail',()=>{
 render(<BookingOverviewPanel {...base} booking={{...base.booking,bookingType:BookingType.BOOSTER,boosterStartDate:'2026-09-03',boosterEndDate:'2026-09-04',checkInDate:'2026-09-01',checkOutDate:'2026-09-08'}}/>);
 fireEvent.click(screen.getByText('Booking dates'));const dates=within(screen.getByText('Booking dates').closest('details')!);
 expect(dates.getByText('Sep 3, 2026')).toBeVisible();expect(dates.getByText('Sep 4, 2026')).toBeVisible();
 expect(screen.getByRole('complementary')).toHaveTextContent('Sep 3, 2026 – Sep 4, 2026');
});

it('shows saved stay instants on the retreat calendar day, independent of the viewer timezone',()=>{
 expect(formatBookingDate('2099-03-28T16:30:00Z')).toBe('Mar 28, 2099');
 expect(formatBookingDate('2099-03-30T22:00:00Z')).toBe('Mar 31, 2099');
});
