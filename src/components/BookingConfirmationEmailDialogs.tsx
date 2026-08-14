import React from 'react';
import { FiLoader } from 'react-icons/fi';
import EmailComposeModal, { EmailComposeInitialValues } from './EmailComposeModal';
import { BookingConfirmationLanguage } from './bookingConfirmationWorkflow';
const LoaderIcon: any = FiLoader;

const languageLabels: Record<BookingConfirmationLanguage, string> = { pl: 'Polish', cz: 'Czech', en: 'English' };
const clientName = (client: any) => String(client?.fullName || client?.name || [client?.firstName || client?.fname, client?.lastName || client?.lname].filter(Boolean).join(' ')).trim() || 'this client';
const clientEmail = (client: any) => String(client?.email || '').trim();

type Props = {
  booking: any;
  language: BookingConfirmationLanguage;
  draft: EmailComposeInitialValues | null;
  quickSendOpen: boolean;
  sending: boolean;
  reason: string;
  onReasonChange: (value: string) => void;
  onCloseDraft: () => void;
  onReviewedSent: (sentEmail: any) => void | Promise<void>;
  onCloseQuickSend: () => void;
  onQuickSend: () => void | Promise<void>;
};

const ReasonField: React.FC<{ value: string; onChange: (value: string) => void; id?: string }> = ({ value, onChange, id }) => (
  <div className={id ? 'booking-confirm-dialog-reason' : undefined}>
    <label htmlFor={id} className={id ? undefined : 'mb-1 block text-sm font-medium text-gray-700'}>Confirmation history reason</label>
    <input
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={id ? undefined : 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm'}
      placeholder="Original booking confirmation, date change, new payment..."
    />
  </div>
);

const BookingConfirmationEmailDialogs: React.FC<Props> = ({ booking, language, draft, quickSendOpen, sending, reason, onReasonChange, onCloseDraft, onReviewedSent, onCloseQuickSend, onQuickSend }) => {
  const client = booking?.clientId || booking?.clientDetails;
  return <>
    {draft && <EmailComposeModal title="Booking Confirmation Email" initialValues={draft} extraContent={<ReasonField value={reason} onChange={onReasonChange} />} onClose={onCloseDraft} onSent={onReviewedSent} />}
    {quickSendOpen && (
      <div className="booking-confirm-dialog-overlay" role="presentation">
        {sending && <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/45" role="status" aria-live="polite" aria-label="Sending email"><div className="flex min-w-[220px] flex-col items-center gap-4 rounded-xl bg-white px-8 py-7 text-gray-900 shadow-2xl"><LoaderIcon className="h-10 w-10 animate-spin text-blue-600" /><strong>Sending email</strong><span className="text-sm text-gray-500">Please keep this window open.</span></div></div>}
        <div className="booking-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="quick-send-confirm-title">
          <h2 id="quick-send-confirm-title">Send booking confirmation?</h2>
          <p>Do you want to send the booking confirmation to this client?</p>
          <div className="booking-confirm-dialog-details">
            <div><span>Name</span><strong>{clientName(client)}</strong></div>
            <div><span>Email</span><strong>{clientEmail(client)}</strong></div>
            <div><span>Language</span><strong>{languageLabels[language]}</strong></div>
            <ReasonField id="booking-confirm-history-reason" value={reason} onChange={onReasonChange} />
          </div>
          <div className="booking-confirm-dialog-actions">
            <button type="button" className="booking-confirm-secondary" onClick={onCloseQuickSend} disabled={sending}>Cancel</button>
            <button type="button" className="booking-confirm-primary" onClick={onQuickSend} disabled={sending}>{sending ? 'Sending...' : 'Send'}</button>
          </div>
        </div>
      </div>
    )}
  </>;
};

export default BookingConfirmationEmailDialogs;
