import { filterRetreatSubmissionRowsByMrr } from './MedicalArtifactsPage';

describe('filterRetreatSubmissionRowsByMrr', () => {
  const rows: any[] = [
    { id: 'received-without-review', artifactId: 'artifact-1' },
    { id: 'received-with-review', artifactId: 'artifact-2', reviewRequestId: 'mrr-1' },
    { id: 'missing-document' },
  ];

  it('returns received artifacts that have no MRR', () => {
    expect(filterRetreatSubmissionRowsByMrr(rows, 'without_mrr').map((row) => row.id)).toEqual(['received-without-review']);
  });

  it('keeps MRR rows separate from rows without an uploaded artifact', () => {
    expect(filterRetreatSubmissionRowsByMrr(rows, 'with_mrr').map((row) => row.id)).toEqual(['received-with-review']);
  });

  it('returns every row when no MRR filter is selected', () => {
    expect(filterRetreatSubmissionRowsByMrr(rows, 'all')).toEqual(rows);
  });
});
