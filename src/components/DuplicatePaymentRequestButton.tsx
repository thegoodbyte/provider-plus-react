import React, { useRef, useState } from 'react';
import { Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { invoiceDraftsApi, serviceRequestsApi } from '../services/api';
import { duplicateServiceRequest } from './paymentRequestDuplication';
import { draftFingerprint, newInvoiceDraftId } from './useInvoiceDraft';
export default function DuplicatePaymentRequestButton({ request, iconOnly = false, className = '' }: { request: any; iconOnly?: boolean; className?: string }) {
  const navigate = useNavigate(), flight = useRef(false), draftId = useRef('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const duplicate = async () => {
    if (flight.current) return;
    if (request.context !== 'standalone_service') { navigate(`/admin/payment-requests/new?duplicateFrom=${encodeURIComponent(request._id)}`); return; }
    flight.current = true; setBusy(true); setError('');
    try {
      const source = (await serviceRequestsApi.get(request._id)).data;
      const payload = duplicateServiceRequest(source);
      if (!draftId.current) draftId.current = newInvoiceDraftId();
      try { await invoiceDraftsApi.save(draftId.current, { revision: 0, payload }); }
      catch (e) {
        // An ambiguous response may have saved successfully. Reuse that exact draft.
        const saved = await invoiceDraftsApi.get(draftId.current).catch(() => { throw e; });
        if (saved.data.status !== 'draft' || draftFingerprint(saved.data.payload) !== draftFingerprint(payload)) throw e;
      }
      navigate(`/admin/payment-requests/services/new?draftId=${encodeURIComponent(draftId.current)}&duplicateFrom=${encodeURIComponent(request._id)}`);
    } catch (e: any) { setError(e?.response?.data?.message || e.message || 'Could not duplicate this request. Try again.'); }
    finally { flight.current = false; setBusy(false); }
  };
  return <span className="inline-flex flex-col items-start gap-1"><button type="button" title="Duplicate payment request" aria-label="Duplicate payment request" className={className || 'inline-flex min-h-11 items-center gap-2 rounded-md border border-teal-700 px-3 py-2 font-semibold text-teal-800 disabled:opacity-50'} disabled={busy} onClick={duplicate}><Copy size={18} aria-hidden="true"/>{!iconOnly && (busy ? 'Copying…' : 'Duplicate')}</button>{error && <span role="alert" className="max-w-xs whitespace-normal text-sm text-red-700">{error}</span>}</span>;
}
