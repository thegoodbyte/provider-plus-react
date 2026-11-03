import { ArrowLeft, ArrowRight, Check, Edit3, Mail, MoreHorizontal, X } from 'lucide-react';
import React from 'react';
import { BookingConfirmationLanguage } from './bookingConfirmationWorkflow';
import NotificationCountBadge, { useNotificationCount } from './NotificationCountBadge';

export type BookingDetailTab = 'overview' | 'activity' | 'payments' | 'requirements' | 'medical' | 'ceremonies' | 'documents' | 'emails' | 'notifications' | 'tasks' | 'workflow' | 'notes' | 'integration';
export const bookingDetailTabs: { key: BookingDetailTab; label: string }[] = [
  ['overview', 'Overview'], ['activity', 'Activity'], ['payments', 'Payments'], ['requirements', 'Requirements'], ['medical', 'Medical'], ['ceremonies', 'Ceremonies'], ['documents', 'Documents'], ['emails', 'Emails'], ['notifications', 'Notifications'], ['tasks', 'Tasks'], ['workflow', 'Workflow'], ['notes', 'Notes'],
].map(([key, label]) => ({ key: key as BookingDetailTab, label }));
const Icon: React.FC<{ component: any }> = ({ component: Component }) => <Component />;

type Props = {
  nextActionSummary?: React.ReactNode;
  canManageIntegration?: boolean;
  bookingId?: string; bookingNumber?: string | number; clientName: string; clientDisplayId?: string | number; clientId?: string; retreatCode: string; retreatId?: string; retreatAddress?: string; bookingTypeCode: string;
  language: BookingConfirmationLanguage; activeTab: BookingDetailTab; requirementsStatus: { missing: number; total: number; unavailable?: number } | null;
  generating: boolean; previewing: boolean; previewPhase?: 'loading' | 'generating' | null; sending: boolean; preparing: boolean; previewUrl: string; previewFileName: string;
  previousBooking?: { bookingNumber?: string | number; clientName?: string } | null; nextBooking?: { bookingNumber?: string | number; clientName?: string } | null;
  rescheduleCount?: number; onReschedule: () => void;
  onBack: () => void; onLanguageChange: (value: BookingConfirmationLanguage) => void; onEdit: () => void; onPreview: () => void; onQuickSend: () => void; onReview: () => void; onDownload: () => void; onClosePreview: () => void; onOpenClient: () => void; onOpenRetreat: () => void; onTabChange: (tab: BookingDetailTab) => void;
  onPreviousBooking?: () => void; onNextBooking?: () => void;
};

