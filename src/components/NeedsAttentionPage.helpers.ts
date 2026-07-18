export type AttentionSeverity = 'overdue' | 'blocked' | 'problem' | 'due_soon';

export interface AttentionItem {
  id: string;
  category: 'Booking step' | 'Document' | 'Payment' | 'Contract' | 'Medical review' | 'Follow-up';
  title: string;
  detail: string;
  retreat: string;
  client: string;
  dueDate?: string;
  severity: AttentionSeverity;
  href: string;
}

const severityRank: Record<AttentionSeverity, number> = { overdue: 0, blocked: 1, problem: 2, due_soon: 3 };
const COMPLETE = new Set(['completed', 'complete', 'approved', 'paid', 'received', 'dismissed', 'cancelled', 'canceled', 'voided']);

export const isCompleteStatus = (status: unknown) => COMPLETE.has(String(status || '').toLowerCase());

export const classifyAttention = (status: unknown, dueDate?: string, now = new Date()): AttentionSeverity => {
  const normalized = String(status || '').toLowerCase();
  if (['blocked', 'rejected', 'declined', 'failed'].includes(normalized)) return 'blocked';
  if (['problem', 'caution', 'needs_info', 'more_info_needed', 'needs_resubmission', 'overdue'].includes(normalized)) {
    return normalized === 'overdue' ? 'overdue' : 'problem';
  }
  if (dueDate && new Date(dueDate).getTime() < now.getTime()) return 'overdue';
  return 'due_soon';
};

export const sortAttentionItems = (items: AttentionItem[]) => [...items].sort((a, b) => {
  const severity = severityRank[a.severity] - severityRank[b.severity];
  if (severity) return severity;
  const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
  const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
  return aDate - bDate || a.title.localeCompare(b.title);
});

export const entityId = (value: any): string => String(value?._id || value || '');
export const entityLabel = (value: any, fallback = '—'): string => value?.name || value?.retreatCode || value?.code || fallback;
export const clientLabel = (value: any): string => {
  if (!value || typeof value === 'string') return '—';
  return [value.firstName, value.lastName].filter(Boolean).join(' ') || (value.display_id ? `Client #${value.display_id}` : '—');
};
