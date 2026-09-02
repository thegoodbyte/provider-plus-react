import {
  getMedicalReviewStatusPresentation,
  compareMedicalReviewStatuses,
  isPendingMedicalReviewStatus,
  medicalReviewStatusPriority,
  normalizeMedicalReviewStatus,
} from './medicalReviewStatus';

describe('medical review status policy', () => {
  it('normalizes API status values before comparing them', () => {
    expect(normalizeMedicalReviewStatus(' Pending ')).toBe('pending');
    expect(isPendingMedicalReviewStatus('IN_REVIEW')).toBe(true);
    expect(isPendingMedicalReviewStatus('approved')).toBe(false);
  });

  it('orders actionable reviews before completed decisions', () => {
    const statuses = ['completed', 'approved', 'pending', 'caution', 'in_review'];
    expect(statuses.sort((a, b) => medicalReviewStatusPriority(a) - medicalReviewStatusPriority(b)))
      .toEqual(['pending', 'in_review', 'caution', 'approved', 'completed']);
  });

  it('provides a comparator that places pending reviews first', () => {
    const reviews = [{ status: 'approved' }, { status: 'in_review' }, { status: 'pending' }];
    expect(reviews.sort((a, b) => compareMedicalReviewStatuses(a.status, b.status)).map((item) => item.status))
      .toEqual(['pending', 'in_review', 'approved']);
  });

  it('keeps pending blue and caution amber', () => {
    expect(getMedicalReviewStatusPresentation('pending').badgeClass).toContain('blue');
    expect(getMedicalReviewStatusPresentation('caution').badgeClass).toContain('amber');
    expect(getMedicalReviewStatusPresentation('pending').badgeClass)
      .not.toBe(getMedicalReviewStatusPresentation('caution').badgeClass);
  });

  it('uses a safe neutral presentation for unknown values', () => {
    expect(getMedicalReviewStatusPresentation('unexpected')).toMatchObject({
      badgeClass: 'bg-gray-100 text-gray-700',
      rowClass: 'bg-white',
      icon: 'clock',
    });
  });
});
