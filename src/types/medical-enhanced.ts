// Enhanced Medical Record Types with proper categorization

// Event types (WHEN the test was taken - timing of the medical event)
export enum MedicalEventType {
  ENTRY = 'entry',                    // Initial qualification documents
  PRE_CEREMONY = 'pre_ceremony',      // Right before ceremony
  IN_CEREMONY = 'in_ceremony',        // During ceremony
  POST_CEREMONY = 'post_ceremony',    // After ceremony
  ADDITIONAL = 'additional'           // Any other time/supplemental
}

// Medical types (WHAT test was performed)
export enum MedicalType {
  EKG = 'ekg',
  BLOOD_PRESSURE = 'blood_pressure',
  LIVER_PANEL = 'liver_panel',
  BLOOD_TEST = 'blood_test',
  HEART_RATE = 'heart_rate',
  OXYGEN_SATURATION = 'oxygen_saturation',
  TEMPERATURE = 'temperature',
  GLUCOSE = 'glucose',
  CHOLESTEROL = 'cholesterol',
  KIDNEY_FUNCTION = 'kidney_function',
  THYROID = 'thyroid',
  VITAMIN_LEVELS = 'vitamin_levels',
  DRUG_SCREENING = 'drug_screening',
  COVID_TEST = 'covid_test',
  OTHER = 'other'
}

// Review types for medical staff workflow
export enum MedicalReviewType {
  // Entry Level Reviews
  ENTRY_EKG_REVIEW = 'entry_ekg_review',
  ENTRY_LIVER_REVIEW = 'entry_liver_review',
  ENTRY_COMBINED_REVIEW = 'entry_combined_review',

  // Pre-Ceremony Reviews
  PRE_CEREMONY_EKG_REVIEW = 'pre_ceremony_ekg_review',
  PRE_CEREMONY_BP_REVIEW = 'pre_ceremony_bp_review',
  PRE_CEREMONY_VITALS_REVIEW = 'pre_ceremony_vitals_review',

  // During Ceremony Reviews
  IN_CEREMONY_BP_MONITORING = 'in_ceremony_bp_monitoring',
  IN_CEREMONY_VITALS_MONITORING = 'in_ceremony_vitals_monitoring',

  // Post-Ceremony Reviews
  POST_CEREMONY_EKG_REVIEW = 'post_ceremony_ekg_review',
  POST_CEREMONY_BP_REVIEW = 'post_ceremony_bp_review',
  POST_CEREMONY_COMPLETE_REVIEW = 'post_ceremony_complete_review',

  // General Reviews
  MEDICATIONS_REVIEW = 'medications_review',
  QUESTIONNAIRE_REVIEW = 'questionnaire_review',
  FOOD_INTAKE_REVIEW = 'food_intake_review',
  MEDICAL_QUESTION = 'medical_question',
  GENERAL_CLEARANCE = 'general_clearance'
}

// Status of medical records
export enum MedicalRecordStatus {
  PENDING_REVIEW = 'pending_review',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  NEEDS_CORRECTION = 'needs_correction',
  REJECTED = 'rejected',
  EXPIRED = 'expired'
}

// Version status for tracking corrections
export enum VersionStatus {
  INITIAL = 'initial',
  CORRECTION_REQUESTED = 'correction_requested',
  CORRECTION_SUBMITTED = 'correction_submitted',
  FINAL = 'final'
}

// Enhanced Medical Record interface
export interface MedicalRecord {
  _id?: string;

  // Core identifiers
  clientId: string;
  retreatId?: string;
  ceremonyId?: string;
  ceremonyNumber?: number;

  // Categorization
  eventType: MedicalEventType;
  medicalType: MedicalType;
  reviewType?: MedicalReviewType;

  // Versioning
  version: number;
  versionStatus: VersionStatus;
  previousVersionId?: string;
  isLatestVersion: boolean;
  correctionRequestedAt?: Date | string;
  correctionReason?: string;

  // Dates
  testDate: Date | string;
  uploadDate: Date | string;
  expiryDate?: Date | string;

  // Status
  status: MedicalRecordStatus;

  // Test Results
  results: {
    // For BP
    systolic?: number;
    diastolic?: number;
    heartRate?: number;

    // For other vitals
    temperature?: number;
    oxygenSaturation?: number;
    respiratoryRate?: number;

    // For lab tests
    labValues?: Record<string, any>;
    normalRange?: Record<string, { min: number; max: number }>;

    // General
    value?: string;
    unit?: string;
    interpretation?: 'normal' | 'abnormal' | 'borderline';
    abnormalities?: string[];
    details?: string;
  };

