import { formatCalendarDate, parseCalendarDate, toDateInputValue, todayDateInputValue } from './dateFormat';

describe('parseCalendarDate', () => {
  it('extracts a bare YYYY-MM-DD as a local calendar date', () => {
    const date = parseCalendarDate('2026-09-12');
    expect(date).toEqual(new Date(2026, 8, 12));
  });

  it('extracts a UTC-midnight ISO string as the same local calendar date (reschedule/receipt/deadline bug)', () => {
    const date = parseCalendarDate('2026-09-12T00:00:00.000Z');
    expect(date).toEqual(new Date(2026, 8, 12));
  });

  it('passes an existing valid Date through unchanged', () => {
    const input = new Date(2026, 8, 12);
    expect(parseCalendarDate(input)).toBe(input);
  });

  it('returns null for a missing or invalid value', () => {
    expect(parseCalendarDate(undefined)).toBeNull();
    expect(parseCalendarDate(null)).toBeNull();
    expect(parseCalendarDate('not-a-date')).toBeNull();
    expect(parseCalendarDate(new Date(NaN))).toBeNull();
  });
});

describe('formatCalendarDate', () => {
  it('never shifts a retreat date a day earlier regardless of the browser timezone', () => {
    expect(formatCalendarDate('2026-09-12T00:00:00.000Z', 'en-US')).toBe(new Date(2026, 8, 12).toLocaleDateString('en-US'));
    expect(formatCalendarDate('2026-09-19T00:00:00.000Z', 'en-US')).toBe(new Date(2026, 8, 19).toLocaleDateString('en-US'));
  });

  it('honors custom Intl.DateTimeFormat options', () => {
    expect(formatCalendarDate('2026-09-12T00:00:00.000Z', 'en-US', { month: 'short', day: 'numeric' }))
      .toBe(new Date(2026, 8, 12).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  });

  it('returns "N/A" for a missing or invalid value', () => {
    expect(formatCalendarDate(undefined)).toBe('N/A');
    expect(formatCalendarDate('not-a-date')).toBe('N/A');
  });
});

describe('toDateInputValue / todayDateInputValue', () => {
  it('formats a calendar date as a YYYY-MM-DD input value', () => {
    expect(toDateInputValue('2026-09-12T00:00:00.000Z')).toBe('2026-09-12');
  });

  it('returns an empty string for a missing value', () => {
    expect(toDateInputValue(undefined)).toBe('');
  });

  it('returns a valid YYYY-MM-DD string for today', () => {
    expect(todayDateInputValue()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
