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
const mount=()=>render(<MemoryRouter><PaymentScratchpadPage /></MemoryRouter>);
it('retains the previous snapshot and refresh time after a failed refresh',async()=>{
  mount(); await screen.findByText('Synthetic Payer',{exact:false});
  api.list.mockRejectedValueOnce(new Error('Network down')); fireEvent.click(screen.getByRole('button',{name:'Refresh',exact:true}));
  await screen.findByText(/Previous snapshot shown below/); expect(screen.getAllByText('5100.00')).toHaveLength(2); expect(screen.getByText(/Last successful refresh/)).toBeInTheDocument();
});
it('retains capture fields and the retry key after a failed save',async()=>{
  mount(); fireEvent.click(screen.getByRole('button',{name:'Record received money'}));
  fireEvent.change(screen.getByLabelText('Amount received'),{target:{value:'5100.00'}}); fireEvent.change(screen.getByLabelText('Receiving account / wallet'),{target:{value:'PLN wallet'}}); fireEvent.change(screen.getByLabelText('Payment request number (optional)'),{target:{value:'001243'}});
  api.create.mockRejectedValue(new Error('Timeout')); fireEvent.click(screen.getByRole('button',{name:'Save receipt'}));
  await screen.findByRole('alert'); expect(screen.getByLabelText('Amount received')).toHaveValue('5100.00'); expect(screen.getByLabelText('Payment request number (optional)')).toHaveValue('001243');
  fireEvent.click(screen.getByRole('button',{name:'Save receipt'})); await waitFor(()=>expect(api.create).toHaveBeenCalledTimes(2));
  expect(api.create.mock.calls[0][0].captureKey).toBe(api.create.mock.calls[1][0].captureKey);
  expect(api.reconcile).not.toHaveBeenCalled();
});
it('never silently assigns a typed request hint or converts without review',async()=>{
  mount(); fireEvent.click(await screen.findByRole('button',{name:'Manage receipt'}));
  await screen.findByRole('heading',{name:'Match this receipt'}); expect(screen.getByLabelText('Reconciliation client')).toHaveValue(''); expect(api.reconcile).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Reconciliation client'),{target:{value:'client'}});
  expect(screen.getByRole('button',{name:'Confirm conversion'})).toBeDisabled();
  fireEvent.click(screen.getByLabelText('I reviewed the receipt and selected relationships.'));
  api.reconcile.mockResolvedValue({data:{...row,status:'converted',paymentId:'payment',payment:{display_id:1001,amount:5100,currency:'PLN',status:'completed'}}} as any);
  fireEvent.click(screen.getByRole('button',{name:'Confirm conversion'}));
  await waitFor(()=>expect(api.reconcile).toHaveBeenCalledWith('receipt',expect.objectContaining({clientId:'client',paymentRequestId:'',confirm:true,action:'convert'})));
  await screen.findByText('Reconciled receipt. Financial fields are locked.'); expect(screen.queryByRole('button',{name:'Edit receipt'})).not.toBeInTheDocument();
});
it('offers explicit linking for a possible existing payment and preserves its relationships',async()=>{
  api.candidates.mockResolvedValue({data:{payments:[{_id:'payment',display_id:1401,clientId:'client',amount:5100,currency:'PLN',paymentDate:'2026-10-16',status:'completed'}],requests:[]}} as any);
  mount(); fireEvent.click(await screen.findByRole('button',{name:'Manage receipt'}));
  fireEvent.click(await screen.findByRole('button',{name:'Select existing payment'}));
  fireEvent.click(screen.getByLabelText(/I checked the original transaction/)); fireEvent.click(screen.getByLabelText('I reviewed the receipt and selected relationships.'));
  api.reconcile.mockResolvedValue({data:{...row,status:'converted',paymentId:'payment',payment:{display_id:1401}}} as any);
  fireEvent.click(screen.getByRole('button',{name:'Confirm link to existing payment'}));
  await waitFor(()=>expect(api.reconcile).toHaveBeenCalledWith('receipt',expect.objectContaining({action:'link',paymentId:'payment',clientId:'client',confirmAccount:true})));
});
