import React, { useEffect, useState } from 'react';
import SearchableClientSelect from './SearchableClientSelect';
import { paymentRequestsApi } from '../services/api';
export type ReceiptMatchingDetails = { clientId: string; paymentRequestId: string };
const id = (value: any): string => String(value?._id || value || '');
const clientName = (value: any) => [value?.firstName, value?.lastName].filter(Boolean).join(' ');
export default function ScratchpadEditMatching({ clients, requests, currency, value, onChange }: {
  clients: any[]; requests: any[]; currency: string; value: ReceiptMatchingDetails; onChange: (value: ReceiptMatchingDetails) => void;
}) {
  const [search, setSearch] = useState('');
  const [settlement, setSettlement] = useState<any>(null);
  const [settlementError, setSettlementError] = useState(false);
  useEffect(() => {
    let active = true; setSettlement(null); setSettlementError(false);
    if (value.paymentRequestId) paymentRequestsApi.getSettlement(value.paymentRequestId).then(response => { if (active) setSettlement(response.data); }).catch(() => { if (active) setSettlementError(true); });
    return () => { active = false; };
  }, [value.paymentRequestId]);
  const compatible = requests.filter(request => request.status !== 'cancelled' && request.currency === currency && (!value.clientId || id(request.clientId) === value.clientId));
  const selected = requests.find(request => id(request) === value.paymentRequestId);
  return <section aria-label="Client and payment request" className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4 sm:col-span-2 lg:col-span-3">
    <h3 className="font-semibold">Client and payment request</h3>
    <p className="text-sm text-slate-700">Save who this receipt is for. Saving does not create a payment or change balances. You can make the payment afterwards.</p>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="min-w-0">Client (optional)<SearchableClientSelect clients={clients} ariaLabel="Receipt client (optional)" value={value.clientId} onChange={clientId => onChange({ clientId, paymentRequestId: selected && id(selected.clientId) === clientId ? value.paymentRequestId : '' })} /></label>
      <div className="min-w-0 space-y-2"><label className="block">Search payment requests<input className="mt-1 w-full rounded-lg border p-2" value={search} onChange={event => setSearch(event.target.value)} placeholder="PR number or client name" /></label>
        <label className="block">Payment request (optional)<select className="mt-1 w-full rounded-lg border p-2" value={value.paymentRequestId} onChange={event => { const request = requests.find(row => id(row) === event.target.value); onChange({ clientId: request ? id(request.clientId) : value.clientId, paymentRequestId: event.target.value }); }}>
          <option value="">No payment request</option>
          {value.paymentRequestId && !compatible.some(request => id(request) === value.paymentRequestId) && <option value={value.paymentRequestId}>Saved PR unavailable — clear or choose another</option>}
          {compatible.filter(request => id(request) === value.paymentRequestId || `${request.display_id || ''} ${request.invoiceNumber || ''} ${clientName(request.clientId)}`.toLowerCase().includes(search.toLowerCase())).map(request => <option key={id(request)} value={id(request)}>PR #{request.display_id || request.invoiceNumber} · {clientName(request.clientId) || clientName(clients.find(client => id(client) === id(request.clientId)))} · Requested {request.requestedAmount} {request.currency}</option>)}
        </select></label>
      </div>
    </div>
    {value.paymentRequestId && <p className="text-sm" role="status">{settlementError ? 'Outstanding amount unavailable. Check the request before making the payment.' : settlement ? `Unpaid amount: ${settlement.amountOutstanding} ${selected?.currency || currency}` : 'Loading unpaid amount…'}</p>}
    {value.clientId && !value.paymentRequestId && <p className="text-sm">Client saved without a PR. No request will be marked paid by saving this receipt.</p>}
    {(value.clientId || value.paymentRequestId) && <button className="text-sm underline" type="button" onClick={() => onChange({ clientId: '', paymentRequestId: '' })}>Clear client and PR</button>}
  </section>;
}
