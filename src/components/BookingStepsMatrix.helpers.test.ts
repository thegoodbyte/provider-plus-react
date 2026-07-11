import { hasBookingActionLog, resolveBookingStepUploadTarget, reviewRequestStatusToBookingStepStatus, shouldShowArtifactUploadFallback } from './BookingStepsMatrix.helpers';

describe('BookingStepsMatrix helpers', () => {
  it('shows the artifact upload fallback only when editing and no upload action exists', () => {
    const artifactStepConfig = { documentStage: 'entry', documentType: 'ekg', artifactType: 'ekg', label: 'Entry EKG' } as const;

    expect(shouldShowArtifactUploadFallback(artifactStepConfig, true, false)).toBe(true);
    expect(shouldShowArtifactUploadFallback(artifactStepConfig, false, false)).toBe(false);
    expect(shouldShowArtifactUploadFallback(artifactStepConfig, true, true)).toBe(false);
    expect(shouldShowArtifactUploadFallback(undefined, true, false)).toBe(false);
  });

  it('prefers the medical artifact upload target when both artifact and document configs exist', () => {
    const artifactStepConfig = { documentStage: 'entry', documentType: 'Liver', artifactType: 'liver_panel', label: 'Entry Liver Panel' } as const;
    const documentConfig = { documentType: 'liver_panel', title: 'Entry Liver Panel' } as const;

    expect(resolveBookingStepUploadTarget(artifactStepConfig, documentConfig)).toBe('medical_artifact');
    expect(resolveBookingStepUploadTarget(undefined, documentConfig)).toBe('booking_document');
    expect(resolveBookingStepUploadTarget(undefined, undefined)).toBeNull();
  });

  it('maps reviewed MRR statuses to completed booking steps', () => {
    expect(reviewRequestStatusToBookingStepStatus('approved')).toBe('completed');
    expect(reviewRequestStatusToBookingStepStatus('rejected')).toBe('completed');
    expect(reviewRequestStatusToBookingStepStatus('caution')).toBe('completed');
    expect(reviewRequestStatusToBookingStepStatus('in_review')).toBe('in_review');
    expect(reviewRequestStatusToBookingStepStatus('pending')).toBe('sent_for_review');
  });

  it('detects whether a booking action log exists for a selected action key', () => {
    const logs = [
      { actionKey: 'send_confirmation' },
      { actionKey: null },
      { actionKey: 'link_existing_mrr' },
    ];

    expect(hasBookingActionLog(logs, 'send_confirmation')).toBe(true);
    expect(hasBookingActionLog(logs, 'link_existing_mrr')).toBe(true);
    expect(hasBookingActionLog(logs, 'missing_action')).toBe(false);
    expect(hasBookingActionLog([], 'send_confirmation')).toBe(false);
    expect(hasBookingActionLog(undefined, 'send_confirmation')).toBe(false);
  });
});
