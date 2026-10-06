import React, { useEffect, useState } from 'react';
import { retreatsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

const languages = { en: 'English', cz: 'Czech', pl: 'Polish' };
const lines = (value: string) => value.split('\n').map((item) => item.trim()).filter(Boolean);
export default function RetreatWebsiteContentEditor({ value, onChange }: { value: Record<string, any>; onChange: (value: Record<string, any>) => void }) {
  const [language, setLanguage] = useState('en');
  const [defaults, setDefaults] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sharedDraft, setSharedDraft] = useState<Record<string, string>>({});
  const [itemDraft, setItemDraft] = useState<Record<string, string>>({});
  const { user } = useAuth();
  useEffect(() => {
    retreatsApi.getWebsiteContentDefaults().then(({ data }) => { setDefaults(data.includedItems); setLoaded(true); })
      .catch(() => setMessage('Unable to load shared defaults. Please reopen this page to retry.'));
  }, []);
  const items = Array.isArray(value.includedItems) ? value.includedItems
    : value.includedItems?.[language] ?? (!value.includedItemsMode ? value.includedItems?.en : undefined);
  const mode = value.includedItemsMode?.[language] || (Array.isArray(items) ? 'replace' : 'inherit');
  const patch = (change: any) => onChange({ ...value, ...change });
  const localized = (key: string, text: string) => patch({ [key]: { ...(value[key] || {}), [language]: text } });
  const shared = defaults[language] || [];
  const preview = mode === 'replace' ? items || [] : mode === 'extend' ? [...shared, ...(items || [])] : shared;
  const saveDefaults = async () => {
    setSaving(true); setMessage('');
    try { await retreatsApi.updateWebsiteContentDefaults(defaults); setMessage('Shared defaults saved for all retreats that inherit them.'); }
    catch { setMessage('Unable to save shared defaults.'); }
    finally { setSaving(false); }
  };
  const field = 'w-full rounded border border-gray-300 bg-white p-3 text-sm';
  return <section className="space-y-5 border border-gray-300 bg-white p-5">
    <h2 className="text-lg font-bold">Website content</h2>
    <div role="tablist" aria-label="Website language" className="flex flex-wrap gap-2">{Object.entries(languages).map(([code, label]) => <button key={code} type="button" role="tab" aria-selected={language === code} onClick={() => setLanguage(code)} className={`min-h-11 rounded border px-4 ${language === code ? 'bg-blue-700 text-white' : 'bg-white'}`}>{label}</button>)}</div>
    <div className="grid gap-4 md:grid-cols-2">{[['titles', 'Title'], ['subtitles', 'Subtitle'], ['descriptions', 'Description']].map(([key, label]) => <label key={key}>{label}<textarea className={field} rows={key === 'descriptions' ? 5 : 2} value={value[key]?.[language] || ''} onChange={(event) => localized(key, event.target.value)}/></label>)}</div>
    <div className="grid gap-4 md:grid-cols-2"><label>Image URL<input className={field} value={value.image || ''} onChange={(event) => patch({ image: event.target.value, imgUrl: event.target.value })}/></label><label>Location ID<input className={field} value={value.locationId || ''} onChange={(event) => patch({ locationId: event.target.value })}/></label>{['city', 'country', 'region'].map((key) => <label key={key}>Location {key}<input className={field} value={value.location?.[key] || ''} onChange={(event) => patch({ location: { ...(value.location || {}), [key]: event.target.value } })}/></label>)}</div>
    <h3 className="font-bold">What the retreat includes</h3>
    <label className="block">Shared defaults — one item per line<textarea className={field} rows={5} disabled={!loaded || user?.role !== 'admin'} value={sharedDraft[language] ?? shared.join('\n')} onChange={(event) => { setSharedDraft({ ...sharedDraft, [language]: event.target.value }); setDefaults({ ...defaults, [language]: lines(event.target.value) }); }}/></label>
    {user?.role === 'admin' && <button type="button" disabled={!loaded || saving} onClick={saveDefaults} className="min-h-11 rounded bg-blue-700 px-4 text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save shared defaults for all retreats'}</button>}
    {message && <p role="status">{message}</p>}
    <label className="block">This retreat<select className={field} value={mode} onChange={(event) => patch({ includedItemsMode: { ...(value.includedItemsMode || {}), [language]: event.target.value } })}><option value="inherit">Use shared defaults</option><option value="extend">Add items to shared defaults</option><option value="replace">Replace shared defaults</option></select></label>
    {mode !== 'inherit' && <label className="block">{mode === 'extend' ? 'Additional items' : 'Replacement items'} — one per line<textarea className={field} rows={5} value={itemDraft[language] ?? (items || []).join('\n')} onChange={(event) => { setItemDraft({ ...itemDraft, [language]: event.target.value }); patch({ includedItems: { ...(Array.isArray(value.includedItems) ? { en: value.includedItems, cz: value.includedItems, pl: value.includedItems } : value.includedItems || {}), [language]: lines(event.target.value) } }); }}/></label>}
    <div><h4 className="font-semibold">Website preview</h4><ul className="list-disc pl-5">{preview.map((item: string, index: number) => <li key={index}>{item}</li>)}</ul>{!preview.length && <p className="text-sm text-gray-500">No included items configured for this language.</p>}</div>
    <p className="text-sm text-gray-500">Save pricing to save this retreat’s website content. Dates, pricing, and availability come from the retreat records.</p>
  </section>;
}
