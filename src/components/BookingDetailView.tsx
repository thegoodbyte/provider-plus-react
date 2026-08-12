import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiCheck, FiChevronDown, FiDownload, FiEdit3, FiEye, FiMail, FiSend, FiX } from 'react-icons/fi';
import { message } from 'antd';
import { bookingsApi, communicationsApi } from '../services/api';
import BookingPaymentManagement from './BookingPaymentManagement';
import BookingDocumentsUpload from './BookingDocumentsUpload';
import ClientBookingWorkflowTab from './ClientBookingWorkflowTab';
import EmailComposeModal, { EmailComposeInitialValues } from './EmailComposeModal';
import EmailHistoryPanel from './EmailHistoryPanel';
import BookingActivityTimeline from './BookingActivityTimeline';
import BookingRequirementsPanel from './BookingRequirementsPanel';
import BookingMedicalOverviewPanel from './BookingMedicalOverviewPanel';
import BookingCeremoniesPanel from './BookingCeremoniesPanel';
import BookingTasksPanel from './BookingTasksPanel';
import { blobBase64, confirmationAction, confirmationLanguage, confirmationReason, historyReason, sendFailureDetails, sentEmailReceipt, BookingConfirmationLanguage } from './bookingConfirmationWorkflow';
import { composeBookingConfirmationEmail } from './bookingConfirmationComposer';
import { createBookingConfirmationPdf } from './BookingConfirmationPDF';
import './BookingDetailView.css';

const bookingConfirmationLanguageLabels: Record<BookingConfirmationLanguage, string> = {
  pl: 'Polish',
  cz: 'Czech',
  en: 'English',
};

interface BookingDetailViewProps {
  bookingId: string;
  onBack: () => void;
}

const HeaderIcon: React.FC<{ icon: any }> = ({ icon: IconComponent }) => <IconComponent />;

