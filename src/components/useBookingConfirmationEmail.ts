import { useCallback, useState } from 'react';
import { message } from 'antd';
import { bookingsApi, communicationsApi } from '../services/api';
import { EmailComposeInitialValues } from './EmailComposeModal';
import { composeBookingConfirmationEmail } from './bookingConfirmationComposer';
import { createBookingConfirmationPdf } from './BookingConfirmationPDF';
import {
  blobBase64,
  BookingConfirmationLanguage,
  confirmationAction,
  confirmationReason,
  historyReason,
  sendFailureDetails,
  sentEmailReceipt,
} from './bookingConfirmationWorkflow';

type Options = {
  bookingId: string;
  booking: any;
  language: BookingConfirmationLanguage;
  storePdf: (blob: Blob, fileName: string) => Promise<any>;
  onBookingUpdated: (booking: any) => void;
  onSent: () => void;
};

const clientEmail = (client: any) => String(client?.email || '').trim();

export const useBookingConfirmationEmail = ({ bookingId, booking, language, storePdf, onBookingUpdated, onSent }: Options) => {
  const [sending, setSending] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [draft, setDraft] = useState<EmailComposeInitialValues | null>(null);
  const [quickSendOpen, setQuickSendOpen] = useState(false);
  const [reason, setReason] = useState('');

  const missingEmail = useCallback(() => message.error('This client does not have an email address.'), []);
  const resolvedClient = booking?.clientId || booking?.clientDetails;
  const resolvedRetreat = booking?.retreatId || booking?.retreatDetails;

  const recordHistory = useCallback(async (sentEmail: any, explicitReason?: string) => {
    const response = await bookingsApi.recordConfirmationHistory(bookingId, {
      action: confirmationAction(booking),
      reason: historyReason(explicitReason, reason, booking),
      language,
      sentEmailId: sentEmail?._id,
      sentEmailDisplayId: sentEmail?.display_id,
      sentAt: sentEmail?.sentAt || new Date().toISOString(),
    });
    onBookingUpdated(response.data);
  }, [bookingId, booking, language, onBookingUpdated, reason]);

  const prepareAttachment = useCallback(async () => {
    const result = await createBookingConfirmationPdf({ booking, language });
    await storePdf(result.blob, result.fileName);
    return { ...result, contentBase64: await blobBase64(result.blob) };
  }, [booking, language, storePdf]);

  const prepareReview = useCallback(async () => {
    const recipient = clientEmail(resolvedClient);
    if (!recipient) { missingEmail(); return; }
    setPreparing(true);
    const nextReason = reason || confirmationReason(booking);
    setReason(nextReason);
    try {
      const { fileName, contentBase64 } = await prepareAttachment();
      const email = await composeBookingConfirmationEmail(booking, language);
      setDraft({
        to: recipient, subject: email.subject, bodyText: email.bodyText, templateId: email.templateId,
        bookingFlowStepKey: email.bookingFlowStepKey || 'booking_confirmation_sent',
        bookingFlowStatusOnSend: email.bookingFlowStatusOnSend || 'sent', variables: email.variables,
        clientId: resolvedClient?._id, retreatId: resolvedRetreat?._id,
        relatedEntityType: 'booking', relatedEntityId: bookingId,
        attachments: [{ fileName, mimeType: 'application/pdf', contentBase64 }],
      });
    } catch { alert('Unable to prepare booking confirmation email.'); }
    finally { setPreparing(false); }
  }, [booking, bookingId, language, missingEmail, prepareAttachment, reason, resolvedClient, resolvedRetreat]);

  const requestQuickSend = useCallback(() => {
    if (!clientEmail(resolvedClient)) { missingEmail(); return; }
    setReason(confirmationReason(booking));
    setQuickSendOpen(true);
  }, [booking, missingEmail, resolvedClient]);

  const sendQuick = useCallback(async () => {
    const recipient = clientEmail(resolvedClient);
    if (!recipient) { missingEmail(); return; }
    let pdfSize = 0; let payloadSize = 0;
    setSending(true); setQuickSendOpen(false);
    try {
      const { blob, fileName, contentBase64 } = await prepareAttachment();
      pdfSize = blob.size;
      const email = await composeBookingConfirmationEmail(booking, language);
      const payload = {
        to: recipient, subject: email.subject, bodyText: email.bodyText, bodyHtml: email.bodyHtml,
        templateId: email.templateId, bookingId, clientId: resolvedClient?._id, retreatId: resolvedRetreat?._id,
        relatedEntityType: 'booking', relatedEntityId: bookingId,
        bookingFlowStepKey: email.bookingFlowStepKey || 'booking_confirmation_sent',
        bookingFlowStatusOnSend: email.bookingFlowStatusOnSend || 'sent', variables: email.variables,
        attachments: [{ fileName, mimeType: 'application/pdf', contentBase64 }],
      };
      payloadSize = new Blob([JSON.stringify(payload)]).size;
      const response = await communicationsApi.sendEmail(payload);
      if (response.data.status === 'failed') { alert(`Email was logged but Gmail failed to send it: ${response.data.errorMessage || 'Unknown error'}`); return; }
      await recordHistory(response.data, reason);
      onSent();
      alert(sentEmailReceipt(response.data));
    } catch (error: any) { alert(sendFailureDetails(error, pdfSize, payloadSize)); }
    finally { setSending(false); }
  }, [booking, bookingId, language, missingEmail, onSent, prepareAttachment, reason, recordHistory, resolvedClient, resolvedRetreat]);

  const completeReviewedSend = useCallback(async (sentEmail: any) => {
    await recordHistory(sentEmail, reason);
    setDraft(null);
    onSent();
  }, [onSent, reason, recordHistory]);

  return {
    sending, preparing, draft, quickSendOpen, reason,
    setReason, prepareReview, requestQuickSend, sendQuick, recordHistory, completeReviewedSend,
    closeDraft: () => setDraft(null), closeQuickSend: () => setQuickSendOpen(false),
  };
};
