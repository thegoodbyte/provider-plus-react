import React, { useEffect, useState } from 'react';
import { emailSafetyApi } from '../services/api';
import { authService } from '../services/authService';

type Safety = { enabled: boolean; recipient: string };
export default function EmailSafetySettings({ compact = false }: { compact?: boolean }) {
  const [saved, setSaved] = useState<Safety | null>(null);
  const [draft, setDraft] = useState<Safety>({ enabled: true, recipient: 'info@ibogaspirit.cz' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const admin = authService.getUser()?.role === 'admin';
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const response = await emailSafetyApi.get();
        if (mounted) { setSaved(response.data); setDraft(response.data); setError(''); }
      } catch { if (mounted) setError('Email safety status unavailable. Refresh before sending.'); }
    };
    void load();
    window.addEventListener('email-safety-changed', load);
    const timer = compact ? window.setInterval(load, 30000) : undefined;
    return () => { mounted = false; window.removeEventListener('email-safety-changed', load); if (timer) window.clearInterval(timer); };
  }, [compact]);
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const response = await emailSafetyApi.save(draft);
      setSaved(response.data); setDraft(response.data);
      setMessage('Email safety settings saved.');
      window.dispatchEvent(new Event('email-safety-changed'));
    } catch (caught: any) { setError(caught?.response?.data?.message || 'Could not save email safety settings.'); }
    finally { setBusy(false); }
  };
  return <section className={`rounded-lg border p-4 my-4 ${saved?.enabled ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'}`} aria-label="Email safety">
    <h2 className="font-semibold">{!saved ? 'Checking email safety…' : saved.enabled ? `Email safety ON — all mail goes only to ${saved.recipient}` : 'Email safety OFF — emails go to real recipients'}</h2>
    {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
    {!compact && <>
      <p className="my-3 text-sm">One global switch covers announcements, manual emails, reminders and medical notifications, including CC and BCC. Test sends use the same safety inbox and never complete a client’s announcement.</p>
      {admin ? <form onSubmit={save} className="space-y-4">
        <label className="flex items-center gap-2"><input type="checkbox" checked={draft.enabled} disabled={!saved || busy} onChange={event => setDraft({ ...draft, enabled: event.target.checked })} />Email safety switch — redirect all outgoing emails</label>
        <label className="block">Safety inbox<input type="email" required className="mt-1 block w-full rounded border px-3 py-2" value={draft.recipient} disabled={!saved || busy} onChange={event => setDraft({ ...draft, recipient: event.target.value })} /></label>
        {!draft.enabled && <p className="font-semibold">Saving with the switch off allows normal emails to reach real recipients. Explicit announcement tests still go only to the safety inbox.</p>}
        <button type="submit" disabled={!saved || busy} className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save email safety'}</button>
      </form> : <p>Only an administrator can change email safety settings.</p>}
      {message && <p role="status" className="mt-3">{message}</p>}
    </>}
  </section>;
}
