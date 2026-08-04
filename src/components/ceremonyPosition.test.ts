import { getRetreatCeremonyPosition } from './ceremonyPosition';

const ceremonies = [
  { _id: 'ceremony-119', ceremonyNumber: 119, date: '2026-08-04T00:00:00.000Z', startTime: '21:00' },
  { _id: 'ceremony-120', ceremonyNumber: 120, date: '2026-08-06T00:00:00.000Z', startTime: '21:00' },
];

describe('getRetreatCeremonyPosition', () => {
  it('maps global ceremony numbers to their position inside the retreat', () => {
    expect(getRetreatCeremonyPosition(ceremonies, undefined, 119)).toBe(1);
    expect(getRetreatCeremonyPosition(ceremonies, undefined, 120)).toBe(2);
  });

  it('prefers the linked ceremony id and supports legacy relative positions', () => {
    expect(getRetreatCeremonyPosition(ceremonies, 'ceremony-120', 119)).toBe(2);
    expect(getRetreatCeremonyPosition([], undefined, 1)).toBe(1);
  });
});
