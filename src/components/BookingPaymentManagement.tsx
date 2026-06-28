import React, { useMemo, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Payment, PaymentRequest } from '../types';
import { paymentsApi } from '../services/api';
import CurrencyDisplay from './CurrencyDisplay';
import SearchablePaymentRequestSelect from './SearchablePaymentRequestSelect';
import { formatCalendarDate, todayDateInputValue } from '../utils/dateFormat';
import './BookingPaymentManagement.css';

interface BookingPaymentManagementProps {
  bookingId: string;
  bookingNumber?: string | number;
  bookingHash?: string; // New prop for booking hash
  clientId: string;
  retreatId: string;
  totalAmount: number;
  currency: string;
  onPaymentUpdate?: () => void;
}

const BookingPaymentManagement: React.FC<BookingPaymentManagementProps> = ({
  bookingId,
  bookingNumber,
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
  const [usdPreview, setUsdPreview] = useState<number | null>(null);
  const [usdPreviewLoading, setUsdPreviewLoading] = useState(false);
  const [usdPreviewError, setUsdPreviewError] = useState('');
  const [totalCostUsd, setTotalCostUsd] = useState<number | null>(null);
  const [newPayment, setNewPayment] = useState({
    amount: '',
    currency: currency as 'EUR' | 'USD' | 'CZK' | 'PLN',
    paymentRequestId: '',
    paymentMethod: 'bank_transfer',
    paymentType: 'regular_payment',
    description: '',
    transactionReference: '',
    notes: '',
    paymentDate: todayDateInputValue()
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

  const paymentTypes = [
    { value: 'deposit_non_refundable', label: '💰 Deposit (Non-Refundable)', refundable: false },
    { value: 'deposit_refundable', label: '💳 Deposit (Refundable)', refundable: true },
    { value: 'regular_payment', label: '💵 Regular Payment', refundable: true },
    { value: 'balance_payment', label: '⚖️ Balance Payment', refundable: true },
    { value: 'adjustment', label: '🔧 Adjustment', refundable: true }
  ];

  useEffect(() => {
    fetchPayments();
  }, [bookingId]);

  useEffect(() => {
    setNewPayment((current) => ({
      ...current,
      currency: (current.currency || currency || 'EUR') as 'EUR' | 'USD' | 'CZK' | 'PLN',
    }));
  }, [currency]);

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

  const fetchPayments = async () => {
    try {
      setIsLoading(true);

      // Prioritize booking hash if available, fallback to booking ID
      if (bookingHash) {
        try {
          const response = await paymentsApi.getByBookingHash(bookingHash);
          setPayments(response.data || []);
          return;
        } catch (hashError) {
          console.warn('getByBookingHash failed:', hashError);
        }
      }

      // Try booking ID endpoint
      try {
        const response = await paymentsApi.getByBooking(bookingId);
        setPayments(response.data || []);
      } catch (bookingError) {
        console.warn('getByBooking failed, trying fallback:', bookingError);
        // Fallback: get all payments by client and filter
        const response = await paymentsApi.getByClient(clientId);
        const bookingPayments = (response.data || []).filter((payment: any) =>
          payment.bookingId === bookingId || payment.bookingHash === bookingHash
        );
        setPayments(bookingPayments);
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
      setPayments([]);
    } finally {
      setIsLoading(false);
    }
  };

  const resolvePaymentId = (value: any) => (typeof value === 'object' && value?._id ? value._id : value || '');

  const loadExistingPayments = async () => {
    try {
      setLinkExistingLoading(true);
      setLinkExistingError('');
      const response = await paymentsApi.getAll();
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
      if (resolvePaymentId(payment.clientId) !== clientId) return false;
      if (resolvePaymentId(payment.retreatId) !== retreatId) return false;
      const linkedBookingId = resolvePaymentId(payment.bookingId);
      const linkedBookingHash = payment.bookingHash || '';
      return !linkedBookingId && !linkedBookingHash;
    });
  }, [allPayments, clientId, payments, retreatId]);

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
        paymentMethod: newPayment.paymentMethod as 'bank_transfer' | 'card' | 'cash' | 'paypal' | 'crypto' | 'stripe' | 'wise' | 'revolut' | 'other',
        paymentType: newPayment.paymentType as 'deposit_non_refundable' | 'deposit_refundable' | 'regular_payment' | 'balance_payment' | 'refund' | 'adjustment',
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
        paymentDate: todayDateInputValue()
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
    }));
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
        <h3>Payments</h3>
      </div>

      <div className="payment-summary-cards">
        <div className="summary-card total">
          <div className="card-label">Total Cost</div>
          <div className="card-amount">
            <CurrencyDisplay amount={totalAmount} currency={currency as 'EUR' | 'USD' | 'CZK' | 'PLN'} />
          </div>
          <div className="card-subamount">{formatUsd(totalCostUsd)}</div>
        </div>
        <div className="summary-card paid">
          <div className="card-label">All Payments USD</div>
          <div className="card-amount">
            {formatUsd(totalPaidUsd)}
          </div>
        </div>
        <div className={`summary-card balance ${balanceUsd !== null && balanceUsd > 0 ? 'due' : 'overpaid'}`}>
          <div className="card-label">Balance USD</div>
          <div className="card-amount">
            {formatUsd(balanceUsd)}
          </div>
        </div>
        {totalRefundedUsd > 0 && (
          <div className="summary-card refunded">
            <div className="card-label">Refunded USD</div>
            <div className="card-amount">
              {formatUsd(totalRefundedUsd)}
            </div>
          </div>
        )}
      </div>

      <div className="payments-list">
        <div className="payment-history-header">
          <h4>Payment History ({payments.length})</h4>
          <div style={{ display: 'flex', gap: '8px' }}>
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
          </div>
        </div>

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
                        {payment.refundedAmount && payment.refundedAmount > 0 && (
                          <div className="refunded-amount">
                            Refunded: <CurrencyDisplay amount={payment.refundedAmount} currency={payment.currency} />
                          </div>
                        )}
                      </td>
                      <td>{formatPaymentRequestLabel(payment.paymentRequestId)}</td>
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
