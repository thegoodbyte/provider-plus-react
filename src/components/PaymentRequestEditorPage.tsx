import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import PaymentRequestForm from './PaymentRequestForm';
import LoadingSpinner from './LoadingSpinner';
import { paymentRequestsApi } from '../services/api';
import { PaymentRequest } from '../types';
import { formatCalendarDate } from '../utils/dateFormat';

const resolveClientName = (value: any) => {
  if (!value) return 'Unknown client';
  if (typeof value === 'string') return value;
  const name = [value.firstName || value.fname, value.lastName || value.lname].filter(Boolean).join(' ').trim();
  const displayId = value.display_id ? `Client #${value.display_id}` : '';
  return [name || value.email || 'Unknown client', displayId].filter(Boolean).join(' - ');
};

const resolveRetreatName = (value: any) => {
  if (!value) return 'Unknown retreat';
  if (typeof value === 'string') return value;
  return [value.name, value.location].filter(Boolean).join(' - ') || 'Unknown retreat';
};

const formatAmount = (value: any, currency?: string) => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return '-';
  return `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency || ''}`.trim();
};

const formatDate = (value: any) => {
  if (!value) return '-';
  return formatCalendarDate(value);
};

const buildPaymentRequestFromSearch = (search: string): Partial<PaymentRequest> => {
  const params = new URLSearchParams(search);
  return {
    clientId: params.get('clientId') || undefined,
    retreatId: params.get('retreatId') || undefined,
    requestType: (params.get('requestType') as PaymentRequest['requestType']) || undefined,
    paymentType: (params.get('paymentType') as PaymentRequest['paymentType']) || undefined,
    fullPriceQuote: params.get('fullPrice') ? Number(params.get('fullPrice')) : undefined,
    fullPrice: params.get('fullPrice') ? Number(params.get('fullPrice')) : undefined,
    currency: (params.get('currency') as PaymentRequest['currency']) || undefined,
    note: params.get('note') || undefined,
  };
};

const PaymentRequestEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isView = Boolean(id) && !location.pathname.endsWith('/edit');
  const [loading, setLoading] = useState(Boolean(id));
  const [paymentRequest, setPaymentRequest] = useState<Partial<PaymentRequest> | undefined>(
    () => (id ? undefined : buildPaymentRequestFromSearch(location.search))
  );

  useEffect(() => {
    const loadRequest = async () => {
      if (!id) {
        setLoading(false);
        setPaymentRequest(buildPaymentRequestFromSearch(location.search));
        return;
      }

      try {
        setLoading(true);
        const response = await paymentRequestsApi.getOne(id);
        setPaymentRequest(response.data);
      } catch (error) {
        console.error('Error loading payment request:', error);
      } finally {
        setLoading(false);
      }
    };

    loadRequest();
  }, [id, location.search]);

  const handleSave = async (data: Omit<PaymentRequest, '_id'>) => {
    if (id) {
      await paymentRequestsApi.update(id, data);
    } else {
      await paymentRequestsApi.create(data);
    }
    navigate('/admin/payment-requests');
  };

  if (loading) {
    return <LoadingSpinner message={id ? 'Loading payment request...' : 'Loading form...'} />;
  }

  if (isView && id && paymentRequest) {
    const invoiceNumber = paymentRequest.invoiceNumber || paymentRequest.display_id || id;
    const linkedPayment: any = paymentRequest.paymentId && typeof paymentRequest.paymentId === 'object' ? paymentRequest.paymentId : null;
    const linkedPaymentId = linkedPayment?._id || (typeof paymentRequest.paymentId === 'string' ? paymentRequest.paymentId : '');
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => navigate('/admin/payment-requests')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            Back
          </button>
          <div className="flex gap-2">
            {!linkedPaymentId && paymentRequest.status !== 'paid' && <button
                type="button"
                onClick={() => navigate(`/admin/payments/new?paymentRequestId=${id}`, { state: { returnTo: '/admin/payment-requests' } })}
                className="px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700"
              >
                Add Payment
              </button>}
            <button
              type="button"
              onClick={() => navigate(`/admin/payment-requests/${id}/edit`)}
              className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              Edit
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <div className="text-sm font-semibold uppercase tracking-wide text-gray-500">Payment Request</div>
            <h1 className="mt-1 text-3xl font-semibold text-gray-900">Invoice {invoiceNumber}</h1>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-md bg-gray-50 p-4">
              <div className="text-xs font-semibold uppercase text-gray-500">Client</div>
              <div className="mt-1 font-semibold text-gray-900">{resolveClientName(paymentRequest.clientId)}</div>
            </div>
            <div className="rounded-md bg-gray-50 p-4">
              <div className="text-xs font-semibold uppercase text-gray-500">Retreat</div>
              <div className="mt-1 font-semibold text-gray-900">{resolveRetreatName(paymentRequest.retreatId)}</div>
            </div>
            <div className="rounded-md bg-gray-50 p-4">
              <div className="text-xs font-semibold uppercase text-gray-500">Requested Amount</div>
              <div className="mt-1 font-semibold text-gray-900">{formatAmount(paymentRequest.requestedAmount || paymentRequest.amountPaid, paymentRequest.currency)}</div>
            </div>
            <div className="rounded-md bg-gray-50 p-4">
              <div className="text-xs font-semibold uppercase text-gray-500">Full Price / Quote</div>
              <div className="mt-1 font-semibold text-gray-900">{formatAmount(paymentRequest.fullPriceQuote || paymentRequest.fullPrice, paymentRequest.currency)}</div>
            </div>
            <div className="rounded-md bg-gray-50 p-4">
              <div className="text-xs font-semibold uppercase text-gray-500">Status</div>
              <div className="mt-1 font-semibold text-gray-900">{paymentRequest.status || '-'}</div>
            </div>
            <div className="rounded-md bg-gray-50 p-4">
              <div className="text-xs font-semibold uppercase text-gray-500">Payment Method</div>
              <div className="mt-1 font-semibold text-gray-900">{paymentRequest.paymentType || '-'}</div>
            </div>
            <div className="rounded-md bg-gray-50 p-4">
              <div className="text-xs font-semibold uppercase text-gray-500">Request Type</div>
              <div className="mt-1 font-semibold text-gray-900">{paymentRequest.requestType || '-'}</div>
            </div>
            <div className="rounded-md bg-gray-50 p-4">
              <div className="text-xs font-semibold uppercase text-gray-500">Request Date</div>
              <div className="mt-1 font-semibold text-gray-900">{formatDate(paymentRequest.paymentDate)}</div>
            </div>
            <div className="rounded-md bg-gray-50 p-4">
              <div className="text-xs font-semibold uppercase text-gray-500">Paid Date</div>
              <div className="mt-1 font-semibold text-gray-900">{paymentRequest.paidDate ? formatDate(paymentRequest.paidDate) : '-'}</div>
            </div>
            <div className="rounded-md bg-gray-50 p-4 md:col-span-2">
              <div className="text-xs font-semibold uppercase text-gray-500">Note</div>
              <div className="mt-1 whitespace-pre-wrap text-gray-900">{paymentRequest.note || paymentRequest.notes || '-'}</div>
            </div>
          </div>

          {Boolean(paymentRequest.lineItems?.length) && (
            <div className="mt-6 overflow-hidden rounded-lg border border-gray-200">
              <div className="bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-800">Itemization</div>
              <div className="divide-y divide-gray-100">
                {paymentRequest.lineItems!.map((item, index) => (
                  <div key={index} className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
                    <div>
                      <div className="font-medium text-gray-900">{item.description}</div>
                      {item.clientName && <div className="text-xs text-gray-500">{item.clientName}</div>}
                      {item.type === 'charge' && item.allocationAmount !== undefined && <div className="text-xs text-gray-500">Suggested receipt allocation: {formatAmount(item.allocationAmount, paymentRequest.currency)}</div>}
                    </div>
                    <div className={item.amount < 0 ? 'font-semibold text-green-700' : 'font-semibold text-gray-900'}>{formatAmount(item.amount, paymentRequest.currency)}</div>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 text-right text-sm">
                <div>Subtotal: {formatAmount(paymentRequest.subtotal, paymentRequest.currency)}</div>
                <div>Discount: {formatAmount(paymentRequest.discountTotal, paymentRequest.currency)}</div>
                <div className="mt-1 font-semibold">Total: {formatAmount(paymentRequest.requestedAmount, paymentRequest.currency)}</div>
              </div>
            </div>
          )}

          <div className="mt-6 border-t border-gray-200 pt-6">
            <h2 className="text-lg font-semibold text-gray-900">Associated Payment</h2>
            {linkedPaymentId ? (
              <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div><div className="text-xs font-semibold uppercase text-green-700">Payment</div><div className="mt-1 font-semibold text-gray-900">#{linkedPayment?.display_id || linkedPaymentId}</div></div>
                  <div><div className="text-xs font-semibold uppercase text-green-700">Amount</div><div className="mt-1 font-semibold text-gray-900">{formatAmount(linkedPayment?.bookingCurrencyAmount ?? linkedPayment?.amount, linkedPayment?.bookingCurrency || linkedPayment?.currency || paymentRequest.currency)}</div></div>
                  <div><div className="text-xs font-semibold uppercase text-green-700">Paid Date</div><div className="mt-1 font-semibold text-gray-900">{formatDate(linkedPayment?.paymentDate || linkedPayment?.processedDate || paymentRequest.paidDate)}</div></div>
                  <div><div className="text-xs font-semibold uppercase text-green-700">Method / Status</div><div className="mt-1 font-semibold text-gray-900">{[linkedPayment?.paymentMethod, linkedPayment?.status].filter(Boolean).join(' · ') || 'Linked'}</div></div>
                  {(linkedPayment?.transactionReference || linkedPayment?.transactionId) && <div className="md:col-span-2"><div className="text-xs font-semibold uppercase text-green-700">Reference</div><div className="mt-1 font-semibold text-gray-900">{linkedPayment.transactionReference || linkedPayment.transactionId}</div></div>}
                </div>
                <button type="button" onClick={() => navigate(`/admin/payments/${linkedPaymentId}`)} className="mt-4 rounded-md bg-green-700 px-4 py-2 font-semibold text-white hover:bg-green-800">View Payment</button>
              </div>
            ) : (
              <p className="mt-2 rounded-md bg-gray-50 p-4 text-gray-600">No payment is linked to this request.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <PaymentRequestForm
      paymentRequest={paymentRequest}
      onSave={handleSave}
      onCancel={() => navigate('/admin/payment-requests')}
      isEdit={Boolean(id)}
    />
  );
};

export default PaymentRequestEditorPage;
