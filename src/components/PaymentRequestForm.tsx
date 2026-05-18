import React, { useEffect, useState } from 'react';
import { PaymentRequest, Client, Retreat } from '../types';
import SearchableClientSelect from './SearchableClientSelect';
import SearchableRetreatSelect from './SearchableRetreatSelect';
import { clientsApi, paymentRequestsApi, retreatsApi } from '../services/api';
import { FiSave, FiArrowLeft } from 'react-icons/fi';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

interface PaymentRequestFormProps {
  paymentRequest?: Partial<PaymentRequest>;
  onSave: (data: Omit<PaymentRequest, '_id'>) => Promise<void>;
  onCancel: () => void;
  isEdit?: boolean;
}

const defaultDate = () => new Date().toISOString().split('T')[0];
const resolveId = (value: any) => (typeof value === 'object' && value?._id ? value._id : value || '');

const PaymentRequestForm: React.FC<PaymentRequestFormProps> = ({
  paymentRequest,
  onSave,
  onCancel,
  isEdit = false,
}) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [loading, setLoading] = useState(false);
  const [nextDisplayId, setNextDisplayId] = useState<number | null>(paymentRequest?.display_id || null);
  const [formData, setFormData] = useState({
    display_id: paymentRequest?.display_id || '',
    invoiceNumber: paymentRequest?.invoiceNumber || paymentRequest?.display_id?.toString() || '',
    clientId: resolveId(paymentRequest?.clientId),
    retreatId: resolveId(paymentRequest?.retreatId),
    paymentDate: paymentRequest?.paymentDate ? new Date(paymentRequest.paymentDate).toISOString().split('T')[0] : defaultDate(),
    paymentType: paymentRequest?.paymentType || 'Other',
    fullPriceQuote: paymentRequest?.fullPriceQuote?.toString() || '',
    amountPaid: paymentRequest?.amountPaid?.toString() || '',
    currency: paymentRequest?.currency || 'EUR',
    note: paymentRequest?.note || paymentRequest?.notes || '',
    status: paymentRequest?.status || 'pending',
    dueDate: paymentRequest?.dueDate ? new Date(paymentRequest.dueDate).toISOString().split('T')[0] : '',
    paidDate: paymentRequest?.paidDate ? new Date(paymentRequest.paidDate).toISOString().split('T')[0] : '',
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
          isEdit ? Promise.resolve(null) : paymentRequestsApi.getNextDisplayId().catch((error) => {
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

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.clientId || !formData.retreatId || !formData.paymentDate || !formData.fullPriceQuote || !formData.amountPaid) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      await onSave({
        display_id: Number.isFinite(Number(formData.display_id)) ? Number(formData.display_id) : undefined,
        invoiceNumber: formData.invoiceNumber || undefined,
        clientId: formData.clientId,
        retreatId: formData.retreatId,
        paymentDate: formData.paymentDate,
        paymentType: formData.paymentType as PaymentRequest['paymentType'],
        fullPriceQuote: parseFloat(formData.fullPriceQuote),
        amountPaid: parseFloat(formData.amountPaid),
        currency: formData.currency as PaymentRequest['currency'],
        note: formData.note || '',
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
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Invoice Number</label>
              <input
                type="text"
                value={formData.invoiceNumber}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700"
                placeholder={nextDisplayId ? nextDisplayId.toString() : '1001'}
              />
              <p className="mt-1 text-xs text-gray-500">
                {isEdit ? 'This is the saved invoice number.' : 'This number is assigned before save.'}
              </p>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Date of Payment *</label>
              <input
                type="date"
                value={formData.paymentDate}
                onChange={(e) => handleChange('paymentDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type *</label>
              <select
                value={formData.paymentType}
                onChange={(e) => handleChange('paymentType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="CSOB">CSOB</option>
                <option value="Paypal">Paypal</option>
                <option value="Revolut">Revolut</option>
                <option value="Wise">Wise</option>
                <option value="Cash">Cash</option>
                <option value="Other">Other</option>
              </select>
            </div>

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
              <label className="block text-sm font-medium text-gray-700 mb-2">Amount Paid *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.amountPaid}
                onChange={(e) => handleChange('amountPaid', e.target.value)}
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
                <option value="CZK">CZK</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="PLN">PLN</option>
              </select>
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
