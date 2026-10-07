import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { bookingFlowApi } from '../services/api';
import { MedicalArtifact, MedicalReviewRequest } from '../types';
import { BookingStepReminderModal, BookingStepReminderModalState } from './BookingStepCommunicationModals';
import { buildBookingStepReminderPayload, getBookingStepDuplicateReminderPrompt, getBookingStepReminderFailure } from './bookingStepCommunicationRules';
import BookingMedicalUpload from './BookingMedicalUpload';
import MedicalItemCard, { MedicalItemCardProps } from './MedicalItemCard';
import { deriveMedicalItemState, MEDICAL_ITEM_TONES, MedicalItemState } from './medicalItemStatus';
import './BookingMedicalOverviewPanel.css';
import {
  findRequiredEntryFlowItem,
  groupMedicalArtifacts,
  latestArtifactReview,
  loadBookingMedicalOverview,
  medicalStageLabels,
  medicalStageOrder,
  recordsSummary,
  requiredEntryRows,
  reviewedMedicalStatuses,
} from './bookingMedicalOverviewData';

export interface BookingMedicalOverviewPanelProps {
  bookingId: string;
  clientId?: string;
  retreatId?: string;
  refreshKey: number;
  onUploadComplete: () => void;
  bookingNumber?: number | string;
}

export const medicalRoutePrefix = (pathname: string) => {
  const first = pathname.split('/').filter(Boolean)[0];
  return ['admin', 'medical', 'staff', 'user'].includes(first) ? `/${first}` : '';
};
export const medicalOverviewError = (error: any) => error?.response?.data?.message || error?.message || 'Unable to load booking medical records.';
export const reviewDecisionText = (review?: MedicalReviewRequest) => review?.reviewDecision || review?.decision || (review?.status && reviewedMedicalStatuses.has(review.status) ? review.status : 'No decision');
export const reviewReferenceText = (review?: MedicalReviewRequest) => review ? `MRR #${review.display_id || review._id || '—'}` : 'NO MRR';
export const reviewDecisionClass = (review?: MedicalReviewRequest) => {
  const value = String(reviewDecisionText(review)).toLowerCase();
  if (value.includes('ok') || value.includes('approved') || value.includes('completed')) return 'medical-decision-ok';
  if (value.includes('caution') || value.includes('need')) return 'medical-decision-caution';
  if (value.includes('not') || value.includes('declined') || value.includes('reject')) return 'medical-decision-declined';
  return 'medical-decision-pending';
};
export const shortMedicalDate = (value?: Date | string) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};
export const artifactTitle = (artifact: MedicalArtifact) => [artifact.title || artifact.documentType || artifact.artifactType || 'Medical record', artifact.ceremonyNumber ? `Ceremony #${artifact.ceremonyNumber}` : ''].filter(Boolean).join(' - ');

const reviewNotes = (review?: MedicalReviewRequest) => review?.reviewNotes || review?.overallNotes || review?.medicalStaffNotes || '';

const OVERALL_LABELS: Record<MedicalItemState, (count: number) => string> = {
  declined: count => `${count} entry item${count === 1 ? '' : 's'} declined`,
  missing: count => `${count} entry item${count === 1 ? '' : 's'} missing`,
  pending: () => 'Entry review in progress',
  caution: () => 'Cleared with caution',
  ok: () => 'Entry items cleared',
  received: () => 'Entry review in progress',
};

