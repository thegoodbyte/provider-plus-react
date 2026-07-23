import {
  DOCUMENT_STAGES,
  DOCUMENT_TYPES,
  MEDICAL_STATUSES,
  MEDICAL_REVIEW_DECISIONS,
  MEDICAL_REQUEST_TYPES,
  ARTIFACT_TYPES,
  getMedicalStatusColor,
  getMedicalStatusIcon,
  getReviewDecisionColor,
  isValidDocumentStage,
  isValidDocumentType,
  isValidMedicalStatus,
  DOCUMENT_STAGE_OPTIONS,
  DOCUMENT_TYPE_OPTIONS,
  MEDICAL_STATUS_OPTIONS,
  MEDICAL_REVIEW_DECISION_OPTIONS,
  DEFAULT_MEDICAL_CONFIG
} from '../medical.constants';

describe('Medical Constants', () => {
  describe('Document Stages', () => {
    it('should have all required document stages', () => {
      expect(DOCUMENT_STAGES.ENTRY).toBe('entry');
      expect(DOCUMENT_STAGES.PRE_CEREMONY).toBe('pre_ceremony');
      expect(DOCUMENT_STAGES.IN_CEREMONY).toBe('in_ceremony');
      expect(DOCUMENT_STAGES.POST_CEREMONY).toBe('post_ceremony');
      expect(DOCUMENT_STAGES.OTHER).toBe('other');
      expect(DOCUMENT_STAGES.ADDITIONAL).toBe('additional');
    });

    it('should validate document stages correctly', () => {
      expect(isValidDocumentStage('entry')).toBe(true);
      expect(isValidDocumentStage('pre_ceremony')).toBe(true);
      expect(isValidDocumentStage('invalid_stage')).toBe(false);
      expect(isValidDocumentStage('')).toBe(false);
    });

    it('should generate correct document stage options', () => {
      expect(DOCUMENT_STAGE_OPTIONS).toHaveLength(6);
      expect(DOCUMENT_STAGE_OPTIONS[0]).toEqual({
        value: 'entry',
        label: 'Entry'
      });
      expect(DOCUMENT_STAGE_OPTIONS[1]).toEqual({
        value: 'pre_ceremony',
        label: 'Pre Ceremony'
      });
    });
  });

  describe('Document Types', () => {
    it('should have all required document types', () => {
      expect(DOCUMENT_TYPES.EKG).toBe('EKG');
      expect(DOCUMENT_TYPES.BP).toBe('BP');
      expect(DOCUMENT_TYPES.LIVER).toBe('Liver');
      expect(DOCUMENT_TYPES.MEDICATIONS).toBe('Medications');
      expect(DOCUMENT_TYPES.OTHER).toBe('other');
    });

    it('should validate document types correctly', () => {
      expect(isValidDocumentType('EKG')).toBe(true);
      expect(isValidDocumentType('Liver')).toBe(true);
      expect(isValidDocumentType('invalid_type')).toBe(false);
      expect(isValidDocumentType('')).toBe(false);
    });

    it('should generate correct document type options', () => {
      expect(DOCUMENT_TYPE_OPTIONS).toContainEqual({
        value: 'EKG',
        label: 'EKG'
      });
      expect(DOCUMENT_TYPE_OPTIONS).toContainEqual({
        value: 'Liver',
        label: 'LIVER'
      });
    });
  });

  describe('Medical Statuses', () => {
    it('should have all required medical statuses', () => {
      expect(MEDICAL_STATUSES.PENDING).toBe('pending');
      expect(MEDICAL_STATUSES.RECEIVED).toBe('received');
      expect(MEDICAL_STATUSES.REVIEWED).toBe('reviewed');
      expect(MEDICAL_STATUSES.APPROVED).toBe('approved');
      expect(MEDICAL_STATUSES.REJECTED).toBe('rejected');
      expect(MEDICAL_STATUSES.SENT_TO_COOK).toBe('sent_to_cook');
    });

    it('should validate medical statuses correctly', () => {
      expect(isValidMedicalStatus('pending')).toBe(true);
      expect(isValidMedicalStatus('approved')).toBe(true);
      expect(isValidMedicalStatus('invalid_status')).toBe(false);
    });

    it('should return correct status colors', () => {
      expect(getMedicalStatusColor(MEDICAL_STATUSES.APPROVED)).toBe('#28a745');
      expect(getMedicalStatusColor(MEDICAL_STATUSES.PENDING)).toBe('#ffc107');
      expect(getMedicalStatusColor(MEDICAL_STATUSES.REJECTED)).toBe('#dc3545');
      expect(getMedicalStatusColor('invalid' as any)).toBe('#6c757d');
    });

    it('should return correct status icons', () => {
      expect(getMedicalStatusIcon(MEDICAL_STATUSES.APPROVED)).toBe('✅');
      expect(getMedicalStatusIcon(MEDICAL_STATUSES.PENDING)).toBe('⏳');
      expect(getMedicalStatusIcon(MEDICAL_STATUSES.REJECTED)).toBe('❌');
      expect(getMedicalStatusIcon('invalid' as any)).toBe('❓');
    });

    it('should generate correct medical status options', () => {
      expect(MEDICAL_STATUS_OPTIONS).toHaveLength(6);
      expect(MEDICAL_STATUS_OPTIONS).toContainEqual({
        value: 'pending',
        label: 'Pending'
      });
      expect(MEDICAL_STATUS_OPTIONS).toContainEqual({
        value: 'approved',
        label: 'Approved'
      });
    });
  });

  describe('Medical Review Decisions', () => {
    it('should have all required review decisions', () => {
      expect(MEDICAL_REVIEW_DECISIONS.OK).toBe('OK');
      expect(MEDICAL_REVIEW_DECISIONS.CAUTION).toBe('caution');
      expect(MEDICAL_REVIEW_DECISIONS.NOT_OK).toBe('NOT OK');
    });

    it('should return correct review decision colors', () => {
      expect(getReviewDecisionColor(MEDICAL_REVIEW_DECISIONS.OK)).toBe('bg-green-100 text-green-800');
      expect(getReviewDecisionColor(MEDICAL_REVIEW_DECISIONS.CAUTION)).toBe('bg-yellow-100 text-yellow-800');
      expect(getReviewDecisionColor(MEDICAL_REVIEW_DECISIONS.NOT_OK)).toBe('bg-red-100 text-red-800');
      expect(getReviewDecisionColor('invalid' as any)).toBe('bg-gray-100 text-gray-800');
    });

    it('should generate correct review decision options', () => {
      expect(MEDICAL_REVIEW_DECISION_OPTIONS).toHaveLength(3);
      expect(MEDICAL_REVIEW_DECISION_OPTIONS).toContainEqual({
        value: 'OK',
        label: 'OK'
      });
      expect(MEDICAL_REVIEW_DECISION_OPTIONS).toContainEqual({
        value: 'caution',
        label: 'caution'
      });
    });
  });

  describe('Medical Request Types', () => {
    it('should have all required request types', () => {
      expect(MEDICAL_REQUEST_TYPES.EKG_REVIEW).toBe('ekg_review');
      expect(MEDICAL_REQUEST_TYPES.LIVER_PANEL_REVIEW).toBe('liver_panel_review');
      expect(MEDICAL_REQUEST_TYPES.FINAL_CLEARANCE).toBe('final_clearance');
      expect(MEDICAL_REQUEST_TYPES.EMERGENCY_REVIEW).toBe('emergency_review');
    });
  });

  describe('Artifact Types', () => {
    it('should have all required artifact types', () => {
      expect(ARTIFACT_TYPES.EKG).toBe('ekg');
      expect(ARTIFACT_TYPES.LIVER_PANEL).toBe('liver_panel');
      expect(ARTIFACT_TYPES.CEREMONY_EKG).toBe('ceremony_ekg');
      expect(ARTIFACT_TYPES.QUESTIONNAIRE).toBe('questionnaire');
    });
  });

  describe('Default Medical Configuration', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_MEDICAL_CONFIG.documentStage).toBe('entry');
      expect(DEFAULT_MEDICAL_CONFIG.documentType).toBe('other');
      expect(DEFAULT_MEDICAL_CONFIG.status).toBe('pending');
      expect(DEFAULT_MEDICAL_CONFIG.reviewDecision).toBeNull();
    });
  });

  describe('Type Safety', () => {
    it('should maintain type safety for document stages', () => {
      const testStage: typeof DOCUMENT_STAGES[keyof typeof DOCUMENT_STAGES] = DOCUMENT_STAGES.ENTRY;
      expect(testStage).toBe('entry');
    });

    it('should maintain type safety for medical statuses', () => {
      const testStatus: typeof MEDICAL_STATUSES[keyof typeof MEDICAL_STATUSES] = MEDICAL_STATUSES.APPROVED;
      expect(testStatus).toBe('approved');
    });
  });
});