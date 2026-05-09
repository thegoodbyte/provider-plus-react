import React, { useState, useEffect } from 'react';
import { bookingsApi, paymentsApi, clientMedicalApi } from '../services/api';
import './RetreatTrackingGrid.css';

interface RetreatTrackingGridProps {
  retreatId: string;
}

interface ClientTrackingData {
  clientId: string;
  clientName: string;
  email: string;
  displayNumber: string; // ISCZ-P number
  bookingId: string;
  payments: {
    date?: string;
    amount?: number;
    currency?: string;
    type?: 'revolut' | 'paypal' | 'transfer' | 'other';
  }[];
  ekg: {
    received?: boolean;
    receivedDate?: string;
    sentToReview?: boolean;
    sentToReviewDate?: string;
    reviewResult?: 'OK' | 'NOT OK' | 'caution';
    reviewNotes?: string;
  };
  liver: {
    received?: boolean;
    receivedDate?: string;
    sentToReview?: boolean;
    sentToReviewDate?: string;
    reviewResult?: 'OK' | 'NOT OK' | 'caution';
    reviewNotes?: string;
  };
  questionnaire: {
    sent?: boolean;
    sentDate?: string;
    received?: boolean;
    receivedDate?: string;
  };
  medForm: {
    sent?: boolean;
    sentDate?: string;
    received?: boolean;
    receivedDate?: string;
    reviewed?: boolean;
    reviewedDate?: string;
    result?: 'approved' | 'rejected' | 'pending';
    notes?: string;
  };
  foodForm: {
    sent?: boolean;
    sentDate?: string;
    received?: boolean;
    receivedDate?: string;
    reviewed?: boolean;
    reviewedDate?: string;
    result?: 'approved' | 'rejected' | 'pending';
    notes?: string;
  };
}

