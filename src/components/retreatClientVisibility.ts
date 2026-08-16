/** Cancelled bookings are never part of the active Retreat Clients view. */
export const isCancelledBookingStatus = (status?: unknown) =>
  ['cancelled', 'canceled'].includes(String(status || '').trim().toLowerCase());

export const activeRetreatClients = <T extends { status?: unknown }>(clients: T[]) =>
  clients.filter((client) => !isCancelledBookingStatus(client.status));
