import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import PaymentRequestForm from './PaymentRequestForm';
import LoadingSpinner from './LoadingSpinner';
import { paymentRequestsApi } from '../services/api';
import { PaymentRequest } from '../types';

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
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString();
};

const PaymentRequestEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isView = Boolean(id) && !location.pathname.endsWith('/edit');
  const [loading, setLoading] = useState(Boolean(id));
  const [paymentRequest, setPaymentRequest] = useState<Partial<PaymentRequest> | undefined>(undefined);

  useEffect(() => {
    const loadRequest = async () => {
      if (!id) {
        const params = new URLSearchParams(location.search);
        setLoading(false);
        setPaymentRequest({
          clientId: params.get('clientId') || undefined,
          retreatId: params.get('retreatId') || undefined,
          requestType: (params.get('requestType') as PaymentRequest['requestType']) || undefined,
          paymentType: (params.get('paymentType') as PaymentRequest['paymentType']) || undefined,
          fullPriceQuote: params.get('fullPrice') ? Number(params.get('fullPrice')) : undefined,
          fullPrice: params.get('fullPrice') ? Number(params.get('fullPrice')) : undefined,
          currency: (params.get('currency') as PaymentRequest['currency']) || undefined,
          note: params.get('note') || undefined,
        });
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
            <button
              type="button"
              onClick={() => navigate(`/admin/payments/new?paymentRequestId=${id}`, { state: { returnTo: '/admin/payment-requests' } })}
              className="px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700"
            >
              Add Payment
            </button>
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
              <div className="text-xs font-semibold uppercase text-gray-500">Date</div>
              <div className="mt-1 font-semibold text-gray-900">{formatDate(paymentRequest.paymentDate)}</div>
            </div>
            <div className="rounded-md bg-gray-50 p-4 md:col-span-2">
              <div className="text-xs font-semibold uppercase text-gray-500">Note</div>
              <div className="mt-1 whitespace-pre-wrap text-gray-900">{paymentRequest.note || paymentRequest.notes || '-'}</div>
            </div>
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
