import { ReferralPortalAccountEditor } from './ReferralPortalAccountEditor';
import { FormEvent, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Referral } from '../types';
import { referralsApi } from '../services/api';
import { apiErrorMessage } from '../utils/apiErrorMessage';
import ReferralAssignmentNotifications from './ReferralAssignmentNotifications';
import ReferralDatePackagesEditor from './ReferralDatePackagesEditor';
import { ReferralPackagesEditor } from './ReferralPackagesEditor';
import { datePackageEditorState, prepareDatePackages } from './referralDatePackages';

export default function ReferralEditorPage({ referral, base, onSaved }: { referral?: Referral; base: string; onSaved: () => Promise<void> }) {
  const navigate = useNavigate(); const location = useLocation(); const editingId = referral?._id || '';
  const [form, updateForm] = useState(() => ({ payoutCurrency: referral?.payoutCurrency ?? (referral ? '' : 'USD'), name: referral?.name || '', referralCode: referral?.referralCode || '', email: referral?.email || '', phone: referral?.phone || '', notes: referral?.notes || '', isActive: referral?.isActive !== false, allowRepeatBookingCredit: referral?.allowRepeatBookingCredit !== false }));
  const [agreement, setAgreement] = useState(() => datePackageEditorState(referral));
  const [customPackages, setCustomPackages] = useState(() => referral?.commissionMode !== 'dated_percentage' ? (referral?.commissionPackages || []) : []);
  const [mode, setMode] = useState<'dated' | 'custom'>(() => agreement.blocked ? 'custom' : 'dated');
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
      if (mode === 'custom') payload = { ...payload, commissionMode: null, commissionPackages: customPackages };
      else if (agreement.activate) payload = { ...payload, commissionMode: 'dated_percentage', commissionPackages: prepareDatePackages(agreement.packages) };
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
        <label className="my-4 block text-sm font-semibold">Preferred payout currency<select aria-label="Preferred payout currency" className={`${field} mt-1`} value={form.payoutCurrency} onChange={event => setForm({ ...form, payoutCurrency: event.target.value })}><option value="">Original commission currency</option>{['USD','EUR','PLN','CZK'].map(currency => <option key={currency} value={currency}>{currency}</option>)}</select><span className="mt-1 block text-xs font-normal text-slate-500">Original commissions stay unchanged. Conversion uses the published payment-date rate; saved payouts keep their recorded rate.</span></label>
        <div className="my-3 flex gap-2" role="tablist" aria-label="Commission agreement type">
          <button type="button" role="tab" aria-selected={mode === 'dated'} className={`min-h-11 rounded-lg border px-4 font-semibold ${mode === 'dated' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-300 bg-white'}`} onClick={() => { setMode('dated'); setDirty(true); setSavedMessage(''); }}>Dated percentages</button>
          <button type="button" role="tab" aria-selected={mode === 'custom'} className={`min-h-11 rounded-lg border px-4 font-semibold ${mode === 'custom' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-300 bg-white'}`} onClick={() => { setMode('custom'); setDirty(true); setSavedMessage(''); }}>Custom packages</button>
        </div>
        {mode === 'custom' ? <ReferralPackagesEditor value={customPackages} onChange={packages => { setCustomPackages(packages); setDirty(true); setSavedMessage(''); }} /> : <>
          {!agreement.activate && referral && <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm">Current percentage: {referral.defaultCommissionPercentage || 0}%. Add a dated package to replace this agreement.</p>}
          <ReferralDatePackagesEditor value={agreement.packages} onChange={packages => { setAgreement({ packages, blocked: false, activate: true }); setDirty(true); setSavedMessage(''); }} />
        </>}
        <textarea aria-label="Partner notes" placeholder="Notes" className="min-h-20 w-full rounded-lg border border-slate-300 p-3" value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} />
        <div className="my-3 flex flex-wrap gap-4"><label className="flex items-center gap-2"><input type="checkbox" checked={form.isActive} onChange={event => setForm({ ...form, isActive: event.target.checked })} />Active</label><label className="flex items-center gap-2"><input type="checkbox" checked={form.allowRepeatBookingCredit} onChange={event => setForm({ ...form, allowRepeatBookingCredit: event.target.checked })} />Allow explicitly credited repeat bookings</label></div>
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Assignment email notifications for this partner are managed in <a className="font-semibold text-blue-700 underline" href={`${base}/notification-settings`}>Referral notification settings</a>, alongside every other partner.</p>
        <div className="sticky bottom-0 z-10 mt-4 border-t border-slate-200 bg-white py-3">
          {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {savedMessage && <p role="status" className="mb-3 text-sm font-semibold text-emerald-700">{savedMessage}</p>}
          <button type="submit" disabled={saving} className="min-h-12 rounded-xl bg-blue-600 px-5 font-bold text-white">{saving ? 'Saving…' : editingId ? 'Save changes' : 'Add referral'}</button>
        </div>
      </fieldset>
    </form>
    {editingId && <ReferralPortalAccountEditor referralId={editingId} defaultEmail={referral?.email || ''} />}
    {editingId && <ReferralAssignmentNotifications referralId={editingId} />}
  </div>;
}
