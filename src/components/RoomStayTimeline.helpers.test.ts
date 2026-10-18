import { addNights, dayTicks, nightsBetween, occupantColorIndex, packOccupantsIntoRows, staySegment } from './RoomStayTimeline.helpers';

describe('nightsBetween', () => {
  it('counts nights between two dates', () => {
    expect(nightsBetween('2026-10-01', '2026-10-08')).toBe(7);
    expect(nightsBetween('2026-10-01', '2026-10-04')).toBe(3);
    expect(nightsBetween('2026-10-01', '2026-10-01')).toBe(0);
  });
});

describe('staySegment', () => {
  const retreat = { startDate: '2026-10-01', endDate: '2026-10-08' }; // 7-night retreat

  it('spans 0-100% when the occupant has no stay override', () => {
    expect(staySegment(retreat, {})).toEqual({ leftPct: 0, widthPct: 100, nights: 7 });
  });

  it('PPVC-727: positions a first-booster segment (nights 1-3 of a 7-night retreat)', () => {
    const segment = staySegment(retreat, { roomStayStart: '2026-10-01', roomStayEnd: '2026-10-04' });
    expect(segment.leftPct).toBeCloseTo(0, 5);
    expect(segment.widthPct).toBeCloseTo((3 / 7) * 100, 5);
    expect(segment.nights).toBe(3);
  });

  it('PPVC-727: positions a second-booster segment immediately after the first (nights 4-7)', () => {
    const segment = staySegment(retreat, { roomStayStart: '2026-10-04', roomStayEnd: '2026-10-08' });
    expect(segment.leftPct).toBeCloseTo((3 / 7) * 100, 5);
    expect(segment.widthPct).toBeCloseTo((4 / 7) * 100, 5);
    expect(segment.nights).toBe(4);
  });

  it('PPVC-727: positions a second-booster segment that leaves a one-night gap (nights 5-7)', () => {
    const segment = staySegment(retreat, { roomStayStart: '2026-10-05', roomStayEnd: '2026-10-08' });
    expect(segment.leftPct).toBeCloseTo((4 / 7) * 100, 5);
    expect(segment.widthPct).toBeCloseTo((3 / 7) * 100, 5);
    expect(segment.nights).toBe(3);
  });

  it('does not hardcode a 7-night retreat -- a 10-night retreat split 4+6 computes correctly', () => {
    const longRetreat = { startDate: '2026-10-01', endDate: '2026-10-11' };
    const first = staySegment(longRetreat, { roomStayStart: '2026-10-01', roomStayEnd: '2026-10-05' });
    expect(first).toEqual({ leftPct: 0, widthPct: 40, nights: 4 });
    const second = staySegment(longRetreat, { roomStayStart: '2026-10-05', roomStayEnd: '2026-10-11' });
    expect(second).toEqual({ leftPct: 40, widthPct: 60, nights: 6 });
  });

  it('clamps a stale occupant date that falls outside the (since-edited) retreat range', () => {
    const segment = staySegment(retreat, { roomStayStart: '2026-09-25', roomStayEnd: '2026-10-20' });
    expect(segment.leftPct).toBeGreaterThanOrEqual(0);
    expect(segment.leftPct + segment.widthPct).toBeLessThanOrEqual(100.0001);
    expect(segment).toEqual({ leftPct: 0, widthPct: 100, nights: 7 });
  });
});

describe('dayTicks', () => {
  it('returns one tick per night boundary, starting at 0% and ending at 100%', () => {
    const ticks = dayTicks({ startDate: '2026-10-01', endDate: '2026-10-08' });
    expect(ticks).toHaveLength(8);
    expect(ticks[0].pct).toBe(0);
    expect(ticks[ticks.length - 1].pct).toBe(100);
  });

  it('does not hardcode 7 nights', () => {
    const ticks = dayTicks({ startDate: '2026-10-01', endDate: '2026-10-11' });
    expect(ticks).toHaveLength(11);
  });
});

describe('occupantColorIndex', () => {
  it('is stable for the same id across calls', () => {
    const first = occupantColorIndex('booking-123', 6);
    const second = occupantColorIndex('booking-123', 6);
    expect(first).toBe(second);
  });

  it('spreads across the palette for a representative set of different ids', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const indexes = new Set(ids.map((id) => occupantColorIndex(id, 6)));
    expect(indexes.size).toBeGreaterThan(1);
  });
});

describe('addNights', () => {
  it('crosses a month boundary correctly', () => {
    expect(addNights('2026-10-30', 3)).toBe('2026-11-02');
  });

  it('adds zero nights as a no-op', () => {
    expect(addNights('2026-10-01', 0)).toBe('2026-10-01');
  });
});

describe('packOccupantsIntoRows', () => {
  const retreat = { startDate: '2026-10-13', endDate: '2026-10-20' };

  it('PPVC-730: packs two sequential (non-overlapping) boosters onto one row', () => {
    const boosterOne = { _id: 'booster-1', roomStayStart: '2026-10-13', roomStayEnd: '2026-10-16' };
    const boosterTwo = { _id: 'booster-2', roomStayStart: '2026-10-17', roomStayEnd: '2026-10-20' };
    expect(packOccupantsIntoRows([boosterOne, boosterTwo], retreat)).toEqual([[boosterOne, boosterTwo]]);
  });

  it('PPVC-730: treats a shared checkout/checkin day as non-overlapping', () => {
    const boosterOne = { _id: 'booster-1', roomStayStart: '2026-10-13', roomStayEnd: '2026-10-16' };
    const boosterTwo = { _id: 'booster-2', roomStayStart: '2026-10-16', roomStayEnd: '2026-10-20' };
    expect(packOccupantsIntoRows([boosterOne, boosterTwo], retreat)).toEqual([[boosterOne, boosterTwo]]);
  });

  it('PPVC-730: gives two genuinely overlapping occupants separate rows', () => {
    const anna = { _id: 'anna', roomStayStart: '2026-10-13', roomStayEnd: '2026-10-20' };
    const marhola = { _id: 'marhola', roomStayStart: '2026-10-13', roomStayEnd: '2026-10-20' };
    expect(packOccupantsIntoRows([anna, marhola], retreat)).toEqual([[anna], [marhola]]);
  });

  it('PPVC-730: a third occupant reuses the first row once it frees up, instead of always opening a new one', () => {
    const first = { _id: 'first', roomStayStart: '2026-10-13', roomStayEnd: '2026-10-15' };
    const overlapsFirst = { _id: 'overlaps-first', roomStayStart: '2026-10-13', roomStayEnd: '2026-10-20' };
    const afterFirst = { _id: 'after-first', roomStayStart: '2026-10-15', roomStayEnd: '2026-10-20' };
    expect(packOccupantsIntoRows([first, overlapsFirst, afterFirst], retreat)).toEqual([
      [first, afterFirst],
      [overlapsFirst],
    ]);
  });

  it('defaults a missing roomStayStart/End to the full retreat span', () => {
    const fullStay = { _id: 'full-stay' };
    const partial = { _id: 'partial', roomStayStart: '2026-10-13', roomStayEnd: '2026-10-15' };
    expect(packOccupantsIntoRows([fullStay, partial], retreat)).toEqual([[fullStay], [partial]]);
  });
});
