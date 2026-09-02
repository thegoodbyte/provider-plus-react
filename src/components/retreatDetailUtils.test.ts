import { formatDateForInput, formatStaffRole, getHouseIdValue, getRetreatTown } from './retreatDetailUtils';

describe('retreat detail utilities', () => {
  it('resolves a house identifier from populated and plain values', () => {
    expect(getHouseIdValue('house-1')).toBe('house-1');
    expect(getHouseIdValue({ _id: 'house-2' } as any)).toBe('house-2');
    expect(getHouseIdValue()).toBe('');
  });

  it('prefers a real retreat town and falls back to the assigned house', () => {
    const houses = [{ _id: 'house-1', generalTown: 'Jablonné nad Orlicí' }] as any;
    expect(getRetreatTown({ locationTown: 'Prague', houseId: 'house-1' } as any, houses)).toBe('Prague');
    expect(getRetreatTown({ location: 'Default Location', houseId: 'house-1' } as any, houses)).toBe('Jablonné nad Orlicí');
  });

  it('formats known and custom staff roles consistently', () => {
    expect(formatStaffRole('second_helper')).toBe('Second helper');
    expect(formatStaffRole('medical_advisor')).toBe('Medical Advisor');
  });

  it('returns safe date-input values', () => {
    expect(formatDateForInput('2026-09-12T15:00:00.000Z')).toBe('2026-09-12');
    expect(formatDateForInput('invalid')).toBe('');
  });
});
