import { paymentsApi } from '../services/api';
import { isCancelledBookingStatus } from './retreatClientVisibility';
export async function quoteBookingUsd(amount: number, currency: string): Promise<number | null> {
  if (currency.toUpperCase() === 'USD') return amount;
  try {
    const { data } = await paymentsApi.convertToUsd(amount, currency);
    return !data.unavailable && data.usd_amount !== null && Number.isFinite(data.usd_amount) ? data.usd_amount : null;
  } catch { return null; }
}
export function retreatExpectedUsd(clients: Array<{ status: string; totalAmountUSD: number | null }>): number | null {
  const active = clients.filter((client) => !isCancelledBookingStatus(client.status));
  if (active.some((client) => client.totalAmountUSD === null)) return null;
  return active.reduce((sum, client) => sum + (client.totalAmountUSD ?? 0), 0);
}
