import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { bookingsApi } from '../services/api';
import BookingPaymentManagement from './BookingPaymentManagement';
import ClientBookingWorkflowTab from './ClientBookingWorkflowTab';
import BookingDocumentsUpload from './BookingDocumentsUpload';
import BookingConfirmationEmailDialogs from './BookingConfirmationEmailDialogs';
import BookingOverviewPanel, { retreatTown } from './BookingOverviewPanel';
import BookingDetailShell, { BookingDetailTab } from './BookingDetailShell';
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
  const [activeTab, setActiveTab] = useState<BookingDetailTab>('overview');
  const [retreatBookings, setRetreatBookings] = useState<any[]>([]);
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
      const currentRetreatId = getObjectId(bookingResponse.data?.retreatId || bookingResponse.data?.retreatDetails);
      if (currentRetreatId) {
        try {
          const retreatBookingsResponse = await bookingsApi.getByRetreatWithDetails(currentRetreatId);
          setRetreatBookings((retreatBookingsResponse.data || []).slice().sort((left: any, right: any) => {
            const leftNumber = Number(left.bookingNumber);
            const rightNumber = Number(right.bookingNumber);
            if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber;
            return String(left.bookingNumber || left._id).localeCompare(String(right.bookingNumber || right._id), undefined, { numeric: true });
          }));
        } catch (navigationError) {
          console.error('Error loading retreat booking navigation:', navigationError);
          setRetreatBookings([]);
        }
      } else {
        setRetreatBookings([]);
      }
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
  const clientId = getObjectId(client);
  const bookingTypeCode = booking.bookingType === 'booster' ? 'B' : 'F';
  const retreatCode = getRetreatCode(retreat);
  const retreatId = getObjectId(retreat);
  const retreatAddress = getRetreatAddress(retreat);
  const currentBookingIndex = retreatBookings.findIndex((item) => String(item._id) === String(bookingId));
  const previousBooking = currentBookingIndex > 0 ? retreatBookings[currentBookingIndex - 1] : null;
  const nextBooking = currentBookingIndex >= 0 && currentBookingIndex < retreatBookings.length - 1 ? retreatBookings[currentBookingIndex + 1] : null;
  const bookingNavigationLabel = (item: any) => ({
    bookingNumber: item?.bookingNumber,
    clientName: getClientName(item?.clientId || item?.clientDetails),
  });
  return (
    <div className="booking-detail-container">
      <BookingDetailShell
        bookingNumber={booking.bookingNumber}
        clientName={clientName}
        clientDisplayId={clientDisplayId}
        clientId={clientId}
        retreatCode={retreatCode}
        retreatId={retreatId}
        bookingTypeCode={bookingTypeCode}
        language={pdfLanguage}
        activeTab={activeTab}
        requirementsStatus={requirementsStatus}
        generating={isGeneratingPDF}
        previewing={isPreviewingPDF}
        sending={isSendingConfirmation}
        preparing={isPreparingConfirmationEmail}
        previewUrl={previewUrl}
        previewFileName={previewFileName}
        previousBooking={previousBooking ? bookingNavigationLabel(previousBooking) : null}
        nextBooking={nextBooking ? bookingNavigationLabel(nextBooking) : null}
        onBack={onBack}
        onLanguageChange={setPdfLanguage}
        onEdit={() => navigate(`${routePrefix}/bookings/${bookingId}/edit`)}
        onPreview={previewPDF}
        onQuickSend={requestQuickSendBookingConfirmation}
        onReview={emailBookingConfirmation}
        onDownload={generatePDF}
        onClosePreview={closePdfPreview}
        onOpenClient={() => navigate(`${routePrefix}/clients/${clientId}`)}
        onOpenRetreat={() => navigate(`${routePrefix}/retreats/${retreatId}`)}
        onPreviousBooking={() => previousBooking?._id && navigate(`${routePrefix}/bookings/${previousBooking._id}`)}
        onNextBooking={() => nextBooking?._id && navigate(`${routePrefix}/bookings/${nextBooking._id}`)}
        onTabChange={setActiveTab}
      />

      <div className="detail-content" ref={pdfRef}>

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
