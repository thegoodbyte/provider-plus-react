import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { paymentsApi, scratchpadApi, ScratchpadReceipt } from '../services/api';
const id = (value: any) => String(value?._id || value || '');
const name = (client: any) => [client?.firstName,client?.lastName].filter(Boolean).join(' ') || 'Client unavailable';
const errorMessage = (error: any) => { const value = error?.response?.data?.message; return Array.isArray(value) ? value.join(' ') : value || error?.message || 'Could not complete matching. Your selection is retained.'; };
const modes = [['request','PR number'],['client','Client / phone'],['amount','Unpaid PR amount'],['payment','Existing payment']] as const;
export default function ScratchpadGuidedMatch({receipt,initialMode,onSaved,onComplete,onBusy,onFallback}:{receipt:ScratchpadReceipt;initialMode?:string;onSaved:(row:ScratchpadReceipt)=>void;onComplete:(row:ScratchpadReceipt)=>void;onBusy:(value:boolean)=>void;onFallback:()=>void}) {
  const navigate = useNavigate();
  const initial = initialMode || (receipt.requestNumber||receipt.matchedPaymentRequestId?'request':receipt.phone||receipt.matchedClientId?'client':'amount');
  const [mode,setMode] = useState(initial);
  const [query,setQuery] = useState(initial==='request'?(receipt.matchedPaymentRequestId?'':receipt.requestNumber||''):initial==='client'?receipt.phone||'':receipt.amount);
  const [clientId,setClientId] = useState(receipt.matchedClientId||'');
  const [selected,setSelected] = useState<any>(null);
  const [bookingPrice,setBookingPrice] = useState('');
  const [attachRequest,setAttachRequest] = useState(true);
  useEffect(()=>{const request=selected?.type==='request'?selected.row:null;setBookingPrice(request?.fullPrice>0?String(request.fullPrice):request?.requestType==='full_payment'?String(request.requestedAmount):'');},[selected?.row?._id,selected?.type]);
  const [data,setData] = useState<any>({clients:[],requests:[],payments:[]});
  const [page,setPage] = useState(1), [requestPage,setRequestPage] = useState(1);
  const [loading,setLoading] = useState(true),[busy,setBusy] = useState(false),[error,setError] = useState(''),[notice,setNotice] = useState('');
  const [attempt,setAttempt] = useState(0);
  const searchSequence=useRef(0), suggestedFor=useRef('');
  const pending=Boolean(receipt.reconciliationPending);
  useEffect(()=>{
    const seq=++searchSequence.current;setLoading(true);setError('');
    const timer=setTimeout(async()=>{
      try {
        const response=await scratchpadApi.matches(receipt._id,{mode,q:query,clientId,page,requestPage});
        if(seq!==searchSequence.current)return;
        setData(response.data);
        const key=JSON.stringify([mode,query,clientId,page,requestPage]);
        if(mode==='request'&&response.data.suggestedRequestId&&suggestedFor.current!==key){suggestedFor.current=key;const request=response.data.requests.find((row:any)=>id(row)===response.data.suggestedRequestId);setSelected(request?{type:'request',row:request}:null);}
      }catch(e:any){if(seq===searchSequence.current){if(e?.response?.status===404){onFallback();return;}setError(errorMessage(e));}}
      finally{if(seq===searchSequence.current)setLoading(false);}
    },200);
    return()=>{clearTimeout(timer);++searchSequence.current;};
  },[receipt._id,mode,query,clientId,page,requestPage,attempt]);
  const switchMode=(next:string)=>{setMode(next);setSelected(null);setPage(1);setRequestPage(1);setNotice('');setQuery(next==='request'?receipt.requestNumber||'':next==='client'?receipt.phone||'':receipt.amount);};
  const select=(type:string,row:any)=>{setSelected(selected?.type===type&&id(selected.row)===id(row)?null:{type,row});setNotice('');};
  const refs = selected?.type==='request' ? {clientId:id(selected.row.clientId),paymentRequestId:id(selected.row),bookingId:id(selected.row.bookingId)} : selected?.type==='payment' ? {clientId:id(selected.row.clientId),paymentRequestId:id(selected.row.paymentRequestId)||(attachRequest&&id(selected.row.clientId)===receipt.matchedClientId?receipt.matchedPaymentRequestId||'':''),bookingId:id(selected.row.bookingId)} : {clientId,paymentRequestId:'',bookingId:''};
  const act=async(work:()=>Promise<void>)=>{setBusy(true);onBusy(true);setError('');setNotice('');try{await work();}catch(e){setError(errorMessage(e));}finally{setBusy(false);onBusy(false);}};
  const saveAssociation=async()=>{const {data:row}=await scratchpadApi.associate(receipt._id,{...refs,revision:receipt.revision});onSaved(row);return row;};
  const confirm=()=>act(async()=>{
    if(pending){const saved=receipt.reconciliation;const {data:row}=await scratchpadApi.confirmMatch(receipt._id,{...saved.targets,action:saved.action,paymentId:saved.paymentId,revision:receipt.revision,confirm:true,confirmAccount:saved.confirmAccount});onComplete(row);return;}
    if(!selected && !(mode==='client'&&clientId))return;
    const existing=selected?.type==='payment';
    let targetRefs=refs;
    if(existing && attachRequest && receipt.matchedPaymentRequestId && id(selected.row.clientId)===receipt.matchedClientId && (!id(selected.row.paymentRequestId)||selected.row.requestLinkPending)) {
      const response=await paymentsApi.linkRequest(id(selected.row),receipt.matchedPaymentRequestId);
      setSelected({type:'payment',row:{...selected.row,...response.data}});
      targetRefs={clientId:id(response.data.clientId),paymentRequestId:id(response.data.paymentRequestId),bookingId:id(response.data.bookingId)};
    }
    const {data:row}=await scratchpadApi.confirmMatch(receipt._id,{...targetRefs,action:existing?'link':'convert',paymentId:existing?id(selected?.row):'',revision:receipt.revision,confirm:true,confirmAccount:existing});
    onComplete(row);
  });
  const createBooking=()=>act(async()=>{
    const request=selected?.type==='request'?selected.row:null;
    if(!request?.retreatId?._id||request.bookingId||request.context==='standalone_service'||!(Number(bookingPrice)>0))return;
    await saveAssociation();
    const params=new URLSearchParams({clientId:id(request.clientId),retreatId:id(request.retreatId),paymentRequestId:id(request),currency:request.currency,totalAmount:bookingPrice,paymentPlanEnabled:'false',returnTo:`/admin/payments/scratchpad/${receipt._id}?match=1`});
    if(request.bookingType)params.set('bookingType',request.bookingType);
    navigate('/admin/bookings/new?'+params);
  });
  const blocked=selected?.row?.unavailableReason || (selected?.type==='request'&&Number(receipt.amount)>Number(selected.row.amountOutstanding)?'This receipt is larger than the unpaid request. Use shared receipt allocation.':'');
  return <section aria-label="Guided scratchpad matching" className="space-y-4">
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm"><strong>{receipt.amount} {receipt.currency}</strong> received {receipt.receivedDate}<span className="block text-emerald-900">{receipt.payer||'Payer not recorded'}{receipt.phone?` · ${receipt.phone}`:''}{receipt.requestNumber?` · PR ${receipt.requestNumber}`:''}</span></div>
    {pending?<p role="alert" className="rounded border border-amber-300 bg-amber-50 p-3">A confirmed match is unfinished. Resume it; changing the target would risk recording the money twice.</p>:<>
      <div role="group" aria-label="Match by" className="flex flex-wrap gap-2">{modes.map(([value,label])=><button type="button" key={value} aria-pressed={mode===value} disabled={busy} onClick={()=>switchMode(value)} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${mode===value?'border-emerald-800 bg-emerald-800 text-white':'border-slate-200 bg-white text-slate-700'}`}>{label}</button>)}</div>
      <label className="block text-sm font-medium">{mode==='request'?'Payment request number':mode==='client'?'Client name, number or phone':mode==='amount'?'Unpaid request amount':'Unlinked payment amount'}<input className="mt-1 w-full rounded-lg border border-slate-300 p-3" value={query} disabled={busy} inputMode={mode==='amount'||mode==='payment'?'decimal':'text'} onChange={event=>{setQuery(event.target.value);setPage(1);setRequestPage(1);setSelected(null);if(mode==='client')setClientId('');}}/></label>
      {mode==='client'&&<div aria-label="Matching clients" className="space-y-2">{data.clients?.map((client:any)=><button type="button" key={id(client)} disabled={busy} aria-pressed={clientId===id(client)} className={`block w-full rounded-lg border p-3 text-left text-sm ${clientId===id(client)?'border-emerald-600 bg-emerald-50':'border-slate-200 bg-white'}`} onClick={()=>{setClientId(id(client));setSelected(null);setRequestPage(1);}}><strong>#{client.display_id} {name(client)}</strong><span className="block">{client.phoneCountryCode} {client.phone}</span></button>)}{!loading&&!data.clients?.length&&<p className="text-sm text-slate-600">No clients found. Try their name, client number or phone.</p>}{clientId&&<button type="button" className="text-sm underline" onClick={()=>{setClientId('');setSelected(null);}}>Show all matching clients</button>}</div>}
      {loading?<p role="status">Finding matches…</p>:<div aria-label="Suggested matches" className="max-h-80 space-y-2 overflow-y-auto">
        {(mode==='payment'?data.payments:data.requests)?.map((row:any)=>{const isPayment=mode==='payment',type=isPayment?'payment':'request',checked=selected?.type===type&&id(selected.row)===id(row);return <label key={id(row)} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm ${checked?'border-emerald-600 bg-emerald-50':'border-slate-200 bg-white'}`}><input type="checkbox" className="mt-1" aria-label={`Select ${isPayment?'payment':'PR'} #${row.display_id||row.invoiceNumber||row._id}`} checked={checked} disabled={busy||Boolean(row.unavailableReason)} onChange={()=>select(type,row)}/><span className="min-w-0 break-words"><strong>{isPayment?'Payment':'PR'} #{row.display_id||row.invoiceNumber} · {isPayment?row.clientName:name(row.clientId)}</strong><span className="block">{isPayment?`${row.amount} ${row.currency} · ${String(row.paymentDate||'').slice(0,10)}`:`Unpaid ${row.amountOutstanding??'—'} ${row.currency} · Requested ${row.requestedAmount} ${row.currency}`}</span>{!isPayment&&row.retreatId&&<span className="block text-slate-600">{row.retreatId.retreatCode||row.retreatId.name} · {String(row.retreatId.startDate||'').slice(0,10)} – {String(row.retreatId.endDate||'').slice(0,10)}</span>}{row.unavailableReason&&<span className="block text-amber-800">{row.unavailableReason}</span>}{!isPayment&&row.amountMatches&&!row.unavailableReason&&<span className="block text-emerald-800">Amount matches this scratchpad entry</span>}</span></label>;})}
        {!(mode==='payment'?data.payments:data.requests)?.length&&<p className="rounded-lg bg-slate-50 p-3 text-sm">No eligible {mode==='payment'?'unlinked payments':'payment requests'} in this result window. Try another search or matching option.</p>}
      </div>}
      {(data.hasMore||page>1)&&<div className="flex items-center gap-3 text-sm"><button type="button" disabled={busy||loading||page<=1} onClick={()=>{setPage(page-1);setSelected(null);}}>Previous results</button><span>Page {page}</span><button type="button" disabled={busy||loading||!data.hasMore} onClick={()=>{setPage(page+1);setSelected(null);}}>More results</button></div>}
      {mode==='client'&&(data.requestHasMore||requestPage>1)&&<div className="flex gap-3 text-sm"><button type="button" disabled={busy||requestPage<=1} onClick={()=>{setRequestPage(requestPage-1);setSelected(null);}}>Previous requests</button><button type="button" disabled={busy||!data.requestHasMore} onClick={()=>{setRequestPage(requestPage+1);setSelected(null);}}>More unpaid requests</button></div>}
      {selected?.type==='request'&&!selected.row.bookingId&&selected.row.retreatId?._id&&selected.row.context!=='standalone_service'&&<div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm"><p><strong>Suggested booking</strong> · {name(selected.row.clientId)} · {selected.row.retreatId.name} · {String(selected.row.retreatId.startDate||'').slice(0,10)} – {String(selected.row.retreatId.endDate||'').slice(0,10)} · {selected.row.currency}</p><p className="mt-1">Review the client, dates and price in the booking form. Creating a booking does not confirm this payment.</p><label className="mt-2 block">Agreed full booking price ({selected.row.currency})<input aria-label="Suggested booking full price" type="number" min="0.01" step="0.01" className="mt-1 block w-full rounded border p-2" value={bookingPrice} onChange={event=>setBookingPrice(event.target.value)}/></label><button type="button" disabled={busy||!(Number(bookingPrice)>0)} className="mt-2 rounded border border-blue-700 bg-white px-3 py-2 font-semibold text-blue-800" onClick={createBooking}>Review / create suggested booking</button></div>}
      <div className="flex flex-wrap gap-2 border-t pt-3"><button type="button" disabled={busy||loading||!refs.clientId} className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50" onClick={()=>act(async()=>{await saveAssociation();setNotice('Client / PR saved to scratchpad. No payment, balance or paid status changed.');})}>Save client / PR only</button>{receipt.matchedClientId&&<button type="button" disabled={busy} className="text-sm underline" onClick={()=>act(async()=>{const {data:row}=await scratchpadApi.associate(receipt._id,{revision:receipt.revision,clientId:'',paymentRequestId:'',bookingId:''});onSaved(row);setClientId('');setSelected(null);setNotice('Saved association cleared. Money is unchanged.');})}>Clear saved association</button>}</div>
    </>}
    {selected?.type==='payment' && !id(selected.row.paymentRequestId) && receipt.matchedPaymentRequestId && id(selected.row.clientId)===receipt.matchedClientId && <label className="flex items-start gap-2 rounded border border-blue-200 bg-blue-50 p-3 text-sm"><input type="checkbox" checked={attachRequest} disabled={busy} onChange={event=>setAttachRequest(event.target.checked)}/>Also link this existing payment to the PR saved on the scratchpad. Its paid total will update on confirmation.</label>}
    {!selected&&mode==='client'&&clientId&&<p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">No request is selected. Creating a client-only payment will not mark any payment request paid or credit a booking.</p>}
    {selected&&<p className="rounded-lg bg-slate-50 p-3 text-sm">{selected.type==='payment'?'Link the existing payment without recording money again.':'Create one completed payment from this scratchpad entry. The request becomes paid only if its actual received total covers the amount due.'}</p>}
    {blocked&&<p role="alert" className="text-sm text-amber-900">{blocked}</p>}{error&&<p role="alert" className="text-sm text-red-800">{error} <button type="button" disabled={busy} className="underline" onClick={()=>setAttempt(attempt+1)}>Retry search</button></p>}{notice&&<p role="status" className="text-sm text-emerald-800">{notice}</p>}
    <button type="button" disabled={busy||!pending&&(loading||(!selected&&!(mode==='client'&&clientId))||Boolean(blocked))} className="w-full rounded-lg bg-emerald-800 px-4 py-3 font-semibold text-white disabled:opacity-40" onClick={confirm}>{busy?'Saving…':pending?'Resume confirmed match':selected?.type==='payment'?'Confirm link to existing payment':!selected&&mode==='client'&&clientId?'Create client payment without a PR':'Confirm payment from scratchpad'}</button>
  </section>;
}
