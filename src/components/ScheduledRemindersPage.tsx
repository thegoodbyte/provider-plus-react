import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Pause, Play, RefreshCw, RotateCw, XCircle } from 'lucide-react';
import { bookingFlowApi } from '../services/api';

type Schedule = {
  _id: string;
  ruleKey: string;
  actionType: string;
  scheduledFor: string;
  status: string;
  attemptCount?: number;
  lastError?: string;
  bookingFlowItemId?: { title?: string; key?: string; status?: string };
  clientId?: { firstName?: string; lastName?: string; email?: string; display_id?: string };
  retreatId?: { name?: string; startDate?: string };
  bookingId?: { display_id?: string };
};

const pretty = (value = '') => value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

const ScheduledRemindersPage: React.FC = () => {
  const [rows, setRows] = useState<Schedule[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await bookingFlowApi.getReminderSchedules(status ? { status } : {});
      setRows(response.data || []);
    } catch (caught: any) {
      setError(caught?.response?.data?.message || 'Could not load scheduled reminders.');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const summary = useMemo(() => rows.reduce<Record<string, number>>((result, row) => {
    result[row.status] = (result[row.status] || 0) + 1;
    return result;
  }, {}), [rows]);

  const update = async (row: Schedule, nextStatus: 'scheduled' | 'paused' | 'cancelled') => {
    setBusy(row._id);
    try {
      await bookingFlowApi.updateReminderSchedule(row._id, { status: nextStatus });
      await load();
    } finally {
      setBusy('');
    }
  };

  const sync = async () => {
    setBusy('sync');
    try {
      await bookingFlowApi.syncReminderAutomation();
      await load();
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-5 text-slate-800 md:p-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-indigo-600"><CalendarClock size={18} /> Automation</div>
          <h1 className="text-3xl font-semibold">Scheduled reminders</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">Every generated email and staff escalation, in execution order. Completed booking steps are skipped automatically.</p>
        </div>
        <button onClick={sync} disabled={!!busy} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-50">
          <RotateCw size={17} className={busy === 'sync' ? 'animate-spin' : ''} /> Sync schedules
        </button>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        {['scheduled', 'paused', 'sent', 'task_created', 'failed'].map((key) => (
          <button key={key} onClick={() => setStatus(status === key ? '' : key)} className={`rounded-2xl border p-4 text-left ${status === key ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-white'}`}>
            <div className="text-2xl font-semibold">{summary[key] || 0}</div>
            <div className="text-xs text-slate-500">{pretty(key)}</div>
          </button>
        ))}
      </div>

      {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="p-4">When</th><th className="p-4">Client / booking</th><th className="p-4">Step</th><th className="p-4">Retreat</th><th className="p-4">Action</th><th className="p-4">Status</th><th className="p-4">Controls</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row._id} className="align-top hover:bg-slate-50/60">
                <td className="whitespace-nowrap p-4 font-medium">{new Date(row.scheduledFor).toLocaleString()}</td>
                <td className="p-4"><div className="font-medium">{[row.clientId?.firstName, row.clientId?.lastName].filter(Boolean).join(' ') || row.clientId?.email || 'Client'}</div><div className="text-xs text-slate-500">{row.bookingId?.display_id || row.clientId?.display_id || ''}</div></td>
                <td className="p-4"><div>{row.bookingFlowItemId?.title || row.bookingFlowItemId?.key || 'Booking step'}</div><div className="text-xs text-slate-500">{pretty(row.ruleKey)}</div></td>
                <td className="p-4">{row.retreatId?.name || '—'}</td>
                <td className="p-4">{row.actionType === 'create_staff_task' ? 'Staff task' : 'Email'}</td>
                <td className="p-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">{pretty(row.status)}</span>{row.lastError && <div className="mt-2 max-w-xs text-xs text-rose-600">{row.lastError}</div>}</td>
                <td className="p-4"><div className="flex gap-2">
                  {row.status !== 'paused' && <button title="Pause" disabled={busy === row._id} onClick={() => update(row, 'paused')} className="rounded-lg border p-2"><Pause size={15} /></button>}
                  {['paused', 'failed'].includes(row.status) && <button title="Resume" disabled={busy === row._id} onClick={() => update(row, 'scheduled')} className="rounded-lg border p-2 text-emerald-700"><Play size={15} /></button>}
                  {!['sent', 'task_created', 'cancelled'].includes(row.status) && <button title="Cancel" disabled={busy === row._id} onClick={() => update(row, 'cancelled')} className="rounded-lg border p-2 text-rose-600"><XCircle size={15} /></button>}
                </div></td>
              </tr>
            ))}
            {!loading && rows.length === 0 && <tr><td colSpan={7} className="p-12 text-center text-slate-500">No reminders match this filter.</td></tr>}
          </tbody>
        </table>
        {loading && <div className="flex items-center justify-center gap-2 p-12 text-slate-500"><RefreshCw size={18} className="animate-spin" /> Loading reminders…</div>}
      </div>
    </div>
  );
};

export default ScheduledRemindersPage;
