import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MedicalArtifact, MedicalReviewRequest } from '../types';
import BookingMedicalUpload from './BookingMedicalUpload';
import './BookingMedicalOverviewPanel.css';
import {
  groupMedicalArtifacts,
  latestArtifactReview,
  loadBookingMedicalOverview,
  medicalStageLabels,
  medicalStageOrder,
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
const reviewerName = (review?: MedicalReviewRequest) => (review as any)?.reviewedByName || (review as any)?.reviewerName || (review as any)?.reviewer?.name || '';

const BookingMedicalOverviewPanel: React.FC<BookingMedicalOverviewPanelProps> = ({ bookingId, clientId, retreatId, refreshKey, onUploadComplete, bookingNumber }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const prefix = useMemo(() => medicalRoutePrefix(location.pathname), [location.pathname]);
  const [artifacts, setArtifacts] = useState<MedicalArtifact[]>([]);
  const [reviews, setReviews] = useState<Record<string, MedicalReviewRequest[]>>({});
  const [plan, setPlan] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadRequest, setUploadRequest] = useState<{ stage: NonNullable<MedicalArtifact['documentStage']>; documentType?: 'EKG' | 'Liver'; key: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await loadBookingMedicalOverview(bookingId, clientId, retreatId);
      setArtifacts(result.artifacts);
      setReviews(result.reviewsByArtifact);
      setPlan(result.medicationPlan);
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
  const reviewedRequired = required.filter(item => item.review && reviewDecisionText(item.review) !== 'No decision');
  const cautiousRequired = required.filter(item => reviewDecisionClass(item.review) === 'medical-decision-caution');
  const missingRequired = required.filter(item => !item.artifact);
  const noDecisionCount = artifacts.filter(artifact => !latestArtifactReview(artifact, reviews) || reviewDecisionText(latestArtifactReview(artifact, reviews)) === 'No decision').length;
  const overallLabel = missingRequired.length ? 'Action required' : cautiousRequired.length ? 'Cleared with caution' : reviewedRequired.length === required.length ? 'Medical items cleared' : 'Review pending';
  const overallClass = missingRequired.length ? 'medical-decision-declined' : cautiousRequired.length ? 'medical-decision-caution' : reviewedRequired.length === required.length ? 'medical-decision-ok' : 'medical-decision-pending';

  const openArtifact = (artifact: MedicalArtifact) => artifact._id && navigate(`${prefix}/medical-artifacts/${artifact._id}`);
  const openReview = (review: MedicalReviewRequest) => review._id && navigate(`${prefix}/medical-review-requests/${review._id}`);
  const createReview = (artifact: MedicalArtifact) => artifact._id && navigate(`${prefix}/medical-review-requests/new?artifactId=${artifact._id}`);
  const requestUpload = (stage: NonNullable<MedicalArtifact['documentStage']>, event?: React.MouseEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    setUploadRequest({ stage, key: Date.now() });
  };
  const requestEntryUpload = (documentType: 'EKG' | 'Liver') => setUploadRequest({ stage: 'entry', documentType, key: Date.now() });

  return <div className="booking-medical-panel booking-medical-redesign">
    <header className="booking-medical-page-header">
      <div>
        <div className="booking-medical-eyebrow">Booking #{bookingNumber || bookingId}</div>
        <h2>Medical</h2>
        <p>{reviewedRequired.length} of {required.length} required entry items reviewed. {noDecisionCount} record{noDecisionCount === 1 ? '' : 's'} still {noDecisionCount === 1 ? 'has' : 'have'} no decision.</p>
      </div>
      <div className="booking-medical-header-actions">
        <span className={`booking-medical-decision ${overallClass}`}>{overallLabel}</span>
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
        {required.map(({ documentType, artifact, review }) => {
          const decisionClass = artifact ? reviewDecisionClass(review) : 'medical-decision-declined';
          return <article className={`booking-medical-required-card ${decisionClass}`} key={documentType}>
            <div className="booking-medical-card-title-row">
              <span className="booking-medical-document-icon" aria-hidden="true">{documentType === 'EKG' ? '♡' : '◒'}</span>
              <div className="booking-medical-card-title">
                <strong>Entry {documentType === 'Liver' ? 'liver panel' : documentType}</strong>
                <span>{artifact ? <span>Artifact #{artifact.display_id || artifact._id}</span> : 'Required document has not been uploaded'}</span>
              </div>
              <span className={`booking-medical-decision ${decisionClass}`}>{artifact ? reviewDecisionText(review) : 'Missing'}</span>
            </div>
            <p className="booking-medical-required-notes">{artifact ? (reviewNotes(review) || (review ? 'No review notes were added.' : 'No decision recorded yet.')) : `Upload the entry ${documentType.toLowerCase()} to continue.`}</p>
            <div className="booking-medical-card-footer">
              <span>{review?.reviewedAt ? `Reviewed ${shortMedicalDate(review.reviewedAt)}${reviewerName(review) ? ` by ${reviewerName(review)}` : ''}` : artifact ? `Received ${shortMedicalDate(artifact.receivedAt || artifact.createdAt)}` : 'Not received'}</span>
              <div>
                {artifact && <button type="button" onClick={() => openArtifact(artifact)}>Open file</button>}
                {review && <button type="button" onClick={() => openReview(review)}>Review detail</button>}
                {artifact && !review && <button type="button" onClick={() => createReview(artifact)}>Create MRR</button>}
                {clientId && retreatId && <button className="is-primary" type="button" onClick={() => requestEntryUpload(documentType === 'Liver' ? 'Liver' : 'EKG')}>{artifact ? 'Upload another' : `Upload ${documentType === 'Liver' ? 'liver panel' : 'EKG'}`}</button>}
              </div>
            </div>
          </article>;
        })}
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
        <span>{artifacts.length} records · {noDecisionCount} without a decision</span>
      </div>
      <div className="booking-medical-stage-list">
        {medicalStageOrder.map(stage => {
          const records = stages[stage || 'other'] || [];
          return <details className="booking-medical-stage" key={stage} open={stage === 'entry'}>
            <summary>
              <span className="booking-medical-stage-name"><b>{records.length}</b>{medicalStageLabels[stage]}{records.length > 0 && records.filter(record => !latestArtifactReview(record, reviews)).length > 0 && <em>{records.filter(record => !latestArtifactReview(record, reviews)).length} need a decision</em>}</span>
              <span className="booking-medical-stage-actions"><span>{stage === 'entry' ? 'Hide records' : records.length ? 'Show records' : 'No records yet'}</span>{clientId && retreatId && <button type="button" onClick={event => requestUpload(stage || 'other', event)}>Upload</button>}</span>
            </summary>
            {records.length ? <div className="booking-medical-record-list">{records.map(artifact => {
              const review = latestArtifactReview(artifact, reviews);
              return <article className="booking-medical-record" key={artifact._id || `${artifact.documentType}-${artifact.receivedAt}`}>
                <div className="booking-medical-record-identity">
                  <span className="booking-medical-record-icon" aria-hidden="true">{String(artifact.documentType || '').toLowerCase().includes('ekg') ? '♡' : '▤'}</span>
                  <div><strong>#{artifact.display_id || artifact._id || 'New'} {artifactTitle(artifact)}</strong><span>{artifact.documentType || 'Medical'} · {shortMedicalDate(artifact.receivedAt || artifact.createdAt)} · {(artifact.files || []).length} file{(artifact.files || []).length === 1 ? '' : 's'}</span></div>
                </div>
                <span className={`booking-medical-decision ${reviewDecisionClass(review)}`}>{reviewDecisionText(review)}</span>
                {review ? <button className="booking-medical-review-reference" type="button" onClick={() => openReview(review)}>Review #{review.display_id || review._id}</button> : <span className="booking-medical-review-reference">No review linked</span>}
                <div className="booking-medical-record-actions">
                  <button type="button" onClick={() => openArtifact(artifact)}>Open</button>
                  {review ? <button type="button" onClick={() => openReview(review)}>View review</button> : <button className="is-primary" type="button" onClick={() => createReview(artifact)}>Create MRR</button>}
                </div>
              </article>;
            })}</div> : <div className="booking-medical-empty">No {medicalStageLabels[stage].toLowerCase()} records found.</div>}
          </details>;
        })}
      </div>
    </section>

    {clientId && retreatId ? <BookingMedicalUpload bookingId={bookingId} bookingNumber={bookingNumber} clientId={clientId} retreatId={retreatId} uploadRequest={uploadRequest} onUploadComplete={() => { onUploadComplete(); load(); }} /> : <section className="booking-medical-section"><p className="booking-medical-muted">Medical upload needs a linked client and retreat on this booking.</p></section>}
  </div>;
};

export default BookingMedicalOverviewPanel;
