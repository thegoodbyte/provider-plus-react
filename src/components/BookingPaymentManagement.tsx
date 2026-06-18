import React, { useState, useEffect } from 'react';
import { Payment } from '../types';
import { paymentsApi } from '../services/api';
import CurrencyDisplay from './CurrencyDisplay';
import './BookingPaymentManagement.css';

interface BookingPaymentManagementProps {
  bookingId: string;
  bookingHash?: string; // New prop for booking hash
  clientId: string;
  retreatId: string;
  totalAmount: number;
  currency: string;
  onPaymentUpdate?: () => void;
}

const BookingPaymentManagement: React.FC<BookingPaymentManagementProps> = ({
  bookingId,
  bookingHash,
  clientId,
  retreatId,
  totalAmount,
  currency,
  onPaymentUpdate
}) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [newPayment, setNewPayment] = useState({
    amount: '',
    paymentMethod: 'bank_transfer',
    paymentType: 'regular_payment',
    description: '',
    transactionReference: '',
    notes: '',
    paymentDate: new Date().toISOString().split('T')[0]
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

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const selectedPaymentType = paymentTypes.find(pt => pt.value === newPayment.paymentType);

      const paymentData = {
        clientId,
        retreatId,
        bookingId, // Keep for backward compatibility
        bookingHash, // New field - prioritize this for linking
        amount: parseFloat(newPayment.amount),
        currency: currency as 'EUR' | 'CZK' | 'PLN' | 'USD',
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
        paymentMethod: 'bank_transfer',
        paymentType: 'regular_payment',
        description: '',
        transactionReference: '',
        notes: '',
        paymentDate: new Date().toISOString().split('T')[0]
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

  const formatPaymentMethod = (method: string) => {
    const methodInfo = paymentMethods.find(pm => pm.value === method);
    return methodInfo?.label || method.replace('_', ' ').toUpperCase();
  };

  const getPaymentTypeColor = (type: string) => {
    switch (type) {
      case 'deposit_non_refundable': return '#dc3545';
      case 'deposit_refundable': return '#ffc107';
      case 'regular_payment': return '#28a745';
      case 'balance_payment': return '#007bff';
      case 'adjustment': return '#6c757d';
      default: return '#6c757d';
    }
  };

  const totalPaid = payments
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);

  const balance = totalAmount - totalPaid;

  const totalRefunded = payments
    .reduce((sum, p) => sum + (p.refundedAmount || 0), 0);

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
        <button
          onClick={() => setShowAddPayment(!showAddPayment)}
          className="add-payment-btn"
        >
          {showAddPayment ? 'Cancel' : 'Add Payment'}
        </button>
      </div>

      <div className="payment-summary-cards">
        <div className="summary-card total">
          <div className="card-label">Total Cost</div>
          <div className="card-amount">
            <CurrencyDisplay amount={totalAmount} currency={currency as 'EUR' | 'USD' | 'CZK' | 'PLN'} />
          </div>
        </div>
        <div className="summary-card paid">
          <div className="card-label">All Payments</div>
          <div className="card-amount">
            <CurrencyDisplay amount={totalPaid} currency={currency as 'EUR' | 'USD' | 'CZK' | 'PLN'} />
          </div>
        </div>
        <div className={`summary-card balance ${balance > 0 ? 'due' : 'overpaid'}`}>
          <div className="card-label">Balance</div>
          <div className="card-amount">
            <CurrencyDisplay amount={balance} currency={currency as 'EUR' | 'USD' | 'CZK' | 'PLN'} />
          </div>
        </div>
        {totalRefunded > 0 && (
          <div className="summary-card refunded">
            <div className="card-label">Refunded</div>
            <div className="card-amount">
              <CurrencyDisplay amount={totalRefunded} currency={currency as 'EUR' | 'USD' | 'CZK' | 'PLN'} />
            </div>
          </div>
        )}
      </div>

      {showAddPayment && (
        <div className="add-payment-form">
          <h4>Add New Payment</h4>
          <form onSubmit={handleAddPayment}>
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
                <label>Currency</label>
                <input type="text" value={currency} disabled />
              </div>
            </div>

            <div className="form-row">
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
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Payment Date *</label>
                <input
                  type="date"
                  value={newPayment.paymentDate}
                  onChange={(e) => setNewPayment({...newPayment, paymentDate: e.target.value})}
                  required
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
            </div>

            <div className="form-group">
              <label>Description</label>
              <input
                type="text"
                value={newPayment.description}
                onChange={(e) => setNewPayment({...newPayment, description: e.target.value})}
                placeholder="Payment description (optional)"
              />
            </div>

            <div className="form-group">
              <label>Notes</label>
              <textarea
                value={newPayment.notes}
                onChange={(e) => setNewPayment({...newPayment, notes: e.target.value})}
                rows={2}
                placeholder="Additional notes (optional)"
              />
            </div>

            <div className="form-buttons">
              <button type="submit" className="save-btn">Add Payment</button>
              <button type="button" onClick={() => setShowAddPayment(false)} className="cancel-btn">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="payments-list">
        <h4>Payment History ({payments.length})</h4>
        {payments.length === 0 ? (
          <div className="no-payments">
            <p>No payments recorded yet.</p>
          </div>
        ) : (
          <div className="payments-table-container">
            <table className="payments-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Type</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Reference</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment._id}>
                    <td>{new Date(payment.paymentDate).toLocaleDateString()}</td>
                    <td className="amount-cell">
                      <CurrencyDisplay amount={payment.amount} currency={payment.currency} />
                      {payment.refundedAmount && payment.refundedAmount > 0 && (
                        <div className="refunded-amount">
                          Refunded: <CurrencyDisplay amount={payment.refundedAmount} currency={payment.currency} />
                        </div>
                      )}
                    </td>
                    <td>
                      <span
                        className="payment-type-badge"
                        style={{ backgroundColor: getPaymentTypeColor(payment.paymentType || 'regular_payment') }}
                      >
                        {formatPaymentType(payment.paymentType || 'regular_payment')}
                      </span>
                    </td>
                    <td>{formatPaymentMethod(payment.paymentMethod)}</td>
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
                            🔄 Refund
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingPaymentManagement;
