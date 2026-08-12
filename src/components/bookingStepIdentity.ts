import { Client, Payment } from '../types';

export const getBookingStepObjectId = (value: any): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value._id || value.id || '';
};

export const getBookingStepClient = (booking: any): Client | null => {
  const client = booking?.clientId || booking?.client || null;
  return client && typeof client === 'object' ? client : null;
};

export const getBookingStepClientName = (booking: any): string => {
  const client = booking?.clientId || booking?.client || {};
  if (typeof client === 'object') {
    const name = [client.firstName || client.fname, client.lastName || client.lname].filter(Boolean).join(' ');
    return name || client.email || `Client ${getBookingStepObjectId(booking).slice(-6)}`;
  }
  return `Client ${String(client || getBookingStepObjectId(booking)).slice(-6)}`;
};

export const getBookingStepNumber = (booking: any): string => booking?.bookingNumber || booking?.displayNumber || getBookingStepObjectId(booking).slice(-6);
export const getBookingStepClientId = (booking: any): string => getBookingStepObjectId(booking?.clientId || booking?.client);
export const getBookingStepPaymentClientId = (payment: Payment): string => getBookingStepObjectId(payment.clientId);
export const getBookingStepClientDisplayId = (booking: any): string => String(getBookingStepClient(booking)?.display_id || booking?.clientDisplayId || booking?.clientDisplayNumber || '');
export const getBookingStepClientEmail = (booking: any): string => getBookingStepClient(booking)?.email || booking?.clientEmail || '';
export const getBookingStepClientPhone = (booking: any): string => {
  const client = getBookingStepClient(booking) as any;
  return [client?.phoneCountryCode, client?.phone || booking?.clientPhone].filter(Boolean).join(' ');
};
