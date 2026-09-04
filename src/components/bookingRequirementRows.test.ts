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
      [{ _id: 'item', title: 'Entry EKG', status: 'received', isBlocking: true, metadata: { isRequirement: true, readinessGroup: 'ekg', expectedArtifact: 'ekg', linkedMedicalArtifactId: 'artifact' } } as any],
      [], [{ _id: 'artifact', artifactType: 'ekg', files: [{ fileName: 'ekg.pdf' }] } as any], [], [],
      { artifact: [{ _id: 'review', status: 'approved', reviewedAt: '2026-02-01' } as any] },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ key: 'ekg', label: 'Entry EKG', required: true, uploaded: true, reviewed: true, latestReview: { _id: 'review' } });
  });
  it('uses the newest valid document and review', () => {
    const rows = buildBookingRequirementRows([{ _id: 'contract-item', title: 'Contract signed', status: 'pending', isBlocking: true, metadata: { isRequirement: true, readinessGroup: 'contract' } } as any], [], [], [
      { _id: 'old', documentType: 'contract', receivedAt: '2026-01-01', files: [{}] },
      { _id: 'new', documentType: 'contract', receivedAt: '2026-02-01', files: [{}] },
    ] as any, [], {});
    expect(rows[0].latestDocument?._id).toBe('new');
  });
  it('shows a legacy signed-contract step without copied requirement metadata', () => {
    const rows = buildBookingRequirementRows(
      [{ _id: 'contract-item', key: 'contract_signed', title: 'Contract signed', status: 'received', isBlocking: true, metadata: {} } as any],
      [], [],
      [{ _id: 'signed-contract', bookingId: 'booking', documentType: 'contract', title: 'Signed Client Agreement', files: [{ fileName: 'signed.pdf' }] } as any],
      [], {},
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toBe('contract');
    expect(rows[0].uploaded).toBe(true);
    expect(rows[0].latestDocument?._id).toBe('signed-contract');
  });
  it.each(['contract_received', 'client_agreement_received'])('shows IR contracts for legacy %s steps', (key) => {
    const rows = buildBookingRequirementRows(
      [{ _id: 'contract-item', key, title: 'Contract received', status: 'pending', isBlocking: true, metadata: {} } as any],
      [], [], [{ _id: 'signed-contract', documentType: 'contract', files: [{ fileName: 'signed.pdf' }] } as any], [], {},
    );
    expect(rows[0]).toMatchObject({ key: 'contract', uploaded: true, latestDocument: { _id: 'signed-contract' } });
  });
  it('uses populated templates, linked library documents, flow completion, and item review states', () => {
    const rows = buildBookingRequirementRows([{
      _id: 'item', title: 'Medications', status: 'approved', isBlocking: false, templateId: { readinessGroup: 'medications', expectedArtifact: 'medications_form' },
      metadata: { isRequirement: true, linkedBookingDocumentId: 'linked-doc' },
    } as any], [], [], [], [{ _id: 'linked-doc', documentType: 'medications_form', files: [{ fileName: 'meds.pdf' }] } as any], {});
    expect(rows[0]).toMatchObject({ required: false, uploaded: true, reviewed: true, latestDocument: { _id: 'linked-doc' } });
  });
  it('does not claim a requested file was uploaded merely because its email was sent', () => {
    const rows = buildBookingRequirementRows([{ _id: 'ekg-item', key: 'entry_ekg_received', title: 'Entry EKG', status: 'sent', isBlocking: true } as any], [], [], [], [], {});
    expect(rows[0]).toMatchObject({ uploaded: false, satisfied: false });
  });
  it('treats waived requirements as satisfied without claiming there is a file', () => {
    const rows = buildBookingRequirementRows([{ _id: 'ekg-item', key: 'entry_ekg_received', title: 'Entry EKG', status: 'waived', isBlocking: true } as any], [], [], [], [], {});
    expect(rows[0]).toMatchObject({ uploaded: false, satisfied: true });
  });
  it('orders artifacts with files first and selects the newest review fallback timestamps', () => {
    const rows = buildBookingRequirementRows([{ _id: 'ekg-item', title: 'EKG', status: 'pending', isBlocking: true, metadata: { isRequirement: true, readinessGroup: 'ekg' } } as any], [
      { _id: 'new-no-file', artifactType: 'ekg', receivedAt: '2026-03-01' },
      { _id: 'old-file', artifactType: 'ekg', receivedAt: '2026-01-01', files: [{ fileName: 'ekg.pdf' }] },
    ] as any, [], [], [], { 'old-file': [
      { _id: 'created', status: 'approved', createdAt: '2026-01-01' } as any,
      { _id: 'requested', status: 'caution', requestedAt: '2026-02-01' } as any,
    ] });
    expect(rows[0]).toMatchObject({ latestArtifact: { _id: 'old-file' }, latestReview: { _id: 'requested' } });
  });
  it('shows only configured requirement steps and collapses shared requirement types', () => {
    const items = Array.from({ length: 22 }, (_, index) => ({
      _id: `item-${index + 1}`, key: `step-${index + 1}`, title: `Step ${index + 1}`,
      order: index + 1, status: 'pending', isBlocking: index < 6,
      metadata: index < 2 ? { isRequirement: true, readinessGroup: 'ekg', requirementType: 'entry_ekg' } : {},
    })) as any;
    const rows = buildBookingRequirementRows(items, [], [], [], [], {});
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ key: 'ekg', label: 'Entry EKG', relatedItems: [items[0], items[1]] });
  });

  it('does not show an explicitly non-client workflow step as a missing client requirement', () => {
    const rows = buildBookingRequirementRows([{
      _id: 'contract', key: 'contract_signed', title: 'Contract', status: 'received',
      metadata: { isRequirement: true, requiredFromClient: false, requirementType: 'contract_signed' },
    } as any], [], [], [], [], {});

    expect(rows).toHaveLength(0);
  });

  it('collapses a misspelled legacy food-received step onto the submitted Food Form document', () => {
    const rows = buildBookingRequirementRows([{
      _id: 'food-received', key: 'food_questionaire_received', title: 'Food Questionaire Received', status: 'pending',
      metadata: { isRequirement: true, requiredFromClient: true, requirementType: 'food_intake', readinessGroup: 'Dietery' },
    } as any], [], [], [{ _id: 'food-doc', documentType: 'food_intake', files: [{ fileName: 'food.pdf' }] } as any], [], {});
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ key: 'food', label: 'Food Form', uploaded: true, satisfied: true, latestDocument: { _id: 'food-doc' } });
  });
});
