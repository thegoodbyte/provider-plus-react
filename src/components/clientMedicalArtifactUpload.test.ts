import { buildClientMedicalArtifactInput, getClientMedicalArtifactUploadContext } from './clientMedicalArtifactUpload';

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
      source: 'client_upload',
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
});
