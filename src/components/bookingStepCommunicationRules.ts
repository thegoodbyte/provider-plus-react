import { formatStepDateTime } from './bookingStepPresentation';
import { BookingStepMatrixRow } from './bookingStepRows';

export type BookingStepReminderState = { subject: string; bodyText: string; suggestedFollowUpDate: string; duplicateBlocked?: boolean; lastReminderAt?: string | Date | null };

export const getBookingStepDuplicateReminderPrompt = (state: BookingStepReminderState, overrideDuplicate: boolean): string | null => state.duplicateBlocked && !overrideDuplicate ? `A reminder was sent ${state.lastReminderAt ? formatStepDateTime(state.lastReminderAt) : 'recently'}. Send another reminder anyway?` : null;
export const buildBookingStepReminderPayload = (state: BookingStepReminderState, overrideDuplicate: boolean) => ({ subject: state.subject, bodyText: state.bodyText, followUpDate: state.suggestedFollowUpDate, overrideDuplicate });
export const getBookingStepReminderFailure = (response: any): string | null => response?.data?.sentEmail?.status === 'failed' ? response.data.sentEmail.errorMessage || 'The reminder could not be sent.' : null;
export const buildBookingStepAutomationToggle = (paused: boolean, pauseReason: string, promptReason: () => string | null) => { const nextPaused = !paused; return { paused: nextPaused, reason: nextPaused ? promptReason() || '' : undefined }; };
export const getBookingStepRowEmailConfirmation = (row: BookingStepMatrixRow) => `Send ${row.key === 'address_sent' ? 'address email' : `"${row.title}" email`} to all participants in this retreat?`;
export const formatBookingStepRowEmailSummary = (data: any) => `Sent: ${data?.sent || 0}\nFailed: ${data?.failed || 0}\nSkipped: ${data?.skipped || 0}`;
