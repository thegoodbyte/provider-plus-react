import React, { useEffect, useState } from 'react';
import { referralsApi } from '../services/api';
import { apiErrorMessage } from '../utils/apiErrorMessage';
import { useToast } from '../hooks/useToast';
import Toast from './Toast';
import { Referral } from '../types';

const languages: { value: 'en' | 'cz' | 'pl' | 'ru'; label: string }[] = [
  { value: 'en', label: 'English' }, { value: 'cz', label: 'Czech' }, { value: 'pl', label: 'Polish' }, { value: 'ru', label: 'Russian' },
];

export default function ReferralNotificationSettingsPage({ partners, onPartnerSaved }: { partners: Referral[]; onPartnerSaved: () => Promise<void> }) {
  const [globalEnabled, setGlobalEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [savingPartnerId, setSavingPartnerId] = useState('');
  const { toast, showSuccess, showError, dismiss } = useToast();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError('');
      try {
        const response = await referralsApi.getNotificationSettings();
        if (!cancelled) setGlobalEnabled(response.data.assignmentNotificationsEnabled === true);
      } catch (failure) { if (!cancelled) setError(apiErrorMessage(failure, 'Could not load notification settings.')); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const toggleGlobal = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.checked;
    setSavingGlobal(true); setError('');
    try {
      const response = await referralsApi.updateNotificationSettings({ assignmentNotificationsEnabled: next });
      setGlobalEnabled(response.data.assignmentNotificationsEnabled === true);
      showSuccess('Notification settings saved.');
    } catch (failure) { setError(apiErrorMessage(failure, 'Could not save the global switch.')); }
    finally { setSavingGlobal(false); }
  };

  const updatePartner = async (partner: Referral, patch: Partial<Referral>) => {
    if (!partner._id) return;
    setSavingPartnerId(partner._id); setError('');
    try {
      await referralsApi.update(partner._id, patch);
      await onPartnerSaved();
      showSuccess(`Saved for ${partner.name}.`);
    } catch (failure) { showError(apiErrorMessage(failure, `Could not save settings for ${partner.name}.`)); }
    finally { setSavingPartnerId(''); }
  };

  return <div className="space-y-6">
    <Toast toast={toast} onDismiss={dismiss} />
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {loading ? <p role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500">Loading notification settings…</p> : <>
      <section aria-label="Global switch" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={globalEnabled} disabled={savingGlobal} onChange={toggleGlobal} className="h-5 w-5" />
          <span className="text-lg font-semibold">Send assignment notification emails</span>
        </label>
        <p className="mt-2 text-sm text-slate-600">When off, no partner receives the "a client was just assigned to you" email, regardless of their setting below. When on, each partner's own setting decides.</p>
      </section>
      <section aria-label="Per-partner notification settings" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-bold">Per-partner overrides</h2>
        <p className="mb-4 text-sm text-slate-500">Uses the partner portal email, or contact email if there is no portal account. A matching active referral_assignment template is required in Communications.</p>
        {!partners.length ? <p className="text-sm text-slate-600">No referral partners yet.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead><tr className="text-slate-500"><th className="py-2 pr-3 font-medium">Partner</th><th className="py-2 pr-3 font-medium">Notify on assignment</th><th className="py-2 pr-3 font-medium">Language</th></tr></thead>
          <tbody>{partners.map(item => <tr key={item._id} className="border-t border-slate-100">
            <td className="py-3 pr-3 font-medium text-slate-900">{item.name}</td>
            <td className="py-3 pr-3"><input type="checkbox" aria-label={`Notify ${item.name} on assignment`} checked={item.assignmentNotificationsEnabled === true} disabled={savingPartnerId === item._id} onChange={event => updatePartner(item, { assignmentNotificationsEnabled: event.target.checked })} className="h-5 w-5" /></td>
            <td className="py-3 pr-3"><select aria-label={`Notification language for ${item.name}`} className="rounded-lg border border-slate-300 bg-white p-2" value={item.assignmentNotificationLanguage || 'en'} disabled={savingPartnerId === item._id} onChange={event => updatePartner(item, { assignmentNotificationLanguage: event.target.value as any })}>
              {languages.map(language => <option key={language.value} value={language.value}>{language.label}</option>)}
            </select></td>
          </tr>)}</tbody>
        </table></div>}
      </section>
    </>}
  </div>;
}
