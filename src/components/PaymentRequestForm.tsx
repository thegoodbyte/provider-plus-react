import React, { useState, useEffect } from 'react';
import { PaymentRequest, Client, Retreat } from '../types';
import SearchableClientSelect from './SearchableClientSelect';
import { clientsApi, retreatsApi } from '../services/api';
import { FiX, FiSave, FiDollarSign } from 'react-icons/fi';

// Simple wrapper to fix TypeScript icon issues
const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

interface PaymentRequestFormProps {
  paymentRequest?: Partial<PaymentRequest>;
  onSave: (data: Omit<PaymentRequest, '_id'>) => Promise<void>;
  onCancel: () => void;
  isEdit?: boolean;
}

const PaymentRequestForm: React.FC<PaymentRequestFormProps> = ({
  paymentRequest,
  onSave,
  onCancel,
  isEdit = false
}) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<{
    clientId: string;
    retreatId: string;
    requestedAmount: string;
    fullPrice: string;
    currency: 'CZK' | 'EUR' | 'PLN' | 'USD';
    requestType: 'deposit' | 'balance' | 'full_payment' | 'additional';
    requestDate: string;
    dueDate: string;
    description: string;
    notes: string;
    isUrgent: boolean;
    status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  }>({
    clientId: paymentRequest?.clientId || '',
    retreatId: paymentRequest?.retreatId || '',
    requestedAmount: paymentRequest?.requestedAmount?.toString() || '',
    fullPrice: paymentRequest?.fullPrice?.toString() || '',
    currency: paymentRequest?.currency || 'EUR',
    requestType: paymentRequest?.requestType || 'deposit',
    requestDate: paymentRequest?.requestDate ?
      new Date(paymentRequest.requestDate).toISOString().split('T')[0] :
      new Date().toISOString().split('T')[0],
    dueDate: paymentRequest?.dueDate ?
      new Date(paymentRequest.dueDate).toISOString().split('T')[0] : '',
    description: paymentRequest?.description || '',
    notes: paymentRequest?.notes || '',
    isUrgent: paymentRequest?.isUrgent || false,
    status: paymentRequest?.status || 'pending'
  });

  useEffect(() => {
    fetchClientsAndRetreats();
  }, []);

  const fetchClientsAndRetreats = async () => {
    try {
      const [clientsResponse, retreatsResponse] = await Promise.all([
        clientsApi.getAll(),
        retreatsApi.getAll()
      ]);
      setClients(clientsResponse.data || []);
      setRetreats(retreatsResponse.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.clientId || !formData.retreatId || !formData.requestedAmount || !formData.fullPrice) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const paymentRequestData: Omit<PaymentRequest, '_id'> = {
        clientId: formData.clientId,
        retreatId: formData.retreatId,
        requestedAmount: parseFloat(formData.requestedAmount),
        fullPrice: parseFloat(formData.fullPrice),
        currency: formData.currency,
        requestType: formData.requestType,
        requestDate: formData.requestDate,
        dueDate: formData.dueDate || undefined,
        description: formData.description,
        notes: formData.notes,
        isUrgent: formData.isUrgent,
        status: formData.status
      };

      await onSave(paymentRequestData);
    } catch (error) {
      console.error('Error saving payment request:', error);
      alert('Error saving payment request');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Auto-fill retreat when client changes (get their latest booking)
  useEffect(() => {
    if (formData.clientId && !formData.retreatId) {
      // Could implement logic to auto-select the client's latest retreat
    }
  }, [formData.clientId]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon icon={FiDollarSign} className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              {isEdit ? 'Edit Payment Request' : 'New Payment Request'}
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-full"
            aria-label="Close"
          >
            <Icon icon={FiX} className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Client Selection */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Client *
              </label>
              <SearchableClientSelect
                clients={clients}
                selectedClientId={formData.clientId}
                onClientSelect={(clientId) => handleInputChange('clientId', clientId)}
                placeholder="Search clients by name or number..."
                className="w-full"
              />
            </div>

            {/* Retreat Selection */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Retreat *
              </label>
              <select
                value={formData.retreatId}
                onChange={(e) => handleInputChange('retreatId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select a retreat...</option>
                {retreats.map((retreat) => (
                  <option key={retreat._id} value={retreat._id}>
                    {retreat.name} - {retreat.location}
                    {retreat.startDate && ` (${new Date(retreat.startDate).toLocaleDateString()})`}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Type *
              </label>
              <select
                value={formData.requestType}
                onChange={(e) => handleInputChange('requestType', e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="deposit">Deposit</option>
                <option value="balance">Balance</option>
                <option value="full_payment">Full Payment</option>
                <option value="additional">Additional Fee</option>
              </select>
            </div>

            {/* Currency */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Currency *
              </label>
              <select
                value={formData.currency}
                onChange={(e) => handleInputChange('currency', e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="EUR">EUR (€)</option>
                <option value="USD">USD ($)</option>
                <option value="CZK">CZK (Kč)</option>
                <option value="PLN">PLN (zł)</option>
              </select>
            </div>

            {/* Requested Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Requested Amount *
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={formData.requestedAmount}
                  onChange={(e) => handleInputChange('requestedAmount', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  required
                />
                <span className="absolute right-3 top-2 text-gray-500">
                  {formData.currency}
                </span>
              </div>
            </div>

            {/* Full Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Price *
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={formData.fullPrice}
                  onChange={(e) => handleInputChange('fullPrice', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  required
                />
                <span className="absolute right-3 top-2 text-gray-500">
                  {formData.currency}
                </span>
              </div>
            </div>

            {/* Request Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Request Date *
              </label>
              <input
                type="date"
                value={formData.requestDate}
                onChange={(e) => handleInputChange('requestDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Due Date
              </label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => handleInputChange('dueDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Status (only show in edit mode) */}
            {isEdit && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            )}

            {/* Urgent Flag */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isUrgent"
                checked={formData.isUrgent}
                onChange={(e) => handleInputChange('isUrgent', e.target.checked)}
                className="mr-2 h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
              />
              <label htmlFor="isUrgent" className="text-sm font-medium text-gray-700">
                Mark as Urgent
              </label>
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Brief description of the payment request..."
              />
            </div>

            {/* Notes */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="Additional notes or instructions..."
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icon icon={FiSave} className="w-4 h-4" />
              {loading ? 'Saving...' : (isEdit ? 'Update Request' : 'Create Request')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentRequestForm;