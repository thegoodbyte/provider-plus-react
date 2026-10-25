/** Calendar-day arithmetic shared by save and retreat rescheduling. Months clamp to month end. */
export function preparationDate(start: Date, raw: { daysBeforeRetreat?: any; monthsBeforeRetreat?: any; dueDate?: any }): Date {
  const present = (value: any) => value !== undefined && value !== null && value !== '';
  const days = present(raw.daysBeforeRetreat);
  const months = present(raw.monthsBeforeRetreat);
  if (days && months) throw new Error('Choose days or calendar months, not both');
  if (Number.isNaN(start.getTime())) throw new Error('The booking retreat needs a start date');
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(start);
  const part = (type: string) => Number(parts.find(item => item.type === type)?.value);
  const due = new Date(Date.UTC(part('year'), part('month') - 1, part('day')));
  if (days || months) {
    const amount = Number(months ? raw.monthsBeforeRetreat : raw.daysBeforeRetreat);
    if (!Number.isSafeInteger(amount) || amount < 0 || amount > (months ? 120 : 3650)) throw new Error('Preparation offset must be a non-negative whole number within ten years');
    if (months) {
      const day = due.getUTCDate();
      due.setUTCDate(1);
      due.setUTCMonth(due.getUTCMonth() - amount);
      const last = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth() + 1, 0)).getUTCDate();
      due.setUTCDate(Math.min(day, last));
    } else due.setUTCDate(due.getUTCDate() - amount);
  } else if (raw.dueDate) {
    const parsed = new Date(raw.dueDate);
    if (Number.isNaN(parsed.getTime())) throw new Error('Invalid preparation date');
    return parsed;
  }
  if (Number.isNaN(due.getTime())) throw new Error('The booking retreat needs a start date');
  return due;
}
