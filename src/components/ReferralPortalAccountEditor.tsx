import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
export const ReferralPortalAccountEditor: React.FC<{ referralId: string; defaultEmail: string }> = ({ referralId, defaultEmail }) => {
  const [email, setEmail] = useState(defaultEmail);
  const [resetPin, setResetPin] = useState(false);
  const [loginPin, setLoginPin] = useState('');
  const [active, setActive] = useState(true);
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { api.get(`/referrals/${referralId}/portal-account`).then(({ data }) => { if (data) { setEmail(data.email); setActive(data.active); setExists(true); } }).catch(() => setMessage('Could not load the partner account.')).finally(() => setLoading(false)); }, [referralId]);
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setMessage(''); setSaving(true);
    try { const { data } = await api.put(`/referrals/${referralId}/portal-account`, { email, active, resetPin: !exists || resetPin }); setLoginPin(data.loginPin || ''); setResetPin(false); setExists(true); setMessage(data.loginPin ? 'Partner login saved. Share this one-time PIN privately; it will not be shown again.' : 'Partner login saved. Previous sessions have been revoked.'); }
    catch (error: any) { setMessage(error.response?.data?.message || 'Could not save the partner account.'); } finally { setSaving(false); }
  };
  return <form onSubmit={save} className="mb-6 rounded-xl border border-slate-200 bg-white p-4"><h3 className="font-bold">Referral portal access</h3><p className="my-2 text-sm text-slate-500">Separate account scope: Referrals only. This login cannot sign into the RE staff app or IbogaReady.</p>{message && <p role="status" className="my-3">{message}</p>}{loginPin && <p className="my-3 rounded bg-amber-50 p-3 font-mono text-lg" aria-label="One-time referral PIN">One-time PIN: <strong>{loginPin}</strong></p>}<div className="grid gap-3 sm:grid-cols-2"><label>Login email (username)<input className="mt-1 w-full rounded border p-2" type="email" required autoComplete="off" value={email} onChange={e => setEmail(e.target.value)} /></label><div className="self-end">{exists && <label className="my-3 flex gap-2"><input type="checkbox" checked={resetPin} onChange={e => { setResetPin(e.target.checked); setLoginPin(''); }} />Generate a new 6-digit PIN</label>}</div></div><label className="my-3 flex gap-2"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />Partner login enabled</label><button disabled={loading || saving} className="rounded bg-blue-700 px-4 py-2 text-white">{saving ? 'Saving…' : exists ? 'Save portal access' : 'Create referral login and PIN'}</button></form>;
};
