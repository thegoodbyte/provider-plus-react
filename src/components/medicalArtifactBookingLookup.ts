import { RetreatClient } from '../types';

const getObjectId = (value: any) => typeof value === 'object' ? value?._id || value?.id : value;

export const bookingsBelongingToClient = (bookings: RetreatClient[], clientId: string) =>
  bookings.filter((booking) => String(getObjectId(booking.clientId) || '') === clientId);
