import React from 'react';
import { FiArrowLeft, FiCheck, FiDownload, FiEdit3, FiEye, FiMail, FiSend, FiX } from 'react-icons/fi';
import { BookingConfirmationLanguage } from './bookingConfirmationWorkflow';

export type BookingDetailTab = 'overview' | 'activity' | 'payments' | 'requirements' | 'medical' | 'ceremonies' | 'documents' | 'emails' | 'tasks' | 'workflow' | 'notes';
export const bookingDetailTabs: { key: BookingDetailTab; label: string }[] = [
  ['overview', 'Overview'], ['activity', 'Activity'], ['payments', 'Payments'], ['requirements', 'Requirements'], ['medical', 'Medical'], ['ceremonies', 'Ceremonies'], ['documents', 'Documents'], ['emails', 'Emails'], ['tasks', 'Tasks'], ['workflow', 'Booking Requirements'], ['notes', 'Notes'],
].map(([key, label]) => ({ key: key as BookingDetailTab, label }));
const Icon: React.FC<{ component: any }> = ({ component: Component }) => <Component />;

type Props = {
  bookingNumber?: string | number; clientName: string; clientDisplayId?: string | number; retreatCode: string; retreatId?: string; bookingTypeCode: string;
  language: BookingConfirmationLanguage; activeTab: BookingDetailTab; requirementsStatus: { missing: number; total: number } | null;
  generating: boolean; previewing: boolean; sending: boolean; preparing: boolean; previewUrl: string; previewFileName: string;
  onBack: () => void; onLanguageChange: (value: BookingConfirmationLanguage) => void; onEdit: () => void; onPreview: () => void; onQuickSend: () => void; onReview: () => void; onDownload: () => void; onClosePreview: () => void; onOpenRetreat: () => void; onTabChange: (tab: BookingDetailTab) => void;
};

const BookingDetailShell: React.FC<Props> = (props) => <>
  <div className="detail-header">
    <button onClick={props.onBack} className="back-btn" title="Back to bookings" aria-label="Back to bookings"><Icon component={FiArrowLeft} /></button>
    <div className="booking-title-block"><span className="booking-title-kicker">Booking Details</span><h1>Booking #{props.bookingNumber || 'N/A'}</h1></div>
    <div className="header-actions">
      <select aria-label="Confirmation language" value={props.language} onChange={e => props.onLanguageChange(e.target.value as BookingConfirmationLanguage)} className="language-selector" disabled={props.generating}><option value="pl">PL</option><option value="cz">CZ</option><option value="en">EN</option></select>
      <button onClick={props.onEdit} className="pdf-btn" title="Edit booking" aria-label="Edit booking"><Icon component={FiEdit3} /><span>Edit</span></button>
      <button onClick={props.onPreview} disabled={props.previewing} className="pdf-btn" title="Preview PDF" aria-label="Preview PDF"><Icon component={FiEye} /><span>{props.previewing ? 'Previewing' : 'Preview'}</span></button>
      <button onClick={props.onQuickSend} disabled={props.sending} className="pdf-btn primary-action" title="Send email with PDF attachment" aria-label="Send email with PDF attachment"><Icon component={FiSend} /><span>{props.sending ? 'Sending' : 'Send'}</span></button>
      <button onClick={props.onReview} disabled={props.preparing} className="pdf-btn" title="Review email with PDF attachment" aria-label="Review email with PDF attachment"><Icon component={FiMail} /><span>{props.preparing ? 'Preparing' : 'Review'}</span></button>
      <button onClick={props.onDownload} disabled={props.generating} className="pdf-btn" title="Download PDF" aria-label="Download PDF"><Icon component={FiDownload} /><span>{props.generating ? 'Generating' : 'Download'}</span></button>
    </div>
  </div>
  {props.previewUrl && <div className="booking-pdf-preview-backdrop" role="dialog" aria-modal="true" aria-label="Booking confirmation preview"><div className="booking-pdf-preview-modal"><div className="booking-pdf-preview-header"><h3>Booking Confirmation Preview</h3><div className="booking-pdf-preview-actions"><a href={props.previewUrl} download={props.previewFileName} className="edit-btn">Download</a><button type="button" onClick={props.onClosePreview} className="booking-pdf-preview-close" aria-label="Close PDF preview"><Icon component={FiX} /></button></div></div><iframe src={props.previewUrl} title={props.previewFileName || 'Booking confirmation preview'} className="booking-pdf-preview-frame" /></div></div>}
  <div className="booking-info-strip" aria-label="Booking summary"><div className="booking-info-item booking-info-client"><span>Client</span><strong>{props.clientName}</strong></div>{props.clientDisplayId && <div className="booking-info-item"><span>Client ID</span><strong>#{props.clientDisplayId}</strong></div>}<div className="booking-info-item"><span>Retreat</span>{props.retreatId ? <button type="button" className="booking-info-link" onClick={props.onOpenRetreat} title={`Open retreat ${props.retreatCode}`}>{props.retreatCode}</button> : <strong>{props.retreatCode}</strong>}</div><div className="booking-info-item booking-info-type"><span>Type</span><strong>{props.bookingTypeCode}</strong></div></div>
  <div className="booking-detail-tabs" role="tablist" aria-label="Booking sections">{bookingDetailTabs.map(tab => <button key={tab.key} type="button" className={`booking-detail-tab ${props.activeTab === tab.key ? 'active' : ''}`} onClick={() => props.onTabChange(tab.key)} role="tab" aria-selected={props.activeTab === tab.key}><span>{tab.label}</span>{tab.key === 'requirements' && props.requirementsStatus && (props.requirementsStatus.missing > 0 ? <span className="booking-requirements-tab-badge is-missing" aria-label={`${props.requirementsStatus.missing} missing requirements`}>{props.requirementsStatus.missing}</span> : <span className="booking-requirements-tab-badge is-complete" aria-label="All requirements complete"><Icon component={FiCheck} /></span>)}</button>)}</div>
</>;
export default BookingDetailShell;
