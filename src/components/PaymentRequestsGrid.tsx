import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { paymentRequestsApi } from '../services/api';
import { API_BASE_URL } from '../config/api.config';
import LoadingSpinner from './LoadingSpinner';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiCheckCircle, FiClock, FiAlertTriangle, FiSend, FiDollarSign, FiChevronDown, FiEye, FiCopy, FiExternalLink } from 'react-icons/fi';
import EmailComposeModal, { EmailComposeInitialValues } from './EmailComposeModal';
import { formatCalendarDate, parseCalendarDate } from '../utils/dateFormat';
import { paymentRequestFinancialSummary } from './bookingFinancialSummary';
import { getIbogaReadyPaymentUrl, getPolishWebsitePaymentUrl, getPreferredPaymentUrl } from './paymentRequestLinks';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

const resolveClient = (clientValue: any) => {
  if (!clientValue) return { id: '', name: 'Unknown Client', displayId: '', email: '', firstName: '', language: 'en' };
  if (typeof clientValue === 'string') return { id: clientValue, name: clientValue, displayId: '', email: '', firstName: '', language: 'en' };
  return {
    id: clientValue._id || clientValue.id || '',
    name: `${clientValue.firstName || ''} ${clientValue.lastName || ''}`.trim() || 'Unknown Client',
    displayId: clientValue.display_id ? `#${clientValue.display_id}` : '',
    email: clientValue.email || '',
    firstName: clientValue.firstName || '',
    language: clientValue.preferredLanguage || clientValue.preferred_language || clientValue.language || 'en',
  };
};

const resolveRetreat = (retreatValue: any) => {
  if (!retreatValue) return 'Unknown Retreat';
  if (typeof retreatValue === 'string') return retreatValue;
  return retreatValue.retreatCode || retreatValue.code || retreatValue.name || 'Unknown Retreat';
};

const getPublicPaymentApiUrl = (request: any) => (
  request?.publicHash ? `${API_BASE_URL}/public/invoices/${request.publicHash}` : ''
);

const formatAmount = (amount: any, currency: string) => {
  const numericAmount = Number(amount || 0);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) return '';
  return `${numericAmount.toLocaleString()} ${currency || ''}`.trim();
};

type PaymentRequestSortKey = 'invoice' | 'client' | 'retreat' | 'date' | 'paidDate' | 'quote' | 'usd' | 'currency' | 'status';
type SortDirection = 'asc' | 'desc';

