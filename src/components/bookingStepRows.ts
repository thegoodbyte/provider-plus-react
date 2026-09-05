import { BookingFlowItem, BookingFlowTemplate } from '../types';
import { titleizeBookingStepGroup } from '../utils/bookingStepColors';
import { getStepItemGroup, getStepTemplateGroup } from './bookingStepPresentation';

export const DEFAULT_REQUIREMENT_STEP_KEYS = new Set([
  'contract_signed', 'ekg_received', 'liver_received', 'medications_form_initial_received',
  'medications_form_30_day_received', 'questionnaire_received', 'food_form_received', 'payment_balance_due',
]);

export const isConfiguredRequirementStep = (key: string, value?: { isRequirement?: boolean; requiredFromClient?: boolean; requirementType?: string }) =>
  Boolean(value?.isRequirement || value?.requiredFromClient || value?.requirementType || DEFAULT_REQUIREMENT_STEP_KEYS.has(key));

export interface BookingStepMatrixRow {
  key: string;
  title: string;
  order: number;
  category?: BookingFlowTemplate['category'] | BookingFlowItem['category'];
  groupKey: string;
  groupLabel: string;
  groupColor?: string;
  templateId?: string;
  emailEnabled?: boolean;
  emailTemplateId?: BookingFlowTemplate['emailTemplateId'];
  /** True when this step is configured as a client requirement. */
  isRequirement?: boolean;
  stepType?: BookingFlowTemplate['stepType'];
}

export interface BookingStepMatrixRowGroup {
  key: string;
  label: string;
  color?: string;
  rows: BookingStepMatrixRow[];
}

export const buildBookingStepRows = (templates: BookingFlowTemplate[], items: BookingFlowItem[]): BookingStepMatrixRow[] => {
  const rowMap = new Map<string, BookingStepMatrixRow>();
  templates.forEach((template) => {
    if (template.active === false) return;
    rowMap.set(template.key, {
      key: template.key,
      title: template.title,
      order: template.order || 0,
      category: template.category,
      ...getStepTemplateGroup(template),
      templateId: template._id,
      emailEnabled: template.emailEnabled,
      emailTemplateId: template.emailTemplateId,
      isRequirement: isConfiguredRequirementStep(template.key, template),
      stepType: template.stepType,
    });
  });
  items.forEach((item) => {
    const template = typeof item.templateId === 'object' ? item.templateId : null;
    const existing = rowMap.get(item.key);
    // A populated template that's since been deactivated shouldn't manufacture
    // a row on its own -- but if some other still-active template (or a fully
    // custom item with no template at all) already claimed this key, leave it
    // alone rather than erasing it.
    if (!existing && template && template.active === false) return;
    rowMap.set(item.key, {
      ...existing,
      key: item.key,
      title: item.title,
      order: item.order || 0,
      category: item.category || existing?.category || template?.category,
      ...getStepItemGroup(item, template || existing),
      templateId: existing?.templateId || template?._id || (typeof item.templateId === 'string' ? item.templateId : undefined),
      emailEnabled: existing?.emailEnabled || item.emailEnabled || template?.emailEnabled,
      emailTemplateId: existing?.emailTemplateId || item.emailTemplateId || template?.emailTemplateId,
      isRequirement: Boolean(existing?.isRequirement || isConfiguredRequirementStep(item.key, template || undefined) || item.metadata?.isRequirement || item.metadata?.requiredFromClient || item.metadata?.requirementType),
      stepType: template?.stepType || existing?.stepType,
    });
  });
  return Array.from(rowMap.values()).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
};

export const groupBookingStepRows = (rows: BookingStepMatrixRow[]): BookingStepMatrixRowGroup[] => {
  const groups = new Map<string, BookingStepMatrixRowGroup>();
  rows.forEach((row) => {
    const groupKey = row.groupKey || row.category || 'other';
    const current = groups.get(groupKey) || { key: groupKey, label: row.groupLabel || titleizeBookingStepGroup(groupKey), rows: [] };
    if (!current.color && row.groupColor) current.color = row.groupColor;
    current.rows.push(row);
    groups.set(groupKey, current);
  });
  return Array.from(groups.values());
};

export const filterBookingStepRowGroups = (groups: BookingStepMatrixRowGroup[], selectedKeys: string[] | null): BookingStepMatrixRowGroup[] => {
  if (selectedKeys === null) return groups;
  const selected = new Set(selectedKeys);
  return groups.map((group) => ({ ...group, rows: group.rows.filter((row) => selected.has(row.key)) })).filter((group) => group.rows.length > 0);
};

export const searchBookingStepRows = (rows: BookingStepMatrixRow[], search: string): BookingStepMatrixRow[] => {
  const query = search.trim().toLowerCase();
  return rows.filter((row) => row.title.toLowerCase().includes(query));
};

export const numberBookingStepRows = (rows: BookingStepMatrixRow[]): Map<string, number> => new Map(rows.map((row, index) => [row.key, index + 1]));
