import { deriveMedicalItemState, MEDICAL_ITEM_TONES } from './medicalItemStatus';

const artifact = (overrides: any = {}) => ({ files: [{}], ...overrides });
const review = (overrides: any = {}) => ({ status: 'pending', reviewNotes: '', ...overrides });

describe('deriveMedicalItemState', () => {
  it('is missing when there is no artifact, no file, or the artifact is flagged missing_file', () => {
    expect(deriveMedicalItemState(undefined, undefined)).toBe('missing');
    expect(deriveMedicalItemState({} as any, undefined)).toBe('missing');
    expect(deriveMedicalItemState(artifact({ status: 'missing_file' }) as any, undefined)).toBe('missing');
    expect(deriveMedicalItemState(artifact({ files: undefined, receivedAt: '2026-01-01' }) as any, undefined)).toBe('received');
  });

  it('is received when an artifact has a file but no review request', () => {
    expect(deriveMedicalItemState(artifact() as any, undefined)).toBe('received');
  });

  it('is pending for every in-flight review status with no decision yet', () => {
    ['assigned', 'in_progress', 'pending', 'in_review', 'awaiting_whatsapp'].forEach((status) => {
      expect(deriveMedicalItemState(artifact() as any, review({ status }) as any)).toBe('pending');
    });
  });

  it('is ok via either reviewDecision or decision', () => {
    expect(deriveMedicalItemState(artifact() as any, review({ reviewDecision: 'OK' }) as any)).toBe('ok');
    expect(deriveMedicalItemState(artifact() as any, review({ decision: 'approved' }) as any)).toBe('ok');
  });

  it('is declined via either reviewDecision or decision', () => {
    expect(deriveMedicalItemState(artifact() as any, review({ reviewDecision: 'NOT OK' }) as any)).toBe('declined');
    expect(deriveMedicalItemState(artifact() as any, review({ decision: 'declined' }) as any)).toBe('declined');
  });

  it('is caution for caution, more-info, WONT_DO, and other fallback values', () => {
    expect(deriveMedicalItemState(artifact() as any, review({ reviewDecision: 'caution' }) as any)).toBe('caution');
    expect(deriveMedicalItemState(artifact() as any, review({ decision: 'caution' }) as any)).toBe('caution');
    expect(deriveMedicalItemState(artifact() as any, review({ reviewDecision: 'more_info_needed' }) as any)).toBe('caution');
    expect(deriveMedicalItemState(artifact() as any, review({ decision: 'need_more_info' }) as any)).toBe('caution');
    expect(deriveMedicalItemState(artifact() as any, review({ reviewDecision: 'WONT_DO' }) as any)).toBe('caution');
    expect(deriveMedicalItemState(artifact() as any, review({ decision: 'other' }) as any)).toBe('caution');
  });

  it('falls through to pending for a decided-looking status with no decision field (data drift)', () => {
    expect(deriveMedicalItemState(artifact() as any, review({ status: 'approved' }) as any)).toBe('pending');
    expect(deriveMedicalItemState(artifact() as any, review({ status: 'completed' }) as any)).toBe('pending');
  });
});

describe('MEDICAL_ITEM_TONES', () => {
  it('defines a tone for every state with a label and oklch colors', () => {
    (['missing', 'received', 'pending', 'ok', 'caution', 'declined'] as const).forEach((state) => {
      const value = MEDICAL_ITEM_TONES[state];
      expect(value.label).toEqual(expect.any(String));
      expect(value.wash).toContain('oklch(');
      expect(value.chip).toContain('oklch(');
      expect(value.edge).toContain('oklch(');
      expect(value.dot).toContain('oklch(');
      expect(value.ink).toContain('oklch(');
    });
    expect(MEDICAL_ITEM_TONES.missing.borderStyle).toBe('dashed');
  });
});
