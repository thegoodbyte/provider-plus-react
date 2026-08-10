import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiPlus, FiEdit2, FiTrash2, FiDollarSign, FiChevronDown, FiSearch, FiX } from 'react-icons/fi';
import { paymentsApi, clientsApi, retreatsApi, bookingsApi } from '../services/api';
import { Payment, Client, Retreat, RetreatClient } from '../types';
import CurrencyDisplay from './CurrencyDisplay';
import LoadingSpinner from './LoadingSpinner';
import { formatCalendarDate, parseCalendarDate } from '../utils/dateFormat';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

interface PaymentWithDetails extends Payment {
  clientName?: string;
  clientDisplayId?: number;
  retreatName?: string;
  bookingNumber?: number;
  clientEmail?: string;
  clientPhone?: string;
}

type PaymentSortKey = 'display' | 'date' | 'client' | 'retreat' | 'booking' | 'request' | 'amount' | 'usd' | 'method' | 'status' | 'type';
type SortDirection = 'asc' | 'desc';

const getRetreatCode = (retreat?: Retreat) => {
  if (!retreat) return 'Unknown Retreat';
  return retreat.retreatCode || retreat.code || retreat.name || 'Unknown Retreat';
};

const PaymentsPage: React.FC = () => {
  const navigate = useNavigate();
  const [payments, setPayments] = useState<PaymentWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortKey, setSortKey] = useState<PaymentSortKey>('display');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchPayments = useCallback(async () => {
    try {
      setIsLoading(true);
      const [paymentsResponse, clientsResponse, retreatsResponse, bookingsResponse] = await Promise.all([
        paymentsApi.getAll(),
        clientsApi.getAll(),
        retreatsApi.getAll(),
        bookingsApi.getAll(),
      ]);

      const clientsMap = new Map<string, Client>(
        (clientsResponse.data || [])
          .filter((client: Client) => client._id)
          .map((client: Client) => [client._id!, client]),
      );

      const retreatsMap = new Map<string, Retreat>(
        (retreatsResponse.data || [])
          .filter((retreat: Retreat) => retreat._id)
          .map((retreat: Retreat) => [retreat._id!, retreat]),
      );

      const bookingsMap = new Map<string, RetreatClient>(
        (bookingsResponse.data || [])
          .filter((booking: RetreatClient) => booking._id)
          .map((booking: RetreatClient) => [booking._id!, booking]),
      );

      const enrichedPayments: PaymentWithDetails[] = (paymentsResponse.data || []).map((payment: Payment) => {
        const clientId = typeof payment.clientId === 'string' ? payment.clientId : payment.clientId?._id;
        const retreatId = typeof payment.retreatId === 'string' ? payment.retreatId : payment.retreatId?._id;
        const bookingId = typeof payment.bookingId === 'string' ? payment.bookingId : payment.bookingId?._id;
        const client = clientId ? clientsMap.get(clientId) : undefined;
        const retreat = retreatId ? retreatsMap.get(retreatId) : undefined;
        const booking = bookingId ? bookingsMap.get(bookingId) : undefined;

        return {
          ...payment,
          clientId,
          retreatId,
          bookingId,
          clientName: client ? `${client.firstName} ${client.lastName}` : 'Unknown Client',
          clientDisplayId: client?.display_id,
          clientEmail: client?.email,
          clientPhone: client?.phone,
          retreatName: getRetreatCode(retreat),
          bookingNumber: (typeof payment.bookingId === 'object' ? payment.bookingId?.bookingNumber : undefined) || booking?.bookingNumber,
        };
      });

      setPayments(enrichedPayments);
    } catch (error) {
      console.error('Error fetching payments:', error);
      setPayments([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this payment?')) return;
    try {
      await paymentsApi.delete(id);
      fetchPayments();
    } catch (error) {
      console.error('Error deleting payment:', error);
      alert('Error deleting payment');
    }
  };

  const handleEdit = (payment: Payment) => {
    navigate(`/admin/payments/${payment._id}/edit`);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      completed: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      failed: 'bg-red-100 text-red-800',
      refunded: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const filteredPayments = useMemo(() => {
    const terms = searchTerm.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return payments;
    return payments.filter((payment) => {
      const haystack = [payment.display_id, payment._id, payment.clientDisplayId, payment.clientId, payment.clientName, payment.clientEmail, payment.clientPhone, payment.bookingNumber, payment.bookingId, payment.bookingHash, payment.retreatId, payment.retreatName, payment.paymentRequestId, typeof payment.paymentRequestId === 'object' ? payment.paymentRequestId?._id : payment.paymentRequestId, typeof payment.paymentRequestId === 'object' ? payment.paymentRequestId?.display_id : undefined, typeof payment.paymentRequestId === 'object' ? payment.paymentRequestId?.invoiceNumber : undefined, payment.transactionId, payment.transactionReference, payment.description, payment.notes, payment.status, payment.paymentMethod, payment.paymentType, payment.currency, payment.amount, payment.usd_amount, payment.paymentDate, payment.processedDate, payment.processedBy]
        .filter((value) => value !== undefined && value !== null).join(' ').toLowerCase();
      return terms.every((term) => haystack.includes(term.replace(/^#/, '')));
    });
  }, [payments, searchTerm]);

  const totalCompleted = useMemo(() => filteredPayments.filter((payment) => payment.status === 'completed').length, [filteredPayments]);
  const totalPending = useMemo(() => filteredPayments.filter((payment) => payment.status === 'pending').length, [filteredPayments]);

  const getSortValue = (payment: PaymentWithDetails, key: PaymentSortKey) => {
    switch (key) {
      case 'display':
        return Number(payment.display_id || 0);
      case 'date':
        return parseCalendarDate(payment.paymentDate)?.getTime() || 0;
      case 'client':
        return `${payment.clientDisplayId || ''} ${payment.clientName || ''}`.toLowerCase();
      case 'retreat':
        return String(payment.retreatName || '').toLowerCase();
      case 'booking':
        return Number(payment.bookingNumber || 0);
      case 'request': {
        const request = payment.paymentRequestId;
        if (!request) return '';
        if (typeof request === 'string') return request;
        return String(request.invoiceNumber || request.display_id || request._id || '');
      }
      case 'amount':
        return Number(payment.amount || 0);
      case 'usd':
        return Number(payment.usd_amount || 0);
      case 'method':
        return String(payment.paymentMethod || '').toLowerCase();
      case 'status':
        return String(payment.status || '').toLowerCase();
      case 'type':
        return String(payment.paymentType || 'regular').toLowerCase();
      default:
        return '';
    }
  };

  const sortedPayments = useMemo(() => {
    return [...filteredPayments].sort((a, b) => {
      const aValue = getSortValue(a, sortKey);
      const bValue = getSortValue(b, sortKey);
      const direction = sortDirection === 'asc' ? 1 : -1;

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return (aValue - bValue) * direction;
      }

      return String(aValue).localeCompare(String(bValue), undefined, { numeric: true, sensitivity: 'base' }) * direction;
    });
  }, [filteredPayments, sortDirection, sortKey]);

  const handleSort = (key: PaymentSortKey) => {
    if (sortKey === key) {
      setSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc');
      return;
    }

    setSortKey(key);
    setSortDirection(key === 'display' || key === 'date' || key === 'booking' || key === 'amount' || key === 'usd' ? 'desc' : 'asc');
  };

  const renderSortableHeader = (key: PaymentSortKey, label: string) => (
    <button
      type="button"
      onClick={() => handleSort(key)}
      className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-900"
    >
      {label}
      <Icon
        icon={FiChevronDown}
        className={`h-3 w-3 transition-transform ${sortKey === key && sortDirection === 'asc' ? 'rotate-180' : ''} ${sortKey === key ? 'opacity-100' : 'opacity-35'}`}
      />
    </button>
  );

  if (isLoading) {
    return <LoadingSpinner message="Loading payments..." />;
  }

  return (
    <div className="p-6 h-full">
      <div className="mb-6 flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold text-gray-900">Payments</h1>
          <p className="text-sm text-gray-600">Manage client payments and invoice settlement records</p>
        </div>
        <button
          onClick={() => navigate('/admin/payments/new')}
          className="ml-auto inline-flex w-auto shrink-0 items-center gap-2 whitespace-nowrap px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
        >
          <Icon icon={FiPlus} className="w-4 h-4" />
          Add Payment
        </button>
      </div>

      <div className="mb-4 flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <div className="relative min-w-0 flex-1">
          <Icon icon={FiSearch} className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search client, client ID, booking, payment ID, reference, amount, status, notes..." className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-9 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" aria-label="Search payments" />
          {searchTerm && <button type="button" onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700" title="Clear search" aria-label="Clear payment search"><Icon icon={FiX} className="h-4 w-4" /></button>}
        </div>
        <span className="shrink-0 text-sm text-gray-500">{filteredPayments.length} of {payments.length}</span>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">{renderSortableHeader('display', 'Payment #')}</th>
                <th className="px-6 py-3 text-left">{renderSortableHeader('date', 'Date')}</th>
                <th className="px-6 py-3 text-left">{renderSortableHeader('client', 'Client')}</th>
                <th className="px-6 py-3 text-left">{renderSortableHeader('retreat', 'Retreat')}</th>
                <th className="px-6 py-3 text-left">{renderSortableHeader('booking', 'Booking #')}</th>
                <th className="px-6 py-3 text-left">{renderSortableHeader('request', 'Payment Request')}</th>
                <th className="px-6 py-3 text-left">{renderSortableHeader('amount', 'Amount')}</th>
                <th className="px-6 py-3 text-left">{renderSortableHeader('usd', 'USD')}</th>
                <th className="px-6 py-3 text-left">{renderSortableHeader('method', 'Method')}</th>
                <th className="px-6 py-3 text-left">{renderSortableHeader('status', 'Status')}</th>
                <th className="px-6 py-3 text-left">{renderSortableHeader('type', 'Type')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedPayments.map((payment) => (
                <tr key={payment._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                    {payment._id ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/payments/${payment._id}`)}
                        className="font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                        title="Open payment"
                      >
                        {payment.display_id ? `#${payment.display_id}` : payment._id.slice(-8)}
                      </button>
                    ) : (
                      payment.display_id ? `#${payment.display_id}` : '-'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCalendarDate(payment.paymentDate)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {payment.clientDisplayId && payment.clientId ? (
                      <Link
                        to={`/admin/clients/${payment.clientId}`}
                        className="mr-2 font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                        title="Open client profile"
                      >
                        #{payment.clientDisplayId}
                      </Link>
                    ) : payment.clientDisplayId ? (
                      <span className="mr-2 font-semibold text-blue-600">#{payment.clientDisplayId}</span>
                    ) : null}
                    {payment.clientName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {payment.retreatName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {payment.bookingNumber && payment.bookingId ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/bookings/${payment.bookingId}`)}
                        className="font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                        title="Open booking"
                      >
                        #{payment.bookingNumber}
                      </button>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {payment.paymentRequestId ? (() => {
                      const request = payment.paymentRequestId;
                      const requestId = typeof request === 'string' ? request : request._id;
                      const label = typeof request === 'string'
                        ? `#${request.slice(-8)}`
                        : request.invoiceNumber || (request.display_id ? `#${request.display_id}` : `#${request._id?.slice(-8) || ''}`);
                      return requestId ? <Link to={`/admin/payment-requests/${requestId}`} className="font-semibold text-blue-600 hover:underline">{label}</Link> : label;
                    })() : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <CurrencyDisplay amount={payment.amount} currency={payment.currency} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {payment.usd_amount !== undefined ? <CurrencyDisplay amount={payment.usd_amount} currency="USD" /> : '-'}
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
                        onClick={() => handleEdit(payment)}
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
          {sortedPayments.length === 0 && (
            <div className="text-center py-8 text-gray-500">{searchTerm ? 'No payments match your search' : 'No payments found'}</div>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-gray-700">
          Showing {filteredPayments.length} payment{filteredPayments.length !== 1 ? 's' : ''}{searchTerm ? ` of ${payments.length}` : ''}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-700">Total: {totalCompleted} completed</div>
          <div className="text-sm text-gray-700">Pending: {totalPending}</div>
        </div>
      </div>

    </div>
  );
};

export default PaymentsPage;
