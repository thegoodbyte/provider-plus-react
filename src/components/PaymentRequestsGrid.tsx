import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { paymentRequestsApi } from '../services/api';
import { API_BASE_URL } from '../config/api.config';
import LoadingSpinner from './LoadingSpinner';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiCheckCircle, FiClock, FiAlertTriangle, FiSend, FiCopy, FiExternalLink, FiDollarSign } from 'react-icons/fi';
import EmailComposeModal, { EmailComposeInitialValues } from './EmailComposeModal';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

const resolveClient = (clientValue: any) => {
  if (!clientValue) return { name: 'Unknown Client', displayId: '', email: '', firstName: '' };
  if (typeof clientValue === 'string') return { name: clientValue, displayId: '', email: '', firstName: '' };
  return {
    name: `${clientValue.firstName || ''} ${clientValue.lastName || ''}`.trim() || 'Unknown Client',
    displayId: clientValue.display_id ? `#${clientValue.display_id}` : '',
    email: clientValue.email || '',
    firstName: clientValue.firstName || '',
  };
};

const resolveRetreat = (retreatValue: any) => {
  if (!retreatValue) return 'Unknown Retreat';
  if (typeof retreatValue === 'string') return retreatValue;
  return retreatValue.retreatCode || retreatValue.code || retreatValue.name || 'Unknown Retreat';
};

const getPublicPaymentUrl = (request: any) => (
  request?.publicHash ? `https://ibogaspirit.com/clients/payment/request/${request.publicHash}` : ''
);

const getPublicPaymentApiUrl = (request: any) => (
  request?.publicHash ? `${API_BASE_URL}/public/invoices/${request.publicHash}` : ''
);

const formatAmount = (amount: any, currency: string) => {
  const numericAmount = Number(amount || 0);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) return '';
  return `${numericAmount.toLocaleString()} ${currency || ''}`.trim();
};

const PaymentRequestsGrid: React.FC = () => {
  const navigate = useNavigate();
  const [paymentRequests, setPaymentRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSendRequest, setSelectedSendRequest] = useState<any | null>(null);
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
    const paymentUrl = getPublicPaymentUrl(request);
    const invoiceNumber = request.invoiceNumber || request.display_id || request._id;
    const requestedAmount = formatAmount(request.requestedAmount || request.amountPaid || request.fullPriceQuote, request.currency);
    const totalAmount = formatAmount(request.fullPriceQuote || request.fullPrice || request.fullPriceQuote, request.currency);
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
      variables: {
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Public Hash</th>
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
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/payment-requests/${request._id}`)}
                        className="font-semibold text-gray-900 hover:underline"
                        title="View payment request"
                      >
                        {request.invoiceNumber || (request.display_id ? `#${request.display_id}` : 'n/a')}
                      </button>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{client.name}</div>
                      {client.displayId && (
                        <div className="mt-1 text-xs font-semibold text-blue-700">{client.displayId}</div>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{retreat}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                      {request.paymentDate ? new Date(request.paymentDate).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {request.publicHash ? (
                        <div className="flex items-center gap-2">
                          <code className="rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-800">
                            {request.publicHash}
                          </code>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(request.publicHash)}
                            className="icon-action-btn icon-action-btn-view"
                            title="Copy hash"
                          >
                            <Icon icon={FiCopy} />
                          </button>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(getPublicPaymentApiUrl(request))}
                            className="icon-action-btn icon-action-btn-view"
                            title="Copy agreement API URL"
                          >
                            API
                          </button>
                          <button
                            type="button"
                            onClick={() => window.open(getPublicPaymentUrl(request), '_blank', 'noopener,noreferrer')}
                            className="icon-action-btn icon-action-btn-view"
                            title="Open client payment form"
                          >
                            <Icon icon={FiExternalLink} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-amber-700">Save once to generate</span>
                      )}
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
              {filteredRequests.length === 0 && (
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
                <div className="mb-1 text-xs font-semibold uppercase text-blue-800">Client URL</div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    readOnly
                    value={getPublicPaymentUrl(selectedSendRequest)}
                    className="min-w-0 flex-1 rounded-md border border-blue-200 bg-white px-3 py-2 text-xs text-gray-800"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(getPublicPaymentUrl(selectedSendRequest))}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    <Icon icon={FiCopy} className="h-4 w-4" />
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={() => window.open(getPublicPaymentUrl(selectedSendRequest), '_blank', 'noopener,noreferrer')}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-blue-200 bg-white px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50"
                  >
                    <Icon icon={FiExternalLink} className="h-4 w-4" />
                    Open
                  </button>
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
