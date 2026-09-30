import { isRetreatFuture } from './MedicalArtifactsPage';

describe('isRetreatFuture', () => {
  const now = new Date(2026, 8, 30, 12, 0, 0); // 2026-09-30 local noon

  it('treats a retreat ending after today as future', () => {
    expect(isRetreatFuture({ name: 'R', location: '', endDate: '2026-10-05' } as any, now)).toBe(true);
  });

  it('treats a retreat ending before today as past', () => {
    expect(isRetreatFuture({ name: 'R', location: '', endDate: '2026-09-20' } as any, now)).toBe(false);
  });

  it('still shows a retreat ending today (not yet over)', () => {
    expect(isRetreatFuture({ name: 'R', location: '', endDate: '2026-09-30' } as any, now)).toBe(true);
  });

  it('does not shift a UTC-midnight ISO end date to the previous day', () => {
    expect(isRetreatFuture({ name: 'R', location: '', endDate: '2026-09-30T00:00:00.000Z' } as any, now)).toBe(true);
    expect(isRetreatFuture({ name: 'R', location: '', endDate: '2026-09-29T00:00:00.000Z' } as any, now)).toBe(false);
  });

  it('falls back to startDate when endDate is missing', () => {
    expect(isRetreatFuture({ name: 'R', location: '', startDate: '2026-10-01' } as any, now)).toBe(true);
    expect(isRetreatFuture({ name: 'R', location: '', startDate: '2026-09-01' } as any, now)).toBe(false);
  });

  it('defaults to showing the artifact when no retreat or no date is resolvable', () => {
    expect(isRetreatFuture(undefined, now)).toBe(true);
    expect(isRetreatFuture({ name: 'R', location: '' } as any, now)).toBe(true);
  });
});
