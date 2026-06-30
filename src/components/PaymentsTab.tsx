import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { paymentsApi } from '../services/api';
import { Payment, PaymentSummary } from '../types';
import { FiEdit2, FiTrash2, FiRefreshCw } from 'react-icons/fi';
import { formatCalendarDate, toDateInputValue, todayDateInputValue } from '../utils/dateFormat';
import './ClientsGrid.css';

// Simple wrapper to fix TypeScript icon issues
const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

interface PaymentsTabProps {
  retreatId: string;
}

interface PaymentFormData {
  clientId: string;
  bookingId?: string;
  amount: number;
  currency: 'EUR' | 'USD' | 'CZK' | 'PLN';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  paymentMethod: 'bank_transfer' | 'card' | 'cash' | 'paypal' | 'crypto' | 'stripe' | 'wise' | 'revolut' | 'other';
  description?: string;
  transactionId?: string;
  paymentDate: string;
  notes?: string;
  isDeposit: boolean;
  isFinalPayment: boolean;
  exchangeRate?: number;
}

const PaymentsTab: React.FC<PaymentsTabProps> = ({ retreatId }) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [usdPreview, setUsdPreview] = useState<number | null>(null);
  const [usdPreviewLoading, setUsdPreviewLoading] = useState(false);
  const [usdPreviewError, setUsdPreviewError] = useState('');
  const [formData, setFormData] = useState<PaymentFormData>({
    clientId: '',
    amount: 0,
    currency: 'EUR',
    status: 'pending',
    paymentMethod: 'bank_transfer' as 'bank_transfer' | 'card' | 'cash' | 'paypal' | 'crypto' | 'stripe' | 'wise' | 'revolut' | 'other',
    description: '',
    transactionId: '',
    paymentDate: todayDateInputValue(),
    notes: '',
    isDeposit: false,
    isFinalPayment: false
  });



  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [paymentsResponse, summaryResponse] = await Promise.all([
        paymentsApi.getByRetreat(retreatId),
        paymentsApi.getRetreatSummary(retreatId)
      ]);

      setPayments(paymentsResponse.data);
      setSummary(summaryResponse.data);
    } catch (error) {
      console.error('Error fetching payments data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [retreatId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const amount = Number(formData.amount);
    if (!Number.isFinite(amount) || amount <= 0 || !formData.currency) {
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


  const handleDeletePayment = useCallback(async (paymentId: string) => {
    if (window.confirm('Are you sure you want to delete this payment?')) {
      try {
        await paymentsApi.delete(paymentId);
        await fetchData();
      } catch (error) {
        console.error('Error deleting payment:', error);
        alert('Error deleting payment');
      }
    }
  }, [fetchData]);

  const handleEditPayment = useCallback((payment: Payment) => {
    setEditingPayment(payment);
    setFormData({
      clientId: typeof payment.clientId === 'string' ? payment.clientId : payment.clientId._id || '',
      bookingId: typeof payment.bookingId === 'string' ? payment.bookingId : payment.bookingId?._id,
      amount: payment.amount,
      currency: payment.currency as 'EUR' | 'USD' | 'CZK' | 'PLN',
      status: payment.status,
      paymentMethod: payment.paymentMethod as 'bank_transfer' | 'card' | 'cash' | 'paypal' | 'crypto' | 'stripe' | 'wise' | 'revolut' | 'other',
      description: payment.description || '',
      transactionId: payment.transactionId || '',
      paymentDate: toDateInputValue(payment.paymentDate),
      notes: payment.notes || '',
      isDeposit: payment.isDeposit,
      isFinalPayment: payment.isFinalPayment,
      exchangeRate: payment.exchangeRate
    });
    setShowAddForm(true);
  }, []);

  const handleRefund = async (paymentId: string) => {
    const payment = payments.find(p => p._id === paymentId);
    if (!payment) return;

    const refundAmount = prompt(`Enter refund amount (max: ${payment.amount} ${payment.currency}):`);
    if (refundAmount && !isNaN(Number(refundAmount))) {
      try {
        await paymentsApi.processRefund(paymentId, Number(refundAmount));
        await fetchData();
      } catch (error) {
        console.error('Error processing refund:', error);
        alert('Error processing refund');
      }
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const submitData = {
        ...formData,
        retreatId,
        usd_amount: usdPreview ?? undefined,
        paymentDate: formData.paymentDate,
        paymentType: 'regular_payment' as const,
        isRefundable: true
      };

      if (editingPayment) {
        await paymentsApi.update(editingPayment._id!, submitData);
      } else {
        await paymentsApi.create(submitData);
      }

      setShowAddForm(false);
      setEditingPayment(null);
      setFormData({
        clientId: '',
        amount: 0,
        currency: 'EUR',
        status: 'pending',
        paymentMethod: 'bank_transfer' as 'bank_transfer' | 'card' | 'cash' | 'paypal' | 'crypto' | 'stripe' | 'wise' | 'revolut' | 'other',
        description: '',
        transactionId: '',
        paymentDate: todayDateInputValue(),
        notes: '',
        isDeposit: false,
        isFinalPayment: false
      });
      setUsdPreview(null);
      setUsdPreviewError('');
      await fetchData();
    } catch (error) {
      console.error('Error saving payment:', error);
      alert('Error saving payment');
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return `${amount.toLocaleString()} ${currency}`;
  };

  const formatUsd = (amount?: number | null) => {
    if (amount === null || amount === undefined || !Number.isFinite(amount)) return '';
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">💰</div>
        <p>Loading payments...</p>
      </div>
    );
  }

  return (
    <div className="payments-tab">
      {/* Summary Cards */}
      {summary && (
        <div className="payments-summary">
          <div className="summary-cards">
            <div className="summary-card">
              <div className="summary-number">{formatCurrency(summary.completedPaymentsUSD || 0, 'USD')}</div>
              <div className="summary-label">Completed Payments</div>
            </div>
            <div className="summary-card">
              <div className="summary-number">{formatCurrency(summary.pendingPaymentsUSD || 0, 'USD')}</div>
              <div className="summary-label">Pending Payments</div>
            </div>
            <div className="summary-card">
              <div className="summary-number">{formatCurrency(summary.depositsUSD || 0, 'USD')}</div>
              <div className="summary-label">Deposits</div>
            </div>
            <div className="summary-card">
              <div className="summary-number">{formatCurrency(summary.finalPaymentsUSD || 0, 'USD')}</div>
              <div className="summary-label">Final Payments</div>
            </div>
          </div>

          {/* Payment Method Breakdown */}
          <div className="method-breakdown">
            <h4>💳 By Payment Method</h4>
            <div className="method-list">
              {Object.entries(summary.paymentsByMethod).map(([method, amount]) => (
                <div key={method} className="method-item">
                  <span className="method-name">{method.replace('_', ' ')}</span>
                  <span className="method-amount">{formatCurrency(amount, 'USD')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="payments-actions">
        <button
          onClick={() => setShowAddForm(true)}
          className="add-btn"
          disabled={showAddForm}
        >
          ➕ Record Payment
        </button>
        <button onClick={fetchData} className="refresh-btn">
          🔄 Refresh
        </button>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="payment-form">
          <h3>{editingPayment ? 'Edit Payment' : 'Record New Payment'}</h3>
          <form onSubmit={handleFormSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})}
                  required
                />
              </div>

              <div className="form-group">
                <label>Currency</label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({...formData, currency: e.target.value as 'CZK' | 'EUR' | 'PLN' | 'USD'})}
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
                  value={usdPreviewLoading ? 'Calculating...' : formatUsd(usdPreview)}
                  readOnly
                  placeholder="Calculated from Revolut rate"
                />
                {usdPreviewError && <p className="usd-preview-error">{usdPreviewError}</p>}
              </div>

              <div className="form-group">
                <label>Payment Method</label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData({...formData, paymentMethod: e.target.value as any})}
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="card">Card</option>
                  <option value="cash">Cash</option>
                  <option value="paypal">PayPal</option>
                  <option value="crypto">Cryptocurrency</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label>Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                >
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              <div className="form-group">
                <label>Payment Date</label>
                <input
                  type="date"
                  value={formData.paymentDate}
                  onChange={(e) => setFormData({...formData, paymentDate: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label>Transaction ID</label>
                <input
                  type="text"
                  value={formData.transactionId}
                  onChange={(e) => setFormData({...formData, transactionId: e.target.value})}
                />
              </div>

              <div className="form-group full-width">
                <label>Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
              </div>

              <div className="form-group full-width">
                <label>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.isDeposit}
                    onChange={(e) => setFormData({...formData, isDeposit: e.target.checked})}
                  />
                  This is a deposit
                </label>
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.isFinalPayment}
                    onChange={(e) => setFormData({...formData, isFinalPayment: e.target.checked})}
                  />
                  This is a final payment
                </label>
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setEditingPayment(null);
                  setUsdPreview(null);
                  setUsdPreviewError('');
                }}
                className="cancel-btn"
              >
                Cancel
              </button>
              <button type="submit" className="save-btn">
                {editingPayment ? 'Update Payment' : 'Record Payment'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Payments Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  USD Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Transaction ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {payments.map((payment: any) => {
                const client = typeof payment.clientId === 'object' ? payment.clientId : null;
                const clientName = client ? `${client.firstName || ''} ${client.lastName || ''}`.trim() : 'Unknown Client';
                const clientDisplayId = client?.display_id ? `#${client.display_id}` : '';
                const clientId = client?._id || (typeof payment.clientId === 'string' ? payment.clientId : '');

                const getStatusColor = (status: string) => {
                  switch (status) {
                    case 'completed': return 'bg-green-100 text-green-800';
                    case 'pending': return 'bg-yellow-100 text-yellow-800';
                    case 'failed': return 'bg-red-100 text-red-800';
                    case 'refunded': return 'bg-gray-100 text-gray-800';
                    default: return 'bg-gray-100 text-gray-800';
                  }
                };

                const getPaymentType = () => {
                  if (payment.isDeposit) return '🏠 Deposit';
                  if (payment.isFinalPayment) return '✅ Final Payment';
                  return '💰 Payment';
                };

                const getPaymentMethodDisplay = (method: string) => {
                  const methodIcons = {
                    bank_transfer: '🏦',
                    card: '💳',
                    cash: '💵',
                    paypal: '🌐',
                    crypto: '₿',
                    stripe: '💳',
                    wise: '🏦',
                    revolut: '🏦',
                    other: '📄'
                  };
                  const icon = methodIcons[method as keyof typeof methodIcons] || '📄';
                  const displayName = method?.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || '';
                  return `${icon} ${displayName}`;
                };

                return (
                  <tr key={payment._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {clientDisplayId && clientId && (
                        <Link
                          to={`/admin/clients/${clientId}`}
                          className="mr-2 font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                          title="Open client profile"
                        >
                          {clientDisplayId}
                        </Link>
                      )}
                      {clientName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {payment.currency === 'EUR'
                        ? `€${payment.amount.toLocaleString()}`
                        : `${payment.amount.toLocaleString()} ${payment.currency}${payment.amountInEUR ? ` (€${payment.amountInEUR.toLocaleString()})` : ''}`
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(payment.usd_amount || 0, 'USD')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {getPaymentType()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {getPaymentMethodDisplay(payment.paymentMethod)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(payment.status)}`}>
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {payment.description || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {payment.transactionId || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCalendarDate(payment.paymentDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditPayment(payment)}
                          className="icon-action-btn icon-action-btn-edit"
                          title="Edit Payment"
                        >
                          <Icon icon={FiEdit2} />
                        </button>
                        <button
                          onClick={() => handleDeletePayment(payment._id)}
                          className="icon-action-btn icon-action-btn-danger"
                          title="Delete Payment"
                        >
                          <Icon icon={FiTrash2} />
                        </button>
                        {payment.status === 'completed' && (
                          <button
                            onClick={() => handleRefund(payment._id)}
                            className="icon-action-btn icon-action-btn-edit"
                            title="Process Refund"
                          >
                            <Icon icon={FiRefreshCw} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {payments.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No payments found
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentsTab;
