import React from 'react';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import ScratchpadEditMatching from './ScratchpadEditMatching';
import {paymentRequestsApi} from '../services/api';
jest.mock('../services/api',()=>({paymentRequestsApi:{getSettlement:jest.fn()}}));
jest.mock('./SearchableClientSelect',()=>({__esModule:true,default:(p:any)=><select aria-label={p.ariaLabel} value={p.value} onChange={e=>p.onChange(e.target.value)}><option value="">None</option>{p.clients.map((c:any)=><option key={c._id} value={c._id}>{c.firstName}</option>)}</select>}));
const clients=[{_id:'anna',firstName:'Anna'},{_id:'ben',firstName:'Ben'}];
const requests=[{_id:'a',display_id:3100,clientId:clients[0],currency:'PLN',requestedAmount:1000,status:'paid'},{_id:'b',display_id:3101,clientId:clients[1],currency:'PLN',requestedAmount:600},{_id:'eur',display_id:3102,clientId:clients[0],currency:'EUR',requestedAmount:300},{_id:'cancel',display_id:3103,clientId:clients[0],currency:'PLN',requestedAmount:100,status:'cancelled'}];
beforeEach(()=>{jest.resetAllMocks();(paymentRequestsApi.getSettlement as jest.Mock).mockResolvedValue({data:{amountOutstanding:600}})});
test('choosing PR prefills client, filters foreign currency/cancelled options and loads actual outstanding, not cached paid status',async()=>{
 const change=jest.fn();const {rerender}=render(<ScratchpadEditMatching clients={clients} requests={requests} currency="PLN" value={{clientId:'',paymentRequestId:''}} onChange={change}/>);
 expect(screen.queryByRole('option',{name:/3102|3103/})).not.toBeInTheDocument();fireEvent.change(screen.getByLabelText('Payment request (optional)'),{target:{value:'a'}});expect(change).toHaveBeenLastCalledWith({clientId:'anna',paymentRequestId:'a'});
 rerender(<ScratchpadEditMatching clients={clients} requests={requests} currency="PLN" value={{clientId:'anna',paymentRequestId:'a'}} onChange={change}/>);expect(screen.getByLabelText('Receipt client (optional)')).toHaveValue('anna');await screen.findByText('Unpaid amount: 600 PLN');expect(screen.queryByRole('option',{name:/3101/})).not.toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Receipt client (optional)'),{target:{value:'ben'}});expect(change).toHaveBeenLastCalledWith({clientId:'ben',paymentRequestId:''});fireEvent.click(screen.getByRole('button',{name:'Clear client and PR'}));expect(change).toHaveBeenLastCalledWith({clientId:'',paymentRequestId:''});
});
test('keeps saved option visible while searching and does not invent an unpaid amount after a fetch failure',async()=>{
 (paymentRequestsApi.getSettlement as jest.Mock).mockRejectedValue(new Error('offline'));render(<ScratchpadEditMatching clients={clients} requests={requests} currency="PLN" value={{clientId:'anna',paymentRequestId:'a'}} onChange={jest.fn()}/>);
 fireEvent.change(screen.getByLabelText('Search payment requests'),{target:{value:'not-a-match'}});expect(screen.getByLabelText('Payment request (optional)')).toHaveValue('a');await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('Outstanding amount unavailable'));expect(screen.queryByText('Unpaid amount: 0 PLN')).not.toBeInTheDocument();
});
