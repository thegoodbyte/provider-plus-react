import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
type Language = 'en' | 'cs' | 'pl';
type Settings = { enabled: boolean; contactEmail: string; whatsappNumber: string; text: Record<Language, { title: string; timing: string; contact: string; urgent: string }>; topics: Array<{ id: string; en: string; cs: string; pl: string }> };
export default function PortalContactSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [language, setLanguage] = useState<Language>('en');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true; setError('');
    api.get('/portal-contact-settings').then(response => { if (active) setSettings(response.data); }).catch(() => { if (active) setError('Unable to load medical contact settings. Administrator access is required.'); });
    return () => { active = false; };
  }, [attempt]);
  const change = (next: Settings) => { setSettings(next); setSaved(false); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (!settings || saving) return;
    setSaving(true); setError(''); setSaved(false);
    try { const response = await api.patch('/portal-contact-settings', settings); setSettings(response.data); setSaved(true); }
    catch (failure: any) { setError(failure?.response?.data?.message || 'Unable to save medical contact settings.'); }
    finally { setSaving(false); }
  };
  if (!settings) return <div className="p-5">{error ? <><p role="alert">{error}</p><button onClick={() => setAttempt(value => value + 1)}>Retry</button></> : <p>Loading medical contact settings…</p>}</div>;
  return <form className="p-5 space-y-4" onSubmit={save}>
    <h3 className="text-lg font-semibold">IR medical review guidance and contact</h3>
    <p>Shown on the EKG and liver-upload pages in IbogaReady. Messages are emailed to the configured address and logged in Communications with the client. WhatsApp is optional; use the international phone number.</p>
    <fieldset disabled={saving} className="space-y-4">
      <label className="block"><input type="checkbox" checked={settings.enabled} onChange={event => change({ ...settings, enabled: event.target.checked })} /> Show guidance and contact form</label>
      <label className="block">Recipient email<input className="block w-full rounded border p-2" type="email" required value={settings.contactEmail} onChange={event => change({ ...settings, contactEmail: event.target.value })} /></label>
      <label className="block">WhatsApp number<input className="block w-full rounded border p-2" type="tel" placeholder="+420…" pattern="\+?[1-9][0-9]{6,14}" value={settings.whatsappNumber} onChange={event => change({ ...settings, whatsappNumber: event.target.value })} /></label>
      <label className="block">Editing language<select className="ml-2 rounded border p-2" value={language} onChange={event => setLanguage(event.target.value as Language)}><option value="en">English</option><option value="cs">Czech</option><option value="pl">Polish</option></select></label>
      {([['title', 'Section title', 120], ['timing', 'Review timing and email updates', 2000], ['contact', 'Contact invitation', 1000], ['urgent', 'Urgent contact and ceremony etiquette', 2000]] as const).map(([key, label, max]) => <label className="block" key={key}>{label}<textarea className="block w-full rounded border p-2" rows={key === 'title' ? 1 : 3} required maxLength={max} value={settings.text[language][key]} onChange={event => change({ ...settings, text: { ...settings.text, [language]: { ...settings.text[language], [key]: event.target.value } } })} /></label>)}
      <h4 className="font-semibold">Contact topics</h4><p className="text-sm">Complete each topic in all three languages before saving. IDs identify topics and must be unique.</p>
      {settings.topics.map((topic, index) => <div key={index} className="flex flex-wrap items-end gap-2 rounded border p-3">
        <label>Topic ID<input className="block rounded border p-2" required maxLength={40} pattern="[a-z0-9-]+" value={topic.id} onChange={event => change({ ...settings, topics: settings.topics.map((entry, i) => i === index ? { ...entry, id: event.target.value } : entry) })} /></label>
        <label>Topic label ({language})<input className="block rounded border p-2" required maxLength={120} value={topic[language]} onChange={event => change({ ...settings, topics: settings.topics.map((entry, i) => i === index ? { ...entry, [language]: event.target.value } : entry) })} /></label>
        <button type="button" disabled={settings.topics.length <= 1} onClick={() => change({ ...settings, topics: settings.topics.filter((_, i) => i !== index) })}>Remove topic</button>
      </div>)}
      <button type="button" disabled={settings.topics.length >= 10} onClick={() => change({ ...settings, topics: [...settings.topics, { id: '', en: '', cs: '', pl: '' }] })}>Add topic</button>
      <div><button type="submit" className="rounded bg-blue-700 px-4 py-2 text-white">{saving ? 'Saving…' : 'Save medical contact settings'}</button></div>
    </fieldset>
    {saved && <p role="status">Medical contact settings saved.</p>}{error && <p role="alert">{error}</p>}
  </form>;
}
