import { MedicalArtifact } from '../types';

export type EntryMedicalType = 'ekg' | 'liver_panel';

const normalized = (value: unknown) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');

export const entryMedicalType = (artifact: MedicalArtifact): EntryMedicalType | undefined => {
  const values = [artifact.artifactType, artifact.documentType, artifact.data?.artifactType, artifact.data?.documentType, artifact.title]
    .map(normalized);
  if (values.some(value => value === 'ekg' || value === 'ecg' || value.includes('electrocardiogram'))) return 'ekg';
  if (values.some(value => value === 'liver' || value === 'liver_panel' || value.includes('liver_panel'))) return 'liver_panel';
  return undefined;
};

export const isEntryMedicalArtifact = (artifact: MedicalArtifact, type?: EntryMedicalType) => {
  const stage = normalized(artifact.documentStage || artifact.data?.documentStage || 'entry');
  const resolvedType = entryMedicalType(artifact);
  return stage === 'entry' && Boolean(resolvedType) && (!type || resolvedType === type);
};

export const mergeMedicalArtifacts = (...groups: MedicalArtifact[][]) => {
  const seen = new Set<string>();
  return groups.flat().filter(artifact => {
    const key = artifact._id || `${entryMedicalType(artifact)}:${artifact.title}:${artifact.createdAt}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
