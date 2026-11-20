import React, { useEffect, useMemo, useState } from 'react';
import { auditLogsApi } from '../services/api';
import { usersApi, User } from '../services/usersApi';
import LoadingSpinner from './LoadingSpinner';
import AppleButton from './AppleButton';
import { Card, Badge, Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell, EmptyState } from './ui';

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

// Shows a user's full name when available, falling back to their email (PPVC-1053).
const userDisplayName = (user: Pick<User, 'firstName' | 'lastName' | 'email'>) => {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.email;
};

const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [filters, setFilters] = useState({
    keyword: '',
    action: '',
    entityType: '',
    entityId: '',
    actorUserId: '',
    dateFrom: '',
    dateTo: '',
  });
  const limit = 50;

  useEffect(() => {
    usersApi.getAll()
      .then((response) => setUsers(response.data || []))
      .catch(() => setUsers([]));
  }, []);

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
        <AppleButton className="mt-3" onClick={() => { setPage(1); setFilters((current) => ({ ...current, action: '', entityType: 'client_portal_access' })); }}>Show ibogaready.com logins</AppleButton>
      </div>

      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input className="rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Keyword" value={filters.keyword} onChange={(e) => updateFilter('keyword', e.target.value)} />
          <select className="rounded-md border border-gray-300 px-3 py-2 text-sm" value={filters.action} onChange={(e) => updateFilter('action', e.target.value)}>
            {actions.map((action) => <option key={action} value={action}>{action || 'All actions'}</option>)}
          </select>
          <input className="rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Entity type" value={filters.entityType} onChange={(e) => updateFilter('entityType', e.target.value)} />
          <input className="rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Entity ID" value={filters.entityId} onChange={(e) => updateFilter('entityId', e.target.value)} />
          <select className="rounded-md border border-gray-300 px-3 py-2 text-sm" value={filters.actorUserId} onChange={(e) => updateFilter('actorUserId', e.target.value)}>
            <option value="">All users</option>
            {users.map((user) => (
              <option key={user._id} value={user._id}>{userDisplayName(user)}</option>
            ))}
          </select>
          <input className="rounded-md border border-gray-300 px-3 py-2 text-sm" type="date" value={filters.dateFrom} onChange={(e) => updateFilter('dateFrom', e.target.value)} />
          <input className="rounded-md border border-gray-300 px-3 py-2 text-sm" type="date" value={filters.dateTo} onChange={(e) => updateFilter('dateTo', e.target.value)} />
          <AppleButton
            variant="secondary"
            onClick={() => {
              setPage(1);
              setFilters({ keyword: '', action: '', entityType: '', entityId: '', actorUserId: '', dateFrom: '', dateTo: '' });
            }}
          >
            Clear
          </AppleButton>
        </div>
      </Card>

      <Card padding="none" className="overflow-hidden">
        {loading ? (
          <LoadingSpinner message="Loading audit logs..." />
        ) : logs.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No audit logs found." />
          </div>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Time</TableHeaderCell>
                <TableHeaderCell>Actor</TableHeaderCell>
                <TableHeaderCell>Action</TableHeaderCell>
                <TableHeaderCell>Entity</TableHeaderCell>
                <TableHeaderCell>Summary</TableHeaderCell>
                <TableHeaderCell>IP</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log._id}>
                  <TableCell className="whitespace-nowrap text-gray-600">{new Date(log.createdAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="font-medium text-gray-900">{log.actorEmail || 'Unknown'}</div>
                    <div className="text-xs text-gray-500">{log.actorRole || '-'}</div>
                  </TableCell>
                  <TableCell><Badge tone="info">{log.action}</Badge></TableCell>
                  <TableCell className="text-gray-700">
                    <div>{log.entityType}</div>
                    <div className="text-xs text-gray-500">{log.entityDisplayId || log.entityId || '-'}</div>
                  </TableCell>
                  <TableCell className="max-w-xl">
                    <button type="button" className="text-left text-gray-800 hover:text-blue-700" onClick={() => setSelected(log)}>
                      {log.summary}
                    </button>
                    <div className="text-xs text-gray-500">{log.method} {log.path} · {log.statusCode}</div>
                  </TableCell>
                  <TableCell className="text-gray-600">{log.ipAddress || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <div className="mt-4 flex items-center justify-between text-sm">
        <div className="text-gray-600">{total} result{total === 1 ? '' : 's'}</div>
        <div className="flex items-center gap-2">
          <AppleButton variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((value) => Math.max(value - 1, 1))}>Previous</AppleButton>
          <span className="text-gray-600">Page {page} of {pages}</span>
          <AppleButton variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Next</AppleButton>
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
              <AppleButton variant="secondary" size="sm" onClick={() => setSelected(null)}>Close</AppleButton>
            </div>
            <pre className="whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-xs text-gray-700">{JSON.stringify(selected, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogsPage;
