import { FormEvent, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Referral } from '../types';
import { referralsApi } from '../services/api';
import { apiErrorMessage } from '../utils/apiErrorMessage';
import ReferralAssignmentNotifications from './ReferralAssignmentNotifications';
import ReferralDatePackagesEditor from './ReferralDatePackagesEditor';
import { datePackageEditorState, prepareDatePackages } from './referralDatePackages';

export default function ReferralEditorPage({ referral, base, onSaved }: { referral?: Referral; base: string; onSaved: () => Promise<void> }) {
  const navigate = useNavigate(); const location = useLocation(); const editingId = referral?._id || '';
  const [form, updateForm] = useState(() => ({ name: referral?.name || '', referralCode: referral?.referralCode || '', email: referral?.email || '', phone: referral?.phone || '', notes: referral?.notes || '', isActive: referral?.isActive !== false, allowRepeatBookingCredit: referral?.allowRepeatBookingCredit !== false, assignmentNotificationsEnabled: referral?.assignmentNotificationsEnabled === true, assignmentNotificationLanguage: referral?.assignmentNotificationLanguage || 'en' }));
  const [agreement, setAgreement] = useState(() => datePackageEditorState(referral));
  const [saving, setSaving] = useState(false); const [dirty, setDirty] = useState(false); const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState(location.state?.referralSaved ? 'Referral saved.' : '');
  const setForm = (next: typeof form) => { setDirty(true); setSavedMessage(''); updateForm(next); };
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const cancel = () => { if (!saving && (!dirty || window.confirm('Discard unsaved referral changes?'))) navigate(editingId ? `${base}/${editingId}` : base); };
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (saving) return; setError(''); setSavedMessage('');
    if (!form.name.trim()) return setError('Partner name is required.');
    if (!/^[A-Za-z]{2}$/.test(form.referralCode)) return setError('Referral code must contain exactly two letters.');
    let payload: Omit<Referral, '_id'> = { ...form };
    try {
      if (agreement.activate && !agreement.blocked) payload = { ...payload, commissionMode: 'dated_percentage', commissionPackages: prepareDatePackages(agreement.packages) };
    } catch (failure) { return setError((failure as Error).message); }
    setSaving(true);
    try {
      const response = editingId ? await referralsApi.update(editingId, payload) : await referralsApi.create(payload);
      await onSaved(); setDirty(false);
      if (!editingId && response.data?._id) navigate(`${base}/${response.data._id}/edit`, { replace: true, state: { referralSaved: true } });
      setSavedMessage('Referral saved.');
    } catch (failure) { setError(apiErrorMessage(failure, 'Could not save referral.')); }
    finally { setSaving(false); }
  };
  const field = 'min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3';
  return <div className="mx-auto max-w-4xl">
    <button type="button" onClick={cancel} disabled={saving} className="mb-4 min-h-11 rounded-lg border border-slate-300 bg-white px-4 font-semibold">← {editingId ? 'Back to partner' : 'Back to partners'}</button>
    <form aria-label="Referral settings" onSubmit={save} onInvalidCapture={() => { setSavedMessage(''); setError('Complete the required fields and check the package dates and percentages.'); }} className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <fieldset disabled={saving} className="min-w-0">
        <h2 className="mb-3 text-lg font-bold">Partner details</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input aria-label="Partner name" required placeholder="Name *" className={field} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
          <input aria-label="Referral code" required maxLength={2} placeholder="Code (AD) *" className={field} value={form.referralCode} onChange={event => setForm({ ...form, referralCode: event.target.value.replace(/[^a-z]/gi, '').toUpperCase() })} />
          <input aria-label="Contact email" type="email" placeholder="Email" className={field} value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} />
          <input aria-label="Contact phone" placeholder="Phone" className={field} value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} />
        </div>
        {agreement.blocked ? <section aria-label="Existing commission agreement" className="my-5 rounded-xl bg-slate-50 p-4">
          <h3 className="font-semibold">Existing commission agreement</h3>
          <p className="mt-2 text-sm text-slate-600">This agreement uses fixed amounts, price tiers or a currency restriction. It stays active until you replace it with dated percentages. Recorded payments stay as saved.</p>
          <button type="button" className="mt-3 min-h-11 rounded-lg border bg-white px-4 font-semibold" onClick={() => { setAgreement({ packages: [], blocked: false, activate: true }); setDirty(true); setSavedMessage(''); }}>Use date-based percentages</button>
        </section> : <>
          {!agreement.activate && referral && <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm">Current percentage: {referral.defaultCommissionPercentage || 0}%. Add a dated package to replace this agreement.</p>}
          <ReferralDatePackagesEditor value={agreement.packages} onChange={packages => { setAgreement({ packages, blocked: false, activate: true }); setDirty(true); setSavedMessage(''); }} />
        </>}
        <textarea aria-label="Partner notes" placeholder="Notes" className="min-h-20 w-full rounded-lg border border-slate-300 p-3" value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} />
        <div className="my-3 flex flex-wrap gap-4"><label className="flex items-center gap-2"><input type="checkbox" checked={form.isActive} onChange={event => setForm({ ...form, isActive: event.target.checked })} />Active</label><label className="flex items-center gap-2"><input type="checkbox" checked={form.allowRepeatBookingCredit} onChange={event => setForm({ ...form, allowRepeatBookingCredit: event.target.checked })} />Allow explicitly credited repeat bookings</label></div>
        <section aria-label="Assignment email settings" className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="font-semibold">Referral assignment emails</h3>
          <label className="mt-3 flex items-center gap-2"><input type="checkbox" checked={form.assignmentNotificationsEnabled} onChange={event => setForm({ ...form, assignmentNotificationsEnabled: event.target.checked })} />Notify this partner when a client is assigned</label>
          <label className="mt-3 block text-sm">Notification language<select className="ml-3 rounded-lg border border-slate-300 bg-white p-2" value={form.assignmentNotificationLanguage} onChange={event => setForm({ ...form, assignmentNotificationLanguage: event.target.value })}><option value="en">English</option><option value="cz">Czech</option><option value="pl">Polish</option><option value="ru">Russian</option></select></label>
          <p className="mt-3 text-sm text-slate-600">Applies to new signups and saved referral changes. Uses the partner portal email, or contact email if there is no portal account. A matching active referral_assignment template is required in Communications.</p>
        </section>
        <div className="sticky bottom-0 z-10 mt-4 border-t border-slate-200 bg-white py-3">
          {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {savedMessage && <p role="status" className="mb-3 text-sm font-semibold text-emerald-700">{savedMessage}</p>}
          <button type="submit" disabled={saving} className="min-h-12 rounded-xl bg-blue-600 px-5 font-bold text-white">{saving ? 'Saving…' : editingId ? 'Save changes' : 'Add referral'}</button>
        </div>
      </fieldset>
    </form>
    {editingId && <ReferralAssignmentNotifications referralId={editingId} />}
  </div>;
}
