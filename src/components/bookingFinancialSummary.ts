export type BookingFinancialSource = { totalAmount?: number | null; currency?: string | null; amountPaid?: number | null; totalAmountUsd?: number | null; totalAmountUSD?: number | null; amountPaidUsd?: number | null; amountPaidUSD?: number | null; grossReceived?: number | null; refundedAmount?: number | null; financialSummary?: Record<string, any> | null };
const money = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
export const bookingFinancialSummary = (booking?: BookingFinancialSource | null) => {
  if (booking?.financialSummary?.state) return booking.financialSummary as { price: number; currency: string; grossReceived: number; refunded: number; netPaid: number; balance: number; overpayment: number; paidInFull: boolean; state: 'unpaid' | 'partial' | 'paid' | 'overpaid' };
  const price = Math.max(0, money(booking?.totalAmount));
  const recordedNetPaid = money(booking?.amountPaid);
  const priceUsd = money(booking?.totalAmountUsd ?? booking?.totalAmountUSD);
  const paidUsd = money(booking?.amountPaidUsd ?? booking?.amountPaidUSD);
  const usdEquivalentPaid = priceUsd > 0 && paidUsd >= 0 ? (paidUsd / priceUsd) * price : 0;
  const netPaid = Math.max(recordedNetPaid, usdEquivalentPaid);
  const grossReceived = Math.max(netPaid, money(booking?.grossReceived));
  const refunded = Math.max(money(booking?.refundedAmount), grossReceived - netPaid, 0);
  const balance = Math.max(price - netPaid, 0);
  const overpayment = Math.max(netPaid - price, 0);
  const state = netPaid <= 0 ? 'unpaid' : overpayment > 0.005 ? 'overpaid' : balance <= 0.005 ? 'paid' : 'partial';
  return { price, currency: booking?.currency || 'EUR', grossReceived, refunded, netPaid, balance, overpayment, paidInFull: state === 'paid' || state === 'overpaid', state };
};
export const paymentRequestFinancialSummary = (request: any) => ({ requested: money(request?.requestedAmount ?? request?.amountPaid), quotedPrice: money(request?.fullPrice ?? request?.fullPriceQuote), currency: request?.currency || 'EUR' });
