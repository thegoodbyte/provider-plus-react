import React, { useEffect, useMemo, useState } from 'react';
import { Button, Input, Modal, Select, message } from 'antd';
import { Plus, Trash2 } from 'lucide-react';
import { bookingsApi, ceremoniesApi, retreatGuestLogApi } from '../services/api';
import { Ceremony, RetreatClient } from '../types';

const activityLabels: Record<string, string> = {
  drug_test: 'Drug test', blood_pressure: 'Blood pressure', ekg: 'EKG', sauna: 'Sauna',
  questionnaire_review: 'Questionnaire review', shower: 'Shower', journey: 'Journey', other: 'Other',
};
const idOf = (value: any) => typeof value === 'string' ? value : value?._id || value?.id || '';
const clientName = (booking: RetreatClient) => {
  const client: any = booking.clientId;
  return typeof client === 'object'
    ? [client.firstName || client.fname, client.lastName || client.lname].filter(Boolean).join(' ')
    : `Client ${String(client || '').slice(-6)}`;
};
const localDateTime = () => {
  const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return now.toISOString().slice(0, 16);
};

const RetreatGuestLog: React.FC<{ retreatId: string }> = ({ retreatId }) => {
  const [entries, setEntries] = useState<any[]>([]);
  const [bookings, setBookings] = useState<RetreatClient[]>([]);
  const [ceremonies, setCeremonies] = useState<Ceremony[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ bookingId: '', activityType: 'drug_test', occurredAt: localDateTime(), ceremonyId: '', notes: '' });

  const load = async () => {
    try {
      setLoading(true);
      const [logResponse, bookingResponse, ceremonyResponse] = await Promise.all([
        retreatGuestLogApi.getByRetreat(retreatId), bookingsApi.getByRetreatWithDetails(retreatId), ceremoniesApi.getByRetreat(retreatId),
      ]);
      setEntries(logResponse.data || []);
      setBookings((bookingResponse.data || []).filter((booking: RetreatClient) => String(booking.status || '').toLowerCase() !== 'cancelled'));
      setCeremonies(ceremonyResponse.data || []);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Failed to load retreat guest log');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [retreatId]);

  const bookingOptions = useMemo(() => bookings.map((booking) => ({
    value: idOf(booking), label: `#${booking.bookingNumber || '—'} · ${clientName(booking)}`,
  })), [bookings]);

  const submit = async () => {
    if (!form.bookingId || !form.occurredAt || (form.activityType === 'journey' && !form.ceremonyId)) {
      message.error(form.activityType === 'journey' ? 'Guest, time, and ceremony are required for a journey' : 'Guest and time are required');
      return;
    }
    try {
      setSaving(true);
      await retreatGuestLogApi.create({ ...form, retreatId, occurredAt: new Date(form.occurredAt).toISOString() });
      setOpen(false);
      setForm({ bookingId: '', activityType: 'drug_test', occurredAt: localDateTime(), ceremonyId: '', notes: '' });
      await load();
      message.success('Guest activity logged');
    } catch (error: any) { message.error(error?.response?.data?.message || 'Failed to save guest activity'); }
    finally { setSaving(false); }
  };

  const remove = async (entry: any) => {
    try { await retreatGuestLogApi.delete(entry._id); await load(); message.success('Log entry deleted'); }
    catch (error: any) { message.error(error?.response?.data?.message || 'Failed to delete log entry'); }
  };

  return <section className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4">
      <div><h2 className="text-xl font-semibold text-gray-900">Retreat guest log</h2><p className="text-sm text-gray-600">Chronological hands-on care and guest activities for this retreat.</p></div>
      <Button type="primary" icon={<Plus className="h-4 w-4"/>} onClick={() => setOpen(true)}>Log activity</Button>
    </div>
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      {loading ? <div className="p-8 text-center text-gray-500">Loading guest log…</div> : entries.length === 0 ? <div className="p-8 text-center text-gray-500">No guest activities logged yet.</div> :
        <div className="divide-y divide-gray-200">{entries.map((entry) => {
          const client: any = entry.clientId || {}; const booking: any = entry.bookingId || {}; const ceremony: any = entry.ceremonyId;
          const name = [client.firstName || client.fname, client.lastName || client.lname].filter(Boolean).join(' ') || 'Guest';
          return <article key={entry._id} className="grid gap-3 p-4 md:grid-cols-[170px_minmax(0,1fr)_auto] md:items-start">
            <time className="text-sm font-semibold text-gray-700">{new Date(entry.occurredAt).toLocaleString()}</time>
            <div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">{activityLabels[entry.activityType] || entry.activityType}</span><strong>{name}</strong><span className="text-sm text-gray-500">Booking #{booking.bookingNumber || '—'}</span></div>
              {ceremony && <div className="mt-1 text-sm font-medium text-purple-700">Ceremony #{ceremony.ceremonyNumber}</div>}
              {entry.notes && <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{entry.notes}</p>}
              <p className="mt-1 text-xs text-gray-500">Recorded by {entry.performedBy || 'staff'}</p>
            </div>
            <Button danger type="text" icon={<Trash2 className="h-4 w-4"/>} onClick={() => remove(entry)}>Delete</Button>
          </article>;
        })}</div>}
    </div>
    <Modal title="Log guest activity" open={open} onCancel={() => setOpen(false)} onOk={submit} confirmLoading={saving} okText="Save activity">
      <div className="space-y-4 pt-2">
        <label className="block text-sm font-medium">Guest / booking<Select showSearch optionFilterProp="label" className="mt-1 w-full" options={bookingOptions} value={form.bookingId || undefined} onChange={(bookingId) => setForm({ ...form, bookingId })} placeholder="Select guest"/></label>
        <label className="block text-sm font-medium">Activity<Select className="mt-1 w-full" value={form.activityType} options={Object.entries(activityLabels).map(([value, label]) => ({ value, label }))} onChange={(activityType) => setForm({ ...form, activityType, ceremonyId: activityType === 'journey' ? form.ceremonyId : '' })}/></label>
        <label className="block text-sm font-medium">Date and time<Input className="mt-1" type="datetime-local" value={form.occurredAt} onChange={(event) => setForm({ ...form, occurredAt: event.target.value })}/></label>
        {form.activityType === 'journey' && <label className="block text-sm font-medium">Ceremony<Select className="mt-1 w-full" value={form.ceremonyId || undefined} options={ceremonies.map((ceremony) => ({ value: idOf(ceremony), label: `Ceremony #${ceremony.ceremonyNumber}${ceremony.date ? ` · ${new Date(ceremony.date).toLocaleDateString()}` : ''}` }))} onChange={(ceremonyId) => setForm({ ...form, ceremonyId })} placeholder="Required"/></label>}
        <label className="block text-sm font-medium">Notes<Input.TextArea className="mt-1" rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Result, details, observations…"/></label>
      </div>
    </Modal>
  </section>;
};
export default RetreatGuestLog;
