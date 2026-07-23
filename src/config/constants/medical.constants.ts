/**
 * Medical Module Configuration Constants
 * Centralized configuration for all medical-related constants
 */

// Document Stages Configuration
export const DOCUMENT_STAGES = {
  ENTRY: 'entry',
  PRE_CEREMONY: 'pre_ceremony',
  IN_CEREMONY: 'in_ceremony',
  POST_CEREMONY: 'post_ceremony',
  OTHER: 'other',
  ADDITIONAL: 'additional'
} as const;

export type DocumentStage = typeof DOCUMENT_STAGES[keyof typeof DOCUMENT_STAGES];

// Document Types Configuration
export const DOCUMENT_TYPES = {
  EKG: 'EKG',
  BP: 'BP',
  LIVER: 'Liver',
  MEDICATIONS: 'Medications',
  MEDS: 'meds',
  ADDITIONAL: 'additional',
  OTHER: 'other'
} as const;

export type DocumentType = typeof DOCUMENT_TYPES[keyof typeof DOCUMENT_TYPES];

// Medical Status Configuration
export const MEDICAL_STATUSES = {
  PENDING: 'pending',
  RECEIVED: 'received',
  REVIEWED: 'reviewed',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SENT_TO_COOK: 'sent_to_cook'
} as const;

export type MedicalStatus = typeof MEDICAL_STATUSES[keyof typeof MEDICAL_STATUSES];

// Medical Review Decisions
export const MEDICAL_REVIEW_DECISIONS = {
  OK: 'OK',
  CAUTION: 'caution',
  NOT_OK: 'NOT OK'
} as const;

export type MedicalReviewDecision = typeof MEDICAL_REVIEW_DECISIONS[keyof typeof MEDICAL_REVIEW_DECISIONS];

// Medical Review Request Types
export const MEDICAL_REQUEST_TYPES = {
  EKG_REVIEW: 'ekg_review',
  LIVER_PANEL_REVIEW: 'liver_panel_review',
  BLOOD_PRESSURE_REVIEW: 'blood_pressure_review',
  CEREMONY_EKG_REVIEW: 'ceremony_ekg_review',
  MEDICATIONS_REVIEW: 'medications_review',
  FOOD_INTAKE_REVIEW: 'food_intake_review',
  FINAL_CLEARANCE: 'final_clearance',
  EMERGENCY_REVIEW: 'emergency_review',
  OTHER: 'other'
} as const;

export type MedicalRequestType = typeof MEDICAL_REQUEST_TYPES[keyof typeof MEDICAL_REQUEST_TYPES];

// Artifact Types Configuration
export const ARTIFACT_TYPES = {
  EKG: 'ekg',
  LIVER_PANEL: 'liver_panel',
  CEREMONY_EKG: 'ceremony_ekg',
  BLOOD_PRESSURE: 'blood_pressure',
  MEDICATIONS_FORM: 'medications_form',
  MEDICATION_LIST: 'medication_list',
  QUESTIONNAIRE: 'questionnaire',
  CONTRACT: 'contract',
  FOOD_INTAKE: 'food_intake',
  OTHER: 'other'
} as const;

export type ArtifactType = typeof ARTIFACT_TYPES[keyof typeof ARTIFACT_TYPES];

// Helper functions for medical configurations
export const getMedicalStatusColor = (status: MedicalStatus): string => {
  const colorMap: Record<MedicalStatus, string> = {
    [MEDICAL_STATUSES.APPROVED]: '#28a745',
    [MEDICAL_STATUSES.RECEIVED]: '#374151',
    [MEDICAL_STATUSES.REVIEWED]: '#6f42c1',
    [MEDICAL_STATUSES.PENDING]: '#ffc107',
    [MEDICAL_STATUSES.REJECTED]: '#dc3545',
    [MEDICAL_STATUSES.SENT_TO_COOK]: '#20c997'
  };
  return colorMap[status] || '#6c757d';
};

export const getMedicalStatusIcon = (status: MedicalStatus): string => {
  const iconMap: Record<MedicalStatus, string> = {
    [MEDICAL_STATUSES.APPROVED]: '✅',
    [MEDICAL_STATUSES.RECEIVED]: '📥',
    [MEDICAL_STATUSES.REVIEWED]: '👁️',
    [MEDICAL_STATUSES.PENDING]: '⏳',
    [MEDICAL_STATUSES.REJECTED]: '❌',
    [MEDICAL_STATUSES.SENT_TO_COOK]: '👨‍🍳'
  };
  return iconMap[status] || '❓';
};

export const getReviewDecisionColor = (decision: MedicalReviewDecision): string => {
  const colorMap: Record<MedicalReviewDecision, string> = {
    [MEDICAL_REVIEW_DECISIONS.OK]: 'bg-green-100 text-green-800',
    [MEDICAL_REVIEW_DECISIONS.CAUTION]: 'bg-yellow-100 text-yellow-800',
    [MEDICAL_REVIEW_DECISIONS.NOT_OK]: 'bg-red-100 text-red-800'
  };
  return colorMap[decision] || 'bg-gray-100 text-gray-800';
};

// Lists for dropdowns and selectors
export const DOCUMENT_STAGE_OPTIONS = Object.entries(DOCUMENT_STAGES).map(([key, value]) => ({
  value,
  label: key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
}));

export const DOCUMENT_TYPE_OPTIONS = Object.entries(DOCUMENT_TYPES).map(([key, value]) => ({
  value,
  label: key.replace(/_/g, ' ')
}));

export const MEDICAL_STATUS_OPTIONS = Object.entries(MEDICAL_STATUSES).map(([key, value]) => ({
  value,
  label: key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
}));

export const MEDICAL_REVIEW_DECISION_OPTIONS = Object.entries(MEDICAL_REVIEW_DECISIONS).map(([key, value]) => ({
  value,
  label: value
}));

// Validation helpers
export const isValidDocumentStage = (stage: string): stage is DocumentStage => {
  return Object.values(DOCUMENT_STAGES).includes(stage as DocumentStage);
};

export const isValidDocumentType = (type: string): type is DocumentType => {
  return Object.values(DOCUMENT_TYPES).includes(type as DocumentType);
};

export const isValidMedicalStatus = (status: string): status is MedicalStatus => {
  return Object.values(MEDICAL_STATUSES).includes(status as MedicalStatus);
};

// Default values
export const DEFAULT_MEDICAL_CONFIG = {
  documentStage: DOCUMENT_STAGES.ENTRY,
  documentType: DOCUMENT_TYPES.OTHER,
  status: MEDICAL_STATUSES.PENDING,
  reviewDecision: null
} as const;