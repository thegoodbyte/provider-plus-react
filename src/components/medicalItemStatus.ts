import { MedicalArtifact, MedicalReviewRequest } from '../types';

export type MedicalItemState = 'missing' | 'received' | 'pending' | 'ok' | 'caution' | 'declined';

const PENDING_REVIEW_STATUSES = new Set(['assigned', 'in_progress', 'pending', 'in_review', 'awaiting_whatsapp']);

/**
 * Collapses the several overlapping status/decision fields on MedicalArtifact and
 * MedicalReviewRequest into one clean 6-state model for display.
 *
 * `more_info_needed` / `need_more_info` / `WONT_DO` / `decision: 'other'` all fall into
 * `caution` rather than `ok`/`declined`/`received`: none of them represent a clean medical
 * clearance, so `caution` ("needs a human look") is the only bucket that doesn't overstate
 * either safety or danger.
 */
export const deriveMedicalItemState = (artifact?: MedicalArtifact, review?: MedicalReviewRequest): MedicalItemState => {
  const hasFile = Boolean(artifact) && (Boolean(artifact!.files?.length) || Boolean(artifact!.receivedAt));
  if (!artifact || !hasFile || artifact.status === 'missing_file') return 'missing';
  if (!review) return 'received';

  const { reviewDecision, decision } = review;
  if (reviewDecision === 'OK' || decision === 'approved') return 'ok';
  if (reviewDecision === 'NOT OK' || decision === 'declined') return 'declined';
  if (reviewDecision === 'caution' || decision === 'caution') return 'caution';
  if (reviewDecision === 'more_info_needed' || decision === 'need_more_info' || reviewDecision === 'WONT_DO' || decision === 'other') return 'caution';

  if (PENDING_REVIEW_STATUSES.has(review.status)) return 'pending';
  // A "decided"-looking status (approved/rejected/completed/...) with no decision field
  // populated is data drift -- fall through to pending rather than guessing a decision.
  return 'pending';
};

type Tone = { wash: string; chip: string; edge: string; dot: string; ink: string };

const tone = (h: number, c = 0.06): Tone => ({
  wash: `oklch(0.965 ${c * 0.5} ${h})`,
  chip: `oklch(0.94 ${c} ${h})`,
  edge: `oklch(0.92 ${c * 0.7} ${h})`,
  dot: `oklch(0.66 ${c * 2.4} ${h})`,
  ink: `oklch(0.42 ${c * 1.8} ${h})`,
});

export const MEDICAL_ITEM_TONES: Record<MedicalItemState, Tone & { label: string; borderStyle?: 'dashed'; borderColor?: string }> = {
  missing: { ...tone(55, 0.07), label: 'Not received', borderStyle: 'dashed', borderColor: 'oklch(0.72 0.12 55)' },
  received: { ...tone(250, 0.015), label: 'Received · no MRR', dot: 'oklch(0.7 0.02 250)' },
  pending: { ...tone(285, 0.05), label: 'MRR pending' },
  ok: { ...tone(160, 0.055), label: 'Approved' },
  caution: { ...tone(88, 0.07), label: 'Caution', dot: 'oklch(0.75 0.14 80)', ink: 'oklch(0.42 0.09 70)' },
  declined: { ...tone(15, 0.07), label: 'Declined', borderColor: 'oklch(0.8 0.1 15)', dot: 'oklch(0.6 0.19 18)', ink: 'oklch(0.45 0.17 18)' },
};

/** 24x24 stroke-based icon path markup per state, stroke-width 4, round caps -- matches the design spec. */
export const MEDICAL_ITEM_ICON_PATHS: Record<MedicalItemState, string> = {
  declined: '<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>',
  ok: '<path d="M20 6 9 17l-5-5"></path>',
  caution: '<path d="M12 5v9"></path><path d="M12 19v.01"></path>',
  missing: '<path d="M12 5v9"></path><path d="M12 19v.01"></path>',
  pending: '<path d="M12 6v6l4 2"></path>',
  received: '<path d="M5 12h14"></path>',
};
