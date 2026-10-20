import React, { useEffect, useRef, useState } from 'react';
import { paymentsApi } from '../services/api';
export type RequestConversion = { requestCurrencyAmount: string; requestCurrencyExchangeMode: 'automatic' | 'manual'; requestCurrencyExchangeSource: string; requestCurrencyExchangeDate: string };
export const emptyRequestConversion: RequestConversion = { requestCurrencyAmount: '', requestCurrencyExchangeMode: 'automatic', requestCurrencyExchangeSource: '', requestCurrencyExchangeDate: '' };
export default function RequestCurrencyConversion({ amount, currency, target, paymentDate, value, onChange }: { amount: string; currency: string; target: string; paymentDate: string; value: RequestConversion; onChange: (patch: Partial<RequestConversion>) => void }) {
 const [error, setError] = useState(''), [busy, setBusy] = useState(false), [publishedDate, setPublishedDate] = useState('');
 const change = useRef(onChange); change.current = onChange;
 const date = value.requestCurrencyExchangeDate || paymentDate;
 useEffect(() => {
  if (value.requestCurrencyExchangeMode !== 'automatic' || !(Number(amount) > 0)) { setBusy(false); setError(''); return; }
  let active = true; setBusy(true); setError('');
  const timeout = window.setTimeout(async () => {
   try { const response = await paymentsApi.conversionQuote(Number(amount), currency, target, date); if (active) { setPublishedDate(response.data.rateDate); change.current({ requestCurrencyAmount: response.data.amount.toFixed(2), requestCurrencyExchangeSource: response.data.source }); } }
   catch { if (active) { setError('The dated rate is unavailable. Try again or enter the confirmed equivalent and its source manually.'); change.current({ requestCurrencyAmount: '', requestCurrencyExchangeSource: '' }); } }
   finally { if (active) setBusy(false); }
  }, 250);
  return () => { active = false; window.clearTimeout(timeout); };
 }, [amount, currency, target, date, value.requestCurrencyExchangeMode]);
 return <fieldset className="md:col-span-2 rounded-lg border border-amber-200 bg-amber-50 p-4"><legend className="px-1 font-semibold">Payment request currency equivalent</legend>
  <p className="mb-3 text-sm">Received in {currency}; credit the payment request in {target}. The request amount and currency stay unchanged.</p>
  <div className="grid gap-3 sm:grid-cols-2">
   <label>Conversion method<select aria-label="Request conversion method" className="mt-1 w-full rounded border p-2" value={value.requestCurrencyExchangeMode} onChange={e => onChange({ requestCurrencyExchangeMode: e.target.value as RequestConversion['requestCurrencyExchangeMode'], requestCurrencyAmount: '', requestCurrencyExchangeSource: '' })}><option value="automatic">Automatic dated ECB rate</option><option value="manual">Confirmed bank or manual equivalent</option></select></label>
   <label>{target} credited equivalent<input aria-label={`${target} credited equivalent`} className="mt-1 w-full rounded border p-2" type="number" min="0.01" step="0.01" value={value.requestCurrencyAmount} readOnly={value.requestCurrencyExchangeMode === 'automatic'} required={value.requestCurrencyExchangeMode === 'manual'} onChange={e => onChange({ requestCurrencyAmount: e.target.value })} /></label>
   <label>Conversion source<input aria-label="Request conversion source" className="mt-1 w-full rounded border p-2" value={value.requestCurrencyExchangeSource} readOnly={value.requestCurrencyExchangeMode === 'automatic'} required={value.requestCurrencyExchangeMode === 'manual'} minLength={3} maxLength={500} placeholder="Bank statement, Revolut confirmation, or agreed rate" onChange={e => onChange({ requestCurrencyExchangeSource: e.target.value })} /></label>
   <label>Conversion date<input aria-label="Request conversion date" className="mt-1 w-full rounded border p-2" type="date" required value={date} onChange={e => onChange({ requestCurrencyExchangeDate: e.target.value })} /></label>
  </div>
  {Number(amount) > 0 && Number(value.requestCurrencyAmount) > 0 && <p className="mt-2 text-sm">1 {currency} = {(Number(value.requestCurrencyAmount) / Number(amount)).toFixed(6)} {target}</p>}
  {value.requestCurrencyExchangeMode === 'automatic' && publishedDate && !busy && !error && <p className="mt-2 text-sm">Published ECB rate date: {publishedDate}</p>}
  {busy && <p role="status" className="mt-2 text-sm">Calculating the dated equivalent…</p>}{error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
 </fieldset>;
}
