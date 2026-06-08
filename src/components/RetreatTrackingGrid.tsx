import React, { useState, useEffect } from 'react';
import { Check, RefreshCw, X } from 'lucide-react';
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
          displayNumber: booking.clientId?.display_id || booking.clientId?.displayNumber || `ISCZ-P-${booking._id?.slice(-4) || '0000'}`,
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

      setTrackingData(allTrackingData);
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
    if (!status) return <span className="status-pending"><X size={16} /></span>;
    return (
      <span className="status-complete">
        <Check size={16} /> {formatDate(date)}
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

  const sectionColSpan = Math.max(1, trackingData.length) + 1;

  if (isLoading) {
    return (
      <div className="tracking-grid-loading">
        <div className="loading-spinner" />
        <p>Loading tracking data...</p>
      </div>
    );
  }

  return (
    <div className="retreat-tracking-grid">
      <div className="grid-header">
        <h3>Client Tracking Grid</h3>
        <button onClick={fetchTrackingData} className="refresh-btn">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {trackingData.length === 0 ? (
        <div className="tracking-empty-state">
          No clients are booked for this retreat yet.
        </div>
      ) : (

      <div className="grid-container">
        <table className="tracking-table">
          <thead>
            <tr>
              <th className="row-header" aria-label="Tracking item"></th>
              {trackingData.map((client) => (
                <th key={client.bookingId} className="client-header">
                  <div className="client-header-name">{client.clientName || 'Unknown Client'}</div>
                  <div className="client-header-meta">{client.displayNumber}</div>
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
            </tr>

            <tr>
              <td className="row-label">ID</td>
              {trackingData.map(client => (
                <td key={`id-${client.bookingId}`} className="data-cell">
                  {client.clientId.slice(-6)}
                </td>
              ))}
            </tr>

            <tr>
              <td className="row-label">Display Number</td>
              {trackingData.map(client => (
                <td key={`display-${client.bookingId}`} className="data-cell">
                  <span className="display-number">{client.displayNumber}</span>
                </td>
              ))}
            </tr>

            <tr>
              <td className="row-label">Email</td>
              {trackingData.map(client => (
                <td key={`email-${client.bookingId}`} className="data-cell email">
                  {client.email}
                </td>
              ))}
            </tr>

            {/* Payment Section */}
            <tr className="section-divider">
              <td colSpan={sectionColSpan} className="section-title">Payments</td>
            </tr>

            <tr>
              <td className="row-label">Payment Info</td>
              {trackingData.map(client => (
                <td key={`payment-${client.bookingId}`} className="data-cell">
                  {formatPayment(client.payments)}
                </td>
              ))}
            </tr>

            {/* EKG Section */}
            <tr className="section-divider">
              <td colSpan={sectionColSpan} className="section-title">EKG</td>
            </tr>

            <tr>
              <td className="row-label">EKG Received</td>
              {trackingData.map(client => (
                <td key={`ekg-received-${client.bookingId}`} className="data-cell">
                  {formatStatus(client.ekg.received, client.ekg.receivedDate)}
                </td>
              ))}
            </tr>

            <tr>
              <td className="row-label">EKG Sent to Review</td>
              {trackingData.map(client => (
                <td key={`ekg-sent-${client.bookingId}`} className="data-cell">
                  {formatStatus(client.ekg.sentToReview, client.ekg.sentToReviewDate)}
                </td>
              ))}
            </tr>

            <tr>
              <td className="row-label">EKG Review Result</td>
              {trackingData.map(client => (
                <td key={`ekg-result-${client.bookingId}`} className="data-cell">
                  {formatReviewResult(client.ekg.reviewResult, client.ekg.reviewNotes)}
                </td>
              ))}
            </tr>

            {/* Liver Panel Section */}
            <tr className="section-divider">
              <td colSpan={sectionColSpan} className="section-title">Liver Panel</td>
            </tr>

            <tr>
              <td className="row-label">Liver Panel Received</td>
              {trackingData.map(client => (
                <td key={`liver-received-${client.bookingId}`} className="data-cell">
                  {formatStatus(client.liver.received, client.liver.receivedDate)}
                </td>
              ))}
            </tr>

            <tr>
              <td className="row-label">Liver Sent to Review</td>
              {trackingData.map(client => (
                <td key={`liver-sent-${client.bookingId}`} className="data-cell">
                  {formatStatus(client.liver.sentToReview, client.liver.sentToReviewDate)}
                </td>
              ))}
            </tr>

            <tr>
              <td className="row-label">Liver Review Result</td>
              {trackingData.map(client => (
                <td key={`liver-result-${client.bookingId}`} className="data-cell">
                  {formatReviewResult(client.liver.reviewResult, client.liver.reviewNotes)}
                </td>
              ))}
            </tr>

            {/* Forms Section */}
            <tr className="section-divider">
              <td colSpan={sectionColSpan} className="section-title">Forms</td>
            </tr>

            {/* Questionnaire */}
            <tr>
              <td className="row-label">Questionnaire Sent</td>
              {trackingData.map(client => (
                <td key={`quest-sent-${client.bookingId}`} className="data-cell">
                  {formatStatus(client.questionnaire.sent, client.questionnaire.sentDate)}
                </td>
              ))}
            </tr>

            <tr>
              <td className="row-label">Questionnaire Received</td>
              {trackingData.map(client => (
                <td key={`quest-received-${client.bookingId}`} className="data-cell">
                  {formatStatus(client.questionnaire.received, client.questionnaire.receivedDate)}
                </td>
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
            </tr>

            <tr>
              <td className="row-label">Med Form Received</td>
              {trackingData.map(client => (
                <td key={`med-received-${client.bookingId}`} className="data-cell">
                  {formatStatus(client.medForm.received, client.medForm.receivedDate)}
                </td>
              ))}
            </tr>

            <tr>
              <td className="row-label">Med Form Reviewed</td>
              {trackingData.map(client => (
                <td key={`med-reviewed-${client.bookingId}`} className="data-cell">
                  {formatStatus(client.medForm.reviewed, client.medForm.reviewedDate)}
                </td>
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
            </tr>

            {/* Food Form */}
            <tr>
              <td className="row-label">Food Form Sent</td>
              {trackingData.map(client => (
                <td key={`food-sent-${client.bookingId}`} className="data-cell">
                  {formatStatus(client.foodForm.sent, client.foodForm.sentDate)}
                </td>
              ))}
            </tr>

            <tr>
              <td className="row-label">Food Form Received</td>
              {trackingData.map(client => (
                <td key={`food-received-${client.bookingId}`} className="data-cell">
                  {formatStatus(client.foodForm.received, client.foodForm.receivedDate)}
                </td>
              ))}
            </tr>

            <tr>
              <td className="row-label">Food Form Reviewed</td>
              {trackingData.map(client => (
                <td key={`food-reviewed-${client.bookingId}`} className="data-cell">
                  {formatStatus(client.foodForm.reviewed, client.foodForm.reviewedDate)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      )}

      <div className="grid-legend">
        <div className="legend-item">
          <span className="status-complete"><Check size={16} /></span> Complete
        </div>
        <div className="legend-item">
          <span className="status-pending"><X size={16} /></span> Pending
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
