import { BookingFlowItem } from '../types';
import { getStepStatusDateField } from './bookingStepPresentation';

export const buildBookingStepToggleUpdate = (checked: boolean, now = new Date()): Partial<BookingFlowItem> => ({
  status: checked ? 'completed' : 'pending',
  completedAt: checked ? now.toISOString() : null,
} as Partial<BookingFlowItem>);

export const shouldUpdateBookingStepStatus = (item: BookingFlowItem | undefined, status: BookingFlowItem['status']): item is BookingFlowItem & { _id: string } => Boolean(item?._id && item.status !== status);

export type BookingStepNoteUpdate = { itemId: string; notes: string };
export const buildBookingStepNoteUpdates = (items: BookingFlowItem[], dirtyNoteIds: Record<string, boolean>, noteDrafts: Record<string, string>): BookingStepNoteUpdate[] => Object.keys(dirtyNoteIds).flatMap((itemId) => {
  const item = items.find((candidate) => candidate._id === itemId);
  const notes = noteDrafts[itemId] || '';
  return !item || (item.notes || '') === notes ? [] : [{ itemId, notes }];
});

export const buildBookingStepDateUpdate = (item: BookingFlowItem, value: string) => {
  const field = getStepStatusDateField(item.status);
  return { field, payload: { [field]: value || null } as Partial<BookingFlowItem> };
};

export const applyBookingStepDateUpdate = (items: BookingFlowItem[], itemId: string, field: keyof BookingFlowItem | 'dueDate', value: string): BookingFlowItem[] => items.map((item) => item._id === itemId ? { ...item, [field]: value || null } : item);

export const removeBookingStepDateDraft = (drafts: Record<string, string>, itemId: string) => {
  const nextDrafts = { ...drafts };
  delete nextDrafts[itemId];
  return nextDrafts;
};
