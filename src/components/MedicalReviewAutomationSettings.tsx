import React, { useEffect, useState } from 'react';
import { medicalReviewAutomationApi, medicalReviewRequestsApi, usersApi, ReviewAutomationSettings, ReviewSourceRule } from '../services/api';
import { authService } from '../services/authService';
import { MedicalReviewGroup } from '../types';

const requestTypes = ['ekg_review', 'ceremony_ekg_review', 'blood_pressure_review', 'liver_panel_review', 'medications_review', 'questionnaire_review', 'food_review', 'medical_question', 'general_clearance'];
const defaultRule = (source: 'ir' | 'website', artifactType: string): ReviewSourceRule => ({ source, artifactType, enabled: false, advisorUserId: '', packetMode: 'match', packetId: '', notifyAdvisor: true, notifyAdmin: true, adminEmails: [] });
const languageLabel = (language?: string) => ({ en: 'English', cs: 'Czech', pl: 'Polish' })[language || 'en'] || language;
export default function MedicalReviewAutomationSettings() {
  const admin = authService.getUser()?.role === 'admin';
  const [draft, setDraft] = useState<ReviewAutomationSettings | null>(null);
  const [advisors, setAdvisors] = useState<any[]>([]);
  const [packets, setPackets] = useState<MedicalReviewGroup[]>([]);
  const [selectedType, setSelectedType] = useState('ekg');
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!admin) return;
    let active = true;
    Promise.all([medicalReviewAutomationApi.get(), usersApi.findAll(), medicalReviewRequestsApi.getGroups()])
      .then(([settings, users, groups]) => {
        if (!active) return;
        setDraft(settings.data);
        setAdvisors(users.data.filter(user => user.role === 'medical_advisor' && user.isActive !== false));
        setPackets(groups.data);
      })
      .catch(() => { if (active) setError('Could not load review automation settings. Reopen Settings to try again.'); });
    return () => { active = false; };
  }, [admin]);
  const change = (source: 'ir' | 'website', values: Partial<ReviewSourceRule>) => {
    setDraft(current => {
      if (!current) return current;
      const previous = current.rules.find(rule => rule.source === source && rule.artifactType === selectedType) || defaultRule(source, selectedType);
      return { ...current, rules: [...current.rules.filter(rule => rule !== previous), { ...previous, ...values }] };
    });
    setMessage('');
  };
  const addType = () => {
    if (!draft) return;
    if (!/^[a-z][a-z0-9_]{0,63}$/.test(newKey) || !newLabel.trim() || draft.artifactTypes.some(type => type.key === newKey)) {
      setError('Enter a unique lowercase artifact key (letters, digits, underscores) and a label.'); return;
    }
    setDraft({ ...draft, artifactTypes: [...draft.artifactTypes, { key: newKey, label: newLabel.trim(), requestType: 'general_clearance' }] });
    setSelectedType(newKey); setNewKey(''); setNewLabel(''); setError(''); setMessage('');
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const result = await medicalReviewAutomationApi.save(draft);
      setDraft(result.data);
      setMessage('Medical review automation settings saved. These rules apply to future submissions.');
    } catch (caught: any) {
      const detail = caught.response?.data?.message;
      setError(Array.isArray(detail) ? detail.join(' ') : detail || 'Could not save review automation settings.');
    } finally { setSaving(false); }
  };
  return <section className="payment-types-settings" aria-label="Medical review automation">
    <h3>Medical review automation</h3>
    <p>Configure automatic medical review requests by artifact type and submission source. Configure each source independently. Existing reviews are not changed.</p>
    {!admin ? <p>Only administrators can configure review automation.</p> : !draft ? (!error && <p>Loading settings…</p>) : <form onSubmit={save}>
      <fieldset disabled={saving} className="space-y-6">
        <table className="w-full text-left text-sm"><caption className="text-left font-semibold">Artifact types and automatic assignment</caption><thead><tr><th>Artifact type</th><th>IR</th><th>Website</th></tr></thead><tbody>{draft.artifactTypes.map(type => <tr key={type.key}><td><button type="button" className="py-2 text-blue-700 underline" aria-pressed={selectedType === type.key} onClick={() => setSelectedType(type.key)}>{type.label}</button> <small>({type.key})</small></td>{(['ir', 'website'] as const).map(source => <td key={source}>{draft.rules.find(rule => rule.artifactType === type.key && rule.source === source)?.enabled ? 'Enabled' : 'Off'}</td>)}</tr>)}</tbody></table>
        <div className="space-y-2 rounded border p-3"><h4>Add an artifact type</h4><label className="block">New artifact key<input className="block w-full rounded border p-2" value={newKey} onChange={event => setNewKey(event.target.value)} placeholder="e.g. specialist_report" /></label><label className="block">New artifact label<input maxLength={100} className="block w-full rounded border p-2" value={newLabel} onChange={event => setNewLabel(event.target.value)} placeholder="e.g. Specialist report" /></label><button type="button" className="rounded border px-3 py-2" onClick={addType}>Add artifact type</button><p className="text-sm">A new type starts with automation off. Adding a type does not create a form. New forms and upload paths must be connected to this type before automation can run.</p></div>
        <h4 className="font-semibold">Configure {draft.artifactTypes.find(type => type.key === selectedType)?.label}</h4>
        <label className="block">Medical review type<select className="block w-full rounded border p-2" value={draft.artifactTypes.find(type => type.key === selectedType)?.requestType} onChange={event => setDraft({ ...draft, artifactTypes: draft.artifactTypes.map(type => type.key === selectedType ? { ...type, requestType: event.target.value } : type) })}>{requestTypes.map(type => <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>)}</select></label>
        {(['ir', 'website'] as const).map(source => {
          const rule = draft.rules.find(rule => rule.source === source && rule.artifactType === selectedType) || defaultRule(source, selectedType);
          const advisor = advisors.find(user => user._id === rule.advisorUserId);
          const availablePackets = packets.filter(packet => {
            const owner = typeof packet.reviewerUserId === 'object' ? packet.reviewerUserId?._id : packet.reviewerUserId;
            return owner === rule.advisorUserId && packet.groupType === 'custom' && !packet.retreatId && packet.ceremonyNumber == null && Boolean(packet.endDate && new Date(packet.endDate).getTime() > Date.now());
          });
          const prefix = source === 'ir' ? 'IbogaReady' : 'Website';
          return <fieldset key={source} className="space-y-3 rounded-lg border p-4">
            <legend className="px-2 font-semibold">{prefix} submissions</legend>
            <label className="block"><input type="checkbox" checked={rule.enabled} onChange={event => change(source, { enabled: event.target.checked })} /> Enable {prefix} automatic MRRs</label>
            <label className="block">{prefix} default advisor<select required={rule.enabled} className="block w-full rounded border p-2" value={rule.advisorUserId} onChange={event => change(source, { advisorUserId: event.target.value, packetId: '' })}>
              <option value="">Select advisor</option>
              {rule.advisorUserId && !advisor && <option value={rule.advisorUserId}>Previously selected advisor is unavailable</option>}
              {advisors.map(user => <option key={user._id} value={user._id}>{[user.firstName, user.lastName].filter(Boolean).join(' ') || user.email} — {languageLabel(user.preferredReviewLanguage)}</option>)}
            </select></label>
            <p className="text-sm">Review language: {advisor ? languageLabel(advisor.preferredReviewLanguage) : 'select an advisor'}. Configure the advisor’s preferred review language in User Management.</p>
            <label className="block">{prefix} packet selection<select className="block w-full rounded border p-2" value={rule.packetMode} onChange={event => change(source, { packetMode: event.target.value as 'match' | 'fixed' })}>
              <option value="match">Automatically match advisor and retreat</option><option value="fixed">Use a fixed custom packet</option>
            </select></label>
            {rule.packetMode === 'fixed' && <label className="block">{prefix} default packet<select required={rule.enabled} className="block w-full rounded border p-2" value={rule.packetId} onChange={event => change(source, { packetId: event.target.value })}>
              <option value="">Select packet</option>
              {rule.packetId && !availablePackets.some(packet => packet._id === rule.packetId) && <option value={rule.packetId}>Previously selected packet is unavailable</option>}
              {availablePackets.map(packet => <option key={packet._id} value={packet._id}>{packet.title}</option>)}
            </select></label>}
            <p className="text-sm">Automatic matching uses this advisor’s unexpired ceremony packet, then retreat packet, then a custom packet without a retreat. Exactly one packet must match at the chosen level. Missing or ambiguous matches generate a staff notification for manual setup. Manage packets in Medical Review Requests.</p>
            <label className="block"><input type="checkbox" checked={rule.notifyAdvisor} onChange={event => change(source, { notifyAdvisor: event.target.checked })} /> {prefix}: Email the assigned advisor</label>
            <label className="block"><input type="checkbox" checked={rule.notifyAdmin} onChange={event => change(source, { notifyAdmin: event.target.checked })} /> {prefix}: Email admin when an MRR is created</label>
            <label className="block">{prefix} admin emails<input required={rule.enabled && rule.notifyAdmin} className="block w-full rounded border p-2" placeholder="admin@example.com, colleague@example.com" value={rule.adminEmails.join(', ')} onChange={event => change(source, { adminEmails: event.target.value.split(',').map(value => value.trim()) })} /></label>
          </fieldset>;
        })}
        <button type="submit" className="rounded bg-blue-700 px-4 py-2 text-white">{saving ? 'Saving…' : 'Save review automation'}</button>
      </fieldset>
      <p className="mt-4">Drafts and failed uploads do not create an MRR. Automatic creation does not send a client submission email. Advisor/admin emails follow the existing outbound email safety settings.</p>
    </form>}
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
  </section>;
}
