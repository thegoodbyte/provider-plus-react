import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpDown, ClipboardList, Download, Eye, FileText, Pencil, Pill, RefreshCw, Scale, Search, Trash2, Utensils, X } from 'lucide-react';
import { bookingDocumentsApi } from '../services/api';
import { BookingDocument, Client, Retreat, RetreatClient } from '../types';

type SortKey = 'receivedAt' | 'documentType' | 'booking' | 'client' | 'retreat';
type SortDirection = 'asc' | 'desc';
type BookingDocumentFile = NonNullable<BookingDocument['files']>[number];

const normalizeKey = (value?: string) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const formatBytes = (size?: number) => {
  if (!size) return '-';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

const formatDateOnly = (value?: Date | string) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
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

const getRetreatCode = (retreat?: string | Retreat) => {
  if (!retreat || typeof retreat === 'string') return '';
  return retreat.code || retreat.retreatCode || retreat.name || '';
};

const titleize = (value: string) => value
  .split(/[_-]+/)
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

const isPdfFile = (file: BookingDocumentFile) => {
  const name = `${file?.fileName || file?.s3Key || file?.filePath || ''}`.toLowerCase();
  return file?.mimeType === 'application/pdf' || name.endsWith('.pdf');
};

const isImageFile = (file: BookingDocumentFile) => Boolean(
  file?.mimeType?.startsWith('image/')
  || /\.(png|jpe?g|gif|webp|bmp)$/i.test(file?.fileName || file?.s3Key || file?.filePath || ''),
);

export const isBookingDocumentFilePreviewable = (file: BookingDocumentFile) => isPdfFile(file) || isImageFile(file);

const SortHeader: React.FC<{
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
}> = ({ label, sortKey, activeKey, direction, onSort }) => (
  <button
    type="button"
    onClick={() => onSort(sortKey)}
    className="inline-flex items-center gap-1 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-900"
  >
    {label}
    <ArrowUpDown className={`h-3.5 w-3.5 ${activeKey === sortKey ? 'text-blue-600' : 'text-gray-300'}`} />
    {activeKey === sortKey && <span className="sr-only">sorted {direction}</span>}
  </button>
);

const DocumentTypeIcon: React.FC<{ type?: string }> = ({ type }) => {
  const normalized = normalizeKey(type);
  const Icon = normalized === 'contract' || normalized === 'contract_signed' ? Scale
    : normalized === 'food_intake' || normalized === 'food_form' ? Utensils
      : normalized === 'medications_form' ? Pill
        : normalized === 'questionnaire' || normalized === 'health_questionnaire' ? ClipboardList
          : FileText;
  return <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#d7c9b4] bg-[#fffaf1] text-[#705d46]"><Icon className="h-4 w-4" /></span>;
};

const BookingDocumentsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const routePrefix = location.pathname.split('/').filter(Boolean)[0] || 'admin';
  const [documents, setDocuments] = useState<BookingDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('receivedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [deletingDocument, setDeletingDocument] = useState<BookingDocument | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [viewer, setViewer] = useState<{ document: BookingDocument; file: BookingDocumentFile } | null>(null);
  const [viewerUrl, setViewerUrl] = useState('');
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState('');
  const [editingDocument, setEditingDocument] = useState<BookingDocument | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editType, setEditType] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const focusedDocumentId = new URLSearchParams(location.search).get('documentId') || '';
  const focusedDocumentOpened = useRef('');

  const closeViewer = () => {
    if (viewerUrl) URL.revokeObjectURL(viewerUrl);
    setViewer(null);
    setViewerUrl('');
    setViewerError('');
  };

  const openViewer = async (document: BookingDocument, file: BookingDocumentFile) => {
    const storedPath = file.s3Key || file.filePath;
    if (!document._id || !storedPath) return;
    if (viewerUrl) URL.revokeObjectURL(viewerUrl);
    setViewer({ document, file });
    setViewerUrl('');
    setViewerError('');
    setViewerLoading(true);
    try {
      const response = await bookingDocumentsApi.getFile(document._id, storedPath);
      setViewerUrl(URL.createObjectURL(response.data));
    } catch (previewError: any) {
      setViewerError(previewError?.response?.data?.message || previewError?.message || 'Unable to load this file preview.');
    } finally {
      setViewerLoading(false);
    }
  };

  useEffect(() => () => {
    if (viewerUrl) URL.revokeObjectURL(viewerUrl);
  }, [viewerUrl]);

  const loadDocuments = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await bookingDocumentsApi.getAll({ compact: true });
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

  useEffect(() => {
    if (!focusedDocumentId || loading) return;
    const focusedDocument = documents.find((candidate) => candidate._id === focusedDocumentId);
    const element = document.getElementById(`booking-document-${focusedDocumentId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    const firstFile = focusedDocument?.files?.[0];
    if (focusedDocument && firstFile && focusedDocumentOpened.current !== focusedDocumentId) {
      focusedDocumentOpened.current = focusedDocumentId;
      void openViewer(focusedDocument, firstFile);
    }
    // openViewer is intentionally stable for this one-shot deep-link effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedDocumentId, loading, documents]);

  const documentTypes = useMemo(() => {
    return Array.from(new Set(documents.map((document) => normalizeKey(document.documentType)).filter((type) => type && type !== 'ekg' && type !== 'liver_panel'))).sort();
  }, [documents]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSortKey(key);
    setSortDirection(key === 'receivedAt' ? 'desc' : 'asc');
  };

  const confirmDelete = async () => {
    if (!deletingDocument?._id || deleteReason.trim().length < 2) return;
    setDeleting(true);
    setError('');
    try {
      await bookingDocumentsApi.delete(deletingDocument._id, deleteReason.trim());
      setDocuments((current) => current.filter((document) => document._id !== deletingDocument._id));
      setDeletingDocument(null);
      setDeleteReason('');
    } catch (deleteError: any) {
      setError(deleteError?.response?.data?.message || deleteError?.message || 'Unable to delete the document.');
    } finally {
      setDeleting(false);
    }
  };

  const beginEdit = (document: BookingDocument) => {
    setEditingDocument(document);
    setEditTitle(document.title || '');
    setEditDescription(document.description || '');
    setEditType(document.documentType || '');
  };

  const saveEdit = async () => {
    if (!editingDocument?._id || !editType.trim()) return;
    setSavingEdit(true);
    setError('');
    try {
      const response = await bookingDocumentsApi.update(editingDocument._id, {
        title: editTitle.trim() || undefined,
        description: editDescription.trim() || undefined,
        documentType: editType,
      });
      setDocuments((current) => current.map((document) => document._id === editingDocument._id ? response.data : document));
      setEditingDocument(null);
    } catch (editError: any) {
      setError(editError?.response?.data?.message || editError?.message || 'Unable to update the document.');
    } finally {
      setSavingEdit(false);
    }
  };

  const filteredDocuments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = documents.filter((document) => {
      const type = normalizeKey(document.documentType);
      if (type === 'ekg' || type === 'liver_panel') return false;
      if (typeFilter !== 'all' && type !== typeFilter) return false;

      if (!normalizedQuery) return true;
      const haystack = [
        document.display_id,
        document._id,
        document.title,
        document.description,
        document.documentType,
        document.status,
        getBookingLabel(document.bookingId),
        getClientLabel(document.clientId),
        getRetreatLabel(document.retreatId),
        ...(document.files || []).map((file) => `${file.fileName || ''} ${file.originalFileName || ''} ${file.s3Key || ''} ${file.filePath || ''}`),
      ].join(' ').toLowerCase();
      return haystack.includes(normalizedQuery);
    });

    return [...filtered].sort((left, right) => {
      const direction = sortDirection === 'asc' ? 1 : -1;
      const valueFor = (document: BookingDocument) => {
        if (sortKey === 'receivedAt') return new Date(document.receivedAt || document.createdAt || 0).getTime();
        if (sortKey === 'documentType') return titleize(document.documentType || '').toLowerCase();
        if (sortKey === 'booking') return getBookingLabel(document.bookingId).toLowerCase();
        if (sortKey === 'client') return getClientLabel(document.clientId).toLowerCase();
        return getRetreatLabel(document.retreatId).toLowerCase();
      };
      const leftValue = valueFor(left);
      const rightValue = valueFor(right);
      if (leftValue < rightValue) return -1 * direction;
      if (leftValue > rightValue) return 1 * direction;
      return 0;
    });
  }, [documents, query, sortDirection, sortKey, typeFilter]);

  return (
    <div className="min-h-full bg-[#f7ecd9] p-4 text-[#29251f] sm:p-6">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Document Library</h1>
          <p className="mt-1 text-sm text-[#776d60]">Booking files with document type, booking, client, retreat, and upload details.</p>
        </div>
        <button
          type="button"
          onClick={loadDocuments}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-[#d7c9b4] bg-[#fffaf1] px-5 py-2.5 text-sm font-semibold hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search booking #, client, retreat, type, title, or file name"
            className="w-full rounded-full border border-[#d7c9b4] bg-[#fffaf1] py-3 pl-10 pr-4 text-sm focus:border-[#c97535] focus:outline-none focus:ring-2 focus:ring-[#c97535]/20 lg:min-w-[420px]"
          />
        </label>
        <div className="flex flex-wrap gap-2 lg:ml-auto" aria-label="Filter by document type">
          <button type="button" onClick={() => setTypeFilter('all')} className={`rounded-full border px-4 py-2 text-sm font-semibold ${typeFilter === 'all' ? 'border-[#c97535] bg-[#c97535] text-white' : 'border-[#d7c9b4] bg-[#fffaf1] hover:bg-white'}`}>All types</button>
          {documentTypes.map((type) => <button key={type} type="button" onClick={() => setTypeFilter(type)} className={`rounded-full border px-4 py-2 text-sm font-medium ${typeFilter === type ? 'border-[#c97535] bg-[#c97535] text-white' : 'border-[#d7c9b4] bg-[#fffaf1] hover:bg-white'}`}>{titleize(type)}</button>)}
        </div>
      </div>

      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="overflow-hidden rounded-[24px] border border-[#d7c9b4] bg-[#fffaf1] shadow-sm">
        <div className="border-b border-[#d7c9b4] px-6 py-4 text-sm text-[#776d60]">
          {loading ? 'Loading documents...' : `${filteredDocuments.length} document${filteredDocuments.length === 1 ? '' : 's'}`}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full">
            <thead className="bg-[#eee4d3]">
              <tr>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-[#655d51]">ID</th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-[#655d51]">Document</th>
                <th className="px-5 py-3 text-left"><SortHeader label="Type" sortKey="documentType" activeKey={sortKey} direction={sortDirection} onSort={handleSort} /></th>
                <th className="px-5 py-3 text-left"><SortHeader label="Booking" sortKey="booking" activeKey={sortKey} direction={sortDirection} onSort={handleSort} /></th>
                <th className="px-5 py-3 text-left"><SortHeader label="Client" sortKey="client" activeKey={sortKey} direction={sortDirection} onSort={handleSort} /></th>
                <th className="px-5 py-3 text-left"><SortHeader label="Received" sortKey="receivedAt" activeKey={sortKey} direction={sortDirection} onSort={handleSort} /></th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-[#655d51]">File</th>
                <th className="px-5 py-3 text-right text-[11px] font-bold uppercase tracking-widest text-[#655d51]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#d7c9b4]">
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-3 text-gray-600" role="status" aria-live="polite">
                      <RefreshCw className="h-8 w-8 animate-spin text-blue-600" aria-hidden="true" />
                      <strong className="text-sm text-gray-800">Loading document library…</strong>
                      <span className="text-xs text-gray-500">Fetching booking documents and file details.</span>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && filteredDocuments.map((document) => {
                const bookingId = getBookingId(document.bookingId);
                const primaryFile = (document.files || [])[0];
                return (
                  <tr id={`booking-document-${document._id}`} key={document._id} className={`hover:bg-white/70 ${focusedDocumentId === document._id ? 'bg-emerald-50 ring-2 ring-inset ring-emerald-500' : ''}`}>
                    <td className="px-5 py-4 align-middle text-sm text-[#8b8174]">
                      {document.display_id || document._id?.slice(-6) || '—'}
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <div className="flex items-start gap-3"><DocumentTypeIcon type={document.documentType} /><div><div className="font-bold">{document.title || titleize(document.documentType)}</div>{document.description && <div className="mt-1 max-w-md text-xs text-[#8b8174]">{document.description}</div>}</div></div>
                    </td>
                    <td className="px-5 py-4 align-middle text-sm">
                      <span className="inline-flex rounded-full bg-[#edf7df] px-3 py-1 text-xs font-medium text-[#50623d]">
                        {titleize(document.documentType)}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-middle text-sm">
                      {bookingId ? (
                        <button type="button" className="font-bold text-[#9b4f1e] hover:underline" onClick={() => navigate(`/${routePrefix}/bookings/${bookingId}`)}>
                          {getBookingLabel(document.bookingId)}
                        </button>
                      ) : (
                        <span className="text-gray-500">{getBookingLabel(document.bookingId)}</span>
                      )}
                    </td>
                    <td className="px-5 py-4 align-middle text-sm"><div>{getClientLabel(document.clientId)}</div>{getRetreatCode(document.retreatId) && <div className="mt-1 text-xs text-[#8b8174]">{getRetreatCode(document.retreatId)}</div>}</td>
                    <td className="px-5 py-4 align-middle text-sm text-[#665e53]">{formatDateOnly(document.receivedAt || document.createdAt)}</td>
                    <td className="px-5 py-4 align-middle">
                      <div className="flex flex-wrap gap-2">
                        {(document.files || []).length === 0 && <span className="text-sm text-[#8b8174]">No files</span>}
                        {(document.files || []).map((file, index) => (
                          <button
                            key={`${document._id}-${file.s3Key || file.filePath || file.fileName || index}`}
                            type="button"
                            onClick={() => openViewer(document, file)}
                            disabled={!document._id || !(file.s3Key || file.filePath)}
                            className="inline-flex max-w-[270px] items-center gap-2 rounded-full border border-[#d7c9b4] bg-[#f1e8d8] px-3 py-2 text-left text-xs font-medium hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                            title={file.originalFileName ? `Preview original upload: ${file.originalFileName}` : 'Preview file'}
                          >
                            <FileText className="h-3.5 w-3.5 flex-none" />
                            <span className="truncate">{file.fileName || 'Uploaded file'}</span>
                            <span className="flex-none text-[#8b8174]">{formatBytes(file.size)}</span>
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right align-middle">
                      <div className="inline-flex gap-2">
                        <button type="button" onClick={() => primaryFile && openViewer(document, primaryFile)} disabled={!primaryFile} className="rounded-full border border-[#d7c9b4] bg-[#fffaf1] p-2 hover:bg-white disabled:opacity-40" aria-label={`View ${document.title || 'document'}`}><Eye className="h-4 w-4" /></button>
                        <button type="button" onClick={() => beginEdit(document)} className="rounded-full border border-[#d7c9b4] bg-[#fffaf1] p-2 hover:bg-white" aria-label={`Edit ${document.title || 'document'}`}><Pencil className="h-4 w-4" /></button>
                        <button type="button" onClick={() => { setDeletingDocument(document); setDeleteReason(''); }} className="rounded-full border border-[#d7c9b4] bg-[#fffaf1] p-2 text-[#a34d1d] hover:bg-white" aria-label={`Delete ${document.title || 'document'}`}><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && filteredDocuments.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-[#776d60]">
                    No booking documents found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingDocument && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="edit-document-title">
          <div className="w-full max-w-lg rounded-2xl bg-[#fffaf1] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><h2 id="edit-document-title" className="text-xl font-bold">Edit document</h2><p className="mt-1 text-sm text-[#776d60]">Document #{editingDocument.display_id || editingDocument._id?.slice(-8)}</p></div>
              <button type="button" onClick={() => setEditingDocument(null)} disabled={savingEdit} className="rounded-full border border-[#d7c9b4] p-2" aria-label="Close edit document"><X className="h-4 w-4" /></button>
            </div>
            <label className="mt-5 block text-sm font-semibold">Title<input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} className="mt-2 w-full rounded-lg border border-[#d7c9b4] bg-white px-3 py-2 font-normal" /></label>
            <label className="mt-4 block text-sm font-semibold">Document type<select value={editType} onChange={(event) => setEditType(event.target.value)} className="mt-2 w-full rounded-lg border border-[#d7c9b4] bg-white px-3 py-2 font-normal">{Array.from(new Set([editType, ...documentTypes])).filter(Boolean).map((type) => <option key={type} value={type}>{titleize(type)}</option>)}</select></label>
            <label className="mt-4 block text-sm font-semibold">Description<textarea rows={3} value={editDescription} onChange={(event) => setEditDescription(event.target.value)} className="mt-2 w-full rounded-lg border border-[#d7c9b4] bg-white px-3 py-2 font-normal" /></label>
            <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setEditingDocument(null)} disabled={savingEdit} className="rounded-lg border border-[#d7c9b4] px-4 py-2 font-semibold">Cancel</button><button type="button" onClick={saveEdit} disabled={savingEdit || !editType.trim()} className="rounded-lg bg-[#29251f] px-4 py-2 font-semibold text-white disabled:opacity-50">{savingEdit ? 'Saving…' : 'Save changes'}</button></div>
          </div>
        </div>
      )}

      {deletingDocument && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-document-title">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="delete-document-title" className="text-lg font-semibold text-gray-900">Delete document?</h2>
                <p className="mt-1 text-sm text-gray-600">{deletingDocument.title || titleize(deletingDocument.documentType)} #{deletingDocument.display_id || deletingDocument._id?.slice(-8)}</p>
              </div>
              <button type="button" onClick={() => setDeletingDocument(null)} disabled={deleting} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-4 text-sm text-gray-700">The document will be removed from the library but retained as a deleted record. The user, timestamp, reason, and document details will be recorded in Audit Logs.</p>
            <label className="mt-4 block text-sm font-semibold text-gray-800">
              Deletion reason <span className="text-red-600">*</span>
              <textarea autoFocus rows={3} value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)} placeholder="Why is this document being deleted?" className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-normal focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setDeletingDocument(null)} disabled={deleting} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
              <button type="button" onClick={confirmDelete} disabled={deleting || deleteReason.trim().length < 2} className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
                <Trash2 className="h-4 w-4" /> {deleting ? 'Deleting...' : 'Delete document'}
              </button>
            </div>
          </div>
        </div>
      )}
      {viewer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/70 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="document-preview-title">
          <section className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <header className="flex items-center justify-between gap-4 border-b border-gray-200 px-4 py-3 sm:px-5">
              <div className="min-w-0"><h2 id="document-preview-title" className="truncate text-lg font-semibold text-gray-900">{viewer.document.title || titleize(viewer.document.documentType)}</h2><p className="truncate text-xs text-gray-500">{viewer.file.fileName || viewer.file.originalFileName || 'Uploaded file'}</p></div>
              <div className="flex shrink-0 items-center gap-2">
                {viewerUrl && <a href={viewerUrl} download={viewer.file.fileName || viewer.file.originalFileName || 'document'} className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"><Download className="h-4 w-4" /> Download</a>}
                <button type="button" onClick={closeViewer} className="rounded-md border border-gray-300 p-2 text-gray-600 hover:bg-gray-50" aria-label="Close document preview"><X className="h-5 w-5" /></button>
              </div>
            </header>
            <div className="flex min-h-0 flex-1 items-center justify-center bg-gray-100 p-3">
              {viewerLoading && <p className="text-sm text-gray-600">Loading secure preview…</p>}
              {!viewerLoading && viewerError && <div className="max-w-xl rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{viewerError}</div>}
              {!viewerLoading && !viewerError && viewerUrl && isPdfFile(viewer.file) && <iframe src={viewerUrl} title={viewer.file.fileName || 'PDF preview'} className="h-full w-full rounded-md border-0 bg-white" />}
              {!viewerLoading && !viewerError && viewerUrl && isImageFile(viewer.file) && <img src={viewerUrl} alt={viewer.file.fileName || 'Image preview'} className="max-h-full max-w-full object-contain" />}
              {!viewerLoading && !viewerError && viewerUrl && !isBookingDocumentFilePreviewable(viewer.file) && <div className="rounded-md bg-white p-6 text-center text-gray-700"><FileText className="mx-auto mb-3 h-10 w-10 text-gray-400" /><p>Preview is unavailable for this file type.</p><p className="mt-1 text-sm text-gray-500">Use Download to open the file in its native application.</p></div>}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default BookingDocumentsPage;
