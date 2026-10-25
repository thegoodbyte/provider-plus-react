import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, User, Calendar, Heart, FileText, AlertCircle, Download, CheckCircle, XCircle } from 'lucide-react';
import { API_BASE_URL } from '../config/api.config';
import { medicalArtifactsApi, medicalReviewRequestsApi } from '../services/api';
import { MedicalArtifact, MedicalReviewRequest } from '../types';
import { resolveMedicalProfile, medicalProfileStatusLabel, objectId, ProfileDocument } from './medicalProfileData';
import { useToast } from '../hooks/useToast';
import Toast from './Toast';
import './MedicalProfile.css';

interface MedicalData {
  legacyRetreatId?: string;
  ekgSource?: ProfileDocument;
  liverPanelSource?: ProfileDocument;
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
  const location = useLocation();
  const routePrefix = location.pathname.startsWith('/admin') ? '/admin' : '/medical';
  const loadVersion = useRef(0);
  const [sourceWarnings, setSourceWarnings] = useState<string[]>([]);
  const [loadError, setLoadError] = useState('');
  const { toast, showSuccess, showError, dismiss: dismissToast } = useToast();
  const [client, setClient] = useState<Client | null>(null);
  const [medicalData, setMedicalData] = useState<MedicalData | null>(null);
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewDecision, setReviewDecision] = useState<'approved' | 'declined' | 'needs_more_info' | ''>('');
  const [activeRetreatId, setActiveRetreatId] = useState<string | null>(null);


  // Separate state for EKG and Liver Panel reviews
  const [ekgReviewNotes, setEkgReviewNotes] = useState('');
  const [ekgReviewDecision, setEkgReviewDecision] = useState<'approved' | 'declined' | 'needs_more_info' | ''>('');
  const [liverPanelReviewNotes, setLiverPanelReviewNotes] = useState('');
  const [liverPanelReviewDecision, setLiverPanelReviewDecision] = useState<'approved' | 'declined' | 'needs_more_info' | ''>('');

  const legacyReviewContext = Boolean(activeRetreatId && activeRetreatId === medicalData?.legacyRetreatId);

  const getDocumentUrl = (filePath?: string) => {
    if (!filePath) return '';
    if (/^https?:\/\//i.test(filePath)) return filePath;
    return `${API_BASE_URL}${filePath}`;
  };

  useEffect(() => {
    setClient(null); setMedicalData(null); setRetreats([]); setActiveRetreatId(null); setSourceWarnings([]); setLoadError('');
    if (clientId && /^[a-f0-9]{24}$/i.test(clientId)) void fetchClientData();
    else setLoading(false);
    return () => { loadVersion.current += 1; };
  }, [clientId]);

  const fetchClientData = async () => {
    if (!clientId) return;
    const version = ++loadVersion.current;
    const current = () => loadVersion.current === version;
    setLoading(true); setLoadError('');
    try {
      const token = localStorage.getItem('token');
      const user = JSON.parse(localStorage.getItem('user') || 'null');
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
      const clientUrl = user?.role === 'medical_advisor' ? `${API_BASE_URL}/medical-advisor/client/${clientId}` : `${API_BASE_URL}/clients/${clientId}`;
      const response = await fetch(clientUrl, { headers });
      if (!response.ok) throw new Error(response.status === 404 ? 'Client not found' : 'Client information could not be loaded.');
      const data = await response.json();
      if (data._id && data._id !== clientId) throw new Error('Client information did not match this profile.');
      if (!current()) return;
      setClient({ _id: data._id, clientNumber: data.clientNumber || data.display_id || '#0000', firstName: data.firstName || data.fname || 'Unknown', lastName: data.lastName || data.lname || '', dateOfBirth: data.dateOfBirth });
      const array = (value: unknown): any[] => { if (!Array.isArray(value)) throw new Error('Invalid collection response'); return value; };
      const legacy = async () => {
        const result = await fetch(`${API_BASE_URL}/client-medical/client/${clientId}`, { headers });
        if (result.status === 404) return [];
        if (!result.ok) throw new Error('Legacy records unavailable');
        return array(await result.json());
      };
      const [records, artifacts, reviews] = await Promise.allSettled([
        legacy(),
        medicalArtifactsApi.getAll({ clientId }, { suppressGlobalError: true }).then(result => array(result.data)),
        medicalReviewRequestsApi.getAll({ clientId }, { suppressGlobalError: true }).then(result => array(result.data)),
      ]);
      if (!current()) return;
      setSourceWarnings([
        ...(records.status === 'rejected' ? ['Legacy medical records could not be loaded.'] : []),
        ...(artifacts.status === 'rejected' ? ['Medical documents could not be loaded. Document availability may be incomplete.'] : []),
        ...(reviews.status === 'rejected' ? ['Medical review status could not be loaded.'] : []),
      ]);
      const model = resolveMedicalProfile({ clientId,
        legacyRecords: records.status === 'fulfilled' ? records.value : [],
        artifacts: (artifacts.status === 'fulfilled' ? artifacts.value : []) as MedicalArtifact[],
        reviews: (reviews.status === 'fulfilled' ? reviews.value : []) as MedicalReviewRequest[],
        legacyAvailable: records.status === 'fulfilled', artifactsAvailable: artifacts.status === 'fulfilled',
      });
      setMedicalData({ ...model.legacy, legacyRetreatId: objectId(model.legacy.retreatId),
        ekgStatus: model.ekg.status, ekgReceivedDate: model.ekg.receivedAt, ekgFileName: model.ekg.fileName, ekgFilePath: model.ekg.filePath, ekgAdvisorNotes: model.ekg.notes, ekgSource: model.ekg,
        liverPanelStatus: model.liver.status, liverPanelReceivedDate: model.liver.receivedAt, liverPanelFileName: model.liver.fileName, liverPanelFilePath: model.liver.filePath, liverPanelAdvisorNotes: model.liver.notes, liverPanelSource: model.liver,
      });
      setRetreats(model.retreats);
      setActiveRetreatId(value => value && model.retreats.some(retreat => retreat._id === value) ? value : objectId(model.legacy.retreatId) || model.retreats[0]?._id || null);
    } catch (error) {
      if (current()) { setClient(null); setLoadError(error instanceof Error ? error.message : 'Client information could not be loaded.'); }
    } finally { if (current()) setLoading(false); }
  };

  const documentUrl = (source?: ProfileDocument) => source?.artifact?._id && source.fileIndex !== undefined
    ? `${routePrefix}/medical-artifacts/${source.artifact._id}/files/${source.fileIndex}`
    : source?.filePath ? getDocumentUrl(source.filePath) : '';

  const handleEkgReviewSubmit = async () => {
    if (!legacyReviewContext || !medicalData?.ekgSource?.legacyReview) return;
    if (!ekgReviewDecision || !ekgReviewNotes.trim()) {
      showError('Please select a decision and provide review notes.');
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
        showSuccess('EKG review submitted successfully.');
        fetchClientData();
        setEkgReviewNotes('');
        setEkgReviewDecision('');
      } else {
        showError('Failed to submit EKG review.');
      }
    } catch (error) {
      console.error('Error submitting EKG review:', error);
      showError('Failed to submit EKG review.');
    }
  };

  const handleLiverPanelReviewSubmit = async () => {
    if (!legacyReviewContext || !medicalData?.liverPanelSource?.legacyReview) return;
    if (!liverPanelReviewDecision || !liverPanelReviewNotes.trim()) {
      showError('Please select a decision and provide review notes.');
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
        showSuccess('Liver panel review submitted successfully.');
        fetchClientData();
        setLiverPanelReviewNotes('');
        setLiverPanelReviewDecision('');
      } else {
        showError('Failed to submit liver panel review.');
      }
    } catch (error) {
      console.error('Error submitting liver panel review:', error);
      showError('Failed to submit liver panel review.');
    }
  };

  const handleReviewSubmit = async () => {
    if (!legacyReviewContext) return;
    if (!reviewDecision || !reviewNotes.trim()) {
      showError('Please select a decision and provide review notes.');
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
        showSuccess('Review submitted successfully.');
        fetchClientData(); // Refresh data
        setReviewNotes('');
        setReviewDecision('');
      } else {
        showError('Failed to submit review.');
      }
    } catch (error) {
      console.error('Error submitting review:', error);
      showError('Failed to submit review.');
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
        <div role="alert" className="error">{loadError || 'Client not found'}</div>
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

        {sourceWarnings.length > 0 && <p role="alert" className="medical-source-warning">{sourceWarnings.join(' ')}</p>}

        <div className="medical-documents">
          <h2>Medical Documents</h2>

          <div className="document-grid">
            <section aria-label="Liver Panel" className="document-card">
              <div className="document-header">
                <FileText size={24} />
                <h3>Liver Panel</h3>
                <span className={`status-badge ${getStatusColor(medicalData?.liverPanelStatus)}`}>
                  {medicalProfileStatusLabel(medicalData?.liverPanelStatus)}
                </span>
              </div>

              {medicalData?.liverPanelSource?.present ? (
                <div className="document-content">
                  <p className="upload-date">
                    {medicalData.liverPanelReceivedDate ? `Received: ${formatDate(medicalData.liverPanelReceivedDate)}` : 'Received date not recorded'}
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
                  {medicalData.liverPanelSource?.review?._id && <p><a className="medical-review-link" href={`${routePrefix}/medical-review-requests/${medicalData.liverPanelSource.review._id}`}>MRR #{medicalData.liverPanelSource.review.display_id || '—'}</a></p>}
                  {!documentUrl(medicalData.liverPanelSource) && <p>No accessible file is available for this document.</p>}
                  {documentUrl(medicalData.liverPanelSource) && (
                    <a
                      href={documentUrl(medicalData.liverPanelSource)}
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
                  <p>{medicalData?.liverPanelStatus === 'unavailable' ? 'Document availability could not be confirmed.' : 'No liver panel uploaded yet'}</p>
                </div>
              )}
            </section>

            <section aria-label="EKG Report" className="document-card">
              <div className="document-header">
                <Heart size={24} />
                <h3>EKG Report</h3>
                <span className={`status-badge ${getStatusColor(medicalData?.ekgStatus)}`}>
                  {medicalProfileStatusLabel(medicalData?.ekgStatus)}
                </span>
              </div>

              {medicalData?.ekgSource?.present ? (
                <div className="document-content">
                  <p className="upload-date">
                    {medicalData.ekgReceivedDate ? `Received: ${formatDate(medicalData.ekgReceivedDate)}` : 'Received date not recorded'}
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
                  {medicalData.ekgSource?.review?._id && <p><a className="medical-review-link" href={`${routePrefix}/medical-review-requests/${medicalData.ekgSource.review._id}`}>MRR #{medicalData.ekgSource.review.display_id || '—'}</a></p>}
                  {!documentUrl(medicalData.ekgSource) && <p>No accessible file is available for this document.</p>}
                  {documentUrl(medicalData.ekgSource) && (
                    <a
                      href={documentUrl(medicalData.ekgSource)}
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
                  <p>{medicalData?.ekgStatus === 'unavailable' ? 'Document availability could not be confirmed.' : 'No EKG uploaded yet'}</p>
                </div>
              )}
            </section>
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
        {legacyReviewContext && medicalData?.ekgSource?.legacyReview && medicalData?.ekgStatus === 'received' && (
          <div className="review-section">
            <h2>EKG Review</h2>

            <div className="document-review-header">
              <Heart size={24} />
              <span>Review EKG Results</span>
              {medicalData.ekgFileName && (
                <a
                  href={documentUrl(medicalData.ekgSource)}
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
        {legacyReviewContext && medicalData?.liverPanelSource?.legacyReview && medicalData?.liverPanelStatus === 'received' && (
          <div className="review-section">
            <h2>Liver Panel Review</h2>

            <div className="document-review-header">
              <FileText size={24} />
              <span>Review Liver Panel Results</span>
              {medicalData.liverPanelFileName && (
                <a
                  href={documentUrl(medicalData.liverPanelSource)}
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
        {(legacyReviewContext && medicalData?.ekgSource?.legacyReview && medicalData?.liverPanelSource?.legacyReview && !medicalData?.finalMedicalClearance && medicalData?.ekgStatus === 'approved' && medicalData?.liverPanelStatus === 'approved') && (
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
