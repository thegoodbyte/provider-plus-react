import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { FiDollarSign, FiSave } from 'react-icons/fi';
import { housesApi, retreatsApi } from '../services/api';
import { House, Retreat } from '../types';
import LoadingSpinner from './LoadingSpinner';

const Icon: React.FC<{ component: any }> = ({ component }) => React.createElement(component);

const idOf = (value: any) => typeof value === 'object' ? value?._id || value?.id || '' : value || '';
const dateValue = (value?: string | Date) => value ? new Date(value).toISOString().slice(0, 10) : '';
const shortDate = (value?: string | Date) => { const date = value ? new Date(value) : null; return date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date) : '—'; };
const retreatLength = (start?: string | Date, end?: string | Date) => start && end ? Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000)) : 0;
const daysUntil = (value?: string | Date) => value ? Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000)) : 0;
const PALETTE = ['#2563eb', '#38a9df', '#34998c', '#a8b58f', '#78d10f', '#f59e0b', '#df8b4d', '#c73d0b', '#e61b4d', '#8257ee', '#6366e9', '#a8a29e'];

const RetreatEditorPage: React.FC = () => {
  const { retreatId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const prefix = useMemo(() => { const first = location.pathname.split('/').filter(Boolean)[0]; return ['admin', 'medical', 'staff', 'user'].includes(first) ? `/${first}` : ''; }, [location.pathname]);
  const [retreat, setRetreat] = useState<Retreat | null>(null);
  const [form, setForm] = useState<Partial<Retreat>>({});
  const [houses, setHouses] = useState<House[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [heroUploading, setHeroUploading] = useState(false);
  const [websitePricingText, setWebsitePricingText] = useState('{}');
  const [websiteContentText, setWebsiteContentText] = useState('{}');
  const [plPrices, setPlPrices] = useState({ closeShared: 9500, closePrivate: 10500, closeEnsuite: 11500, midShared: 8500, midPrivate: 9500, midEnsuite: 10500, farShared: 7500, farPrivate: 8500, farEnsuite: 9500, addictionSupport: 1500 });
  const [plIncluded, setPlIncluded] = useState('');
  const [staffText, setStaffText] = useState('[]');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([retreatsApi.getOne(retreatId), housesApi.getAll()]).then(([retreatResponse, houseResponse]) => {
      const item = retreatResponse.data;
      setRetreat(item);
      setForm({ ...item, code: item.code || item.retreatCode, retreatCode: item.code || item.retreatCode, location_town: item.location_town || item.locationTown || item.location, location: item.location_town || item.locationTown || item.location });
      setWebsitePricingText(JSON.stringify(item.websitePricing || {}, null, 2));
      setWebsiteContentText(JSON.stringify(item.websiteContent || {}, null, 2));
      const pl = item.websitePricing?.byRegion?.pl || item.websitePricing?.pl || {};
      const tiers = Array.isArray(pl.tiers) ? pl.tiers : [];
      const tier = (key: string, index: number) => tiers.find((entry: any) => entry.key === key) || tiers[index] || {};
      const close = tier('0_3', 0), mid = tier('4_6', 1), far = tier('6_plus', 2);
      setPlPrices({ closeShared: Number(close.sharedRoom ?? 9500), closePrivate: Number(close.privateRoom ?? 10500), closeEnsuite: Number(close.privateEnsuite ?? 11500), midShared: Number(mid.sharedRoom ?? 8500), midPrivate: Number(mid.privateRoom ?? 9500), midEnsuite: Number(mid.privateEnsuite ?? 10500), farShared: Number(far.sharedRoom ?? 7500), farPrivate: Number(far.privateRoom ?? 8500), farEnsuite: Number(far.privateEnsuite ?? 9500), addictionSupport: Number(pl.addictionSupport ?? 1500) });
      const included = item.websiteContent?.includedItems?.pl || (Array.isArray(item.websiteContent?.includedItems) ? item.websiteContent.includedItems : []);
      setPlIncluded((included || []).join('\n'));
      setStaffText(JSON.stringify(item.retreatStaff || [], null, 2));
      setHouses(houseResponse.data || []);
    }).catch((cause) => setError(cause?.response?.data?.message || cause?.message || 'Unable to load retreat.')).finally(() => setLoading(false));
  }, [retreatId]);

  const set = (patch: Partial<Retreat>) => setForm((current) => ({ ...current, ...patch }));
  const goBack = () => navigate(`${prefix}/retreats/${retreatId}`);
  const selectHouse = (houseId: string) => {
    const house = houses.find((candidate) => candidate._id === houseId);
    const town = house?.generalTown || house?.general_town || house?.city || house?.name || '';
    set({ houseId, ...(town ? { location_town: town, location: town } : {}) });
  };
  const uploadHero = async (file?: File) => {
    if (!file) return;
    setHeroUploading(true); setError('');
    try {
      const response = await retreatsApi.uploadHeroImage(retreatId, file);
      setForm((current) => ({ ...current, ...(response.data.retreat || {}) }));
    } catch (cause: any) { setError(cause?.response?.data?.message || cause?.message || 'Unable to upload hero image.'); }
    finally { setHeroUploading(false); }
  };
  const save = async () => {
    const town = String(form.location_town || form.locationTown || form.location || '').trim();
    const start = form.startDate ? new Date(form.startDate).getTime() : NaN;
    const end = form.endDate ? new Date(form.endDate).getTime() : NaN;
    const capacityValue = Number(form.capacity);
    const occupancyValue = Number(form.currentOccupancy || 0);
    const commission = form.referralCommissionPercentage;
    if (!form.name?.trim() || !code.trim() || !town || !form.startDate || !form.endDate || !Number.isInteger(capacityValue) || capacityValue < 1) { setError('Name, code, location, dates, and a positive whole-number capacity are required.'); return; }
    if (!(start < end)) { setError('End date and time must be after the start date and time.'); return; }
    if (capacityValue < occupancyValue) { setError(`Capacity cannot be below current occupancy (${occupancyValue}).`); return; }
    if (commission !== null && commission !== undefined && (!Number.isFinite(Number(commission)) || Number(commission) < 0 || Number(commission) > 100)) { setError('Referral commission override must be between 0 and 100%.'); return; }
    let websitePricing: Record<string, any>, websiteContent: Record<string, any>, retreatStaff: any[];
    try { websitePricing = JSON.parse(websitePricingText || '{}'); websiteContent = JSON.parse(websiteContentText || '{}'); retreatStaff = JSON.parse(staffText || '[]'); } catch { setError('Website pricing, content, and staff fields must contain valid JSON.'); return; }
    if (!websitePricing || Array.isArray(websitePricing) || !websiteContent || Array.isArray(websiteContent) || !Array.isArray(retreatStaff)) { setError('Website pricing and content must be JSON objects, and staff must be a JSON array.'); return; }
    setSaving(true); setError('');
    try {
      websitePricing = { ...websitePricing, byRegion: { ...(websitePricing.byRegion || {}), pl: { ...(websitePricing.byRegion?.pl || websitePricing.pl || {}), currency: 'PLN', symbol: 'zł', format: '{price} {symbol}', addictionSupport: Number(plPrices.addictionSupport), tiers: [
        { key: '0_3', label: '0–3 months', daysFrom: 0, daysTo: 90, sharedRoom: Number(plPrices.closeShared), privateRoom: Number(plPrices.closePrivate), privateEnsuite: Number(plPrices.closeEnsuite) },
        { key: '4_6', label: '4–6 months', daysFrom: 91, daysTo: 180, sharedRoom: Number(plPrices.midShared), privateRoom: Number(plPrices.midPrivate), privateEnsuite: Number(plPrices.midEnsuite) },
        { key: '6_plus', label: '6+ months', daysFrom: 181, daysTo: null, sharedRoom: Number(plPrices.farShared), privateRoom: Number(plPrices.farPrivate), privateEnsuite: Number(plPrices.farEnsuite) },
      ] } } };
      websiteContent = { ...websiteContent, includedItems: { ...(Array.isArray(websiteContent.includedItems) ? { en: websiteContent.includedItems } : websiteContent.includedItems || {}), pl: plIncluded.split('\n').map(item => item.trim()).filter(Boolean) } };
      const code = form.code?.trim() || form.retreatCode?.trim() || undefined;
      await retreatsApi.update(retreatId, {
        name: form.name.trim(), code, retreatCode: code, location_town: town, location: town,
        houseId: idOf(form.houseId) || undefined, ceremonyCount: Number(form.ceremonyCount || 2),
        capacity: Number(form.capacity), currentOccupancy: Number(form.currentOccupancy || 0),
        type: form.type || 'regular', description: form.description || '', startDate: form.startDate,
        startTime: form.startTime || undefined, endDate: form.endDate, endTime: form.endTime || undefined,
        status: form.status || 'upcoming', backgroundColor: form.backgroundColor, textColor: form.textColor,
        helpers: form.helpers || '', retreatStaff, showOnSite: form.showOnSite !== false,
        websitePricing, websiteContent, referralCommissionPercentage: commission == null ? null : Number(commission),
      });
      goBack();
    } catch (cause: any) { const message = cause?.response?.data?.message || cause?.message || 'Unable to save retreat.'; setError(Array.isArray(message) ? message.join(' ') : String(message)); }
    finally { setSaving(false); }
  };
  const remove = async () => {
    if (!window.confirm(`Delete retreat “${form.name || form.code}”? This cannot be undone.`)) return;
    setDeleting(true); setError('');
    try { await retreatsApi.delete(retreatId); navigate(`${prefix}/retreats`); }
    catch (cause: any) { setError(cause?.response?.data?.message || cause?.message || 'Unable to delete retreat.'); setDeleting(false); }
  };

  if (loading) return <LoadingSpinner message="Loading retreat…" />;
  if (!retreat) return <div className="p-6"><div className="alert alert-danger">{error || 'Retreat not found.'}</div><button onClick={() => navigate(`${prefix}/retreats`)}>Back to retreats</button></div>;
  const field = 'w-full border border-[#aeb5bf] bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600';
  const label = 'mb-1.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-gray-600';
  const code = form.code || form.retreatCode || 'Retreat';
  const nights = retreatLength(form.startDate, form.endDate);
  const startsIn = daysUntil(form.startDate);
  const occupancy = Number(form.currentOccupancy || 0);
  const capacity = Number(form.capacity || 0);
  const accent = form.backgroundColor || '#2563eb';
  const SectionTitle = ({ number, title, detail }: { number: string; title: string; detail: string }) => <div className="mb-4 flex gap-4"><span className="w-10 shrink-0 text-3xl font-semibold leading-none text-gray-300">{number}</span><div><h2 className="text-base font-bold text-gray-950">{title}</h2><p className="text-xs text-gray-500">{detail}</p></div></div>;
  const actions = <><button type="button" onClick={goBack} className="min-h-10 border border-gray-300 bg-white px-5 text-sm font-medium">Cancel</button><button type="button" disabled={saving || deleting} onClick={save} className="inline-flex min-h-10 items-center justify-center gap-2 bg-gray-950 px-5 text-sm font-semibold text-white disabled:opacity-50"><Icon component={FiSave}/>{saving ? 'Saving…' : 'Save changes'}</button></>;

  return <main data-testid="retreat-editor-workspace" className="mx-auto min-h-full max-w-7xl border-t-4 border-blue-600 bg-[#eceff3] text-gray-900">
    <header className="flex flex-col gap-4 border-b border-gray-900 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-8">
      <div className="flex flex-col items-start gap-3 md:flex-row md:items-center"><span className="inline-flex min-h-10 items-center bg-blue-600 px-4 text-xs font-bold text-white">{code}</span><div><h1 className="text-2xl font-bold leading-tight">Edit retreat</h1><p className="mt-1 text-xs text-gray-600">{shortDate(form.startDate)} – {shortDate(form.endDate)}, {new Date(form.endDate || '').getFullYear() || ''} · {form.location_town || form.location || 'No location'} · {occupancy} of {capacity || 0} places taken</p></div></div>
      <div className="hidden items-center gap-2 md:flex"><button type="button" onClick={() => navigate(`${prefix}/retreats/${retreatId}/pricing`)} className="inline-flex min-h-10 items-center gap-2 border border-blue-300 bg-blue-50 px-4 text-sm font-semibold text-blue-800"><Icon component={FiDollarSign}/>Pricing &amp; website</button><span className="mr-1 rounded-full border border-green-300 bg-green-50 px-3 py-1 text-[10px] uppercase tracking-widest text-green-700">All saved</span>{actions}</div>
    </header>
    {error && <div className="mx-5 mt-5 border border-red-300 bg-red-50 p-3 text-sm text-red-800 md:mx-8">{error}</div>}
    <div className="divide-y divide-gray-300 px-5 md:px-8">
      <section className="py-6"><SectionTitle number="01" title="Identity" detail="How this retreat is named and coded everywhere else in the system."/><div className="grid gap-4 pl-0 md:grid-cols-[1fr_1fr_180px] md:pl-14">
        <label><span className={label}>Name *</span><input className={field} value={form.name || ''} onChange={(e) => set({ name: e.target.value })}/></label>
        <label><span className={label}>Code *</span><input className={field} value={code} onChange={(e) => set({ code: e.target.value, retreatCode: e.target.value })}/></label>
        <label><span className={label}>Status</span><select className={field} value={form.status || 'upcoming'} onChange={(e) => set({ status: e.target.value as Retreat['status'] })}><option value="upcoming">Upcoming</option><option value="active">Active</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
        <label className="md:col-span-3"><span className={label}>Description</span><textarea className={field} rows={2} placeholder="Optional note shown to staff only" value={form.description || ''} onChange={(e) => set({ description: e.target.value })}/></label>
      </div></section>

      <section className="py-6"><SectionTitle number="02" title="Schedule" detail="Requirement deadlines count backwards from the start date."/><div className="border border-[#c4cad2] border-l-2 border-l-blue-500 bg-white p-4 md:ml-14">
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-[auto_150px_100px_auto_150px_100px] md:items-end"><span className="hidden pb-3 text-sm md:block">Runs</span><label><span className={`${label} md:hidden`}>Start date *</span><input aria-label="Start date" className={field} type="date" value={dateValue(form.startDate)} onChange={(e) => set({ startDate: e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : undefined })}/></label><label><span className={`${label} md:hidden`}>Start time</span><input aria-label="Start time" className={field} type="time" value={form.startTime || ''} onChange={(e) => set({ startTime: e.target.value || undefined })}/></label><span className="hidden pb-3 text-sm md:block">until</span><label><span className={`${label} md:hidden`}>End date *</span><input aria-label="End date" className={field} type="date" value={dateValue(form.endDate)} onChange={(e) => set({ endDate: e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : undefined })}/></label><label><span className={`${label} md:hidden`}>End time</span><input aria-label="End time" className={field} type="time" value={form.endTime || ''} onChange={(e) => set({ endTime: e.target.value || undefined })}/></label></div>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-300 pt-4 md:grid-cols-3"><div><span className={label}>Length</span><strong>{nights} nights</strong></div><div className="md:border-l md:border-gray-300 md:pl-5"><span className={label}>Starts in</span><strong className="text-amber-700">{startsIn} days</strong></div><div className="col-span-2 md:col-span-1 md:border-l md:border-gray-300 md:pl-5"><span className={label}>Medical cut-off</span><strong>{shortDate(new Date(new Date(form.startDate || '').getTime() - 7 * 86_400_000))}</strong><span className="ml-1 text-xs text-gray-500">7 days before</span></div></div>
      </div></section>

      <section className="py-6"><SectionTitle number="03" title="Place and capacity" detail={`${occupancy} bookings already sit against this retreat. Lowering capacity below ${occupancy} will flag those bookings.`}/><div className="grid gap-4 md:ml-14 md:grid-cols-6">
        <label className="md:col-span-3"><span className={label}>House</span><select className={field} value={idOf(form.houseId)} onChange={(e) => selectHouse(e.target.value)}><option value="">Select a house</option>{houses.map((house) => <option key={house._id} value={house._id}>{house.name}{house.address ? ` — ${house.address}` : ''}</option>)}</select></label>
        <label className="md:col-span-3"><span className={label}>Location town *</span><input className={field} value={form.location_town || form.location || ''} onChange={(e) => set({ location_town: e.target.value, location: e.target.value })}/></label>
        <label><span className={label}>Capacity *</span><input className={field} type="number" min="1" value={form.capacity ?? ''} onChange={(e) => set({ capacity: Number(e.target.value) || undefined })}/></label>
        <label><span className={label}>Ceremonies</span><input className={field} type="number" min="1" value={form.ceremonyCount ?? 2} onChange={(e) => set({ ceremonyCount: Math.max(1, Number(e.target.value) || 2) })}/></label>
        <label><span className={label}>Type</span><select className={field} value={form.type || 'regular'} onChange={(e) => set({ type: e.target.value as Retreat['type'] })}><option value="regular">Regular</option><option value="booster">Booster</option></select></label>
        <div className="md:col-span-3"><span className={label}>Fill right now</span><div className="flex items-center gap-3"><div className="h-3 flex-1 bg-gray-200"><div className="h-full bg-blue-600" style={{ width: `${capacity ? Math.min(100, occupancy / capacity * 100) : 0}%` }}/></div><strong className="whitespace-nowrap text-sm">{occupancy} / {capacity || 0} places</strong></div></div>
      </div></section>

      <section className="py-6"><SectionTitle number="04" title="Operations and commission" detail="Operational details and the optional referral rate used for every booking in this retreat."/><div className="grid gap-4 md:ml-14 md:grid-cols-6">
        <label className="md:col-span-3"><span className={label}>Helpers / operational notes</span><textarea className={field} rows={3} value={form.helpers || ''} onChange={(e) => set({ helpers: e.target.value })} placeholder="Internal staffing or operational notes"/></label>
        <label className="md:col-span-3"><span className={label}>Referral commission override (%)</span><input className={field} type="number" min="0" max="100" step="0.01" value={form.referralCommissionPercentage ?? ''} onChange={(e) => set({ referralCommissionPercentage: e.target.value === '' ? null : Number(e.target.value) })} placeholder="Inherit referral default"/><span className="mt-1 block text-xs text-gray-500">Leave blank to inherit the referral partner’s default. A client-specific override still takes priority.</span></label>
        <label className="flex items-center gap-3 md:col-span-3"><input aria-label="Show on website" type="checkbox" checked={form.showOnSite !== false} onChange={(e) => set({ showOnSite: e.target.checked })}/><span><strong className="block text-sm">Show on public website</strong><span className="text-xs text-gray-500">Hide cancelled or private retreats without deleting them.</span></span></label>
        <label className="md:col-span-3"><span className={label}>Retreat staff (advanced JSON)</span><textarea className={`${field} font-mono text-xs`} rows={3} value={staffText} onChange={(e) => setStaffText(e.target.value)}/></label>
      </div></section>

      <section className="py-6"><SectionTitle number="05" title="Website content" detail="Control public pricing/content and the hero image associated with this retreat."/><div className="grid gap-4 md:ml-14 md:grid-cols-2">
        <div className="md:col-span-2 flex flex-col gap-3 border border-blue-200 bg-blue-50 p-4 md:flex-row md:items-center md:justify-between"><div><h3 className="font-bold">Pricing and public offer have their own workspace</h3><p className="text-xs text-gray-600">Manage the 0–3, 4–6 and 6+ month matrix, room options, addiction support and included items separately.</p></div><button type="button" onClick={() => navigate(`${prefix}/retreats/${retreatId}/pricing`)} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 bg-blue-700 px-5 text-sm font-semibold text-white"><Icon component={FiDollarSign}/>Open pricing &amp; website</button></div>
        <details><summary className="cursor-pointer text-xs font-semibold text-gray-600">Advanced website pricing JSON</summary><textarea aria-label="Website pricing" className={`${field} mt-2 font-mono text-xs`} rows={7} value={websitePricingText} onChange={(e) => setWebsitePricingText(e.target.value)}/></details>
        <details><summary className="cursor-pointer text-xs font-semibold text-gray-600">Advanced website content JSON</summary><textarea aria-label="Website content" className={`${field} mt-2 font-mono text-xs`} rows={7} value={websiteContentText} onChange={(e) => setWebsiteContentText(e.target.value)}/></details>
        <div className="md:col-span-2"><span className={label}>Hero image</span><div className="flex flex-wrap items-center gap-3"><input aria-label="Hero image" type="file" accept="image/*" disabled={heroUploading} onChange={(e) => uploadHero(e.target.files?.[0])}/>{heroUploading && <span className="text-sm text-gray-500">Uploading…</span>}<span className="text-xs text-gray-500">Images up to 8 MB. Uploading saves the image immediately; save the form for the remaining fields.</span></div>{form.heroImageFileName && <div className="mt-2 flex items-center gap-3 text-xs text-gray-600"><span>Current image: {form.heroImageFileName}</span><button type="button" className="text-red-700 underline" onClick={async () => { await retreatsApi.clearHeroImage(retreatId); set({ heroImageFileName: '', heroImageS3Key: '' }); }}>Remove image</button></div>}</div>
      </div></section>

      <section className="py-6"><SectionTitle number="06" title="Colour code" detail="The colour identifies this retreat in lists, calendars and booking rows. Pick one and see it in place."/><div className="grid gap-5 md:ml-14 md:grid-cols-[1fr_320px]">
        <div><span className={label}>Palette</span><div className="flex flex-wrap gap-2">{PALETTE.map((color) => <button key={color} type="button" aria-label={`Use colour ${color}`} onClick={() => set({ backgroundColor: color, textColor: '#ffffff' })} className="flex h-9 w-9 items-center justify-center border border-black/20 text-white" style={{ backgroundColor: color }}>{accent.toLowerCase() === color && '✓'}</button>)}</div><label className="mt-4 flex items-center gap-3"><span className={label}>Hex</span><input aria-label="Colour hex" className="w-28 border border-[#aeb5bf] bg-white px-3 py-2 text-sm" value={accent} onChange={(e) => set({ backgroundColor: e.target.value })}/><span className="text-xs text-gray-500">Dark colour — chip text prints white</span></label></div>
        <div><span className={label}>Preview</span><div className="border border-gray-300 bg-white p-4"><div className="flex items-center gap-3 border border-gray-200 p-3"><span className="px-3 py-2 text-xs font-bold" style={{ backgroundColor: accent, color: form.textColor || '#fff' }}>{code}</span><div><strong className="block text-sm">{shortDate(form.startDate)} – {shortDate(form.endDate)}, {new Date(form.endDate || '').getFullYear() || ''}</strong><span className="text-xs text-gray-500">{occupancy} / {capacity || 0} places · {form.location_town || form.location}</span></div></div><div className="mt-3 h-2 bg-gray-200"><div className="h-full" style={{ backgroundColor: accent, width: `${capacity ? Math.min(100, occupancy / capacity * 100) : 0}%` }}/></div><p className="mt-3 text-xs text-gray-600"><span className="mr-2 inline-block h-3 w-3 rounded-full" style={{ backgroundColor: accent }}/>Calendar dot and booking row accent</p></div></div>
      </div></section>
    </div>
    <footer className="sticky bottom-0 flex items-center justify-between border-t border-gray-300 bg-[#fffafa]/95 px-5 py-4 backdrop-blur md:px-8"><button type="button" disabled={deleting} onClick={remove} className="hidden text-xs text-red-700 underline md:block">{deleting ? 'Deleting…' : 'Delete retreat'}</button><div className="ml-auto flex flex-1 gap-2 md:flex-none"><button type="button" onClick={goBack} className="min-h-10 flex-1 border border-gray-300 bg-white px-5 text-sm font-medium md:flex-none">Cancel</button><button type="button" disabled={saving || deleting} onClick={save} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 bg-gray-950 px-5 text-sm font-semibold text-white disabled:opacity-50 md:flex-none"><Icon component={FiSave}/>{saving ? 'Saving…' : 'Save changes'}</button></div></footer>
  </main>;
};

export default RetreatEditorPage;
