import React, { useEffect, useMemo, useState } from 'react';
import { FiSearch, FiX } from 'react-icons/fi';
import { paymentRequestsApi } from '../services/api';
import { PaymentRequest, Client, Retreat } from '../types';

type PaymentRequestOption = PaymentRequest & {
  clientId?: string | Client;
  retreatId?: string | Retreat;
};

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

interface Props {
  selectedPaymentRequestId?: string;
  onPaymentRequestSelect: (paymentRequestId: string, paymentRequest?: PaymentRequestOption) => void;
  placeholder?: string;
  className?: string;
  clientId?: string;
  retreatId?: string;
}

const resolveClient = (clientValue: any) => {
  if (!clientValue) return 'Unknown Client';
  if (typeof clientValue === 'string') return clientValue;
  return `${clientValue.firstName || ''} ${clientValue.lastName || ''}`.trim() || 'Unknown Client';
};

const resolveRetreat = (retreatValue: any) => {
  if (!retreatValue) return 'Unknown Retreat';
  if (typeof retreatValue === 'string') return retreatValue;
  return [retreatValue.name, retreatValue.location].filter(Boolean).join(' - ') || 'Unknown Retreat';
};

const resolveId = (value: any) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value._id || value.id || '';
};

const SearchablePaymentRequestSelect: React.FC<Props> = ({
  selectedPaymentRequestId = '',
  onPaymentRequestSelect,
  placeholder = 'Search invoice, client, or retreat',
  className = '',
  clientId,
  retreatId,
}) => {
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequestOption[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const loadPaymentRequests = async () => {
      try {
        const response = await paymentRequestsApi.getAll();
        setPaymentRequests(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        console.error('Error loading payment requests:', error);
        setPaymentRequests([]);
      }
    };

    loadPaymentRequests();
  }, []);

  const selectedRequest = useMemo(
    () => paymentRequests.find((request) => request._id === selectedPaymentRequestId),
    [paymentRequests, selectedPaymentRequestId],
  );

  const filteredRequests = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return paymentRequests.filter((request) => {
      if (clientId && resolveId(request.clientId) !== clientId) return false;
      if (retreatId && resolveId(request.retreatId) !== retreatId) return false;
      if (!term) return true;

      const invoice = String(request.invoiceNumber || request.display_id || '').toLowerCase();
      const client = resolveClient(request.clientId).toLowerCase();
      const retreat = resolveRetreat(request.retreatId).toLowerCase();
      return (
        invoice.includes(term) ||
        client.includes(term) ||
        retreat.includes(term) ||
        String(request.paymentDate || '').toLowerCase().includes(term) ||
        String(request.currency || '').toLowerCase().includes(term) ||
        String(request.fullPriceQuote || '').toLowerCase().includes(term)
      );
    });
  }, [paymentRequests, searchTerm, clientId, retreatId]);

  const handleSelect = (request: PaymentRequestOption) => {
    onPaymentRequestSelect(request._id || '', request);
    setSearchTerm('');
    setOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="w-full flex items-center justify-between gap-3 px-3 py-2 border border-gray-300 rounded-md bg-white text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <span className={selectedRequest ? 'text-gray-900' : 'text-gray-400'}>
          {selectedRequest
            ? `${selectedRequest.invoiceNumber || `#${selectedRequest.display_id || 'n/a'}`} - ${resolveClient(selectedRequest.clientId)}`
            : placeholder}
        </span>
        <span className="text-gray-400">{open ? <Icon icon={FiX} /> : <Icon icon={FiSearch} />}</span>
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-full rounded-md border border-gray-200 bg-white shadow-lg">
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Icon icon={FiSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={placeholder}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {filteredRequests.length === 0 ? (
              <div className="px-3 py-4 text-sm text-gray-500">No payment requests found</div>
            ) : (
              filteredRequests.map((request) => (
                <button
                  key={request._id}
                  type="button"
                  onClick={() => handleSelect(request)}
                  className="w-full text-left px-3 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900">
                        {request.invoiceNumber || `#${request.display_id || 'n/a'}`}
                      </div>
                      <div className="text-sm text-gray-600">
                        {resolveClient(request.clientId)} - {resolveRetreat(request.retreatId)}
                      </div>
                    </div>
                    <div className="shrink-0 text-sm text-gray-500">
                      {request.fullPriceQuote} {request.currency}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchablePaymentRequestSelect;
