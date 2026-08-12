import { buildBookingStepAutomationToggle, buildBookingStepReminderPayload, formatBookingStepRowEmailSummary, getBookingStepDuplicateReminderPrompt, getBookingStepReminderFailure, getBookingStepRowEmailConfirmation } from './bookingStepCommunicationRules';

describe('bookingStepCommunicationRules', () => {
  const state: any = { subject: 'Subject', bodyText: 'Body', suggestedFollowUpDate: '2026-08-15' };
  it('only prompts for blocked duplicates without an override', () => {
    expect(getBookingStepDuplicateReminderPrompt(state, false)).toBeNull();
    expect(getBookingStepDuplicateReminderPrompt({ ...state, duplicateBlocked: true }, false)).toBe('A reminder was sent recently. Send another reminder anyway?');
    expect(getBookingStepDuplicateReminderPrompt({ ...state, duplicateBlocked: true, lastReminderAt: '2026-08-12' }, false)).toContain('Send another reminder anyway?');
    expect(getBookingStepDuplicateReminderPrompt({ ...state, duplicateBlocked: true }, true)).toBeNull();
  });
  it('builds reminder API payloads', () => { expect(buildBookingStepReminderPayload(state, true)).toEqual({ subject: 'Subject', bodyText: 'Body', followUpDate: '2026-08-15', overrideDuplicate: true }); });
  it('extracts reminder send failures', () => {
    expect(getBookingStepReminderFailure({ data: { sentEmail: { status: 'sent' } } })).toBeNull();
    expect(getBookingStepReminderFailure({ data: { sentEmail: { status: 'failed', errorMessage: 'Mailbox rejected' } } })).toBe('Mailbox rejected');
    expect(getBookingStepReminderFailure({ data: { sentEmail: { status: 'failed' } } })).toBe('The reminder could not be sent.');
  });
  it('builds pause and resume automation requests', () => {
    const prompt = jest.fn(() => 'Client asked');
    expect(buildBookingStepAutomationToggle(false, '', prompt)).toEqual({ paused: true, reason: 'Client asked' });
    expect(prompt).toHaveBeenCalled();
    prompt.mockClear();
    expect(buildBookingStepAutomationToggle(true, 'old', prompt)).toEqual({ paused: false, reason: undefined });
    expect(prompt).not.toHaveBeenCalled();
    expect(buildBookingStepAutomationToggle(false, '', () => null)).toEqual({ paused: true, reason: '' });
  });
  it('formats row-email confirmations and summaries', () => {
    expect(getBookingStepRowEmailConfirmation({ key: 'address_sent', title: 'Address' } as any)).toBe('Send address email to all participants in this retreat?');
    expect(getBookingStepRowEmailConfirmation({ key: 'welcome', title: 'Welcome' } as any)).toBe('Send "Welcome" email to all participants in this retreat?');
    expect(formatBookingStepRowEmailSummary({ sent: 2, failed: 1, skipped: 3 })).toBe('Sent: 2\nFailed: 1\nSkipped: 3');
    expect(formatBookingStepRowEmailSummary(undefined)).toBe('Sent: 0\nFailed: 0\nSkipped: 0');
  });
});
