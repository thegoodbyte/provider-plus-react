import { artifactHasContent, artifactMatches, buildBookingRequirementRows, documentMatches, mergeArtifacts, objectId, requirementDefinitions } from './bookingRequirementRows';

describe('booking requirement rows', () => {
  const ekg = requirementDefinitions.find(row => row.key === 'ekg')!;
  it('matches typed and legacy artifacts and documents', () => {
    expect(artifactMatches({ artifactType: 'ekg' } as any, ekg)).toBe(true);
    expect(artifactMatches({ documentType: 'EKG' } as any, ekg)).toBe(true);
    expect(artifactMatches({ title: 'Electrocardiogram result' } as any, ekg)).toBe(true);
    expect(documentMatches({ documentType: 'contract' } as any, requirementDefinitions[0])).toBe(true);
    expect(documentMatches({ title: 'Signed contract' } as any, requirementDefinitions[0])).toBe(true);
    expect(artifactMatches({ title: 'unrelated' } as any, ekg)).toBe(false);
    expect(documentMatches({ title: 'unrelated' } as any, requirementDefinitions[0])).toBe(false);
  });
  it('normalizes populated identifiers', () => {
    expect(objectId({ _id: 'mongo' })).toBe('mongo');
    expect(objectId({ id: 'plain' })).toBe('plain');
    expect(objectId('string')).toBe('string');
  });
  it('recognizes files, text, and legacy data as received content', () => {
    expect(artifactHasContent({ files: [{ s3Key: 'key' }] } as any)).toBe(true);
    expect(artifactHasContent({ textContent: 'answer' } as any)).toBe(true);
    expect(artifactHasContent({ data: { downloadUrl: 'url' } } as any)).toBe(true);
    expect(artifactHasContent({} as any)).toBe(false);
  });
  it('deduplicates artifacts', () => expect(mergeArtifacts([[{ _id: 'one' } as any], [{ _id: 'one' } as any]])).toHaveLength(1));
  it('deduplicates legacy artifacts without ids', () => expect(mergeArtifacts([[{ artifactType: 'ekg', title: 'same', createdAt: 'date' } as any], [{ artifactType: 'ekg', title: 'same', createdAt: 'date' } as any]])).toHaveLength(1));
  it('builds missing, uploaded, and reviewed rows from linked sources', () => {
    const rows = buildBookingRequirementRows(
      [{ _id: 'item', status: 'received', isBlocking: true, metadata: { readinessGroup: 'ekg', expectedArtifact: 'ekg', linkedMedicalArtifactId: 'artifact' } } as any],
      [], [{ _id: 'artifact', artifactType: 'ekg', files: [{ fileName: 'ekg.pdf' }] } as any], [], [],
      { artifact: [{ _id: 'review', status: 'approved', reviewedAt: '2026-02-01' } as any] },
    );
    expect(rows.find(row => row.key === 'ekg')).toMatchObject({ required: true, uploaded: true, reviewed: true, latestReview: { _id: 'review' } });
    expect(rows.find(row => row.key === 'contract')).toMatchObject({ uploaded: false, reviewed: false });
  });
  it('uses the newest valid document and review', () => {
    const rows = buildBookingRequirementRows([{ status: 'pending', isBlocking: true, metadata: { readinessGroup: 'contract' } } as any], [], [], [
      { _id: 'old', documentType: 'contract', receivedAt: '2026-01-01', files: [{}] },
      { _id: 'new', documentType: 'contract', receivedAt: '2026-02-01', files: [{}] },
    ] as any, [], {});
    expect(rows.find(row => row.key === 'contract')?.latestDocument?._id).toBe('new');
  });
  it('uses populated templates, linked library documents, flow completion, and item review states', () => {
    const rows = buildBookingRequirementRows([{
      _id: 'item', status: 'approved', isBlocking: false, templateId: { readinessGroup: 'medications', expectedArtifact: 'medications_form' },
      metadata: { linkedBookingDocumentId: 'linked-doc' },
    } as any], [], [], [], [{ _id: 'linked-doc', documentType: 'medications_form', files: [{ fileName: 'meds.pdf' }] } as any], {});
    expect(rows.find(row => row.key === 'medications')).toMatchObject({ required: false, uploaded: true, reviewed: true, latestDocument: { _id: 'linked-doc' } });
  });
  it('orders artifacts with files first and selects the newest review fallback timestamps', () => {
    const rows = buildBookingRequirementRows([{ status: 'pending', isBlocking: true, metadata: { readinessGroup: 'ekg' } } as any], [
      { _id: 'new-no-file', artifactType: 'ekg', receivedAt: '2026-03-01' },
      { _id: 'old-file', artifactType: 'ekg', receivedAt: '2026-01-01', files: [{ fileName: 'ekg.pdf' }] },
    ] as any, [], [], [], { 'old-file': [
      { _id: 'created', status: 'approved', createdAt: '2026-01-01' } as any,
      { _id: 'requested', status: 'caution', requestedAt: '2026-02-01' } as any,
    ] });
    expect(rows.find(row => row.key === 'ekg')).toMatchObject({ latestArtifact: { _id: 'old-file' }, latestReview: { _id: 'requested' } });
  });
});
