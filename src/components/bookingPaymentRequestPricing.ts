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
  if (String(request?.requestType || '').toLowerCase() === 'additional') return undefined;
  const lines = bookingPriceLinesForClient(request, clientId);
  const explicitlyAssignedLines = (request?.lineItems || []).filter(line => id(line.clientId) === clientId);

  // Deposit/balance/installment requests contain line items for the amount
  // being requested now (for example 4,000 PLN), while fullPrice is the
  // agreed retreat price (for example 9,445 PLN). A booking must use the
  // latter; otherwise creating a booking from a deposit makes the booking
  // permanently short by the deposit or by an arbitrary line-item adjustment.
  if (['deposit', 'balance', 'installment'].includes(String(request?.requestType || '').toLowerCase())) {
    return Number(request?.fullPriceQuote || request?.fullPrice || 0) || undefined;
  }

  // Itemized joint/full-payment requests may explicitly assign a price to a
  // client. Preserve that allocation, but never use an ambiguous combined
  // receipt for one booking.
  if (explicitlyAssignedLines.length) return explicitlyAssignedLines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
  if (lines.length) return lines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
  if ((request?.lineItems || []).filter(line => line.type === 'charge').length > 1) return undefined;
  return Number(request?.fullPriceQuote || request?.fullPrice || 0) || undefined;
};

export const paymentRequestLineTotal = (lines: PaymentRequestLineItem[]) =>
  lines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
