import { useToast } from '../hooks/useToast';
import Toast from './Toast';
import { apiErrorMessage } from '../utils/apiErrorMessage';
import React, { useEffect, useRef, useState } from 'react';
import { MedicalReviewRequest } from '../types';
import { User } from '../services/usersApi';
import { medicalReviewRequestsApi } from '../services/api';
import ResponsiveModal from './ResponsiveModal';

const dateValue = (value?: string | Date) => value ? new Date(value).toISOString().slice(0, 10) : '';
const userId = (value: any): string => typeof value === 'string' ? value : value?._id || '';
const decisions = { OK: 'OK', caution: 'Caution', more_info_needed: 'More information needed', 'NOT OK': 'Declined', WONT_DO: 'Won’t do' };
const statuses = { OK: 'approved', caution: 'caution', more_info_needed: 'needs_resubmission', 'NOT OK': 'rejected', WONT_DO: 'wont_do' } as const;

export default function MedicalReviewWhatsAppForm({ request, clientLabel, advisors, onClose, onSaved }: {
  request: MedicalReviewRequest;
  clientLabel?: string;
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
  const { toast, showError, dismiss } = useToast();
  const [error, setError] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const dialog = formRef.current?.closest('[role="dialog"]');
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || []);
    formRef.current?.querySelector<HTMLSelectElement>('select')?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const fields = focusable();
      const first = fields[0], last = fields[fields.length - 1];
      if (!first || !last) return;
      if (!dialog?.contains(document.activeElement) || (event.shiftKey && document.activeElement === first)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', trapFocus);
    return () => {
      document.removeEventListener('keydown', trapFocus);
      if (opener?.isConnected) opener.focus();
    };
  }, []);
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
      showError(apiErrorMessage(error, 'Could not save the WhatsApp status.'));
    } finally { setSaving(false); }
  };
  const fieldClass = 'mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2';
  return <ResponsiveModal isOpen onClose={() => { if (!saving) onClose(); }} title={`WhatsApp · MRR #${request.display_id || '—'}`} size="md">
    <Toast toast={toast} onDismiss={dismiss} />
    <form ref={formRef} onSubmit={save} className="space-y-4 p-4">
      {clientLabel && <p className="font-semibold text-gray-900">{clientLabel}</p>}
      <p className="text-sm text-gray-600">Record the advisor and WhatsApp status, then save to return to the list. Opening or cancelling this form makes no changes. Send the message in WhatsApp separately.</p>
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
