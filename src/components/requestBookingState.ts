const id = (value: any): string => typeof value === 'string' ? value.trim() : String(value?._id || value?.id || '');

export function requestBookingReferences(request: any): Map<string, any> {
  const bookings = new Map<string, any>();
  for (const value of [request.bookingId, ...(request.lineItems || []).map((item: any) => item.bookingId), ...(request.participantBookings || []).map((item: any) => item.bookingId)]) {
    if (id(value) && (!bookings.has(id(value)) || value?.bookingNumber)) bookings.set(id(value), value);
  }
  return bookings;
}

/** A booking's database relationship is authoritative; a missing display number
 * must never invite another booking. This is derived, not a persisted flag. */
export function requestBookingState(request: any): 'linked' | 'waiting' | 'needed' | 'review' | 'none' {
  if (requestBookingReferences(request).size) return 'linked';
  if ((request.context && request.context !== 'retreat') || request.status === 'cancelled' || request.requestType === 'additional') return 'none';
  if (!id(request.clientId) || !id(request.retreatId) || !id(request._id)) return 'none';
  if (request.participantBookings?.length || new Set((request.lineItems || []).map((item: any) => id(item.clientId)).filter(Boolean)).size > 1 || request.requestType === 'balance') return 'review';
  return request.status === 'paid' ? 'needed' : 'waiting';
}
