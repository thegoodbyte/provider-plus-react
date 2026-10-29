const DAY = 86400000;
export const plannerDay = (value: unknown): number | null => {
  const text = value instanceof Date ? (Number.isNaN(value.getTime()) ? '' : value.toISOString()) : String(value || '');
  const match = /^(\d{4}-\d{2}-\d{2})(?:$|T)/.exec(text);
  if (!match || (text.length > 10 && !Number.isFinite(Date.parse(text)))) return null;
  const time = Date.parse(`${match[1]}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === match[1] ? time : null;
};
export const plannerDate = (day: number) => new Date(day).toISOString().slice(0, 10);
export interface PlannerStay { id: string; bookingNumber: string; name: string; type: 'Full retreat' | 'Booster'; start: number; end: number; lane: number; room: string }
export interface PlannerIssue { id: string; bookingNumber: string; reason: string }
const ACTIVE = ['confirmed', 'checked-in', 'checked-out'];
const EXCLUDED = ['cancelled', 'canceled', 'moved', 'declined'];
export function buildStayPlanner(retreat: {startDate?: unknown; endDate?: unknown; capacity?: unknown}, bookings: any[]) {
  const start = plannerDay(retreat.startDate), end = plannerDay(retreat.endDate);
  const capacity = Number.isInteger(Number(retreat.capacity)) && Number(retreat.capacity) > 0 && Number(retreat.capacity) <= 500 ? Number(retreat.capacity) : null;
  const issues: PlannerIssue[] = [], tentative: PlannerIssue[] = [], outside: PlannerIssue[] = [], stays: PlannerStay[] = [];
  const error = start === null || end === null || end <= start ? 'Set valid retreat start and checkout dates to see the stay planner.' : end - start > 366 * DAY ? 'The stay planner supports retreat ranges of up to one year.' : '';
  if (error || start === null || end === null) return { error, capacity, days: [], lanes: [], stays, issues, tentative, outside, peak: 0, minimumFree: null, checkout: '' };
  const seen = new Set<string>();
  for (const booking of bookings) {
    const id = String(booking._id || booking.id || '');
    if (!id || seen.has(id) || EXCLUDED.includes(booking.status)) continue;
    seen.add(id);
    const bookingNumber = String(booking.bookingNumber || '—');
    if (!ACTIVE.includes(booking.status)) { tentative.push({id,bookingNumber,reason: `${booking.status || 'Status missing'} — not counted in confirmed occupancy`}); continue; }
    const booster = booking.bookingType === 'booster';
    if (booking.bookingType && !['full_retreat','booster'].includes(booking.bookingType)) { issues.push({id,bookingNumber,reason:'Booking type needs review'}); continue; }
    // Full-retreat attendance follows the retreat window, as room inventory does.
    // Generic check-in/out can be historical actual/registration timestamps.
    const rawStart = booking.roomStayStart || (booster ? booking.checkInDate : retreat.startDate);
    const rawEnd = booking.roomStayEnd || (booster ? booking.checkOutDate : retreat.endDate);
    const from = plannerDay(rawStart), to = plannerDay(rawEnd);
    if (from === null || to === null || to <= from) { issues.push({id,bookingNumber,reason:booster?'Booster arrival/checkout dates need review':'Arrival/checkout dates need review'}); continue; }
    if (to <= start || from >= end) { outside.push({id,bookingNumber,reason:'Stay is outside the retreat dates'}); continue; }
    const client = booking.clientId && typeof booking.clientId === 'object' ? booking.clientId : {};
    stays.push({id,bookingNumber,name:[client.firstName,client.lastName].filter(Boolean).join(' ') || 'Guest name unavailable',type:booster?'Booster':'Full retreat',start:Math.max(start,from),end:Math.min(end,to),lane:0,room:booking.roomNumber || ''});
  }
  stays.sort((a,b)=>a.start-b.start || b.end-a.end || a.bookingNumber.localeCompare(b.bookingNumber,undefined,{numeric:true}) || a.id.localeCompare(b.id));
  const laneEnds: number[] = [];
  for (const stay of stays) {
    const free = laneEnds.findIndex(last => last <= stay.start);
    stay.lane = free === -1 ? laneEnds.length : free;
    laneEnds[stay.lane] = stay.end;
  }
  const days = Array.from({length:(end-start)/DAY},(_,index)=>{
    const day=start+index*DAY, occupied=stays.filter(stay=>stay.start<=day && day<stay.end).length;
    return {date:plannerDate(day),day,occupied,free:capacity===null || issues.length ? null : Math.max(0,capacity-occupied),over:capacity===null?0:Math.max(0,occupied-capacity)};
  });
  const lanes = Array.from({length:Math.max(capacity || 0,laneEnds.length)},(_,index)=>({number:index+1,overflow:capacity!==null && index>=capacity,stays:stays.filter(stay=>stay.lane===index)}));
  return {error:'',capacity,days,lanes,stays,issues,tentative,outside,peak:Math.max(0,...days.map(day=>day.occupied)),minimumFree:capacity===null||issues.length?null:Math.min(...days.map(day=>day.free!)),checkout:plannerDate(end)};
}