const BookingDetailShell: React.FC<Props> = (props) => {
  const notificationCount = useNotificationCount({ bookingId: props.bookingId });
  return <>
  <div className="detail-header">
    <button onClick={props.onBack} className="back-btn" title="Back to bookings" aria-label="Back to bookings"><Icon component={ArrowLeft} /></button>
    <div className="booking-title-block"><h1>Booking #{props.bookingNumber || 'N/A'}</h1><div className="booking-title-meta"><strong>{props.clientName}</strong>{props.retreatId ? <button type="button" onClick={props.onOpenRetreat}>{props.retreatCode}</button> : <strong>{props.retreatCode}</strong>}{props.clientDisplayId && (props.clientId ? <button type="button" onClick={props.onOpenClient} title={`Open client #${props.clientDisplayId}`}>Client #{props.clientDisplayId}</button> : <span>Client #{props.clientDisplayId}</span>)}<span>Type {props.bookingTypeCode}</span>{Boolean(props.rescheduleCount) && <span>Rescheduled {props.rescheduleCount}×</span>}</div></div>
    <nav hidden={!props.previousBooking && !props.nextBooking} className="booking-sibling-navigation" aria-label={`Bookings in ${props.retreatCode}`}>
      <button type="button" disabled={!props.previousBooking} onClick={props.onPreviousBooking} className="booking-sibling-button" aria-label={props.previousBooking ? `Previous booking, #${props.previousBooking.bookingNumber}, ${props.previousBooking.clientName || ''}` : 'No previous booking'} title={props.previousBooking ? `Previous: #${props.previousBooking.bookingNumber} · ${props.previousBooking.clientName || ''}` : 'First booking in this retreat'}><Icon component={ArrowLeft} /><span><small>Previous</small>{props.previousBooking ? `#${props.previousBooking.bookingNumber || 'N/A'}` : '—'}</span></button>
      <button type="button" disabled={!props.nextBooking} onClick={props.onNextBooking} className="booking-sibling-button is-next" aria-label={props.nextBooking ? `Next booking, #${props.nextBooking.bookingNumber}, ${props.nextBooking.clientName || ''}` : 'No next booking'} title={props.nextBooking ? `Next: #${props.nextBooking.bookingNumber} · ${props.nextBooking.clientName || ''}` : 'Last booking in this retreat'}><span><small>Next</small>{props.nextBooking ? `#${props.nextBooking.bookingNumber || 'N/A'}` : '—'}</span><Icon component={ArrowRight} /></button>
    </nav>
    <div className="header-actions">
      <button onClick={props.onEdit} className="pdf-btn" title="Edit booking" aria-label="Edit booking"><Icon component={Edit3} /><span>Edit</span></button>
      <button onClick={props.onReview} disabled={props.preparing} className="pdf-btn primary-action" title="Review email with PDF attachment" aria-label="Review email with PDF attachment"><Icon component={Mail} /><span>{props.preparing ? 'Preparing' : 'Review confirmation'}</span><small>{props.language.toUpperCase()}</small></button>
      <details className="booking-more-menu"><summary className="pdf-btn booking-more-button" title="More booking actions" aria-label="More booking actions"><Icon component={MoreHorizontal} /><span>More</span></summary>
        <div className="booking-more-menu-popover">
          <label className="booking-more-language">Confirmation language<select aria-label="Confirmation language" value={props.language} disabled={props.generating || props.preparing || props.sending} onChange={e => props.onLanguageChange(e.target.value as BookingConfirmationLanguage)}><option value="pl">Polish</option><option value="cz">Czech</option><option value="en">English</option></select></label>
          <button type="button" onClick={props.onPreview} disabled={props.previewing} aria-label="Preview PDF">{props.previewing ? (props.previewPhase === 'generating' ? 'Generating PDF' : 'Loading PDF') : 'Preview PDF'}</button>
          <button type="button" onClick={props.onDownload} disabled={props.generating} aria-label="Download PDF">{props.generating ? 'Generating PDF' : 'Download PDF'}</button>
          <button type="button" onClick={props.onQuickSend} disabled={props.sending} aria-label="Send email with PDF attachment">{props.sending ? 'Sending' : 'Quick send confirmation'}</button>
          <button type="button" onClick={props.onReschedule}>Reschedule booking</button>
        </div>
      </details>

    </div>
  </div>
  {(props.previewing || props.previewUrl) && <div className="booking-pdf-preview-backdrop" role="dialog" aria-modal="true" aria-label="Booking confirmation preview">{props.previewing ? <div className="booking-pdf-loading"><span className="booking-pdf-spinner" aria-hidden="true" /><strong>{props.previewPhase === 'generating' ? 'Generating PDF' : 'Loading PDF'}</strong></div> : <div className="booking-pdf-preview-modal"><div className="booking-pdf-preview-header"><h3>Booking Confirmation Preview</h3><div className="booking-pdf-preview-actions"><a href={props.previewUrl} download={props.previewFileName} className="edit-btn">Download</a><button type="button" onClick={props.onClosePreview} className="booking-pdf-preview-close" aria-label="Close PDF preview"><Icon component={X} /></button></div></div><iframe src={props.previewUrl} title={props.previewFileName || 'Booking confirmation preview'} className="booking-pdf-preview-frame" /></div>}</div>}
  <div className="booking-detail-tabs" role="tablist" aria-label="Booking sections">{[...bookingDetailTabs, ...(props.canManageIntegration ? [{ key: 'integration' as BookingDetailTab, label: 'Integration' }] : [])].map(tab => <button key={tab.key} type="button" className={`booking-detail-tab ${props.activeTab === tab.key ? 'active' : ''}`} onClick={() => props.onTabChange(tab.key)} role="tab" aria-selected={props.activeTab === tab.key}><span>{tab.label}</span>{tab.key === 'notifications' && <NotificationCountBadge count={notificationCount} />}{tab.key === 'requirements' && props.requirementsStatus && (props.requirementsStatus.unavailable ? <span className="booking-requirements-tab-badge" aria-label="Requirement status unavailable">?</span> : props.requirementsStatus.missing > 0 ? <span className="booking-requirements-tab-badge is-missing" aria-label={`${props.requirementsStatus.missing} missing requirements`}>{props.requirementsStatus.missing}</span> : <span className="booking-requirements-tab-badge is-complete" aria-label="All requirements complete"><Icon component={Check} /></span>)}</button>)}</div>
  {props.activeTab === 'overview' && props.nextActionSummary}
</>;
};
export default BookingDetailShell;
