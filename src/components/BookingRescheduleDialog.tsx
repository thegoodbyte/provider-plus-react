import React, { useEffect, useMemo, useState } from 'react';
import { Retreat } from '../types';

const reasons = [
  ['client_requested', 'Client requested'], ['illness', 'Illness'],
  ['missing_artifacts', 'Required artifacts not received'], ['medical_delay', 'Medical delay'],
  ['travel_problem', 'Travel problem'], ['administrative_change', 'Administrative change'], ['other', 'Other'],
];
const id = (value: any) => (typeof value === 'object' ? value?._id : value);
const code = (retreat: any) => retreat.code || retreat.retreatCode || retreat.name || 'Retreat';
const date = (value: any) => (value ? new Date(value).toLocaleDateString() : '—');
const availablePlaces = (retreat: any) => {
  const capacity = Number(retreat.capacity || 0);
  return capacity > 0 ? Math.max(0, capacity - Number(retreat.currentOccupancy || 0)) : null;
};

type Props = {
  currentRetreatId: string; currentRetreatStartDate?: string; retreats: Retreat[]; isAdmin?: boolean; saving: boolean; error?: string; onClose: () => void;
  onSubmit: (data: { targetRetreatId: string; reason: string; note: string; sendEmail: boolean; allowEarlierRetreat: boolean }) => Promise<void>;
};

export default function BookingRescheduleDialog({ currentRetreatId, currentRetreatStartDate, retreats, isAdmin = false, saving, error, onClose, onSubmit }: Props) {
  const [targetRetreatId, setTargetRetreatId] = useState('');
  const [reason, setReason] = useState('client_requested');
  const [note, setNote] = useState('');
  const [sendEmail, setSendEmail] = useState(false);
  const [allowEarlierRetreat, setAllowEarlierRetreat] = useState(false);
  const sourceStart = new Date(currentRetreatStartDate || (retreats.find((retreat: any) => id(retreat) === currentRetreatId) as any)?.startDate || 0).getTime();
  const options = useMemo(() => retreats
    .filter((retreat: any) => id(retreat) !== currentRetreatId && retreat.status !== 'cancelled'
      && new Date(retreat.endDate || retreat.startDate || 0).getTime() >= Date.now()
      && ((isAdmin && allowEarlierRetreat) || !Number.isFinite(sourceStart) || new Date(retreat.startDate).getTime() >= sourceStart))
    .sort((left: any, right: any) => new Date(left.startDate).getTime() - new Date(right.startDate).getTime()), [allowEarlierRetreat, currentRetreatId, isAdmin, retreats, sourceStart]);
  const selected: any = options.find((retreat: any) => id(retreat) === targetRetreatId);
  const selectedIsFull = selected && availablePlaces(selected) === 0;
  useEffect(() => { if (targetRetreatId && !selected) setTargetRetreatId(''); }, [selected, targetRetreatId]);

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="reschedule-title">
    <form className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl" onSubmit={(event) => { event.preventDefault(); void onSubmit({ targetRetreatId, reason, note, sendEmail, allowEarlierRetreat: isAdmin && allowEarlierRetreat }); }}>
      <h2 id="reschedule-title" className="text-xl font-semibold">Reschedule booking</h2>
      <p className="mt-1 text-sm text-gray-600">Completed payments, documents, medical reviews and steps remain. Retreat-relative deadlines will be recalculated.</p>
      {error && <div role="alert" className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div>}
      {isAdmin && <label className="mt-5 flex items-start gap-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm"><input type="checkbox" checked={allowEarlierRetreat} onChange={(event) => setAllowEarlierRetreat(event.target.checked)} /><span><strong>Show earlier retreat dates</strong><br /><span className="text-amber-800">Includes retreats before the booking’s current retreat, but never retreats that have already ended.</span></span></label>}
      <label className="mt-5 block text-sm font-semibold">Move to retreat
        <select required value={targetRetreatId} onChange={(event) => setTargetRetreatId(event.target.value)} className="mt-2 w-full rounded border border-gray-300 p-3">
          <option value="">Select an available retreat</option>
          {options.map((retreat: any) => {
            const places = availablePlaces(retreat); const full = places === 0;
            return <option key={id(retreat)} value={id(retreat)} disabled={full && !isAdmin}>{code(retreat)} · {date(retreat.startDate)} – {date(retreat.endDate)} · {full ? 'Full — admin override available' : places === null ? 'Capacity not set' : `${places} places open`}</option>;
          })}
        </select>
      </label>
      {selected && <div className="mt-3 rounded bg-blue-50 p-3 text-sm text-blue-800">New retreat: <strong>{code(selected)}</strong> · {date(selected.startDate)} – {date(selected.endDate)}</div>}
      {selectedIsFull && <div role="alert" className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-900">Warning: this retreat is full. Confirming will add the client above the retreat’s configured capacity.</div>}
      <label className="mt-4 block text-sm font-semibold">Reason<select value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 w-full rounded border border-gray-300 p-3">{reasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="mt-4 block text-sm font-semibold">Internal note<textarea required minLength={2} rows={3} value={note} onChange={(event) => setNote(event.target.value)} className="mt-2 w-full rounded border border-gray-300 p-3" placeholder="Why is this booking being moved?" /></label>
      <label className="mt-4 flex items-start gap-3 rounded border border-gray-200 p-3 text-sm"><input type="checkbox" checked={sendEmail} onChange={(event) => setSendEmail(event.target.checked)} /><span><strong>Send reschedule email after moving</strong><br /><span className="text-gray-500">Off by default. Enable only with permission to email this client.</span></span></label>
      <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} disabled={saving} className="rounded border border-gray-300 px-4 py-2">Cancel</button><button type="submit" disabled={saving || !targetRetreatId || note.trim().length < 2} className="rounded bg-gray-950 px-5 py-2 font-semibold text-white disabled:opacity-50">{saving ? 'Rescheduling…' : 'Confirm reschedule'}</button></div>
    </form>
  </div>;
}
