import { useState } from 'react';
import { Flag, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { medicalReviewRequestsApi } from '../services/api';
import { MedicalReviewRequest } from '../types';
import { apiErrorMessage } from '../utils/apiErrorMessage';

export default function MedicalReviewFollowUpButton({ request, onSaved, compact = false }: {
  request: MedicalReviewRequest;
  compact?: boolean;
  onSaved: (changes: Partial<MedicalReviewRequest>) => void;
}) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  if (!['admin', 'medical_staff'].includes(user?.role || '')) return null;
  const flagged = request.followUpRequired === true;
  const toggle = async () => {
    if (saving || !request._id) return;
    setSaving(true);
    setError('');
    try {
      const { data } = await medicalReviewRequestsApi.setFollowUp(request._id, !flagged);
      onSaved(data);
    } catch (failure) {
      setError(apiErrorMessage(failure, 'Unable to save follow-up flag. Please try again.'));
    } finally {
      setSaving(false);
    }
  };
  return <span className="inline-flex flex-wrap items-center gap-1">
    <button type="button" disabled={saving} aria-busy={saving} aria-pressed={flagged}
      aria-label={`${flagged ? 'Clear follow-up for' : 'Flag for follow-up:'} MRR #${request.display_id}`}
      title={saving ? 'Saving follow-up…' : flagged ? 'Clear follow-up flag' : 'Flag for follow-up'}
      onClick={() => void toggle()}
      className={`${compact ? 'mrr-icon-button' : 'inline-flex items-center gap-1 rounded-md border px-2 py-2 text-xs font-semibold disabled:opacity-50'} ${flagged ? 'border-orange-300 bg-orange-100 text-orange-800' : 'border-gray-300 bg-white text-gray-700'}`}>
      {compact && saving ? <RefreshCw size={14} className="animate-spin" aria-hidden="true" /> : <Flag size={14} fill={flagged ? 'currentColor' : 'none'} />}
      {!compact && (saving ? 'Saving…' : flagged ? 'Follow-up flagged' : 'Flag for follow-up')}
    </button>
    {error && <span role="alert" className="text-xs text-red-700">{error}</span>}
  </span>;
}
