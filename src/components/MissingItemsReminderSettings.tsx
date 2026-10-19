import React, { useEffect, useState } from 'react';
import { missingItemsReminderApi } from '../services/api';
import { authService } from '../services/authService';

const timezones = ['Europe/Prague', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Europe/Warsaw', 'UTC'];

export default function MissingItemsReminderSettings() {
  const admin = authService.getUser()?.role === 'admin';
  const [settings, setSettings] = useState<any>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<any>(null);

  useEffect(() => {
    if (!admin) return;
    let active = true;
    missingItemsReminderApi.get().then(({ data }) => { if (active) setSettings(data); }).catch(() => { if (active) setError('Could not load missing-items reminder settings. Reopen this tab to retry.'); });
    return () => { active = false; };
  }, [admin]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage(''); setPreview(null);
    try {
      const { data } = await missingItemsReminderApi.save({ enabled: settings.enabled, hour: settings.hour, timezone: settings.timezone });
      setSettings(data); setMessage('Missing-items reminder settings saved.');
    } catch (e: any) { setError(e.response?.data?.message || 'Could not save missing-items reminder settings.'); }
    finally { setBusy(false); }
  };

  const loadPreview = async () => {
    setBusy(true); setError('');
    try { setPreview((await missingItemsReminderApi.preview()).data); }
    catch { setError('Could not build the preview. One or more data sources are unavailable.'); }
    finally { setBusy(false); }
  };

  return <section aria-label="Missing items reminder" className="payment-types-settings morning-digest-settings">
    <h3>Missing items reminder</h3>
    <p>Resends the "what's still missing" email once a day, per booking, for as long as anything is outstanding — right up through the retreat start date, no earlier cutoff. Email safety settings apply.</p>
    {!admin ? <p>Only administrators can configure this reminder.</p> : <>
      {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
      {!settings && !error && <p>Loading…</p>}
      {settings && <form onSubmit={save}>
        <fieldset disabled={busy}>
          <label><input type="checkbox" checked={settings.enabled} onChange={e => setSettings({ ...settings, enabled: e.target.checked })} /> Enable daily missing-items reminder</label>
          <p><label>Send at hour (0–23) <input type="number" min={0} max={23} required value={settings.hour} onChange={e => setSettings({ ...settings, hour: Number(e.target.value) })} /></label></p>
          <p><label>Timezone <select aria-label="Timezone" value={settings.timezone} onChange={e => setSettings({ ...settings, timezone: e.target.value })}>
            {[...new Set([settings.timezone, ...timezones])].map(tz => <option key={tz} value={tz}>{tz}</option>)}
          </select></label></p>
          <button type="submit">Save reminder settings</button>{' '}<button type="button" onClick={loadPreview}>Preview today's run</button>
        </fieldset>
        <p>Last run: {settings.lastRun ? `${settings.lastRun.bookingId} · ${settings.lastRun.status}` : 'No runs yet'}</p>
      </form>}
      {preview && <div aria-label="Missing items reminder preview"><h4>Preview — no email sent</h4>
        <p>{preview.eligibleBookings} active booking{preview.eligibleBookings === 1 ? '' : 's'} checked; {preview.wouldSend} would receive a reminder today.</p>
        {preview.bookings.length > 0 && <ul>{preview.bookings.map((b: any) => <li key={b.bookingId}>Booking {b.bookingId} · {b.missingCount} item{b.missingCount === 1 ? '' : 's'} missing</li>)}</ul>}
      </div>}
    </>}
  </section>;
}
