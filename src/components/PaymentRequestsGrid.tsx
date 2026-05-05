import React, { useState, useEffect, useMemo } from 'react';
import { PaymentRequest, Client, Retreat } from '../types';
import PaymentRequestForm from './PaymentRequestForm';
import LoadingSpinner from './LoadingSpinner';
import { FiPlus, FiEdit2, FiTrash2, FiEye, FiMail, FiAlertTriangle, FiSearch } from 'react-icons/fi';

// Simple wrapper to fix TypeScript icon issues
const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

interface PaymentRequestWithDetails extends PaymentRequest {
  clientName?: string;
  clientDisplayId?: number;
  retreatName?: string;
}

const PaymentRequestsGrid: React.FC = () => {
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequestWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRequest, setEditingRequest] = useState<PaymentRequestWithDetails | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchPaymentRequests();
  }, []);

  // Mock API functions - replace with actual API calls
  const paymentRequestsApi = {
    getAll: async () => {
      // Mock data - replace with actual API call
      return { data: [] };
    },
    create: async (data: Omit<PaymentRequest, '_id'>) => {
      console.log('Creating payment request:', data);
      // Replace with actual API call
      return { data: { _id: 'mock-id', ...data } };
    },
    update: async (id: string, data: Omit<PaymentRequest, '_id'>) => {
      console.log('Updating payment request:', id, data);
      // Replace with actual API call
      return { data: { _id: id, ...data } };
    },
    delete: async (id: string) => {
      console.log('Deleting payment request:', id);
      // Replace with actual API call
    }
  };

  const clientsApi = {
    getAll: async () => {
      // Mock data - replace with actual API call
      return { data: [] };
    }
  };

  const retreatsApi = {
    getAll: async () => {
      // Mock data - replace with actual API call
      return { data: [] };
    }
  };

  const fetchPaymentRequests = async () => {
    try {
      setIsLoading(true);
      // Replace with actual API calls
      const [requestsResponse, clientsResponse, retreatsResponse] = await Promise.all([
        paymentRequestsApi.getAll(),
        clientsApi.getAll(),
        retreatsApi.getAll()
      ]);

      const requests = requestsResponse.data || [];
      const clients = clientsResponse.data || [];
      const retreats = retreatsResponse.data || [];

      // Create lookup maps
      const clientsMap = new Map<string, Client>();
      clients.forEach((client: Client) => {
        if (client._id) clientsMap.set(client._id, client);
      });

      const retreatsMap = new Map<string, Retreat>();
      retreats.forEach((retreat: Retreat) => {
        if (retreat._id) retreatsMap.set(retreat._id, retreat);
      });

      // Enrich payment requests with client and retreat details
      const enrichedRequests: PaymentRequestWithDetails[] = requests.map((request: PaymentRequest) => {
        const client = clientsMap.get(request.clientId);
        const retreat = retreatsMap.get(request.retreatId);

        return {
          ...request,
          clientName: client ? `${client.firstName} ${client.lastName}` : 'Unknown Client',
          clientDisplayId: client?.display_id,
          retreatName: retreat ? retreat.name : 'Unknown Retreat'
        };
      });

      setPaymentRequests(enrichedRequests);
    } catch (error) {
      console.error('Error fetching payment requests:', error);
      setPaymentRequests([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (data: Omit<PaymentRequest, '_id'>) => {
    try {
      if (editingRequest?._id) {
        await paymentRequestsApi.update(editingRequest._id, data);
      } else {
        await paymentRequestsApi.create(data);
      }

      setShowAddModal(false);
      setShowEditModal(false);
      setEditingRequest(null);
      fetchPaymentRequests();
    } catch (error) {
      console.error('Error saving payment request:', error);
      alert('Error saving payment request');
    }
  };

  const handleEdit = (request: PaymentRequestWithDetails) => {
    setEditingRequest(request);
    setShowEditModal(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this payment request?')) {
      try {
        await paymentRequestsApi.delete(id);
        fetchPaymentRequests();
      } catch (error) {
        console.error('Error deleting payment request:', error);
        alert('Error deleting payment request');
      }
    }
  };

  const handleView = (request: PaymentRequestWithDetails) => {
    console.log('View request:', request);
    // Implement view modal if needed
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      paid: 'bg-green-100 text-green-800',
      overdue: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getRequestTypeColor = (type: string) => {
    const colors = {
      deposit: 'bg-blue-100 text-blue-800',
      balance: 'bg-orange-100 text-orange-800',
      full_payment: 'bg-purple-100 text-purple-800',
      additional: 'bg-indigo-100 text-indigo-800'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  // Filter payment requests based on search term
  const filteredRequests = useMemo(() => {
    if (!searchTerm) return paymentRequests;

    const searchLower = searchTerm.toLowerCase();
    return paymentRequests.filter(request =>
      (request.clientName || '').toLowerCase().includes(searchLower) ||
      (request.clientDisplayId?.toString() || '').includes(searchLower) ||
      (request.retreatName || '').toLowerCase().includes(searchLower) ||
      (request.status || '').toLowerCase().includes(searchLower) ||
      (request.requestType || '').toLowerCase().includes(searchLower) ||
      (request._id || '').toLowerCase().includes(searchLower)
    );
  }, [paymentRequests, searchTerm]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Payment Requests</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <Icon icon={FiPlus} className="w-4 h-4" />
          Add Payment Request
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Icon icon={FiSearch} className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search payment requests..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Payment Requests Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Retreat
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Request Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRequests.map((request) => (
                <tr key={request._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <div className="text-sm font-medium text-gray-900">
                        {request.clientName}
                      </div>
                      {request.clientDisplayId && (
                        <div className="text-sm text-blue-600 font-mono">
                          #{request.clientDisplayId}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {request.retreatName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRequestTypeColor(request.requestType)}`}>
                      {request.requestType.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {request.requestedAmount} {request.currency}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(request.status)}`}>
                        {request.status}
                      </span>
                      {request.isUrgent && (
                        <Icon icon={FiAlertTriangle} className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {request.requestDate ? new Date(request.requestDate).toLocaleDateString() : ''}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {request.dueDate ? new Date(request.dueDate).toLocaleDateString() : ''}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleView(request)}
                        className="text-blue-600 hover:text-blue-900"
                        title="View"
                      >
                        <Icon icon={FiEye} className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(request)}
                        className="text-indigo-600 hover:text-indigo-900"
                        title="Edit"
                      >
                        <Icon icon={FiEdit2} className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => console.log('Send email for request:', request._id)}
                        className="text-green-600 hover:text-green-900"
                        title="Send Email"
                        disabled={request.status === 'paid'}
                      >
                        <Icon icon={FiMail} className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(request._id!)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete"
                      >
                        <Icon icon={FiTrash2} className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRequests.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? `No payment requests found matching "${searchTerm}"` : 'No payment requests found'}
            </div>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="mt-4 text-sm text-gray-700">
        Showing {filteredRequests.length} payment request{filteredRequests.length !== 1 ? 's' : ''}
        {searchTerm && <span> matching "{searchTerm}"</span>}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <PaymentRequestForm
          onSave={handleSave}
          onCancel={() => setShowAddModal(false)}
        />
      )}

      {/* Edit Modal */}
      {showEditModal && editingRequest && (
        <PaymentRequestForm
          paymentRequest={editingRequest}
          onSave={handleSave}
          onCancel={() => {
            setShowEditModal(false);
            setEditingRequest(null);
          }}
          isEdit={true}
        />
      )}
    </div>
  );
};

export default PaymentRequestsGrid;