const RetreatTrackingGrid: React.FC<RetreatTrackingGridProps> = ({ retreatId }) => {
  const [trackingData, setTrackingData] = useState<ClientTrackingData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCell, setSelectedCell] = useState<{row: string, col: number} | null>(null);

  useEffect(() => {
    fetchTrackingData();
  }, [retreatId]);

  const fetchTrackingData = async () => {
    try {
      setIsLoading(true);

      // Fetch bookings with client details
      const bookingsResponse = await bookingsApi.getByRetreatWithDetails(retreatId);
      const bookings = bookingsResponse.data;

      // For each booking, fetch additional tracking data
      const trackingPromises = bookings.map(async (booking: any) => {
        const clientId = booking.clientId?._id || booking.clientId;

        // Fetch payments for this client and retreat
        let payments: any[] = [];
        try {
          const paymentsResponse = await paymentsApi.getByClientAndRetreat(clientId, retreatId);
          payments = paymentsResponse.data || [];
        } catch (error) {
          console.error('Error fetching payments:', error);
        }

        // Fetch medical tracking data
        let medicalData: any = {};
        try {
          const medicalResponse = await clientMedicalApi.getByClientAndRetreat(clientId, retreatId);
          if (medicalResponse.data) {
            medicalData = medicalResponse.data;
          }
        } catch (error) {
          console.error('Error fetching medical data:', error);
        }

        // Build tracking data object
        const tracking: ClientTrackingData = {
          clientId,
          bookingId: booking._id,
          clientName: booking.clientId
            ? `${booking.clientId.firstName || ''} ${booking.clientId.lastName || ''}`.trim()
            : 'Unknown Client',
          email: booking.clientId?.email || '',
          displayNumber: booking.clientId?.displayNumber || `ISCZ-P-${booking._id?.slice(-4) || '0000'}`,
          payments: payments.map(p => ({
            date: p.paymentDate,
            amount: p.amount,
            currency: p.currency,
            type: p.paymentMethod as any || 'other'
          })),
          ekg: {
            received: medicalData.ekgReceived,
            receivedDate: medicalData.ekgReceivedDate,
            sentToReview: medicalData.ekgSentToReview,
            sentToReviewDate: medicalData.ekgSentToReviewDate,
            reviewResult: medicalData.ekgReviewResult,
            reviewNotes: medicalData.ekgReviewNotes
          },
          liver: {
            received: medicalData.liverPanelReceived,
            receivedDate: medicalData.liverPanelReceivedDate,
            sentToReview: medicalData.liverPanelSentToReview,
            sentToReviewDate: medicalData.liverPanelSentToReviewDate,
            reviewResult: medicalData.liverPanelReviewResult,
            reviewNotes: medicalData.liverPanelReviewNotes
          },
          questionnaire: {
            sent: medicalData.questionnaireSent,
            sentDate: medicalData.questionnaireSentDate,
            received: medicalData.questionnaireReceived,
            receivedDate: medicalData.questionnaireReceivedDate
          },
          medForm: {
            sent: medicalData.medFormSent,
            sentDate: medicalData.medFormSentDate,
            received: medicalData.medFormReceived,
            receivedDate: medicalData.medFormReceivedDate,
            reviewed: medicalData.medFormReviewed,
            reviewedDate: medicalData.medFormReviewedDate,
            result: medicalData.medFormResult,
            notes: medicalData.medFormNotes
          },
          foodForm: {
            sent: medicalData.foodFormSent,
            sentDate: medicalData.foodFormSentDate,
            received: medicalData.foodFormReceived,
            receivedDate: medicalData.foodFormReceivedDate,
            reviewed: medicalData.foodFormReviewed,
            reviewedDate: medicalData.foodFormReviewedDate,
            result: medicalData.foodFormResult,
            notes: medicalData.foodFormNotes
          }
        };

        return tracking;
      });

      const allTrackingData = await Promise.all(trackingPromises);

      // Limit to 6 clients as per requirement
      setTrackingData(allTrackingData.slice(0, 6));
    } catch (error) {
      console.error('Error fetching tracking data:', error);
      setTrackingData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (date?: string) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatPayment = (payments: any[]) => {
    if (!payments || payments.length === 0) return '-';
    const total = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const latestPayment = payments[payments.length - 1];
    return (
      <div className="payment-info">
        <div className="payment-total">{total.toFixed(0)} {latestPayment?.currency || 'EUR'}</div>
        <div className="payment-type">{latestPayment?.type || '-'}</div>
        <div className="payment-date">{formatDate(latestPayment?.date)}</div>
      </div>
    );
  };

  const formatStatus = (status?: boolean, date?: string) => {
    if (!status) return <span className="status-pending">❌</span>;
    return (
      <span className="status-complete">
        ✅ {formatDate(date)}
      </span>
    );
  };

  const formatReviewResult = (result?: string, notes?: string) => {
    if (!result) return '-';
    const colorClass = result === 'OK' ? 'review-ok' : result === 'NOT OK' ? 'review-notok' : 'review-caution';
    return (
      <div className={`review-result ${colorClass}`}>
        <div>{result}</div>
        {notes && <div className="review-notes">{notes}</div>}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="tracking-grid-loading">
        <div className="loading-spinner">⏳</div>
        <p>Loading tracking data...</p>
      </div>
    );
  }

  return (
    <div className="retreat-tracking-grid">
      <div className="grid-header">
        <h3>📊 Client Tracking Grid</h3>
        <button onClick={fetchTrackingData} className="refresh-btn">
          🔄 Refresh
        </button>
      </div>

      <div className="grid-container">
        <table className="tracking-table">
          <thead>
            <tr>
              <th className="row-header">Field</th>
              {trackingData.map((client, index) => (
                <th key={client.bookingId} className="client-header">
                  Client {index + 1}
                </th>
              ))}
              {/* Fill empty columns if less than 6 clients */}
              {Array.from({ length: Math.max(0, 6 - trackingData.length) }).map((_, index) => (
                <th key={`empty-${index}`} className="client-header empty">
                  Client {trackingData.length + index + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Client Info Rows */}
            <tr className="section-row">
              <td className="row-label">Name</td>
              {trackingData.map(client => (
                <td key={`name-${client.bookingId}`} className="data-cell">
                  <strong>{client.clientName}</strong>
                </td>
              ))}
              {Array.from({ length: Math.max(0, 6 - trackingData.length) }).map((_, index) => (
                <td key={`name-empty-${index}`} className="data-cell empty">-</td>
              ))}
            </tr>

            <tr>
              <td className="row-label">ID</td>
              {trackingData.map(client => (
                <td key={`id-${client.bookingId}`} className="data-cell">
                  {client.clientId.slice(-6)}
                </td>
              ))}
              {Array.from({ length: Math.max(0, 6 - trackingData.length) }).map((_, index) => (
                <td key={`id-empty-${index}`} className="data-cell empty">-</td>
              ))}
            </tr>

            <tr>
              <td className="row-label">Display Number</td>
              {trackingData.map(client => (
                <td key={`display-${client.bookingId}`} className="data-cell">
                  <span className="display-number">{client.displayNumber}</span>
                </td>
              ))}
              {Array.from({ length: Math.max(0, 6 - trackingData.length) }).map((_, index) => (
                <td key={`display-empty-${index}`} className="data-cell empty">-</td>
              ))}
            </tr>

            <tr>
              <td className="row-label">Email</td>
              {trackingData.map(client => (
                <td key={`email-${client.bookingId}`} className="data-cell email">
                  {client.email}
                </td>
              ))}
              {Array.from({ length: Math.max(0, 6 - trackingData.length) }).map((_, index) => (
                <td key={`email-empty-${index}`} className="data-cell empty">-</td>
              ))}
            </tr>

            {/* Payment Section */}
            <tr className="section-divider">
              <td colSpan={7} className="section-title">💰 Payments</td>
            </tr>

            <tr>
              <td className="row-label">Payment Info</td>
              {trackingData.map(client => (
                <td key={`payment-${client.bookingId}`} className="data-cell">
                  {formatPayment(client.payments)}
                </td>
              ))}
              {Array.from({ length: Math.max(0, 6 - trackingData.length) }).map((_, index) => (
                <td key={`payment-empty-${index}`} className="data-cell empty">-</td>
              ))}
            </tr>

            {/* EKG Section */}
            <tr className="section-divider">
              <td colSpan={7} className="section-title">🫀 EKG</td>
            </tr>

            <tr>
              <td className="row-label">EKG Received</td>
              {trackingData.map(client => (
                <td key={`ekg-received-${client.bookingId}`} className="data-cell">
                  {formatStatus(client.ekg.received, client.ekg.receivedDate)}
                </td>
              ))}
              {Array.from({ length: Math.max(0, 6 - trackingData.length) }).map((_, index) => (
                <td key={`ekg-received-empty-${index}`} className="data-cell empty">-</td>
              ))}
            </tr>

            <tr>
              <td className="row-label">EKG Sent to Review</td>
              {trackingData.map(client => (
                <td key={`ekg-sent-${client.bookingId}`} className="data-cell">
                  {formatStatus(client.ekg.sentToReview, client.ekg.sentToReviewDate)}
                </td>
              ))}
              {Array.from({ length: Math.max(0, 6 - trackingData.length) }).map((_, index) => (
                <td key={`ekg-sent-empty-${index}`} className="data-cell empty">-</td>
              ))}
            </tr>

            <tr>
              <td className="row-label">EKG Review Result</td>
              {trackingData.map(client => (
                <td key={`ekg-result-${client.bookingId}`} className="data-cell">
                  {formatReviewResult(client.ekg.reviewResult, client.ekg.reviewNotes)}
                </td>
              ))}
              {Array.from({ length: Math.max(0, 6 - trackingData.length) }).map((_, index) => (
                <td key={`ekg-result-empty-${index}`} className="data-cell empty">-</td>
              ))}
            </tr>

            {/* Liver Panel Section */}
            <tr className="section-divider">
              <td colSpan={7} className="section-title">🧬 Liver Panel</td>
            </tr>

            <tr>
              <td className="row-label">Liver Panel Received</td>
              {trackingData.map(client => (
                <td key={`liver-received-${client.bookingId}`} className="data-cell">
                  {formatStatus(client.liver.received, client.liver.receivedDate)}
                </td>
              ))}
              {Array.from({ length: Math.max(0, 6 - trackingData.length) }).map((_, index) => (
                <td key={`liver-received-empty-${index}`} className="data-cell empty">-</td>
              ))}
            </tr>

            <tr>
              <td className="row-label">Liver Sent to Review</td>
              {trackingData.map(client => (
                <td key={`liver-sent-${client.bookingId}`} className="data-cell">
                  {formatStatus(client.liver.sentToReview, client.liver.sentToReviewDate)}
                </td>
              ))}
              {Array.from({ length: Math.max(0, 6 - trackingData.length) }).map((_, index) => (
                <td key={`liver-sent-empty-${index}`} className="data-cell empty">-</td>
              ))}
            </tr>

            <tr>
              <td className="row-label">Liver Review Result</td>
              {trackingData.map(client => (
                <td key={`liver-result-${client.bookingId}`} className="data-cell">
                  {formatReviewResult(client.liver.reviewResult, client.liver.reviewNotes)}
                </td>
              ))}
              {Array.from({ length: Math.max(0, 6 - trackingData.length) }).map((_, index) => (
                <td key={`liver-result-empty-${index}`} className="data-cell empty">-</td>
              ))}
            </tr>

            {/* Forms Section */}
            <tr className="section-divider">
              <td colSpan={7} className="section-title">📋 Forms</td>
            </tr>

            {/* Questionnaire */}
            <tr>
              <td className="row-label">Questionnaire Sent</td>
              {trackingData.map(client => (
                <td key={`quest-sent-${client.bookingId}`} className="data-cell">
                  {formatStatus(client.questionnaire.sent, client.questionnaire.sentDate)}
                </td>
              ))}
              {Array.from({ length: Math.max(0, 6 - trackingData.length) }).map((_, index) => (
                <td key={`quest-sent-empty-${index}`} className="data-cell empty">-</td>
              ))}
            </tr>

            <tr>
              <td className="row-label">Questionnaire Received</td>
              {trackingData.map(client => (
                <td key={`quest-received-${client.bookingId}`} className="data-cell">
                  {formatStatus(client.questionnaire.received, client.questionnaire.receivedDate)}
                </td>
              ))}
              {Array.from({ length: Math.max(0, 6 - trackingData.length) }).map((_, index) => (
                <td key={`quest-received-empty-${index}`} className="data-cell empty">-</td>
              ))}
            </tr>

            {/* Medical Form */}
            <tr>
              <td className="row-label">Med Form Sent</td>
              {trackingData.map(client => (
                <td key={`med-sent-${client.bookingId}`} className="data-cell">
                  {formatStatus(client.medForm.sent, client.medForm.sentDate)}
                </td>
              ))}
              {Array.from({ length: Math.max(0, 6 - trackingData.length) }).map((_, index) => (
                <td key={`med-sent-empty-${index}`} className="data-cell empty">-</td>
              ))}
            </tr>

            <tr>
              <td className="row-label">Med Form Received</td>
              {trackingData.map(client => (
                <td key={`med-received-${client.bookingId}`} className="data-cell">
                  {formatStatus(client.medForm.received, client.medForm.receivedDate)}
                </td>
              ))}
              {Array.from({ length: Math.max(0, 6 - trackingData.length) }).map((_, index) => (
                <td key={`med-received-empty-${index}`} className="data-cell empty">-</td>
              ))}
            </tr>

            <tr>
              <td className="row-label">Med Form Reviewed</td>
              {trackingData.map(client => (
                <td key={`med-reviewed-${client.bookingId}`} className="data-cell">
                  {formatStatus(client.medForm.reviewed, client.medForm.reviewedDate)}
                </td>
              ))}
              {Array.from({ length: Math.max(0, 6 - trackingData.length) }).map((_, index) => (
                <td key={`med-reviewed-empty-${index}`} className="data-cell empty">-</td>
              ))}
            </tr>

            <tr>
              <td className="row-label">Med Form Result</td>
              {trackingData.map(client => (
                <td key={`med-result-${client.bookingId}`} className="data-cell">
                  {client.medForm.result ? (
                    <span className={`form-result ${client.medForm.result}`}>
                      {client.medForm.result.toUpperCase()}
                    </span>
                  ) : '-'}
                </td>
              ))}
              {Array.from({ length: Math.max(0, 6 - trackingData.length) }).map((_, index) => (
                <td key={`med-result-empty-${index}`} className="data-cell empty">-</td>
              ))}
            </tr>

            {/* Food Form */}
            <tr>
              <td className="row-label">Food Form Sent</td>
              {trackingData.map(client => (
                <td key={`food-sent-${client.bookingId}`} className="data-cell">
                  {formatStatus(client.foodForm.sent, client.foodForm.sentDate)}
                </td>
              ))}
              {Array.from({ length: Math.max(0, 6 - trackingData.length) }).map((_, index) => (
                <td key={`food-sent-empty-${index}`} className="data-cell empty">-</td>
              ))}
            </tr>

            <tr>
              <td className="row-label">Food Form Received</td>
              {trackingData.map(client => (
                <td key={`food-received-${client.bookingId}`} className="data-cell">
                  {formatStatus(client.foodForm.received, client.foodForm.receivedDate)}
                </td>
              ))}
              {Array.from({ length: Math.max(0, 6 - trackingData.length) }).map((_, index) => (
                <td key={`food-received-empty-${index}`} className="data-cell empty">-</td>
              ))}
            </tr>

            <tr>
              <td className="row-label">Food Form Reviewed</td>
              {trackingData.map(client => (
                <td key={`food-reviewed-${client.bookingId}`} className="data-cell">
                  {formatStatus(client.foodForm.reviewed, client.foodForm.reviewedDate)}
                </td>
              ))}
              {Array.from({ length: Math.max(0, 6 - trackingData.length) }).map((_, index) => (
                <td key={`food-reviewed-empty-${index}`} className="data-cell empty">-</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid-legend">
        <div className="legend-item">
          <span className="status-complete">✅</span> Complete
        </div>
        <div className="legend-item">
          <span className="status-pending">❌</span> Pending
        </div>
        <div className="legend-item">
          <span className="review-ok">OK</span> Review Passed
        </div>
        <div className="legend-item">
          <span className="review-notok">NOT OK</span> Review Failed
        </div>
        <div className="legend-item">
          <span className="review-caution">CAUTION</span> Review Needs Attention
        </div>
      </div>
    </div>
  );
};

export default RetreatTrackingGrid;