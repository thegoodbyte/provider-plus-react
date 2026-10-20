import React, { useEffect, useState } from 'react';
import { referralsApi } from '../services/api';
import { apiErrorMessage } from '../utils/apiErrorMessage';
import { useToast } from '../hooks/useToast';
import Toast from './Toast';
import { Referral, ReferralNotificationSettings } from '../types';

const languages: { value: 'en' | 'cz' | 'pl' | 'ru'; label: string }[] = [
  { value: 'en', label: 'English' }, { value: 'cz', label: 'Czech' }, { value: 'pl', label: 'Polish' }, { value: 'ru', label: 'Russian' },
];

// PPVC-827: one entry per notification kind -- the global flag key, the
// per-partner override key on Referral, and the label/description shown for
// each. Assignment (PPVC-826) plus the four lifecycle kinds added here share
// this same global-switch + per-partner-override model and UI.
const NOTIFICATION_KINDS: {
  globalFlag: keyof ReferralNotificationSettings;
  partnerFlag: keyof Referral;
  globalLabel: string;
  globalDescription: string;
  columnLabel: string;
}[] = [
  {
    globalFlag: 'assignmentNotificationsEnabled',
    partnerFlag: 'assignmentNotificationsEnabled',
    globalLabel: 'Send assignment notification emails',
    globalDescription: 'When off, no partner receives the "a client was just assigned to you" email, regardless of their setting below. When on, each partner\'s own setting decides.',
    columnLabel: 'Assignment',
  },
  {
    globalFlag: 'invoiceSentNotificationsEnabled',
    partnerFlag: 'invoiceSentNotificationsEnabled',
    globalLabel: 'Send invoice-sent notification emails',
    globalDescription: 'When off, no partner receives the "an invoice was sent to your client" email, regardless of their setting below.',
    columnLabel: 'Invoice sent',
  },
  {
    globalFlag: 'invoicePaidNotificationsEnabled',
    partnerFlag: 'invoicePaidNotificationsEnabled',
    globalLabel: 'Send invoice-paid notification emails',
    globalDescription: 'When off, no partner receives the "your client paid their invoice" email, regardless of their setting below.',
    columnLabel: 'Invoice paid',
  },
  {
    globalFlag: 'bookingIssuedNotificationsEnabled',
    partnerFlag: 'bookingIssuedNotificationsEnabled',
    globalLabel: 'Send booking-issued notification emails',
    globalDescription: 'When off, no partner receives the "your client has been booked" email, regardless of their setting below.',
    columnLabel: 'Booking issued',
  },
  {
    globalFlag: 'retreatCompletedNotificationsEnabled',
    partnerFlag: 'retreatCompletedNotificationsEnabled',
    globalLabel: 'Send retreat-completed notification emails',
    globalDescription: 'When off, no partner receives the "your client completed their retreat" email, regardless of their setting below.',
    columnLabel: 'Retreat completed',
  },
];

const emptySettings: ReferralNotificationSettings = {
  assignmentNotificationsEnabled: false,
  invoiceSentNotificationsEnabled: false,
  invoicePaidNotificationsEnabled: false,
  bookingIssuedNotificationsEnabled: false,
  retreatCompletedNotificationsEnabled: false,
};

export default function ReferralNotificationSettingsPage({ partners, onPartnerSaved }: { partners: Referral[]; onPartnerSaved: () => Promise<void> }) {
  const [settings, setSettings] = useState<ReferralNotificationSettings>(emptySettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingGlobalFlag, setSavingGlobalFlag] = useState('');
  const [savingPartnerId, setSavingPartnerId] = useState('');
  const { toast, showSuccess, showError, dismiss } = useToast();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError('');
      try {
        const response = await referralsApi.getNotificationSettings();
        if (!cancelled) setSettings({ ...emptySettings, ...response.data });
      } catch (failure) { if (!cancelled) setError(apiErrorMessage(failure, 'Could not load notification settings.')); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const toggleGlobal = (flag: keyof ReferralNotificationSettings) => async (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.checked;
    setSavingGlobalFlag(flag); setError('');
    try {
      const response = await referralsApi.updateNotificationSettings({ [flag]: next });
      setSettings(previous => ({ ...previous, ...response.data }));
      showSuccess('Notification settings saved.');
    } catch (failure) { setError(apiErrorMessage(failure, 'Could not save the global switch.')); }
    finally { setSavingGlobalFlag(''); }
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
      <section aria-label="Global switches" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        {NOTIFICATION_KINDS.map(kind => <div key={kind.globalFlag}>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={settings[kind.globalFlag] === true} disabled={savingGlobalFlag === kind.globalFlag} onChange={toggleGlobal(kind.globalFlag)} className="h-5 w-5" />
            <span className="text-lg font-semibold">{kind.globalLabel}</span>
          </label>
          <p className="mt-1 text-sm text-slate-600">{kind.globalDescription}</p>
        </div>)}
      </section>
      <section aria-label="Per-partner notification settings" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-bold">Per-partner overrides</h2>
        <p className="mb-4 text-sm text-slate-500">Uses the partner portal email, or contact email if there is no portal account. A matching active email template per kind is required in Communications.</p>
        {!partners.length ? <p className="text-sm text-slate-600">No referral partners yet.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead><tr className="text-slate-500">
            <th className="py-2 pr-3 font-medium">Partner</th>
            {NOTIFICATION_KINDS.map(kind => <th key={kind.partnerFlag} className="py-2 pr-3 font-medium">{kind.columnLabel}</th>)}
            <th className="py-2 pr-3 font-medium">Language</th>
          </tr></thead>
          <tbody>{partners.map(item => <tr key={item._id} className="border-t border-slate-100">
            <td className="py-3 pr-3 font-medium text-slate-900">{item.name}</td>
            {NOTIFICATION_KINDS.map(kind => <td key={kind.partnerFlag} className="py-3 pr-3">
              <input type="checkbox" aria-label={`Notify ${item.name} on ${kind.columnLabel.toLowerCase()}`} checked={item[kind.partnerFlag] === true} disabled={savingPartnerId === item._id} onChange={event => updatePartner(item, { [kind.partnerFlag]: event.target.checked } as Partial<Referral>)} className="h-5 w-5" />
            </td>)}
            <td className="py-3 pr-3"><select aria-label={`Notification language for ${item.name}`} className="rounded-lg border border-slate-300 bg-white p-2" value={item.assignmentNotificationLanguage || 'en'} disabled={savingPartnerId === item._id} onChange={event => updatePartner(item, { assignmentNotificationLanguage: event.target.value as any })}>
              {languages.map(language => <option key={language.value} value={language.value}>{language.label}</option>)}
            </select></td>
          </tr>)}</tbody>
        </table></div>}
      </section>
    </>}
  </div>;
}
