import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { bookingsApi, clientsApi, configSummaryApi, paymentRequestsApi, paymentsApi, retreatsApi } from '../services/api';
import { Client, Payment, PaymentRequest, Retreat, RetreatClient } from '../types';
import LoadingSpinner from './LoadingSpinner';
import SearchableClientSelect from './SearchableClientSelect';
import SearchableRetreatSelect from './SearchableRetreatSelect';
import SearchablePaymentRequestSelect from './SearchablePaymentRequestSelect';
import SearchableBookingSelect from './SearchableBookingSelect';
import { FiArrowLeft, FiSave } from 'react-icons/fi';
import { toDateInputValue, todayDateInputValue } from '../utils/dateFormat';
import { apiErrorMessage } from '../utils/apiErrorMessage';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

const DEFAULT_EXCHANGE_RATE_PROVIDER_LABEL = 'ECB reference rate';

const resolveId = (value: any) => (typeof value === 'object' && value?._id ? value._id : value || '');

const defaultDate = () => todayDateInputValue();

const getPaymentRequestAmount = (paymentRequest?: PaymentRequest | null) => {
  if (!paymentRequest) return '';
  const candidates = [
    paymentRequest.requestedAmount,
    paymentRequest.fullPriceQuote,
    paymentRequest.fullPrice,
    paymentRequest.amountPaid,
  ];
  const amount = candidates.find((value) => Number(value) > 0);
  return amount ?? '';
};

const paymentMethodFromRequest = (paymentType?: PaymentRequest['paymentType']): Payment['paymentMethod'] => {
  switch (paymentType) {
    case 'Paypal':
      return 'paypal';
    case 'Revolut':
      return 'revolut';
    case 'Wise':
      return 'wise';
    case 'Cash':
      return 'cash';
    case 'CSOB':
      return 'bank_transfer';
    default:
      return 'bank_transfer';
  }
};

const paymentTypeFromRequest = (requestType?: PaymentRequest['requestType']): Payment['paymentType'] => {
  switch (requestType) {
    case 'deposit':
      return 'deposit_non_refundable';
    case 'balance':
      return 'balance_payment';
    case 'additional':
      return 'adjustment';
    case 'full_payment':
    default:
      return 'regular_payment';
  }
};

const PaymentEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isExisting = Boolean(id);
  const isView = isExisting && !location.pathname.endsWith('/edit');
  const isEdit = isExisting && !isView;
  const paymentRequestIdFromQuery = new URLSearchParams(location.search).get('paymentRequestId') || '';
  const bookingIdFromQuery = new URLSearchParams(location.search).get('bookingId') || '';
  const clientIdFromQuery = new URLSearchParams(location.search).get('clientId') || '';
  const returnTo = typeof (location.state as any)?.returnTo === 'string' && (location.state as any).returnTo.startsWith('/')
    ? (location.state as any).returnTo
    : null;
  const defaultReturnPath = '/admin/payments';

  const [loading, setLoading] = useState(Boolean(id));
  const [clients, setClients] = useState<Client[]>([]);
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [bookings, setBookings] = useState<RetreatClient[]>([]);
  const [selectedPaymentRequest, setSelectedPaymentRequest] = useState<PaymentRequest | null>(null);
  const [exchangeRateProviderLabel, setExchangeRateProviderLabel] = useState(DEFAULT_EXCHANGE_RATE_PROVIDER_LABEL);
  const [usdPreview, setUsdPreview] = useState<number | null>(null);
  const [usdPreviewLoading, setUsdPreviewLoading] = useState(false);
  const [usdPreviewError, setUsdPreviewError] = useState('');
  const [bookingCurrencyLoading, setBookingCurrencyLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadedPayment, setLoadedPayment] = useState<Payment | null>(null);
  const [reassigningReceipt, setReassigningReceipt] = useState(false);
  const [clientOnly, setClientOnly] = useState(Boolean(clientIdFromQuery && !bookingIdFromQuery && !paymentRequestIdFromQuery));
  const [formData, setFormData] = useState({
    display_id: '',
    paymentRequestId: '',
    clientId: '',
    retreatId: '',
    bookingId: '',
    amount: '',
    currency: 'EUR' as 'EUR' | 'USD' | 'CZK' | 'PLN',
    status: 'pending' as 'pending' | 'completed' | 'failed' | 'refunded',
    paymentMethod: 'bank_transfer' as 'bank_transfer' | 'card' | 'cash' | 'paypal' | 'crypto' | 'stripe' | 'wise' | 'revolut' | 'other',
    description: '',
    transactionId: '',
    paymentDate: defaultDate(),
    notes: '',
    isDeposit: false,
    isFinalPayment: false,
    isRefundable: false,
    paymentType: 'regular_payment' as 'deposit_non_refundable' | 'deposit_refundable' | 'regular_payment' | 'balance_payment' | 'refund' | 'adjustment' | 'currency_adjustment',
    bookingCurrencyAmount: '',
    bookingCurrencyExchangeDate: '',
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [clientsResponse, retreatsResponse, bookingsResponse, paymentResponse, nextDisplayIdResponse, configResponse] = await Promise.all([
          clientsApi.getAll(),
          retreatsApi.getAll(),
          bookingsApi.getAllFresh ? bookingsApi.getAllFresh() : bookingsApi.getAll(),
          id ? paymentsApi.getOne(id) : Promise.resolve(null),
          !id ? paymentsApi.getNextDisplayId().catch(() => null) : Promise.resolve(null),
          configSummaryApi.get().catch(() => null),
        ]);

        setClients(clientsResponse.data || []);
        setRetreats(retreatsResponse.data || []);
        setBookings(bookingsResponse.data || []);
        setExchangeRateProviderLabel(
          configResponse?.data?.integrations?.exchangeRateProviderLabel
          || configResponse?.data?.integrations?.exchangeRateProvider
          || DEFAULT_EXCHANGE_RATE_PROVIDER_LABEL
        );

        if (paymentResponse?.data) {
          const payment = paymentResponse.data as Payment;
          setLoadedPayment(payment);
          setClientOnly(!payment.bookingId && !payment.paymentRequestId && !payment.retreatId);
          const populatedPaymentRequest = typeof payment.paymentRequestId === 'object' ? payment.paymentRequestId as PaymentRequest : null;
          if (populatedPaymentRequest) setSelectedPaymentRequest(populatedPaymentRequest);
          setFormData({
            display_id: payment.display_id?.toString?.() || '',
            paymentRequestId: resolveId(payment.paymentRequestId),
            clientId: resolveId(payment.clientId),
            retreatId: resolveId(payment.retreatId),
            bookingId: resolveId(payment.bookingId),
            amount: payment.amount?.toString?.() || '',
            currency: payment.currency,
            status: payment.status,
            paymentMethod: payment.paymentMethod,
            description: payment.description || '',
            transactionId: payment.transactionId || '',
            paymentDate: payment.paymentDate ? toDateInputValue(payment.paymentDate) : defaultDate(),
            notes: payment.notes || '',
            isDeposit: payment.isDeposit || false,
            isFinalPayment: payment.isFinalPayment || false,
            isRefundable: payment.isRefundable || false,
            paymentType: payment.paymentType || 'regular_payment',
            bookingCurrencyAmount: payment.bookingCurrencyAmount?.toString?.() || '',
            bookingCurrencyExchangeDate: payment.bookingCurrencyExchangeDate ? toDateInputValue(payment.bookingCurrencyExchangeDate) : '',
          });
        } else if (paymentRequestIdFromQuery) {
          if (nextDisplayIdResponse?.data) {
            setFormData((prev) => ({ ...prev, display_id: String(nextDisplayIdResponse.data) }));
          }
          const paymentRequestResponse = await paymentRequestsApi.getOne(paymentRequestIdFromQuery);
          applyPaymentRequest(paymentRequestIdFromQuery, paymentRequestResponse.data, bookingsResponse.data || []);
        } else {
          const requestedBooking = (bookingsResponse.data || []).find((item: RetreatClient) => item._id === bookingIdFromQuery);
          setFormData((prev) => ({
            ...prev,
            display_id: nextDisplayIdResponse?.data ? String(nextDisplayIdResponse.data) : prev.display_id,
            bookingId: requestedBooking?._id || '',
            clientId: resolveId(requestedBooking?.clientId) || clientIdFromQuery || '',
            retreatId: resolveId(requestedBooking?.retreatId) || '',
            currency: (requestedBooking?.currency as typeof prev.currency) || prev.currency,
          }));
        }
      } catch (error) {
        console.error('Error loading payment editor data:', error);
        setFormError(apiErrorMessage(error, 'The payment form could not be loaded.'));
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id, paymentRequestIdFromQuery, bookingIdFromQuery, clientIdFromQuery]);

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const bookingOptions = useMemo(() => {
    // Search must cover every booking. The selected client/retreat can be stale
    // or only partially populated; selecting a booking is what establishes the
    // authoritative client and retreat relationship for this payment.
    if (!isExisting) return bookings;
    return bookings.filter((booking) => {
      const clientId = resolveId(booking.clientId);
      return !formData.clientId || !clientId || clientId === formData.clientId;
    });
  }, [bookings, formData.clientId, isExisting]);

  const selectedBooking = useMemo(
    () => bookings.find((booking) => booking._id === formData.bookingId),
    [bookings, formData.bookingId],
  );
  const bookingCurrency = (selectedBooking?.currency || formData.currency) as Payment['currency'];
  const showBookingCurrencySettlement = Boolean(selectedBooking?.currency && formData.currency !== selectedBooking.currency);

  useEffect(() => {
    if (!showBookingCurrencySettlement) return;
    const amount = Number(formData.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    let active = true;
    const timeout = window.setTimeout(async () => {
      try {
        setBookingCurrencyLoading(true);
        const response = await paymentsApi.convert(amount, formData.currency, bookingCurrency);
        if (active) setFormData(prev => ({ ...prev, bookingCurrencyAmount: response.data.amount.toFixed(2) }));
      } catch (error) {
        console.error('Error converting payment to booking currency:', error);
      } finally { if (active) setBookingCurrencyLoading(false); }
    }, 350);
    return () => { active = false; window.clearTimeout(timeout); };
  }, [formData.amount, formData.currency, bookingCurrency, showBookingCurrencySettlement]);

  useEffect(() => {
    const amount = Number(formData.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setUsdPreview(null);
      setUsdPreviewError('');
      return;
    }

    let active = true;
    const timeout = window.setTimeout(async () => {
      try {
        setUsdPreviewLoading(true);
        setUsdPreviewError('');
        const response = await paymentsApi.convertToUsd(amount, formData.currency);
        if (active) setUsdPreview(response.data.usd_amount);
      } catch (error) {
        console.error('Error converting payment amount to USD:', error);
        if (active) {
          setUsdPreview(null);
          setUsdPreviewError('USD conversion unavailable');
        }
      } finally {
        if (active) setUsdPreviewLoading(false);
      }
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [formData.amount, formData.currency]);

  const findBookingForPaymentRequest = (paymentRequestId: string, bookingList = bookings) => {
    return bookingList.find((booking) => resolveId(booking.paymentRequestId) === paymentRequestId);
  };

  const applyPaymentRequest = (paymentRequestId: string, paymentRequest?: PaymentRequest, bookingList = bookings) => {
    setSelectedPaymentRequest(paymentRequest || null);

    if (!paymentRequestId || !paymentRequest) {
      setFormData((prev) => ({
        ...prev,
        paymentRequestId: '',
      }));
      return;
    }

    const amount = getPaymentRequestAmount(paymentRequest);
    const currency = paymentRequest?.currency || formData.currency;
    const clientId = resolveId(paymentRequest?.clientId);
    const retreatId = resolveId(paymentRequest?.retreatId);
    const requestBookingId = resolveId(paymentRequest.bookingId);
    const booking = bookingList.find((item) => item._id === requestBookingId)
      || findBookingForPaymentRequest(paymentRequestId, bookingList);
    const requestPaymentType = paymentTypeFromRequest(paymentRequest.requestType);

    setFormData((prev) => ({
      ...prev,
      paymentRequestId,
      clientId,
      retreatId,
      bookingId: requestBookingId || booking?._id || prev.bookingId,
      amount: amount !== '' && amount !== undefined ? String(amount) : prev.amount,
      currency,
      paymentMethod: paymentMethodFromRequest(paymentRequest.paymentType),
      paymentType: requestPaymentType,
      isDeposit: requestPaymentType === 'deposit_non_refundable' || requestPaymentType === 'deposit_refundable',
      isFinalPayment: requestPaymentType === 'balance_payment' || paymentRequest.requestType === 'full_payment',
      status: paymentRequest.status === 'paid' ? 'completed' : prev.status === 'pending' ? 'completed' : prev.status,
      paymentDate: paymentRequest.paidDate ? toDateInputValue(paymentRequest.paidDate) : prev.paymentDate,
      description: `Payment for invoice ${paymentRequest.invoiceNumber || paymentRequest.display_id || ''}`.trim(),
      notes: prev.notes || paymentRequest.note || paymentRequest.notes || '',
      bookingCurrencyAmount: prev.bookingCurrencyAmount,
      bookingCurrencyExchangeDate: prev.bookingCurrencyExchangeDate || (paymentRequest.paidDate ? toDateInputValue(paymentRequest.paidDate) : ''),
    }));
  };

  const handlePaymentRequestSelect = (paymentRequestId: string, paymentRequest?: PaymentRequest) => {
    applyPaymentRequest(paymentRequestId, paymentRequest);
  };

  const handleBookingSelect = (bookingId: string) => {
    const booking = bookings.find((item) => item._id === bookingId);
    setFormData((prev) => ({
      ...prev,
      bookingId,
      clientId: resolveId(booking?.clientId) || prev.clientId,
      retreatId: resolveId(booking?.retreatId) || prev.retreatId,
      currency: isExisting ? prev.currency : (booking?.currency as typeof prev.currency) || prev.currency,
      amount: prev.amount || (booking?.totalAmount ? String(booking.totalAmount) : prev.amount),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (isView || saving) return;

    if (isSplitReceipt) {
      const enteredAmount = Math.abs(Number(formData.amount || 0));
      const originalBookingId = resolveId(loadedPayment?.bookingId);
      if (receiptTotal > 0 && enteredAmount === receiptTotal && formData.bookingId === originalBookingId) {
        await handleUseEntireReceipt();
        return;
      }
      const fullAmount = receiptTotal > 0 ? ` Enter ${receiptTotal.toLocaleString()} ${formData.currency} and press Save to assign the entire receipt to this person.` : '';
      setFormError(`This is part of a joint receipt, so its amount or booking cannot be changed independently.${fullAmount}`);
      return;
    }

    if (!clientOnly && !formData.bookingId && !formData.paymentRequestId) {
      setFormError('Select the exact booking. A payment request is only sufficient before its booking has been created.');
      return;
    }

    if (clientOnly && !formData.description.trim()) {
      setFormError('Enter a purpose for this client payment.');
      return;
    }

    if (!formData.clientId || (!clientOnly && !formData.retreatId) || !formData.amount) {
      setFormError(clientOnly ? 'Select a client and enter the payment amount.' : 'Complete the required client, retreat, and amount fields before saving.');
      return;
    }

    const displayId = Number(formData.display_id);
    if (!Number.isInteger(displayId) || displayId <= 1000) {
      setFormError('Payment number must be a whole number greater than 1000.');
      return;
    }

    const submitData = {
      display_id: displayId,
      paymentRequestId: formData.paymentRequestId || undefined,
      clientId: formData.clientId,
      retreatId: clientOnly ? undefined : formData.retreatId,
      bookingId: formData.bookingId || undefined,
      amount: formData.paymentType === 'refund' ? -Math.abs(parseFloat(formData.amount)) : parseFloat(formData.amount),
      currency: formData.currency,
      status: formData.status,
      paymentMethod: formData.paymentMethod,
      description: formData.description.trim() || undefined,
      transactionId: formData.transactionId || undefined,
      paymentDate: formData.paymentDate,
      notes: formData.notes || undefined,
      isDeposit: formData.isDeposit,
      isFinalPayment: formData.isFinalPayment,
      paymentType: formData.paymentType,
      bookingCurrency: showBookingCurrencySettlement ? bookingCurrency : undefined,
      bookingCurrencyAmount: showBookingCurrencySettlement && formData.bookingCurrencyAmount
        ? parseFloat(formData.bookingCurrencyAmount)
        : undefined,
      bookingCurrencyExchangeSource: showBookingCurrencySettlement ? exchangeRateProviderLabel : undefined,
      bookingCurrencyExchangeDate: showBookingCurrencySettlement ? (formData.bookingCurrencyExchangeDate || formData.paymentDate || undefined) : undefined,
    };

    setSaving(true);
    try {
    const existingPayments = await paymentsApi.getAll();
    const duplicate = (existingPayments.data || []).find((payment: Payment) => {
      return payment._id !== id && Number(payment.display_id) === displayId;
    });
    if (duplicate) {
      setFormError(`Payment number ${displayId} already exists. Save cancelled.`);
      return;
    }

      if (isExisting && id) {
        await paymentsApi.update(id, submitData as any);
      } else {
        await paymentsApi.create(submitData as any);
      }
      navigate(returnTo || defaultReturnPath);
    } catch (error) {
      console.error('Error saving payment:', (error as any)?.response?.data || error);
      setFormError(apiErrorMessage(error, 'The payment could not be saved.'));
    } finally { setSaving(false); }
  };

  const isSplitReceipt = Boolean(loadedPayment?.receiptId && Number(loadedPayment?.allocationCount || 0) > 1);
  const receiptTotal = Number(loadedPayment?.transactionTotalAmount || 0);

  const handleUseEntireReceipt = async () => {
    if (!id || !isSplitReceipt) return;
    const client = clients.find((item) => item._id === formData.clientId);
    const clientName = client ? `${client.firstName || ''} ${client.lastName || ''}`.trim() : 'this person';
    const totalLabel = receiptTotal > 0 ? `${receiptTotal.toLocaleString()} ${formData.currency}` : `the full ${formData.currency} receipt`;
    if (!window.confirm(`Assign ${totalLabel} to ${clientName}? The other allocations from this same receipt will be removed and their bookings recalculated. This change is logged.`)) return;
    try {
      setReassigningReceipt(true);
      setFormError('');
      await paymentsApi.useEntireReceipt(id);
      navigate(returnTo || defaultReturnPath);
    } catch (error) {
      console.error('Error assigning entire receipt:', (error as any)?.response?.data || error);
      setFormError(apiErrorMessage(error, 'The joint payment could not be reassigned.'));
    } finally {
      setReassigningReceipt(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message={isExisting ? 'Loading payment...' : 'Loading form...'} />;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <button
            type="button"
            onClick={() => navigate(returnTo || defaultReturnPath)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            <Icon icon={FiArrowLeft} className="w-4 h-4" />
            {returnTo ? 'Back to Booking' : 'Back'}
          </button>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-gray-900 whitespace-nowrap">
              {isView ? 'Payment View' : isEdit ? 'Edit Payment' : 'Add Payment'}
            </h1>
            <p className="text-sm text-gray-600">
              {isView ? 'View payment details' : isEdit ? 'Update payment details' : 'Record a new payment against an invoice'}
            </p>
          </div>
        </div>
        {isView && id && (
          <button
            type="button"
            onClick={() => navigate(`/admin/payments/${id}/edit`, { state: { returnTo: location.pathname } })}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            Edit Payment
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {formError && (
            <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
              {formError}
            </div>
          )}
          {isSplitReceipt && (
            <div className="rounded-md border border-blue-300 bg-blue-50 p-4 text-blue-950">
              <h2 className="font-semibold">This payment belongs to one joint receipt</h2>
              <p className="mt-1 text-sm">
                It is allocation {loadedPayment?.allocationIndex || '—'} of {loadedPayment?.allocationCount}.
                {receiptTotal > 0 ? ` The full received payment was ${receiptTotal.toLocaleString()} ${formData.currency}.` : ''}
                {' '}Changing this allocation's amount or booking with Save is blocked because that would make the receipt totals incorrect.
              </p>
              {!isView && (
                <button
                  type="button"
                  onClick={handleUseEntireReceipt}
                  disabled={reassigningReceipt}
                  className="mt-3 rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-wait disabled:opacity-60"
                >
                  {reassigningReceipt ? 'Assigning full receipt…' : 'Use entire joint payment for this person'}
                </button>
              )}
            </div>
          )}
          <fieldset disabled={isView} className="grid grid-cols-1 md:grid-cols-2 gap-6 disabled:opacity-90">
            {(!loadedPayment?.bookingId && !loadedPayment?.paymentRequestId) && <div className="md:col-span-2 rounded-md border border-blue-200 bg-blue-50 p-4">
              <label className="flex items-center gap-2 font-medium">
                <input type="checkbox" checked={clientOnly} onChange={event => {
                  setClientOnly(event.target.checked);
                  if (event.target.checked) {
                    setSelectedPaymentRequest(null);
                    setFormData(prev => ({ ...prev, bookingId: '', retreatId: '', paymentRequestId: '', bookingCurrencyAmount: '', isDeposit: false, isFinalPayment: false }));
                  }
                }} />
                Client payment (no booking yet)
              </label>
              <p className="mt-2 text-sm">Record a payment for this client with a clear purpose. No retreat or payment request is needed. You can link it to a booking later.</p>
              {isEdit && clientOnly && <button type="button" className="mt-2 font-semibold text-blue-700 underline" onClick={() => setClientOnly(false)}>Link to a booking</button>}
            </div>}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Number *</label>
              <input
                type="number"
                min="1001"
                step="1"
                value={formData.display_id}
                onChange={(e) => handleChange('display_id', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <p className="mt-1 text-xs text-gray-500">Auto-filled. You can override it, but it must be unique.</p>
            </div>

            {!clientOnly && <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Request</label>
              {isView ? (
                formData.paymentRequestId ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/payment-requests/${formData.paymentRequestId}`)}
                    className="inline-flex rounded-md border border-blue-200 bg-blue-50 px-3 py-2 font-semibold text-blue-700 hover:bg-blue-100 hover:underline"
                  >
                    Payment request {selectedPaymentRequest?.invoiceNumber || (selectedPaymentRequest?.display_id ? `#${selectedPaymentRequest.display_id}` : `#${formData.paymentRequestId.slice(-8)}`)}
                  </button>
                ) : <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-500">No payment request linked</div>
              ) : (
                <SearchablePaymentRequestSelect
                  selectedPaymentRequestId={formData.paymentRequestId}
                  onPaymentRequestSelect={(paymentRequestId, paymentRequest) => handlePaymentRequestSelect(paymentRequestId, paymentRequest as any)}
                  placeholder="Search invoice number, client, or retreat"
                  className="w-full"
                />
              )}
              {selectedPaymentRequest && (
                <div className="mt-3 rounded-md border border-gray-200 bg-white p-3 text-sm text-gray-800">
                  <div className="font-semibold">
                    Invoice {selectedPaymentRequest.invoiceNumber || `#${selectedPaymentRequest.display_id || 'n/a'}`}
                  </div>
                  <div className="mt-1 grid gap-2 sm:grid-cols-3">
                    <div>Requested: {getPaymentRequestAmount(selectedPaymentRequest) || '—'} {selectedPaymentRequest.currency}</div>
                    <div>Type: {selectedPaymentRequest.requestType || 'full payment'}</div>
                    <div>Status: {selectedPaymentRequest.status}</div>
                  </div>
                </div>
              )}
            </div>}

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Client *</label>
              {isExisting ? <p>{clients.find(client => client._id === formData.clientId)?.firstName} {clients.find(client => client._id === formData.clientId)?.lastName}</p> : <SearchableClientSelect
                clients={clients}
                selectedClientId={formData.clientId}
                onClientSelect={(clientId) => { if (!isExisting) setFormData(prev => ({ ...prev, clientId, bookingId: '', retreatId: '', paymentRequestId: '' })); }}
                placeholder="Search client by name, email, or display ID"
                className="w-full"
              />}
            </div>

            {!clientOnly && <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Retreat *</label>
              <SearchableRetreatSelect
                retreats={retreats}
                selectedRetreatId={formData.retreatId}
                onRetreatSelect={(retreatId) => handleChange('retreatId', retreatId)}
                placeholder="Search retreat by name or location"
                className="w-full"
              />
            </div>}

            {!clientOnly && <div className="md:col-span-2">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <label className="block text-sm font-medium text-gray-700">Link directly to booking {!formData.paymentRequestId && '*'}</label>
                <span className="text-xs text-gray-500">A payment request is optional; choose the exact booking here.</span>
              </div>
              <SearchableBookingSelect
                bookings={bookingOptions}
                clients={clients}
                retreats={retreats}
                selectedBookingId={formData.bookingId}
                onBookingSelect={handleBookingSelect}
                placeholder="Search booking number, client, or retreat"
                emptyLabel={formData.paymentRequestId ? 'Booking not created yet' : 'Select the exact booking'}
              />
              {selectedBooking && (
                <p className="mt-1 text-xs text-gray-500">
                  Payment will count toward booking #{selectedBooking.bookingNumber || selectedBooking._id?.slice(-6)}
                </p>
              )}
              {!selectedBooking && formData.paymentRequestId && (
                <p className="mt-1 text-xs text-amber-700">No booking linked yet. You can save against this payment request.</p>
              )}
            </div>}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{formData.paymentType === 'refund' ? 'Refund Amount *' : 'Amount *'}</label>
              <input
                type="number"
                min={formData.paymentType === 'refund' ? '0.01' : undefined}
                step="0.01"
                aria-label="Amount"
                value={formData.amount}
                onChange={(e) => handleChange('amount', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={formData.paymentType === 'refund' ? 'Enter 91.00 — it will be recorded as −91.00' : '0.00'}
                required
              />
              {formData.paymentType === 'refund' && <p className="mt-1 text-xs text-amber-700">Enter a positive amount. Refunds are automatically saved as negative transactions.</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Currency *</label>
              <select
                aria-label="Currency"
                value={formData.currency}
                onChange={(e) => handleChange('currency', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="CZK">CZK</option>
                <option value="PLN">PLN</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">USD Amount</label>
              <input
                type="text"
                value={usdPreviewLoading ? 'Calculating...' : usdPreview !== null ? `$${usdPreview.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
                readOnly
                className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-700"
                placeholder="Calculated from Revolut rate"
              />
              {usdPreviewError && <p className="mt-1 text-xs text-red-600">{usdPreviewError}</p>}
            </div>

            {showBookingCurrencySettlement && (
              <div className="md:col-span-2 rounded-md border border-amber-200 bg-amber-50 p-4">
                <h3 className="text-sm font-semibold text-amber-900">Booking currency settlement</h3>
                <p className="mt-1 text-xs text-amber-800">
                  This payment is in {formData.currency}, but the booking is in {bookingCurrency}. The equivalent is calculated automatically using the {exchangeRateProviderLabel} rate.
                </p>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{bookingCurrency} Equivalent</label>
                    <input
                      type="text"
                      value={bookingCurrencyLoading ? 'Calculating...' : formData.bookingCurrencyAmount ? `${formData.bookingCurrencyAmount} ${bookingCurrency}` : ''}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-700"
                      placeholder={`Calculated automatically in ${bookingCurrency}`}
                    />
                  </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Exchange Rate Provider</label>
                  <div className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700">
                    {exchangeRateProviderLabel}
                  </div>
                </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Conversion Date</label>
                    <input
                      type="date"
                      value={formData.bookingCurrencyExchangeDate}
                      onChange={(e) => handleChange('bookingCurrencyExchangeDate', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method *</label>
              <select
                aria-label="Payment method"
                value={formData.paymentMethod}
                onChange={(e) => handleChange('paymentMethod', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="bank_transfer">Bank Transfer</option>
                <option value="card">Card</option>
                <option value="cash">Cash</option>
                <option value="paypal">PayPal</option>
                <option value="crypto">Crypto</option>
                <option value="stripe">Stripe</option>
                <option value="wise">Wise</option>
                <option value="revolut">Revolut</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
              <select
                aria-label="Status"
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Date *</label>
              <input
                type="date"
                value={formData.paymentDate}
                onChange={(e) => handleChange('paymentDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
              <select
                value={formData.paymentType}
                onChange={(e) => handleChange('paymentType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="regular_payment">Regular Payment</option>
                <option value="deposit_non_refundable">Deposit (Non-refundable)</option>
                <option value="deposit_refundable">Deposit (Refundable)</option>
                <option value="balance_payment">Balance Payment</option>
                <option value="refund">Refund</option>
                <option value="adjustment">Adjustment</option>
                <option value="currency_adjustment">Foreign currency balance adjustment</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Transaction ID</label>
              <input
                type="text"
                value={formData.transactionId}
                onChange={(e) => handleChange('transactionId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Optional transaction reference"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="payment-purpose">Purpose{clientOnly ? ' *' : ''}</label>
              <input
                type="text"
                id="payment-purpose"
                required={clientOnly}
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Medical exam before booking"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Additional notes..."
              />
            </div>

            <div className="flex gap-6 md:col-span-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isDeposit}
                  onChange={(e) => handleChange('isDeposit', e.target.checked)}
                />
                <span className="text-sm text-gray-700">Is Deposit</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isFinalPayment}
                  onChange={(e) => handleChange('isFinalPayment', e.target.checked)}
                />
                <span className="text-sm text-gray-700">Is Final Payment</span>
              </label>
            </div>
          </fieldset>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <button
              type="button"
              onClick={() => navigate(returnTo || defaultReturnPath)}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
            >
              {isView ? 'Back' : 'Cancel'}
            </button>
            {!isView && (
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                <Icon icon={FiSave} className="w-4 h-4" />
                {saving ? 'Saving…' : isEdit ? 'Update Payment' : 'Add Payment'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentEditorPage;
