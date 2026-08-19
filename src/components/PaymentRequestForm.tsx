import React, { useEffect, useState } from 'react';
import { PaymentRequest, Client, Retreat, Ceremony } from '../types';
import SearchableClientSelect from './SearchableClientSelect';
import SearchableRetreatSelect from './SearchableRetreatSelect';
import { bookingsApi, ceremoniesApi, clientsApi, paymentRequestsApi, paymentsApi, retreatsApi } from '../services/api';
import { FiSave, FiArrowLeft } from 'react-icons/fi';
import { toDateInputValue, todayDateInputValue } from '../utils/dateFormat';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

interface PaymentRequestFormProps {
  paymentRequest?: Partial<PaymentRequest>;
  onSave: (data: Omit<PaymentRequest, '_id'>) => Promise<void>;
  onCancel: () => void;
  isEdit?: boolean;
}

const defaultDate = () => todayDateInputValue();
const resolveId = (value: any) => (typeof value === 'object' && value?._id ? value._id : value || '');

const PaymentRequestForm: React.FC<PaymentRequestFormProps> = ({
  paymentRequest,
  onSave,
  onCancel,
  isEdit = false,
}) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [ceremonies, setCeremonies] = useState<Ceremony[]>([]);
  const [loading, setLoading] = useState(false);
  const [nextDisplayId, setNextDisplayId] = useState<number | null>(paymentRequest?.display_id || null);
  const [formError, setFormError] = useState('');
  const [bookingDefaultsLoading, setBookingDefaultsLoading] = useState(false);
  const [bookingDefaultsMessage, setBookingDefaultsMessage] = useState('');
  const [usdPreview, setUsdPreview] = useState({
    amount: paymentRequest?.usd_amount?.toString() || paymentRequest?.fullPriceUsdAmount?.toString() || '',
    loading: false,
    error: '',
  });
  const [formData, setFormData] = useState({
    display_id: paymentRequest?.display_id || '',
    invoiceNumber: paymentRequest?.invoiceNumber || paymentRequest?.display_id?.toString() || '',
    clientId: resolveId(paymentRequest?.clientId),
    retreatId: resolveId(paymentRequest?.retreatId),
    bookingId: resolveId(paymentRequest?.bookingId),
    bookingType: paymentRequest?.bookingType || 'full_retreat',
    ceremonyId: resolveId(paymentRequest?.ceremonyId),
    ceremonyNumber: paymentRequest?.ceremonyNumber?.toString() || '',
    paymentDate: paymentRequest?.paymentDate ? toDateInputValue(paymentRequest.paymentDate) : defaultDate(),
    paymentType: paymentRequest?.paymentType || 'Other',
    requestType: paymentRequest?.requestType || 'full_payment',
    fullPriceQuote: paymentRequest?.fullPriceQuote?.toString() || '',
    requestedAmount: (paymentRequest?.requestedAmount ?? paymentRequest?.amountPaid)?.toString() || '',
    currency: paymentRequest?.currency || 'EUR',
    note: paymentRequest?.note || paymentRequest?.notes || '',
    status: paymentRequest?.status || 'pending',
    dueDate: paymentRequest?.dueDate ? toDateInputValue(paymentRequest.dueDate) : '',
    paidDate: paymentRequest?.paidDate ? toDateInputValue(paymentRequest.paidDate) : '',
    isUrgent: paymentRequest?.isUrgent || false,
    paymentInstructions: paymentRequest?.paymentInstructions || '',
    createdBy: paymentRequest?.createdBy || '',
  });

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [clientsResponse, retreatsResponse, nextIdResponse] = await Promise.all([
          clientsApi.getAll(),
          retreatsApi.getAll(),
          isEdit ? Promise.resolve(null) : paymentRequestsApi.getNextDisplayIdFresh().catch((error) => {
            console.error('Error fetching next payment request display ID:', error);
            return null;
          }),
        ]);
        setClients(clientsResponse.data || []);
        setRetreats(retreatsResponse.data || []);
        if (!isEdit && nextIdResponse?.data) {
          setNextDisplayId(nextIdResponse.data);
          handleChange('display_id', nextIdResponse.data);
          handleChange('invoiceNumber', nextIdResponse.data.toString());
        }
      } catch (error) {
        console.error('Error fetching payment request options:', error);
      }
    };

    loadOptions();
  }, []);

  // A new request for a client should follow their active booking. This keeps
  // the retreat, quote, balance, and currency aligned with the booking ledger.
  useEffect(() => {
    if (!formData.clientId) {
      setBookings([]);
      return;
    }
    bookingsApi.getByClient(formData.clientId)
      .then((response) => setBookings((response.data || []).filter((booking: any) =>
        !['cancelled', 'moved', 'declined'].includes(String(booking.status || '').toLowerCase()),
      )))
      .catch(() => setBookings([]));
  }, [formData.clientId]);

  useEffect(() => {
    if (isEdit || !formData.clientId) return;
    let active = true;
    setBookingDefaultsLoading(true);
    setBookingDefaultsMessage('');
    Promise.all([
      bookingsApi.getByClient(formData.clientId),
      paymentsApi.getByClient(formData.clientId).catch(() => ({ data: [] })),
    ]).then(([bookingsResponse, paymentsResponse]) => {
      if (!active) return;
      const activeBookings = (bookingsResponse.data || []).filter((booking) =>
        !['cancelled', 'moved', 'declined'].includes(String(booking.status || '').toLowerCase()),
      );
      setBookings(activeBookings);
      if (!activeBookings.length) {
        setBookingDefaultsMessage('No active booking found for this client.');
        return;
      }
      const booking = [...activeBookings].sort((a, b) =>
        new Date(b.checkInDate || 0).getTime() - new Date(a.checkInDate || 0).getTime(),
      )[0];
      const bookingId = booking._id || '';
      const bookingPayments = (paymentsResponse.data || []).filter((payment: any) => {
        const paymentBookingId = resolveId(payment.bookingId);
        return paymentBookingId === bookingId && payment.status === 'completed';
      });
      const lastPayment = [...bookingPayments].sort((a: any, b: any) =>
        new Date(b.paymentDate || b.processedDate || 0).getTime() - new Date(a.paymentDate || a.processedDate || 0).getTime(),
      )[0] as any;
      const fullPrice = Number(booking.totalAmount || 0);
      const remaining = Math.max(0, fullPrice - Number(booking.amountPaid || 0));
      const currency = lastPayment?.bookingCurrency || lastPayment?.currency || booking.currency || 'EUR';
      setFormData((prev) => ({
        ...prev,
        retreatId: resolveId(booking.retreatId),
        requestType: 'balance',
        fullPriceQuote: String(fullPrice),
        requestedAmount: String(remaining),
        currency,
      }));
      setBookingDefaultsMessage(`Active booking defaults loaded${lastPayment ? ` · currency from last payment (${currency})` : ''}.`);
    }).catch(() => {
      if (active) setBookingDefaultsMessage('Unable to load active booking defaults.');
    }).finally(() => {
      if (active) setBookingDefaultsLoading(false);
    });
    return () => { active = false; };
  }, [formData.clientId, isEdit]);

  useEffect(() => {
    if (!formData.retreatId) {
      setCeremonies([]);
      return;
    }
    ceremoniesApi.getByRetreat(formData.retreatId)
      .then((response) => setCeremonies((response.data || []).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      )))
      .catch(() => setCeremonies([]));
  }, [formData.retreatId]);

  useEffect(() => {
    const amount = Number(formData.fullPriceQuote);
    if (!amount || Number.isNaN(amount) || !formData.currency) {
      setUsdPreview({ amount: '', loading: false, error: '' });
      return;
    }

    let active = true;
    const timeout = window.setTimeout(async () => {
      try {
        setUsdPreview((current) => ({ ...current, loading: true, error: '' }));
        const response = await paymentsApi.convertToUsd(amount, formData.currency);
        if (active) {
          setUsdPreview({
            amount: String(response.data.usd_amount ?? ''),
            loading: false,
            error: '',
          });
        }
      } catch (error) {
        console.error('Error previewing USD payment request amount:', error);
        if (active) {
          setUsdPreview({ amount: '', loading: false, error: 'USD conversion unavailable' });
        }
      }
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [formData.fullPriceQuote, formData.currency]);

  useEffect(() => {
    const fullPrice = Number(formData.fullPriceQuote);
    if (!Number.isFinite(fullPrice) || fullPrice <= 0) return;

    if (formData.requestType === 'deposit') {
      const depositAmount = String(Math.round(fullPrice * 0.4 * 100) / 100);
      if (formData.requestedAmount !== depositAmount) {
        setFormData(prev => ({ ...prev, requestedAmount: depositAmount }));
      }
    } else if (!formData.requestedAmount || Number(formData.requestedAmount) === 0) {
      setFormData(prev => ({ ...prev, requestedAmount: String(fullPrice) }));
    }
  }, [formData.fullPriceQuote, formData.requestedAmount, formData.requestType]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const invoiceNumber = String(formData.invoiceNumber || '').trim();
    if (!invoiceNumber || !formData.clientId || !formData.retreatId || !formData.paymentDate || !formData.fullPriceQuote || !formData.requestedAmount) {
      alert('Please fill in all required fields');
      return;
    }
    if (formData.bookingType === 'booster' && !formData.ceremonyNumber) {
      alert('Please select the ceremony for this booster.');
      return;
    }

    setLoading(true);
    try {
      const existingRequests = await paymentRequestsApi.getAllFresh();
      const normalizedInvoice = invoiceNumber.toLowerCase();
      const duplicate = (existingRequests.data || []).find((request: PaymentRequest) => {
        const requestId = request._id || '';
        const currentId = paymentRequest?._id || '';
        return requestId !== currentId && String(request.invoiceNumber || '').trim().toLowerCase() === normalizedInvoice;
      });
      if (duplicate) {
        setFormError(`Invoice number ${invoiceNumber} already exists. Save cancelled.`);
        return;
      }

      const fullPriceQuote = parseFloat(formData.fullPriceQuote);
      const requestedAmount = parseFloat(formData.requestedAmount);
      await onSave({
        display_id: Number.isFinite(Number(formData.display_id)) ? Number(formData.display_id) : undefined,
        invoiceNumber,
        clientId: formData.clientId,
        retreatId: formData.retreatId,
        bookingId: formData.bookingId || undefined,
        bookingType: formData.bookingType as PaymentRequest['bookingType'],
        ceremonyId: formData.bookingType === 'booster' ? formData.ceremonyId : undefined,
        ceremonyNumber: formData.bookingType === 'booster' ? Number(formData.ceremonyNumber) : undefined,
        paymentDate: formData.paymentDate,
        paymentType: formData.paymentType as PaymentRequest['paymentType'],
        requestType: formData.requestType as PaymentRequest['requestType'],
        requestedAmount,
        fullPrice: fullPriceQuote,
        fullPriceQuote,
        amountPaid: requestedAmount,
        currency: formData.currency as PaymentRequest['currency'],
        note: formData.note || '',
        notes: formData.note || '',
        status: formData.status as PaymentRequest['status'],
        dueDate: formData.dueDate || undefined,
        paidDate: formData.paidDate || undefined,
        isUrgent: formData.isUrgent,
        paymentInstructions: formData.paymentInstructions || undefined,
        createdBy: formData.createdBy || undefined,
      });
    } catch (error) {
      console.error('Error saving payment request:', error);
      alert('Error saving payment request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            <Icon icon={FiArrowLeft} className="w-4 h-4" />
            Back
          </button>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-gray-900 whitespace-nowrap">
              {isEdit ? 'Edit Payment Request' : 'Add Payment Request'}
            </h1>
            <p className="text-sm text-gray-600">
              {isEdit ? 'Update invoice and payment request details' : 'Create a new invoice or payment request'}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        {formError && (
          <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {formError}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Invoice Number</label>
              <input
                type="text"
                value={formData.invoiceNumber}
                onChange={(e) => handleChange('invoiceNumber', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={nextDisplayId ? nextDisplayId.toString() : '1001'}
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                Must be unique. Save is cancelled if another request already uses it.
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Client *</label>
              <SearchableClientSelect
                clients={clients}
                selectedClientId={formData.clientId}
                onClientSelect={(clientId) => handleChange('clientId', clientId)}
                placeholder="Search client by display number, name, or email"
                className="w-full"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Retreat *</label>
              <SearchableRetreatSelect
                retreats={retreats}
                selectedRetreatId={formData.retreatId}
                onRetreatSelect={(retreatId) => setFormData((prev) => ({ ...prev, retreatId, ceremonyId: '', ceremonyNumber: '' }))}
                placeholder="Search retreat by name or location"
                className="w-full"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Booking</label>
              <select
                value={formData.bookingId}
                onChange={(event) => {
                  const booking = bookings.find((item) => item._id === event.target.value);
                  setFormData((prev) => ({
                    ...prev,
                    bookingId: event.target.value,
                    retreatId: booking ? resolveId(booking.retreatId) : prev.retreatId,
                  }));
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No booking linked</option>
                {bookings.map((booking) => (
                  <option key={booking._id} value={booking._id}>
                    #{booking.bookingNumber || booking.display_id || booking._id} — {booking.retreat?.name || booking.retreatName || resolveId(booking.retreatId)}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">Linking a booking includes recorded payments in its balance.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Booking type *</label>
              <select
                value={formData.bookingType}
                onChange={(event) => setFormData((prev) => ({
                  ...prev,
                  bookingType: event.target.value as 'full_retreat' | 'booster',
                  ceremonyId: event.target.value === 'booster' ? prev.ceremonyId : '',
                  ceremonyNumber: event.target.value === 'booster' ? prev.ceremonyNumber : '',
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="full_retreat">Full retreat</option>
                <option value="booster">Booster in this retreat</option>
              </select>
            </div>

            {formData.bookingType === 'booster' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ceremony *</label>
                <select
                  value={formData.ceremonyNumber}
                  onChange={(event) => {
                    const position = Number(event.target.value);
                    handleChange('ceremonyNumber', event.target.value);
                    handleChange('ceremonyId', ceremonies[position - 1]?._id || '');
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select ceremony</option>
                  {Array.from({ length: retreats.find((item) => item._id === formData.retreatId)?.ceremonyCount || 2 }, (_, index) => (
                    <option key={index + 1} value={index + 1}>
                      Ceremony {index + 1}{ceremonies[index]?.date ? ` — ${new Date(ceremonies[index].date).toLocaleDateString()}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Request Date *</label>
              <input
                type="date"
                value={formData.paymentDate}
                onChange={(e) => handleChange('paymentDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Request Type</label>
              <select
                value={formData.requestType}
                onChange={(e) => handleChange('requestType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="deposit">Deposit</option>
                <option value="balance">Balance</option>
                <option value="installment">Installment</option>
                <option value="full_payment">Full Payment</option>
                <option value="additional">Additional</option>
              </select>
            </div>

            {bookingDefaultsLoading && (
              <div className="md:col-span-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                Loading active booking defaults…
              </div>
            )}
            {!bookingDefaultsLoading && bookingDefaultsMessage && (
              <div className="md:col-span-2 rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                {bookingDefaultsMessage}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Full Price Quote *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.fullPriceQuote}
                onChange={(e) => handleChange('fullPriceQuote', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Requested Amount *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.requestedAmount}
                onChange={(e) => handleChange('requestedAmount', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
                required
              />
              {formData.requestType === 'deposit' && (
                <p className="mt-1 text-xs text-gray-500">Auto-calculated as 40% of the full price.</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Currency *</label>
              <select
                value={formData.currency}
                onChange={(e) => handleChange('currency', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="CZK">CZK</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="PLN">PLN</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">USD Amount</label>
              <input
                type="text"
                value={
                  usdPreview.loading
                    ? 'Calculating...'
                    : usdPreview.amount
                      ? `$${Number(usdPreview.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : ''
                }
                readOnly
                className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-700"
                placeholder="Calculated on save"
              />
              {usdPreview.error && <p className="mt-1 text-xs text-red-600">{usdPreview.error}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => handleChange('dueDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Paid Date</label>
              <input
                type="date"
                value={formData.paidDate}
                onChange={(e) => handleChange('paidDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">Actual date paid; leave empty until payment is applied.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="pending">Pending</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="flex items-center pt-7">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={formData.isUrgent}
                  onChange={(e) => handleChange('isUrgent', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Mark as urgent
              </label>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Note</label>
              <textarea
                value={formData.note}
                onChange={(e) => handleChange('note', e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Additional notes or context"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Instructions</label>
              <textarea
                value={formData.paymentInstructions}
                onChange={(e) => handleChange('paymentInstructions', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Bank details, reference text, or other instructions"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icon icon={FiSave} className="w-4 h-4" />
              {loading ? 'Saving...' : isEdit ? 'Update Request' : 'Create Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentRequestForm;
