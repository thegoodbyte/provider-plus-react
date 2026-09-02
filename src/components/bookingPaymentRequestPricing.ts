import { PaymentRequest, PaymentRequestLineItem } from '../types';

const id = (value: any) => typeof value === 'string' ? value : value?._id || value?.id || '';

export const bookingPriceLinesForClient = (request?: PaymentRequest, clientId?: string) => {
  const lines = request?.lineItems || [];
  if (!lines.length) return [];
  const explicitlyAssigned = lines.filter(line => id(line.clientId) === clientId);
  if (explicitlyAssigned.length) return explicitlyAssigned;
  const chargeLines = lines.filter(line => line.type === 'charge');
  return chargeLines.length === 1 ? lines : [];
};

export const bookingPriceFromPaymentRequest = (request?: PaymentRequest, clientId?: string) => {
  const lines = bookingPriceLinesForClient(request, clientId);
  if (lines.length) return lines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
  if ((request?.lineItems || []).filter(line => line.type === 'charge').length > 1) return undefined;
  return Number(request?.fullPriceQuote || request?.fullPrice || 0) || undefined;
};

export const paymentRequestLineTotal = (lines: PaymentRequestLineItem[]) =>
  lines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
