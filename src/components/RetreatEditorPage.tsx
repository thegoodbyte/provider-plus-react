import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiSave } from 'react-icons/fi';
import { housesApi, retreatsApi } from '../services/api';
import { House, Retreat } from '../types';
import LoadingSpinner from './LoadingSpinner';

const Icon: React.FC<{ component: any }> = ({ component }) => React.createElement(component);

const idOf = (value: any) => typeof value === 'object' ? value?._id || value?.id || '' : value || '';
const dateValue = (value?: string | Date) => value ? new Date(value).toISOString().slice(0, 10) : '';

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

  if (loading) return <LoadingSpinner message="Loading retreat…" />;
  if (!retreat) return <div className="p-6"><div className="alert alert-danger">{error || 'Retreat not found.'}</div><button onClick={() => navigate(`${prefix}/retreats`)}>Back to retreats</button></div>;
  const field = 'w-full border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-gray-700 focus:outline-none';
  const label = 'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-600';
  return <main className="mx-auto max-w-5xl p-4 md:p-8">
    <header className="mb-6 flex items-start justify-between border-b border-gray-900 pb-5"><div><button type="button" onClick={goBack} className="mb-4 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"><Icon component={FiArrowLeft}/> Back to retreat</button><div className="text-xs uppercase tracking-[.16em] text-gray-500">{form.code || form.retreatCode || 'Retreat'}</div><h1 className="mt-1 text-3xl font-bold text-gray-900">Edit retreat</h1><p className="mt-1 text-sm text-gray-500">Update retreat identity, schedule, capacity and display settings.</p></div><span className="rounded-full border border-gray-300 px-3 py-1 text-xs uppercase tracking-wider text-gray-600">{form.status || 'upcoming'}</span></header>
    {error && <div className="alert alert-danger mb-5">{error}</div>}
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <section className="border border-gray-300 bg-white p-5 md:p-7"><h2 className="mb-5 text-lg font-semibold">Retreat details</h2><div className="grid gap-5 md:grid-cols-2">
        <label className="md:col-span-2"><span className={label}>Name *</span><input className={field} value={form.name || ''} onChange={(e) => set({ name: e.target.value })}/></label>
        <label><span className={label}>Code</span><input className={field} value={form.code || form.retreatCode || ''} onChange={(e) => set({ code: e.target.value, retreatCode: e.target.value })}/></label>
        <label><span className={label}>Status</span><select className={field} value={form.status || 'upcoming'} onChange={(e) => set({ status: e.target.value as Retreat['status'] })}><option value="upcoming">Upcoming</option><option value="active">Active</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
        <label><span className={label}>House</span><select className={field} value={idOf(form.houseId)} onChange={(e) => selectHouse(e.target.value)}><option value="">Select a house</option>{houses.map((house) => <option key={house._id} value={house._id}>{house.name} — {house.address}</option>)}</select></label>
        <label><span className={label}>Location town *</span><input className={field} value={form.location_town || form.location || ''} onChange={(e) => set({ location_town: e.target.value, location: e.target.value })}/></label>
        <label><span className={label}>Capacity *</span><input className={field} type="number" min="1" value={form.capacity ?? ''} onChange={(e) => set({ capacity: Number(e.target.value) || undefined })}/></label>
        <label><span className={label}>Type</span><select className={field} value={form.type || 'regular'} onChange={(e) => set({ type: e.target.value as Retreat['type'] })}><option value="regular">Regular</option><option value="booster">Booster</option></select></label>
        <label><span className={label}>Number of ceremonies</span><input className={field} type="number" min="1" value={form.ceremonyCount ?? 2} onChange={(e) => set({ ceremonyCount: Math.max(1, Number(e.target.value) || 2) })}/></label>
        <label className="md:col-span-2"><span className={label}>Description</span><textarea className={field} rows={4} value={form.description || ''} onChange={(e) => set({ description: e.target.value })}/></label>
      </div></section>
      <aside className="space-y-6"><section className="border border-gray-300 bg-white p-5"><h2 className="mb-4 text-lg font-semibold">Schedule</h2><div className="space-y-4">
        <label><span className={label}>Start date *</span><input className={field} type="date" value={dateValue(form.startDate)} onChange={(e) => set({ startDate: e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : undefined })}/></label>
        <label><span className={label}>Start time</span><input className={field} type="time" value={form.startTime || ''} onChange={(e) => set({ startTime: e.target.value || undefined })}/></label>
        <label><span className={label}>End date *</span><input className={field} type="date" value={dateValue(form.endDate)} onChange={(e) => set({ endDate: e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : undefined })}/></label>
        <label><span className={label}>End time</span><input className={field} type="time" value={form.endTime || ''} onChange={(e) => set({ endTime: e.target.value || undefined })}/></label>
      </div></section><section className="border border-gray-300 bg-white p-5"><h2 className="mb-4 text-lg font-semibold">List appearance</h2><div className="grid grid-cols-2 gap-4"><label><span className={label}>Accent</span><input type="color" className="h-11 w-full border border-gray-300" value={form.backgroundColor || '#3b82f6'} onChange={(e) => set({ backgroundColor: e.target.value })}/></label><label><span className={label}>Text</span><input type="color" className="h-11 w-full border border-gray-300" value={form.textColor || '#ffffff'} onChange={(e) => set({ textColor: e.target.value })}/></label></div></section></aside>
    </div>
    <footer className="sticky bottom-0 mt-6 flex justify-end gap-3 border-t border-gray-300 bg-white/95 px-4 py-4 backdrop-blur"><button type="button" onClick={goBack} className="border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold">Cancel</button><button type="button" disabled={saving} onClick={save} className="inline-flex items-center gap-2 bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Icon component={FiSave}/>{saving ? 'Saving…' : 'Save changes'}</button></footer>
  </main>;
};

export default RetreatEditorPage;
