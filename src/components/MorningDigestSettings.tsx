import './MorningDigestSettings.css';
import React, { useEffect, useState } from 'react';
import { morningDigestApi } from '../services/api';
import { authService } from '../services/authService';
const areas = { submissions: 'IR submissions awaiting review', medicalReviews: 'Pending medical reviews', payments: 'Due payment requests', bookingSteps: 'Outstanding booking steps', deadlines: 'Overdue tasks and booking steps' };
export default function MorningDigestSettings() {
  const admin = authService.getUser()?.role === 'admin';
  const [settings, setSettings] = useState<any>(null);
  const [recipients, setRecipients] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  useEffect(() => {
    if (!admin) return;
    let active = true;
    morningDigestApi.get().then(({ data }) => { if (active) { setSettings(data); setRecipients(data.recipients.join(', ')); } }).catch(() => { if (active) setError('Could not load morning digest settings. Reopen this tab to retry.'); });
    return () => { active = false; };
  }, [admin]);
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage(''); setPreview(null);
    try {
      const { data } = await morningDigestApi.save({ enabled: settings.enabled, recipients: recipients.split(/[,;\n]/).map(s => s.trim()).filter(Boolean), areas: settings.areas, upcomingDays: settings.upcomingDays });
      setSettings(data); setRecipients(data.recipients.join(', ')); setMessage('Morning digest settings saved.');
    } catch (e: any) { setError(e.response?.data?.message || 'Could not save morning digest settings.'); }
    finally { setBusy(false); }
  };
  const loadPreview = async () => {
    setBusy(true); setError('');
    try { setPreview((await morningDigestApi.preview()).data); }
    catch { setError('Could not build the digest. One or more data sources are unavailable.'); }
    finally { setBusy(false); }
  };
  return <section aria-label="Morning digest" className="payment-types-settings morning-digest-settings">
    <h3>Morning digest</h3>
    <p>Daily at 06:30 Europe/Prague. Delivery runs on the first scheduled worker tick after 06:30. Email safety settings apply.</p>
    {!admin ? <p>Only administrators can configure the digest.</p> : <>
      {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
      {!settings && !error && <p>Loading…</p>}
      {settings && <form onSubmit={save}>
        <fieldset disabled={busy}>
          <label><input type="checkbox" checked={settings.enabled} onChange={e => setSettings({ ...settings, enabled: e.target.checked })} /> Enable daily digest</label>
          <p><label>Recipients (comma separated)<br /><textarea aria-label="Recipients" value={recipients} onChange={e => setRecipients(e.target.value)} rows={3} className="w-full border rounded p-2" /></label></p>
          <fieldset><legend>Include in email</legend>{Object.entries(areas).map(([key, title]) => <div key={key}><label><input type="checkbox" checked={settings.areas.includes(key)} onChange={e => setSettings({ ...settings, areas: e.target.checked ? [...settings.areas, key] : settings.areas.filter((area: string) => area !== key) })} /> {title}</label></div>)}</fieldset>
          <p><label>Upcoming retreats (days) <input type="number" min={1} max={365} required value={settings.upcomingDays} onChange={e => setSettings({ ...settings, upcomingDays: Number(e.target.value) })} /></label></p>
          <button type="submit">Save digest settings</button>{' '}<button type="button" onClick={loadPreview}>Preview saved settings</button>
        </fieldset>
        <p>Last run: {settings.lastRun ? `${settings.lastRun._id} · ${settings.lastRun.status}` : 'No runs yet'}</p>
        {settings.lastRun && ['sending', 'needs_attention'].includes(settings.lastRun.status) && <p role="alert">Check the email delivery history. This run will not be resent automatically.</p>}
      </form>}
      {preview && <div aria-label="Digest preview"><h4>Preview — no email sent</h4>{preview.sections.map((section: any) => <div key={section.key}><h4>{section.title}: {section.count}</h4><ul>{section.items.map((item: string, index: number) => <li key={index}>{item}</li>)}</ul>{section.count > section.items.length && <p>Showing the first {section.items.length} records.</p>}</div>)}</div>}
    </>}
  </section>;
}
