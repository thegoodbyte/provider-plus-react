import { BookingFlowAction, BookingFlowItem, BookingFlowTemplate } from '../types';

export const normalizeBookingStepKey = (value?: string) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const objectId = (value: any) => typeof value === 'string' ? value : value?._id || value?.id || '';

export const resolveConfiguredBookingStepActions = (
  item: BookingFlowItem | undefined,
  templateMap: Map<string, BookingFlowTemplate>,
  libraryTemplateMap: Map<string, BookingFlowTemplate>,
): BookingFlowAction[] => {
  if (!item) return [];
  const template = typeof item.templateId === 'object' ? item.templateId : templateMap.get(objectId(item.templateId)) || templateMap.get(item.key) || null;
  const libraryTemplate = libraryTemplateMap.get(item.key) || null;
  const metadataActions = item.metadata?.actions;
  const templateActions = template?.actions;
  const libraryActions = libraryTemplate?.actions;
  const configured = Array.isArray(item.actions) && item.actions.length
    ? item.actions
    : Array.isArray(metadataActions) && metadataActions.length
      ? metadataActions as BookingFlowAction[]
      : Array.isArray(templateActions) && templateActions.length
        ? templateActions
        : Array.isArray(libraryActions) ? libraryActions : [];
  const actions = configured.filter(action => action.active !== false).map(action => ({ ...action }));
  const fallbackEmailTemplateId = item.emailTemplateId || template?.emailTemplateId || libraryTemplate?.emailTemplateId;
  const hasLegacyEmail = Boolean((item.emailEnabled || template?.emailEnabled || libraryTemplate?.emailEnabled) && fallbackEmailTemplateId);
  if (hasLegacyEmail && !actions.some(action => action.type === 'email' && action.emailTemplateId)) actions.unshift({ key: 'default_email', label: 'Send email', type: 'email', emailTemplateId: fallbackEmailTemplateId, statusAfterSuccess: 'sent', allowRepeat: true, openComposer: true, order: -1 });
  const contractSent = normalizeBookingStepKey(item.key) === 'contract_sent' || /\bcontract\b.*\bsent\b/i.test(item.title || '');
  if (contractSent && !actions.some(action => action.type === 'email')) actions.unshift({ key: 'send_contract', label: 'Send contract', type: 'email', statusAfterSuccess: 'sent', allowRepeat: true, openComposer: true, order: -2 });
  return actions.sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
};
