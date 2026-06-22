import React, { useState, useEffect } from 'react';
import { ClientMedical } from '../types';
import { clientMedicalApi } from '../services/api';
import './ClientsGrid.css';

interface ComprehensiveMedicalTrackingTabProps {
  clientId: string;
  retreatId: string;
}

interface MedicalAction {
  id: string;
  title: string;
  status: string;
  receivedDate?: Date | string;
  reviewedDate?: Date | string;
  approvedDate?: Date | string;
  notes?: string;
  filePath?: string;
  fileName?: string;
  canReceive?: boolean;
  canReview?: boolean;
  canApprove?: boolean;
  specialAction?: string;
}

const ComprehensiveMedicalTrackingTab: React.FC<ComprehensiveMedicalTrackingTabProps> = ({ clientId, retreatId }) => {
  const [medicalData, setMedicalData] = useState<ClientMedical | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [uploading, setUploading] = useState<string>('');

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
          questionnaireStatus: 'pending',
          liverPanelStatus: 'pending',
          ekgStatus: 'pending',
          medicationsFormStatus: 'pending',
          foodIntakeStatus: 'pending',
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#28a745';
      case 'received': return '#374151';
      case 'reviewed': return '#6f42c1';
      case 'pending': return '#ffc107';
      case 'rejected': return '#dc3545';
      case 'sent_to_cook': return '#20c997';
      default: return '#6c757d';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return '✅';
      case 'received': return '📥';
      case 'reviewed': return '👁️';
      case 'pending': return '⏳';
      case 'rejected': return '❌';
      case 'sent_to_cook': return '👨‍🍳';
      default: return '❓';
    }
  };

  const getMedicalActions = (): MedicalAction[] => {
    if (!medicalData) return [];

    return [
      {
        id: 'questionnaire',
        title: 'Questionnaire Received',
        status: medicalData.questionnaireStatus || 'pending',
        receivedDate: medicalData.questionnaireReceivedDate,
        notes: medicalData.questionnaireNotes,
        canReceive: true,
        canReview: medicalData.questionnaireStatus === 'received',
        canApprove: medicalData.questionnaireStatus === 'reviewed'
      },
      {
        id: 'liver_panel',
        title: 'Liver Panel Received',
        status: medicalData.liverPanelStatus || 'pending',
        receivedDate: medicalData.liverPanelReceivedDate,
        reviewedDate: medicalData.liverPanelSentToAdvisorDate,
        notes: medicalData.liverPanelAdvisorNotes,
        filePath: medicalData.liverPanelFilePath,
        fileName: medicalData.liverPanelFileName,
        canReceive: true,
        canReview: medicalData.liverPanelStatus === 'received',
        canApprove: medicalData.liverPanelStatus === 'reviewed'
      },
      {
        id: 'liver_panel_reviewed',
        title: 'Liver Panel Reviewed',
        status: medicalData.liverPanelStatus === 'reviewed' || medicalData.liverPanelStatus === 'approved' ? 'reviewed' : 'pending',
        reviewedDate: medicalData.liverPanelSentToAdvisorDate,
        notes: medicalData.liverPanelAdvisorNotes,
        canReview: medicalData.liverPanelStatus === 'received'
      },
      {
        id: 'liver_panel_approved',
        title: 'Liver Panel Approved',
        status: medicalData.liverPanelStatus === 'approved' ? 'approved' : 'pending',
        approvedDate: medicalData.liverPanelStatus === 'approved' ? medicalData.liverPanelSentToAdvisorDate : undefined,
        canApprove: medicalData.liverPanelStatus === 'reviewed'
      },
      {
        id: 'ekg',
        title: 'EKG Received',
        status: medicalData.ekgStatus || 'pending',
        receivedDate: medicalData.ekgReceivedDate,
        notes: medicalData.ekgAdvisorNotes,
        filePath: medicalData.ekgFilePath,
        fileName: medicalData.ekgFileName,
        canReceive: true,
        canReview: medicalData.ekgStatus === 'received',
        canApprove: medicalData.ekgStatus === 'reviewed'
      },
      {
        id: 'ekg_approved',
        title: 'EKG Approved',
        status: medicalData.ekgStatus === 'approved' ? 'approved' : 'pending',
        approvedDate: medicalData.ekgStatus === 'approved' ? medicalData.ekgSentToAdvisorDate : undefined,
        canApprove: medicalData.ekgStatus === 'reviewed'
      },
      {
        id: 'medications_form',
        title: 'Medications Form Received',
        status: medicalData.medicationsFormStatus || 'pending',
        receivedDate: medicalData.medicationsFormReceivedDate,
        notes: medicalData.medicationsFormNotes,
        filePath: medicalData.medicationsFormFilePath,
        fileName: medicalData.medicationsFormFileName,
        canReceive: true,
        canReview: medicalData.medicationsFormStatus === 'received',
        canApprove: medicalData.medicationsFormStatus === 'reviewed'
      },
      {
        id: 'medications_form_reviewed',
        title: 'Medications Form Reviewed',
        status: medicalData.medicationsFormStatus === 'reviewed' || medicalData.medicationsFormStatus === 'approved' ? 'reviewed' : 'pending',
        canReview: medicalData.medicationsFormStatus === 'received'
      },
      {
        id: 'food_intake',
        title: 'Food Intake Received',
        status: medicalData.foodIntakeStatus || 'pending',
        receivedDate: medicalData.foodIntakeReceivedDate,
        notes: medicalData.foodIntakeNotes,
        filePath: medicalData.foodIntakeFilePath,
        fileName: medicalData.foodIntakeFileName,
        canReceive: true,
        specialAction: 'send_to_cook'
      },
      {
        id: 'food_intake_sent',
        title: 'Food Intake Sent to Cook',
        status: medicalData.foodIntakeStatus === 'sent_to_cook' ? 'sent_to_cook' : 'pending',
        receivedDate: medicalData.foodIntakeSentToCookDate,
        canApprove: medicalData.foodIntakeStatus === 'received'
      }
    ];
  };

  const handleStatusUpdate = async (actionId: string, newStatus: string, notes?: string) => {
    if (!medicalData) return;

    try {
      let updateData: any = {};
      const currentDate = new Date().toISOString();

      switch (actionId) {
        case 'questionnaire':
          updateData = {
            questionnaireStatus: newStatus,
            questionnaireReceivedDate: newStatus === 'received' ? currentDate : medicalData.questionnaireReceivedDate,
            questionnaireNotes: notes || medicalData.questionnaireNotes
          };
          break;
        case 'liver_panel':
          updateData = {
            liverPanelStatus: newStatus,
            liverPanelReceivedDate: newStatus === 'received' ? currentDate : medicalData.liverPanelReceivedDate,
            liverPanelAdvisorNotes: notes || medicalData.liverPanelAdvisorNotes
          };
          break;
        case 'liver_panel_reviewed':
          updateData = {
            liverPanelStatus: 'reviewed',
            liverPanelSentToAdvisorDate: currentDate,
            liverPanelAdvisorNotes: notes || medicalData.liverPanelAdvisorNotes
          };
          break;
        case 'liver_panel_approved':
          updateData = {
            liverPanelStatus: 'approved',
            liverPanelAdvisorNotes: notes || medicalData.liverPanelAdvisorNotes
          };
          break;
        case 'ekg':
          updateData = {
            ekgStatus: newStatus,
            ekgReceivedDate: newStatus === 'received' ? currentDate : medicalData.ekgReceivedDate,
            ekgAdvisorNotes: notes || medicalData.ekgAdvisorNotes
          };
          break;
        case 'ekg_approved':
          updateData = {
            ekgStatus: 'approved',
            ekgAdvisorNotes: notes || medicalData.ekgAdvisorNotes
          };
          break;
        case 'medications_form':
          updateData = {
            medicationsFormStatus: newStatus,
            medicationsFormReceivedDate: newStatus === 'received' ? currentDate : medicalData.medicationsFormReceivedDate,
            medicationsFormNotes: notes || medicalData.medicationsFormNotes
          };
          break;
        case 'medications_form_reviewed':
          updateData = {
            medicationsFormStatus: 'reviewed',
            medicationsFormNotes: notes || medicalData.medicationsFormNotes
          };
          break;
        case 'food_intake':
          updateData = {
            foodIntakeStatus: newStatus,
            foodIntakeReceivedDate: newStatus === 'received' ? currentDate : medicalData.foodIntakeReceivedDate,
            foodIntakeNotes: notes || medicalData.foodIntakeNotes
          };
          break;
        case 'food_intake_sent':
          updateData = {
            foodIntakeStatus: 'sent_to_cook',
            foodIntakeSentToCookDate: currentDate,
            foodIntakeNotes: notes || medicalData.foodIntakeNotes
          };
          break;
      }

      await clientMedicalApi.update(medicalData._id!, updateData);
      await fetchMedicalData(); // Refresh data
    } catch (error) {
      console.error('Error updating medical status:', error);
      alert('Error updating medical status. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="medical-loading">
        <div className="loading-spinner">⏳</div>
        <p>Loading medical tracking data...</p>
      </div>
    );
  }

  const medicalActions = getMedicalActions();
  const completedCount = medicalActions.filter(action =>
    action.status === 'approved' || action.status === 'sent_to_cook'
  ).length;

  return (
    <div className="comprehensive-medical-tab">
      <div className="medical-header">
        <h3>🏥 Comprehensive Medical Tracking</h3>
        <div className="progress-summary">
          <span className="progress-text">
            Progress: {completedCount}/{medicalActions.length} completed
          </span>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${(completedCount / medicalActions.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="medical-actions-grid">
        {medicalActions.map((action) => (
          <div key={action.id} className={`medical-action-card status-${action.status}`}>
            <div className="action-header">
              <div className="action-title">
                <span className="status-icon">{getStatusIcon(action.status)}</span>
                <h4>{action.title}</h4>
              </div>
              <div
                className="status-badge"
                style={{ backgroundColor: getStatusColor(action.status) }}
              >
                {action.status.replace('_', ' ').toUpperCase()}
              </div>
            </div>

            <div className="action-details">
              {action.receivedDate && (
                <div className="detail-row">
                  <strong>Received:</strong> {new Date(action.receivedDate).toLocaleDateString()}
                </div>
              )}
              {action.reviewedDate && (
                <div className="detail-row">
                  <strong>Reviewed:</strong> {new Date(action.reviewedDate).toLocaleDateString()}
                </div>
              )}
              {action.approvedDate && (
                <div className="detail-row">
                  <strong>Approved:</strong> {new Date(action.approvedDate).toLocaleDateString()}
                </div>
              )}
              {action.fileName && (
                <div className="detail-row">
                  <strong>File:</strong> {action.fileName}
                </div>
              )}
              {action.notes && (
                <div className="detail-row">
                  <strong>Notes:</strong>
                  <div className="notes-content">{action.notes}</div>
                </div>
              )}
            </div>

            <div className="action-buttons">
              {action.canReceive && action.status === 'pending' && (
                <button
                  onClick={() => handleStatusUpdate(action.id, 'received')}
                  className="action-btn receive-btn"
                >
                  📥 Mark Received
                </button>
              )}
              {action.canReview && (
                <button
                  onClick={() => handleStatusUpdate(action.id, 'reviewed')}
                  className="action-btn review-btn"
                >
                  👁️ Mark Reviewed
                </button>
              )}
              {action.canApprove && (
                <button
                  onClick={() => handleStatusUpdate(action.id, 'approved')}
                  className="action-btn approve-btn"
                >
                  ✅ Approve
                </button>
              )}
              {action.specialAction === 'send_to_cook' && action.status === 'received' && (
                <button
                  onClick={() => handleStatusUpdate('food_intake_sent', 'sent_to_cook')}
                  className="action-btn cook-btn"
                >
                  👨‍🍳 Send to Cook
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {medicalData?.finalMedicalClearance && (
        <div className="final-clearance">
          <div className="clearance-badge">
            ✅ Final Medical Clearance Approved
          </div>
          {medicalData.medicalClearanceDate && (
            <p>Approved on: {new Date(medicalData.medicalClearanceDate).toLocaleDateString()}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default ComprehensiveMedicalTrackingTab;