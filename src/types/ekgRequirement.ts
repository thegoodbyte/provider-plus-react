/** PPVC-890 response contract v1. Keep frontend copies byte-identical until PPVC-776 generation. */
export type EkgRequirementState = 'missing' | 'uploaded' | 'awaiting_review' | 'accepted' | 'caution' | 'correction_needed' | 'declined' | 'expired' | 'validity_unknown' | 'waived' | 'not_applicable' | 'unavailable';
export interface EkgRequirementProjection {
  version: 1;
  bookingId: string;
  key: 'entry_ekg_received';
  checkedAt: string;
  mode: 'canonical' | 'compare' | 'legacy';
  state: EkgRequirementState;
  label: string;
  applicable: boolean | null;
  required: boolean | null;
  dueDate: string | null;
  validity?: 'valid' | 'expired' | 'unknown' | 'not_enforced';
  latestEvidence: { testDate?: string | null; id: string; version: number; receivedAt?: string } | null;
  latestReview: { id: string; status: string; result: EkgRequirementState; reviewedAt: string | null } | null;
  nextAction: 'upload' | 'submit_for_review' | 'await_review' | 'replace' | 'contact_staff' | 'retry' | 'none';
  satisfied: boolean;
  comparison?: { legacyState: string | null; canonicalState: EkgRequirementState; differs: boolean };
}
