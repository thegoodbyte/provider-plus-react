import React, { useEffect, useMemo, useState } from 'react';
import { auditLogsApi } from '../services/api';
import LoadingSpinner from './LoadingSpinner';

type AuditLog = {
  _id: string;
  actorEmail?: string;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId?: string;
  entityDisplayId?: string;
  summary: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  createdAt: string;
};

const actions = ['', 'create', 'update', 'delete', 'view', 'login', 'client_portal_login_success', 'client_portal_login_failed'];

const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [filters, setFilters] = useState({
    keyword: '',
    action: '',
    entityType: '',
    entityId: '',
    actorEmail: '',
    dateFrom: '',
    dateTo: '',
  });
  const limit = 50;

  const query = useMemo(() => ({
    ...filters,
    page,
    limit,
  }), [filters, page]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const response = await auditLogsApi.getAll(query);
      setLogs(response.data.items || []);
      setTotal(response.data.total || 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const updateFilter = (key: keyof typeof filters, value: string) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const pages = Math.max(Math.ceil(total / limit), 1);

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-gray-900">Audit Logs</h1>
        <p className="mt-1 text-sm text-gray-600">Search user activity across creates, updates, deletes, and detail views.</p>
        <button type="button" className="mt-3 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" onClick={() => { setPage(1); setFilters((current) => ({ ...current, action: '', entityType: 'client_portal_access' })); }}>Show ibogaready.com logins</button>
      </div>

      <div className="mb-4 grid gap-3 rounded-md border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <input className="rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Keyword" value={filters.keyword} onChange={(e) => updateFilter('keyword', e.target.value)} />
        <select className="rounded-md border border-gray-300 px-3 py-2 text-sm" value={filters.action} onChange={(e) => updateFilter('action', e.target.value)}>
          {actions.map((action) => <option key={action} value={action}>{action || 'All actions'}</option>)}
        </select>
        <input className="rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Entity type" value={filters.entityType} onChange={(e) => updateFilter('entityType', e.target.value)} />
        <input className="rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Entity ID" value={filters.entityId} onChange={(e) => updateFilter('entityId', e.target.value)} />
        <input className="rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Actor email" value={filters.actorEmail} onChange={(e) => updateFilter('actorEmail', e.target.value)} />
        <input className="rounded-md border border-gray-300 px-3 py-2 text-sm" type="date" value={filters.dateFrom} onChange={(e) => updateFilter('dateFrom', e.target.value)} />
        <input className="rounded-md border border-gray-300 px-3 py-2 text-sm" type="date" value={filters.dateTo} onChange={(e) => updateFilter('dateTo', e.target.value)} />
        <button
          type="button"
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          onClick={() => {
            setPage(1);
            setFilters({ keyword: '', action: '', entityType: '', entityId: '', actorEmail: '', dateFrom: '', dateTo: '' });
          }}
        >
          Clear
        </button>
      </div>

      <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
        {loading ? (
          <LoadingSpinner message="Loading audit logs..." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Summary</th>
                  <th className="px-4 py-3">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.length ? logs.map((log) => (
                  <tr key={log._id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{log.actorEmail || 'Unknown'}</div>
                      <div className="text-xs text-gray-500">{log.actorRole || '-'}</div>
                    </td>
                    <td className="px-4 py-3"><span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">{log.action}</span></td>
                    <td className="px-4 py-3 text-gray-700">
                      <div>{log.entityType}</div>
                      <div className="text-xs text-gray-500">{log.entityDisplayId || log.entityId || '-'}</div>
                    </td>
                    <td className="max-w-xl px-4 py-3">
                      <button type="button" className="text-left text-gray-800 hover:text-blue-700" onClick={() => setSelected(log)}>
                        {log.summary}
                      </button>
                      <div className="text-xs text-gray-500">{log.method} {log.path} · {log.statusCode}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{log.ipAddress || '-'}</td>
                  </tr>
                )) : (
                  <tr><td className="px-4 py-8 text-center text-gray-500" colSpan={6}>No audit logs found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <div className="text-gray-600">{total} result{total === 1 ? '' : 's'}</div>
        <div className="flex items-center gap-2">
          <button className="rounded-md border border-gray-300 px-3 py-1.5 disabled:opacity-50" disabled={page <= 1} onClick={() => setPage((value) => Math.max(value - 1, 1))}>Previous</button>
          <span className="text-gray-600">Page {page} of {pages}</span>
          <button className="rounded-md border border-gray-300 px-3 py-1.5 disabled:opacity-50" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Next</button>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Audit Log Detail</h2>
                <p className="text-sm text-gray-600">{selected.summary}</p>
              </div>
              <button className="rounded-md border border-gray-300 px-3 py-1.5 text-sm" onClick={() => setSelected(null)}>Close</button>
            </div>
            <pre className="whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-xs text-gray-700">{JSON.stringify(selected, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogsPage;
