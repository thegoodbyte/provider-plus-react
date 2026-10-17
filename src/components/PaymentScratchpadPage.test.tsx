import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PaymentScratchpadPage from './PaymentScratchpadPage';
import { scratchpadApi, clientsApi, bookingsApi, paymentRequestsApi } from '../services/api';
jest.mock('../services/api', () => ({ scratchpadApi: { list: jest.fn(), create: jest.fn(), detail: jest.fn(), candidates: jest.fn(), edit: jest.fn(), state: jest.fn(), reconcile: jest.fn() }, clientsApi: { getAll: jest.fn() }, bookingsApi: { getAll: jest.fn() }, paymentRequestsApi: { getAllFresh: jest.fn() } }));
jest.mock('./SearchableClientSelect', () => ({ __esModule: true, default: (p: any) => <select aria-label={p.ariaLabel} value={p.value} onChange={e=>p.onChange(e.target.value)}><option value="">Choose</option><option value="client">Synthetic client</option></select> }));
jest.mock('./Tasks/SearchableSelect', () => ({ SearchableSelect: (p: any) => <select id={p.id} value={p.value} onChange={e=>p.onChange(e.target.value)}>{p.options.map((o:any)=><option key={o.id} value={o.id}>{o.label}</option>)}</select> }));
const api = scratchpadApi as jest.Mocked<typeof scratchpadApi>;
const row: any = { _id:'receipt', revision:0, receivedDate:'2026-10-16', amount:'5100.00', amountMinor:510000, currency:'PLN', provider:'csob', account:'PLN wallet', payer:'Synthetic Payer', requestNumber:'001243', reference:'Transfer', status:'unassigned', history:[] };
const snapshot: any = { items:[row], total:1, page:1, limit:25, refreshedAt:'2026-10-16T12:00:00Z', totals:[{currency:'PLN',status:'logged',count:1,amount:'5100.00'},{currency:'PLN',status:'unassigned',count:1,amount:'5100.00'}] };
beforeEach(()=>{
  jest.resetAllMocks(); Object.defineProperty(window.crypto,'randomUUID',{configurable:true,value:()=> '11111111-1111-4111-8111-111111111111'});
  api.list.mockResolvedValue({data:snapshot} as any); api.detail.mockResolvedValue({data:row} as any); api.candidates.mockResolvedValue({data:{payments:[],requests:[]}} as any);
  (clientsApi.getAll as jest.Mock).mockResolvedValue({data:[]}); (bookingsApi.getAll as jest.Mock).mockResolvedValue({data:[]}); (paymentRequestsApi.getAllFresh as jest.Mock).mockResolvedValue({data:[]});
});
const mount=()=>render(<MemoryRouter initialEntries={["/admin/payments/scratchpad"]}><PaymentScratchpadPage /></MemoryRouter>);
it('retains the previous snapshot and refresh time after a failed refresh',async()=>{
  mount(); await screen.findByText('Synthetic Payer',{exact:false});
  api.list.mockRejectedValueOnce(new Error('Network down')); fireEvent.click(screen.getByRole('button',{name:'Refresh',exact:true}));
  await screen.findByText(/Previous snapshot shown below/); expect(screen.getAllByText(/5100.00/).length).toBeGreaterThanOrEqual(2); expect(screen.getByText(/Last successful refresh/)).toBeInTheDocument();
});
it('retains capture fields and the retry key after a failed save',async()=>{
  mount(); fireEvent.click(screen.getByRole('button',{name:'New receipt'}));
  fireEvent.change(screen.getByLabelText('Amount received'),{target:{value:'5100.00'}}); fireEvent.change(screen.getByLabelText('Receiving account / wallet'),{target:{value:'PLN wallet'}}); fireEvent.change(screen.getByLabelText('Payment request number (optional)'),{target:{value:'001243'}});
  api.create.mockRejectedValue(new Error('Timeout')); fireEvent.click(screen.getByRole('button',{name:'Save receipt'}));
  await screen.findByRole('alert'); expect(screen.getByLabelText('Amount received')).toHaveValue('5100.00'); expect(screen.getByLabelText('Payment request number (optional)')).toHaveValue('001243');
  fireEvent.click(screen.getByRole('button',{name:'Save receipt'})); await waitFor(()=>expect(api.create).toHaveBeenCalledTimes(2));
  expect(api.create.mock.calls[0][0].captureKey).toBe(api.create.mock.calls[1][0].captureKey);
  expect(api.reconcile).not.toHaveBeenCalled();
});
it('never silently assigns a typed request hint or converts without review',async()=>{
  mount(); fireEvent.click(await screen.findByRole('button',{name:'Match receipt Synthetic Payer'}));
  await screen.findByRole('heading',{name:'Match this receipt'}); expect(screen.getByLabelText('Reconciliation client')).toHaveValue(''); expect(api.reconcile).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Reconciliation client'),{target:{value:'client'}});
  expect(screen.getByRole('button',{name:'Confirm conversion'})).toBeDisabled();
  fireEvent.click(screen.getByLabelText('I reviewed the receipt and selected relationships.'));
  api.reconcile.mockResolvedValue({data:{...row,status:'converted',paymentId:'payment',payment:{display_id:1001,amount:5100,currency:'PLN',status:'completed'}}} as any);
  fireEvent.click(screen.getByRole('button',{name:'Confirm conversion'}));
  await waitFor(()=>expect(api.reconcile).toHaveBeenCalledWith('receipt',expect.objectContaining({clientId:'client',paymentRequestId:'',confirm:true,action:'convert'})));
  await screen.findByText('Receipt reconciled. The original received-money total is unchanged.');
});
it('offers explicit linking for a possible existing payment and preserves its relationships',async()=>{
  api.candidates.mockResolvedValue({data:{payments:[{_id:'payment',display_id:1401,clientId:'client',amount:5100,currency:'PLN',paymentDate:'2026-10-16',status:'completed'}],requests:[]}} as any);
  mount(); fireEvent.click(await screen.findByRole('button',{name:'Match receipt Synthetic Payer'}));
  fireEvent.click(await screen.findByRole('button',{name:'Select existing payment'}));
  fireEvent.click(screen.getByLabelText(/I checked the original transaction/)); fireEvent.click(screen.getByLabelText('I reviewed the receipt and selected relationships.'));
  api.reconcile.mockResolvedValue({data:{...row,status:'converted',paymentId:'payment',payment:{display_id:1401}}} as any);
  fireEvent.click(screen.getByRole('button',{name:'Confirm link to existing payment'}));
  await waitFor(()=>expect(api.reconcile).toHaveBeenCalledWith('receipt',expect.objectContaining({action:'link',paymentId:'payment',clientId:'client',confirmAccount:true})));
});

