import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ScratchpadGuidedMatch from './ScratchpadGuidedMatch';
import { scratchpadApi, paymentsApi } from '../services/api';
jest.mock('../services/api',()=>({scratchpadApi:{matches:jest.fn(),associate:jest.fn(),confirmMatch:jest.fn()},paymentsApi:{linkRequest:jest.fn()}}));
const api=scratchpadApi as jest.Mocked<typeof scratchpadApi>;
const receipt:any={_id:'receipt',revision:0,amount:'600.00',amountMinor:60000,currency:'PLN',receivedDate:'2026-10-20',requestNumber:'3100',phone:'+420 700 111 222',status:'unassigned'};
const client={_id:'client-a',display_id:330,firstName:'Anna',lastName:'Synthetic',phone:'700111222'};
const request={_id:'request-a',display_id:3100,clientId:client,currency:'PLN',requestedAmount:1000,amountOutstanding:600,amountMatches:true,retreatId:{_id:'retreat',name:'Synthetic retreat',startDate:'2099-01-01',endDate:'2099-01-07'},requestType:'deposit'};
const props={onSaved:jest.fn(),onComplete:jest.fn(),onBusy:jest.fn(),onFallback:jest.fn()};
beforeEach(()=>{jest.clearAllMocks();api.matches.mockResolvedValue({data:{clients:[client],requests:[request],payments:[],suggestedRequestId:'request-a'}} as any);api.associate.mockResolvedValue({data:{...receipt,revision:1,matchedClientId:'client-a',matchedPaymentRequestId:'request-a'}} as any);api.confirmMatch.mockResolvedValue({data:{...receipt,status:'converted'}} as any);});
const mount=(row=receipt,mode?:string)=>render(<MemoryRouter><ScratchpadGuidedMatch receipt={row} initialMode={mode} {...props}/></MemoryRouter>);
it('preselects a unique eligible PR and saves association without changing money',async()=>{
 mount();const checkbox=await screen.findByRole('checkbox',{name:'Select PR #3100'});expect(checkbox).toBeChecked();expect(api.confirmMatch).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Save client / PR only'}));await waitFor(()=>expect(api.associate).toHaveBeenCalledWith('receipt',expect.objectContaining({revision:0,clientId:'client-a',paymentRequestId:'request-a'})));expect(api.confirmMatch).not.toHaveBeenCalled();
 expect(await screen.findByRole('status')).toHaveTextContent('No payment');expect(screen.getByRole('button',{name:'Review / create suggested booking'})).toBeDisabled();expect(screen.getByLabelText('Suggested booking full price')).toHaveValue(null);
});
it('does not silently choose a request from ambiguous phone matches; name search clears selection',async()=>{
 api.matches.mockResolvedValue({data:{clients:[client,{...client,_id:'client-b',display_id:331,firstName:'Ben'}],requests:[request],suggestedRequestId:''}} as any);
 mount({...receipt,requestNumber:''},'client');await screen.findByRole('button',{name:/#331 Ben/});expect(screen.getByRole('checkbox',{name:'Select PR #3100'})).not.toBeChecked();
 fireEvent.click(screen.getByRole('button',{name:/#330 Anna/}));fireEvent.click(await screen.findByRole('checkbox',{name:'Select PR #3100'}));
 fireEvent.change(screen.getByLabelText('Client name, number or phone'),{target:{value:'Anna'}});await waitFor(()=>expect(api.matches).toHaveBeenLastCalledWith('receipt',expect.objectContaining({q:'Anna',clientId:''})));expect(api.confirmMatch).not.toHaveBeenCalled();
});
it('existing payment can attach to saved PR on explicit confirmation, reusing the payment',async()=>{
 const payment={_id:'payment',display_id:1201,clientId:'client-a',amount:600,currency:'PLN',paymentMethod:'bank_transfer'};
 api.matches.mockResolvedValue({data:{clients:[],requests:[],payments:[payment]}} as any);(paymentsApi.linkRequest as jest.Mock).mockResolvedValue({data:{...payment,paymentRequestId:'request-a'}});
 mount({...receipt,matchedClientId:'client-a',matchedPaymentRequestId:'request-a'},'payment');fireEvent.click(await screen.findByRole('checkbox',{name:'Select payment #1201'}));expect(paymentsApi.linkRequest).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Confirm link to existing payment'}));await waitFor(()=>expect(api.confirmMatch).toHaveBeenCalledWith('receipt',expect.objectContaining({action:'link',paymentId:'payment',paymentRequestId:'request-a',confirm:true,confirmAccount:true})));expect(paymentsApi.linkRequest).toHaveBeenCalledWith('payment','request-a');
});
it('resumes the immutable confirmed target instead of creating a new choice',async()=>{
 mount({...receipt,reconciliationPending:true,reconciliation:{action:'convert',targets:{clientId:'saved-client',paymentRequestId:'saved-request'},paymentId:'saved-payment'}});
 fireEvent.click(screen.getByRole('button',{name:'Resume confirmed match'}));await waitFor(()=>expect(api.confirmMatch).toHaveBeenCalledWith('receipt',expect.objectContaining({clientId:'saved-client',paymentRequestId:'saved-request',paymentId:'saved-payment'})));
});
it('can create a client-only payment when explicitly chosen, without pretending a PR was paid',async()=>{
 api.matches.mockResolvedValue({data:{clients:[client],requests:[],payments:[]}} as any);mount({...receipt,requestNumber:''},'client');fireEvent.click(await screen.findByRole('button',{name:/#330 Anna/}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Create client payment without a PR'})).toBeEnabled());fireEvent.click(screen.getByRole('button',{name:'Create client payment without a PR'}));await waitFor(()=>expect(api.confirmMatch).toHaveBeenCalledWith('receipt',expect.objectContaining({action:'convert',clientId:'client-a',paymentRequestId:''})));
});

it('saved client-only context takes precedence over old PR/phone hints when making a later payment',async()=>{
 api.matches.mockResolvedValue({data:{clients:[{...client,_id:'saved-client'}],requests:[],suggestedRequestId:''}} as any);
 mount({...receipt,matchedClientId:'saved-client',matchedPaymentRequestId:undefined});
 await waitFor(()=>expect(api.matches).toHaveBeenCalledWith('receipt',expect.objectContaining({mode:'client',q:'',clientId:'saved-client'})));
 expect(screen.getByRole('button',{name:'Create client payment without a PR'})).toBeEnabled();expect(api.confirmMatch).not.toHaveBeenCalled();
});