  // Files
  attachments: {
    url: string;
    filename: string;
    fileType: string;
    uploadedAt: Date | string;
    s3Key?: string;
    size?: number;
  }[];

  // Notes and Review
  notes?: string;
  medicalStaffNotes?: string;
  reviewerNotes?: string;
  clientInstructions?: string;

  // Tracking
  takenBy?: string;
  reviewedBy?: string;
  reviewedAt?: Date | string;
  approvedBy?: string;
  approvedAt?: Date | string;

  // Measurement context (for in-ceremony)
  measurementTime?: string; // "pre-dose", "30min", "1hr", etc.
  doseInformation?: {
    substance?: string;
    amount?: number;
    unit?: string;
    timeAdministered?: Date | string;
  };

  // Metadata
  createdAt?: Date | string;
  updatedAt?: Date | string;
  createdBy?: string;
  updatedBy?: string;
}

// Custom test type definition
export interface CustomTestType {
  _id?: string;
  name: string;
  code: string;
  category: 'lab' | 'vital' | 'imaging' | 'other';
  requiredFields?: string[];
  normalRanges?: Record<string, { min: number; max: number; unit: string }>;
  description?: string;
  isActive: boolean;
  createdBy?: string;
  createdAt?: Date | string;
}

// Medical record group for organization
export interface MedicalRecordGroup {
  eventType: MedicalEventType;
  medicalType: MedicalType;
  records: MedicalRecord[];
  latestRecord?: MedicalRecord;
  requiresAction: boolean;
  actionMessage?: string;
  nextActionDate?: Date | string;
}

// Client medical profile
export interface ClientMedicalProfile {
  clientId: string;
  clientName: string;

  // Entry qualification
  entryQualificationStatus: 'pending' | 'qualified' | 'needs_correction' | 'disqualified';
  entryRecords: MedicalRecordGroup[];
  entryExpiryDate?: Date | string;

  // Ceremony readiness
  ceremonyClearances: {
    ceremonyId: string;
    ceremonyNumber: number;
    ceremonyDate: Date | string;
    preCeremonyStatus: 'pending' | 'cleared' | 'conditional' | 'not_cleared';
    preCeremonyRecords: MedicalRecord[];
    inCeremonyRecords: MedicalRecord[];
    postCeremonyRecords: MedicalRecord[];
  }[];

  // Additional records
  additionalRecords: MedicalRecord[];

  // Medical flags
  hasActiveIssues: boolean;
  medicalAlerts: {
    type: 'critical' | 'warning' | 'info';
    message: string;
    relatedRecordId?: string;
    expiresAt?: Date | string;
  }[];

  // Summary
  lastUpdated: Date | string;
  nextRequiredAction?: {
    action: string;
    dueDate: Date | string;
    medicalType: MedicalType;
  };
}

// Review request for medical staff
export interface MedicalReviewRequest {
  _id?: string;
  requestNumber: string;
  clientId: string;
  clientName: string;
  retreatId?: string;
  ceremonyId?: string;

  reviewType: MedicalReviewType;
  priority: 'urgent' | 'high' | 'normal' | 'low';

  recordIds: string[];
  eventType: MedicalEventType;
  medicalTypes: MedicalType[];

  requestedBy: string;
  requestedAt: Date | string;

  assignedTo?: string;
  assignedAt?: Date | string;

  status: 'pending' | 'in_progress' | 'completed' | 'escalated';

  medicalStaffNotes?: string;
  instructions?: string;
  questions?: string;

  reviewedBy?: string;
  reviewedAt?: Date | string;
  reviewOutcome?: 'approved' | 'needs_correction' | 'rejected' | 'escalated';
  reviewNotes?: string;

  dueDate?: Date | string;
  completedAt?: Date | string;
}

// Helper functions for display
export const getMedicalEventTypeLabel = (eventType: MedicalEventType): string => {
  const labels: Record<MedicalEventType, string> = {
    [MedicalEventType.ENTRY]: 'Entry Level',
    [MedicalEventType.PRE_CEREMONY]: 'Pre-Ceremony',
    [MedicalEventType.IN_CEREMONY]: 'In-Ceremony',
    [MedicalEventType.POST_CEREMONY]: 'Post-Ceremony',
    [MedicalEventType.ADDITIONAL]: 'Additional'
  };
  return labels[eventType];
};

