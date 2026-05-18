import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { clientsApi, paymentsApi, retreatsApi } from '../services/api';
import { Client, Payment, Retreat } from '../types';
import LoadingSpinner from './LoadingSpinner';
import SearchableClientSelect from './SearchableClientSelect';
import SearchableRetreatSelect from './SearchableRetreatSelect';
import SearchablePaymentRequestSelect from './SearchablePaymentRequestSelect';
import { FiArrowLeft, FiSave } from 'react-icons/fi';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

const resolveId = (value: any) => (typeof value === 'object' && value?._id ? value._id : value || '');

const defaultDate = () => new Date().toISOString().split('T')[0];

const PaymentEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(Boolean(id));
  const [clients, setClients] = useState<Client[]>([]);
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [formData, setFormData] = useState({
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
    paymentType: 'regular_payment' as 'deposit_non_refundable' | 'deposit_refundable' | 'regular_payment' | 'balance_payment' | 'refund' | 'adjustment',
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [clientsResponse, retreatsResponse, paymentResponse] = await Promise.all([
          clientsApi.getAll(),
          retreatsApi.getAll(),
          id ? paymentsApi.getOne(id) : Promise.resolve(null),
        ]);

        setClients(clientsResponse.data || []);
        setRetreats(retreatsResponse.data || []);

        if (paymentResponse?.data) {
          const payment = paymentResponse.data as Payment;
          setFormData({
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
            paymentDate: payment.paymentDate ? new Date(payment.paymentDate).toISOString().split('T')[0] : defaultDate(),
            notes: payment.notes || '',
            isDeposit: payment.isDeposit || false,
            isFinalPayment: payment.isFinalPayment || false,
            isRefundable: payment.isRefundable || false,
            paymentType: payment.paymentType || 'regular_payment',
          });
        }
      } catch (error) {
        console.error('Error loading payment editor data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePaymentRequestSelect = (paymentRequestId: string, paymentRequest?: any) => {
    const amount = paymentRequest?.fullPriceQuote ?? paymentRequest?.amountPaid ?? '';
    const currency = paymentRequest?.currency || formData.currency;
    const clientId = resolveId(paymentRequest?.clientId);
    const retreatId = resolveId(paymentRequest?.retreatId);

    setFormData((prev) => ({
      ...prev,
      paymentRequestId,
      clientId: clientId || prev.clientId,
      retreatId: retreatId || prev.retreatId,
      amount: amount !== '' ? String(amount) : prev.amount,
      currency,
      description: prev.description || `Payment for invoice ${paymentRequest?.invoiceNumber || paymentRequest?.display_id || ''}`.trim(),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.clientId || !formData.retreatId || !formData.amount) {
      alert('Please fill in all required fields');
      return;
    }

    const submitData = {
      paymentRequestId: formData.paymentRequestId || undefined,
      clientId: formData.clientId,
      retreatId: formData.retreatId,
      bookingId: formData.bookingId || undefined,
      amount: parseFloat(formData.amount),
      currency: formData.currency,
      status: formData.status,
      paymentMethod: formData.paymentMethod,
      description: formData.description || undefined,
      transactionId: formData.transactionId || undefined,
      paymentDate: new Date(formData.paymentDate),
      notes: formData.notes || undefined,
      isDeposit: formData.isDeposit,
      isFinalPayment: formData.isFinalPayment,
      paymentType: formData.paymentType,
    };

    try {
      if (isEdit && id) {
        await paymentsApi.update(id, submitData as any);
      } else {
        await paymentsApi.create(submitData as any);
      }
      navigate('/admin/payments');
    } catch (error) {
      console.error('Error saving payment:', error);
      alert('Error saving payment');
    }
  };

  if (loading) {
    return <LoadingSpinner message={isEdit ? 'Loading payment...' : 'Loading form...'} />;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/admin/payments')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            <Icon icon={FiArrowLeft} className="w-4 h-4" />
            Back
          </button>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-gray-900 whitespace-nowrap">
              {isEdit ? 'Edit Payment' : 'Add Payment'}
            </h1>
            <p className="text-sm text-gray-600">
              {isEdit ? 'Update payment details' : 'Record a new payment against an invoice'}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Request</label>
              <SearchablePaymentRequestSelect
                selectedPaymentRequestId={formData.paymentRequestId}
                onPaymentRequestSelect={(paymentRequestId, paymentRequest) => handlePaymentRequestSelect(paymentRequestId, paymentRequest)}
                placeholder="Search invoice number, client, or retreat"
                className="w-full"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Client *</label>
              <SearchableClientSelect
                clients={clients}
                selectedClientId={formData.clientId}
                onClientSelect={(clientId) => handleChange('clientId', clientId)}
                placeholder="Search client by name, email, or display ID"
                className="w-full"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Retreat *</label>
              <SearchableRetreatSelect
                retreats={retreats}
                selectedRetreatId={formData.retreatId}
                onRetreatSelect={(retreatId) => handleChange('retreatId', retreatId)}
                placeholder="Search retreat by name or location"
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Amount *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(e) => handleChange('amount', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Currency *</label>
              <select
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method *</label>
              <select
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Brief description of the payment"
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
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <button
              type="button"
              onClick={() => navigate('/admin/payments')}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              <Icon icon={FiSave} className="w-4 h-4" />
              {isEdit ? 'Update Payment' : 'Add Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentEditorPage;
