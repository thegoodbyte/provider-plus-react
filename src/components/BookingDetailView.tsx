import React, { useState, useEffect, useRef } from 'react';
import { bookingsApi } from '../services/api';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import BookingPaymentManagement from './BookingPaymentManagement';
import BookingMedicalUpload from './BookingMedicalUpload';
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
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const generatePDF = async () => {
    if (!pdfRef.current || !booking) return;

    try {
      setIsGeneratingPDF(true);

      // Add class to show PDF header and hide regular header
      const container = document.querySelector('.booking-detail-container');
      if (container) {
        container.classList.add('generating-pdf');
      }

      // Wait a brief moment for CSS to apply
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create a clone of the content for PDF generation
      const element = pdfRef.current;

      // Configure html2canvas options
      const canvas = await html2canvas(element, {
        scale: 2, // Higher quality
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');

      // Create PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const imgWidth = 210; // A4 width in mm
      const pageHeight = 295; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;

      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Add additional pages if needed
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // Save the PDF
      const fileName = `Booking_Confirmation_${booking.bookingNumber || 'Unknown'}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);

    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    } finally {
      // Remove the PDF generation class
      const container = document.querySelector('.booking-detail-container');
      if (container) {
        container.classList.remove('generating-pdf');
      }
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
          <button
            onClick={generatePDF}
            disabled={isGeneratingPDF}
            className="pdf-btn"
          >
            {isGeneratingPDF ? '📄 Generating...' : '📄 Download PDF'}
          </button>
        </div>
      </div>

      <div className="detail-content" ref={pdfRef}>
        {/* PDF Header - only visible in PDF */}
        <div className="pdf-header" style={{ display: 'none' }}>
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <h1 style={{
              color: '#2196F3',
              fontSize: '28px',
              marginBottom: '10px',
              fontWeight: 'bold'
            }}>
              RETREAT BOOKING CONFIRMATION
            </h1>
            <p style={{
              color: '#666',
              fontSize: '16px',
              margin: '0 0 20px 0'
            }}>
              Booking Number: <strong>{booking.bookingNumber || 'N/A'}</strong>
            </p>
            <hr style={{
              border: 'none',
              borderTop: '3px solid #2196F3',
              width: '50%',
              margin: '20px auto'
            }} />
          </div>
        </div>
        <div className="detail-section">
          <h3>📋 Booking Information</h3>
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

        <div className="detail-section">
          <h3>👤 Client Information</h3>
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

        <div className="detail-section">
          <h3>🏔️ Retreat Information</h3>
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
          clientId={typeof client === 'object' ? client._id : client}
          retreatId={typeof retreat === 'object' ? retreat._id : retreat}
          onUploadComplete={fetchBookingDetails}
        />

        {booking.specialRequests && (
          <div className="detail-section">
            <h3>📝 Special Requests</h3>
            <p className="special-requests">{booking.specialRequests}</p>
          </div>
        )}

        {booking.notes && (
          <div className="detail-section">
            <h3>📌 Notes</h3>
            <p className="notes">{booking.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingDetailView;