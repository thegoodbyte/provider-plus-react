import { buildClientMedicalArtifactInput, getClientEntryMedicalArtifacts, getClientMedicalArtifactUploadContext, upsertMedicalArtifact } from './clientMedicalArtifactUpload';

describe('clientMedicalArtifactUpload helpers', () => {
  it('builds a client-only entry artifact without requiring retreat context', () => {
    const payload = buildClientMedicalArtifactInput({
      clientId: 'client-1',
      title: 'Entry EKG',
      artifactType: 'ekg',
      documentType: 'EKG',
      context: {},
    });

    expect(payload).toMatchObject({
      clientId: 'client-1',
      title: 'Entry EKG',
      artifactType: 'ekg',
      documentType: 'EKG',
      documentStage: 'entry',
      contextType: 'client',
      purpose: 'general',
      status: 'pending_review',
      source: 'admin_upload',
    });
    expect(payload.bookingId).toBeUndefined();
    expect(payload.retreatId).toBeUndefined();
    expect(payload.receivedAt).toEqual(expect.any(String));
  });

  it('prefers booking context when one exists', () => {
    const context = getClientMedicalArtifactUploadContext([
      {
        _id: 'booking-1',
        retreatId: 'retreat-1',
      },
    ]);

    const payload = buildClientMedicalArtifactInput({
      clientId: 'client-1',
      title: 'Entry Liver Panel',
      artifactType: 'liver_panel',
      documentType: 'Liver',
      context,
    });

    expect(context).toEqual({
      bookingId: 'booking-1',
      retreatId: 'retreat-1',
    });
    expect(payload).toMatchObject({
      contextType: 'booking',
      purpose: 'booking_requirement',
      bookingId: 'booking-1',
      retreatId: 'retreat-1',
    });
  });

  it('finds entry EKGs with populated client ids and sorts by received date', () => {
    const artifacts = getClientEntryMedicalArtifacts([
      { _id: 'old', clientId: { _id: 'client-1' } as any, artifactType: 'ekg', documentType: 'EKG', documentStage: 'entry', receivedAt: '2026-07-01' } as any,
      { _id: 'new', clientId: 'client-1', artifactType: 'ekg', documentType: 'EKG', documentStage: 'entry', receivedAt: '2026-08-01' } as any,
      { _id: 'other-client', clientId: 'client-2', artifactType: 'ekg', documentType: 'EKG', documentStage: 'entry', receivedAt: '2026-08-02' } as any,
      { _id: 'voided', clientId: 'client-1', artifactType: 'ekg', documentType: 'EKG', documentStage: 'entry', status: 'voided', receivedAt: '2026-08-03' } as any,
      { _id: 'ceremony', clientId: 'client-1', artifactType: 'ceremony_ekg', documentType: 'EKG', documentStage: 'in_ceremony', receivedAt: '2026-08-04' } as any,
    ], 'client-1', 'ekg', 'EKG');

    expect(artifacts.map((artifact) => artifact._id)).toEqual(['new', 'old']);
  });

  it('replaces the optimistic artifact with the persisted upload response without duplicates', () => {
    const result = upsertMedicalArtifact([
      { _id: 'artifact-1', title: 'Entry EKG', files: [] } as any,
      { _id: 'artifact-2', title: 'Entry liver' } as any,
    ], {
      _id: 'artifact-1',
      title: 'Entry EKG',
      files: [{ fileName: 'ekg.pdf' }],
    } as any);

    expect(result).toHaveLength(2);
    expect(result[0].files?.[0]?.fileName).toBe('ekg.pdf');
  });
});
