import { buildBookingStepReviewCreation, buildBookingStepReviewLink } from './bookingStepReviewMutations';

describe('bookingStepReviewMutations', () => {
  it('builds review creation update and audit metadata', () => {
    const item: any = { _id: 'item', metadata: { retained: true } };
    const review: any = { _id: 'review', display_id: 7, requestType: 'ekg_review' };
    const result = buildBookingStepReviewCreation(item, review, 'artifact', 'advisor', { email: 'doctor@test.com' } as any);
    expect(result.update.status).toBe('sent_for_review');
    expect(result.update.metadata).toMatchObject({ retained: true, medicalReviewRequestId: 'review', medicalReviewArtifactId: 'artifact', medicalReviewAssignedToEmail: 'doctor@test.com' });
    expect(result.action.notes).toBe('Created medical review request #7 for doctor@test.com.');
  });

  it('falls back to internal review id and generic advisor label', () => {
    const result = buildBookingStepReviewCreation({ _id: 'item' } as any, { _id: 'review' } as any, 'artifact', 'advisor');
    expect(result.action.notes).toBe('Created medical review request #review for selected medical advisor.');
  });

  it.each([
    ['pending', 'sent_for_review', true, false, false],
    ['in_review', 'in_review', true, true, false],
    ['approved', 'completed', false, true, true],
    ['needs_resubmission', 'needs_resubmission', false, true, false],
  ])('maps %s reviews to %s and appropriate timestamps', (reviewStatus, expected, sent, reviewed, completed) => {
    const now = new Date('2026-08-12T12:00:00.000Z');
    const item: any = { _id: 'item', sentAt: 'old-sent', reviewedAt: 'old-reviewed', completedAt: 'old-completed', approvedAt: 'old-approved', metadata: { medicalReviewAssignedToUserId: 'old-user', medicalReviewAssignedToEmail: 'old@email' } };
    const review: any = { _id: 'review', display_id: 8, requestType: 'ekg_review', status: reviewStatus };
    const result = buildBookingStepReviewLink(item, review, '42', undefined, now);
    expect(result.nextStatus).toBe(expected);
    expect(result.update.sentAt).toBe(sent ? now.toISOString() : 'old-sent');
    expect(result.update.reviewedAt).toBe(reviewed ? now.toISOString() : 'old-reviewed');
    expect(result.update.completedAt).toBe(completed ? now.toISOString() : 'old-completed');
    expect(result.update.metadata).toMatchObject({ medicalReviewAssignedToUserId: 'old-user', medicalReviewAssignedToEmail: 'old@email' });
    expect(result.action.notes).toBe('Linked existing medical review request #8 to booking #42.');
  });

  it('uses linked reviewer data and configured action labels', () => {
    const result = buildBookingStepReviewLink({ _id: 'item' } as any, { _id: 'review', status: 'approved', assignedToUserId: 'new-user', assignedToEmail: 'new@email' } as any, 'B', { key: 'link', label: 'Attach review' } as any, new Date('2026-08-12'));
    expect(result.update.metadata).toMatchObject({ medicalReviewAssignedToUserId: 'new-user', medicalReviewAssignedToEmail: 'new@email' });
    expect(result.action).toMatchObject({ actionKey: 'link', actionLabel: 'Attach review' });
    expect(result.action.notes).toContain('#review');
  });
});
