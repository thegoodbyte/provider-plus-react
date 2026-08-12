import { BookingDocument, BookingFlowActionLog, BookingFlowItem, BookingFlowTemplate, Payment } from '../types';
import { normalizeBookingStepKey } from './bookingStepActions';
import { getBookingStepObjectId, getBookingStepPaymentClientId } from './bookingStepIdentity';

export const indexBookingStepItems = (items: BookingFlowItem[]) => new Map(items.map((item) => [`${getBookingStepObjectId(item.bookingId)}:${item.key}`, item]));

export const indexBookingStepTemplates = (templates: BookingFlowTemplate[]) => {
  const map = new Map<string, BookingFlowTemplate>();
  templates.forEach((template) => {
    if (template._id) map.set(template._id, template);
    if (template.key) map.set(template.key, template);
  });
  return map;
};

export const indexBookingStepActionLogs = (logs: BookingFlowActionLog[]) => {
  const map = new Map<string, BookingFlowActionLog[]>();
  logs.forEach((log) => {
    const itemId = getBookingStepObjectId(log.bookingFlowItemId);
    if (!itemId) return;
    map.set(itemId, [...(map.get(itemId) || []), log]);
  });
  map.forEach((values) => values.sort((a, b) => new Date(b.performedAt || b.createdAt || 0).getTime() - new Date(a.performedAt || a.createdAt || 0).getTime()));
  return map;
};

export const indexBookingStepDocuments = (documents: BookingDocument[]) => {
  const map = new Map<string, BookingDocument[]>();
  documents.forEach((document) => {
    const bookingId = getBookingStepObjectId(document.bookingId);
    const documentType = normalizeBookingStepKey(document.documentType);
    if (!bookingId || !documentType || (document.files || []).length === 0) return;
    const key = `${bookingId}:${documentType}`;
    map.set(key, [...(map.get(key) || []), document]);
  });
  map.forEach((values) => values.sort((a, b) => new Date(b.receivedAt || b.createdAt || 0).getTime() - new Date(a.receivedAt || a.createdAt || 0).getTime()));
  return map;
};

export const indexBookingStepPayments = (payments: Payment[]) => {
  const map = new Map<string, Payment[]>();
  payments.forEach((payment) => {
    const clientId = getBookingStepPaymentClientId(payment);
    if (!clientId) return;
    map.set(clientId, [...(map.get(clientId) || []), payment]);
  });
  map.forEach((values) => values.sort((a, b) => new Date(b.paymentDate || 0).getTime() - new Date(a.paymentDate || 0).getTime()));
  return map;
};
