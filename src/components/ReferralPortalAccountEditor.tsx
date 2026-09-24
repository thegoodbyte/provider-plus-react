import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
export const ReferralPortalAccountEditor: React.FC<{ referralId: string; defaultEmail: string }> = ({ referralId, defaultEmail }) => {
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState('');
  const [active, setActive] = useState(true);
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { api.get(`/referrals/${referralId}/portal-account`).then(({ data }) => { if (data) { setEmail(data.email); setActive(data.active); setExists(true); } }).catch(() => setMessage('Could not load the partner account.')).finally(() => setLoading(false)); }, [referralId]);
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setMessage(''); setSaving(true);
    try { await api.put(`/referrals/${referralId}/portal-account`, { email, active, ...(password ? { password } : {}) }); setPassword(''); setExists(true); setMessage('Partner account saved. Previous sessions have been revoked.'); }
    catch (error: any) { setMessage(error.response?.data?.message || 'Could not save the partner account.'); } finally { setSaving(false); }
  };
  return <form onSubmit={save} className="mb-6 rounded-xl border border-slate-200 bg-white p-4"><h3 className="font-bold">Referral portal access</h3><p className="my-2 text-sm text-slate-500">Separate partner login. This account cannot sign into the RE staff app. Share credentials through your usual private channel.</p>{message && <p role="status" className="my-3">{message}</p>}<div className="grid gap-3 sm:grid-cols-2"><label>Login email<input className="mt-1 w-full rounded border p-2" type="email" required autoComplete="off" value={email} onChange={e => setEmail(e.target.value)} /></label><label>{exists ? 'New password (leave blank to keep)' : 'Initial password'}<input className="mt-1 w-full rounded border p-2" type="password" minLength={12} required={!exists} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></label></div><label className="my-3 flex gap-2"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />Partner login enabled</label><button disabled={loading || saving} className="rounded bg-blue-700 px-4 py-2 text-white">{saving ? 'Saving…' : 'Save portal access'}</button></form>;
};
