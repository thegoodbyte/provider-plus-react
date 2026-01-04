import React, { useState, useEffect } from 'react';
import { CeremonyParticipant, Ceremony } from '../types';
import { ceremoniesApi } from '../services/api';
import moment from 'moment';

interface ClientCeremoniesTabProps {
  clientId: string;
}

const ClientCeremoniesTab: React.FC<ClientCeremoniesTabProps> = ({ clientId }) => {
  const [participations, setParticipations] = useState<CeremonyParticipant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchParticipations();
  }, [clientId]);

  const fetchParticipations = async () => {
    try {
      setLoading(true);
      const response = await ceremoniesApi.getClientParticipations(clientId);
      setParticipations(response.data);
    } catch (error) {
      console.error('Error fetching ceremony participations:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (time: string | undefined) => {
    return time ? moment(time, 'HH:mm').format('HH:mm') : 'N/A';
  };

  const getMedicalClearanceColor = (clearance: string | undefined) => {
    switch (clearance) {
      case 'approved': return '#28a745';
      case 'not_approved': return '#dc3545';
      case 'conditional': return '#ffc107';
      default: return '#6c757d';
    }
  };

  if (loading) {
    return (
      <div className="ceremonies-loading">
        <div className="loading-spinner">⏳</div>
        <p>Loading ceremony participations...</p>
      </div>
    );
  }

  if (participations.length === 0) {
    return (
      <div className="no-ceremonies">
        <h3>🔮 No Ceremony Participations Found</h3>
        <p>This client has not participated in any ceremonies yet.</p>
      </div>
    );
  }

  return (
    <div className="ceremonies-tab">
      <h2>🔮 Ceremony Participation History</h2>

      <div className="ceremonies-grid">
        {participations.map((participation, index) => {
          const ceremony = participation.ceremonyId as any; // populated ceremony data

          return (
            <div key={index} className="ceremony-card">
              <div className="ceremony-header">
                <h3>
                  🔮 Ceremony #{ceremony?.ceremonyNumber || 'N/A'}
                </h3>
                <span className="ceremony-date">
                  {ceremony?.date ? moment(ceremony.date).format('MMM DD, YYYY') : 'Date TBD'}
                </span>
              </div>

              <div className="ceremony-details">
                <div className="detail-section">
                  <h4>📋 Basic Information</h4>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <strong>Participated:</strong>
                      <span className={`status-badge ${participation.participated ? 'status-confirmed' : 'status-cancelled'}`}>
                        {participation.participated ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="detail-item">
                      <strong>Arrival Time:</strong> {formatTime(participation.arrivalTime)}
                    </div>
                    <div className="detail-item">
                      <strong>Departure Time:</strong> {formatTime(participation.departureTime)}
                    </div>
                  </div>
                </div>

                <div className="detail-section">
                  <h4>🩺 Medical Clearance</h4>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <strong>Status:</strong>
                      <span
                        className="status-badge"
                        style={{
                          backgroundColor: getMedicalClearanceColor(participation.medicalClearance),
                          color: 'white'
                        }}
                      >
                        {participation.medicalClearance?.replace('_', ' ').toUpperCase() || 'PENDING'}
                      </span>
                    </div>
                    <div className="detail-item full-width">
                      <strong>Medical Notes:</strong>
                      <p>{participation.medicalClearanceNotes || 'No notes available'}</p>
                    </div>
                  </div>

                  {participation.preCeremonyEkg && (
                    <div className="medical-check">
                      <strong>EKG Check:</strong>
                      <span className={`status-badge ${participation.preCeremonyEkg.approved ? 'status-confirmed' : 'status-pending'}`}>
                        {participation.preCeremonyEkg.approved ? 'Approved' : 'Pending'}
                      </span>
                      {participation.preCeremonyEkg.notes && (
                        <p className="medical-notes">{participation.preCeremonyEkg.notes}</p>
                      )}
                    </div>
                  )}

                  {participation.preCeremonyBloodPressure && (
                    <div className="medical-check">
                      <strong>Blood Pressure:</strong>
                      <span>
                        {participation.preCeremonyBloodPressure.systolic}/
                        {participation.preCeremonyBloodPressure.diastolic}
                        {participation.preCeremonyBloodPressure.pulse && ` (${participation.preCeremonyBloodPressure.pulse} bpm)`}
                      </span>
                      <span className={`status-badge ${participation.preCeremonyBloodPressure.approved ? 'status-confirmed' : 'status-pending'}`}>
                        {participation.preCeremonyBloodPressure.approved ? 'Approved' : 'Pending'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="detail-section">
                  <h4>🥄 Medicine Intake</h4>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <strong>Spoons Taken:</strong> {participation.spoonsTaken || 0}
                    </div>
                    <div className="detail-item">
                      <strong>First Spoon Time:</strong> {formatTime(participation.firstSpoonTime)}
                    </div>
                  </div>

                  {participation.additionalSpoons && participation.additionalSpoons.length > 0 && (
                    <div className="additional-spoons">
                      <strong>Additional Spoons:</strong>
                      <ul>
                        {participation.additionalSpoons.map((spoon, idx) => (
                          <li key={idx}>
                            Spoon #{spoon.spoonNumber} at {formatTime(spoon.time)}
                            {spoon.amount && ` (${spoon.amount})`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="detail-section">
                  <h4>🤮 Purging Information</h4>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <strong>Purged:</strong>
                      <span className={`status-badge ${participation.purged ? 'status-confirmed' : 'status-cancelled'}`}>
                        {participation.purged ? 'Yes' : 'No'}
                      </span>
                    </div>
                    {participation.purged && (
                      <>
                        <div className="detail-item">
                          <strong>Purge Time:</strong> {formatTime(participation.purgeTime)}
                        </div>
                        <div className="detail-item full-width">
                          <strong>Purge Details:</strong>
                          <p>{participation.purgeDetails || 'No details recorded'}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="detail-section">
                  <h4>📝 Notes & Observations</h4>
                  {participation.individualNotes && (
                    <div className="note-section">
                      <strong>Individual Notes:</strong>
                      <p>{participation.individualNotes}</p>
                    </div>
                  )}

                  {participation.experienceNotes && (
                    <div className="note-section">
                      <strong>Experience Notes:</strong>
                      <p>{participation.experienceNotes}</p>
                    </div>
                  )}

                  {participation.facilitatorObservations && (
                    <div className="note-section">
                      <strong>Facilitator Observations:</strong>
                      <p>{participation.facilitatorObservations}</p>
                    </div>
                  )}

                  {participation.postCeremonyStatus && (
                    <div className="detail-item">
                      <strong>Post-Ceremony Status:</strong>
                      <span className={`status-badge ${
                        participation.postCeremonyStatus === 'good' ? 'status-confirmed' :
                        participation.postCeremonyStatus === 'needs_support' ? 'status-pending' :
                        'status-cancelled'
                      }`}>
                        {participation.postCeremonyStatus.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                  )}

                  {participation.postCeremonyNotes && (
                    <div className="note-section">
                      <strong>Post-Ceremony Notes:</strong>
                      <p>{participation.postCeremonyNotes}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ClientCeremoniesTab;