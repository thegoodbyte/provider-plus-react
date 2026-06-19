// Medical Record Types
export enum MedicalRecordType {
  ENTRY_DOCUMENT = 'entry_document',          // Initial EKG/Liver tests for qualification
  ENTRY_CORRECTION = 'entry_correction',      // Corrections/updates to entry documents
  PRE_CEREMONY = 'pre_ceremony',              // Pre-ceremony vitals (EKG, BP on-site)
  IN_CEREMONY = 'in_ceremony',                // During ceremony vitals
  POST_CEREMONY = 'post_ceremony',            // After ceremony EKG and BP
  ADDITIONAL = 'additional'                   // Other medical tests/information
}

export enum TestType {
  EKG = 'ekg',
  LIVER_PANEL = 'liver_panel',
  BLOOD_PRESSURE = 'blood_pressure',
  HEART_RATE = 'heart_rate',
  BLOOD_TEST = 'blood_test',
  OTHER = 'other'
}

export enum TestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  NEEDS_CORRECTION = 'needs_correction',
  REJECTED = 'rejected'
}

export interface MedicalRecord {
  _id?: string;
  clientId: string;
  retreatId?: string;
  ceremonyId?: string;
  recordType: MedicalRecordType;
  testType: TestType;
  testDate: Date | string;
  uploadDate: Date | string;
  version: number;
  status: TestStatus;

  // Test Results
  results?: {
    value?: string;
    systolic?: number;
    diastolic?: number;
    heartRate?: number;
    details?: string;
    abnormalities?: string[];
  };

  // Files
  attachments?: {
    url: string;
    filename: string;
    uploadedAt: Date | string;
    fileType: string;
    size?: number;
  }[];

  // Notes
  notes?: string;
  reviewerNotes?: string;
  correctionRequested?: string;

  // Metadata
  ceremonryNumber?: number;
  measurementTime?: string; // e.g., "pre-dose", "1hr post", "2hr post", etc.
  takenBy?: string; // Staff member who took the measurement
  reviewedBy?: string;
  reviewedAt?: Date | string;

  // For linking versions
  previousVersionId?: string;
  isLatestVersion: boolean;

  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface MedicalRecordGroup {
  type: MedicalRecordType;
  testType: TestType;
  records: MedicalRecord[];
  latestRecord?: MedicalRecord;
  requiresAction: boolean;
  actionMessage?: string;
}

export interface ClientMedicalSummary {
  clientId: string;
  clientName: string;

  // Entry qualification status
  qualificationStatus: 'pending' | 'qualified' | 'needs_review' | 'disqualified';
  entryDocuments: MedicalRecordGroup[];

  // Pre-ceremony checks
  preCeremonyRecords: MedicalRecordGroup[];
  preCeremonyApproved: boolean;

  // Ceremony records organized by ceremony
  ceremonyRecords: {
    ceremonyId: string;
    ceremonyNumber: number;
    ceremonyDate: Date | string;
    records: MedicalRecord[];
  }[];

  // Post-ceremony records
  postCeremonyRecords: MedicalRecordGroup[];

  // Additional medical information
  additionalRecords: MedicalRecordGroup[];

  // Overall medical flags
  hasActiveIssues: boolean;
  requiresMedicalReview: boolean;
  lastUpdated: Date | string;
}