const formatHistoryDateTime = (date?: string | Date) => {
  if (!date) return 'N/A';
  const dateObj = new Date(date);
  if (Number.isNaN(dateObj.getTime())) return 'N/A';
  return dateObj.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getClientName = (client: any) => {
  const explicitName = String(client?.fullName || client?.name || '').trim();
  if (explicitName) return explicitName;
  return [client?.firstName || client?.fname, client?.lastName || client?.lname].filter(Boolean).join(' ').trim();
};

const getClientDisplayId = (client: any, booking?: any) =>
  client?.display_id || client?.displayId || client?.clientNumber || booking?.clientDisplayId || booking?.clientDetails?.display_id || '';


const getRetreatCode = (retreat: any) => {
  const explicitCode = String(retreat?.code || retreat?.retreatCode || '').trim();
  if (explicitCode) return explicitCode;
  const rawName = String(retreat?.name || retreat?.location || 'Retreat').trim();
  const initials = rawName
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'RET';
  const dateValue = retreat?.startDate || retreat?.dates?.startDate;
  const date = dateValue ? new Date(dateValue) : null;
  if (!date || Number.isNaN(date.getTime())) return initials;
  const two = (value: number) => String(value).padStart(2, '0');
  return `${initials}-${two(date.getUTCMonth() + 1)}-${two(date.getUTCDate())}-${two(date.getUTCFullYear() % 100)}`;
};

const getRetreatLocationTown = (retreat: any) =>
  String(
    retreat?.location_town ||
    retreat?.locationTown ||
    retreat?.generalTown ||
    retreat?.general_town ||
    retreat?.house?.generalTown ||
    retreat?.house?.general_town ||
    retreat?.house?.city ||
    retreat?.houseId?.generalTown ||
    retreat?.houseId?.general_town ||
    retreat?.houseId?.city ||
    retreat?.location ||
    ''
  ).trim();

const getRetreatAddress = (retreat: any) =>
  String(
    retreat?.address ||
    retreat?.house?.address ||
    retreat?.houseId?.address ||
    getRetreatLocationTown(retreat) ||
    ''
  ).trim();

const getObjectId = (value: any) => typeof value === 'object' ? value?._id || value?.id : value;

const getClientEmail = (client: any) => String(client?.email || '').trim();

const BookingDetailView: React.FC<BookingDetailViewProps> = ({ bookingId, onBack }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [booking, setBooking] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfLanguage, setPdfLanguage] = useState<BookingConfirmationLanguage>('en');
  const [requirementsRefreshKey, setRequirementsRefreshKey] = useState(0);
  const [requirementsStatus, setRequirementsStatus] = useState<{ missing: number; total: number } | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewFileName, setPreviewFileName] = useState('');
  const [isPreviewingPDF, setIsPreviewingPDF] = useState(false);
  const [isSendingConfirmation, setIsSendingConfirmation] = useState(false);
  const [isPreparingConfirmationEmail, setIsPreparingConfirmationEmail] = useState(false);
  const [confirmationEmailDraft, setConfirmationEmailDraft] = useState<EmailComposeInitialValues | null>(null);
  const [showQuickSendConfirm, setShowQuickSendConfirm] = useState(false);
  const [confirmationHistoryReason, setConfirmationHistoryReason] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'payments' | 'requirements' | 'medical' | 'ceremonies' | 'documents' | 'emails' | 'tasks' | 'workflow' | 'notes'>('overview');
  const [showBookingDates, setShowBookingDates] = useState(false);
  const [showClientDetails, setShowClientDetails] = useState(false);
  const [showRetreatInfo, setShowRetreatInfo] = useState(false);
  const [showPayments, setShowPayments] = useState(true);
  const [showBookingSteps, setShowBookingSteps] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);
  const routePrefix = useMemo(() => {
    const firstSegment = location.pathname.split('/').filter(Boolean)[0];
    return ['admin', 'medical', 'staff', 'user'].includes(firstSegment) ? `/${firstSegment}` : '';
  }, [location.pathname]);

  useEffect(() => {
    fetchBookingDetails();
  }, [bookingId]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const fetchBookingDetails = async () => {
    try {
      setIsLoading(true);
      // Fetch booking details
      const bookingResponse = await bookingsApi.getOne(bookingId);
      setBooking(bookingResponse.data);
      setPdfLanguage(confirmationLanguage(bookingResponse.data?.clientId || bookingResponse.data?.clientDetails));
    } catch (error) {
      console.error('Error fetching booking details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (date: string | Date) => {
    if (!date) return 'N/A';

    // Create date and use UTC methods to avoid timezone conversion
    const dateObj = new Date(date);
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC' // Force UTC to prevent timezone shift
    });
  };

  const buildBookingConfirmationEmail = (language: BookingConfirmationLanguage) => composeBookingConfirmationEmail(booking, language);
  const getDefaultConfirmationReason = () => {
    return confirmationReason(booking);
  };

  const recordBookingConfirmationHistory = async (sentEmail: any, language: BookingConfirmationLanguage, reason?: string) => {
    const resolvedReason = historyReason(reason, confirmationHistoryReason, booking);
    const response = await bookingsApi.recordConfirmationHistory(bookingId, {
      action: confirmationAction(booking),
      reason: resolvedReason,
      language,
      sentEmailId: sentEmail?._id,
      sentEmailDisplayId: sentEmail?.display_id,
      sentAt: sentEmail?.sentAt || new Date().toISOString(),
    });
    setBooking(response.data);
  };

  const handleBookingRelatedUpdate = () => {
    fetchBookingDetails();
    setRequirementsRefreshKey((current) => current + 1);
  };

  const navigateToClientEdit = () => {
    const clientId = getObjectId(booking?.clientId || booking?.clientDetails);
    if (!clientId) return;

    navigate(`${routePrefix}/clients/${clientId}/edit`, {
      state: { returnTo: location.pathname },
    });
  };

  const storeCanonicalBookingPdf = async (blob: Blob, fileName: string, language: BookingConfirmationLanguage) => {
    await bookingsApi.storeConfirmationPdf(bookingId, language, blob, fileName);
  };

  const generatePDF = async () => {
    if (!booking) return;

    try {
      setIsGeneratingPDF(true);
      const { pdf, blob, fileName } = await createBookingConfirmationPdf({ booking, language: pdfLanguage });
      await storeCanonicalBookingPdf(blob, fileName, pdfLanguage);
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      message.error('Could not generate the booking PDF. Please try again.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const previewPDF = async () => {
    if (!booking) return;
    setIsPreviewingPDF(true);
    try {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const { blob, fileName } = await createBookingConfirmationPdf({ booking, language: pdfLanguage });
      await storeCanonicalBookingPdf(blob, fileName, pdfLanguage);
      setPreviewUrl(URL.createObjectURL(blob));
      setPreviewFileName(fileName);
    } catch (error) {
      console.error('Error previewing PDF:', error);
      message.error('Could not open the booking PDF preview. Please try downloading it instead.');
    } finally {
      setIsPreviewingPDF(false);
    }
  };

  const closePdfPreview = () => {
    setPreviewUrl('');
    setPreviewFileName('');
  };

  const showMissingClientEmailError = () => {
    message.error('This client does not have an email address.');
  };

  const emailBookingConfirmation = async () => {
    const client = booking?.clientId || booking?.clientDetails;
    const retreat = booking?.retreatId || booking?.retreatDetails;
    const recipientEmail = getClientEmail(client);
    if (!recipientEmail) {
      showMissingClientEmailError();
      return;
    }
    setIsPreparingConfirmationEmail(true);
    const reason = confirmationHistoryReason || getDefaultConfirmationReason();
    setConfirmationHistoryReason(reason);
    try {
      const language = pdfLanguage;
      const { blob, fileName } = await createBookingConfirmationPdf({ booking, language });
      await storeCanonicalBookingPdf(blob, fileName, language);
      const contentBase64 = await blobBase64(blob);
      const email = await buildBookingConfirmationEmail(language);
      setConfirmationEmailDraft({
        to: recipientEmail,
        subject: email.subject,
        bodyText: email.bodyText,
        templateId: email.templateId,
        bookingFlowStepKey: email.bookingFlowStepKey || 'booking_confirmation_sent',
        bookingFlowStatusOnSend: email.bookingFlowStatusOnSend || 'sent',
        variables: email.variables,
        clientId: client?._id,
        retreatId: retreat?._id,
        relatedEntityType: 'booking',
        relatedEntityId: bookingId,
        attachments: [{
          fileName,
          mimeType: 'application/pdf',
          contentBase64,
        }],
      });
    } catch (error) {
      console.error('Error preparing booking confirmation email:', error);
      alert('Unable to prepare booking confirmation email.');
    } finally {
      setIsPreparingConfirmationEmail(false);
    }
  };

  const requestQuickSendBookingConfirmation = () => {
    const clientData = booking?.clientId || booking?.clientDetails;
    const recipientEmail = getClientEmail(clientData);
    if (!recipientEmail) {
      showMissingClientEmailError();
      return;
    }
    setConfirmationHistoryReason(getDefaultConfirmationReason());
    setShowQuickSendConfirm(true);
  };

  const sendBookingConfirmationEmail = async () => {
    const clientData = booking?.clientId || booking?.clientDetails;
    const retreatData = booking?.retreatId || booking?.retreatDetails;
    const recipientEmail = getClientEmail(clientData);
    let pdfSize = 0;
    let payloadSize = 0;
    if (!recipientEmail) {
      showMissingClientEmailError();
      return;
    }

    setIsSendingConfirmation(true);
    setShowQuickSendConfirm(false);
    try {
      const language = pdfLanguage;
      const { blob, fileName } = await createBookingConfirmationPdf({ booking, language });
      await storeCanonicalBookingPdf(blob, fileName, language);
      pdfSize = blob.size;
      const contentBase64 = await blobBase64(blob);
      const email = await buildBookingConfirmationEmail(language);
      const payload = {
        to: recipientEmail,
        subject: email.subject,
        bodyText: email.bodyText,
        bodyHtml: email.bodyHtml,
        templateId: email.templateId,
        bookingId,
        clientId: clientData?._id,
        retreatId: retreatData?._id,
        relatedEntityType: 'booking',
        relatedEntityId: bookingId,
        bookingFlowStepKey: email.bookingFlowStepKey || 'booking_confirmation_sent',
        bookingFlowStatusOnSend: email.bookingFlowStatusOnSend || 'sent',
        variables: email.variables,
        attachments: [{
          fileName,
          mimeType: 'application/pdf',
          contentBase64,
        }],
      };
      payloadSize = new Blob([JSON.stringify(payload)]).size;
      const response = await communicationsApi.sendEmail(payload);
      if (response.data.status === 'failed') {
        alert(`Email was logged but Gmail failed to send it: ${response.data.errorMessage || 'Unknown error'}`);
        return;
      }
      await recordBookingConfirmationHistory(response.data, language, confirmationHistoryReason);
      setRequirementsRefreshKey((current) => current + 1);
      alert(sentEmailReceipt(response.data));
    } catch (error: any) {
      console.error('Error sending booking confirmation email:', error);
      alert(sendFailureDetails(error, pdfSize, payloadSize));
    } finally {
      setIsSendingConfirmation(false);
    }
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">⏳</div>
        <p>Loading booking details...</p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="error-container">
        <p>Booking not found</p>
        <button onClick={onBack}>Back to Bookings</button>
      </div>
    );
  }


  // Extract client and retreat info
  const client = booking.clientId || booking.clientDetails;
  const retreat = booking.retreatId || booking.retreatDetails;
  const clientName = getClientName(client) || 'N/A';
  const clientDisplayId = getClientDisplayId(client, booking);
  const bookingTypeCode = booking.bookingType === 'booster' ? 'B' : 'F';
  const retreatCode = getRetreatCode(retreat);
  const retreatId = getObjectId(retreat);
  const retreatAddress = getRetreatAddress(retreat);
  const confirmationHistory = [...(booking.bookingConfirmationHistory || [])].sort((a: any, b: any) => (a.iteration || 0) - (b.iteration || 0));
  const firstConfirmation = confirmationHistory[0];
  const latestConfirmation = confirmationHistory[confirmationHistory.length - 1];
  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'activity', label: 'Activity' },
    { key: 'payments', label: 'Payments' },
    { key: 'requirements', label: 'Requirements' },
    { key: 'medical', label: 'Medical' },
    { key: 'ceremonies', label: 'Ceremonies' },
    { key: 'documents', label: 'Documents' },
    { key: 'emails', label: 'Emails' },
    { key: 'tasks', label: 'Tasks' },
    { key: 'workflow', label: 'Booking Requirements' },
    { key: 'notes', label: 'Notes' },
  ] as const;

  return (
    <div className="booking-detail-container">
      <div className="detail-header">
        <button onClick={onBack} className="back-btn" title="Back to bookings" aria-label="Back to bookings">
          <HeaderIcon icon={FiArrowLeft} />
        </button>
        <div className="booking-title-block">
          <span className="booking-title-kicker">Booking Details</span>
          <h1>Booking #{booking.bookingNumber || 'N/A'}</h1>
        </div>
        <div className="header-actions">
          <select
            value={pdfLanguage}
            onChange={(e) => setPdfLanguage(e.target.value as BookingConfirmationLanguage)}
            className="language-selector"
            disabled={isGeneratingPDF}
          >
            <option value="pl">PL</option>
            <option value="cz">CZ</option>
            <option value="en">EN</option>
          </select>
          <button
            onClick={() => navigate(`${routePrefix}/bookings/${bookingId}/edit`)}
            className="pdf-btn"
            title="Edit booking"
            aria-label="Edit booking"
            data-tooltip="Edit booking"
          >
            <HeaderIcon icon={FiEdit3} />
            <span>Edit</span>
          </button>
          <button
            onClick={previewPDF}
            disabled={isPreviewingPDF}
            className="pdf-btn"
            title="Preview PDF"
            aria-label="Preview PDF"
            data-tooltip="Preview PDF"
          >
            <HeaderIcon icon={FiEye} />
            <span>{isPreviewingPDF ? 'Previewing' : 'Preview'}</span>
          </button>
          <button
            onClick={requestQuickSendBookingConfirmation}
            disabled={isSendingConfirmation}
            className="pdf-btn primary-action"
            title="Send email with PDF attachment"
            aria-label="Send email with PDF attachment"
            data-tooltip="Quick send PDF"
          >
            <HeaderIcon icon={FiSend} />
            <span>{isSendingConfirmation ? 'Sending' : 'Send'}</span>
          </button>
          <button
            onClick={emailBookingConfirmation}
            disabled={isPreparingConfirmationEmail}
            className="pdf-btn"
            title="Review email with PDF attachment"
            aria-label="Review email with PDF attachment"
            data-tooltip="Review email"
          >
            <HeaderIcon icon={FiMail} />
            <span>{isPreparingConfirmationEmail ? 'Preparing' : 'Review'}</span>
          </button>
          <button
            onClick={generatePDF}
            disabled={isGeneratingPDF}
            className="pdf-btn"
            title="Download PDF"
            aria-label="Download PDF"
            data-tooltip="Download PDF"
          >
            <HeaderIcon icon={FiDownload} />
            <span>{isGeneratingPDF ? 'Generating' : 'Download'}</span>
          </button>
        </div>
      </div>

      {previewUrl && (
        <div className="booking-pdf-preview-backdrop" role="dialog" aria-modal="true" aria-label="Booking confirmation preview">
          <div className="booking-pdf-preview-modal">
            <div className="booking-pdf-preview-header">
              <h3>Booking Confirmation Preview</h3>
              <div className="booking-pdf-preview-actions">
                <a href={previewUrl} download={previewFileName} className="edit-btn">
                  Download
                </a>
                <button type="button" onClick={closePdfPreview} className="booking-pdf-preview-close" aria-label="Close PDF preview">
                  <HeaderIcon icon={FiX} />
                </button>
              </div>
            </div>
            <iframe
              src={previewUrl}
              title={previewFileName || 'Booking confirmation preview'}
              className="booking-pdf-preview-frame"
            />
          </div>
        </div>
      )}

      <div className="detail-content" ref={pdfRef}>

        <div className="booking-info-strip" aria-label="Booking summary">
          <div className="booking-info-item booking-info-client">
            <span>Client</span>
            <strong>{clientName}</strong>
          </div>
          {clientDisplayId && (
            <div className="booking-info-item">
              <span>Client ID</span>
              <strong>#{clientDisplayId}</strong>
            </div>
          )}
          <div className="booking-info-item">
            <span>Retreat</span>
            {retreatId ? (
              <button
                type="button"
                className="booking-info-link"
                onClick={() => navigate(`${routePrefix}/retreats/${retreatId}`)}
                title={`Open retreat ${retreatCode}`}
              >
                {retreatCode}
              </button>
            ) : (
              <strong>{retreatCode}</strong>
            )}
          </div>
          <div className="booking-info-item booking-info-type">
            <span>Type</span>
            <strong>{bookingTypeCode}</strong>
          </div>
        </div>

        <div className="booking-detail-tabs" role="tablist" aria-label="Booking sections">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`booking-detail-tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
              role="tab"
              aria-selected={activeTab === tab.key}
            >
              <span>{tab.label}</span>
              {tab.key === 'requirements' && requirementsStatus && (
                requirementsStatus.missing > 0 ? (
                  <span className="booking-requirements-tab-badge is-missing" aria-label={`${requirementsStatus.missing} missing requirements`}>
                    {requirementsStatus.missing}
                  </span>
                ) : (
                  <span className="booking-requirements-tab-badge is-complete" aria-label="All requirements complete">
                    <HeaderIcon icon={FiCheck} />
                  </span>
                )
              )}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <>
            <div className="booking-overview-summary">
              <div className="booking-overview-retreat">
                <span className="booking-type-dot">{bookingTypeCode}</span>
                <span className="retreat-code-pill">{retreatCode}</span>
              </div>
              <div className="booking-overview-address">
                {retreatAddress || 'No retreat address recorded'}
              </div>
            </div>

            <div className="detail-section pdf-section">
              <div className="section-header">
                <h3 className="pdf-section-title">Booking Confirmation History</h3>
                <span className="booking-confirm-history-count">{confirmationHistory.length} iteration{confirmationHistory.length === 1 ? '' : 's'}</span>
              </div>
              {confirmationHistory.length === 0 ? (
                <p className="text-sm text-gray-500">No booking confirmation has been sent yet.</p>
              ) : (
                <details className="booking-confirm-history-accordion">
                  <summary className="booking-confirm-history-trigger">
                    <div className="booking-confirm-history-compact">
                      <div>
                        <span>Original</span>
                        <strong>{formatHistoryDateTime(firstConfirmation?.sentAt || firstConfirmation?.createdAt)}</strong>
                      </div>
                      <div>
                        <span>Last update</span>
                        <strong>{formatHistoryDateTime(latestConfirmation?.sentAt || latestConfirmation?.createdAt)}</strong>
                      </div>
                      <div>
                        <span>Latest reason</span>
                        <strong>{latestConfirmation?.reason || 'N/A'}</strong>
                      </div>
                    </div>
                    <span className="booking-confirm-history-toggle">Show iterations</span>
                  </summary>
                  <div className="booking-confirm-history">
                    <div className="booking-confirm-history-list">
                      {confirmationHistory.map((entry: any) => (
                        <div key={entry._id || `${entry.iteration}-${entry.sentAt}`} className="booking-confirm-history-entry">
                          <div className="booking-confirm-history-entry-main">
                            <strong>Iteration {entry.iteration}</strong>
                            <span>{formatHistoryDateTime(entry.sentAt || entry.createdAt)}</span>
                          </div>
                          <div className="booking-confirm-history-entry-meta">
                            <span>{entry.reason || 'No reason recorded'}</span>
                            {entry.language && <span>{bookingConfirmationLanguageLabels[entry.language as BookingConfirmationLanguage] || entry.language}</span>}
                            {entry.sentEmailDisplayId && <span>Email #{entry.sentEmailDisplayId}</span>}
                            {entry.snapshot?.retreatCode && <span>{entry.snapshot.retreatCode}</span>}
                            {entry.snapshot?.paymentRequestDisplayId && <span>Payment request #{entry.snapshot.paymentRequestDisplayId}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </details>
              )}
            </div>

            <div className="detail-section pdf-section">
              <div className="section-header client-section-header">
                <h3 className="pdf-section-title">Client Information</h3>
                <div className="client-mobile-heading">
                  <div>
                    <span className="mobile-section-label">Client</span>
                    <h2>{clientName}</h2>
                  </div>
                  <button
                    className="edit-btn edit-client-btn"
                    onClick={navigateToClientEdit}
                    title="Edit client information"
                    aria-label="Edit client information"
                  >
                    <HeaderIcon icon={FiEdit3} />
                    <span>Edit Client</span>
                  </button>
                </div>
                <button
                  className="edit-btn edit-client-btn desktop-client-edit"
                  onClick={navigateToClientEdit}
                  title="Edit client information"
                >
                  <HeaderIcon icon={FiEdit3} />
                  <span>Edit Client</span>
                </button>
              </div>
              <button
                type="button"
                className="mobile-client-details-toggle"
                onClick={() => setShowClientDetails((current) => !current)}
                aria-expanded={showClientDetails}
              >
                <span>Client details</span>
                <HeaderIcon icon={FiChevronDown} />
              </button>
              <div className={`info-grid client-info-grid ${showClientDetails ? 'mobile-expanded' : 'mobile-collapsed'}`}>
                <div className="info-item">
                  <label>Name:</label>
                  <span>{clientName}</span>
                </div>
                <div className="info-item mobile-hidden-client-field">
                  <label>Email:</label>
                  <span>{client?.email || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <label>Phone:</label>
                  <span>{client?.phone || 'N/A'}</span>
                </div>
                <div className="info-item mobile-hidden-client-field">
                  <label>City:</label>
                  <span>{client?.city || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <label>Country:</label>
                  <span>{client?.country || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="booking-detail-accordion booking-payment-accordion">
              <button
                type="button"
                className="booking-detail-accordion-trigger"
                onClick={() => setShowPayments((current) => !current)}
                aria-expanded={showPayments}
              >
                <span>Payment Information</span>
                <span>{showPayments ? 'Hide' : 'Show'}</span>
              </button>
              {showPayments && (
                <div className="booking-detail-accordion-body">
                  <BookingPaymentManagement
                    bookingId={bookingId}
                    bookingNumber={booking.bookingNumber}
                    bookingHash={booking.bookingHash}
                    clientId={typeof client === 'object' ? client._id : client}
                    retreatId={typeof retreat === 'object' ? retreat._id : retreat}
                    totalAmount={booking.totalAmount || 0}
                    currency={booking.currency || 'EUR'}
                    onPaymentUpdate={fetchBookingDetails}
                  />
                </div>
              )}
            </div>

            <div className="booking-detail-accordion booking-steps-accordion">
              <button
                type="button"
                className="booking-detail-accordion-trigger"
                onClick={() => setShowBookingSteps((current) => !current)}
                aria-expanded={showBookingSteps}
              >
                <span>Booking Requirements</span>
                <span>{showBookingSteps ? 'Hide' : 'Show'}</span>
              </button>
              {showBookingSteps && (
                <div className="booking-detail-accordion-body">
                  <ClientBookingWorkflowTab bookings={[booking]} hideBookingSelector />
                </div>
              )}
            </div>

            <div className="booking-detail-accordion retreat-info-accordion">
              <button
                type="button"
                className="booking-detail-accordion-trigger"
                onClick={() => setShowRetreatInfo((current) => !current)}
                aria-expanded={showRetreatInfo}
              >
                <span>Retreat Information</span>
                <span>{showRetreatInfo ? 'Hide' : 'Show'}</span>
              </button>
              {showRetreatInfo && (
                <div className="booking-detail-accordion-body">
                  <div className="info-grid">
                    <div className="info-item">
                      <label>Retreat Name:</label>
                      <span>{retreat?.name || 'N/A'}</span>
                    </div>
                    <div className="info-item">
                      <label>Location town:</label>
                      <span>{getRetreatLocationTown(retreat) || 'N/A'}</span>
                    </div>
                    <div className="info-item">
                      <label>Type:</label>
                      <span>{retreat?.type ? retreat.type.charAt(0).toUpperCase() + retreat.type.slice(1) : 'N/A'}</span>
                    </div>
                    <div className="info-item">
                      <label>Start Date:</label>
                      <span>{formatDate(retreat?.startDate || retreat?.dates?.startDate)}</span>
                    </div>
                    <div className="info-item">
                      <label>End Date:</label>
                      <span>{formatDate(retreat?.endDate || retreat?.dates?.endDate)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="booking-detail-accordion">
              <button
                type="button"
                className="booking-detail-accordion-trigger"
                onClick={() => setShowBookingDates((current) => !current)}
                aria-expanded={showBookingDates}
              >
                <span>Booking Dates</span>
                <span>{showBookingDates ? 'Hide' : 'Show'}</span>
              </button>
              {showBookingDates && (
                <div className="booking-detail-accordion-body">
                  <div className="info-grid">
                    <div className="info-item">
                      <label>Registration Date:</label>
                      <span>{formatDate(booking.registrationDate)}</span>
                    </div>
                    <div className="info-item">
                      <label>Check-in Date:</label>
                      <span>{formatDate(booking.checkInDate)}</span>
                    </div>
                    <div className="info-item">
                      <label>Check-out Date:</label>
                      <span>{formatDate(booking.checkOutDate)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </>
        )}

        {activeTab === 'payments' && (
          <BookingPaymentManagement
            bookingId={bookingId}
            bookingNumber={booking.bookingNumber}
            bookingHash={booking.bookingHash}
            clientId={typeof client === 'object' ? client._id : client}
            retreatId={typeof retreat === 'object' ? retreat._id : retreat}
            totalAmount={booking.totalAmount || 0}
            currency={booking.currency || 'EUR'}
            onPaymentUpdate={fetchBookingDetails}
          />
        )}

        {activeTab === 'activity' && <BookingActivityTimeline bookingId={bookingId} />}

        <div hidden={activeTab !== 'requirements'}>
          <BookingRequirementsPanel
            bookingId={bookingId}
            clientId={getObjectId(client)}
            retreatId={getObjectId(retreat)}
            refreshKey={requirementsRefreshKey}
            onStatusChange={setRequirementsStatus}
          />
        </div>

        {activeTab === 'medical' && (
          <BookingMedicalOverviewPanel
            bookingId={bookingId}
            bookingNumber={booking.bookingNumber}
            clientId={typeof client === 'object' ? client._id : client}
            retreatId={typeof retreat === 'object' ? retreat._id : retreat}
            refreshKey={requirementsRefreshKey}
            onUploadComplete={handleBookingRelatedUpdate}
          />
        )}

        {activeTab === 'ceremonies' && (
          <BookingCeremoniesPanel
            bookingId={bookingId}
            clientId={getObjectId(client)}
            retreatId={getObjectId(retreat)}
            refreshKey={requirementsRefreshKey}
          />
        )}

        {activeTab === 'documents' && (
          <BookingDocumentsUpload
            bookingId={bookingId}
            bookingNumber={booking.bookingNumber}
            clientId={typeof client === 'object' ? client._id : client}
            retreatId={typeof retreat === 'object' ? retreat._id : retreat}
            onUploadComplete={handleBookingRelatedUpdate}
          />
        )}

        {activeTab === 'emails' && (
          <EmailHistoryPanel
            bookingId={bookingId}
            clientId={getObjectId(booking?.clientId || booking?.clientDetails)}
            retreatId={getObjectId(booking?.retreatId || booking?.retreat)}
            recipientEmail={(typeof booking?.clientId === 'object' ? booking.clientId?.email : booking?.clientDetails?.email) || booking?.clientEmail}
            recipientName={typeof booking?.clientId === 'object' ? [booking.clientId?.firstName, booking.clientId?.lastName].filter(Boolean).join(' ') : [booking?.clientDetails?.firstName, booking?.clientDetails?.lastName].filter(Boolean).join(' ')}
            title="Booking emails"
            subtitle="Only emails related to this booking and client."
          />
        )}

        {activeTab === 'tasks' && (
          <BookingTasksPanel
            bookingId={bookingId}
            clientId={getObjectId(booking?.clientId || booking?.clientDetails)}
            retreatId={getObjectId(booking?.retreatId || booking?.retreatDetails)}
            bookingLabel={`#${booking.bookingNumber || bookingId.slice(-6)}`}
            active
          />
        )}

        {activeTab === 'workflow' && (
          <div className="detail-section">
            <ClientBookingWorkflowTab bookings={[booking]} hideBookingSelector />
          </div>
        )}

        {activeTab === 'notes' && (
          <>
            {booking.specialRequests && (
              <div className="detail-section pdf-section">
                <h3 className="pdf-section-title">Special Requests</h3>
                <p className="special-requests">{booking.specialRequests}</p>
              </div>
            )}

            {booking.notes && (
              <div className="detail-section pdf-section">
                <h3 className="pdf-section-title">Notes</h3>
                <p className="notes">{booking.notes}</p>
              </div>
            )}

            {!booking.specialRequests && !booking.notes && (
              <div className="detail-section">
                <p className="text-sm text-gray-500">No notes or special requests recorded.</p>
              </div>
            )}
          </>
        )}
      </div>

      {confirmationEmailDraft && (
        <EmailComposeModal
          title="Booking Confirmation Email"
          initialValues={confirmationEmailDraft}
          extraContent={
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Confirmation history reason</label>
              <input
                value={confirmationHistoryReason}
                onChange={(event) => setConfirmationHistoryReason(event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="Original booking confirmation, date change, new payment..."
              />
            </div>
          }
          onClose={() => setConfirmationEmailDraft(null)}
          onSent={async (sentEmail) => {
            await recordBookingConfirmationHistory(sentEmail, pdfLanguage, confirmationHistoryReason);
            setConfirmationEmailDraft(null);
            fetchBookingDetails();
            setRequirementsRefreshKey((current) => current + 1);
          }}
        />
      )}

      {showQuickSendConfirm && (() => {
        const confirmClient = booking?.clientId || booking?.clientDetails;
        const confirmName = getClientName(confirmClient) || 'this client';
        const confirmEmail = getClientEmail(confirmClient);
        return (
          <div className="booking-confirm-dialog-overlay" role="presentation">
            <div className="booking-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="quick-send-confirm-title">
              <h2 id="quick-send-confirm-title">Send booking confirmation?</h2>
              <p>Do you want to send the booking confirmation to this client?</p>
              <div className="booking-confirm-dialog-details">
                <div>
                  <span>Name</span>
                  <strong>{confirmName}</strong>
                </div>
                <div>
                  <span>Email</span>
                  <strong>{confirmEmail}</strong>
                </div>
                <div>
                  <span>Language</span>
                  <strong>{bookingConfirmationLanguageLabels[pdfLanguage]}</strong>
                </div>
                <div className="booking-confirm-dialog-reason">
                  <label htmlFor="booking-confirm-history-reason">Reason</label>
                  <input
                    id="booking-confirm-history-reason"
                    value={confirmationHistoryReason}
                    onChange={(event) => setConfirmationHistoryReason(event.target.value)}
                    placeholder="Original booking confirmation, date change, new payment..."
                  />
                </div>
              </div>
              <div className="booking-confirm-dialog-actions">
                <button
                  type="button"
                  className="booking-confirm-secondary"
                  onClick={() => setShowQuickSendConfirm(false)}
                  disabled={isSendingConfirmation}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="booking-confirm-primary"
                  onClick={sendBookingConfirmationEmail}
                  disabled={isSendingConfirmation}
                >
                  {isSendingConfirmation ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};

export default BookingDetailView;
