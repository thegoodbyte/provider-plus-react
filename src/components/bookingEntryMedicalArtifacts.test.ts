import { entryMedicalType, isEntryMedicalArtifact, mergeMedicalArtifacts } from './bookingEntryMedicalArtifacts';

describe('booking entry medical artifact matching', () => {
  it.each([
    [{ artifactType: 'ekg', documentStage: 'entry' }, 'ekg'],
    [{ documentType: 'EKG' }, 'ekg'],
    [{ documentType: 'ecg', documentStage: 'ENTRY' }, 'ekg'],
    [{ artifactType: 'liver_panel', documentStage: 'entry' }, 'liver_panel'],
    [{ documentType: 'Liver' }, 'liver_panel'],
  ])('normalizes entry EKG and liver variants', (artifact, expected) => {
    expect(entryMedicalType(artifact as any)).toBe(expected);
    expect(isEntryMedicalArtifact(artifact as any, expected as any)).toBe(true);
  });

  it('rejects non-entry records and merges duplicate endpoint results', () => {
    expect(isEntryMedicalArtifact({ artifactType: 'ekg', documentStage: 'pre_ceremony' } as any)).toBe(false);
    expect(mergeMedicalArtifacts([{ _id: 'a', documentType: 'EKG' } as any], [{ _id: 'a', artifactType: 'ekg' } as any])).toHaveLength(1);
  });
});
