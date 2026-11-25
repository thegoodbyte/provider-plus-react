import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { medicalReviewRequestsApi } from '../services/api';
import { MedicalArtifact, MedicalReviewRequest } from '../types';
import LoadingSpinner from './LoadingSpinner';

type Decision = 'OK' | 'caution' | 'more_info_needed' | 'NOT OK';

const DECISION_OPTIONS: Array<{ value: Decision; label: string; selectedClass: string; idleClass: string }> = [
  { value: 'OK', label: 'Approved — clear to proceed', selectedClass: 'border-green-600 bg-green-600 text-white', idleClass: 'border-green-200 bg-green-50 text-green-900 hover:bg-green-100' },
  { value: 'caution', label: 'Approved with caution', selectedClass: 'border-yellow-500 bg-yellow-500 text-white', idleClass: 'border-yellow-200 bg-yellow-50 text-yellow-900 hover:bg-yellow-100' },
  { value: 'more_info_needed', label: 'Need more information', selectedClass: 'border-blue-600 bg-blue-600 text-white', idleClass: 'border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100' },
  { value: 'NOT OK', label: 'Not safe to proceed', selectedClass: 'border-red-600 bg-red-600 text-white', idleClass: 'border-red-200 bg-red-50 text-red-900 hover:bg-red-100' },
];

const REQUEST_TYPE_LABELS: Record<string, string> = {
  ekg: 'EKG', liver: 'Liver Panel', both: 'EKG + Liver Panel',
  ekg_review: 'EKG Review', ceremony_ekg_review: 'Ceremony EKG Review',
  blood_pressure_review: 'Blood Pressure Review', liver_panel_review: 'Liver Panel Review',
  medications_review: 'Medications Review', questionnaire_review: 'Questionnaire Review',
  food_review: 'Food Intake Review', medical_question: 'Medical Question', general_clearance: 'General Clearance',
};

const getRequestTypeLabel = (requestType?: string) => (requestType ? REQUEST_TYPE_LABELS[requestType] || requestType : 'Medical Review');

const getClientName = (clientId: any) => {
  if (!clientId || typeof clientId === 'string') return 'Client';
  return [clientId.firstName, clientId.lastName].filter(Boolean).join(' ') || 'Client';
};

const getRetreatLabel = (retreatId: any) => {
  if (!retreatId || typeof retreatId === 'string') return '';
  return retreatId.code || retreatId.retreatCode || retreatId.name || '';
};

const MedicalReviewQuickAccessPage: React.FC = () => {
  const { displayId = '', token = '' } = useParams();
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<MedicalReviewRequest | null>(null);
  const [artifacts, setArtifacts] = useState<MedicalArtifact[]>([]);
  const [error, setError] = useState('');
  const [decision, setDecision] = useState<Decision | ''>('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const response = await medicalReviewRequestsApi.getQuickAccess(displayId, token);
        if (!active) return;
        setRequest(response.data.request);
        setArtifacts(response.data.artifacts || []);
      } catch (err: any) {
        if (!active) return;
        setError(err?.response?.data?.message || 'This medical review link is invalid or expired.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [displayId, token]);

  const canSubmit = Boolean(decision) && note.trim().length >= 2 && !submitting;

  const submit = async () => {
    if (!canSubmit || !decision) return;
    try {
      setSubmitting(true);
      setSubmitError('');
      await medicalReviewRequestsApi.submitQuickAccessDecision(displayId, token, { reviewDecision: decision, medicalStaffNotes: note.trim() });
      setSubmitted(true);
    } catch (err: any) {
      if (err?.response?.status === 403) {
        setSubmitError('This link is no longer valid for the assigned reviewer. Ask the Provider Plus admin to send a new link.');
      } else {
        setSubmitError(err?.response?.data?.message || 'Could not save your review. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading medical review..." />;

  if (error || !request) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-2xl text-amber-700">!</div>
          <h1 className="text-xl font-semibold text-gray-900">This link can't be opened</h1>
          <p className="mt-3 text-base text-gray-600">{error || 'Medical review request not found.'}</p>
          <p className="mt-4 text-sm text-gray-500">Ask the Provider Plus admin to send you a new review link.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-green-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl text-green-700">✓</div>
          <h1 className="text-2xl font-semibold text-gray-900">Thank you</h1>
          <p className="mt-3 text-lg text-gray-700">Your review has been recorded.</p>
          <p className="mt-2 text-sm text-gray-500">You can close this page now.</p>
        </div>
      </div>
    );
  }

  const clientName = getClientName(request.clientId);
  const retreatLabel = getRetreatLabel(request.retreatId);

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Medical review #{request.display_id ?? '—'}</div>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">{clientName}</h1>
          <p className="mt-1 text-lg text-gray-700">{getRequestTypeLabel(request.requestType)}</p>
          {retreatLabel && <p className="mt-1 text-base text-gray-500">{retreatLabel}</p>}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900">Documents</h2>
          {artifacts.length === 0 ? (
            <p className="mt-3 text-base text-gray-500">No documents are attached to this request.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {artifacts.map((artifact) => (
                <div key={artifact._id} className="rounded-xl border border-gray-200 p-4">
                  <div className="text-base font-semibold text-gray-900">{artifact.title || 'Document'}</div>
                  {!!artifact.files?.length && (
                    <div className="mt-3 space-y-2">
                      {artifact.files.map((file: any, index) => (
                        <a
                          key={`${file.fileName || file.url}-${index}`}
                          href={file.url || file.filePath || file.s3Key}
                          target="_blank"
                          rel="noreferrer"
                          className="flex min-h-[52px] items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-center text-base font-semibold text-blue-800 active:bg-blue-100"
                        >
                          Open {file.fileName || `file ${index + 1}`}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900">Your review</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {DECISION_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setDecision(option.value)}
                className={`min-h-[56px] rounded-xl border-2 px-4 py-3 text-left text-base font-semibold ${decision === option.value ? option.selectedClass : option.idleClass}`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <label className="mt-5 block text-base font-semibold text-gray-900" htmlFor="quick-review-note">
            Notes
          </label>
          <textarea
            id="quick-review-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={4}
            placeholder="Write your findings or instructions here"
            className="mt-2 w-full rounded-xl border border-gray-300 p-3 text-base text-gray-900"
          />

          {submitError && <p className="mt-3 text-base font-medium text-red-700">{submitError}</p>}

          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="mt-5 min-h-[56px] w-full rounded-xl bg-gray-900 px-4 py-3 text-lg font-bold text-white disabled:opacity-40"
          >
            {submitting ? 'Submitting…' : 'Submit review'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MedicalReviewQuickAccessPage;
