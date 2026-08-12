import React, { useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, Plus, Save, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { bookingFlowApi } from '../services/api';

type Entry = { id?: string; name: string; category: string; action: string; instruction: string; internalNote: string; taperPlan: string; dueDate: string; daysBeforeRetreat: string; isBlocking: boolean };
const emptyEntry = (): Entry => ({ name: '', category: 'medication', action: 'stop', instruction: '', internalNote: '', taperPlan: '', dueDate: '', daysBeforeRetreat: '', isBlocking: true });

const MedicationStopPlanPage: React.FC = () => {
  const { bookingId = '' } = useParams();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<Entry[]>([emptyEntry()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [allClear, setAllClear] = useState(false);
  const [allClearNote, setAllClearNote] = useState('');
  const [lifecycle, setLifecycle] = useState('draft'); const [overallClientMessage, setOverallClientMessage] = useState(''); const [internalMedicalNote, setInternalMedicalNote] = useState(''); const [remindersPaused, setRemindersPaused] = useState(false); const [source, setSource] = useState(() => { const params = new URLSearchParams(window.location.search); return { medicationFormId: params.get('medicationFormId') || '', artifactId: params.get('artifactId') || '', medicalReviewRequestId: params.get('medicalReviewRequestId') || '' }; });

  useEffect(() => {
    bookingFlowApi.getMedicationStopPlan(bookingId).then(({ data }) => {
      const allClearItem = (data || []).find((item: any) => item.metadata?.medicationStopPlanAllClear && item.status !== 'cancelled');
      setAllClear(Boolean(allClearItem));
      setAllClearNote(allClearItem?.description || '');
      const metadata = (data || [])[0]?.metadata || {}; setLifecycle(metadata.planLifecycle || 'published'); setOverallClientMessage(metadata.overallClientMessage || ''); setInternalMedicalNote(metadata.internalMedicalNote || ''); setRemindersPaused(Boolean(metadata.remindersPaused)); setSource(current => ({ medicationFormId: metadata.medicationFormId || current.medicationFormId, artifactId: metadata.artifactId || current.artifactId, medicalReviewRequestId: metadata.medicalReviewRequestId || current.medicalReviewRequestId }));
      const mapped = (data || []).filter((item: any) => !item.metadata?.medicationStopPlanAllClear).map((item: any) => ({
        id: item._id, name: item.title || '', category: item.metadata?.stopCategory || 'medication',
        instruction: item.description || '', internalNote: item.metadata?.internalNote || '', action: item.metadata?.action || 'stop', taperPlan: item.metadata?.taperPlan || '', daysBeforeRetreat: item.metadata?.daysBeforeRetreat === undefined ? '' : String(item.metadata.daysBeforeRetreat),
        dueDate: item.dueDate ? new Date(item.dueDate).toISOString().slice(0, 10) : '', isBlocking: item.isBlocking !== false,
      })).filter((item: Entry) => item.name);
      setEntries(mapped.length ? mapped : [emptyEntry()]);
    }).finally(() => setLoading(false));
  }, [bookingId]);

  const update = (index: number, changes: Partial<Entry>) => setEntries(current => current.map((entry, position) => position === index ? { ...entry, ...changes } : entry));
  const save = async () => {
    setSaving(true); setMessage('');
    try {
      const { data } = await bookingFlowApi.saveMedicationStopPlan(bookingId, allClear ? [] : entries.filter(entry => entry.name || entry.instruction), allClear, allClearNote, { overallClientMessage, internalMedicalNote, remindersPaused, ...source }); setLifecycle(data?.[0]?.metadata?.planLifecycle || 'draft');
      setMessage('Draft saved. It is private until medically approved and explicitly published.');
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
        <div className="mt-3 font-semibold">Status: {lifecycle.replace(/_/g, ' ')}</div>
      </header>
      {loading ? <div className="p-10 text-center">Loading plan…</div> : <div className="space-y-4">
        <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-2"><label className="text-sm">General message shown to client<textarea value={overallClientMessage} onChange={e=>setOverallClientMessage(e.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label><label className="text-sm">Internal medical note — never shown in IR<textarea value={internalMedicalNote} onChange={e=>setInternalMedicalNote(e.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label>{(['medicationFormId','artifactId','medicalReviewRequestId'] as const).map(key=><label key={key} className="text-sm">{key.replace(/Id$/,' ID')}<input value={source[key]} onChange={e=>setSource({...source,[key]:e.target.value})} className="mt-1 w-full rounded-xl border p-2" /></label>)}<label className="flex items-center gap-2"><input type="checkbox" checked={remindersPaused} onChange={e=>setRemindersPaused(e.target.checked)}/> Pause reminders for this booking plan</label></section>
        <section className={`rounded-2xl border p-5 shadow-sm ${allClear ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-start gap-3"><input id="medication-plan-all-clear" type="checkbox" className="mt-1" checked={allClear} onChange={event => setAllClear(event.target.checked)}/><span><label htmlFor="medication-plan-all-clear" className="block font-semibold text-slate-900">All good — nothing to prepare</label><small className="text-slate-600">Use after medical review confirms that the client has no medication or substance preparation instructions.</small></span></div>
          {allClear && <label className="mt-4 block text-sm text-slate-600">Optional client message<textarea value={allClearNote} onChange={event => setAllClearNote(event.target.value)} rows={2} className="mt-1 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5" placeholder="No medication changes are required before your retreat."/></label>}
        </section>
        {!allClear && entries.map((entry, index) => <section key={index} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between"><strong>Calendar item {index + 1}</strong><button onClick={() => setEntries(current => current.filter((_, position) => position !== index))} className="rounded-lg p-2 text-rose-600"><Trash2 size={17}/></button></div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-slate-600">Medication or substance<input value={entry.name} onChange={event => update(index, { name: event.target.value })} className="mt-1 w-full rounded-xl border border-sky-200 px-3 py-2.5 outline-none focus:ring-2 focus:ring-sky-200"/></label>
            <label className="text-sm text-slate-600">Stop date<input type="date" value={entry.dueDate} onChange={event => update(index, { dueDate: event.target.value })} className="mt-1 w-full rounded-xl border border-sky-200 px-3 py-2.5 outline-none focus:ring-2 focus:ring-sky-200"/></label>
            <label className="text-sm text-slate-600">Or days before retreat<input type="number" min="0" value={entry.daysBeforeRetreat} onChange={event => update(index, { daysBeforeRetreat: event.target.value })} className="mt-1 w-full rounded-xl border border-sky-200 px-3 py-2.5"/></label>
            <label className="text-sm text-slate-600">Action<select value={entry.action} onChange={event => update(index, { action: event.target.value })} className="mt-1 w-full rounded-xl border p-2"><option value="stop">Stop</option><option value="reduce">Reduce</option><option value="continue">Continue</option><option value="discuss">Discuss</option><option value="avoid">Avoid</option></select></label>
            <label className="text-sm text-slate-600">Category<select value={entry.category} onChange={event => update(index, { category: event.target.value })} className="mt-1 w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5"><option value="medication">Medication</option><option value="supplement">Supplement</option><option value="drug">Recreational substance</option><option value="alcohol">Alcohol</option><option value="other">Other</option></select></label>
            <label className="flex items-center gap-2 self-end rounded-xl bg-violet-50 px-3 py-3 text-sm"><input type="checkbox" checked={entry.isBlocking} onChange={event => update(index, { isBlocking: event.target.checked })}/> Required for medical clearance</label>
            <label className="text-sm text-slate-600 md:col-span-2">Instruction shown to client<textarea required value={entry.instruction} onChange={event => update(index, { instruction: event.target.value })} rows={3} className="mt-1 w-full rounded-xl border border-sky-200 px-3 py-2.5 outline-none focus:ring-2 focus:ring-sky-200"/></label>
            <label className="text-sm text-slate-600 md:col-span-2">Advisor-authored taper / wean-off detail (optional)<textarea value={entry.taperPlan} onChange={event => update(index, { taperPlan: event.target.value })} rows={2} className="mt-1 w-full rounded-xl border border-sky-200 px-3 py-2.5 outline-none focus:ring-2 focus:ring-sky-200"/></label>
            <label className="text-sm text-slate-600 md:col-span-2">Internal note — never shown in IR<textarea value={entry.internalNote} onChange={event => update(index, { internalNote: event.target.value })} rows={2} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5"/></label>
          </div>
        </section>)}
        <div className="flex flex-wrap justify-between gap-3"><button disabled={allClear} onClick={() => setEntries(current => [...current, emptyEntry()])} className="flex items-center gap-2 rounded-xl border border-violet-300 bg-white px-4 py-2.5 text-sm font-semibold text-violet-700 disabled:opacity-40"><Plus size={17}/> Add calendar item</button><span className="flex gap-2"><button disabled={saving} onClick={save} className="rounded-xl bg-slate-700 px-5 py-2.5 text-sm font-semibold text-white"><Save size={17} className="inline"/> Save draft</button><button disabled={lifecycle!=='draft'} onClick={async()=>{const {data}=await bookingFlowApi.approveMedicationStopPlan(bookingId);setLifecycle(data?.[0]?.metadata?.planLifecycle||'approved')}} className="rounded-xl bg-amber-600 px-4 py-2 text-white disabled:opacity-40">Medical approve</button><button disabled={lifecycle!=='approved'} onClick={async()=>{const {data}=await bookingFlowApi.publishMedicationStopPlan(bookingId);setLifecycle(data?.[0]?.metadata?.planLifecycle||'published')}} className="rounded-xl bg-emerald-700 px-4 py-2 text-white disabled:opacity-40">Publish to IR</button></span></div>
        {message && <div className="rounded-xl bg-white p-4 text-sm text-slate-700 shadow-sm">{message}</div>}
      </div>}
    </div>
  </div>;
};
export default MedicationStopPlanPage;
