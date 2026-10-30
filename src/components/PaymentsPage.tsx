import {emptyPaymentFilters,readPaymentFilters,paymentFilterError,paymentMatchesFilters,paymentRecordId,paymentConfirmationPath} from './paymentListFilters';
import { ChevronDown, DollarSign, Edit2, Plus, Search as SearchIcon, Trash2, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { paymentsApi, clientsApi, retreatsApi, bookingsApi } from '../services/api';
import { Payment, Client, Retreat, RetreatClient } from '../types';
import CurrencyDisplay from './CurrencyDisplay';
import ClientAvatar from './ClientAvatar';
import LoadingSpinner from './LoadingSpinner';
import { formatCalendarDate, parseCalendarDate } from '../utils/dateFormat';
import { apiErrorMessage } from '../utils/apiErrorMessage';
import { useToast } from '../hooks/useToast';
import Toast from './Toast';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

interface PaymentWithDetails extends Payment {
  clientName?: string;
  clientDisplayId?: number;
  retreatName?: string;
  bookingNumber?: number;
  bookingAvailable?: boolean;
  canConfirmBooking?: boolean;
  clientEmail?: string;
  clientPhone?: string;
  clientRecord?: Client;
}

type PaymentSortKey = 'display' | 'date' | 'client' | 'retreat' | 'booking' | 'request' | 'amount' | 'usd' | 'method' | 'status' | 'type';
type SortDirection = 'asc' | 'desc';

const getRetreatCode = (retreat?: Retreat) => {
  if (!retreat) return 'Unknown Retreat';
  return retreat.retreatCode || retreat.code || retreat.name || 'Unknown Retreat';
};

const PaymentsPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast, showSuccess, showError, dismiss: dismissToast } = useToast();
  const [payments, setPayments] = useState<PaymentWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortKey, setSortKey] = useState<PaymentSortKey>('display');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [params,setParams] = useSearchParams();
  const location=useLocation();
  const filters=useMemo(()=>readPaymentFilters(params),[params]);
  const searchTerm=filters.q;
  const filterError=paymentFilterError(filters);
  const hasFilters=Object.values(filters).some(Boolean);
  const paramsRef=useRef(params);
  useEffect(()=>{paramsRef.current=params;},[params]);
  const updateFilters=(changes:Partial<typeof filters>)=>{const next=new URLSearchParams(paramsRef.current);for(const [key,value]of Object.entries(changes)){if(value)next.set(key,value);else next.delete(key);}paramsRef.current=next;setParams(next,{replace:true});};
  const setSearchTerm=(q:string)=>updateFilters({q});
  const [loadError,setLoadError]=useState('');

  const fetchPayments = useCallback(async () => {
    try {
      setIsLoading(true); setLoadError('');
      const [paymentsResponse, clientsResponse, retreatsResponse, bookingsResponse] = await Promise.all([
        paymentsApi.getAllFresh(),
        clientsApi.getAll(),
        retreatsApi.getAll(),
        bookingsApi.getAllFresh(),
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
        const clientId = paymentRecordId(payment.clientId);
        const retreatId = paymentRecordId(payment.retreatId);
        const bookingId = paymentRecordId(payment.bookingId);
        const client = (clientId ? clientsMap.get(clientId) : undefined) || (typeof payment.clientId === 'object' ? payment.clientId as Client : undefined);
        const retreat = retreatId ? retreatsMap.get(retreatId) : undefined;
        const booking = bookingId ? bookingsMap.get(bookingId) : undefined;

        return {
          ...payment,
          clientId,
          retreatId,
          bookingId,
          bookingAvailable: Boolean(booking),
          canConfirmBooking: Boolean(clientId && booking && paymentRecordId(booking.clientId)===clientId && !['cancelled','canceled','moved'].includes(booking.status || '')),
          clientName: client ? [client.firstName,client.lastName].filter(Boolean).join(' ') || 'Unknown Client' : 'Unknown Client',
          clientRecord: client,
          clientDisplayId: client?.display_id,
          clientEmail: client?.email,
          clientPhone: client?.phone,
          retreatName: retreatId ? getRetreatCode(retreat) : 'Client payment',
          bookingNumber: (typeof payment.bookingId === 'object' ? payment.bookingId?.bookingNumber : undefined) || booking?.bookingNumber,
        };
      });

      setPayments(enrichedPayments);
    } catch (error) {
      console.error('Error fetching payments:', error);
      setPayments([]);
      setLoadError(apiErrorMessage(error,'Could not load payments. Retry before reviewing missing links.'));
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
      showSuccess('Payment deleted.');
    } catch (error) {
      console.error('Error deleting payment:', error);
      showError(apiErrorMessage(error, 'Error deleting payment.'));
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
    if (filterError) return [];
    return payments.filter((payment) => {
      if (!paymentMatchesFilters(payment,filters)) return false;
      const receipt = typeof payment.receiptId === 'object' ? payment.receiptId : null;
      const haystack = [payment.display_id, payment._id, typeof payment.receiptId === 'string' ? payment.receiptId : receipt?._id, receipt?.payerName, receipt?.transactionReference, payment.clientDisplayId, payment.clientId, payment.clientName, payment.clientEmail, payment.clientPhone, payment.bookingNumber, payment.bookingId, payment.bookingHash, payment.retreatId, payment.retreatName, payment.paymentRequestId, typeof payment.paymentRequestId === 'object' ? payment.paymentRequestId?._id : payment.paymentRequestId, typeof payment.paymentRequestId === 'object' ? payment.paymentRequestId?.display_id : undefined, typeof payment.paymentRequestId === 'object' ? payment.paymentRequestId?.invoiceNumber : undefined, payment.transactionId, payment.transactionReference, payment.allocationGroupId, payment.payerName, payment.description, payment.notes, payment.status, payment.paymentMethod, payment.paymentType, payment.currency, payment.amount, payment.usd_amount, payment.paymentDate, payment.processedDate, payment.processedBy]
        .filter((value) => value !== undefined && value !== null).join(' ').toLowerCase();
      return terms.every((term) => haystack.includes(term.replace(/^#/, '')));
    });
  }, [payments, searchTerm, filters, filterError]);

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
        icon={ChevronDown}
        className={`h-3 w-3 transition-transform ${sortKey === key && sortDirection === 'asc' ? 'rotate-180' : ''} ${sortKey === key ? 'opacity-100' : 'opacity-35'}`}
      />
    </button>
  );

  if (isLoading) {
    return <LoadingSpinner message="Loading payments..." />;
  }

  return (
    <div className="p-6 h-full">
      <Toast toast={toast} onDismiss={dismissToast} />
      <div className="mb-6 flex flex-wrap items-start gap-4">
        <div className="flex-1 min-w-0 basis-52">
          <h1 className="text-2xl font-semibold text-gray-900">Payments</h1>
          <p className="text-sm text-gray-600">Manage client payments and invoice settlement records</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/payments/scratchpad" className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50">Scratchpad</Link>
          <button onClick={() => navigate('/admin/payments/receipts')} className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50">Receipts</button>
          <button onClick={() => navigate('/admin/payments/joint/new')} className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-blue-600 bg-white px-4 py-2 text-blue-700 hover:bg-blue-50"><Icon icon={Plus} className="w-4 h-4" />Joint / Split Payment</button>
          <button onClick={() => navigate('/admin/payments/new')} className="inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"><Icon icon={Plus} className="w-4 h-4" />Add Payment</button>
        </div>
      </div>

      <section aria-label="Payment filters" className="mb-4 space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Find payments to finish</h2><button type="button" className="rounded border px-3 py-2 text-sm disabled:opacity-40" disabled={!hasFilters} onClick={()=>updateFilters(emptyPaymentFilters)}>Clear all payment filters</button></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1 text-sm">Booking link<select className="rounded border p-2" value={filters.booking} onChange={e=>updateFilters({booking:e.target.value})}><option value="">All booking links</option><option value="without">Without a booking</option><option value="with">With a booking link</option><option value="unavailable">Booking record unavailable</option></select></label>
          <label className="grid gap-1 text-sm">Payment request link<select className="rounded border p-2" value={filters.request} onChange={e=>updateFilters({request:e.target.value})}><option value="">All PR links</option><option value="without">Without a PR</option><option value="with">With a PR</option></select></label>
          <label className="grid gap-1 text-sm">Payment status<select className="rounded border p-2" value={filters.status} onChange={e=>updateFilters({status:e.target.value})}><option value="">All statuses</option>{['completed','pending','failed','refunded'].map(v=><option key={v} value={v}>{v}</option>)}</select></label>
          <label className="grid gap-1 text-sm">Payment method<select className="rounded border p-2" value={filters.method} onChange={e=>updateFilters({method:e.target.value})}><option value="">All methods</option>{[...new Set([...payments.map(p=>p.paymentMethod),filters.method].filter(Boolean))].sort().map(v=><option key={v} value={v}>{v.replace(/_/g,' ')}</option>)}</select></label>
          <label className="grid gap-1 text-sm">Currency<select className="rounded border p-2" value={filters.currency} onChange={e=>updateFilters({currency:e.target.value})}><option value="">All currencies</option>{[...new Set([...payments.map(p=>p.currency),filters.currency].filter(Boolean))].sort().map(v=><option key={v} value={v}>{v}</option>)}</select></label>
          <label className="grid gap-1 text-sm">Payment date from<input type="date" className="rounded border p-2" value={filters.from} onChange={e=>updateFilters({from:e.target.value})}/></label>
          <label className="grid gap-1 text-sm">Payment date to<input type="date" className="rounded border p-2" value={filters.to} onChange={e=>updateFilters({to:e.target.value})}/></label>
          <label className="grid gap-1 text-sm">Minimum amount<input type="number" min="0" step="0.01" className="rounded border p-2" value={filters.min} onChange={e=>updateFilters({min:e.target.value})}/></label>
          <label className="grid gap-1 text-sm">Maximum amount<input type="number" min="0" step="0.01" className="rounded border p-2" value={filters.max} onChange={e=>updateFilters({max:e.target.value})}/></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={filters.repair==='yes'} onChange={e=>updateFilters({repair:e.target.checked?'yes':''})}/>Unfinished payment updates only</label>
        </div>
        <p className="text-xs text-gray-600">Combine filters with search. Dates include the whole day in UTC. Amount ranges use each payment’s currency; choose a currency to compare like amounts. Missing links do not change payment status.</p>
        {filterError&&<p role="alert" className="text-red-800">{filterError}</p>}
      </section>
      {loadError&&<p role="alert" aria-label="Payment load error" className="mb-4 rounded border border-red-200 p-3 text-red-800">{loadError} <button type="button" className="underline" onClick={()=>void fetchPayments()}>Retry payments</button></p>}
      <div className="workspace-mobile-sort"><label htmlFor="mobile-payment-sort">Sort by</label><select id="mobile-payment-sort" value={sortKey} onChange={event => setSortKey(event.target.value as PaymentSortKey)}><option value="display">Payment number</option><option value="date">Date</option><option value="client">Client</option><option value="retreat">Retreat</option><option value="booking">Booking</option><option value="request">Payment request</option><option value="amount">Amount</option><option value="usd">USD amount</option><option value="method">Method</option><option value="status">Status</option><option value="type">Type</option></select><button type="button" onClick={() => setSortDirection(value => value === 'asc' ? 'desc' : 'asc')} aria-label="Reverse payment sort order">{sortDirection === 'asc' ? '↑' : '↓'}</button></div>
      <div className="mb-4 flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <div className="relative min-w-0 flex-1">
          <Icon icon={SearchIcon} className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search client, client ID, booking, payment ID, reference, amount, status, notes..." className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-9 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" aria-label="Search payments" />
          {searchTerm && <button type="button" onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700" title="Clear search" aria-label="Clear payment search"><Icon icon={X} className="h-4 w-4" /></button>}
        </div>
        <span className="shrink-0 text-sm text-gray-500">{loadError ? 'Results unavailable' : `${filteredPayments.length} of ${payments.length}`}</span>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="workspace-finance-table min-w-full divide-y divide-gray-200">
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
                  <td data-label="Payment" className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
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
                    {payment.allocationGroupId && <div className="mt-1 text-xs font-medium text-violet-700">Joint payment {payment.allocationIndex || '?'} of {payment.allocationCount || '?'}</div>}
                    {payment.receiptId && <div className="mt-1 text-xs text-gray-500">Receipt {typeof payment.receiptId === 'string' ? payment.receiptId.slice(-8) : payment.receiptId._id?.slice(-8)}</div>}
                  </td>
                  <td data-label="Date" className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCalendarDate(payment.paymentDate)}
                  </td>
                  <td data-label="Client" className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center gap-2">
                      <ClientAvatar client={payment.clientRecord} name={payment.clientName || ''} />
                      <span>
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
                      </span>
                    </div>
                  </td>
                  <td data-label="Retreat" className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span>{payment.retreatName}</span>
                    {payment.description && <div className="max-w-xs whitespace-normal text-xs text-gray-500">{payment.description}</div>}
                  </td>
                  <td data-label="Booking" className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
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
                      'Not linked to a booking'
                    )}
                  </td>
                  <td data-label="Payment request" className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {payment.paymentRequestId ? (() => {
                      const request = payment.paymentRequestId;
                      const requestId = typeof request === 'string' ? request : request._id;
                      const label = typeof request === 'string'
                        ? `#${request.slice(-8)}`
                        : request.invoiceNumber || (request.display_id ? `#${request.display_id}` : `#${request._id?.slice(-8) || ''}`);
                      return requestId ? <Link to={`/admin/payment-requests/${requestId}`} className="font-semibold text-blue-600 hover:underline">{label}</Link> : label;
                    })() : '-'}
                  </td>
                  <td data-label="Amount" className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <CurrencyDisplay amount={payment.amount} currency={payment.currency} />
                    {payment.requestCurrency && payment.requestCurrency !== payment.currency && payment.requestCurrencyAmount !== undefined && <div className="mt-1 whitespace-normal text-xs text-slate-600"><CurrencyDisplay amount={payment.requestCurrencyAmount} currency={payment.requestCurrency} /> credited to request<div>{payment.requestCurrencyExchangeSource} · {payment.requestCurrencyExchangeDate ? new Date(payment.requestCurrencyExchangeDate).toISOString().slice(0, 10) : ''}</div></div>}
                  </td>
                  <td data-label="USD equivalent" className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {payment.usd_amount !== undefined ? <CurrencyDisplay amount={payment.usd_amount} currency="USD" /> : '-'}
                  </td>
                  <td data-label="Method" className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {payment.paymentMethod.replace(/_/g, ' ')}
                  </td>
                  <td data-label="Status" className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(payment.status)}`}>
                      {payment.status}
                    </span>
                  </td>
                  <td data-label="Type" className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {payment.paymentType?.replace(/_/g, ' ') || 'regular'}
                  </td>
                  <td data-label="Actions" className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex flex-wrap items-center gap-2">
                      {payment.canConfirmBooking ? <Link className="rounded border border-blue-300 px-3 py-2 text-blue-700" to={paymentConfirmationPath(payment.bookingId as string,location.pathname+location.search)}>Booking confirmation</Link> : payment.bookingId ? <Link className="text-amber-800 underline" to={`/admin/payments/${payment._id}/edit`}>Review booking link</Link> : <Link className="rounded border px-3 py-2 text-blue-700" to={`/admin/payments/${payment._id}/edit`}>Create / link booking</Link>}
                      <button
                        onClick={() => handleEdit(payment)}
                        className="text-indigo-600 hover:text-indigo-900"
                        title="Edit"
                      >
                        <Icon icon={Edit2} className="w-4 h-4" />
                      </button>
                      {payment.status === 'completed' && !payment.isRefundable && (
                        <button
                          onClick={() => console.log('Refund payment:', payment._id)}
                          className="text-yellow-600 hover:text-yellow-900"
                          title="Refund"
                        >
                          <Icon icon={DollarSign} className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(payment._id!)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete"
                      >
                        <Icon icon={Trash2} className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loadError && sortedPayments.length === 0 && (
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