it('uses a grid without inline capture or matching forms, and remembers filters in the URL',async()=>{
 mount(); await screen.findByRole('table'); expect(screen.queryByLabelText('Amount received')).not.toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Filter currency'),{target:{value:'USD'}});
 fireEvent.change(screen.getByLabelText('Sort receipts'),{target:{value:'amount-asc'}});
 await waitFor(()=>expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({currency:'USD',sort:'amount-asc',page:1})));
 fireEvent.click(screen.getByRole('link',{name:'View receipt Synthetic Payer'}));
 await screen.findByRole('region',{name:'Receipt details'}); expect(screen.queryByRole('table')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'← Back to list'}));
 await screen.findByRole('table'); expect(screen.getByLabelText('Filter currency')).toHaveValue('USD'); expect(screen.getByLabelText('Sort receipts')).toHaveValue('amount-asc');
 fireEvent.click(screen.getByRole('button',{name:'Clear filters'})); await waitFor(()=>expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({currency:'',sort:'date-desc',page:1})));
});
it('opens edit as a separate screen and preserves fields after a failed edit',async()=>{
 mount(); fireEvent.click(await screen.findByRole('button',{name:'Edit receipt Synthetic Payer'}));
 await screen.findByRole('heading',{name:'Edit unassigned receipt'}); expect(screen.queryByRole('table')).not.toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Notes (optional)'),{target:{value:'Keep my note'}}); api.edit.mockRejectedValueOnce(new Error('failed'));
 fireEvent.click(screen.getByRole('button',{name:'Save receipt'})); await screen.findByRole('alert'); expect(screen.getByLabelText('Notes (optional)')).toHaveValue('Keep my note');
});
it('warns before discarding an edited receipt',async()=>{
 const confirm=jest.spyOn(window,'confirm').mockReturnValue(false); mount(); fireEvent.click(screen.getByRole('button',{name:'New receipt'}));
 fireEvent.change(await screen.findByLabelText('Amount received'),{target:{value:'23.00'}}); fireEvent.click(screen.getByRole('button',{name:'Cancel'}));
 expect(confirm).toHaveBeenCalledWith('Discard unsaved receipt changes?'); expect(screen.getByLabelText('Amount received')).toHaveValue('23.00'); confirm.mockRestore();
});
it('locks edit and matching actions on linked receipts',async()=>{
 api.list.mockResolvedValue({data:{...snapshot,items:[{...row,status:'converted'}]}} as any); mount();
 expect(await screen.findByRole('button',{name:'Edit receipt Synthetic Payer'})).toBeDisabled(); expect(screen.getByRole('button',{name:'Match receipt Synthetic Payer'})).toBeDisabled();
});
it('canceling the matching popup never reconciles',async()=>{
 mount(); fireEvent.click(await screen.findByRole('button',{name:'Match receipt Synthetic Payer'})); await screen.findByRole('dialog');
 fireEvent.click(screen.getByRole('button',{name:'Close'})); await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument()); expect(api.reconcile).not.toHaveBeenCalled();
});
it('navigates across page boundaries in the active ordering',async()=>{
 const items=Array.from({length:25},(_,i)=>({...row,_id:'row'+i,payer:'Payer '+i})); const second={...row,_id:'row25',payer:'Payer 25'};
 api.list.mockImplementation(async(q:any)=>({data:{...snapshot,items:q.page===2?[second]:items,total:26,page:q.page,limit:25}} as any));
 api.detail.mockImplementation(async(id:string)=>({data:items.find(r=>r._id===id)||second} as any)); mount();
 fireEvent.click(await screen.findByRole('link',{name:'View receipt Payer 24'})); await screen.findByText('Receipt 25 of 26'); fireEvent.click(screen.getByRole('button',{name:'Next receipt'}));
 await screen.findByText('Receipt 26 of 26'); expect(screen.getByRole('button',{name:'Next receipt'})).toBeDisabled(); expect(screen.getByRole('button',{name:'Previous receipt'})).toBeEnabled();
});
