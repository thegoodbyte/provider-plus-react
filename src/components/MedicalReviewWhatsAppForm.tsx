import React, { useState } from 'react';
import { MedicalReviewRequest } from '../types';
import { User } from '../services/usersApi';
import { medicalReviewRequestsApi } from '../services/api';
import ResponsiveModal from './ResponsiveModal';

const dateValue = (value?: string | Date) => value ? new Date(value).toISOString().slice(0, 10) : '';
const userId = (value: any): string => typeof value === 'string' ? value : value?._id || '';
const decisions = { OK: 'OK', caution: 'Caution', more_info_needed: 'More information needed', 'NOT OK': 'Declined', WONT_DO: 'Won’t do' };
const statuses = { OK: 'approved', caution: 'caution', more_info_needed: 'needs_resubmission', 'NOT OK': 'rejected', WONT_DO: 'wont_do' } as const;

export default function MedicalReviewWhatsAppForm({ request, advisors, onClose, onSaved }: {
  request: MedicalReviewRequest;
  advisors: User[];
  onClose: () => void;
  onSaved: (request: MedicalReviewRequest) => void;
}) {
  const [advisor, setAdvisor] = useState(userId(request.whatsappAdvisorUserId) || userId(request.assignedToUserId));
  const [sentAt, setSentAt] = useState(dateValue(request.whatsappSentAt) || dateValue(new Date()));
  const [status, setStatus] = useState(request.whatsappStatus === 'responded' ? 'responded' : 'awaiting_response');
  const [respondedAt, setRespondedAt] = useState(dateValue(request.whatsappRespondedAt) || dateValue(new Date()));
  const [decision, setDecision] = useState(request.whatsappDecision || '');
  const [advisorNote, setAdvisorNote] = useState(request.reviewNotes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || !request._id) return;
    if (!advisor || !sentAt || (status === 'responded' && (!respondedAt || !decision))) {
      setError('Select the advisor, dates and result before saving.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload: Partial<MedicalReviewRequest> = {
        reviewChannel: 'whatsapp', whatsappAdvisorUserId: advisor, whatsappSentAt: sentAt,
        whatsappStatus: status as 'responded' | 'awaiting_response',
        status: status === 'responded' ? statuses[decision as keyof typeof statuses] : 'awaiting_whatsapp',
        ...(status === 'responded' ? {
          whatsappRespondedAt: respondedAt, whatsappDecision: decision as MedicalReviewRequest['whatsappDecision'],
          reviewDecision: decision as MedicalReviewRequest['reviewDecision'], reviewedAt: respondedAt,
          reviewNotes: advisorNote.trim() || 'Advisor response received via WhatsApp',
        } : {}),
      };
      const response = await medicalReviewRequestsApi.update(request._id, payload);
      onSaved(response.data);
    } catch (error: any) {
      setError(error?.response?.data?.message || 'Could not save WhatsApp status. Please try again.');
    } finally { setSaving(false); }
  };
  const fieldClass = 'mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2';
  return <ResponsiveModal isOpen onClose={() => { if (!saving) onClose(); }} title={`WhatsApp · MRR #${request.display_id || '—'}`} size="md">
    <form onSubmit={save} className="space-y-4 p-4">
      <p className="text-sm text-gray-600">Record the WhatsApp status, then save to return to the list and continue with the next MRR.</p>
      <fieldset disabled={saving} className="space-y-4">
        <label className="block text-sm">Medical advisor<select required value={advisor} onChange={e => setAdvisor(e.target.value)} className={fieldClass}>
          <option value="">Select advisor</option>
          {advisor && !advisors.some(user => user._id === advisor) && <option value={advisor}>Previously assigned advisor</option>}
          {advisors.map(user => <option key={user._id} value={user._id}>{[user.firstName, user.lastName].filter(Boolean).join(' ') || user.email}</option>)}
        </select></label>
        <label className="block text-sm">Date sent<input required type="date" value={sentAt} onChange={e => setSentAt(e.target.value)} className={fieldClass} /></label>
        <label className="block text-sm">WhatsApp status<select value={status} onChange={e => setStatus(e.target.value)} className={fieldClass}>
          {request.whatsappStatus !== 'responded' && <option value="awaiting_response">Sent — waiting for answer</option>}
          <option value="responded">Handled — advisor answered</option>
        </select></label>
        {status === 'responded' && <>
          <label className="block text-sm">Date answered<input required type="date" value={respondedAt} min={sentAt} onChange={e => setRespondedAt(e.target.value)} className={fieldClass} /></label>
          <label className="block text-sm">Advisor result<select required value={decision} onChange={e => setDecision(e.target.value)} className={fieldClass}><option value="">Select result</option>{Object.entries(decisions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="block text-sm">What did the advisor say?<textarea value={advisorNote} onChange={e => setAdvisorNote(e.target.value)} rows={4} placeholder="Summarize the advisor's WhatsApp reply here — this is saved as the MRR's review notes." className={fieldClass} /></label>
        </>}
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={onClose} className="rounded-md border px-3 py-2">Cancel</button><button type="submit" disabled={saving} className="rounded-md bg-purple-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save and return to list'}</button></div>
    </form>
  </ResponsiveModal>;
}
