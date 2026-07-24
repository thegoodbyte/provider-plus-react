import React, { useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, Plus, Save, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { bookingFlowApi } from '../services/api';

type Entry = { id?: string; name: string; category: string; instruction: string; taperPlan: string; dueDate: string; isBlocking: boolean };
const emptyEntry = (): Entry => ({ name: '', category: 'medication', instruction: '', taperPlan: '', dueDate: '', isBlocking: true });

const MedicationStopPlanPage: React.FC = () => {
  const { bookingId = '' } = useParams();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<Entry[]>([emptyEntry()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    bookingFlowApi.getMedicationStopPlan(bookingId).then(({ data }) => {
      setEntries((data || []).map((item: any) => ({
        id: item._id, name: item.title || '', category: item.metadata?.stopCategory || 'medication',
        instruction: item.description || '', taperPlan: item.metadata?.taperPlan || '',
        dueDate: item.dueDate ? new Date(item.dueDate).toISOString().slice(0, 10) : '', isBlocking: item.isBlocking !== false,
      })).filter((item: Entry) => item.name) || [emptyEntry()]);
    }).finally(() => setLoading(false));
  }, [bookingId]);

  const update = (index: number, changes: Partial<Entry>) => setEntries(current => current.map((entry, position) => position === index ? { ...entry, ...changes } : entry));
  const save = async () => {
    setSaving(true); setMessage('');
    try {
      await bookingFlowApi.saveMedicationStopPlan(bookingId, entries.filter(entry => entry.name || entry.instruction));
      setMessage('Plan saved. Calendar entries and automated reminders have been synchronized.');
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Could not save the plan.');
    } finally { setSaving(false); }
  };

  return <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-sky-50 p-5 md:p-8">
    <div className="mx-auto max-w-5xl">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-sm text-slate-600"><ArrowLeft size={16}/> Back to booking</button>
      <header className="mb-6 rounded-2xl border border-violet-200 bg-white/90 p-6 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-600"><CalendarDays size={17}/> Medical advisor tool</div>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Medication & substance stop plan</h1>
        <p className="mt-2 text-sm text-slate-600">Build the client’s dated preparation calendar. Each date becomes a booking requirement and receives the configured reminder sequence.</p>
        <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Enter only instructions approved by the medical advisor. The system never invents tapering or stopping advice.</div>
      </header>
      {loading ? <div className="p-10 text-center">Loading plan…</div> : <div className="space-y-4">
        {entries.map((entry, index) => <section key={index} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between"><strong>Calendar item {index + 1}</strong><button onClick={() => setEntries(current => current.filter((_, position) => position !== index))} className="rounded-lg p-2 text-rose-600"><Trash2 size={17}/></button></div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-slate-600">Medication or substance<input value={entry.name} onChange={event => update(index, { name: event.target.value })} className="mt-1 w-full rounded-xl border border-sky-200 px-3 py-2.5 outline-none focus:ring-2 focus:ring-sky-200"/></label>
            <label className="text-sm text-slate-600">Stop date<input type="date" value={entry.dueDate} onChange={event => update(index, { dueDate: event.target.value })} className="mt-1 w-full rounded-xl border border-sky-200 px-3 py-2.5 outline-none focus:ring-2 focus:ring-sky-200"/></label>
            <label className="text-sm text-slate-600">Category<select value={entry.category} onChange={event => update(index, { category: event.target.value })} className="mt-1 w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5"><option value="medication">Medication</option><option value="supplement">Supplement</option><option value="drug">Recreational substance</option><option value="alcohol">Alcohol</option><option value="other">Other</option></select></label>
            <label className="flex items-center gap-2 self-end rounded-xl bg-violet-50 px-3 py-3 text-sm"><input type="checkbox" checked={entry.isBlocking} onChange={event => update(index, { isBlocking: event.target.checked })}/> Required for medical clearance</label>
            <label className="text-sm text-slate-600 md:col-span-2">Instruction shown to client<textarea required value={entry.instruction} onChange={event => update(index, { instruction: event.target.value })} rows={3} className="mt-1 w-full rounded-xl border border-sky-200 px-3 py-2.5 outline-none focus:ring-2 focus:ring-sky-200"/></label>
            <label className="text-sm text-slate-600 md:col-span-2">Advisor-authored taper / wean-off detail (optional)<textarea value={entry.taperPlan} onChange={event => update(index, { taperPlan: event.target.value })} rows={2} className="mt-1 w-full rounded-xl border border-sky-200 px-3 py-2.5 outline-none focus:ring-2 focus:ring-sky-200"/></label>
          </div>
        </section>)}
        <div className="flex flex-wrap justify-between gap-3"><button onClick={() => setEntries(current => [...current, emptyEntry()])} className="flex items-center gap-2 rounded-xl border border-violet-300 bg-white px-4 py-2.5 text-sm font-semibold text-violet-700"><Plus size={17}/> Add calendar item</button><button disabled={saving} onClick={save} className="flex items-center gap-2 rounded-xl bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Save size={17}/> {saving ? 'Saving…' : 'Save & schedule reminders'}</button></div>
        {message && <div className="rounded-xl bg-white p-4 text-sm text-slate-700 shadow-sm">{message}</div>}
      </div>}
    </div>
  </div>;
};
export default MedicationStopPlanPage;
