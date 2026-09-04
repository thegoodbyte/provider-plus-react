import { BookingFlowItem } from '../types';

export const fulfilledBookingFlowStatuses = new Set<BookingFlowItem['status']>([
  'received',
  'reviewed',
  'approved',
  'caution',
  'completed',
]);

export interface BookingConfirmationRequirementRow {
  label: string;
  complete: boolean;
  deadline: Date | null;
  itemKey?: string;
  itemStatus?: BookingFlowItem['status'];
  manualDeadline?: boolean;
}

type RequirementMatch = {
  keys: string[];
  titleIncludes: string[];
  label: string;
  fallbackComplete: boolean;
  fallbackDeadline: Date | null;
  fulfilledStatuses: Set<BookingFlowItem['status']>;
};

const approvedMedicalStatuses = new Set<BookingFlowItem['status']>(['approved', 'waived']);

const findMatchingItem = (items: BookingFlowItem[], matcher: Pick<RequirementMatch, 'keys' | 'titleIncludes'>) => {
  const normalizedKeys = matcher.keys.map((key) => key.trim().toLowerCase());
  const normalizedTitleIncludes = matcher.titleIncludes.map((value) => value.trim().toLowerCase());

  return items.find((item) => {
    const key = String(item.key || '').trim().toLowerCase();
    const title = String(item.title || '').trim().toLowerCase();
    const description = String(item.description || '').trim().toLowerCase();
    const metadataRequirementType = String(item.metadata?.requirementType || '').trim().toLowerCase();

    return (
      normalizedKeys.includes(key)
      || normalizedKeys.includes(metadataRequirementType)
      || normalizedTitleIncludes.some((needle) => title.includes(needle) || description.includes(needle))
    );
  });
};

export const buildBookingConfirmationRequirementRows = (
  items: BookingFlowItem[] = [],
  fallbackDates?: {
    ekg?: Date | null;
    liver?: Date | null;
    contract?: Date | null;
  },
  fallbackCompletion?: {
    ekg?: boolean;
    liver?: boolean;
    contract?: boolean;
  },
): BookingConfirmationRequirementRow[] => {
  const matchers: RequirementMatch[] = [
    {
      keys: ['ekg_received', 'entry_ekg'],
      titleIncludes: ['ekg received', 'entry ekg'],
      label: 'EKG',
      fallbackComplete: !!fallbackCompletion?.ekg,
      fallbackDeadline: fallbackDates?.ekg ?? null,
      fulfilledStatuses: approvedMedicalStatuses,
    },
    {
      keys: ['liver_received', 'entry_liver_panel'],
      titleIncludes: ['liver panel received', 'entry liver panel'],
      label: 'Panel wątroby',
      fallbackComplete: !!fallbackCompletion?.liver,
      fallbackDeadline: fallbackDates?.liver ?? null,
      fulfilledStatuses: approvedMedicalStatuses,
    },
    {
      keys: ['contract_signed'],
      titleIncludes: ['contract received', 'signed participant agreement'],
      label: 'Umowa uczestnika',
      fallbackComplete: !!fallbackCompletion?.contract,
      fallbackDeadline: fallbackDates?.contract ?? null,
      fulfilledStatuses: fulfilledBookingFlowStatuses,
    },
  ];

  return matchers.map((matcher) => {
    const item = findMatchingItem(items, matcher);
    const deadline = item?.dueDate ? new Date(item.dueDate) : matcher.fallbackDeadline;
    return {
      label: matcher.label,
      complete: item ? matcher.fulfilledStatuses.has(item.status) : matcher.fallbackComplete,
      deadline: deadline && !Number.isNaN(deadline.getTime()) ? deadline : null,
      itemKey: item?.key,
      itemStatus: item?.status,
      manualDeadline: !!item?.dueDateManuallyOverridden,
    };
  });
};

export const formatPaymentRequestDisplayLabel = (
  paymentRequest?: { invoiceNumber?: string; display_id?: number; _id?: string } | string | null
) => {
  if (!paymentRequest) return '';
  if (typeof paymentRequest === 'string') return paymentRequest.trim();

  return String(paymentRequest.invoiceNumber || paymentRequest.display_id || paymentRequest._id || '').trim();
};

export const buildBookingPriceRows = (booking: any) => {
  const summary = booking?.pricingSummary;
  if (summary?.basePrice == null) return [];
  return [
    { kind: 'base', label: 'base', amount: Number(summary.basePrice || 0) },
    ...(summary.adjustments || []).map((item: any) => ({
      kind: item.type === 'discount' ? 'discount' : 'addition',
      label: String(item.label || ''),
      amount: item.type === 'discount' ? -Math.abs(Number(item.amount || 0)) : Math.abs(Number(item.amount || 0)),
    })),
    { kind: 'total', label: 'total', amount: Number(summary.finalPrice ?? booking.totalAmount ?? 0) },
  ];
};
