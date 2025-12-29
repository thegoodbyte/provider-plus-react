import React, { useState, useEffect } from 'react';
import { ClientMedical } from '../types';
import { clientMedicalApi } from '../services/api';
import './ClientsGrid.css';

interface MedicalTrackingTabProps {
  clientId: string;
  retreatId: string;
}

const MedicalTrackingTab: React.FC<MedicalTrackingTabProps> = ({ clientId, retreatId }) => {
  const [medicalData, setMedicalData] = useState<ClientMedical | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingLiver, setUploadingLiver] = useState(false);
  const [uploadingEkg, setUploadingEkg] = useState(false);

  useEffect(() => {
    fetchMedicalData();
  }, [clientId, retreatId]);

  const fetchMedicalData = async () => {
    try {
      setIsLoading(true);
      const response = await clientMedicalApi.getByClientAndRetreat(clientId, retreatId);
      setMedicalData(response.data);
    } catch (error) {
      console.error('Error fetching medical data:', error);
      // Create initial record if none exists
      try {
        const newRecord = await clientMedicalApi.create({
          clientId,
          retreatId,
          liverPanelStatus: 'pending',
          ekgStatus: 'pending',
          finalMedicalClearance: false
        });
        setMedicalData(newRecord.data);
      } catch (createError) {
        console.error('Error creating medical record:', createError);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLiverPanelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingLiver(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('clientId', clientId);
      formData.append('retreatId', retreatId);

      await clientMedicalApi.uploadFile(formData, 'liver-panel');
      await fetchMedicalData(); // Refresh data
    } catch (error) {
      console.error('Error uploading liver panel:', error);
      alert('Error uploading liver panel. Please try again.');
    } finally {
      setUploadingLiver(false);
      event.target.value = ''; // Reset file input
    }
  };

  const handleEkgUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingEkg(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('clientId', clientId);
      formData.append('retreatId', retreatId);

      await clientMedicalApi.uploadFile(formData, 'ekg');
      await fetchMedicalData(); // Refresh data
    } catch (error) {
      console.error('Error uploading EKG:', error);
      alert('Error uploading EKG. Please try again.');
    } finally {
      setUploadingEkg(false);
      event.target.value = ''; // Reset file input
    }
  };

  const handleReviewUpdate = async (type: 'liver' | 'ekg', advisorNotes: string, status: string) => {
    if (!medicalData) return;

    try {
      if (type === 'liver') {
        await clientMedicalApi.reviewLiverPanel(medicalData._id!, { advisorNotes, status });
      } else {
        await clientMedicalApi.reviewEkg(medicalData._id!, { advisorNotes, status });
      }
      await fetchMedicalData(); // Refresh data
    } catch (error) {
      console.error(`Error updating ${type} review:`, error);
      alert(`Error updating ${type} review. Please try again.`);
    }
  };

  const handleMedicalClearanceUpdate = async (clearanceData: {
    finalMedicalClearance: boolean;
    medicalClearanceNotes: string;
    medicalAdvisorName?: string;
    medicalAdvisorEmail?: string;
  }) => {
    if (!medicalData) return;

    try {
      await clientMedicalApi.updateMedicalClearance(medicalData._id!, clearanceData);
      await fetchMedicalData(); // Refresh data
    } catch (error) {
      console.error('Error updating medical clearance:', error);
      alert('Error updating medical clearance. Please try again.');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusClass = `status-${status.toLowerCase()}`;
    return <span className={`status-badge ${statusClass}`}>{status}</span>;
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">🏥</div>
        <p>Loading medical tracking...</p>
      </div>
    );
  }

  return (
    <div className="medical-tracking-container">
      <div className="form-grid">
        {/* Liver Panel Section */}
        <div className="form-section">
          <h4>🧪 Liver Panel</h4>

          <div className="medical-status">
            <strong>Status:</strong> {medicalData?.liverPanelStatus && getStatusBadge(medicalData.liverPanelStatus)}
          </div>

          {medicalData?.liverPanelReceivedDate && (
            <p><strong>Received:</strong> {new Date(medicalData.liverPanelReceivedDate).toLocaleDateString()}</p>
          )}

          {medicalData?.liverPanelFileName && (
            <p><strong>File:</strong> {medicalData.liverPanelFileName}</p>
          )}

          <div className="form-group">
            <label htmlFor="liver-upload">Upload Liver Panel:</label>
            <input
              type="file"
              id="liver-upload"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={handleLiverPanelUpload}
              disabled={uploadingLiver}
            />
            {uploadingLiver && <p>Uploading...</p>}
          </div>

          {medicalData?.liverPanelSentToAdvisorDate && (
            <p><strong>Sent to Advisor:</strong> {new Date(medicalData.liverPanelSentToAdvisorDate).toLocaleDateString()}</p>
          )}

          {medicalData?.liverPanelAdvisorNotes && (
            <div className="form-group">
              <label>Advisor Notes:</label>
              <textarea
                value={medicalData.liverPanelAdvisorNotes}
                readOnly
                rows={3}
                style={{ background: '#f8f9fa' }}
              />
            </div>
          )}

          <div className="advisor-review-section">
            <h5>Medical Advisor Review</h5>
            <AdvisorReviewForm
              type="liver"
              onSubmit={(notes, status) => handleReviewUpdate('liver', notes, status)}
              currentNotes={medicalData?.liverPanelAdvisorNotes || ''}
              currentStatus={medicalData?.liverPanelStatus || 'pending'}
            />
          </div>
        </div>

        {/* EKG Section */}
        <div className="form-section">
          <h4>❤️ EKG</h4>

          <div className="medical-status">
            <strong>Status:</strong> {medicalData?.ekgStatus && getStatusBadge(medicalData.ekgStatus)}
          </div>

          {medicalData?.ekgReceivedDate && (
            <p><strong>Received:</strong> {new Date(medicalData.ekgReceivedDate).toLocaleDateString()}</p>
          )}

          {medicalData?.ekgFileName && (
            <p><strong>File:</strong> {medicalData.ekgFileName}</p>
          )}

          <div className="form-group">
            <label htmlFor="ekg-upload">Upload EKG:</label>
            <input
              type="file"
              id="ekg-upload"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={handleEkgUpload}
              disabled={uploadingEkg}
            />
            {uploadingEkg && <p>Uploading...</p>}
          </div>

          {medicalData?.ekgSentToAdvisorDate && (
            <p><strong>Sent to Advisor:</strong> {new Date(medicalData.ekgSentToAdvisorDate).toLocaleDateString()}</p>
          )}

          {medicalData?.ekgAdvisorNotes && (
            <div className="form-group">
              <label>Advisor Notes:</label>
              <textarea
                value={medicalData.ekgAdvisorNotes}
                readOnly
                rows={3}
                style={{ background: '#f8f9fa' }}
              />
            </div>
          )}

          <div className="advisor-review-section">
            <h5>Medical Advisor Review</h5>
            <AdvisorReviewForm
              type="ekg"
              onSubmit={(notes, status) => handleReviewUpdate('ekg', notes, status)}
              currentNotes={medicalData?.ekgAdvisorNotes || ''}
              currentStatus={medicalData?.ekgStatus || 'pending'}
            />
          </div>
        </div>

        {/* Medical Clearance Section */}
        <div className="form-section">
          <h4>✅ Medical Clearance</h4>

          <div className="medical-status">
            <strong>Clearance Status:</strong>
            <span className={`status-badge ${medicalData?.finalMedicalClearance ? 'status-approved' : 'status-pending'}`}>
              {medicalData?.finalMedicalClearance ? 'Approved' : 'Pending'}
            </span>
          </div>

          {medicalData?.medicalClearanceDate && (
            <p><strong>Clearance Date:</strong> {new Date(medicalData.medicalClearanceDate).toLocaleDateString()}</p>
          )}

          <div className="form-group">
            <label htmlFor="advisor-name">Medical Advisor Name:</label>
            <input
              type="text"
              id="advisor-name"
              defaultValue={medicalData?.medicalAdvisorName || ''}
              placeholder="Dr. Smith"
            />
          </div>

          <div className="form-group">
            <label htmlFor="advisor-email">Medical Advisor Email:</label>
            <input
              type="email"
              id="advisor-email"
              defaultValue={medicalData?.medicalAdvisorEmail || ''}
              placeholder="dr.smith@medical.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="clearance-notes">Medical Clearance Notes:</label>
            <textarea
              id="clearance-notes"
              defaultValue={medicalData?.medicalClearanceNotes || ''}
              placeholder="Final medical clearance notes..."
              rows={4}
            />
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                defaultChecked={medicalData?.finalMedicalClearance || false}
                onChange={(e) => {
                  const advisorName = (document.getElementById('advisor-name') as HTMLInputElement)?.value;
                  const advisorEmail = (document.getElementById('advisor-email') as HTMLInputElement)?.value;
                  const clearanceNotes = (document.getElementById('clearance-notes') as HTMLTextAreaElement)?.value;

                  handleMedicalClearanceUpdate({
                    finalMedicalClearance: e.target.checked,
                    medicalClearanceNotes: clearanceNotes,
                    medicalAdvisorName: advisorName,
                    medicalAdvisorEmail: advisorEmail
                  });
                }}
              />
              <span style={{ marginLeft: '8px' }}>Final Medical Clearance Approved</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

interface AdvisorReviewFormProps {
  type: 'liver' | 'ekg';
  onSubmit: (notes: string, status: string) => void;
  currentNotes: string;
  currentStatus: string;
}

const AdvisorReviewForm: React.FC<AdvisorReviewFormProps> = ({ type, onSubmit, currentNotes, currentStatus }) => {
  const [notes, setNotes] = useState(currentNotes);
  const [status, setStatus] = useState(currentStatus);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(notes, status);
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: '16px' }}>
      <div className="form-group">
        <label htmlFor={`${type}-status`}>Review Status:</label>
        <select
          id={`${type}-status`}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="pending">Pending</option>
          <option value="received">Received</option>
          <option value="reviewed">Reviewed</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor={`${type}-notes`}>Advisor Notes:</label>
        <textarea
          id={`${type}-notes`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={`Medical advisor notes for ${type}...`}
          rows={3}
        />
      </div>

      <button type="submit" className="save-btn" style={{ marginTop: '12px' }}>
        Update {type === 'liver' ? 'Liver Panel' : 'EKG'} Review
      </button>
    </form>
  );
};

export default MedicalTrackingTab;