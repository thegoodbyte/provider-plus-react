import { buildBookingStepCellModel } from './bookingStepCellModel';

const booking: any = { _id: 'booking-1', bookingNumber: 1240, clientId: { _id: 'client-1' }, retreatId: 'retreat-1' };
const row: any = { key: 'ekg_sent_for_review', title: 'EKG sent for review' };
const item: any = { _id: 'step-1', key: row.key, title: row.title, status: 'in_review', metadata: { medicalReviewRequestId: 'request-1', medicalReviewRequestDisplayId: 88 } };
const base = (overrides: any = {}) => ({ booking, item, row, itemMap: new Map(), datePickerDrafts: {}, paymentsByClientId: new Map(), reviewRequests: [], reviewRequestsByArtifactId: new Map(), reviewRequestsByBookingContext: new Map(), bookingDocumentMap: new Map(), medicalArtifacts: [], medicalArtifactById: new Map(), medicalArtifactsByBookingContext: new Map(), ...overrides });

describe('buildBookingStepCellModel', () => {
  it('resolves draft dates and client payments', () => {
    const payment: any = { _id: 'payment-1' };
    const result = buildBookingStepCellModel(base({ item: { ...item, key: 'payment_received', status: 'received', receivedAt: '2026-08-01', metadata: { paymentId: 'payment-1' } }, row: { key: 'payment_received', title: 'Payment' }, datePickerDrafts: { 'step-1': '2026-08-02' }, paymentsByClientId: new Map([['client-1', [payment]]]) }));
    expect(result.isPaymentReceivedStep).toBe(true); expect(result.confirmedDateInputValue).toBe('2026-08-01'); expect(result.pendingDateInputValue).toBe('2026-08-02'); expect(result.hasPendingDateInput).toBe(true); expect(result.bookingPayments).toEqual([payment]); expect(result.selectedPaymentId).toBe('payment-1');
  });

  it('deduplicates related reviews and resolves their final decision', () => {
    const received: any = { _id: 'received', key: 'ekg_received', metadata: { latestArtifactId: 'artifact-1' } };
    const pending: any = { _id: 'request-1', bookingFlowItemId: 'step-1', requestType: 'ekg_review', status: 'pending' };
    const final: any = { _id: 'request-2', requestType: 'ekg_review', status: 'approved', overallNotes: 'Safe', reviewedAt: '2026-08-02' };
    const result = buildBookingStepCellModel(base({ itemMap: new Map([['booking-1:ekg_received', received]]), reviewRequests: [pending], reviewRequestsByArtifactId: new Map([['artifact-1', [pending, final]]]) }));
    expect(result.relatedReviewRequests).toEqual([pending, final]); expect(result.resolvedReviewDecision).toBe('OK'); expect(result.resolvedReviewNotes).toBe('Safe'); expect(result.resolvedReviewReviewedAt).toBe('2026-08-02'); expect(result.existingReviewRequestId).toBe('request-1'); expect(result.existingReviewRequestDisplay).toBe(88);
  });

  it('prefers explicit item review values', () => {
    const result = buildBookingStepCellModel(base({ item: { ...item, reviewDecision: 'caution', reviewNotes: 'Check again', reviewedAt: '2026-08-03' } }));
    expect(result.resolvedReviewDecision).toBe('caution'); expect(result.resolvedReviewNotes).toBe('Check again'); expect(result.resolvedReviewReviewedAt).toBe('2026-08-03');
  });

  it('resolves linked artifacts, documents and link candidates', () => {
    const received: any = { _id: 'received', key: 'ekg_received', metadata: { latestArtifactId: 'artifact-1' } };
    const artifact: any = { _id: 'artifact-1', bookingId: 'booking-1', clientId: 'client-1', retreatId: 'retreat-1', artifactType: 'ekg', documentStage: 'entry', documentType: 'EKG', title: 'EKG' };
    const document: any = { _id: 'document-1' };
    const result = buildBookingStepCellModel(base({ itemMap: new Map([['booking-1:ekg_received', received]]), medicalArtifacts: [artifact], medicalArtifactById: new Map([['artifact-1', artifact]]), bookingDocumentMap: new Map([['booking-1:ekg_sent_for_review', [document]]]) }));
    expect(result.relatedMedicalArtifact).toBe(artifact); expect(result.relatedMedicalArtifactId).toBe('artifact-1'); expect(result.linkableArtifacts).toEqual([artifact]); expect(result.relatedBookingDocument).toBe(document); expect(result.artifactStepConfig?.artifactType).toBe('ekg');
  });

  it('finds contextual artifacts and suppresses questionnaire document uploads', () => {
    const artifact: any = { _id: 'artifact-2' };
    const context = 'booking-1:entry:EKG:ekg';
    const result = buildBookingStepCellModel(base({ item: undefined, row: { key: 'ekg_received', title: 'EKG received' }, medicalArtifactsByBookingContext: new Map([[context, [artifact]]]) }));
    expect(result.relatedMedicalArtifact).toBe(artifact); expect(result.relatedMedicalArtifactId).toBe('artifact-2');
    const questionnaire = buildBookingStepCellModel(base({ item: { ...item, key: 'questionnaire_sent' }, row: { key: 'questionnaire_sent', title: 'Questionnaire' } }));
    expect(questionnaire.configuredBookingDocumentType).toBe('');
  });

  it('returns safe defaults for a missing item', () => {
    const result = buildBookingStepCellModel(base({ item: undefined, row: { key: 'unknown', title: 'Unknown' } }));
    expect(result.confirmedDateInputValue).toBe(''); expect(result.hasPendingDateInput).toBe(false); expect(result.bookingPayments).toEqual([]); expect(result.reviewStepConfig).toBeUndefined(); expect(result.relatedReviewRequests).toEqual([]); expect(result.relatedMedicalArtifactId).toBe('');
  });
});
