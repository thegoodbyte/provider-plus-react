import React, { useEffect, useState } from 'react';
import { developmentRefreshApi } from '../services/api';

type State = { enabled: boolean; target?: string; job?: { id: string; status: string; phase: string; code?: string } | null };
const phases: Record<string, string> = {
  queued: 'Starting refresh…', exporting: 'Creating a read-only production snapshot…',
  validating: 'Checking schema, sanitization, and relationships…', replacing: 'Preparing and activating sanitized development data…',
  'deployment-requested': 'Refresh prepared. Wait for the API deployment, then sign in again.',
  'restart-local-api-required': 'Refresh prepared. Restart your local API, then sign in again.',
};
export default function DevelopmentRefreshPanel() {
  const [state, setState] = useState<State>({ enabled: false });
  const [open, setOpen] = useState(false), [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const load = async () => {
      try { const response = await developmentRefreshApi.status(); if (active) setState(response.data); }
      catch { /* Never expose the control until the server confirms it is enabled. */ }
    };
    void load(); const timer = window.setInterval(load, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  if (!state.enabled) return null;
  const running = state.job?.status === 'running';
  const start = async () => {
    if (confirmation !== 'replace' || submitting || running) return;
    setSubmitting(true); setError('');
    try { const response = await developmentRefreshApi.start(confirmation); setState(response.data); setOpen(false); setConfirmation(''); }
    catch (e: any) { setError(e?.response?.data?.message || 'Unable to start refresh. Check its status before trying again.'); }
    finally { setSubmitting(false); }
  };
  return <section className="rounded-lg border border-amber-300 bg-amber-50 p-5" aria-label="Refresh development data">
    <h2 className="text-lg font-semibold">Refresh from production</h2>
    <p className="mt-1 text-sm">Replace {state.target === 'local' ? 'local' : 'development'} data with a sanitized production copy. Production data stays unchanged. The previous database is retained for rollback.</p>
    {state.job && <p role="status" className="mt-3 text-sm">
      {state.job.status === 'failed'
        ? `Refresh stopped (${state.job.code || 'unknown error'}). ${state.job.phase === 'exporting' || state.job.phase === 'validating' || state.job.phase === 'queued' ? 'Your current database was not replaced.' : 'An administrator must check the refresh receipt before retrying.'}`
        : phases[state.job.phase] || state.job.status}
    </p>}
    {state.job?.code === 'ORPHANED_REFERENCE' && <p className="mt-2 text-sm">Some records refer to missing records. These relationships need review before refreshing.</p>}
    {state.job?.code === 'SCHEMA_DRIFT_REVIEW_REQUIRED' && <p className="mt-2 text-sm">The database structure or application schema changed. An administrator must review the refresh policy and approve a new baseline.</p>}
    {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
    {!open && <button type="button" disabled={running || submitting} onClick={() => setOpen(true)} className="mt-4 rounded bg-amber-800 px-4 py-2 text-white disabled:opacity-50">{running ? 'Refresh in progress…' : 'Refresh from production'}</button>}
    {open && <div className="mt-4">
      <p className="text-sm">This replaces current development changes and resets login sessions. A fresh development administrator is generated; its credentials are stored in the operator’s private refresh receipt.</p>
      <label className="mt-3 block" htmlFor="refresh-confirmation">Type <strong>replace</strong> to confirm</label>
      <input id="refresh-confirmation" autoComplete="off" value={confirmation} onChange={e => setConfirmation(e.target.value)} className="mt-1 rounded border border-gray-400 p-2" />
      <div className="mt-3 flex gap-3">
        <button type="button" disabled={confirmation !== 'replace' || submitting || running} onClick={start} className="rounded bg-red-700 px-4 py-2 text-white disabled:opacity-50">{submitting ? 'Starting…' : 'Replace development data'}</button>
        <button type="button" disabled={submitting} onClick={() => { setOpen(false); setConfirmation(''); }}>Cancel</button>
      </div>
    </div>}
  </section>;
}
