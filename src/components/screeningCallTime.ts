export function callTimeInput(value: string | Date | null | undefined, timeZone: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('The saved call date is invalid.');
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23' }).formatToParts(date);
  const fields = Object.fromEntries(parts.map(part => [part.type,part.value]));
  return `${fields.year}-${fields.month}-${fields.day}T${fields.hour}:${fields.minute}`;
}

export function callTimeToIso(value: string, timeZone: string): string | null {
  // Validate timezone even when clearing an appointment.
  new Intl.DateTimeFormat('en', { timeZone }).format();
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Enter a valid call date and time.');
  const [year,month,day,hour,minute] = value.split(/[-T:]/).map(Number);
  const wall = Date.UTC(year,month-1,day,hour,minute);
  const offsets = new Set<number>();
  for (const delta of [-36,0,36]) {
    const instant = wall + delta*3600000;
    const [y,m,d,h,min] = callTimeInput(new Date(instant),timeZone).split(/[-T:]/).map(Number);
    offsets.add(Date.UTC(y,m-1,d,h,min)-instant);
  }
  const matches = [...offsets].map(offset => wall-offset).filter(instant => callTimeInput(new Date(instant),timeZone) === value);
  if (!matches.length) throw new Error('This date/time does not exist in the selected timezone. Check the date or daylight-saving change.');
  if (matches.length > 1) throw new Error('This time occurs twice when the clocks change. Choose an unambiguous call time.');
  return new Date(matches[0]).toISOString();
}