const BookingMedicalOverviewPanel: React.FC<BookingMedicalOverviewPanelProps> = ({ bookingId, clientId, retreatId, refreshKey, onUploadComplete, bookingNumber }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const prefix = useMemo(() => medicalRoutePrefix(location.pathname), [location.pathname]);
  const [artifacts, setArtifacts] = useState<MedicalArtifact[]>([]);
  const [reviews, setReviews] = useState<Record<string, MedicalReviewRequest[]>>({});
  const [plan, setPlan] = useState<any[]>([]);
  const [flowItems, setFlowItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadRequest, setUploadRequest] = useState<{ stage: NonNullable<MedicalArtifact['documentStage']>; documentType?: 'EKG' | 'Liver'; key: number } | null>(null);
  const [stageOpen, setStageOpen] = useState<Record<string, boolean>>({ entry: true });
  const [reminderState, setReminderState] = useState<BookingStepReminderModalState | null>(null);
  const [reminderSaving, setReminderSaving] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await loadBookingMedicalOverview(bookingId, clientId, retreatId);
      setArtifacts(result.artifacts);
      setReviews(result.reviewsByArtifact);
      setPlan(result.medicationPlan);
      setFlowItems(result.flowItems);
    } catch (cause) {
      setError(medicalOverviewError(cause));
    } finally {
      setLoading(false);
    }
  }, [bookingId, clientId, retreatId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const stages = groupMedicalArtifacts(artifacts);
  const required = requiredEntryRows(artifacts, reviews);
  const allClear = plan.find(item => item.metadata?.medicationStopPlanAllClear);
  const summaryCounts = recordsSummary(artifacts, reviews);

  const openArtifact = (artifact: MedicalArtifact) => artifact._id && navigate(`${prefix}/medical-artifacts/${artifact._id}`);
  const openReview = (review: MedicalReviewRequest) => review._id && navigate(`${prefix}/medical-review-requests/${review._id}`);
  const createReview = (artifact: MedicalArtifact) => artifact._id && navigate(`${prefix}/medical-review-requests/new?artifactId=${artifact._id}`);
  const requestUpload = (stage: NonNullable<MedicalArtifact['documentStage']>, event?: React.MouseEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    setUploadRequest({ stage, key: Date.now() });
  };
  const requestEntryUpload = (documentType: 'EKG' | 'Liver') => setUploadRequest({ stage: 'entry', documentType, key: Date.now() });
  const toggleStage = (stage: string) => setStageOpen(current => ({ ...current, [stage]: !current[stage] }));

  const openEntryReminder = async (documentType: 'EKG' | 'Liver') => {
    const flowItem = findRequiredEntryFlowItem(flowItems, documentType);
    if (!flowItem?._id) { setError('No booking step is linked to this requirement yet.'); return; }
    setReminderSaving(`reminder-preview:${flowItem._id}`);
    try {
      const response = await bookingFlowApi.getItemReminderPreview(flowItem._id);
      setReminderState({ item: flowItem, ...response.data });
    } catch (cause: any) {
      setError(medicalOverviewError(cause));
    } finally {
      setReminderSaving('');
    }
  };
  const sendEntryReminder = async (overrideDuplicate = false) => {
    if (!reminderState?.item?._id) return;
    const duplicatePrompt = getBookingStepDuplicateReminderPrompt(reminderState, overrideDuplicate);
    if (duplicatePrompt) {
      if (!window.confirm(duplicatePrompt)) return;
      overrideDuplicate = true;
    }
    setReminderSaving(`reminder-send:${reminderState.item._id}`);
    try {
      const response = await bookingFlowApi.sendItemReminder(reminderState.item._id, buildBookingStepReminderPayload(reminderState, overrideDuplicate));
      const failure = getBookingStepReminderFailure(response);
      if (failure) { setError(failure); return; }
      setReminderState(null);
    } catch (cause: any) {
      setError(medicalOverviewError(cause));
    } finally {
      setReminderSaving('');
    }
  };

  const requiredCards: Array<MedicalItemCardProps & { key: string }> = required.map(({ documentType, artifact, review }) => {
    const state = deriveMedicalItemState(artifact, review);
    return {
      key: documentType,
      state,
      title: `Entry ${documentType === 'Liver' ? 'liver panel' : documentType}`,
      artifactRef: artifact ? `Artifact #${artifact.display_id || artifact._id}` : undefined,
      mrr: review ? reviewReferenceText(review) : undefined,
      note: review ? reviewNotes(review) || undefined : undefined,
      channel: review?.reviewChannel === 'whatsapp' ? 'WhatsApp' : 'Internal',
      receivedAt: artifact ? shortMedicalDate(artifact.receivedAt || artifact.createdAt) : undefined,
      sentAt: review ? shortMedicalDate(review.requestedAt || review.createdAt) : undefined,
      reviewedAt: review?.reviewedAt ? shortMedicalDate(review.reviewedAt) : undefined,
      onOpenFile: artifact ? () => openArtifact(artifact) : undefined,
      onOpenMrr: review ? () => openReview(review) : undefined,
      onCreateMrr: artifact && !review ? () => createReview(artifact) : undefined,
      onUploadFile: clientId && retreatId ? () => requestEntryUpload(documentType === 'Liver' ? 'Liver' : 'EKG') : undefined,
      onRequestFromClient: () => openEntryReminder(documentType === 'Liver' ? 'Liver' : 'EKG'),
    };
  });

  const declinedCount = requiredCards.filter(card => card.state === 'declined').length;
  const missingCount = requiredCards.filter(card => card.state === 'missing').length;
  const decidedCount = requiredCards.filter(card => ['ok', 'caution', 'declined'].includes(card.state)).length;
  const cautionCount = requiredCards.filter(card => card.state === 'caution').length;
  const receivedCount = requiredCards.filter(card => card.state !== 'missing').length;
  const overallState: MedicalItemState = declinedCount ? 'declined' : missingCount ? 'missing' : decidedCount < required.length ? 'pending' : cautionCount ? 'caution' : 'ok';
  const overallCount = overallState === 'declined' ? declinedCount : missingCount;
  const overallTone = MEDICAL_ITEM_TONES[overallState];

  return <div className="booking-medical-panel booking-medical-redesign">
    <header className="booking-medical-page-header">
      <div>
        <div className="booking-medical-eyebrow">Booking #{bookingNumber || bookingId}</div>
        <h2>Medical</h2>
        <p>{receivedCount} of {required.length} entry items received · {decidedCount} of {required.length} decided</p>
      </div>
      <div className="booking-medical-header-actions">
        <span className="booking-medical-overall-pill" style={{ background: overallTone.chip, color: overallTone.ink }}>
          <span className="booking-medical-overall-dot" style={{ background: overallTone.dot }} />
          {OVERALL_LABELS[overallState](overallCount)}
        </span>
        <button className="booking-medical-button is-secondary" type="button" onClick={load} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
      </div>
    </header>

    {error && <div className="alert alert-danger" role="alert">{error}</div>}

    <section className="booking-medical-section">
      <div className="booking-medical-section-heading">
        <h3>Required entry items</h3>
        <span>Both must be reviewed before the retreat starts</span>
      </div>
      <div className="booking-medical-required-grid">
        {requiredCards.map(({ key, ...card }) => <MedicalItemCard key={key} {...card} />)}
      </div>
    </section>

    <section className={`booking-medical-stop-plan ${allClear ? 'is-clear' : ''}`}>
      <div className="booking-medical-stop-plan-heading">
        <div><h3>Medication stop plan</h3><p>{allClear ? allClear.description : plan.length ? 'Review the preparation dates and medication instructions below.' : 'No preparation decision recorded yet.'}</p></div>
        <button className="booking-medical-button is-primary" type="button" onClick={() => navigate(`${prefix}/bookings/${bookingId}/medication-stop-plan`)}>{plan.length ? 'Edit medication plan' : 'Set plan'}</button>
      </div>
      {allClear ? <div className="booking-medical-all-clear">✓ All good — nothing to prepare</div> : plan.length ? <div className="booking-medical-plan-grid">{plan.map(item => {
        const due = item.dueDate ? new Date(item.dueDate) : null;
        const overdue = Boolean(due && due.getTime() < Date.now() && !['completed', 'approved'].includes(item.status));
        return <div className={overdue ? 'is-overdue' : 'is-upcoming'} key={item._id}><span>{item.title || 'Medication action'}</span><strong>{due ? due.toLocaleDateString() : 'Date not set'}</strong><small>{item.description || String(item.status || 'pending').replace(/_/g, ' ')}</small>{item.metadata?.taperPlan && <small>{item.metadata.taperPlan}</small>}</div>;
      })}</div> : <div className="booking-medical-plan-grid">
        <div><span>Stop date</span><strong>Not set</strong><small>Needed before arrival</small></div>
        <div><span>Last dose recorded</span><strong>Not set</strong><small>Client confirms in the app</small></div>
        <div><span>Restart after retreat</span><strong>Not set</strong><small>Set at exit review</small></div>
      </div>}
    </section>

    <section className="booking-medical-section">
      <div className="booking-medical-section-heading">
        <h3>Records by stage</h3>
        <span>{summaryCounts.total} records · {summaryCounts.undecided} without a decision{summaryCounts.noMrr ? ` · ${summaryCounts.noMrr} need an MRR` : ''}</span>
      </div>
      <div className="booking-medical-stage-list">
        {medicalStageOrder.map(stage => {
          const records = stages[stage || 'other'] || [];
          const open = Boolean(stageOpen[stage]);
          const recordStates = records.map(record => deriveMedicalItemState(record, latestArtifactReview(record, reviews)));
          const needsDecision = recordStates.filter(state => state !== 'ok' && state !== 'caution' && state !== 'declined').length;
          return <div className={`booking-medical-stage ${records.length ? 'has-records' : 'is-empty'}`} key={stage}>
            <div className="booking-medical-stage-header">
              <span className="booking-medical-stage-name">
                <b style={{ background: records.length ? MEDICAL_ITEM_TONES.pending.chip : undefined, color: records.length ? MEDICAL_ITEM_TONES.pending.ink : undefined }}>{records.length}</b>
                {medicalStageLabels[stage]}
                {needsDecision > 0 && <em>{needsDecision} need{needsDecision === 1 ? 's' : ''} a decision</em>}
              </span>
              <span className="booking-medical-stage-actions">
                {records.length ? <button type="button" onClick={() => toggleStage(stage)}>{open ? 'Hide records' : 'Show records'}</button> : <span className="booking-medical-muted">No records yet</span>}
                {clientId && retreatId && <button type="button" onClick={event => requestUpload(stage || 'other', event)}>Upload</button>}
              </span>
            </div>
            {open && records.length ? <div className="booking-medical-record-list">{records.map(artifact => {
              const review = latestArtifactReview(artifact, reviews);
              const state = deriveMedicalItemState(artifact, review);
              const tone = MEDICAL_ITEM_TONES[state];
              return <article className="booking-medical-record" key={artifact._id || `${artifact.documentType}-${artifact.receivedAt}`}>
                <div className="booking-medical-record-identity">
                  <span className="booking-medical-record-icon" aria-hidden="true">{String(artifact.documentType || '').toLowerCase().includes('ekg') ? '♡' : '▤'}</span>
                  <div><strong>#{artifact.display_id || artifact._id || 'New'} {artifactTitle(artifact)}</strong><span>{artifact.documentType || 'Medical'} · {shortMedicalDate(artifact.receivedAt || artifact.createdAt)} · {(artifact.files || []).length} file{(artifact.files || []).length === 1 ? '' : 's'}</span></div>
                </div>
                <span className="booking-medical-decision" style={{ background: tone.chip, color: tone.ink }}>{tone.label}</span>
                {review ? <button className="booking-medical-review-reference" type="button" onClick={() => openReview(review)}>MRR #{review.display_id || review._id}</button> : <span className="booking-medical-review-reference">NO MRR</span>}
                <div className="booking-medical-record-actions">
                  <button type="button" onClick={() => openArtifact(artifact)}>Open</button>
                  {review ? <button type="button" onClick={() => openReview(review)}>View review</button> : <button className="is-primary" type="button" onClick={() => createReview(artifact)}>Create MRR</button>}
                </div>
              </article>;
            })}</div> : null}
          </div>;
        })}
      </div>
    </section>

    {clientId && retreatId
      ? <BookingMedicalUpload bookingId={bookingId} bookingNumber={bookingNumber} clientId={clientId} retreatId={retreatId} uploadRequest={uploadRequest} hideRequiredDocumentCards onUploadComplete={() => { onUploadComplete(); load(); }} />
      : <section className="booking-medical-section"><p className="booking-medical-muted">Medical upload needs a linked client and retreat on this booking.</p></section>}

    {reminderState && <BookingStepReminderModal state={reminderState} saving={reminderSaving} onChange={setReminderState} onClose={() => setReminderState(null)} onSend={() => sendEntryReminder()} />}
  </div>;
};

export default BookingMedicalOverviewPanel;
