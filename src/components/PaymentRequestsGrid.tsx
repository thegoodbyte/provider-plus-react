import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { paymentRequestsApi } from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiCheckCircle, FiClock, FiAlertTriangle } from 'react-icons/fi';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

const resolveClient = (clientValue: any) => {
  if (!clientValue) return { name: 'Unknown Client', displayId: '' };
  if (typeof clientValue === 'string') return { name: clientValue, displayId: '' };
  return {
    name: `${clientValue.firstName || ''} ${clientValue.lastName || ''}`.trim() || 'Unknown Client',
    displayId: clientValue.display_id ? `#${clientValue.display_id}` : '',
  };
};

const resolveRetreat = (retreatValue: any) => {
  if (!retreatValue) return 'Unknown Retreat';
  if (typeof retreatValue === 'string') return retreatValue;
  return [retreatValue.name, retreatValue.location].filter(Boolean).join(' - ') || 'Unknown Retreat';
};

const PaymentRequestsGrid: React.FC = () => {
  const navigate = useNavigate();
  const [paymentRequests, setPaymentRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchPaymentRequests = async () => {
    try {
      setLoading(true);
      const response = await paymentRequestsApi.getAll();
      setPaymentRequests(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching payment requests:', error);
      setPaymentRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentRequests();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this payment request?')) return;
    try {
      await paymentRequestsApi.delete(id);
      fetchPaymentRequests();
    } catch (error) {
      console.error('Error deleting payment request:', error);
      alert('Failed to delete payment request');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'sent':
        return 'bg-blue-100 text-blue-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const filteredRequests = useMemo(() => {
    const term = searchTerm.toLowerCase();
    if (!term) return paymentRequests;

    return paymentRequests.filter((request) => {
      const client = resolveClient(request.clientId);
      const retreat = resolveRetreat(request.retreatId);
      return (
        String(request.display_id || '').includes(term) ||
        client.name.toLowerCase().includes(term) ||
        client.displayId.toLowerCase().includes(term) ||
        retreat.toLowerCase().includes(term) ||
        (request.currency || '').toLowerCase().includes(term) ||
        (request.invoiceNumber || '').toLowerCase().includes(term) ||
        (request.note || '').toLowerCase().includes(term)
      );
    });
  }, [paymentRequests, searchTerm]);

  if (loading) {
    return <LoadingSpinner message="Loading payment requests..." />;
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold text-gray-900">Payment Requests</h1>
          <p className="text-sm text-gray-600">Invoices and payment requests for clients and retreats</p>
        </div>
        <button
          onClick={() => navigate('/admin/payment-requests/new')}
          className="ml-auto inline-flex w-auto shrink-0 items-center gap-2 whitespace-nowrap px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
        >
          <Icon icon={FiPlus} className="w-4 h-4" />
          Add New Invoice
        </button>
      </div>

      <div className="mb-4 relative max-w-xl">
        <Icon icon={FiSearch} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by client, retreat, amount, invoice..."
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Retreat</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quote</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">USD</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Currency</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRequests.map((request) => {
                const client = resolveClient(request.clientId);
                const retreat = resolveRetreat(request.retreatId);
                return (
                  <tr key={request._id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {request.invoiceNumber || (request.display_id ? `#${request.display_id}` : 'n/a')}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{client.name}</div>
                      {client.displayId && <div className="text-xs text-blue-600">{client.displayId}</div>}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{retreat}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                      {request.paymentDate ? new Date(request.paymentDate).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                      {request.fullPriceQuote?.toLocaleString?.() ?? request.fullPriceQuote} {request.currency}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                      {(request.usd_amount ?? 0).toLocaleString()} USD
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{request.currency}</td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                        {request.status === 'paid' && <Icon icon={FiCheckCircle} className="w-3 h-3" />}
                        {request.status === 'pending' && <Icon icon={FiClock} className="w-3 h-3" />}
                        {request.status === 'overdue' && <Icon icon={FiAlertTriangle} className="w-3 h-3" />}
                        {request.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/admin/payment-requests/${request._id}/edit`)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Edit"
                        >
                          <Icon icon={FiEdit2} className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(request._id)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete"
                        >
                          <Icon icon={FiTrash2} className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredRequests.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-gray-500">
                    {searchTerm ? 'No payment requests found matching your search' : 'No payment requests found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PaymentRequestsGrid;
