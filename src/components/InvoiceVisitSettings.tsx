import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
export default function InvoiceVisitSettings() {
  const [settings, setSettings] = useState({ enabled: false, recipient: '' });
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const load = () => {
    setLoading(true); setError('');
    api.get('/invoice-visits/settings', { suppressGlobalError: true } as any).then(({ data }) => { setSettings({ enabled: Boolean(data.enabled), recipient: data.recipient || '' }); setLoaded(true); }).catch(() => setError('Could not load invoice visit settings.')).finally(() => setLoading(false));
  };
  useEffect(load, []);
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (saving) return; setSaving(true); setMessage(''); setError('');
    try { const { data } = await api.put('/invoice-visits/settings', settings, { suppressGlobalError: true } as any); setSettings({ enabled: Boolean(data.enabled), recipient: data.recipient || '' }); setMessage('Invoice visit settings saved.'); }
    catch { setError('Could not save settings. Check the recipient email and retry.'); } finally { setSaving(false); }
  };
  return <section className="p-4"><h3 className="text-lg font-semibold">Invoice link visit notifications</h3>
    <p className="my-3">Visits are recorded even when emails are off. Enable emails for new visit windows; known bots/previews do not trigger emails. The recipient is stored in configuration.</p>
    {loading && <p role="status">Loading settings…</p>}
    {error && <p role="alert">{error} {loading ? null : <button type="button" onClick={load}>Reload settings</button>}</p>}
    {message && <p role="status">{message}</p>}
    <form onSubmit={save}><fieldset disabled={loading || saving || !loaded} className="space-y-3">
      <label className="block"><input type="checkbox" checked={settings.enabled} onChange={e => setSettings(s => ({ ...s, enabled: e.target.checked }))} /> Email me when an invoice link is visited</label>
      <label className="block">Invoice visit recipient email<input className="mt-1 block w-full rounded border p-2" type="email" required={settings.enabled} value={settings.recipient} onChange={e => setSettings(s => ({ ...s, recipient: e.target.value }))} /></label>
      <button className="rounded border px-3 py-2" type="submit">{saving ? 'Saving…' : 'Save invoice visit settings'}</button>
    </fieldset></form>
  </section>;
}
