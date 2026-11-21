import { paymentRequestFinancialSummary } from './bookingFinancialSummary';
import { toDateInputValue } from '../utils/dateFormat';

export const emptyRequestFilters = { clientName: '', retreatId: '', amountMin: '', amountMax: '', currency: '', dateFrom: '', dateTo: '' };
export type RequestFilters = typeof emptyRequestFilters;

export const requestFilterError = (filters: RequestFilters): string => {
  for (const value of [filters.amountMin, filters.amountMax]) {
    if (value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0)) return 'Enter a valid, non-negative requested amount.';
  }
  if (filters.amountMin !== '' && filters.amountMax !== '' && Number(filters.amountMin) > Number(filters.amountMax)) return 'Requested amount from must not exceed requested amount to.';
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) return 'Request date from must not be after request date to.';
  return '';
};

export const matchesRequestFilters = (request: any, filters: RequestFilters): boolean => {
  if (filters.retreatId && (request.context === 'standalone_service' || requestRetreatId(request) !== filters.retreatId)) return false;
  const client = request.clientId;
  const name = typeof client === 'object' && client ? `${client.firstName || ''} ${client.lastName || ''}`.trim().toLocaleLowerCase() : '';
  if (!name.includes(filters.clientName.trim().toLocaleLowerCase())) return false;
  const financials = paymentRequestFinancialSummary(request);
  if (filters.currency && financials.currency !== filters.currency) return false;
  if (filters.amountMin !== '' && financials.requested < Number(filters.amountMin)) return false;
  if (filters.amountMax !== '' && financials.requested > Number(filters.amountMax)) return false;
  if (filters.dateFrom || filters.dateTo) {
    const date = toDateInputValue(request.paymentDate);
    if (!date || (filters.dateFrom && date < filters.dateFrom) || (filters.dateTo && date > filters.dateTo)) return false;
  }
  return true;
};


/** The request's saved retreat is authoritative; never infer a client's latest booking. */
export const requestRetreatId = (request: any): string => {
  const retreat = request.retreatId;
  return typeof retreat === 'string' ? retreat : String(retreat?._id || retreat?.id || '');
};

export const requestRetreatOptions = (requests: any[]): Array<{ value: string; label: string }> => {
  const options = new Map<string, { value: string; label: string; score: number }>();
  for (const request of requests) {
    if (request.context === 'standalone_service') continue;
    const value = requestRetreatId(request);
    if (!value) continue;
    const retreat = request.retreatId;
    const parts = typeof retreat === 'object' ? [...new Set([retreat.retreatCode || retreat.code, retreat.name].filter(Boolean))] : [];
    const date = typeof retreat === 'object' ? toDateInputValue(retreat.startDate) : '';
    if (date) parts.push(date);
    const score = parts.length;
    const label = parts.length ? parts.join(' · ') : `Retreat ${value}`;
    if (!options.has(value) || score > options.get(value)!.score) options.set(value, { value, label, score });
  }
  const labels = new Map<string, number>();
  for (const { label } of options.values()) labels.set(label, (labels.get(label) || 0) + 1);
  return [...options.values()].sort((a, b) => a.label.localeCompare(b.label) || a.value.localeCompare(b.value)).map(({ value, label }) => ({ value, label: labels.get(label)! > 1 ? `${label} · ID ${value}` : label }));
};
