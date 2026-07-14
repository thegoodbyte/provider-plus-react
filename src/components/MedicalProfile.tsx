import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Calendar, Heart, FileText, AlertCircle, Download, CheckCircle, XCircle } from 'lucide-react';
import { API_BASE_URL } from '../config/api.config';
import { medicalArtifactsApi } from '../services/api';
import { MedicalArtifact } from '../types';
import './MedicalProfile.css';

interface MedicalData {
  liverPanelStatus?: string;
  liverPanelReceivedDate?: string;
  liverPanelFilePath?: string;
  liverPanelFileName?: string;
  liverPanelAdvisorNotes?: string;

  ekgStatus?: string;
  ekgReceivedDate?: string;
  ekgFilePath?: string;
  ekgFileName?: string;
  ekgAdvisorNotes?: string;

  finalMedicalClearance?: boolean;
  medicalClearanceDate?: string;
  medicalClearanceNotes?: string;

  medicalHistory?: string;
  medications?: string[];
  allergies?: string[];
}

interface Client {
  _id: string;
  clientNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  // No contact information for medical advisor view
}

interface Retreat {
  _id: string;
  name: string;
  startDate: string;
  endDate: string;
  location?: string;
}

const MedicalProfile: React.FC = () => {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [medicalData, setMedicalData] = useState<MedicalData | null>(null);
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewDecision, setReviewDecision] = useState<'approved' | 'declined' | 'needs_more_info' | ''>('');
  const [activeRetreatId, setActiveRetreatId] = useState<string | null>(null);

  // Debug: Log when component mounts and what clientId is received
  console.log('[MedicalProfile] Component mounted with clientId:', clientId);

  // Separate state for EKG and Liver Panel reviews
  const [ekgReviewNotes, setEkgReviewNotes] = useState('');
  const [ekgReviewDecision, setEkgReviewDecision] = useState<'approved' | 'declined' | 'needs_more_info' | ''>('');
  const [liverPanelReviewNotes, setLiverPanelReviewNotes] = useState('');
  const [liverPanelReviewDecision, setLiverPanelReviewDecision] = useState<'approved' | 'declined' | 'needs_more_info' | ''>('');

  const getDocumentUrl = (filePath?: string) => {
    if (!filePath) return '';
    if (/^https?:\/\//i.test(filePath)) return filePath;
    return `${API_BASE_URL}${filePath}`;
  };

  const getArtifactFilePath = (artifact?: MedicalArtifact | null) => {
    return artifact?.files?.[0]?.filePath || artifact?.files?.[0]?.s3Key || '';
  };

  const getArtifactFileName = (artifact?: MedicalArtifact | null) => {
    return artifact?.files?.[0]?.fileName || artifact?.title || '';
  };

  const getArtifactDateString = (value?: string | Date | null) => {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  };

  const getLatestArtifactByType = (artifacts: MedicalArtifact[], predicate: (artifact: MedicalArtifact) => boolean) => {
    return [...artifacts]
      .filter(predicate)
      .sort((a, b) => new Date((b.receivedAt || b.createdAt || 0) as string).getTime() - new Date((a.receivedAt || a.createdAt || 0) as string).getTime())[0];
  };

  useEffect(() => {
    // Skip if clientId looks like a route name instead of an ID
    if (clientId && !clientId.includes('-') && clientId.length === 24) {
      fetchClientData();
    } else {
      setLoading(false);
    }
  }, [clientId]);

  const fetchClientData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const isMedicalAdvisor = user?.role === 'medical_advisor';

      // Fetch client basic info - use medical advisor endpoint if applicable
      const clientUrl = isMedicalAdvisor
        ? `${API_BASE_URL}/medical-advisor/client/${clientId}`
        : `${API_BASE_URL}/clients/${clientId}`;

      const clientResponse = await fetch(clientUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (clientResponse.ok) {
        const clientData = await clientResponse.json();
        setClient({
          _id: clientData._id,
          clientNumber: clientData.clientNumber || clientData.display_id || '#0000',
          firstName: clientData.firstName || clientData.fname || 'Unknown',
          lastName: clientData.lastName || clientData.lname || '',
          dateOfBirth: clientData.dateOfBirth
        });
      }

      const [medicalResponse, artifactsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/client-medical/client/${clientId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }),
        medicalArtifactsApi.getAll({ clientId }).catch(() => ({ data: [] as MedicalArtifact[] })),
      ]);

      if (medicalResponse.ok) {
        const medicalRecords = await medicalResponse.json();
        const artifacts = (artifactsResponse.data || []) as MedicalArtifact[];

        const latestEkgArtifact = getLatestArtifactByType(artifacts, (artifact) =>
          artifact.artifactType === 'ekg' || artifact.artifactType === 'ceremony_ekg' || artifact.documentType === 'EKG',
        );
        const latestLiverArtifact = getLatestArtifactByType(artifacts, (artifact) =>
          artifact.artifactType === 'liver_panel' || artifact.documentType === 'Liver',
        );

        // Get the most recent medical record or combine them
        if (medicalRecords.length > 0) {
          const latestRecord = medicalRecords[0]; // Get most recent
          setMedicalData({
            liverPanelStatus: latestRecord.liverPanelStatus || (latestLiverArtifact ? 'received' : 'pending'),
            liverPanelReceivedDate: latestRecord.liverPanelReceivedDate || getArtifactDateString(latestLiverArtifact?.receivedAt),
            liverPanelFilePath: latestRecord.liverPanelFilePath || getArtifactFilePath(latestLiverArtifact),
            liverPanelFileName: latestRecord.liverPanelFileName || getArtifactFileName(latestLiverArtifact),
            liverPanelAdvisorNotes: latestRecord.liverPanelAdvisorNotes || latestLiverArtifact?.notes || latestLiverArtifact?.description,

            ekgStatus: latestRecord.ekgStatus || (latestEkgArtifact ? 'received' : 'pending'),
            ekgReceivedDate: latestRecord.ekgReceivedDate || getArtifactDateString(latestEkgArtifact?.receivedAt),
            ekgFilePath: latestRecord.ekgFilePath || getArtifactFilePath(latestEkgArtifact),
            ekgFileName: latestRecord.ekgFileName || getArtifactFileName(latestEkgArtifact),
            ekgAdvisorNotes: latestRecord.ekgAdvisorNotes || latestEkgArtifact?.notes || latestEkgArtifact?.description,

            finalMedicalClearance: latestRecord.finalMedicalClearance,
            medicalClearanceDate: latestRecord.medicalClearanceDate,
            medicalClearanceNotes: latestRecord.medicalClearanceNotes,

            medicalHistory: latestRecord.medicalHistory,
            medications: latestRecord.medications || [],
            allergies: latestRecord.allergies || []
          });

          // Get retreat info from the records
          const retreatsData = [
            ...medicalRecords.map((record: any) => record.retreatId),
            ...artifacts.map((artifact) => artifact.retreatId),
          ].filter((retreat: any): retreat is Retreat => Boolean(retreat && typeof retreat === 'object' && retreat._id));
          setRetreats(retreatsData);
          if (retreatsData.length > 0) {
            setActiveRetreatId(retreatsData[0]._id);
          }
        }
      } else {
        const artifacts = (artifactsResponse.data || []) as MedicalArtifact[];
        const latestEkgArtifact = getLatestArtifactByType(artifacts, (artifact) =>
          artifact.artifactType === 'ekg' || artifact.artifactType === 'ceremony_ekg' || artifact.documentType === 'EKG',
        );
        const latestLiverArtifact = getLatestArtifactByType(artifacts, (artifact) =>
          artifact.artifactType === 'liver_panel' || artifact.documentType === 'Liver',
        );
        if (latestEkgArtifact || latestLiverArtifact) {
          setMedicalData({
            ekgStatus: latestEkgArtifact ? 'received' : 'pending',
            ekgReceivedDate: getArtifactDateString(latestEkgArtifact?.receivedAt),
            ekgFilePath: getArtifactFilePath(latestEkgArtifact),
            ekgFileName: getArtifactFileName(latestEkgArtifact),
            ekgAdvisorNotes: latestEkgArtifact?.notes || latestEkgArtifact?.description,
            liverPanelStatus: latestLiverArtifact ? 'received' : 'pending',
            liverPanelReceivedDate: getArtifactDateString(latestLiverArtifact?.receivedAt),
            liverPanelFilePath: getArtifactFilePath(latestLiverArtifact),
            liverPanelFileName: getArtifactFileName(latestLiverArtifact),
            liverPanelAdvisorNotes: latestLiverArtifact?.notes || latestLiverArtifact?.description,
            medications: [],
            allergies: [],
            medicalHistory: '',
          });
        }
      }

    } catch (error) {
      console.error('Error fetching client data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEkgReviewSubmit = async () => {
    if (!ekgReviewDecision || !ekgReviewNotes.trim()) {
      alert('Please select a decision and provide review notes.');
      return;
    }

    try {
      const token = localStorage.getItem('token');

      const response = await fetch(
        `${API_BASE_URL}/client-medical/client/${clientId}/retreat/${activeRetreatId}/ekg-review`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ekgStatus: ekgReviewDecision,
            ekgAdvisorNotes: ekgReviewNotes,
            ekgReviewDate: new Date().toISOString()
          })
        }
      );

      if (response.ok) {
        alert('EKG review submitted successfully!');
        fetchClientData();
        setEkgReviewNotes('');
        setEkgReviewDecision('');
      }
    } catch (error) {
      console.error('Error submitting EKG review:', error);
      alert('Failed to submit EKG review. Please try again.');
    }
  };

  const handleLiverPanelReviewSubmit = async () => {
    if (!liverPanelReviewDecision || !liverPanelReviewNotes.trim()) {
      alert('Please select a decision and provide review notes.');
      return;
    }

    try {
      const token = localStorage.getItem('token');

      const response = await fetch(
        `${API_BASE_URL}/client-medical/client/${clientId}/retreat/${activeRetreatId}/liver-panel-review`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            liverPanelStatus: liverPanelReviewDecision,
            liverPanelAdvisorNotes: liverPanelReviewNotes,
            liverPanelReviewDate: new Date().toISOString()
          })
        }
      );

      if (response.ok) {
        alert('Liver panel review submitted successfully!');
        fetchClientData();
        setLiverPanelReviewNotes('');
        setLiverPanelReviewDecision('');
      }
    } catch (error) {
      console.error('Error submitting liver panel review:', error);
      alert('Failed to submit liver panel review. Please try again.');
    }
  };

  const handleReviewSubmit = async () => {
    if (!reviewDecision || !reviewNotes.trim()) {
      alert('Please select a decision and provide review notes.');
      return;
    }

    try {
      const token = localStorage.getItem('token');

      // This would submit the review for the active retreat
      const response = await fetch(
        `${API_BASE_URL}/client-medical/client/${clientId}/retreat/${activeRetreatId}/review`,
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
        fetchClientData(); // Refresh data
        setReviewNotes('');
        setReviewDecision('');
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

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not provided';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (status?: string) => {
    switch(status) {
      case 'received': return 'status-received';
      case 'reviewed': return 'status-reviewed';
      case 'approved': return 'status-approved';
      case 'declined': return 'status-declined';
      default: return 'status-pending';
    }
  };

  if (loading) {
    return (
      <div className="medical-profile">
        <div className="loading">Loading client medical profile...</div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="medical-profile">
        <div className="error">Client not found</div>
      </div>
    );
  }

  return (
    <div className="medical-profile">
      <div className="profile-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
          Back
        </button>
      </div>

      <div className="profile-content">
        <div className="client-header">
          <div className="client-avatar">
            <User size={40} />
          </div>
          <div className="client-info">
            <h1>{client.firstName} {client.lastName}</h1>
            <span className="client-number">{client.clientNumber}</span>
          </div>
          <div className="client-stats">
            <div className="stat">
              <span className="stat-label">Age</span>
              <span className="stat-value">{calculateAge(client.dateOfBirth || '')}</span>
            </div>
            <div className="stat">
              <span className="stat-label">DOB</span>
              <span className="stat-value">{formatDate(client.dateOfBirth)}</span>
            </div>
          </div>
        </div>

        {retreats.length > 0 && (
          <div className="retreat-selector">
            <label>Select Retreat:</label>
            <select
              value={activeRetreatId || ''}
              onChange={(e) => setActiveRetreatId(e.target.value)}
            >
              {retreats.map(retreat => (
                <option key={retreat._id} value={retreat._id}>
                  {retreat.name} - {formatDate(retreat.startDate)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="medical-documents">
          <h2>Medical Documents</h2>

          <div className="document-grid">
            <div className="document-card">
              <div className="document-header">
                <FileText size={24} />
                <h3>Liver Panel</h3>
                <span className={`status-badge ${getStatusColor(medicalData?.liverPanelStatus)}`}>
                  {medicalData?.liverPanelStatus || 'Pending'}
                </span>
              </div>

              {medicalData?.liverPanelReceivedDate ? (
                <div className="document-content">
                  <p className="upload-date">
                    Received: {formatDate(medicalData.liverPanelReceivedDate)}
                  </p>
                  {medicalData.liverPanelFileName && (
                    <p className="file-name">{medicalData.liverPanelFileName}</p>
                  )}
                  {medicalData.liverPanelAdvisorNotes && (
                    <div className="advisor-notes">
                      <strong>Review Notes:</strong>
                      <p>{medicalData.liverPanelAdvisorNotes}</p>
                    </div>
                  )}
                  {medicalData.liverPanelFilePath && (
                    <a
                      href={getDocumentUrl(medicalData.liverPanelFilePath)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="view-document-btn"
                    >
                      <Download size={16} />
                      View Document
                    </a>
                  )}
                </div>
              ) : (
                <div className="document-empty">
                  <p>No liver panel uploaded yet</p>
                </div>
              )}
            </div>

            <div className="document-card">
              <div className="document-header">
                <Heart size={24} />
                <h3>EKG Report</h3>
                <span className={`status-badge ${getStatusColor(medicalData?.ekgStatus)}`}>
                  {medicalData?.ekgStatus || 'Pending'}
                </span>
              </div>

              {medicalData?.ekgReceivedDate ? (
                <div className="document-content">
                  <p className="upload-date">
                    Received: {formatDate(medicalData.ekgReceivedDate)}
                  </p>
                  {medicalData.ekgFileName && (
                    <p className="file-name">{medicalData.ekgFileName}</p>
                  )}
                  {medicalData.ekgAdvisorNotes && (
                    <div className="advisor-notes">
                      <strong>Review Notes:</strong>
                      <p>{medicalData.ekgAdvisorNotes}</p>
                    </div>
                  )}
                  {medicalData.ekgFilePath && (
                    <a
                      href={getDocumentUrl(medicalData.ekgFilePath)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="view-document-btn"
                    >
                      <Download size={16} />
                      View Document
                    </a>
                  )}
                </div>
              ) : (
                <div className="document-empty">
                  <p>No EKG uploaded yet</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {(medicalData?.medicalHistory || medicalData?.medications?.length || medicalData?.allergies?.length) && (
          <div className="medical-info-section">
            <h2>Medical Information</h2>

            {medicalData.medicalHistory && (
              <div className="info-block">
                <h3>Medical History</h3>
                <p>{medicalData.medicalHistory}</p>
              </div>
            )}

            {medicalData.medications && medicalData.medications.length > 0 && (
              <div className="info-block">
                <h3>Current Medications</h3>
                <ul className="medication-list">
                  {medicalData.medications.map((med, index) => (
                    <li key={index}>{med}</li>
                  ))}
                </ul>
              </div>
            )}

            {medicalData.allergies && medicalData.allergies.length > 0 && (
              <div className="info-block">
                <h3>Allergies</h3>
                <ul className="allergy-list">
                  {medicalData.allergies.map((allergy, index) => (
                    <li key={index}>{allergy}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {medicalData?.finalMedicalClearance !== undefined && (
          <div className="clearance-section">
            <h2>Medical Clearance Status</h2>
            <div className={`clearance-status ${medicalData.finalMedicalClearance ? 'approved' : 'pending'}`}>
              {medicalData.finalMedicalClearance ? (
                <>
                  <CheckCircle size={24} />
                  <span>Cleared for Retreat</span>
                </>
              ) : (
                <>
                  <AlertCircle size={24} />
                  <span>Clearance Pending</span>
                </>
              )}
            </div>
            {medicalData.medicalClearanceNotes && (
              <div className="clearance-notes">
                <strong>Clearance Notes:</strong>
                <p>{medicalData.medicalClearanceNotes}</p>
                {medicalData.medicalClearanceDate && (
                  <p className="clearance-date">
                    Date: {formatDate(medicalData.medicalClearanceDate)}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Separate EKG Review Section */}
        {medicalData?.ekgReceivedDate && medicalData?.ekgStatus === 'received' && (
          <div className="review-section">
            <h2>EKG Review</h2>

            <div className="document-review-header">
              <Heart size={24} />
              <span>Review EKG Results</span>
              {medicalData.ekgFileName && (
                <a
                  href={getDocumentUrl(medicalData.ekgFilePath)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="view-document-btn"
                >
                  <Download size={16} />
                  View EKG
                </a>
              )}
            </div>

            <div className="decision-options">
              <label className="decision-option">
                <input
                  type="radio"
                  name="ekgDecision"
                  value="approved"
                  checked={ekgReviewDecision === 'approved'}
                  onChange={(e) => setEkgReviewDecision(e.target.value as any)}
                />
                <CheckCircle size={20} />
                <span>Approve EKG</span>
              </label>

              <label className="decision-option">
                <input
                  type="radio"
                  name="ekgDecision"
                  value="declined"
                  checked={ekgReviewDecision === 'declined'}
                  onChange={(e) => setEkgReviewDecision(e.target.value as any)}
                />
                <XCircle size={20} />
                <span>Decline EKG</span>
              </label>

              <label className="decision-option">
                <input
                  type="radio"
                  name="ekgDecision"
                  value="needs_more_info"
                  checked={ekgReviewDecision === 'needs_more_info'}
                  onChange={(e) => setEkgReviewDecision(e.target.value as any)}
                />
                <AlertCircle size={20} />
                <span>Need More Info</span>
              </label>
            </div>

            <div className="review-notes">
              <label>EKG Review Notes (Required)</label>
              <textarea
                value={ekgReviewNotes}
                onChange={(e) => setEkgReviewNotes(e.target.value)}
                placeholder="Please provide detailed notes about the EKG review..."
                rows={4}
              />
            </div>

            <div className="review-actions">
              <button
                className="submit-review-btn"
                onClick={handleEkgReviewSubmit}
                disabled={!ekgReviewDecision || !ekgReviewNotes.trim()}
              >
                Submit EKG Review
              </button>
            </div>
          </div>
        )}

        {/* Separate Liver Panel Review Section */}
        {medicalData?.liverPanelReceivedDate && medicalData?.liverPanelStatus === 'received' && (
          <div className="review-section">
            <h2>Liver Panel Review</h2>

            <div className="document-review-header">
              <FileText size={24} />
              <span>Review Liver Panel Results</span>
              {medicalData.liverPanelFileName && (
                <a
                  href={getDocumentUrl(medicalData.liverPanelFilePath)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="view-document-btn"
                >
                  <Download size={16} />
                  View Liver Panel
                </a>
              )}
            </div>

            <div className="decision-options">
              <label className="decision-option">
                <input
                  type="radio"
                  name="liverDecision"
                  value="approved"
                  checked={liverPanelReviewDecision === 'approved'}
                  onChange={(e) => setLiverPanelReviewDecision(e.target.value as any)}
                />
                <CheckCircle size={20} />
                <span>Approve Liver Panel</span>
              </label>

              <label className="decision-option">
                <input
                  type="radio"
                  name="liverDecision"
                  value="declined"
                  checked={liverPanelReviewDecision === 'declined'}
                  onChange={(e) => setLiverPanelReviewDecision(e.target.value as any)}
                />
                <XCircle size={20} />
                <span>Decline Liver Panel</span>
              </label>

              <label className="decision-option">
                <input
                  type="radio"
                  name="liverDecision"
                  value="needs_more_info"
                  checked={liverPanelReviewDecision === 'needs_more_info'}
                  onChange={(e) => setLiverPanelReviewDecision(e.target.value as any)}
                />
                <AlertCircle size={20} />
                <span>Need More Info</span>
              </label>
            </div>

            <div className="review-notes">
              <label>Liver Panel Review Notes (Required)</label>
              <textarea
                value={liverPanelReviewNotes}
                onChange={(e) => setLiverPanelReviewNotes(e.target.value)}
                placeholder="Please provide detailed notes about the liver panel review..."
                rows={4}
              />
            </div>

            <div className="review-actions">
              <button
                className="submit-review-btn"
                onClick={handleLiverPanelReviewSubmit}
                disabled={!liverPanelReviewDecision || !liverPanelReviewNotes.trim()}
              >
                Submit Liver Panel Review
              </button>
            </div>
          </div>
        )}

        {/* Final Medical Clearance Section */}
        {(!medicalData?.finalMedicalClearance && medicalData?.ekgStatus === 'approved' && medicalData?.liverPanelStatus === 'approved') && (
          <div className="review-section">
            <h2>Final Medical Clearance</h2>

            <p className="clearance-info">
              Both EKG and Liver Panel have been reviewed. Provide final clearance decision.
            </p>

            <div className="decision-options">
              <label className="decision-option">
                <input
                  type="radio"
                  name="finalDecision"
                  value="approved"
                  checked={reviewDecision === 'approved'}
                  onChange={(e) => setReviewDecision(e.target.value as any)}
                />
                <CheckCircle size={20} />
                <span>Clear for Retreat</span>
              </label>

              <label className="decision-option">
                <input
                  type="radio"
                  name="finalDecision"
                  value="declined"
                  checked={reviewDecision === 'declined'}
                  onChange={(e) => setReviewDecision(e.target.value as any)}
                />
                <XCircle size={20} />
                <span>Not Cleared</span>
              </label>
            </div>

            <div className="review-notes">
              <label>Final Clearance Notes (Required)</label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Please provide final medical clearance decision notes..."
                rows={4}
              />
            </div>

            <div className="review-actions">
              <button
                className="submit-review-btn"
                onClick={handleReviewSubmit}
                disabled={!reviewDecision || !reviewNotes.trim()}
              >
                Submit Final Clearance
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MedicalProfile;
