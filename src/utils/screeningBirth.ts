export function validateScreeningBirth(year?: number | null, month?: number | null, day?: number | null): string | undefined {
  const today = new Date();
  if (year != null && (!Number.isInteger(year) || year < 1900 || year > today.getFullYear())) return 'Enter a valid birth year between 1900 and the current year.';
  if (month != null && (!Number.isInteger(month) || month < 1 || month > 12)) return 'Enter a birth month from 1 to 12.';
  if (day != null && (!Number.isInteger(day) || day < 1 || day > 31)) return 'Enter a birth day from 1 to 31.';
  if ((month != null || day != null) && year == null) return 'Enter a birth year first.';
  if (day != null && month == null) return 'Enter a birth month before the day.';
  if (year != null && month != null) {
    const date = new Date(Date.UTC(year, month - 1, day ?? 1));
    if (date.getUTCMonth() !== month - 1) return 'Enter a valid date of birth.';
    if (date.toISOString().slice(0, 10) > `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`) return 'Date of birth cannot be in the future.';
  }
}
