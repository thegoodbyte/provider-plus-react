import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, FileText, RefreshCw, Search, SlidersHorizontal } from 'lucide-react';
import { bookingDocumentsApi } from '../services/api';
import { BookingDocument, Client, Retreat, RetreatClient } from '../types';

const normalizeKey = (value?: string) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const formatDate = (value?: Date | string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

const formatBytes = (size?: number) => {
  if (!size) return '-';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

const getBookingId = (booking?: string | RetreatClient) => {
  if (!booking) return '';
  return typeof booking === 'string' ? booking : booking._id || '';
};

const getBookingLabel = (booking?: string | RetreatClient) => {
  if (!booking) return '-';
  if (typeof booking === 'string') return booking.slice(-8);
  return booking.bookingNumber ? `#${booking.bookingNumber}` : booking._id ? `#${booking._id.slice(-8)}` : '-';
};

const getClientLabel = (client?: string | Client) => {
  if (!client) return '-';
  if (typeof client === 'string') return client.slice(-8);
  const name = [client.firstName || client.fname, client.lastName || client.lname].filter(Boolean).join(' ');
  return name || client.email || (client.display_id ? `#${client.display_id}` : client._id?.slice(-8)) || '-';
};

const getRetreatLabel = (retreat?: string | Retreat) => {
  if (!retreat) return '-';
  if (typeof retreat === 'string') return retreat.slice(-8);
  return retreat.name || retreat.code || retreat.retreatCode || retreat._id?.slice(-8) || '-';
};

const titleize = (value: string) => value
  .split(/[_-]+/)
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

const BookingDocumentsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const routePrefix = location.pathname.split('/').filter(Boolean)[0] || 'admin';
  const [documents, setDocuments] = useState<BookingDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const loadDocuments = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await bookingDocumentsApi.getAll();
      setDocuments(response.data || []);
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || loadError?.message || 'Unable to load booking documents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const documentTypes = useMemo(() => {
    return Array.from(new Set(documents.map((document) => normalizeKey(document.documentType)).filter(Boolean))).sort();
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return documents.filter((document) => {
      const type = normalizeKey(document.documentType);
      if (typeFilter !== 'all' && type !== typeFilter) return false;

      if (!normalizedQuery) return true;
      const haystack = [
        document.display_id,
        document.title,
        document.description,
        document.documentType,
        document.status,
        getBookingLabel(document.bookingId),
        getClientLabel(document.clientId),
        getRetreatLabel(document.retreatId),
        ...(document.files || []).map((file) => file.fileName || file.s3Key || file.filePath || ''),
      ].join(' ').toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [documents, query, typeFilter]);

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Uploaded Booking Documents</h1>
          <p className="mt-1 text-sm text-gray-600">All files uploaded under booking documents, including contracts, questionnaires, medication forms, and food forms.</p>
        </div>
        <button
          type="button"
          onClick={loadDocuments}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="mb-4 grid gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_220px]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search booking #, client, retreat, document title, or file name"
            className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <label className="relative block">
          <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">All document types</option>
            {documentTypes.map((type) => (
              <option key={type} value={type}>{titleize(type)}</option>
            ))}
          </select>
        </label>
      </div>

      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-4 py-3 text-sm text-gray-600">
          {loading ? 'Loading booking documents...' : `${filteredDocuments.length} uploaded document${filteredDocuments.length === 1 ? '' : 's'}`}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Document</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Booking</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Client</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Retreat</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Received</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Files</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {!loading && filteredDocuments.map((document) => {
                const bookingId = getBookingId(document.bookingId);
                return (
                  <tr key={document._id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 align-top">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-md bg-blue-50 p-2 text-blue-700">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">{document.title || titleize(document.documentType)}</div>
                          <div className="mt-1 text-xs text-gray-500">#{document.display_id || document._id?.slice(-8)} · {titleize(document.documentType)}</div>
                          {document.description && <div className="mt-1 max-w-md text-xs text-gray-500">{document.description}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-sm">
                      {bookingId ? (
                        <button type="button" className="font-semibold text-blue-700 hover:text-blue-900" onClick={() => navigate(`/${routePrefix}/bookings/${bookingId}`)}>
                          {getBookingLabel(document.bookingId)}
                        </button>
                      ) : (
                        <span className="text-gray-500">{getBookingLabel(document.bookingId)}</span>
                      )}
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-gray-900">{getClientLabel(document.clientId)}</td>
                    <td className="px-4 py-4 align-top text-sm text-gray-900">{getRetreatLabel(document.retreatId)}</td>
                    <td className="px-4 py-4 align-top text-sm text-gray-600">{formatDate(document.receivedAt || document.createdAt)}</td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-col gap-2">
                        {(document.files || []).length === 0 && <span className="text-sm text-gray-400">No files</span>}
                        {(document.files || []).map((file, index) => (
                          <button
                            key={`${document._id}-${file.s3Key || file.filePath || file.fileName || index}`}
                            type="button"
                            onClick={() => file.url && window.open(file.url, '_blank', 'noopener,noreferrer')}
                            disabled={!file.url}
                            className="inline-flex max-w-xs items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                            title={file.url ? 'Open uploaded file' : 'File URL unavailable'}
                          >
                            <Eye className="h-3.5 w-3.5 flex-none" />
                            <span className="truncate">{file.fileName || 'Uploaded file'}</span>
                            <span className="flex-none text-gray-400">({formatBytes(file.size)})</span>
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && filteredDocuments.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">
                    No uploaded booking documents found.
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

export default BookingDocumentsPage;
