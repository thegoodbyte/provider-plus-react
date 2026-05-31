import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { bookingsApi, bookingFlowApi, medicalArtifactsApi, medicalReviewRequestsApi } from '../services/api';
import BookingPaymentManagement from './BookingPaymentManagement';
import BookingMedicalUpload from './BookingMedicalUpload';
import BookingDocumentsUpload from './BookingDocumentsUpload';
import ClientBookingWorkflowTab from './ClientBookingWorkflowTab';
import ClientEditModal from './ClientEditModal';
import { generateBookingPDF } from './BookingConfirmationPDF';
import { formatBookingHashForDisplay } from '../utils/hashGenerator';
import { BookingFlowItem, MedicalArtifact, MedicalReviewRequest } from '../types';
import './BookingDetailView.css';

interface BookingDetailViewProps {
  bookingId: string;
  onBack: () => void;
}

const requirementDefinitions = [
  { key: 'ekg', label: 'EKG', artifactTypes: ['ekg'], readinessGroups: ['ekg'] },
  { key: 'liver', label: 'Liver Panel', artifactTypes: ['liver_panel'], readinessGroups: ['liver'] },
  { key: 'medications', label: 'Medications Form', artifactTypes: ['medications_form', 'medication_list'], readinessGroups: ['medications'] },
  { key: 'questionnaire', label: 'Questionnaire', artifactTypes: ['questionnaire'], readinessGroups: ['questionnaire'] },
  { key: 'food', label: 'Food Form', artifactTypes: ['food_intake'], readinessGroups: ['food'] },
];

const completedStatuses = new Set(['received', 'reviewed', 'approved', 'completed', 'caution']);
const reviewedStatuses = new Set(['reviewed', 'approved', 'completed', 'caution', 'rejected', 'needs_resubmission']);

const getArtifactTime = (artifact: MedicalArtifact) =>
  new Date(artifact.receivedAt || artifact.createdAt || 0).getTime();

const getReviewTime = (review: MedicalReviewRequest) =>
  new Date(review.reviewedAt || review.requestedAt || review.createdAt || 0).getTime();

