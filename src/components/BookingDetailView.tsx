import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiCheck, FiDownload, FiEdit3, FiEye, FiMail, FiSend, FiX } from 'react-icons/fi';
import { bookingsApi } from '../services/api';
import BookingPaymentManagement from './BookingPaymentManagement';
import ClientBookingWorkflowTab from './ClientBookingWorkflowTab';
import BookingDocumentsUpload from './BookingDocumentsUpload';
import BookingConfirmationEmailDialogs from './BookingConfirmationEmailDialogs';
import BookingOverviewPanel, { retreatTown } from './BookingOverviewPanel';
import EmailHistoryPanel from './EmailHistoryPanel';
import BookingActivityTimeline from './BookingActivityTimeline';
import BookingRequirementsPanel from './BookingRequirementsPanel';
import BookingMedicalOverviewPanel from './BookingMedicalOverviewPanel';
import BookingCeremoniesPanel from './BookingCeremoniesPanel';
import BookingTasksPanel from './BookingTasksPanel';
import { confirmationLanguage, BookingConfirmationLanguage } from './bookingConfirmationWorkflow';
import { useBookingConfirmationPdf } from './useBookingConfirmationPdf';
import { useBookingConfirmationEmail } from './useBookingConfirmationEmail';
import './BookingDetailView.css';

interface BookingDetailViewProps {
  bookingId: string;
  onBack: () => void;
}

const HeaderIcon: React.FC<{ icon: any }> = ({ icon: IconComponent }) => <IconComponent />;

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

const getRetreatAddress = (retreat: any) =>
  String(
    retreat?.address ||
    retreat?.house?.address ||
    retreat?.houseId?.address ||
    retreatTown(retreat) ||
    ''
  ).trim();

const getObjectId = (value: any) => typeof value === 'object' ? value?._id || value?.id : value;

const BookingDetailView: React.FC<BookingDetailViewProps> = ({ bookingId, onBack }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [booking, setBooking] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pdfLanguage, setPdfLanguage] = useState<BookingConfirmationLanguage>('en');
  const [requirementsRefreshKey, setRequirementsRefreshKey] = useState(0);
  const [requirementsStatus, setRequirementsStatus] = useState<{ missing: number; total: number } | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'payments' | 'requirements' | 'medical' | 'ceremonies' | 'documents' | 'emails' | 'tasks' | 'workflow' | 'notes'>('overview');
  const pdfRef = useRef<HTMLDivElement>(null);
  const routePrefix = useMemo(() => {
    const firstSegment = location.pathname.split('/').filter(Boolean)[0];
    return ['admin', 'medical', 'staff', 'user'].includes(firstSegment) ? `/${firstSegment}` : '';
  }, [location.pathname]);
  const {
    generating: isGeneratingPDF,
    previewing: isPreviewingPDF,
    previewUrl,
    previewFileName,
    download: generatePDF,
    preview: previewPDF,
    close: closePdfPreview,
    store: storeCanonicalBookingPdf,
  } = useBookingConfirmationPdf(bookingId, booking, pdfLanguage);
  const {
    sending: isSendingConfirmation,
    preparing: isPreparingConfirmationEmail,
    draft: confirmationEmailDraft,
    quickSendOpen: showQuickSendConfirm,
    reason: confirmationHistoryReason,
    setReason: setConfirmationHistoryReason,
    prepareReview: emailBookingConfirmation,
    requestQuickSend: requestQuickSendBookingConfirmation,
    sendQuick: sendBookingConfirmationEmail,
    completeReviewedSend,
    closeDraft: closeConfirmationEmailDraft,
    closeQuickSend,
  } = useBookingConfirmationEmail({
    bookingId,
    booking,
    language: pdfLanguage,
    storePdf: storeCanonicalBookingPdf,
    onBookingUpdated: setBooking,
    onSent: () => {
      fetchBookingDetails();
      setRequirementsRefreshKey((current) => current + 1);
    },
  });

  useEffect(() => {
    fetchBookingDetails();
  }, [bookingId]);

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
          <BookingOverviewPanel
            bookingId={bookingId}
            booking={booking}
            client={client}
            retreat={retreat}
            clientName={clientName}
            bookingTypeCode={bookingTypeCode}
            retreatCode={retreatCode}
            retreatAddress={retreatAddress}
            onEditClient={navigateToClientEdit}
            onBookingRefresh={fetchBookingDetails}
          />
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

      <BookingConfirmationEmailDialogs
        booking={booking}
        language={pdfLanguage}
        draft={confirmationEmailDraft}
        quickSendOpen={showQuickSendConfirm}
        sending={isSendingConfirmation}
        reason={confirmationHistoryReason}
        onReasonChange={setConfirmationHistoryReason}
        onCloseDraft={closeConfirmationEmailDraft}
        onReviewedSent={completeReviewedSend}
        onCloseQuickSend={closeQuickSend}
        onQuickSend={sendBookingConfirmationEmail}
      />

    </div>
  );
};

export default BookingDetailView;
