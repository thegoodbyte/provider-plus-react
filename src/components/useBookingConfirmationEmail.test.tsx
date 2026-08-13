import { act, renderHook } from '@testing-library/react';
import { message } from 'antd';
import { bookingsApi, communicationsApi } from '../services/api';
import { composeBookingConfirmationEmail } from './bookingConfirmationComposer';
import { createBookingConfirmationPdf } from './BookingConfirmationPDF';
import { useBookingConfirmationEmail } from './useBookingConfirmationEmail';
import * as workflow from './bookingConfirmationWorkflow';

jest.mock('antd', () => ({ message: { error: jest.fn() } }));
jest.mock('../services/api', () => ({ bookingsApi: { recordConfirmationHistory: jest.fn(), prepareConfirmation: jest.fn() }, communicationsApi: { sendEmail: jest.fn() } }));
jest.mock('./bookingConfirmationComposer', () => ({ composeBookingConfirmationEmail: jest.fn() }));
jest.mock('./BookingConfirmationPDF', () => ({ createBookingConfirmationPdf: jest.fn() }));
jest.mock('./bookingConfirmationWorkflow', () => ({
  blobBase64: jest.fn().mockResolvedValue('base64'),
  confirmationAction: jest.fn((booking) => booking.bookingConfirmationHistory?.length ? 'updated' : 'created'),
  confirmationReason: jest.fn((booking) => booking.bookingConfirmationHistory?.length ? 'Updated booking confirmation' : 'Original booking confirmation'),
  historyReason: jest.fn((explicit, current) => explicit || current || 'fallback'),
  sendFailureDetails: jest.fn((error) => error.message),
  sentEmailReceipt: jest.fn(() => 'sent receipt'),
}));

const pdfBlob = new Blob(['pdf']);
const booking = { clientId: { _id: 'c', email: 'client@test.com' }, retreatId: { _id: 'r' }, bookingConfirmationHistory: [] };
const email = { subject: 'Subject', bodyText: 'Text', bodyHtml: '<p>Text</p>', templateId: 't', variables: { x: 1 } };

describe('useBookingConfirmationEmail', () => {
  const storePdf = jest.fn().mockResolvedValue(undefined);
  const onBookingUpdated = jest.fn();
  const onSent = jest.fn();
  const view = (overrides: any = {}) => renderHook(() => useBookingConfirmationEmail({ bookingId: 'b', booking, language: 'en', storePdf, onBookingUpdated, onSent, ...overrides }));

  beforeEach(() => {
    jest.clearAllMocks();
    (workflow.blobBase64 as jest.Mock).mockResolvedValue('base64');
    (workflow.confirmationAction as jest.Mock).mockImplementation((value) => value.bookingConfirmationHistory?.length ? 'updated' : 'created');
    (workflow.confirmationReason as jest.Mock).mockImplementation((value) => value.bookingConfirmationHistory?.length ? 'Updated booking confirmation' : 'Original booking confirmation');
    (workflow.historyReason as jest.Mock).mockImplementation((explicit, current) => explicit || current || 'fallback');
    (workflow.sendFailureDetails as jest.Mock).mockImplementation((error) => error.message);
    (workflow.sentEmailReceipt as jest.Mock).mockReturnValue('sent receipt');
    (createBookingConfirmationPdf as jest.Mock).mockResolvedValue({ blob: pdfBlob, fileName: 'confirmation.pdf' });
    (composeBookingConfirmationEmail as jest.Mock).mockResolvedValue(email);
    (bookingsApi.recordConfirmationHistory as jest.Mock).mockResolvedValue({ data: { refreshed: true } });
    (bookingsApi.prepareConfirmation as jest.Mock).mockResolvedValue({ data: booking });
    (communicationsApi.sendEmail as jest.Mock).mockResolvedValue({ data: { _id: 'e', display_id: 4, status: 'sent' } });
    jest.spyOn(window, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('rejects review and quick send without an email', async () => {
    const { result } = view({ booking: { clientId: {} } });
    await act(async () => result.current.prepareReview());
    act(() => result.current.requestQuickSend());
    expect(message.error).toHaveBeenCalledTimes(2);
    expect(createBookingConfirmationPdf).not.toHaveBeenCalled();
  });

  it('prepares and closes a review draft with its PDF attachment', async () => {
    const { result } = view();
    await act(async () => result.current.prepareReview());
    expect(bookingsApi.prepareConfirmation).toHaveBeenCalledWith('b');
    expect(storePdf).toHaveBeenCalledWith(pdfBlob, 'confirmation.pdf');
    expect(result.current.draft).toMatchObject({ to: 'client@test.com', subject: 'Subject', clientId: 'c', retreatId: 'r' });
    expect(result.current.draft?.attachments?.[0]).toMatchObject({ fileName: 'confirmation.pdf', contentBase64: 'base64' });
    expect(result.current.reason).toBe('Original booking confirmation');
    act(() => result.current.closeDraft());
    expect(result.current.draft).toBeNull();
  });

  it('reports review preparation errors and resets loading', async () => {
    (createBookingConfirmationPdf as jest.Mock).mockRejectedValue(new Error('pdf failed'));
    const { result } = view();
    await act(async () => result.current.prepareReview());
    expect(window.alert).toHaveBeenCalledWith('Unable to prepare booking confirmation email.');
    expect(result.current.preparing).toBe(false);
  });

  it('opens, cancels and successfully performs quick send', async () => {
    const { result } = view();
    act(() => result.current.requestQuickSend());
    expect(result.current.quickSendOpen).toBe(true);
    act(() => result.current.closeQuickSend());
    expect(result.current.quickSendOpen).toBe(false);
    act(() => { result.current.requestQuickSend(); result.current.setReason('Dates changed'); });
    await act(async () => result.current.sendQuick());
    expect(communicationsApi.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'client@test.com', bookingId: 'b', bodyHtml: '<p>Text</p>' }));
    expect(bookingsApi.recordConfirmationHistory).toHaveBeenCalledWith('b', expect.objectContaining({ reason: 'Dates changed', language: 'en', sentEmailId: 'e' }));
    expect(onBookingUpdated).toHaveBeenCalledWith({ refreshed: true });
    expect(onSent).toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalledWith('sent receipt');
    expect(result.current.sending).toBe(false);
  });

  it('stops when Gmail reports a failed logged email', async () => {
    (communicationsApi.sendEmail as jest.Mock).mockResolvedValue({ data: { status: 'failed', errorMessage: 'rejected' } });
    const { result } = view();
    await act(async () => result.current.sendQuick());
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('rejected'));
    expect(bookingsApi.recordConfirmationHistory).not.toHaveBeenCalled();
    expect(onSent).not.toHaveBeenCalled();
  });

  it('reports quick-send exceptions and completes reviewed sends', async () => {
    (communicationsApi.sendEmail as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    const { result } = view();
    await act(async () => result.current.sendQuick());
    expect(window.alert).toHaveBeenCalledWith('offline');
    await act(async () => result.current.completeReviewedSend({ _id: 'reviewed' }));
    expect(bookingsApi.recordConfirmationHistory).toHaveBeenLastCalledWith('b', expect.objectContaining({ sentEmailId: 'reviewed' }));
    expect(onSent).toHaveBeenCalled();
  });
});
