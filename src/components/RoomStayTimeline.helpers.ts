const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight-UTC timestamp for a date-only or ISO string. */
export const utcDay = (value: string | Date): number => {
  const d = new Date(value);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

/** Night-count between two dates (checkout - checkin, in nights). */
export const nightsBetween = (start: string | Date, end: string | Date): number =>
  Math.round((utcDay(end) - utcDay(start)) / DAY_MS);

/**
 * Clamp an occupant's stay to the retreat range and express it as a
 * 0-100% left-offset/width pair for absolute positioning inside a timeline
 * track. An occupant with no override spans the full retreat.
 */
export function staySegment(
  retreat: { startDate: string | Date; endDate: string | Date },
  occupant: { roomStayStart?: string | Date | null; roomStayEnd?: string | Date | null },
): { leftPct: number; widthPct: number; nights: number } {
  const totalNights = Math.max(1, nightsBetween(retreat.startDate, retreat.endDate));
  const rawStart = occupant.roomStayStart || retreat.startDate;
  const rawEnd = occupant.roomStayEnd || retreat.endDate;
  const startOffset = Math.min(totalNights, Math.max(0, nightsBetween(retreat.startDate, rawStart)));
  const endOffset = Math.min(totalNights, Math.max(startOffset, nightsBetween(retreat.startDate, rawEnd)));
  return {
    leftPct: (startOffset / totalNights) * 100,
    widthPct: Math.max(((endOffset - startOffset) / totalNights) * 100, 100 / totalNights / 2),
    nights: endOffset - startOffset,
  };
}

/** One tick per night boundary, for the day-ruler above the bars. */
export function dayTicks(retreat: { startDate: string | Date; endDate: string | Date }) {
  const totalNights = Math.max(1, nightsBetween(retreat.startDate, retreat.endDate));
  const startMs = utcDay(retreat.startDate);
  return Array.from({ length: totalNights + 1 }, (_, index) => {
    const date = new Date(startMs + index * DAY_MS);
    return {
      date,
      pct: (index / totalNights) * 100,
      label: new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: '2-digit', timeZone: 'UTC' }).format(date),
    };
  });
}

/** Stable color index so the same occupant keeps its color across re-renders. */
export const occupantColorIndex = (occupantId: string, paletteSize: number): number => {
  let hash = 0;
  for (const char of occupantId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % paletteSize;
};

/** Adds whole nights to a date, returned as a YYYY-MM-DD string. */
export const addNights = (start: string | Date, nights: number): string => {
  const date = new Date(utcDay(start) + nights * DAY_MS);
  return date.toISOString().slice(0, 10);
};

/**
 * Greedily packs occupants into the minimum number of rows so that two
 * occupants sharing a row never overlap in time -- sequential stays in the
 * same room (e.g. one booster after another) share a row, concurrent stays
 * (two occupants at once) get separate rows. Occupants are placed in the
 * first row whose last occupant has already checked out by this one's
 * check-in; a shared check-out/check-in day counts as non-overlapping.
 */
export function packOccupantsIntoRows<
  T extends { roomStayStart?: string | Date | null; roomStayEnd?: string | Date | null },
>(occupants: T[], retreat: { startDate: string | Date; endDate: string | Date }): T[][] {
  const sorted = [...occupants].sort(
    (a, b) => utcDay(a.roomStayStart || retreat.startDate) - utcDay(b.roomStayStart || retreat.startDate),
  );
  const rows: T[][] = [];
  const rowEnds: number[] = [];
  for (const occupant of sorted) {
    const start = utcDay(occupant.roomStayStart || retreat.startDate);
    const end = utcDay(occupant.roomStayEnd || retreat.endDate);
    const rowIndex = rowEnds.findIndex((rowEnd) => rowEnd <= start);
    if (rowIndex === -1) {
      rows.push([occupant]);
      rowEnds.push(end);
    } else {
      rows[rowIndex].push(occupant);
      rowEnds[rowIndex] = end;
    }
  }
  return rows;
}
