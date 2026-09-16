import { MedicalArtifact, MedicalReviewRequest, Reminder, RetreatClient } from '../types';

export interface WorkflowMedicalRequirement {
  type: 'ekg' | 'liver_panel';
  label: string;
  state: 'missing' | 'needs_review' | 'pending' | 'approved' | 'caution' | 'rejected' | 'unavailable';
  artifact?: MedicalArtifact;
  review?: MedicalReviewRequest;
}
export interface WorkflowSummaryRow extends Pick<RetreatClient, '_id' | 'bookingNumber' | 'clientId' | 'retreatId' | 'status'> {
  clientName: string;
  clientEmail: string;
  clientDisplayId?: number;
  depositPaid: boolean;
  medicalRequirements: WorkflowMedicalRequirement[];
  reminders: Pick<Reminder, '_id' | 'clientId' | 'title' | 'description' | 'dueDate' | 'status'>[];
  readinessScore: number;
  readinessState: 'ready' | 'attention' | 'blocked' | 'unknown';
  nextAction: string;
  missingItems: string[];
  unavailable: string[];
}
export interface RetreatWorkflowSummary {
  rows: WorkflowSummaryRow[];
  unavailable: string[];
}
