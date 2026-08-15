import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { FiSave } from 'react-icons/fi';
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
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([retreatsApi.getOne(retreatId), housesApi.getAll()]).then(([retreatResponse, houseResponse]) => {
      const item = retreatResponse.data;
      setRetreat(item);
      setForm({ ...item, code: item.code || item.retreatCode, retreatCode: item.code || item.retreatCode, location_town: item.location_town || item.locationTown || item.location, location: item.location_town || item.locationTown || item.location });
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
  const save = async () => {
    const town = String(form.location_town || form.locationTown || form.location || '').trim();
    if (!form.name?.trim() || !town || !form.startDate || !form.endDate || !form.capacity) { setError('Name, location, dates, and capacity are required.'); return; }
    setSaving(true); setError('');
    try {
      const code = form.code?.trim() || form.retreatCode?.trim() || undefined;
      await retreatsApi.update(retreatId, {
        name: form.name.trim(), code, retreatCode: code, location_town: town, location: town,
        houseId: idOf(form.houseId) || undefined, ceremonyCount: Number(form.ceremonyCount || 2),
        capacity: Number(form.capacity), currentOccupancy: Number(form.currentOccupancy || 0),
        type: form.type || 'regular', description: form.description || '', startDate: form.startDate,
        startTime: form.startTime || undefined, endDate: form.endDate, endTime: form.endTime || undefined,
        status: form.status || 'upcoming', backgroundColor: form.backgroundColor, textColor: form.textColor,
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
  const field = 'w-full border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600';
  const label = 'mb-1.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-gray-600';
  const code = form.code || form.retreatCode || 'Retreat';
  const nights = retreatLength(form.startDate, form.endDate);
  const startsIn = daysUntil(form.startDate);
  const occupancy = Number(form.currentOccupancy || 0);
  const capacity = Number(form.capacity || 0);
  const accent = form.backgroundColor || '#2563eb';
  const SectionTitle = ({ number, title, detail }: { number: string; title: string; detail: string }) => <div className="mb-4 flex gap-4"><span className="w-10 shrink-0 text-3xl font-semibold leading-none text-gray-300">{number}</span><div><h2 className="text-base font-bold text-gray-950">{title}</h2><p className="text-xs text-gray-500">{detail}</p></div></div>;
  const actions = <><button type="button" onClick={goBack} className="min-h-10 border border-gray-300 bg-white px-5 text-sm font-medium">Cancel</button><button type="button" disabled={saving || deleting} onClick={save} className="inline-flex min-h-10 items-center justify-center gap-2 bg-gray-950 px-5 text-sm font-semibold text-white disabled:opacity-50"><Icon component={FiSave}/>{saving ? 'Saving…' : 'Save changes'}</button></>;

  return <main className="mx-auto min-h-full max-w-7xl border-t-4 border-blue-600 bg-[#f7f7f7] text-gray-900">
    <header className="flex flex-col gap-4 border-b border-gray-900 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-8">
      <div className="flex flex-col items-start gap-3 md:flex-row md:items-center"><span className="inline-flex min-h-10 items-center bg-blue-600 px-4 text-xs font-bold text-white">{code}</span><div><h1 className="text-2xl font-bold leading-tight">Edit retreat</h1><p className="mt-1 text-xs text-gray-600">{shortDate(form.startDate)} – {shortDate(form.endDate)}, {new Date(form.endDate || '').getFullYear() || ''} · {form.location_town || form.location || 'No location'} · {occupancy} of {capacity || 0} places taken</p></div></div>
      <div className="hidden items-center gap-2 md:flex"><span className="mr-1 rounded-full border border-green-300 bg-green-50 px-3 py-1 text-[10px] uppercase tracking-widest text-green-700">All saved</span>{actions}</div>
    </header>
    {error && <div className="mx-5 mt-5 border border-red-300 bg-red-50 p-3 text-sm text-red-800 md:mx-8">{error}</div>}
    <div className="divide-y divide-gray-300 px-5 md:px-8">
      <section className="py-6"><SectionTitle number="01" title="Identity" detail="How this retreat is named and coded everywhere else in the system."/><div className="grid gap-4 pl-0 md:grid-cols-[1fr_1fr_180px] md:pl-14">
        <label><span className={label}>Name *</span><input className={field} value={form.name || ''} onChange={(e) => set({ name: e.target.value })}/></label>
        <label><span className={label}>Code *</span><input className={field} value={code} onChange={(e) => set({ code: e.target.value, retreatCode: e.target.value })}/></label>
        <label><span className={label}>Status</span><select className={field} value={form.status || 'upcoming'} onChange={(e) => set({ status: e.target.value as Retreat['status'] })}><option value="upcoming">Upcoming</option><option value="active">Active</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
        <label className="md:col-span-3"><span className={label}>Description</span><textarea className={field} rows={2} placeholder="Optional note shown to staff only" value={form.description || ''} onChange={(e) => set({ description: e.target.value })}/></label>
      </div></section>

      <section className="py-6"><SectionTitle number="02" title="Schedule" detail="Requirement deadlines count backwards from the start date."/><div className="border-l-2 border-blue-500 bg-white p-4 md:ml-14">
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

      <section className="py-6"><SectionTitle number="04" title="Colour code" detail="The colour identifies this retreat in lists, calendars and booking rows. Pick one and see it in place."/><div className="grid gap-5 md:ml-14 md:grid-cols-[1fr_320px]">
        <div><span className={label}>Palette</span><div className="flex flex-wrap gap-2">{PALETTE.map((color) => <button key={color} type="button" aria-label={`Use colour ${color}`} onClick={() => set({ backgroundColor: color, textColor: '#ffffff' })} className="flex h-9 w-9 items-center justify-center border border-black/10 text-white" style={{ backgroundColor: color }}>{accent.toLowerCase() === color && '✓'}</button>)}</div><label className="mt-4 flex items-center gap-3"><span className={label}>Hex</span><input aria-label="Colour hex" className="w-28 border border-gray-300 bg-white px-3 py-2 text-sm" value={accent} onChange={(e) => set({ backgroundColor: e.target.value })}/><span className="text-xs text-gray-500">Dark colour — chip text prints white</span></label></div>
        <div><span className={label}>Preview</span><div className="border border-gray-300 bg-white p-4"><div className="flex items-center gap-3 border border-gray-200 p-3"><span className="px-3 py-2 text-xs font-bold" style={{ backgroundColor: accent, color: form.textColor || '#fff' }}>{code}</span><div><strong className="block text-sm">{shortDate(form.startDate)} – {shortDate(form.endDate)}, {new Date(form.endDate || '').getFullYear() || ''}</strong><span className="text-xs text-gray-500">{occupancy} / {capacity || 0} places · {form.location_town || form.location}</span></div></div><div className="mt-3 h-2 bg-gray-200"><div className="h-full" style={{ backgroundColor: accent, width: `${capacity ? Math.min(100, occupancy / capacity * 100) : 0}%` }}/></div><p className="mt-3 text-xs text-gray-600"><span className="mr-2 inline-block h-3 w-3 rounded-full" style={{ backgroundColor: accent }}/>Calendar dot and booking row accent</p></div></div>
      </div></section>
    </div>
    <footer className="sticky bottom-0 flex items-center justify-between border-t border-gray-300 bg-[#fffafa]/95 px-5 py-4 backdrop-blur md:px-8"><button type="button" disabled={deleting} onClick={remove} className="hidden text-xs text-red-700 underline md:block">{deleting ? 'Deleting…' : 'Delete retreat'}</button><div className="ml-auto flex flex-1 gap-2 md:flex-none"><button type="button" onClick={goBack} className="min-h-10 flex-1 border border-gray-300 bg-white px-5 text-sm font-medium md:flex-none">Cancel</button><button type="button" disabled={saving || deleting} onClick={save} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 bg-gray-950 px-5 text-sm font-semibold text-white disabled:opacity-50 md:flex-none"><Icon component={FiSave}/>{saving ? 'Saving…' : 'Save changes'}</button></div></footer>
  </main>;
};

export default RetreatEditorPage;
