import { BookingFlowItem } from '../types';

export type BookingStepDeadlinesFilters = {
  search: string;
  retreatId: string;
  stepKey: string;
  dateFrom: string;
  dateTo: string;
};

export type BookingStepDeadlineRow = {
  id: string;
  index: number;
  dueDateKey: string;
  dueDateLabel: string;
  stepTitle: string;
  stepKey: string;
  stepCategory: string;
  retreatId: string;
  retreatLabel: string;
  retreatName: string;
  bookingId: string;
  bookingLabel: string;
  clientId: string;
  clientLabel: string;
  status: string;
  notes: string;
  searchText: string;
  dueDate?: string | Date | null;
  sourceItem: BookingFlowItem;
};

type AnyRecord = Record<string, any>;

const asRecord = (value: unknown): AnyRecord | null => {
  if (!value || typeof value !== 'object') return null;
  return value as AnyRecord;
};

const getEntityId = (value: unknown): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  const record = asRecord(value);
  return String(record?._id || record?.id || '');
};

const getText = (...values: Array<unknown>): string => values
  .map((value) => (value === null || value === undefined ? '' : String(value).trim()))
  .find(Boolean) || '';

export const formatDateKey = (value?: string | Date | null): string => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateLabel = (value?: string | Date | null): string => {
  if (!value) return 'No due date';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'No due date';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
};

const getClientLabel = (client: unknown): string => {
  const record = asRecord(client);
  const firstName = getText(record?.firstName);
  const lastName = getText(record?.lastName);
  const displayId = getText(record?.display_id, record?.displayId, record?.clientNumber);
  const name = [firstName, lastName].filter(Boolean).join(' ').trim();
  return [name || 'Unknown client', displayId ? `#${displayId}` : ''].filter(Boolean).join(' ');
};

const getBookingLabel = (booking: unknown, fallbackItem: BookingFlowItem): string => {
  const record = asRecord(booking);
  const displayId = getText(
    record?.display_id,
    record?.displayId,
    record?.bookingNumber,
    record?.number,
    asRecord(fallbackItem.bookingId)?.display_id,
    asRecord(fallbackItem.bookingId)?.displayId,
    asRecord(fallbackItem.bookingId)?.bookingNumber,
  );

  if (displayId) return `#${displayId}`;
  const rawBookingId = getEntityId(fallbackItem.bookingId);
  return rawBookingId ? `#${rawBookingId.slice(-6)}` : 'Booking';
};

const getRetreatLabel = (retreat: unknown): string => {
  const record = asRecord(retreat);
  const code = getText(record?.code, record?.retreatCode);
  const name = getText(record?.name);
  const location = getText(record?.location_town, record?.locationTown, record?.location);
  const primary = code || name || 'Unknown retreat';
  const secondary = [name && name !== primary ? name : '', location && location !== name ? location : '']
    .filter(Boolean)
    .join(' • ');
  return secondary ? `${primary} (${secondary})` : primary;
};

const buildSearchText = (row: BookingStepDeadlineRow): string => [
  row.stepTitle,
  row.stepKey,
  row.stepCategory,
  row.retreatLabel,
  row.retreatName,
  row.bookingLabel,
  row.clientLabel,
  row.status,
  row.notes,
  row.dueDateLabel,
  row.dueDateKey,
].join(' ').toLowerCase();

export const buildBookingStepDeadlineRows = (items: BookingFlowItem[]): BookingStepDeadlineRow[] => {
  return [...items]
    .sort((left, right) => {
      const leftDate = left.dueDate ? new Date(left.dueDate).getTime() : Number.POSITIVE_INFINITY;
      const rightDate = right.dueDate ? new Date(right.dueDate).getTime() : Number.POSITIVE_INFINITY;
      if (leftDate !== rightDate) return leftDate - rightDate;

      const leftOrder = left.order ?? 0;
      const rightOrder = right.order ?? 0;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;

      return String(left.title || '').localeCompare(String(right.title || ''));
    })
    .map((item, index) => {
      const booking = asRecord(item.bookingId);
      const client = asRecord(item.clientId);
      const retreat = asRecord(item.retreatId);
      const retreatLabel = getRetreatLabel(retreat);
      const retreatName = getText(retreat?.name, retreat?.code, retreat?.retreatCode);
      const dueDateLabel = formatDateLabel(item.dueDate);
      const dueDateKey = formatDateKey(item.dueDate);
      const stepTitle = getText(item.title, item.key);
      const stepKey = getText(item.key);
      const stepCategory = getText(item.category);
      const clientLabel = getClientLabel(client);
      const bookingLabel = getBookingLabel(booking, item);
      const notes = getText(item.notes, item.reviewNotes);
      const row: BookingStepDeadlineRow = {
        id: item._id || item.key || `${index}`,
        index: index + 1,
        dueDateKey,
        dueDateLabel,
        stepTitle,
        stepKey,
        stepCategory,
        retreatId: getEntityId(item.retreatId),
        retreatLabel,
        retreatName,
        bookingId: getEntityId(item.bookingId),
        bookingLabel,
        clientId: getEntityId(item.clientId),
        clientLabel,
        status: getText(item.status),
        notes,
        searchText: '',
        dueDate: item.dueDate || null,
        sourceItem: item,
      };
      row.searchText = buildSearchText(row);
      return row;
    });
};

export const filterBookingStepDeadlineRows = (
  rows: BookingStepDeadlineRow[],
  filters: BookingStepDeadlinesFilters,
): BookingStepDeadlineRow[] => {
  const search = filters.search.trim().toLowerCase();

  return rows.filter((row) => {
    if (filters.retreatId && row.retreatId !== filters.retreatId) return false;
    if (filters.stepKey && row.stepKey !== filters.stepKey) return false;
    if (filters.dateFrom && (!row.dueDateKey || row.dueDateKey < filters.dateFrom)) return false;
    if (filters.dateTo && (!row.dueDateKey || row.dueDateKey > filters.dateTo)) return false;
    if (search && !row.searchText.includes(search)) return false;
    return true;
  });
};

export const getBookingStepDeadlinesSummary = (rows: BookingStepDeadlineRow[]) => {
  const now = new Date();
  const currentKey = formatDateKey(now);
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekKey = formatDateKey(nextWeek);

  return {
    total: rows.length,
    dueSoon: rows.filter((row) => row.dueDateKey && row.dueDateKey >= currentKey && row.dueDateKey <= nextWeekKey).length,
    overdue: rows.filter((row) => row.dueDateKey && row.dueDateKey < currentKey && !['completed', 'approved', 'reviewed', 'received', 'waived'].includes((row.status || '').toLowerCase())).length,
    retreats: new Set(rows.map((row) => row.retreatId).filter(Boolean)).size,
  };
};
