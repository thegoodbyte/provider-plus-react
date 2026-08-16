import { BookingFlowAction, BookingFlowItem } from '../types';
import { getBookingStepClientEmail, getBookingStepObjectId } from './bookingStepIdentity';
import { normalizeBookingStepKey } from './bookingStepActions';
import { BookingStepMatrixRow } from './bookingStepRows';
import { isSatisfiedStatus } from './bookingStatusSelectors';

export const bookingDocumentTypeByStep: Record<string, string> = {
  contract_signed: 'contract',
  contract_received: 'contract',
  client_agreement_received: 'contract',
  ekg_received: 'ekg',
  liver_received: 'liver_panel',
  questionnaire_received: 'questionnaire',
};

export const humanizeBookingStepDocumentKey = (value: string) => value.split(/[_-]+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');

export const getLinkedBookingStepArtifactId = (item?: BookingFlowItem): string => {
  const metadata = item?.metadata || {};
  const direct = metadata.latestArtifactId || metadata.linkedMedicalArtifactId || metadata.receivedArtifactId;
  if (direct) return String(direct);
  const ids = metadata.linkedMedicalArtifactIds;
  return Array.isArray(ids) && ids.length > 0 ? String(ids[ids.length - 1]) : '';
};

export const interpolateBookingStepActionUrl = (template: string, variables: Record<string, any> = {}) => template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, path) => {
  const value = String(path).split('.').reduce((current: any, key: string) => current?.[key], variables);
  return encodeURIComponent(value ?? '');
});

export const resolveBookingStepDocumentType = (item: Pick<BookingFlowItem, 'key' | 'metadata'>): string => {
  const metadata = item.metadata || {};
  return normalizeBookingStepKey(bookingDocumentTypeByStep[item.key] || metadata.expectedBookingDocument || metadata.expectedDocument || metadata.expectedArtifact || item.key);
};

export const resolveConfiguredBookingStepDocumentType = (item: Pick<BookingFlowItem, 'key' | 'metadata'>, hasArtifactConfig: boolean): string => {
  const metadata = item.metadata || {};
  return normalizeBookingStepKey(bookingDocumentTypeByStep[item.key] || metadata.expectedBookingDocument || metadata.expectedDocument || (!hasArtifactConfig ? metadata.expectedArtifact : '') || '');
};

export const canSendBookingStepReminder = (item: BookingFlowItem | undefined, bookings: any[]): boolean => Boolean(item?._id && !isSatisfiedStatus(item.status) && getBookingStepClientEmail(bookings.find((booking) => getBookingStepObjectId(booking) === getBookingStepObjectId(item.bookingId))));
export const canSendBookingStepRowEmail = (row: BookingStepMatrixRow): boolean => Boolean(row.templateId && row.emailEnabled && row.emailTemplateId);

export type BookingStepActionOption = { value: string; label: string; rowKey: string; actionKey: string };
export const buildBookingStepActionOptions = (items: BookingFlowItem[], getActions: (item: BookingFlowItem) => BookingFlowAction[]): BookingStepActionOption[] => {
  const seen = new Set<string>();
  const options: BookingStepActionOption[] = [];
  items.forEach((item) => getActions(item).forEach((action) => {
    const value = `${item.key}::${action.key}`;
    if (seen.has(value)) return;
    seen.add(value);
    options.push({ value, rowKey: item.key, actionKey: action.key, label: `${item.title} · ${action.label}` });
  }));
  return options;
};
