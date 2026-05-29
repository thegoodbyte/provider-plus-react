import React, { useState, useEffect, useRef } from 'react';
import { bookingsApi } from '../services/api';
import BookingPaymentManagement from './BookingPaymentManagement';
import BookingMedicalUpload from './BookingMedicalUpload';
import ClientBookingWorkflowTab from './ClientBookingWorkflowTab';
import ClientEditModal from './ClientEditModal';
import { generateBookingPDF } from './BookingConfirmationPDF';
import { formatBookingHashForDisplay } from '../utils/hashGenerator';
import './BookingDetailView.css';

interface BookingDetailViewProps {
  bookingId: string;
  onBack: () => void;
}

const BookingDetailView: React.FC<BookingDetailViewProps> = ({ bookingId, onBack }) => {
  const [booking, setBooking] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isEditingClient, setIsEditingClient] = useState(false);
  const [pdfLanguage, setPdfLanguage] = useState<'pl' | 'cz' | 'en'>('pl');
  const pdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchBookingDetails();
  }, [bookingId]);

  const fetchBookingDetails = async () => {
    try {
      setIsLoading(true);
      // Fetch booking details
      const bookingResponse = await bookingsApi.getOne(bookingId);
      setBooking(bookingResponse.data);
    } catch (error) {
      console.error('Error fetching booking details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'EUR') => {
    const symbols: { [key: string]: string } = {
      EUR: '€',
      USD: '$',
      CZK: 'Kč',
      PLN: 'zł'
    };
    return `${symbols[currency] || currency} ${amount.toFixed(2)}`;
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

  const handleClientUpdate = async (updatedClient: any) => {
    // Update the booking with the new client info
    fetchBookingDetails();
  };

  const generatePDF = async () => {
    if (!booking) return;

    try {
      setIsGeneratingPDF(true);
      await generateBookingPDF({
        booking,
        language: pdfLanguage,
        onComplete: () => {
          setIsGeneratingPDF(false);
        }
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
      setIsGeneratingPDF(false);
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

  return (
    <div className="booking-detail-container">
      <div className="detail-header">
        <button onClick={onBack} className="back-btn">← Back to Bookings</button>
        <h2>Booking Details - {booking.bookingNumber || 'N/A'}</h2>
        <div className="header-actions">
          <select
            value={pdfLanguage}
            onChange={(e) => setPdfLanguage(e.target.value as 'pl' | 'cz' | 'en')}
            className="language-selector"
            disabled={isGeneratingPDF}
          >
            <option value="pl">Polski (PL)</option>
            <option value="cz">Čeština (CZ)</option>
            <option value="en">English (EN)</option>
          </select>
          <button
            onClick={generatePDF}
            disabled={isGeneratingPDF}
            className="pdf-btn"
          >
            {isGeneratingPDF ? 'Generating...' : 'Download PDF'}
          </button>
        </div>
      </div>

      <div className="detail-content" ref={pdfRef}>

        <div className="detail-section pdf-section">
          <h3 className="pdf-section-title">Booking Information</h3>
          <div className="info-grid">
            <div className="info-item">
              <label>Booking Number:</label>
              <span className="booking-number">{booking.bookingNumber || 'N/A'}</span>
            </div>
            {booking.bookingHash && (
              <div className="info-item">
                <label>Booking Hash:</label>
                <span className="booking-hash" title="Unique booking identifier">
                  {formatBookingHashForDisplay(booking.bookingHash)}
                </span>
              </div>
            )}
            <div className="info-item">
              <label>Booking Type:</label>
              <span className="booking-type" style={{
                fontWeight: 'bold',
                color: booking.bookingType === 'booster' ? '#1976d2' : '#7b1fa2'
              }}>
                {booking.bookingType === 'booster' ? '🚀 Booster' : '🏔️ Full Retreat'}
              </span>
            </div>
            <div className="info-item">
              <label>Status:</label>
              <span className={`status-badge status-${booking.status}`}>
                {booking.status || 'pending'}
              </span>
            </div>
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

        <div className="detail-section pdf-section">
          <div className="section-header">
            <h3 className="pdf-section-title">Client Information</h3>
            <button
              className="edit-btn"
              onClick={() => setIsEditingClient(true)}
              title="Edit client information"
            >
              Edit Client
            </button>
          </div>
          <div className="info-grid">
            <div className="info-item">
              <label>Name:</label>
              <span>{client ? `${client.firstName || client.fname} ${client.lastName || client.lname}` : 'N/A'}</span>
            </div>
            <div className="info-item">
              <label>Email:</label>
              <span>{client?.email || 'N/A'}</span>
            </div>
            <div className="info-item">
              <label>Phone:</label>
              <span>{client?.phone || 'N/A'}</span>
            </div>
            <div className="info-item">
              <label>City:</label>
              <span>{client?.city || 'N/A'}</span>
            </div>
            <div className="info-item">
              <label>Country:</label>
              <span>{client?.country || 'N/A'}</span>
            </div>
          </div>
        </div>

        <div className="detail-section pdf-section">
          <h3 className="pdf-section-title">Retreat Information</h3>
          <div className="info-grid">
            <div className="info-item">
              <label>Retreat Name:</label>
              <span>{retreat?.name || 'N/A'}</span>
            </div>
            <div className="info-item">
              <label>Location:</label>
              <span>{retreat?.location || 'N/A'}</span>
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

        <BookingPaymentManagement
          bookingId={bookingId}
          bookingHash={booking.bookingHash}
          clientId={typeof client === 'object' ? client._id : client}
          retreatId={typeof retreat === 'object' ? retreat._id : retreat}
          totalAmount={booking.totalAmount || 0}
          currency={booking.currency || 'EUR'}
          onPaymentUpdate={fetchBookingDetails}
        />

        <BookingMedicalUpload
          bookingId={bookingId}
          bookingNumber={booking.bookingNumber}
          clientId={typeof client === 'object' ? client._id : client}
          retreatId={typeof retreat === 'object' ? retreat._id : retreat}
          onUploadComplete={fetchBookingDetails}
        />

        <div className="detail-section">
          <ClientBookingWorkflowTab bookings={[booking]} hideBookingSelector />
        </div>

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
      </div>

      {isEditingClient && client && typeof client === 'object' && (
        <ClientEditModal
          client={client}
          onClose={() => setIsEditingClient(false)}
          onSave={handleClientUpdate}
        />
      )}
    </div>
  );
};

export default BookingDetailView;
