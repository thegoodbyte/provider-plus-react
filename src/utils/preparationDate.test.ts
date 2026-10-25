import { preparationDate } from './preparationDate';
describe('medical preparation dates', () => {
  const start = new Date('2026-11-17T00:00:00Z');
  it.each([
    [{ daysBeforeRetreat: '30' }, '2026-10-18'],
    [{ monthsBeforeRetreat: '1' }, '2026-10-17'],
    [{ daysBeforeRetreat: '5' }, '2026-11-12'],
    [{ daysBeforeRetreat: '0' }, '2026-11-17'],
    [{ dueDate: '2026-10-01' }, '2026-10-01'],
  ])('calculates %j', (offset, expected) => expect(preparationDate(start, offset).toISOString().slice(0,10)).toBe(expected));
  it('uses the retreat calendar day across timezone offsets', () => { expect(preparationDate(new Date('2026-11-16T23:00:00Z'), { daysBeforeRetreat: 5 }).toISOString().slice(0,10)).toBe('2026-11-12'); });
  it('clamps months at month end including leap years', () => {
    expect(preparationDate(new Date('2028-03-31'), { monthsBeforeRetreat: 1 }).toISOString().slice(0,10)).toBe('2028-02-29');
    expect(preparationDate(new Date('2027-03-31'), { monthsBeforeRetreat: 1 }).toISOString().slice(0,10)).toBe('2027-02-28');
  });
  it.each([-1, 1.5, 'abc', Infinity, 3651])('rejects invalid day offsets %s', daysBeforeRetreat => expect(() => preparationDate(start, { daysBeforeRetreat })).toThrow());
  it('rejects ambiguous units and missing retreat dates', () => {
    expect(() => preparationDate(start, { daysBeforeRetreat: 1, monthsBeforeRetreat: 1 })).toThrow();
    expect(() => preparationDate(new Date(NaN), { daysBeforeRetreat: 1 })).toThrow();
  });
});