const BookingRequirementsPanel: React.FC<{
  bookingId: string;
  refreshKey: number;
}> = ({ bookingId, refreshKey }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const routePrefix = useMemo(() => {
    const firstSegment = location.pathname.split('/').filter(Boolean)[0];
    return ['admin', 'medical', 'staff', 'user'].includes(firstSegment) ? `/${firstSegment}` : '';
  }, [location.pathname]);
  const [items, setItems] = useState<BookingFlowItem[]>([]);
  const [artifacts, setArtifacts] = useState<MedicalArtifact[]>([]);
  const [reviewsByArtifact, setReviewsByArtifact] = useState<Record<string, MedicalReviewRequest[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadRequirements = async () => {
    setLoading(true);
    setError('');
    try {
      const [itemsResponse, artifactsResponse] = await Promise.all([
        bookingFlowApi.getItems({ bookingId }),
        medicalArtifactsApi.getAll({ bookingId }),
      ]);
      const loadedArtifacts: MedicalArtifact[] = artifactsResponse.data || [];
      const reviewEntries = await Promise.all(
        loadedArtifacts
          .filter((artifact) => artifact._id)
          .map(async (artifact) => {
            try {
              const reviewsResponse = await medicalReviewRequestsApi.getByArtifact(artifact._id!);
              return [artifact._id!, reviewsResponse.data || []] as const;
            } catch {
              return [artifact._id!, []] as const;
            }
          })
      );
      setItems(itemsResponse.data || []);
      setArtifacts(loadedArtifacts);
      setReviewsByArtifact(Object.fromEntries(reviewEntries));
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || loadError?.message || 'Unable to load booking requirements.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequirements();
  }, [bookingId, refreshKey]);

  const rows = requirementDefinitions.map((definition) => {
    const relatedItems = items.filter((item) => {
      const template = typeof item.templateId === 'object' ? item.templateId : undefined;
      const readinessGroup = item.metadata?.readinessGroup || template?.readinessGroup;
      const expectedArtifact = item.metadata?.expectedArtifact || template?.expectedArtifact;
      return definition.readinessGroups.includes(readinessGroup) || definition.artifactTypes.includes(expectedArtifact);
    });
    const relatedArtifacts = artifacts
      .filter((artifact) => definition.artifactTypes.includes(artifact.artifactType))
      .sort((a, b) => getArtifactTime(b) - getArtifactTime(a));
    const latestArtifact = relatedArtifacts[0];
    const reviews = latestArtifact?._id ? (reviewsByArtifact[latestArtifact._id] || []) : [];
    const latestReview = [...reviews].sort((a, b) => getReviewTime(b) - getReviewTime(a))[0];
    const uploaded = relatedArtifacts.some((artifact) => (artifact.files || []).length > 0);
    const flowReceived = relatedItems.some((item) => completedStatuses.has(item.status));
    const reviewed = Boolean(latestReview && reviewedStatuses.has(latestReview.status)) ||
      relatedItems.some((item) => item.status === 'reviewed' || item.status === 'approved' || item.status === 'caution');
    const required = relatedItems.length === 0 || relatedItems.some((item) => item.isBlocking);

    return {
      ...definition,
      required,
      uploaded: uploaded || flowReceived,
      reviewed,
      latestArtifact,
      latestReview,
      relatedItems,
    };
  });

  return (
    <div className="detail-section">
      <div className="section-header">
        <h3 className="pdf-section-title">Mandatory Booking Requirements</h3>
        <button className="edit-btn" type="button" onClick={loadRequirements} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      <p className="text-sm text-gray-600 mb-3">
        Driven by booking-flow requirements and linked booking artifacts/review requests.
      </p>
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Requirement</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Required</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Uploaded</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Reviewed</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Latest File / Review</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="px-3 py-2 font-medium text-gray-900">{row.label}</td>
                <td className="px-3 py-2">{row.required ? 'Yes' : 'No'}</td>
                <td className="px-3 py-2">
                  <span className={`status-badge ${row.uploaded ? 'badge-received' : 'badge-pending'}`}>
                    {row.uploaded ? 'uploaded' : 'missing'}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className={`status-badge ${row.reviewed ? 'badge-approved' : 'badge-pending'}`}>
                    {row.reviewed ? (row.latestReview?.reviewDecision || row.latestReview?.status || 'reviewed') : 'pending'}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    {row.latestArtifact?._id && (
                      <button type="button" className="text-blue-700 hover:underline" onClick={() => navigate(`${routePrefix}/medical-artifacts/${row.latestArtifact!._id}`)}>
                        Artifact #{row.latestArtifact.display_id || row.latestArtifact._id}
                      </button>
                    )}
                    {row.latestReview?._id && (
                      <button type="button" className="text-blue-700 hover:underline" onClick={() => navigate(`${routePrefix}/medical-review-requests/${row.latestReview!._id}`)}>
                        Review #{row.latestReview.display_id || row.latestReview._id}
                      </button>
                    )}
                    {!row.latestArtifact && !row.latestReview && <span className="text-gray-500">No linked record</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const BookingDetailView: React.FC<BookingDetailViewProps> = ({ bookingId, onBack }) => {
  const [booking, setBooking] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isEditingClient, setIsEditingClient] = useState(false);
  const [pdfLanguage, setPdfLanguage] = useState<'pl' | 'cz' | 'en'>('pl');
  const [requirementsRefreshKey, setRequirementsRefreshKey] = useState(0);
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

  const handleBookingRelatedUpdate = () => {
    fetchBookingDetails();
    setRequirementsRefreshKey((current) => current + 1);
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

        <BookingRequirementsPanel bookingId={bookingId} refreshKey={requirementsRefreshKey} />

        <BookingMedicalUpload
          bookingId={bookingId}
          bookingNumber={booking.bookingNumber}
          clientId={typeof client === 'object' ? client._id : client}
          retreatId={typeof retreat === 'object' ? retreat._id : retreat}
          onUploadComplete={handleBookingRelatedUpdate}
        />

        <BookingDocumentsUpload
          bookingId={bookingId}
          bookingNumber={booking.bookingNumber}
          clientId={typeof client === 'object' ? client._id : client}
          retreatId={typeof retreat === 'object' ? retreat._id : retreat}
          onUploadComplete={handleBookingRelatedUpdate}
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
