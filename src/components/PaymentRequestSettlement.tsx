import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { paymentRequestsApi } from '../services/api';
import { apiErrorMessage } from '../utils/apiErrorMessage';
import { formatCalendarDate } from '../utils/dateFormat';
const money = (amount: number, currency: string) => `${Number(amount || 0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})} ${currency}`;
export default function PaymentRequestSettlement({ requestId }: { requestId: string }) {
  const [data,setData] = useState<any>(null), [error,setError] = useState('');
  useEffect(()=>{let live=true;setError('');setData(null);(async()=>{try{const response=await paymentRequestsApi.getSettlement(requestId);if(live)setData(response.data);}catch(e){if(live)setError(apiErrorMessage(e,'Unable to load request settlement. Review its payment records.'));}})();return()=>{live=false;};},[requestId]);
  return <section aria-label="Request payment settlement" className="my-6 rounded-lg border border-blue-200 bg-white p-4">
    <h2 className="text-lg font-semibold">Payments against this request</h2>
    {error ? <p role="alert" className="mt-3 text-red-800">{error}</p> : !data ? <p role="status">Loading payments…</p> : <>
      <div className="my-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{[['Invoice amount',data.requestedAmount],['Received',data.amountReceived],['Remaining',data.amountOutstanding],['Overpaid',data.amountOverpaid]].map(([label,amount])=><div key={label} className="rounded-md bg-gray-50 p-3"><div className="text-xs text-gray-600">{label}</div><strong>{money(Number(amount),data.currency)}</strong></div>)}</div>
      {data.settlementStatus==='partial' && <p className="my-3 text-amber-900">Partially paid. Record each later transfer against this same request using its actual amount and date.</p>}
      {data.amountOverpaid > 0 && <p className="my-3 rounded-md bg-amber-50 p-3 text-amber-900">Overpayment: {money(data.amountOverpaid,data.currency)}. Review the payments with the client before recording a refund or agreeing how to handle the extra money. No refund or credit transfer is automatic.</p>}
      <p className="my-3 text-sm text-gray-600">The invoice amount stays unchanged. Received and remaining amounts come from completed payments and recorded refunds, using saved currency equivalents. Pending and failed payments do not count.</p>
      {!data.payments.length ? <p>No payments recorded against this request.</p> : <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr><th className="p-2">Payment</th><th className="p-2">Received date</th><th className="p-2">Actual amount</th><th className="p-2">Status</th></tr></thead><tbody>{data.payments.map((payment:any)=><tr key={payment._id} className="border-t"><td className="p-2"><Link className="text-blue-700 underline" to={`/admin/payments/${payment._id}`}>Payment #{payment.display_id || payment._id}</Link></td><td className="whitespace-nowrap p-2">{formatCalendarDate(payment.paymentDate)}</td><td className="whitespace-nowrap p-2">{money(payment.amount,payment.currency)}</td><td className="p-2">{payment.status}{payment.paymentType==='refund'?' · refund':''}</td></tr>)}</tbody></table></div>}
    </>}
  </section>;
}
