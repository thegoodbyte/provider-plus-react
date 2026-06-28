const calendarDatePattern = /^(\d{4})-(\d{2})-(\d{2})(?:$|T00:00:00(?:\.\d{3})?Z?$)/;

export const parseCalendarDate = (value?: string | Date | null): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const match = String(value).match(calendarDatePattern);
  if (match) {
    const [, year, month, day] = match;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatCalendarDate = (
  value?: string | Date | null,
  locale?: string,
  options?: Intl.DateTimeFormatOptions,
) => {
  const date = parseCalendarDate(value);
  return date ? date.toLocaleDateString(locale, options) : 'N/A';
};

export const toDateInputValue = (value?: string | Date | null) => {
  const date = parseCalendarDate(value);
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const todayDateInputValue = () => toDateInputValue(new Date());
