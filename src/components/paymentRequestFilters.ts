import { paymentRequestFinancialSummary } from './bookingFinancialSummary';
import { toDateInputValue } from '../utils/dateFormat';

export const emptyRequestFilters = { clientName: '', amountMin: '', amountMax: '', currency: '', dateFrom: '', dateTo: '' };
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
