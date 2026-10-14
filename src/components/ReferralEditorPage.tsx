import ReferralAssignmentNotifications from './ReferralAssignmentNotifications';
import React, { FormEvent, useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { referralsApi } from '../services/api';
import { apiErrorMessage } from '../utils/apiErrorMessage';
import { ReferralPackagesEditor } from './ReferralPackagesEditor';
import { ReferralCommissionPackage, Referral, ReferralRateRule } from '../types';
const emptyRule = (): ReferralRateRule => ({ effectiveFrom: today(), effectiveTo: '', tiers: [{ minPrice: 0, ratePercent: 0 }], notes: '' });
const empty = { assignmentNotificationsEnabled: false, assignmentNotificationLanguage: 'en', name: '', referralCode: '', defaultCommissionPercentage: 0, influenceCommissionPercentage: '' as number | '', allowRepeatBookingCredit: true, email: '', phone: '', notes: '', isActive: true, rateSchedule: [] as ReferralRateRule[], commissionPackages: [] as ReferralCommissionPackage[] };
const toDateInput = (value?: string | null) => (value ? new Date(value).toISOString().slice(0, 10) : '');
function today() { return new Date().toISOString().slice(0, 10); }

const toForm = (referral?: Referral) => referral ? { assignmentNotificationsEnabled: referral.assignmentNotificationsEnabled === true, assignmentNotificationLanguage: referral.assignmentNotificationLanguage || 'en', name: referral.name, referralCode: referral.referralCode || '', defaultCommissionPercentage: Number(referral.defaultCommissionPercentage || 0), influenceCommissionPercentage: referral.influenceCommissionPercentage ?? '' as number | '', allowRepeatBookingCredit: referral.allowRepeatBookingCredit !== false, email: referral.email || '', phone: referral.phone || '', notes: referral.notes || '', isActive: referral.isActive !== false, commissionPackages: referral.commissionPackages || [], rateSchedule: (referral.rateSchedule || []).map(rule => ({ ...rule, effectiveFrom: toDateInput(rule.effectiveFrom), effectiveTo: toDateInput(rule.effectiveTo) })) } : empty;
export default function ReferralEditorPage({ referral, base, onSaved }: { referral?: Referral; base: string; onSaved: () => Promise<void> }) {
  const navigate = useNavigate();
  const editingId = referral?._id || '';
  const [form, updateForm] = useState(() => toForm(referral));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const location = useLocation();
  const [savedMessage, setSavedMessage] = useState(location.state?.referralSaved ? 'Referral saved. Rate schedule and commission packages are saved together.' : '');
  const [dirty, setDirty] = useState(false);
  const setForm = (next: React.SetStateAction<typeof form>) => { setDirty(true); setSavedMessage(''); updateForm(next); };
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const cancel = () => { if (saving) return; if (!dirty || window.confirm('Discard unsaved referral changes?')) navigate(editingId ? `${base}/${editingId}` : base); };
  const addRule = () => setForm(current => ({ ...current, rateSchedule: [...(current.rateSchedule || []), emptyRule()] }));
  const removeRule = (index: number) => setForm(current => ({ ...current, rateSchedule: (current.rateSchedule || []).filter((_, i) => i !== index) }));
  const updateRule = (index: number, patch: Partial<ReferralRateRule>) => setForm(current => ({
    ...current, rateSchedule: (current.rateSchedule || []).map((rule, i) => i === index ? { ...rule, ...patch } : rule),
  }));
  const addTier = (ruleIndex: number) => updateRule(ruleIndex, { tiers: [...(form.rateSchedule[ruleIndex]?.tiers || []), { minPrice: 0, ratePercent: 0 }] });
  const removeTier = (ruleIndex: number, tierIndex: number) => updateRule(ruleIndex, { tiers: (form.rateSchedule[ruleIndex]?.tiers || []).filter((_, i) => i !== tierIndex) });
  const updateTier = (ruleIndex: number, tierIndex: number, patch: Partial<{ minPrice: number; ratePercent: number }>) => updateRule(ruleIndex, {
    tiers: (form.rateSchedule[ruleIndex]?.tiers || []).map((tier, i) => i === tierIndex ? { ...tier, ...patch } : tier),
  });
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSavedMessage('');
    if (!form.name.trim()) return setError('Referral name is required.');
    if (!/^[A-Za-z]{2}$/.test(form.referralCode)) return setError('Referral code must contain exactly two letters.');
    setSaving(true);
    setError('');
    try {
      const response = editingId ? await referralsApi.update(editingId, { ...form, influenceCommissionPercentage: form.influenceCommissionPercentage === '' ? null : form.influenceCommissionPercentage }) : await referralsApi.create({ ...form, influenceCommissionPercentage: form.influenceCommissionPercentage === '' ? null : form.influenceCommissionPercentage });
      await onSaved();
      setDirty(false);
      if (!editingId && response.data?._id) navigate(`${base}/${response.data._id}/edit`, { replace: true, state: { referralSaved: true } });
      setSavedMessage('Referral saved. Rate schedule and commission packages are saved together.');
    } catch (e: any) {
      setError(apiErrorMessage(e, 'Could not save referral.'));
    } finally {
      setSaving(false);
    }
  };

  return <div className="mx-auto max-w-4xl">
    <button type="button" onClick={cancel} disabled={saving} className="mb-4 min-h-11 rounded-lg border border-slate-300 bg-white px-4 font-semibold">← {editingId ? 'Back to partner' : 'Back to partners'}</button>
    {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
    <form aria-label="Referral settings" onSubmit={save} onChange={() => { setSavedMessage(''); setDirty(true); }} onInvalidCapture={() => { setSavedMessage(''); setError('Complete the required fields and check the dates, prices and percentages before saving.'); }} className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <fieldset disabled={saving} className="min-w-0">
      <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">Partner details</h2></div>
      <section aria-label="Assignment email settings" className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="font-semibold">Referral assignment emails</h3>
        <label className="mt-3 flex items-center gap-2"><input type="checkbox" checked={form.assignmentNotificationsEnabled} onChange={event => setForm({ ...form, assignmentNotificationsEnabled: event.target.checked })} />Notify this partner when a client is assigned</label>
        <label className="mt-3 block text-sm">Notification language<select className="ml-3 rounded-lg border border-slate-300 bg-white p-2" value={form.assignmentNotificationLanguage} onChange={event => setForm({ ...form, assignmentNotificationLanguage: event.target.value })}><option value="en">English</option><option value="cz">Czech</option><option value="pl">Polish</option><option value="ru">Russian</option></select></label>
        <p className="mt-3 text-sm text-slate-600">Applies to new signups and saved referral changes. Uses the active portal account email, or the partner contact email if no account exists. Inactive partners or portal accounts are blocked. Unchanged assignments and removals do not send email.</p>
        <p className="mt-2 text-sm text-slate-600">Edit or install the referral_assignment templates in Communications. Use only clientFirstName, clientLastName, partnerName and portalUrl placeholders. A matching active language template is required. Messages confirm attribution only.</p>
        <p className="mt-2 text-sm text-slate-600">Save these settings before assigning a client. Existing disabled notifications are sent only if you explicitly retry them.</p>
      </section>
      <p className="mb-3 text-sm text-slate-600">Save buttons store the partner details, assignment email settings, rates and packages together. Portal access is managed on its own screen.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <input aria-label="Partner name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Name *" className="min-h-12 rounded-xl border border-slate-300 px-3" required />
        <input aria-label="Referral code" value={form.referralCode} maxLength={2} onChange={event => setForm({ ...form, referralCode: event.target.value.replace(/[^a-z]/gi, '').toUpperCase() })} placeholder="Code (AD) *" className="min-h-12 rounded-xl border border-slate-300 px-3 uppercase" required />
        <input aria-label="Contact email" type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} placeholder="Email" className="min-h-12 rounded-xl border border-slate-300 px-3" />
        <input aria-label="Contact phone" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} placeholder="Phone" className="min-h-12 rounded-xl border border-slate-300 px-3" />
        <label className="text-sm font-semibold text-slate-700">Default commission %<input type="number" min="0" max="100" step="0.01" value={form.defaultCommissionPercentage} onChange={event => setForm({ ...form, defaultCommissionPercentage: Number(event.target.value) })} className="mt-1 min-h-12 w-full rounded-xl border border-slate-300 px-3 text-base font-normal" /></label>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">Influence commission % (blank uses existing packages/rates)<input type="number" min="0" max="100" step="0.01" value={form.influenceCommissionPercentage} onChange={event => setForm({ ...form, influenceCommissionPercentage: event.target.value === '' ? '' : Number(event.target.value) })} className="mt-1 w-full rounded border p-2" /></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.allowRepeatBookingCredit} onChange={event => setForm({ ...form, allowRepeatBookingCredit: event.target.checked })} />Allow explicitly credited repeat bookings</label>
      </div>

      <section aria-label="How commission rules work" className="mt-4 rounded-xl bg-blue-50 p-4 text-sm text-slate-700">
        <h3 className="font-bold text-slate-900">Which commission rule applies?</h3>
        <p className="mt-2"><strong>Commission packages are recommended for new agreements.</strong> Name each package, choose its booking dates and currency, then set a percentage, price tiers or a fixed amount. For example: “Summer 10%” for EUR bookings from June through August.</p>
        <p className="mt-2">When any packages exist, they replace the default percentage and rate schedule. A booking outside their dates or currencies shows “Needs configuration”; it does not fall back to another rate. Package dates use Prague time and include the end date.</p>
        <p className="mt-2">The rate schedule is the older percentage-only option. You do not need to configure both. An explicit influence percentage takes priority for influenced bookings. Recorded payments keep their original amounts and package details.</p>
      </section>
      <ReferralPackagesEditor value={form.commissionPackages} onChange={commissionPackages => setForm({ ...form, commissionPackages })} saveAction={<button type="submit" disabled={saving} className="mt-3 min-h-11 rounded-lg bg-blue-600 px-4 font-bold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save commission packages'}</button>} />
      <section aria-label="Rate schedule" className="mt-4 rounded-xl border border-slate-200 p-3">
        <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-bold text-slate-700">Rate schedule (legacy percentage rules)</h3><button type="button" onClick={addRule} className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold">+ Add rate rule</button></div>
        <p className="mb-3 text-xs text-slate-500">Use this for existing percentage-only agreements when no commission packages are configured. It selects a percentage by booking registration date and price tier, then falls back to the default percentage if no rule matches. Client or retreat percentage overrides still take priority. Price thresholds use the booking currency; these rules have no currency filter.</p>
        {(form.rateSchedule || []).map((rule, ruleIndex) => <div key={ruleIndex} className="mb-2 rounded-lg bg-slate-50 p-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <label className="text-xs font-semibold text-slate-600">From<input type="date" value={rule.effectiveFrom} onChange={event => updateRule(ruleIndex, { effectiveFrom: event.target.value })} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-2" required /></label>
            <label className="text-xs font-semibold text-slate-600">To (blank = ongoing)<input type="date" value={rule.effectiveTo || ''} onChange={event => updateRule(ruleIndex, { effectiveTo: event.target.value })} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-2" /></label>
            <button type="button" aria-label={`Remove rate rule ${ruleIndex + 1}`} onClick={() => removeRule(ruleIndex)} className="mt-1 self-end rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 size={16} /></button>
          </div>
          <div className="mt-2 space-y-2">
            {rule.tiers.map((tier, tierIndex) => <div key={tierIndex} className="flex flex-wrap items-center gap-2">
              <label className="text-xs text-slate-600">From price<input type="number" min="0" value={tier.minPrice} onChange={event => updateTier(ruleIndex, tierIndex, { minPrice: Number(event.target.value) })} className="ml-1 min-h-9 w-28 rounded-lg border border-slate-300 px-2" /></label>
              <label className="text-xs text-slate-600">Rate %<input type="number" min="0" max="100" step="0.01" value={tier.ratePercent} onChange={event => updateTier(ruleIndex, tierIndex, { ratePercent: Number(event.target.value) })} className="ml-1 min-h-9 w-24 rounded-lg border border-slate-300 px-2" /></label>
              {rule.tiers.length > 1 && <button type="button" aria-label={`Remove price tier ${tierIndex + 1} of rule ${ruleIndex + 1}`} onClick={() => removeTier(ruleIndex, tierIndex)} className="rounded-lg p-1.5 text-red-600 hover:bg-red-50"><X size={14} /></button>}
            </div>)}
            <button type="button" onClick={() => addTier(ruleIndex)} className="text-xs font-bold text-blue-700 hover:underline">+ Add price tier</button>
          </div>
        </div>)}
        {!(form.rateSchedule || []).length && <p className="text-sm text-slate-400">No dated rate rules. Without packages or other overrides, the default commission % applies.</p>}
        {form.commissionPackages.length > 0 && <p className="my-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Commission packages are configured, so this rate schedule is saved but does not apply. Remove all packages to use the rate schedule again.</p>}
        <button type="submit" disabled={saving} className="mt-3 min-h-11 rounded-lg bg-blue-600 px-4 font-bold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save rate schedule'}</button>
      </section>
      <textarea value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} placeholder="Notes" className="mt-3 min-h-20 w-full rounded-xl border border-slate-300 p-3" />
      <label className="mt-3 flex items-center gap-2"><input type="checkbox" checked={form.isActive} onChange={event => setForm({ ...form, isActive: event.target.checked })} /> Active</label>
      <div className="sticky bottom-0 z-10 mt-4 flex flex-wrap items-center gap-3 border-t border-slate-200 bg-white py-3"><button type="submit" disabled={saving} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-blue-600 px-5 font-bold text-white"><Plus size={19} />{saving ? 'Saving…' : editingId ? 'Save changes' : 'Add referral'}</button><span className="text-xs text-slate-500">Saves the partner, rates and packages together.</span>{savedMessage && <p role="status" className="w-full text-sm font-semibold text-emerald-700">{savedMessage}</p>}</div>
      </fieldset>
    </form>
    {editingId && <ReferralAssignmentNotifications referralId={editingId} />}
  </div>;
}
