import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Payment, PaymentRequest } from '../types';
import { configSummaryApi, paymentRequestsApi, paymentsApi } from '../services/api';
import CurrencyDisplay from './CurrencyDisplay';
import SearchablePaymentRequestSelect from './SearchablePaymentRequestSelect';
import { formatCalendarDate, toDateInputValue, todayDateInputValue } from '../utils/dateFormat';
import './BookingPaymentManagement.css';
import { bookingPaymentSummary } from './bookingStatusSelectors';

const DEFAULT_EXCHANGE_RATE_PROVIDER_LABEL = 'Revolut';

interface BookingPaymentManagementProps {
  bookingId: string;
  bookingNumber?: string | number;
  clientName?: string;
  bookingHash?: string; // New prop for booking hash
  clientId: string;
  retreatId: string;
  totalAmount: number;
  currency: string;
  onPaymentUpdate?: () => void;
}

const resolvePaymentId = (value: any) => (typeof value === 'object' && value?._id ? value._id : value || '');

const BookingPaymentManagement: React.FC<BookingPaymentManagementProps> = ({
  bookingId,
  bookingNumber,
  clientName,
  bookingHash,
  clientId,
  retreatId,
  totalAmount,
  currency,
  onPaymentUpdate
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [showLinkExisting, setShowLinkExisting] = useState(false);
  const [selectedExistingPaymentId, setSelectedExistingPaymentId] = useState('');
  const [linkExistingLoading, setLinkExistingLoading] = useState(false);
  const [linkExistingError, setLinkExistingError] = useState('');
  const [autoLinkLoading, setAutoLinkLoading] = useState(false);
  const [currencyAdjustmentLoading, setCurrencyAdjustmentLoading] = useState(false);
  const [autoLinkMessage, setAutoLinkMessage] = useState('');
  const [usdPreview, setUsdPreview] = useState<number | null>(null);
  const [usdPreviewLoading, setUsdPreviewLoading] = useState(false);
  const [usdPreviewError, setUsdPreviewError] = useState('');
  const [totalCostUsd, setTotalCostUsd] = useState<number | null>(null);
  const [bookingCurrencyPreviewLoading, setBookingCurrencyPreviewLoading] = useState(false);
  const [exchangeRateProviderLabel, setExchangeRateProviderLabel] = useState(DEFAULT_EXCHANGE_RATE_PROVIDER_LABEL);
  const [newPayment, setNewPayment] = useState({
    amount: '',
    currency: currency as 'EUR' | 'USD' | 'CZK' | 'PLN',
    paymentRequestId: '',
    paymentMethod: 'bank_transfer',
    paymentType: 'regular_payment',
    description: '',
    transactionReference: '',
    notes: '',
    paymentDate: todayDateInputValue(),
    bookingCurrencyAmount: '',
    bookingCurrencyExchangeDate: ''
  });

  const paymentMethods = [
    { value: 'bank_transfer', label: '🏦 Bank Transfer' },
    { value: 'cash', label: '💵 Cash' },
    { value: 'card', label: '💳 Card/Credit Card' },
    { value: 'stripe', label: '💳 Stripe' },
    { value: 'paypal', label: '🅿️ PayPal' },
    { value: 'wise', label: '🌐 Wise (TransferWise)' },
    { value: 'revolut', label: '🔄 Revolut' },
    { value: 'crypto', label: '₿ Cryptocurrency' },
    { value: 'other', label: '🔧 Other' }
  ];

  const defaultPaymentTypes = [
    { value: 'deposit_non_refundable', label: '💰 Deposit (Non-Refundable)', refundable: false },
    { value: 'deposit_refundable', label: '💳 Deposit (Refundable)', refundable: true },
    { value: 'regular_payment', label: '💵 Regular Payment', refundable: true },
    { value: 'balance_payment', label: '⚖️ Balance Payment', refundable: true },
    { value: 'adjustment', label: '🔧 Adjustment', refundable: true },
    { value: 'currency_adjustment', label: '💱 Foreign currency balance adjustment', refundable: false },
  ];
  const [paymentTypes, setPaymentTypes] = useState(defaultPaymentTypes);
  const [paymentPlan, setPaymentPlan] = useState<any>(null);
  const [bookingPaymentRequests, setBookingPaymentRequests] = useState<PaymentRequest[]>([]);
  const [paymentPlanDueDate, setPaymentPlanDueDate] = useState('');
  const [paymentPlanSaving, setPaymentPlanSaving] = useState(false);

  const syncPaymentPlan = useCallback(async () => {
    try {
      setPaymentPlanSaving(true);
      const [planResponse, requestsResponse] = await Promise.all([
        paymentsApi.getBookingPlan(bookingId),
        paymentRequestsApi.getByBooking(bookingId),
      ]);
      setPaymentPlan(planResponse.data);
      setBookingPaymentRequests(requestsResponse.data || []);
      setPaymentPlanDueDate(toDateInputValue(planResponse.data?.dueDate));
    } catch (error) { console.error('Unable to load booking payment plan:', error); }
    finally { setPaymentPlanSaving(false); }
  }, [bookingId]);

  const savePaymentPlan = async (enabled = true) => {
    try {
      setPaymentPlanSaving(true);
      const response = await paymentsApi.updateBookingPlan(bookingId, { enabled, dueDate: paymentPlanDueDate || undefined });
      setPaymentPlan(response.data);
      setPaymentPlanDueDate(toDateInputValue(response.data?.dueDate));
      onPaymentUpdate?.();
    } catch (error: any) { alert(error?.response?.data?.message || 'Unable to save the payment plan.'); }
    finally { setPaymentPlanSaving(false); }
  };

  const sendPaymentRequest = async (request: PaymentRequest) => {
    if (!request._id) return;
    const verb = request.sentToClient || request.status === 'sent' ? 'Resend' : 'Send';
    if (!window.confirm(`${verb} payment request #${request.invoiceNumber || request.display_id || ''} to the client now?`)) return;
    try {
      setPaymentPlanSaving(true);
      await paymentRequestsApi.sendReminder(request._id);
      await syncPaymentPlan();
    } catch (error: any) {
      alert(error?.response?.data?.message || `Unable to ${verb.toLowerCase()} the payment request.`);
    } finally { setPaymentPlanSaving(false); }
  };

  const copyPaymentRequestLink = async (request: PaymentRequest) => {
    if (!request.publicHash) return;
    try {
      await navigator.clipboard.writeText(`https://www.ibogaready.com/payment/${request.publicHash}`);
      setAutoLinkMessage('Payment request link copied.');
    } catch { alert('Unable to copy the payment request link.'); }
  };

  useEffect(() => { void syncPaymentPlan(); }, [syncPaymentPlan]);

  useEffect(() => {
    let active = true;
    paymentsApi.getTypes().then((response) => {
      if (!active) return;
      const configured = (response.data || [])
        .filter((item) => item.active)
        .map((item) => ({
          value: item.key,
          label: item.behavior === 'currency_adjustment' ? `💱 ${item.label}` : item.label,
          refundable: item.behavior !== 'currency_adjustment' && item.behavior !== 'refund',
        }));
      if (configured.length) setPaymentTypes(configured);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setNewPayment((current) => ({
      ...current,
      currency: (current.currency || currency || 'EUR') as 'EUR' | 'USD' | 'CZK' | 'PLN',
    }));
  }, [currency]);

  useEffect(() => {
    let active = true;
    configSummaryApi.get().then((response) => {
      if (!active) return;
      setExchangeRateProviderLabel(
        response?.data?.integrations?.exchangeRateProviderLabel
        || response?.data?.integrations?.exchangeRateProvider
        || DEFAULT_EXCHANGE_RATE_PROVIDER_LABEL
      );
    }).catch(() => {
      if (active) setExchangeRateProviderLabel(DEFAULT_EXCHANGE_RATE_PROVIDER_LABEL);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const amount = Number(newPayment.amount);
    if (!Number.isFinite(amount) || amount <= 0 || !newPayment.currency) {
      setUsdPreview(null);
      setUsdPreviewError('');
      return;
    }

    let active = true;
    const timeout = window.setTimeout(async () => {
      try {
        setUsdPreviewLoading(true);
        setUsdPreviewError('');
        const response = await paymentsApi.convertToUsd(amount, newPayment.currency);
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
  }, [newPayment.amount, newPayment.currency]);

  const bookingCurrency = (currency || 'EUR') as 'EUR' | 'USD' | 'CZK' | 'PLN';
  const isMixedBookingCurrencyPayment = Boolean(newPayment.currency && bookingCurrency && newPayment.currency !== bookingCurrency);

  useEffect(() => {
    if (!isMixedBookingCurrencyPayment) return;
    const amount = Number(newPayment.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    let active = true;
    const timeout = window.setTimeout(async () => {
      try {
        setBookingCurrencyPreviewLoading(true);
        const response = await paymentsApi.convert(amount, newPayment.currency, bookingCurrency);
        if (active) setNewPayment(current => ({ ...current, bookingCurrencyAmount: response.data.amount.toFixed(2) }));
      } catch (error) { console.error('Error converting payment to booking currency:', error); }
      finally { if (active) setBookingCurrencyPreviewLoading(false); }
    }, 350);
    return () => { active = false; window.clearTimeout(timeout); };
  }, [newPayment.amount, newPayment.currency, bookingCurrency, isMixedBookingCurrencyPayment]);

  useEffect(() => {
    if (!Number.isFinite(Number(totalAmount)) || Number(totalAmount) <= 0 || !currency) {
      setTotalCostUsd(null);
      return;
    }

    let active = true;
    const loadTotalCostUsd = async () => {
      try {
        const response = await paymentsApi.convertToUsd(Number(totalAmount), currency);
        if (active) setTotalCostUsd(response.data.usd_amount);
      } catch (error) {
        console.error('Error converting booking total to USD:', error);
        if (active) setTotalCostUsd(null);
      }
    };

    loadTotalCostUsd();

    return () => {
      active = false;
    };
  }, [totalAmount, currency]);

  const fetchPayments = useCallback(async () => {
    try {
      setIsLoading(true);
      const paymentMap = new Map<string, Payment>();

      const paymentRequests = [
        bookingHash ? paymentsApi.getByBookingHash(bookingHash) : Promise.resolve({ data: [] as Payment[] }),
        paymentsApi.getByBooking(bookingId),
      ];
      const results = await Promise.allSettled(paymentRequests);

      results.forEach((result) => {
        if (result.status !== 'fulfilled') return;
        (result.value.data || []).forEach((payment: Payment) => {
          if (payment._id) paymentMap.set(payment._id, payment);
        });
      });

      if (paymentMap.size === 0 && results.some((result) => result.status === 'rejected')) {
        console.warn('Booking payment lookup failed, trying fallback:', results);
        const response = await paymentsApi.getByClient(clientId);
        const bookingPayments = (response.data || []).filter((payment: any) =>
          resolvePaymentId(payment.bookingId) === bookingId || payment.bookingHash === bookingHash
        );
        bookingPayments.forEach((payment: Payment) => {
          if (payment._id) paymentMap.set(payment._id, payment);
        });
      }

      setPayments(Array.from(paymentMap.values()));
    } catch (error) {
      console.error('Error fetching payments:', error);
      setPayments([]);
    } finally {
      setIsLoading(false);
    }
  }, [bookingHash, bookingId, clientId]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const loadExistingPayments = async () => {
    try {
      setLinkExistingLoading(true);
      setLinkExistingError('');
      const response = await paymentsApi.getUnlinkedCandidatesByBooking(bookingId).catch(async () => {
        const fallbackResponse = await paymentsApi.getAll();
        return {
          ...fallbackResponse,
          data: (fallbackResponse.data || []).filter((payment: any) => {
            if (resolvePaymentId(payment.clientId) !== clientId) return false;
            if (resolvePaymentId(payment.retreatId) !== retreatId) return false;
            const linkedBookingId = resolvePaymentId(payment.bookingId);
            const linkedBookingHash = payment.bookingHash || '';
            return !linkedBookingId && !linkedBookingHash;
          }),
        };
      });
      setAllPayments(response.data || []);
    } catch (error) {
      console.error('Error loading existing payments:', error);
      setLinkExistingError('Could not load existing payments.');
    } finally {
      setLinkExistingLoading(false);
    }
  };

  const availableExistingPayments = useMemo(() => {
    const currentPaymentIds = new Set(payments.map((payment) => payment._id).filter(Boolean));
    return allPayments.filter((payment) => {
      if (!payment._id || currentPaymentIds.has(payment._id)) return false;
      const linkedBookingId = resolvePaymentId(payment.bookingId);
      const linkedBookingHash = payment.bookingHash || '';
      return !linkedBookingId && !linkedBookingHash;
    });
  }, [allPayments, payments]);

  const handleLinkExistingPayment = async () => {
    if (!selectedExistingPaymentId) {
      setLinkExistingError('Select a payment to link.');
      return;
    }

    try {
      setLinkExistingLoading(true);
      setLinkExistingError('');
      await paymentsApi.update(selectedExistingPaymentId, {
        bookingId,
        bookingHash,
        clientId,
        retreatId,
      } as Partial<Payment>);
      setSelectedExistingPaymentId('');
      setShowLinkExisting(false);
      await fetchPayments();
      if (onPaymentUpdate) {
        onPaymentUpdate();
      }
    } catch (error) {
      console.error('Error linking existing payment:', error);
      const message = (error as any)?.response?.data?.message || 'Could not link existing payment.';
      setLinkExistingError(Array.isArray(message) ? message.join(', ') : message);
    } finally {
      setLinkExistingLoading(false);
    }
  };

  const handleAutoLinkPayments = async () => {
    try {
      setAutoLinkLoading(true);
      setAutoLinkMessage('');
      setLinkExistingError('');
      const response = await paymentsApi.autoLinkByBooking(bookingId);
      const { linked, reason } = response.data || {};
      await fetchPayments();
      if (showLinkExisting) {
        await loadExistingPayments();
      }
      if (onPaymentUpdate) {
        onPaymentUpdate();
      }
      setAutoLinkMessage(
        linked > 0
          ? `Auto-linked ${linked} payment${linked === 1 ? '' : 's'} to this booking.`
          : `No payments auto-linked${reason ? ` (${reason.replace(/_/g, ' ')})` : ''}.`
      );
    } catch (error) {
      console.error('Error auto-linking payments:', error);
      const message = (error as any)?.response?.data?.message || 'Could not auto-link matching payments.';
      setLinkExistingError(Array.isArray(message) ? message.join(', ') : message);
    } finally {
      setAutoLinkLoading(false);
    }
  };

  const handleCurrencyAdjustment = async () => {
    if (balanceUsd === null || balanceUsd <= 0.005) return;
    const reason = window.prompt(
      `This will create a non-cash currency adjustment of ${formatUsd(balanceUsd)} and bring the USD balance to zero. Enter a reason:`,
      'Small foreign-currency conversion difference written off.',
    );
    if (!reason?.trim()) return;

    try {
      setCurrencyAdjustmentLoading(true);
      const bookingCurrencyAmount = bookingCurrency === 'USD'
        ? balanceUsd
        : Number((await paymentsApi.convert(balanceUsd, 'USD', bookingCurrency)).data.amount || 0);
      await paymentsApi.create({
        clientId,
        retreatId,
        bookingId,
        bookingHash,
        amount: balanceUsd,
        currency: 'USD',
        bookingCurrency,
        bookingCurrencyAmount,
        bookingCurrencyExchangeSource: exchangeRateProviderLabel,
        bookingCurrencyExchangeDate: new Date().toISOString(),
        paymentMethod: 'other',
        paymentType: 'currency_adjustment',
        description: 'Foreign currency balance adjustment',
        notes: reason.trim(),
        paymentDate: new Date().toISOString(),
        status: 'completed',
        isDeposit: false,
        isFinalPayment: true,
        isRefundable: false,
        processedBy: 'System Admin',
        processedDate: new Date().toISOString(),
      });
      await fetchPayments();
      onPaymentUpdate?.();
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Could not create the currency adjustment.');
    } finally {
      setCurrencyAdjustmentLoading(false);
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const selectedPaymentType = paymentTypes.find(pt => pt.value === newPayment.paymentType);

      const paymentData = {
        clientId,
        retreatId,
        bookingId, // Keep for backward compatibility
        bookingHash, // New field - prioritize this for linking
        paymentRequestId: newPayment.paymentRequestId || undefined,
        amount: parseFloat(newPayment.amount),
        currency: newPayment.currency as 'EUR' | 'CZK' | 'PLN' | 'USD',
        usd_amount: usdPreview ?? undefined,
        bookingCurrency: isMixedBookingCurrencyPayment ? bookingCurrency : undefined,
        bookingCurrencyAmount: isMixedBookingCurrencyPayment && newPayment.bookingCurrencyAmount
          ? parseFloat(newPayment.bookingCurrencyAmount)
          : undefined,
        bookingCurrencyExchangeSource: isMixedBookingCurrencyPayment ? exchangeRateProviderLabel : undefined,
        bookingCurrencyExchangeDate: isMixedBookingCurrencyPayment ? (newPayment.bookingCurrencyExchangeDate || newPayment.paymentDate) : undefined,
        paymentMethod: newPayment.paymentMethod as 'bank_transfer' | 'card' | 'cash' | 'paypal' | 'crypto' | 'stripe' | 'wise' | 'revolut' | 'other',
        paymentType: newPayment.paymentType as Payment['paymentType'],
        description: newPayment.description || `${selectedPaymentType?.label} for booking ${bookingHash || bookingId}`,
        transactionReference: newPayment.transactionReference,
        notes: newPayment.notes,
        paymentDate: newPayment.paymentDate,
        status: 'completed' as const,
        isDeposit: newPayment.paymentType.includes('deposit'),
        isFinalPayment: newPayment.paymentType === 'balance_payment',
        isRefundable: selectedPaymentType?.refundable || false,
        processedBy: 'System Admin', // You might want to get this from auth context
        processedDate: new Date().toISOString()
      };

      await paymentsApi.create(paymentData);

      // Reset form
      setNewPayment({
        amount: '',
        currency: currency as 'EUR' | 'USD' | 'CZK' | 'PLN',
        paymentRequestId: '',
        paymentMethod: 'bank_transfer',
        paymentType: 'regular_payment',
        description: '',
        transactionReference: '',
        notes: '',
        paymentDate: todayDateInputValue(),
        bookingCurrencyAmount: '',
        bookingCurrencyExchangeDate: ''
      });

      setShowAddPayment(false);
      await fetchPayments();

      if (onPaymentUpdate) {
        onPaymentUpdate();
      }
    } catch (error) {
      console.error('Error adding payment:', error);
      alert('Error adding payment. Please try again.');
    }
  };

  const getPaymentRequestAmount = (paymentRequest?: PaymentRequest | null) =>
    paymentRequest?.requestedAmount || paymentRequest?.amountPaid || paymentRequest?.fullPriceQuote || paymentRequest?.fullPrice || 0;

  const handlePaymentRequestSelect = (paymentRequestId: string, paymentRequest?: PaymentRequest) => {
    const amount = getPaymentRequestAmount(paymentRequest);
    setNewPayment((current) => ({
      ...current,
      paymentRequestId,
      amount: amount ? String(amount) : current.amount,
      currency: (paymentRequest?.currency || current.currency || currency || 'EUR') as 'EUR' | 'USD' | 'CZK' | 'PLN',
      description: paymentRequest
        ? `Payment for invoice ${paymentRequest.invoiceNumber || paymentRequest.display_id || paymentRequestId}`.trim()
        : current.description,
      paymentType: (paymentRequest?.requestType === 'deposit'
        ? 'deposit_non_refundable'
        : paymentRequest?.requestType === 'balance'
          ? 'balance_payment'
          : current.paymentType) as typeof current.paymentType,
      bookingCurrencyAmount: current.bookingCurrencyAmount,
      bookingCurrencyExchangeDate: current.bookingCurrencyExchangeDate || (paymentRequest?.paidDate ? toDateInputValue(paymentRequest.paidDate) : ''),
    }));
  };

  const formatBookingCurrencyEquivalent = (payment: Payment) => {
    if (payment.currency === bookingCurrency) return null;
    if (payment.bookingCurrency === bookingCurrency && Number(payment.bookingCurrencyAmount) > 0) {
      const parts = [
        <CurrencyDisplay key="amount" amount={payment.bookingCurrencyAmount || 0} currency={bookingCurrency} />,
      ];
      const note = [
        `by ${payment.bookingCurrencyExchangeSource || exchangeRateProviderLabel}`,
        payment.bookingCurrencyExchangeDate ? `on ${formatCalendarDate(payment.bookingCurrencyExchangeDate)}` : '',
      ].filter(Boolean).join(' ');
      return (
        <div className="booking-currency-equivalent">
          {parts}
          {note && <span>{note}</span>}
        </div>
      );
    }
    return <div className="booking-currency-equivalent missing">Not counted in {bookingCurrency}</div>;
  };

  const handleRefundPayment = async (paymentId: string, amount: number) => {
    if (!window.confirm(`Are you sure you want to refund ${amount} ${currency}?`)) {
      return;
    }

    try {
      await paymentsApi.refund(paymentId, { amount, reason: 'Manual refund' });
      await fetchPayments();

      if (onPaymentUpdate) {
        onPaymentUpdate();
      }
    } catch (error) {
      console.error('Error refunding payment:', error);
      alert('Error processing refund. Please try again.');
    }
  };

  const handleDeletePayment = async (payment: Payment) => {
    const label = payment.display_id ? `payment #${payment.display_id}` : 'this payment';
    if (!window.confirm(`Delete ${label}? This will recalculate the booking balance and cannot be undone.`)) return;
    try {
      await paymentsApi.delete(payment._id!);
      await fetchPayments();
      if (onPaymentUpdate) onPaymentUpdate();
    } catch (error: any) {
      console.error('Error deleting payment:', error);
      alert(error?.response?.data?.message || 'Unable to delete the payment.');
    }
  };

  // Remove the formatCurrency function since we'll use CurrencyDisplay component

  const formatPaymentType = (type: string) => {
    const typeInfo = paymentTypes.find(pt => pt.value === type);
    return typeInfo?.label || type.replace('_', ' ').toUpperCase();
  };

  const formatPaymentTypeShort = (type: string) => {
    switch (type) {
      case 'deposit_non_refundable': return 'Deposit NR';
      case 'deposit_refundable': return 'Deposit R';
      case 'regular_payment': return 'Regular';
      case 'balance_payment': return 'Balance';
      case 'adjustment': return 'Adjust';
      case 'currency_adjustment': return 'FX Adjust';
      case 'refund': return 'Refund';
      default: return type.replace(/_/g, ' ');
    }
  };

  const formatPaymentMethod = (method: string) => {
    const methodInfo = paymentMethods.find(pm => pm.value === method);
    return methodInfo?.label || method.replace('_', ' ').toUpperCase();
  };

  const formatPaymentMethodShort = (method: string) => {
    switch (method) {
      case 'bank_transfer': return 'Bank';
      case 'cash': return 'Cash';
      case 'card': return 'Card';
      case 'stripe': return 'Stripe';
      case 'paypal': return 'PayPal';
      case 'wise': return 'Wise';
      case 'revolut': return 'Revolut';
      case 'crypto': return 'Crypto';
      default: return 'Other';
    }
  };

  const getPaymentTypeColor = (type: string) => {
    switch (type) {
      case 'deposit_non_refundable': return '#dc3545';
      case 'deposit_refundable': return '#ffc107';
      case 'regular_payment': return '#28a745';
      case 'balance_payment': return '#374151';
      case 'adjustment': return '#6c757d';
      case 'currency_adjustment': return '#7c3aed';
      default: return '#6c757d';
    }
  };

  const getPaymentUsdAmount = (payment: Payment) => {
    if (typeof payment.usd_amount === 'number') return payment.usd_amount;
    return payment.currency === 'USD' ? payment.amount : 0;
  };

  const formatUsd = (amount?: number | null) => {
    if (amount === null || amount === undefined || !Number.isFinite(amount)) return '-';
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPaymentRequestLabel = (paymentRequest: Payment['paymentRequestId']) => {
    if (!paymentRequest) return '-';
    if (typeof paymentRequest === 'string') return paymentRequest.slice(-8);
    return paymentRequest.invoiceNumber || (paymentRequest.display_id ? `#${paymentRequest.display_id}` : paymentRequest._id?.slice(-8)) || '-';
  };

  const formatExistingPaymentLabel = (payment: Payment) => {
    const date = payment.paymentDate ? formatCalendarDate(payment.paymentDate) : 'No date';
    const displayId = payment.display_id ? `#${payment.display_id}` : payment._id?.slice(-8) || 'Payment';
    return `${displayId} - ${date} - ${payment.amount?.toLocaleString?.() || payment.amount} ${payment.currency} - ${payment.status}`;
  };

  const routePrefix = (() => {
    const firstSegment = location.pathname.split('/').filter(Boolean)[0];
    return ['admin', 'medical', 'staff', 'user'].includes(firstSegment) ? `/${firstSegment}` : '';
  })();

  const totalPaidUsd = payments
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + getPaymentUsdAmount(p), 0);

  const balanceUsd = totalCostUsd !== null ? totalCostUsd - totalPaidUsd : null;

  const { received: totalPaidBookingCurrency, outstanding: bookingBalance, paidInFull: isPaidInFull, paidPercent: paidPercentage } = bookingPaymentSummary(payments, Number(totalAmount || 0), bookingCurrency);

  const totalRefundedUsd = payments
    .reduce((sum, p) => sum + (p.refundedAmount ? (p.currency === 'USD' ? p.refundedAmount : 0) : 0), 0);

  if (isLoading) {
    return (
      <div className="booking-payments-loading">
        <div className="loading-spinner">⏳</div>
        <p>Loading payment information...</p>
      </div>
    );
  }

  return (
    <div className="booking-payment-management">
      <div className="payment-summary-header">
        <div className="payment-summary-title">
          <span>Booking #{bookingNumber || bookingHash || bookingId.slice(-6)}{clientName ? ` · ${clientName}` : ''}</span>
          <h3>Payments</h3>
        </div>
        <div className="payment-header-actions">
          <button type="button" className="refresh-payments-button" onClick={() => { void fetchPayments(); void syncPaymentPlan(); }} disabled={isLoading || paymentPlanSaving}>↻ <span>Refresh</span></button>
          <button type="button" className="record-payment-button" onClick={() => { setShowLinkExisting(false); setShowAddPayment(true); }}><span aria-hidden="true">+</span> Record a payment</button>
        </div>
      </div>

      <div className={`booking-balance-summary ${isPaidInFull ? 'is-paid' : 'has-balance'}`}>
        <div className="booking-balance-metric total"><span>Total cost</span><strong><CurrencyDisplay amount={totalAmount} currency={bookingCurrency} showUSD={false} /></strong><small>{formatUsd(totalCostUsd)} at today's rate</small></div>
        <div className="booking-balance-metric received"><span>Received</span><strong><CurrencyDisplay amount={totalPaidBookingCurrency} currency={bookingCurrency} showUSD={false} /></strong><small>{formatUsd(totalPaidUsd)} · {payments.length} payment{payments.length === 1 ? '' : 's'}</small></div>
        <div className="booking-balance-metric outstanding"><span>{isPaidInFull ? 'Paid in full' : 'Balance outstanding'}</span><strong><CurrencyDisplay amount={isPaidInFull ? 0 : bookingBalance} currency={bookingCurrency} showUSD={false} /></strong><small>{formatUsd(isPaidInFull ? 0 : balanceUsd)}{!isPaidInFull && paymentPlan?.dueDate ? ` · due ${formatCalendarDate(paymentPlan.dueDate)}` : ''}</small></div>
        <div className="booking-payment-progress">
          <span className={`booking-payment-state ${isPaidInFull ? 'paid-in-full' : 'unpaid'}`}>{isPaidInFull ? '✓ Paid in full' : 'ⓘ Not fully paid'}</span>
          <div><i style={{ width: `${paidPercentage}%` }} /></div><strong>{paidPercentage}% <span>paid</span></strong>
        </div>
        <button type="button" className="mobile-record-payment" onClick={() => { setShowLinkExisting(false); setShowAddPayment(true); }}>Record a payment</button>
        {totalRefundedUsd > 0 && <div className="booking-refund-summary">Refunded {formatUsd(totalRefundedUsd)}</div>}
      </div>

      <section className="booking-payment-requests">
        <div className="payment-requests-heading">
          <div><h4>Payment requests</h4><p>Requests issued for this booking, including the final balance.</p></div>
          <button type="button" className="new-payment-request-link" onClick={() => navigate(`${routePrefix}/payment-requests/new?bookingId=${encodeURIComponent(bookingId)}&clientId=${encodeURIComponent(clientId)}&retreatId=${encodeURIComponent(retreatId)}&currency=${encodeURIComponent(bookingCurrency)}&fullPrice=${encodeURIComponent(totalAmount)}`)}>New request</button>
          {!paymentPlan && !isPaidInFull && <div className="payment-request-create">
            <label>Final payment due<input type="date" value={paymentPlanDueDate} onChange={event => setPaymentPlanDueDate(event.target.value)} /></label>
            <button type="button" disabled={paymentPlanSaving || !paymentPlanDueDate} onClick={() => savePaymentPlan(true)}>{paymentPlanSaving ? 'Creating…' : 'Create balance request'}</button>
          </div>}
        </div>
        {bookingPaymentRequests.length === 0 ? <div className="payment-requests-empty"><strong>No payment request yet</strong><span>The client has nothing to pay against. Create the balance request to send them a link.</span>{!paymentPlan && !isPaidInFull && <div className="mobile-balance-request"><input aria-label="Final payment due" type="date" value={paymentPlanDueDate} onChange={event => setPaymentPlanDueDate(event.target.value)} /><button type="button" disabled={paymentPlanSaving || !paymentPlanDueDate} onClick={() => savePaymentPlan(true)}>{paymentPlanSaving ? 'Creating…' : 'Create balance request'}</button></div>}</div> : bookingPaymentRequests.map(request => {
          const linkedPaymentId = typeof request.paymentId === 'object' ? request.paymentId?._id : request.paymentId;
          const requestNumber = request.invoiceNumber || request.display_id || request._id?.slice(-8);
          const canAct = !['paid', 'cancelled'].includes(request.status);
          return <article className="booking-payment-request-row" key={request._id}>
            <div className="payment-request-identity"><strong>{request.requestType === 'balance' ? 'Final balance' : 'Payment request'}</strong><span className={`payment-request-status ${request.status}`}>{request.status === 'sent' ? 'Awaiting payment' : String(request.status || 'pending').replace(/_/g, ' ')}</span><small>Request #{requestNumber}{request.clientNotified || request.sentAt ? ` · sent ${formatCalendarDate(request.clientNotified || request.sentAt)}` : ' · not sent'}</small></div>
            <div><span>Amount</span><strong><CurrencyDisplay amount={request.requestedAmount || request.amountPaid || 0} currency={request.currency} showUSD={false} /> <small>({formatUsd(request.usd_amount)})</small></strong></div>
            <label>Due date<input type="date" value={request._id === paymentPlan?._id ? paymentPlanDueDate : toDateInputValue(request.dueDate)} disabled={request._id !== paymentPlan?._id || !canAct} onChange={event => setPaymentPlanDueDate(event.target.value)} /></label>
            <div><span>Linked payment</span><strong>{linkedPaymentId ? `#${typeof request.paymentId === 'object' ? request.paymentId?.display_id || linkedPaymentId : linkedPaymentId}` : 'None'}</strong></div>
            <div className="payment-request-actions">
              {!linkedPaymentId && canAct && <button type="button" className="primary-request-action" onClick={() => navigate(`${routePrefix}/payments/new?paymentRequestId=${request._id}`, { state: { returnTo: location.pathname } })}>Add payment</button>}
              <button type="button" onClick={() => navigate(`${routePrefix}/payment-requests/${request._id}`)}>View</button>
              <details className="payment-request-more"><summary aria-label="More payment request actions">•••</summary><div>
                {canAct && <button type="button" onClick={() => navigate(`${routePrefix}/payment-requests/${request._id}/edit`)}>Edit</button>}
                {canAct && <button type="button" disabled={paymentPlanSaving} onClick={() => sendPaymentRequest(request)}>{request.sentToClient || request.status === 'sent' ? 'Resend' : 'Send'}</button>}
                {request.publicHash && <button type="button" onClick={() => copyPaymentRequestLink(request)}>Copy IR link</button>}
                {request._id === paymentPlan?._id && canAct && <button type="button" disabled={paymentPlanSaving} onClick={() => savePaymentPlan(true)}>Update due date</button>}
                {request._id === paymentPlan?._id && canAct && <button type="button" className="cancel-request" disabled={paymentPlanSaving} onClick={() => window.confirm('Cancel this payment request?') && savePaymentPlan(false)}>Cancel request</button>}
              </div></details>
            </div>
          </article>;
        })}
      </section>

      <div className="payments-list">
        <div className="payment-history-header">
          <h4>Payment history</h4>
          <span className="payment-history-total">{payments.length} payment{payments.length === 1 ? '' : 's'} · <CurrencyDisplay amount={totalPaidBookingCurrency} currency={bookingCurrency} showUSD={false} /> received</span>
          <button type="button" className="mobile-history-add" onClick={() => { setShowLinkExisting(false); setShowAddPayment(true); }}>Add</button>
          <div style={{ display: 'flex', gap: '8px' }}>
            {balanceUsd !== null && balanceUsd > 0.005 && (
              <button
                type="button"
                onClick={handleCurrencyAdjustment}
                className="add-payment-btn"
                title={`Clear ${formatUsd(balanceUsd)} currency difference`}
                aria-label="Clear foreign currency balance difference"
                disabled={currencyAdjustmentLoading}
              >
                {currencyAdjustmentLoading ? '...' : 'FX'}
              </button>
            )}
            <button
              onClick={() => {
                setShowLinkExisting(false);
                setShowAddPayment(!showAddPayment);
              }}
              className="add-payment-btn"
              title={showAddPayment ? 'Cancel adding payment' : 'Add new payment'}
              aria-label={showAddPayment ? 'Cancel adding payment' : 'Add new payment'}
            >
              {showAddPayment ? '×' : '+'}
            </button>
            <button
              type="button"
              onClick={() => {
                const nextOpen = !showLinkExisting;
                setShowAddPayment(false);
                setShowLinkExisting(nextOpen);
                if (nextOpen && allPayments.length === 0) {
                  loadExistingPayments();
                }
              }}
              className="add-payment-btn"
              title={showLinkExisting ? 'Cancel linking payment' : 'Link existing payment'}
              aria-label={showLinkExisting ? 'Cancel linking payment' : 'Link existing payment'}
            >
              {showLinkExisting ? '×' : '↗'}
            </button>
            <button
              type="button"
              onClick={handleAutoLinkPayments}
              className="add-payment-btn"
              title="Auto-link matching payments"
              aria-label="Auto-link matching payments"
              disabled={autoLinkLoading}
            >
              {autoLinkLoading ? '...' : 'Auto'}
            </button>
          </div>
        </div>

        {autoLinkMessage && <p className="usd-preview-info">{autoLinkMessage}</p>}

        {showLinkExisting && (
          <div className="add-payment-form">
            <h4>Link Existing Payment</h4>
            <div className="form-group">
              <label>Existing Payment</label>
              <select
                value={selectedExistingPaymentId}
                onChange={(e) => {
                  setSelectedExistingPaymentId(e.target.value);
                  setLinkExistingError('');
                }}
                disabled={linkExistingLoading}
              >
                <option value="">Select payment...</option>
                {availableExistingPayments.map((payment) => (
                  <option key={payment._id} value={payment._id}>
                    {formatExistingPaymentLabel(payment)}
                  </option>
                ))}
              </select>
              {!linkExistingLoading && availableExistingPayments.length === 0 && (
                <p className="usd-preview-error">No unlinked payments found for this client and retreat.</p>
              )}
              {linkExistingError && <p className="usd-preview-error">{linkExistingError}</p>}
            </div>
            <div className="form-buttons">
              <button
                type="button"
                className="save-btn"
                onClick={handleLinkExistingPayment}
                disabled={linkExistingLoading || !selectedExistingPaymentId}
              >
                {linkExistingLoading ? 'Linking...' : 'Link Payment'}
              </button>
              <button type="button" onClick={() => setShowLinkExisting(false)} className="cancel-btn">Cancel</button>
            </div>
          </div>
        )}

        {showAddPayment && (
          <div className="add-payment-form">
            <h4>Add New Payment</h4>
            <form onSubmit={handleAddPayment}>
              <div className="form-row">
                <div className="form-group">
                  <label>Client ID</label>
                  <input type="text" value={clientId || ''} disabled />
                </div>
                <div className="form-group">
                  <label>Booking Number</label>
                  <input type="text" value={bookingNumber || bookingHash || bookingId} disabled />
                </div>
              </div>

              <div className="form-group">
                <label>Payment Request</label>
                <SearchablePaymentRequestSelect
                  selectedPaymentRequestId={newPayment.paymentRequestId}
                  onPaymentRequestSelect={(paymentRequestId, paymentRequest) => handlePaymentRequestSelect(paymentRequestId, paymentRequest as PaymentRequest)}
                  clientId={clientId}
                  retreatId={retreatId}
                  placeholder="Search payment request number"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newPayment.amount}
                    onChange={(e) => setNewPayment({...newPayment, amount: e.target.value})}
                    required
                    placeholder="0.00"
                  />
                </div>
                <div className="form-group">
                  <label>Currency *</label>
                  <select
                    value={newPayment.currency}
                    onChange={(e) => setNewPayment({...newPayment, currency: e.target.value as 'EUR' | 'USD' | 'CZK' | 'PLN'})}
                    required
                  >
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="CZK">CZK</option>
                    <option value="PLN">PLN</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>USD Amount</label>
                  <input
                    type="text"
                    value={usdPreviewLoading ? 'Calculating...' : usdPreview !== null ? formatUsd(usdPreview) : ''}
                    disabled
                    placeholder="Calculated from payment currency"
                  />
                  {usdPreviewError && <p className="usd-preview-error">{usdPreviewError}</p>}
                </div>
              </div>

              {isMixedBookingCurrencyPayment && (
                <div className="form-row">
                  <div className="form-group">
                    <label>{bookingCurrency} Equivalent</label>
                    <input
                      type="text"
                      value={bookingCurrencyPreviewLoading ? 'Calculating...' : newPayment.bookingCurrencyAmount ? `${newPayment.bookingCurrencyAmount} ${bookingCurrency}` : ''}
                      disabled
                      placeholder={`Calculated automatically in ${bookingCurrency}`}
                    />
                  </div>
                  <div className="form-group">
                    <label>Exchange Rate Provider</label>
                    <div style={{
                      width: '100%',
                      minHeight: '38px',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      backgroundColor: '#f9fafb',
                      color: '#374151',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0.5rem 0.75rem',
                    }}>
                      {exchangeRateProviderLabel}
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Conversion Date</label>
                    <input
                      type="date"
                      value={newPayment.bookingCurrencyExchangeDate}
                      onChange={(e) => setNewPayment({...newPayment, bookingCurrencyExchangeDate: e.target.value})}
                    />
                  </div>
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label>Payment Method *</label>
                  <select
                    value={newPayment.paymentMethod}
                    onChange={(e) => setNewPayment({...newPayment, paymentMethod: e.target.value})}
                    required
                  >
                    {paymentMethods.map(method => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Payment Type *</label>
                  <select
                    value={newPayment.paymentType}
                    onChange={(e) => setNewPayment({...newPayment, paymentType: e.target.value})}
                    required
                  >
                    {paymentTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Payment Date *</label>
                  <input
                    type="date"
                    value={newPayment.paymentDate}
                    onChange={(e) => setNewPayment({...newPayment, paymentDate: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Note</label>
                <textarea
                  value={newPayment.notes}
                  onChange={(e) => setNewPayment({...newPayment, notes: e.target.value})}
                  rows={2}
                  placeholder="Payment note"
                />
              </div>

              <div className="form-group">
                <label>Transaction Reference</label>
                <input
                  type="text"
                  value={newPayment.transactionReference}
                  onChange={(e) => setNewPayment({...newPayment, transactionReference: e.target.value})}
                  placeholder="e.g., TXN123456"
                />
              </div>

              <div className="form-buttons">
                <button type="submit" className="save-btn">Add Payment</button>
                <button type="button" onClick={() => setShowAddPayment(false)} className="cancel-btn">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {payments.length === 0 ? (
          <div className="no-payments">
            <p>No payments recorded yet.</p>
          </div>
        ) : (
          <div className="payments-table-container">
            <table className="payments-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Request</th>
                  <th>Type</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Reference</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => {
                  const paymentType = payment.paymentType || 'regular_payment';
                  const usdAmount = formatUsd(getPaymentUsdAmount(payment));
                  return (
                    <tr
                      key={payment._id}
                      title={`USD equivalent: ${usdAmount}`}
                    >
                      <td>{payment.display_id ? `#${payment.display_id}` : '-'}</td>
                      <td>{formatCalendarDate(payment.paymentDate)}</td>
                      <td className="amount-cell">
                        <CurrencyDisplay amount={payment.amount} currency={payment.currency} />
                        {formatBookingCurrencyEquivalent(payment)}
                        {payment.refundedAmount && payment.refundedAmount > 0 && (
                          <div className="refunded-amount">
                            Refunded: <CurrencyDisplay amount={payment.refundedAmount} currency={payment.currency} />
                          </div>
                        )}
                      </td>
                      <td>
                        {payment.paymentRequestId ? (
                          <button
                            type="button"
                            onClick={() => navigate(`${routePrefix}/payment-requests/${resolvePaymentId(payment.paymentRequestId)}`)}
                            className="payment-request-link"
                            title="Open payment request"
                          >
                            {formatPaymentRequestLabel(payment.paymentRequestId)}
                          </button>
                        ) : '-'}
                      </td>
                      <td>
                        <span
                          className="payment-type-badge"
                          style={{ backgroundColor: getPaymentTypeColor(paymentType) }}
                          title={formatPaymentType(paymentType)}
                        >
                          {formatPaymentTypeShort(paymentType)}
                        </span>
                      </td>
                      <td title={formatPaymentMethod(payment.paymentMethod)}>
                        {formatPaymentMethodShort(payment.paymentMethod)}
                      </td>
                      <td>
                        <span className={`status-badge status-${payment.status}`}>
                          {payment.status.toUpperCase()}
                        </span>
                      </td>
                      <td>{payment.transactionReference || '-'}</td>
                      <td>
                        <div className="payment-actions">
                          {payment._id && (
                            <button type="button" onClick={() => navigate(`${routePrefix}/payments/${payment._id}`)} className="view-payment-btn" title="View this payment">
                              ◉ <span>View payment</span>
                            </button>
                          )}
                          {payment.isRefundable && payment.status === 'completed' && !payment.refundedAmount && (
                            <button
                              onClick={() => handleRefundPayment(payment._id!, payment.amount)}
                              className="refund-btn"
                              title="Refund this payment"
                            >
                              Refund
                            </button>
                          )}
                          {payment._id && (
                            <button
                              type="button"
                              onClick={() => navigate(`${routePrefix}/payments/${payment._id}/edit`, { state: { returnTo: location.pathname } })}
                              className="edit-payment-btn"
                              title="Edit this payment"
                            >
                              Edit
                            </button>
                          )}
                          {payment._id && (
                            <button
                              type="button"
                              onClick={() => handleDeletePayment(payment)}
                              className="delete-payment-btn"
                              title="Delete this payment"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingPaymentManagement;
