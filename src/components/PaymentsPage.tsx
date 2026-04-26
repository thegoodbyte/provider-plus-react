import React, { useState, useEffect } from 'react';
import { paymentsApi, clientsApi, retreatsApi } from '../services/api';
import { Payment, Client, Retreat } from '../types';
import CurrencyDisplay from './CurrencyDisplay';
import AppleButton from './AppleButton';
import { FiPlus, FiEdit2, FiTrash2, FiDollarSign, FiCheck, FiX } from 'react-icons/fi';

// Simple wrapper to fix TypeScript icon issues
const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

interface PaymentWithDetails extends Payment {
  clientName?: string;
  retreatName?: string;
}

const PaymentsPage: React.FC = () => {
  const [payments, setPayments] = useState<PaymentWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [retreats, setRetreats] = useState<Retreat[]>([]);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      setIsLoading(true);
      const [paymentsResponse, clientsResponse, retreatsResponse] = await Promise.all([
        paymentsApi.getAll(),
        clientsApi.getAll(),
        retreatsApi.getAll()
      ]);

      const clientsMap = new Map<string, Client>(
        clientsResponse.data
          .filter((client: Client) => client._id)
          .map((client: Client) => [client._id!, client])
      );

      const retreatsMap = new Map<string, Retreat>(
        retreatsResponse.data
          .filter((retreat: Retreat) => retreat._id)
          .map((retreat: Retreat) => [retreat._id!, retreat])
      );

      const enrichedPayments: PaymentWithDetails[] = paymentsResponse.data.map((payment: Payment) => {
        const clientId = typeof payment.clientId === 'string' ? payment.clientId : payment.clientId._id;
        const retreatId = typeof payment.retreatId === 'string' ? payment.retreatId : payment.retreatId._id;

        const client = clientId ? clientsMap.get(clientId) : undefined;
        const retreat = retreatId ? retreatsMap.get(retreatId) : undefined;

        return {
          ...payment,
          clientId,
          retreatId,
          clientName: client ? `${client.firstName} ${client.lastName}` : 'Unknown Client',
          retreatName: retreat ? retreat.name : 'Unknown Retreat'
        };
      });

      setPayments(enrichedPayments);
      setClients(clientsResponse.data);
      setRetreats(retreatsResponse.data);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      completed: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      failed: 'bg-red-100 text-red-800',
      refunded: 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this payment?')) {
      try {
        await paymentsApi.delete(id);
        fetchPayments();
      } catch (error) {
        console.error('Error deleting payment:', error);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading payments...</div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Payments</h1>
        <AppleButton
          onClick={() => console.log('Add new payment')}
          className="apple-button-primary"
        >
<Icon icon={FiPlus} className="w-4 h-4 mr-2" />
          Add Payment
        </AppleButton>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Retreat
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {payments.map((payment) => (
                <tr key={payment._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(payment.paymentDate).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {payment.clientName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {payment.retreatName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <CurrencyDisplay
                      amount={payment.amount}
                      currency={payment.currency}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {payment.paymentMethod.replace(/_/g, ' ')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(payment.status)}`}>
                      {payment.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {payment.paymentType?.replace(/_/g, ' ') || 'regular'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => console.log('Edit payment:', payment._id)}
                        className="text-indigo-600 hover:text-indigo-900"
                        title="Edit"
                      >
                        <Icon icon={FiEdit2} className="w-4 h-4" />
                      </button>
                      {payment.status === 'completed' && !payment.isRefundable && (
                        <button
                          onClick={() => console.log('Refund payment:', payment._id)}
                          className="text-yellow-600 hover:text-yellow-900"
                          title="Refund"
                        >
                          <Icon icon={FiDollarSign} className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(payment._id!)}
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
          {payments.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No payments found
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-gray-700">
          Showing {payments.length} payment{payments.length !== 1 ? 's' : ''}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-700">
            Total: {payments.filter(p => p.status === 'completed').length} completed
          </div>
          <div className="text-sm text-gray-700">
            Pending: {payments.filter(p => p.status === 'pending').length}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentsPage;