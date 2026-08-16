import { BookingDocument, BookingFlowItem, MedicalArtifact, MedicalReviewRequest } from '../types';
import { hasReceivedEvidence, isReviewedStatus, isSatisfiedStatus } from './bookingStatusSelectors';

export type RequirementDefinition = {
  key: string; label: string; artifactTypes: NonNullable<MedicalArtifact['artifactType']>[];
  documentTypes?: MedicalArtifact['documentType'][]; bookingDocumentTypes?: string[];
  readinessGroups: string[]; library: 'medical_artifacts' | 'booking_documents' | 'both'; matchTerms?: string[];
  linkable?: boolean;
};

export const requirementDefinitions: RequirementDefinition[] = [
  { key: 'contract', label: 'Contract', artifactTypes: ['contract'], bookingDocumentTypes: ['contract'], readinessGroups: ['contract'], library: 'booking_documents', matchTerms: ['contract'] },
  { key: 'ekg', label: 'Entry EKG', artifactTypes: ['ekg'], documentTypes: ['EKG'], readinessGroups: ['ekg'], library: 'medical_artifacts', matchTerms: ['ekg', 'ecg', 'electrocardiogram'] },
  { key: 'liver', label: 'Entry Liver Panel', artifactTypes: ['liver_panel'], documentTypes: ['Liver'], bookingDocumentTypes: ['liver_panel'], readinessGroups: ['liver'], library: 'medical_artifacts', matchTerms: ['liver', 'hepatic panel', 'liver panel'] },
  { key: 'medications', label: 'Medications Form', artifactTypes: ['medications_form', 'medication_list'], documentTypes: ['Medications', 'meds'], bookingDocumentTypes: ['medications_form'], readinessGroups: ['medications'], library: 'both', matchTerms: ['medication', 'medications', 'meds'] },
  { key: 'questionnaire', label: 'Questionnaire', artifactTypes: ['questionnaire'], bookingDocumentTypes: ['questionnaire'], readinessGroups: ['questionnaire'], library: 'both', matchTerms: ['questionnaire', 'health questionnaire'] },
  { key: 'food', label: 'Food Form', artifactTypes: ['food_intake'], bookingDocumentTypes: ['food_intake'], readinessGroups: ['food'], library: 'both', matchTerms: ['food intake', 'food form', 'dietary'] },
];

const canonicalRequirementKeys = new Set([
  'contract_signed',
  'contract_received',
  'client_agreement_received',
  'entry_ekg_received',
  'entry_liver_panel_received',
  'medications_form_initial_received',
  'questionnaire_received',
  'food_form_received',
  'blood_pressure_received',
]);
export const objectId = (value: any) => typeof value === 'object' ? value?._id || value?.id : value;
const normalize = (value?: string) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const time = (value?: Date | string) => new Date(value || 0).getTime();
export const mergeArtifacts = (groups: MedicalArtifact[][]) => {
  const seen = new Set<string>();
  return groups.flat().filter((artifact) => { const key = artifact._id || `${artifact.artifactType}:${artifact.title}:${artifact.createdAt}`; if (seen.has(key)) return false; seen.add(key); return true; });
};
export const artifactMatches = (artifact: MedicalArtifact, definition: RequirementDefinition) => {
  if (artifact.artifactType && definition.artifactTypes.includes(artifact.artifactType)) return true;
  if (definition.documentTypes?.includes(artifact.documentType)) return true;
  const data = artifact.data || {};
  const searchable = [artifact.title, artifact.description, artifact.source, artifact.documentType, artifact.artifactType, data.artifactType, data.documentType, data.title, data.fileName, data.originalName, ...(artifact.files || []).flatMap(file => [file.fileName, file.filePath, file.s3Key]), ...(artifact.tags || [])].filter(Boolean).join(' ').toLowerCase();
  return Boolean(definition.matchTerms?.some(term => searchable.includes(term.toLowerCase())));
};
export const artifactHasContent = (artifact: MedicalArtifact) => Boolean(
  (artifact.files || []).some(file => file.fileName || file.filePath || file.s3Key || file.url)
  || String(artifact.textContent || '').trim()
  || ['fileName', 'filePath', 's3Key', 'url', 'fileUrl', 'downloadUrl'].some(key => artifact.data?.[key]),
);
export const documentMatches = (document: BookingDocument, definition: RequirementDefinition) => Boolean(
  definition.bookingDocumentTypes?.includes(normalize(document.documentType))
  || definition.matchTerms?.some(term => [document.title, document.description, document.documentType].filter(Boolean).join(' ').toLowerCase().includes(term.toLowerCase())),
);
const reviewTime = (review: MedicalReviewRequest) => time(review.reviewedAt || review.requestedAt || review.createdAt);

const definitionForItem = (item: BookingFlowItem): RequirementDefinition => {
  const template = typeof item.templateId === 'object' ? item.templateId : undefined;
  const requirementType = normalize(item.metadata?.requirementType || template?.requirementType);
  const readinessGroup = item.metadata?.readinessGroup || template?.readinessGroup || '';
  const expectedArtifact = item.metadata?.expectedArtifact || template?.expectedArtifact || '';
  const expectedDocumentType = item.metadata?.expectedDocumentType || template?.expectedDocumentType || '';
  const canonicalKeyByStepKey: Record<string, string> = {
    contract_signed: 'contract', contract_received: 'contract', client_agreement_received: 'contract',
    entry_ekg_received: 'ekg', entry_liver_panel_received: 'liver',
    medications_form_initial_received: 'medications', questionnaire_received: 'questionnaire',
    food_form_received: 'food',
  };
  const canonicalKey = canonicalKeyByStepKey[normalize(item.key)];
  const canonical = requirementDefinitions.find((definition) => definition.key === canonicalKey) || requirementDefinitions.find((definition) =>
    definition.readinessGroups.includes(readinessGroup)
    || definition.artifactTypes.includes(expectedArtifact as any)
    || definition.bookingDocumentTypes?.includes(normalize(expectedDocumentType)),
  );
  return {
    key: canonical?.key || requirementType || item.key || item._id || '',
    label: canonical?.label || item.title || template?.title || item.key,
    artifactTypes: canonical?.artifactTypes || (expectedArtifact ? [expectedArtifact as NonNullable<MedicalArtifact['artifactType']>] : []),
    documentTypes: canonical?.documentTypes || (expectedDocumentType ? [expectedDocumentType as NonNullable<MedicalArtifact['documentType']>] : []),
    bookingDocumentTypes: canonical?.bookingDocumentTypes || (expectedDocumentType ? [normalize(expectedDocumentType)] : []),
    readinessGroups: readinessGroup ? [readinessGroup] : [],
    library: canonical?.library || (expectedArtifact && expectedDocumentType ? 'both' : expectedArtifact ? 'medical_artifacts' : 'booking_documents'),
    matchTerms: canonical?.matchTerms || [item.title, template?.title, expectedArtifact, expectedDocumentType].filter(Boolean) as string[],
    linkable: Boolean(canonical || expectedArtifact || expectedDocumentType),
  };
};

export const isVisibleBookingRequirement = (item: BookingFlowItem) => {
  const template = typeof item.templateId === 'object' ? item.templateId : undefined;
  return item.metadata?.isRequirement === true
    || template?.isRequirement === true
    || Boolean(item.metadata?.requirementType || template?.requirementType)
    || canonicalRequirementKeys.has(normalize(item.key));
};

export const buildBookingRequirementRows = (items: BookingFlowItem[], artifacts: MedicalArtifact[], libraryArtifacts: MedicalArtifact[], documents: BookingDocument[], libraryDocuments: BookingDocument[], reviewsByArtifact: Record<string, MedicalReviewRequest[]>) =>
  (items.length ? items
    .filter(isVisibleBookingRequirement)
    .slice()
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0))
    .reduce<Array<{ definition: RequirementDefinition; relatedItems: BookingFlowItem[] }>>((groups, item) => {
      const definition = definitionForItem(item);
      const existing = groups.find((group) => group.definition.key === definition.key);
      if (existing) existing.relatedItems.push(item);
      else groups.push({ definition, relatedItems: [item] });
      return groups;
    }, [])
    : requirementDefinitions.map((definition) => ({ definition, relatedItems: [] as BookingFlowItem[] })))
  .map(({ definition, relatedItems }) => {
    const linkedArtifacts = new Set(relatedItems.flatMap(item => [item.metadata?.linkedMedicalArtifactId, ...(item.metadata?.linkedMedicalArtifactIds || [])]).filter(Boolean).map(String));
    const linkedDocuments = new Set(relatedItems.map(item => item.metadata?.linkedBookingDocumentId).filter(Boolean).map(String));
    const relatedArtifacts = mergeArtifacts([artifacts, libraryArtifacts.filter(artifact => artifact._id && linkedArtifacts.has(artifact._id))]).filter(artifact => artifactMatches(artifact, definition)).sort((a, b) => Number((b.files || []).length > 0) - Number((a.files || []).length > 0) || time(b.receivedAt || b.createdAt) - time(a.receivedAt || a.createdAt));
    const relatedDocuments = [...documents, ...libraryDocuments.filter(document => document._id && linkedDocuments.has(document._id))].filter((document, index, list) => document._id && list.findIndex(candidate => candidate._id === document._id) === index).filter(document => documentMatches(document, definition) && (document.files || []).length > 0).sort((a, b) => time(b.receivedAt || b.createdAt) - time(a.receivedAt || a.createdAt));
    const latestArtifact = relatedArtifacts[0]; const latestDocument = relatedDocuments[0];
    const latestReview = latestArtifact?._id ? [...(reviewsByArtifact[latestArtifact._id] || [])].sort((a, b) => reviewTime(b) - reviewTime(a))[0] : undefined;
    const uploaded = relatedArtifacts.some(artifactHasContent) || relatedDocuments.length > 0 || relatedItems.some(item => hasReceivedEvidence(item.status));
    const satisfied = uploaded || relatedItems.some(item => isSatisfiedStatus(item.status));
    return { ...definition, required: relatedItems.length === 0 || relatedItems.some(item => item.isBlocking), uploaded, satisfied, reviewed: Boolean(latestReview && isReviewedStatus(latestReview.status as any)) || relatedItems.some(item => isReviewedStatus(item.status)), latestArtifact, latestDocument, latestReview, relatedItems };
  });
