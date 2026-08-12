import { applyBookingStepDateUpdate, buildBookingStepDateUpdate, buildBookingStepNoteUpdates, buildBookingStepToggleUpdate, removeBookingStepDateDraft, shouldUpdateBookingStepStatus } from './bookingStepMutations';

describe('bookingStepMutations', () => {
  it('builds deterministic completed and pending toggle payloads', () => {
    const now = new Date('2026-08-12T12:00:00.000Z');
    expect(buildBookingStepToggleUpdate(true, now)).toEqual({ status: 'completed', completedAt: now.toISOString() });
    expect(buildBookingStepToggleUpdate(false, now)).toEqual({ status: 'pending', completedAt: null });
  });

  it('only updates an existing item when status changes', () => {
    expect(shouldUpdateBookingStepStatus({ _id: 'i', status: 'pending' } as any, 'completed')).toBe(true);
    expect(shouldUpdateBookingStepStatus({ _id: 'i', status: 'pending' } as any, 'pending')).toBe(false);
    expect(shouldUpdateBookingStepStatus({ status: 'pending' } as any, 'completed')).toBe(false);
    expect(shouldUpdateBookingStepStatus(undefined, 'completed')).toBe(false);
  });

  it('builds note updates only for dirty changed existing items', () => {
    const items: any[] = [{ _id: 'same', notes: 'same' }, { _id: 'changed', notes: 'old' }, { _id: 'cleared', notes: 'old' }];
    expect(buildBookingStepNoteUpdates(items, { same: true, changed: true, cleared: true, missing: true }, { same: 'same', changed: 'new', cleared: '' })).toEqual([
      { itemId: 'changed', notes: 'new' }, { itemId: 'cleared', notes: '' },
    ]);
  });

  it('chooses the status date field and normalizes empty values', () => {
    expect(buildBookingStepDateUpdate({ status: 'received' } as any, '2026-08-12')).toEqual({ field: 'receivedAt', payload: { receivedAt: '2026-08-12' } });
    expect(buildBookingStepDateUpdate({ status: 'pending' } as any, '')).toEqual({ field: 'dueDate', payload: { dueDate: null } });
  });

  it('applies dates immutably and removes drafts immutably', () => {
    const first: any = { _id: 'a', dueDate: 'old' };
    const second: any = { _id: 'b' };
    const updated = applyBookingStepDateUpdate([first, second], 'a', 'dueDate', 'new');
    expect(updated).toEqual([{ _id: 'a', dueDate: 'new' }, second]);
    expect(first.dueDate).toBe('old');
    expect(applyBookingStepDateUpdate([first], 'a', 'dueDate', '')[0].dueDate).toBeNull();
    const drafts = { a: 'date', b: 'other' };
    expect(removeBookingStepDateDraft(drafts, 'a')).toEqual({ b: 'other' });
    expect(drafts).toEqual({ a: 'date', b: 'other' });
  });
});
