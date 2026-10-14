import { datePackageEditorState, newDatePackage, percentageRangeLabel, prepareDatePackages } from './referralDatePackages';

const rule: any = { key: 'dates', name: '', effectiveFrom: '2026-01-01', effectiveTo: '2026-12-31', bookingCurrency: '*', kind: 'percentage', rates: [{ effectiveFrom: '2026-01-01', ratePercent: 19 }, { effectiveFrom: '2026-06-15', ratePercent: 20 }] };
it('previews inclusive percentage ranges using the selected step even before sorting', () => {
  expect(percentageRangeLabel(rule, 0)).toBe('2026-01-01 to 2026-06-14');
  expect(percentageRangeLabel({ ...rule, rates: [...rule.rates].reverse() }, 0)).toBe('2026-06-15 to 2026-12-31');
});
it('creates distinct internal keys without exposing manual key editing', () => expect(newDatePackage().key).not.toBe(newDatePackage().key));
it('sorts dates, creates a readable name and strips obsolete calculation fields', () => {
  expect(prepareDatePackages([{ ...rule, amount: 200, currency: 'USD', tiers: [{ minPrice: 0, ratePercent: 99 }], ratePercent: 99, rates: [...rule.rates].reverse() }])[0]).toEqual({ ...rule, name: '2026-01-01 to 2026-12-31' });
});
it.each([
  { effectiveFrom: '2026-02-30' }, { effectiveTo: '2025-12-31' },
  { rates: [{ effectiveFrom: '2026-01-01', ratePercent: undefined }] },
  { rates: [{ effectiveFrom: '2026-01-01', ratePercent: NaN }] },
  { rates: [{ effectiveFrom: '2026-01-01', ratePercent: 101 }] },
  { rates: [{ effectiveFrom: '2026-01-02', ratePercent: 20 }] },
  { rates: [{ effectiveFrom: '2026-01-01', ratePercent: 19 }, { effectiveFrom: '2026-01-01', ratePercent: 20 }] },
  { rates: [{ effectiveFrom: '2026-01-01', ratePercent: 19 }, { effectiveFrom: '2027-01-01', ratePercent: 20 }] },
])('rejects invalid dates, incomplete or ambiguous percentages: %p', patch => expect(() => prepareDatePackages([{ ...rule, ...patch }])).toThrow());
it('preserves explicit zero and refuses overlapping ongoing packages', () => {
  expect(prepareDatePackages([{ ...rule, rates: [{ effectiveFrom: '2026-01-01', ratePercent: 0 }] }])[0].rates![0].ratePercent).toBe(0);
  expect(() => prepareDatePackages([{ ...rule, effectiveTo: '' }, { ...rule, key: 'next', effectiveFrom: '2027-01-01', effectiveTo: '', rates: [{ effectiveFrom: '2027-01-01', ratePercent: 20 }] }])).toThrow('overlap');
});
it('converts compatible legacy rules and preserves complex legacy agreements until replacement', () => {
  expect(datePackageEditorState({ _id: 'r', name: 'Partner', rateSchedule: [{ effectiveFrom: '2026-06-15', tiers: [{ minPrice: 0, ratePercent: 20 }] }] } as any)).toMatchObject({ activate: true, blocked: false, packages: [{ rates: [{ effectiveFrom: '2026-06-15', ratePercent: 20 }] }] });
  expect(datePackageEditorState({ _id: 'r', name: 'Partner', commissionPackages: [{ ...rule, kind: 'fixed' }] } as any)).toEqual({ activate: false, blocked: true, packages: [] });
  expect(datePackageEditorState({ _id: 'r', name: 'Partner', defaultCommissionPercentage: 10 } as any).activate).toBe(false);
});
