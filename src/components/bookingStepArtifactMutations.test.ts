import { buildBookingStepArtifactLink, buildBookingStepArtifactUploadUpdate } from './bookingStepArtifactMutations';

describe('bookingStepArtifactMutations', () => {
  const now = new Date('2026-08-12T12:00:00.000Z');
  const context = { bookingId: 'b', clientId: 'c', retreatId: 'r', bookingNumber: '42', label: 'Entry EKG' };

  it('builds a linked artifact update preserving notes and unique artifact ids', () => {
    const item: any = { _id: 'i', title: 'EKG received', notes: 'Existing ', metadata: { linkedMedicalArtifactIds: ['old', 'linked'], retained: true } };
    const selected: any = { _id: 'selected', display_id: 4, artifactType: 'ekg', documentStage: 'entry', documentType: 'EKG', receivedAt: '2026-08-10' };
    const linked: any = { _id: 'linked', display_id: 5 };
    const result = buildBookingStepArtifactLink(item, selected, linked, context, now);
    expect(result.artifactId).toBe('linked');
    expect(result.update).toMatchObject({ status: 'received', receivedAt: '2026-08-10', notes: 'Existing\nLinked existing Entry EKG artifact #5.' });
    expect(result.update.metadata).toMatchObject({ retained: true, linkedMedicalArtifactIds: ['old', 'linked'], latestArtifactId: 'linked', linkedMedicalArtifactType: 'ekg' });
    expect(result.action.notes).toBe('Linked existing artifact #5 to EKG received for booking #42.');
  });

  it('uses selected artifact fallbacks and current date without existing notes', () => {
    const selected: any = { _id: 'selected', artifactType: 'ekg', documentStage: 'entry', documentType: 'EKG' };
    const result = buildBookingStepArtifactLink({ title: 'EKG' } as any, selected, {} as any, context, now);
    expect(result.update).toMatchObject({ receivedAt: now.toISOString(), notes: 'Linked existing Entry EKG artifact #selected.' });
    expect(result.action.metadata).toMatchObject({ artifactId: 'selected', bookingId: 'b', clientId: 'c', retreatId: 'r' });
  });

  it('builds artifact-upload receipt metadata', () => {
    const update = buildBookingStepArtifactUploadUpdate({ metadata: { retained: true } } as any, { _id: 'a', display_id: 9 } as any, 'ekg.pdf', { artifactType: 'ekg', documentStage: 'entry', documentType: 'EKG' }, now);
    expect(update).toMatchObject({ status: 'received', receivedAt: now.toISOString(), metadata: { retained: true, latestArtifactId: 'a', latestArtifactDisplayId: 9, latestFileName: 'ekg.pdf', linkedMedicalArtifactType: 'ekg', linkedMedicalArtifactAt: now.toISOString() } });
  });
});