const PaymentRequestsGrid: React.FC = () => {
  const navigate = useNavigate();
  const [paymentRequests, setPaymentRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSendRequest, setSelectedSendRequest] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<PaymentRequestSortKey>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const fetchPaymentRequests = async () => {
    try {
      setLoading(true);
      const response = await paymentRequestsApi.getAllFresh();
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

  const handleSendPaymentRequest = (request: any) => {
    if (!request.publicHash) {
      alert('This payment request does not have a public hash yet. Open and save it once, then send it.');
      return;
    }
    setSelectedSendRequest(request);
  };

  const copyToClipboard = async (value: string) => {
    await navigator.clipboard.writeText(value);
    alert('Copied.');
  };

  const buildPaymentEmail = (request: any): EmailComposeInitialValues => {
    const client = resolveClient(request.clientId);
    const retreat = resolveRetreat(request.retreatId);
    const paymentUrl = getPreferredPaymentUrl(request);
    const invoiceNumber = request.invoiceNumber || request.display_id || request._id;
    const financials = paymentRequestFinancialSummary(request);
    const requestedAmount = formatAmount(financials.requested, financials.currency);
    const totalAmount = formatAmount(financials.quotedPrice, financials.currency);
    const greetingName = client.firstName || client.name || 'there';

    return {
      to: client.email,
      subject: `Payment request ${invoiceNumber}`,
      bodyText: [
        `Hi ${greetingName},`,
        '',
        `Your payment request for ${retreat} is ready.`,
        ...(requestedAmount ? [`Requested amount: ${requestedAmount}`] : []),
        ...(totalAmount ? [`Total retreat price: ${totalAmount}`] : []),
        '',
        'Please open the secure link below to review the payment request and complete the required confirmations before payment:',
        paymentUrl,
        '',
        'Thank you,',
        'Iboga Spirit',
      ].join('\n'),
      clientId: typeof request.clientId === 'string' ? request.clientId : request.clientId?._id,
      retreatId: typeof request.retreatId === 'string' ? request.retreatId : request.retreatId?._id,
      relatedEntityType: 'payment_request',
      relatedEntityId: request._id,
      templateKey: 'payment_request_due',
      requestedLanguage: client.language,
      variables: {
        client: { ...client, fullName: client.name },
        retreat: { code: retreat },
        paymentRequest: request,
        paymentUrl,
        paymentApiUrl: getPublicPaymentApiUrl(request),
      },
    };
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
        (request.publicHash || '').toLowerCase().includes(term) ||
        (request.note || request.notes || '').toLowerCase().includes(term)
      );
    });
  }, [paymentRequests, searchTerm]);

  const getSortValue = (request: any, key: PaymentRequestSortKey) => {
    const client = resolveClient(request.clientId);
    const retreat = resolveRetreat(request.retreatId);

    switch (key) {
      case 'invoice':
        return Number(request.display_id || request.invoiceNumber) || String(request.invoiceNumber || '').toLowerCase();
      case 'client':
        return client.name.toLowerCase();
      case 'retreat':
        return retreat.toLowerCase();
      case 'date':
        return parseCalendarDate(request.paymentDate)?.getTime() || 0;
      case 'paidDate':
        return parseCalendarDate(request.paidDate)?.getTime() || 0;
      case 'quote':
        return paymentRequestFinancialSummary(request).quotedPrice;
      case 'usd':
        return Number(request.usd_amount || 0);
      case 'currency':
        return String(request.currency || '').toLowerCase();
      case 'status':
        return String(request.status || '').toLowerCase();
      default:
        return '';
    }
  };

  const sortedRequests = useMemo(() => {
    return [...filteredRequests].sort((a, b) => {
      const aValue = getSortValue(a, sortKey);
      const bValue = getSortValue(b, sortKey);
      const direction = sortDirection === 'asc' ? 1 : -1;

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return (aValue - bValue) * direction;
      }

      return String(aValue).localeCompare(String(bValue), undefined, { numeric: true, sensitivity: 'base' }) * direction;
    });
  }, [filteredRequests, sortDirection, sortKey]);

  const handleSort = (key: PaymentRequestSortKey) => {
    if (sortKey === key) {
      setSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc');
      return;
    }

    setSortKey(key);
    setSortDirection(key === 'date' || key === 'invoice' || key === 'quote' || key === 'usd' ? 'desc' : 'asc');
  };

  const renderSortableHeader = (key: PaymentRequestSortKey, label: string) => (
    <button
      type="button"
      onClick={() => handleSort(key)}
      className="inline-flex items-center gap-1 text-xs font-medium uppercase text-gray-500 hover:text-gray-900"
    >
      {label}
      <Icon
        icon={FiChevronDown}
        className={`h-3 w-3 transition-transform ${sortKey === key && sortDirection === 'asc' ? 'rotate-180' : ''} ${sortKey === key ? 'opacity-100' : 'opacity-35'}`}
      />
    </button>
  );

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
                <th className="px-4 py-3 text-left">{renderSortableHeader('invoice', 'Invoice #')}</th>
                <th className="w-44 px-3 py-3 text-left">{renderSortableHeader('client', 'Client')}</th>
                <th className="px-4 py-3 text-left">{renderSortableHeader('retreat', 'Retreat')}</th>
                <th className="px-4 py-3 text-left">{renderSortableHeader('date', 'Request Date')}</th>
                <th className="px-4 py-3 text-left">{renderSortableHeader('paidDate', 'Paid Date')}</th>
                <th className="px-4 py-3 text-left">{renderSortableHeader('quote', 'Quote')}</th>
                <th className="px-4 py-3 text-left">{renderSortableHeader('usd', 'USD')}</th>
                <th className="px-4 py-3 text-left">{renderSortableHeader('currency', 'Currency')}</th>
                <th className="px-4 py-3 text-left">{renderSortableHeader('status', 'Status')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedRequests.map((request) => {
                const client = resolveClient(request.clientId);
                const retreat = resolveRetreat(request.retreatId);
                return (
                  <tr key={request._id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/payment-requests/${request._id}`)}
                        className="font-semibold text-gray-900 hover:underline"
                        title="View payment request"
                      >
                        {request.invoiceNumber || (request.display_id ? `#${request.display_id}` : 'n/a')}
                      </button>
                    </td>
                    <td className="w-44 max-w-44 px-3 py-4">
                      <div className="truncate font-medium text-gray-900" title={client.name}>{client.name}</div>
                      {client.displayId && (
                        <div className="mt-1 text-xs font-semibold">
                          {client.id ? (
                            <Link
                              to={`/admin/clients/${client.id}`}
                              className="text-blue-700 hover:text-blue-900 hover:underline"
                              title="Open client profile"
                            >
                              {client.displayId}
                            </Link>
                          ) : (
                            <span className="text-blue-700">{client.displayId}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{retreat}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                      {formatCalendarDate(request.paymentDate)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                      {request.paidDate ? formatCalendarDate(request.paidDate) : '-'}
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
                    <td className="sticky right-0 whitespace-nowrap border-l border-gray-100 bg-white px-2 py-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => navigate(`/admin/payments/new?paymentRequestId=${request._id}`, { state: { returnTo: '/admin/payment-requests' } })}
                          className="icon-action-btn icon-action-btn-success"
                          title="Add payment from this request"
                        >
                          <Icon icon={FiDollarSign} />
                        </button>
                        <button
                          onClick={() => handleSendPaymentRequest(request)}
                          className="icon-action-btn icon-action-btn-view disabled:opacity-50"
                          title="Compose payment request email"
                        >
                          <Icon icon={FiSend} />
                        </button>
                        <button
                          onClick={() => navigate(`/admin/payment-requests/${request._id}`)}
                          className="icon-action-btn icon-action-btn-view"
                          title="View"
                        >
                          <Icon icon={FiEye} />
                        </button>
                        <button
                          onClick={() => navigate(`/admin/payment-requests/${request._id}/edit`)}
                          className="icon-action-btn icon-action-btn-edit"
                          title="Edit"
                        >
                          <Icon icon={FiEdit2} />
                        </button>
                        <button
                          onClick={() => handleDelete(request._id)}
                          className="icon-action-btn icon-action-btn-danger"
                          title="Delete"
                        >
                          <Icon icon={FiTrash2} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {sortedRequests.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-gray-500">
                    {searchTerm ? 'No payment requests found matching your search' : 'No payment requests found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedSendRequest && (
        <EmailComposeModal
          title="Send Payment Request"
          initialValues={buildPaymentEmail(selectedSendRequest)}
          onClose={() => setSelectedSendRequest(null)}
          onSent={async () => {
            await paymentRequestsApi.update(selectedSendRequest._id, {
              status: 'sent',
              sentAt: new Date().toISOString(),
              sentToClient: true,
            });
            await fetchPaymentRequests();
          }}
          extraContent={selectedSendRequest.publicHash ? (
            <div className="space-y-3 rounded-md border border-blue-100 bg-blue-50 p-3">
              <div>
                <div className="mb-1 text-xs font-semibold uppercase text-blue-800">IbogaReady client URL</div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    readOnly
                    value={getIbogaReadyPaymentUrl(selectedSendRequest)}
                    className="min-w-0 flex-1 rounded-md border border-blue-200 bg-white px-3 py-2 text-xs text-gray-800"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(getIbogaReadyPaymentUrl(selectedSendRequest))}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    <Icon icon={FiCopy} className="h-4 w-4" />
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={() => window.open(getIbogaReadyPaymentUrl(selectedSendRequest), '_blank', 'noopener,noreferrer')}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-blue-200 bg-white px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50"
                  >
                    <Icon icon={FiExternalLink} className="h-4 w-4" />
                    Open
                  </button>
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold uppercase text-blue-800">Polish ISCZ website URL</div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input readOnly value={getPolishWebsitePaymentUrl(selectedSendRequest)} className="min-w-0 flex-1 rounded-md border border-blue-200 bg-white px-3 py-2 text-xs text-gray-800" />
                  <button type="button" onClick={() => copyToClipboard(getPolishWebsitePaymentUrl(selectedSendRequest))} className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"><Icon icon={FiCopy} className="h-4 w-4" />Copy</button>
                  <button type="button" onClick={() => window.open(getPolishWebsitePaymentUrl(selectedSendRequest), '_blank', 'noopener,noreferrer')} className="inline-flex items-center justify-center gap-2 rounded-md border border-blue-200 bg-white px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50"><Icon icon={FiExternalLink} className="h-4 w-4" />Open</button>
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold uppercase text-blue-800">API</div>
                <input
                  readOnly
                  value={`GET ${getPublicPaymentApiUrl(selectedSendRequest)}`}
                  className="w-full rounded-md border border-blue-200 bg-white px-3 py-2 text-xs text-gray-800"
                />
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              This payment request does not have a public hash yet. Open and save it once, then use this send button again.
            </div>
          )}
        />
      )}
    </div>
  );
};

export default PaymentRequestsGrid;