export const getMedicalTypeLabel = (type: MedicalType): string => {
  const labels: Record<MedicalType, string> = {
    [MedicalType.EKG]: 'EKG/ECG',
    [MedicalType.BLOOD_PRESSURE]: 'Blood Pressure',
    [MedicalType.LIVER_PANEL]: 'Liver Panel',
    [MedicalType.BLOOD_TEST]: 'Blood Test',
    [MedicalType.HEART_RATE]: 'Heart Rate',
    [MedicalType.OXYGEN_SATURATION]: 'Oxygen Saturation',
    [MedicalType.TEMPERATURE]: 'Temperature',
    [MedicalType.GLUCOSE]: 'Glucose',
    [MedicalType.CHOLESTEROL]: 'Cholesterol',
    [MedicalType.KIDNEY_FUNCTION]: 'Kidney Function',
    [MedicalType.THYROID]: 'Thyroid',
    [MedicalType.VITAMIN_LEVELS]: 'Vitamin Levels',
    [MedicalType.DRUG_SCREENING]: 'Drug Screening',
    [MedicalType.COVID_TEST]: 'COVID Test',
    [MedicalType.OTHER]: 'Other'
  };
  return labels[type];
};

export const getMedicalReviewTypeLabel = (type: MedicalReviewType): string => {
  const labels: Record<MedicalReviewType, string> = {
    // Entry Level
    [MedicalReviewType.ENTRY_EKG_REVIEW]: 'Entry EKG Review',
    [MedicalReviewType.ENTRY_LIVER_REVIEW]: 'Entry Liver Panel Review',
    [MedicalReviewType.ENTRY_COMBINED_REVIEW]: 'Entry Combined Review',

    // Pre-Ceremony
    [MedicalReviewType.PRE_CEREMONY_EKG_REVIEW]: 'Pre-Ceremony EKG Review',
    [MedicalReviewType.PRE_CEREMONY_BP_REVIEW]: 'Pre-Ceremony BP Review',
    [MedicalReviewType.PRE_CEREMONY_VITALS_REVIEW]: 'Pre-Ceremony Vitals Review',

    // In-Ceremony
    [MedicalReviewType.IN_CEREMONY_BP_MONITORING]: 'In-Ceremony BP Monitoring',
    [MedicalReviewType.IN_CEREMONY_VITALS_MONITORING]: 'In-Ceremony Vitals Monitoring',

    // Post-Ceremony
    [MedicalReviewType.POST_CEREMONY_EKG_REVIEW]: 'Post-Ceremony EKG Review',
    [MedicalReviewType.POST_CEREMONY_BP_REVIEW]: 'Post-Ceremony BP Review',
    [MedicalReviewType.POST_CEREMONY_COMPLETE_REVIEW]: 'Post-Ceremony Complete Review',

    // General
    [MedicalReviewType.MEDICATIONS_REVIEW]: 'Medications Review',
    [MedicalReviewType.QUESTIONNAIRE_REVIEW]: 'Questionnaire Review',
    [MedicalReviewType.FOOD_INTAKE_REVIEW]: 'Food Intake Review',
    [MedicalReviewType.MEDICAL_QUESTION]: 'Medical Question',
    [MedicalReviewType.GENERAL_CLEARANCE]: 'General Clearance'
  };
  return labels[type];
};

// Get review types by event type
export const getReviewTypesByEventType = (eventType: MedicalEventType): MedicalReviewType[] => {
  switch (eventType) {
    case MedicalEventType.ENTRY:
      return [
        MedicalReviewType.ENTRY_EKG_REVIEW,
        MedicalReviewType.ENTRY_LIVER_REVIEW,
        MedicalReviewType.ENTRY_COMBINED_REVIEW
      ];
    case MedicalEventType.PRE_CEREMONY:
      return [
        MedicalReviewType.PRE_CEREMONY_EKG_REVIEW,
        MedicalReviewType.PRE_CEREMONY_BP_REVIEW,
        MedicalReviewType.PRE_CEREMONY_VITALS_REVIEW
      ];
    case MedicalEventType.IN_CEREMONY:
      return [
        MedicalReviewType.IN_CEREMONY_BP_MONITORING,
        MedicalReviewType.IN_CEREMONY_VITALS_MONITORING
      ];
    case MedicalEventType.POST_CEREMONY:
      return [
        MedicalReviewType.POST_CEREMONY_EKG_REVIEW,
        MedicalReviewType.POST_CEREMONY_BP_REVIEW,
        MedicalReviewType.POST_CEREMONY_COMPLETE_REVIEW
      ];
    default:
      return [
        MedicalReviewType.MEDICATIONS_REVIEW,
        MedicalReviewType.QUESTIONNAIRE_REVIEW,
        MedicalReviewType.FOOD_INTAKE_REVIEW,
        MedicalReviewType.MEDICAL_QUESTION,
        MedicalReviewType.GENERAL_CLEARANCE
      ];
  }
};