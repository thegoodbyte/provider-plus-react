import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileText, Heart, Calendar, User,
  AlertTriangle, Download, ThumbsUp, ThumbsDown,
  Clock, Activity, Phone, Mail
} from 'lucide-react';
import { API_BASE_URL } from '../config/api.config';
import './MedicalReviewDetail.css';

interface ClientMedicalData {
  id: string;
  clientId: string;
  clientNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  retreatId: string;
  retreatName: string;
  retreatStartDate: string;

  // Medical Records
  liverPanel?: {
    fileUrl: string;
    uploadedDate: string;
    status: string;
    reviewedBy?: string;
    reviewedDate?: string;
    reviewNotes?: string;
  };

  ekg?: {
    fileUrl: string;
    uploadedDate: string;
    status: string;
    reviewedBy?: string;
    reviewedDate?: string;
    reviewNotes?: string;
  };

  medicalHistory?: string;
  medications?: string[];
  allergies?: string[];
  emergencyContact?: {
    name: string;
    relationship: string;
    // No phone or email for medical advisor view
  };

  previousRetreats?: Array<{
    name: string;
    date: string;
    outcome: string;
  }>;
}

const MedicalReviewDetail: React.FC = () => {
  const { clientId, retreatId } = useParams();
  const navigate = useNavigate();
  const [clientData, setClientData] = useState<ClientMedicalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewDecision, setReviewDecision] = useState<'approved' | 'declined' | 'needs_more_info' | ''>('');

  useEffect(() => {
    fetchClientMedicalData();
  }, [clientId, retreatId]);

  const fetchClientMedicalData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      const response = await fetch(
        `${API_BASE_URL}/client-medical/client/${clientId}/retreat/${retreatId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Transform data for medical advisor view (no contact info)
        setClientData({
          id: data._id,
          clientId: data.clientId,
          clientNumber: data.client?.clientNumber || '#0000',
          firstName: data.client?.firstName || 'Unknown',
          lastName: data.client?.lastName || '',
          dateOfBirth: data.client?.dateOfBirth || '',
          retreatId: data.retreatId,
          retreatName: data.retreat?.name || 'Unknown Retreat',
          retreatStartDate: data.retreat?.startDate || '',

          liverPanel: data.liverPanelUrl ? {
            fileUrl: data.liverPanelUrl,
            uploadedDate: data.liverPanelUploadedAt,
            status: data.liverPanelReviewStatus || 'pending',
            reviewedBy: data.liverPanelReviewedBy,
            reviewedDate: data.liverPanelReviewedAt,
            reviewNotes: data.liverPanelReviewNotes
          } : undefined,

          ekg: data.ekgUrl ? {
            fileUrl: data.ekgUrl,
            uploadedDate: data.ekgUploadedAt,
            status: data.ekgReviewStatus || 'pending',
            reviewedBy: data.ekgReviewedBy,
            reviewedDate: data.ekgReviewedAt,
            reviewNotes: data.ekgReviewNotes
          } : undefined,

          medicalHistory: data.medicalHistory,
          medications: data.medications || [],
          allergies: data.allergies || [],
          emergencyContact: data.emergencyContact ? {
            name: data.emergencyContact.name,
            relationship: data.emergencyContact.relationship
          } : undefined,

          previousRetreats: data.previousRetreats || []
        });
      }
    } catch (error) {
      console.error('Error fetching client medical data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewSubmit = async () => {
    if (!reviewDecision || !reviewNotes.trim()) {
      alert('Please select a decision and provide review notes.');
      return;
    }

    try {
      const token = localStorage.getItem('token');

      const response = await fetch(
        `${API_BASE_URL}/client-medical/${clientData?.id}/medical-clearance`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            medicalClearance: reviewDecision,
            medicalClearanceNotes: reviewNotes,
            medicalClearanceDate: new Date().toISOString()
          })
        }
      );

      if (response.ok) {
        alert('Review submitted successfully!');
        navigate('/medical-dashboard');
      }
    } catch (error) {
      console.error('Error submitting review:', error);
      alert('Failed to submit review. Please try again.');
    }
  };

  const calculateAge = (dateOfBirth: string) => {
    if (!dateOfBirth) return 'Unknown';
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not provided';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getDaysUntilRetreat = () => {
    if (!clientData?.retreatStartDate) return null;
    const retreatDate = new Date(clientData.retreatStartDate);
    const today = new Date();
    const days = Math.floor((retreatDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  if (loading) {
    return (
      <div className="medical-review-detail">
        <div className="loading">Loading client medical data...</div>
      </div>
    );
  }

  if (!clientData) {
    return (
      <div className="medical-review-detail">
        <div className="error">Unable to load client data</div>
      </div>
    );
  }

  const daysUntilRetreat = getDaysUntilRetreat();

  return (
    <div className="medical-review-detail">
      <div className="detail-header">
        <button className="back-button" onClick={() => navigate('/medical-dashboard')}>
          <ArrowLeft size={20} />
          Back to Review Queue
        </button>

        <div className="header-actions">
          {daysUntilRetreat !== null && daysUntilRetreat <= 14 && (
            <div className="urgency-badge">
              <AlertTriangle size={16} />
              Retreat in {daysUntilRetreat} days
            </div>
          )}
        </div>
      </div>

      <div className="detail-content">
        <div className="client-overview">
          <div className="overview-header">
            <div className="client-identity">
              <h2>{clientData.firstName} {clientData.lastName}</h2>
              <span className="client-number">{clientData.clientNumber}</span>
            </div>
            <div className="retreat-info">
              <Calendar size={16} />
              <span>{clientData.retreatName}</span>
              <span className="retreat-date">{formatDate(clientData.retreatStartDate)}</span>
            </div>
          </div>

          <div className="client-basic-info">
            <div className="info-item">
              <span className="info-label">Age</span>
              <span className="info-value">{calculateAge(clientData.dateOfBirth)}</span>
            </div>
            <div className="info-item">
              <span className="info-label">DOB</span>
              <span className="info-value">{formatDate(clientData.dateOfBirth)}</span>
            </div>
            {clientData.emergencyContact && (
              <div className="info-item">
                <span className="info-label">Emergency Contact</span>
                <span className="info-value">
                  {clientData.emergencyContact.name} ({clientData.emergencyContact.relationship})
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="medical-records-grid">
          {clientData.liverPanel && (
            <div className="record-card">
              <div className="record-header">
                <FileText size={20} />
                <h3>Liver Panel</h3>
                <span className={`status-badge ${clientData.liverPanel.status}`}>
                  {clientData.liverPanel.status}
                </span>
              </div>
              <div className="record-info">
                <p>Uploaded: {formatDate(clientData.liverPanel.uploadedDate)}</p>
                {clientData.liverPanel.reviewedDate && (
                  <p>Reviewed: {formatDate(clientData.liverPanel.reviewedDate)}</p>
                )}
                {clientData.liverPanel.reviewNotes && (
                  <div className="previous-notes">
                    <strong>Previous Review Notes:</strong>
                    <p>{clientData.liverPanel.reviewNotes}</p>
                  </div>
                )}
              </div>
              <a
                href={clientData.liverPanel.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="view-document-btn"
              >
                <Download size={16} />
                View Document
              </a>
            </div>
          )}

          {clientData.ekg && (
            <div className="record-card">
              <div className="record-header">
                <Heart size={20} />
                <h3>EKG Report</h3>
                <span className={`status-badge ${clientData.ekg.status}`}>
                  {clientData.ekg.status}
                </span>
              </div>
              <div className="record-info">
                <p>Uploaded: {formatDate(clientData.ekg.uploadedDate)}</p>
                {clientData.ekg.reviewedDate && (
                  <p>Reviewed: {formatDate(clientData.ekg.reviewedDate)}</p>
                )}
                {clientData.ekg.reviewNotes && (
                  <div className="previous-notes">
                    <strong>Previous Review Notes:</strong>
                    <p>{clientData.ekg.reviewNotes}</p>
                  </div>
                )}
              </div>
              <a
                href={clientData.ekg.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="view-document-btn"
              >
                <Download size={16} />
                View Document
              </a>
            </div>
          )}
        </div>

        {(clientData.medicalHistory || (clientData.medications && clientData.medications.length > 0) || (clientData.allergies && clientData.allergies.length > 0)) && (
          <div className="medical-history-section">
            <h3>Medical Information</h3>

            {clientData.medicalHistory && (
              <div className="history-item">
                <h4>Medical History</h4>
                <p>{clientData.medicalHistory}</p>
              </div>
            )}

            {clientData.medications && clientData.medications.length > 0 && (
              <div className="history-item">
                <h4>Current Medications</h4>
                <ul>
                  {clientData.medications.map((med, index) => (
                    <li key={index}>{med}</li>
                  ))}
                </ul>
              </div>
            )}

            {clientData.allergies && clientData.allergies.length > 0 && (
              <div className="history-item">
                <h4>Allergies</h4>
                <ul>
                  {clientData.allergies.map((allergy, index) => (
                    <li key={index}>{allergy}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {clientData.previousRetreats && clientData.previousRetreats.length > 0 && (
          <div className="previous-retreats-section">
            <h3>Previous Retreat History</h3>
            <div className="retreats-list">
              {clientData.previousRetreats.map((retreat, index) => (
                <div key={index} className="previous-retreat-item">
                  <span className="retreat-name">{retreat.name}</span>
                  <span className="retreat-date">{formatDate(retreat.date)}</span>
                  <span className="retreat-outcome">{retreat.outcome}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="review-decision-section">
          <h3>Medical Review Decision</h3>

          <div className="decision-options">
            <label className="decision-option">
              <input
                type="radio"
                name="decision"
                value="approved"
                checked={reviewDecision === 'approved'}
                onChange={(e) => setReviewDecision(e.target.value as any)}
              />
              <ThumbsUp size={20} />
              <span>Approve</span>
            </label>

            <label className="decision-option">
              <input
                type="radio"
                name="decision"
                value="declined"
                checked={reviewDecision === 'declined'}
                onChange={(e) => setReviewDecision(e.target.value as any)}
              />
              <ThumbsDown size={20} />
              <span>Decline</span>
            </label>

            <label className="decision-option">
              <input
                type="radio"
                name="decision"
                value="needs_more_info"
                checked={reviewDecision === 'needs_more_info'}
                onChange={(e) => setReviewDecision(e.target.value as any)}
              />
              <AlertTriangle size={20} />
              <span>Need more info</span>
            </label>
          </div>

          <div className="review-notes">
            <label>Review Notes (Required)</label>
            <textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Please provide detailed notes about your medical review decision..."
              rows={6}
            />
          </div>

          <div className="review-actions">
            <button
              className="cancel-btn"
              onClick={() => navigate('/medical-dashboard')}
            >
              Cancel
            </button>
            <button
              className="submit-review-btn"
              onClick={handleReviewSubmit}
              disabled={!reviewDecision || !reviewNotes.trim()}
            >
              Submit Review
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MedicalReviewDetail;
