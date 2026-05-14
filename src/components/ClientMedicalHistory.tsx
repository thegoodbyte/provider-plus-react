import React, { useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { API_BASE_URL } from '../config/api.config';
import './ClientMedicalHistory.css';

interface ClientMedicalHistoryProps {
    clientId: string;
    clientName?: string;
}

interface MedicalRecord {
    _id: string;
    clientId: any;
    retreatId: any;
    bookingId?: any;
    recordType: 'booking' | 'ceremony';
    version?: number;
    testDate?: string;
    liverPanelStatus: string;
    liverPanelReceivedDate?: string;
    liverPanelFileName?: string;
    liverPanelResults?: string;
    liverPanelAdvisorNotes?: string;
    ekgStatus: string;
    ekgReceivedDate?: string;
    ekgFileName?: string;
    ekgResults?: string;
    ekgAdvisorNotes?: string;
    bloodPressureSystolic?: number;
    bloodPressureDiastolic?: number;
    bloodPressureRecordedDate?: string;
    finalMedicalClearance: boolean;
    medicalClearanceDate?: string;
    medicalClearanceNotes?: string;
    createdAt: string;
    updatedAt: string;
}

const ClientMedicalHistory: React.FC<ClientMedicalHistoryProps> = ({
    clientId,
    clientName
}) => {
    const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [groupByRetreat, setGroupByRetreat] = useState(true);

    useEffect(() => {
        fetchClientMedicalHistory();
    }, [clientId]);

    const fetchClientMedicalHistory = async () => {
        try {
            setLoading(true);
            setError(null);
            const token = authService.getToken();
            const response = await fetch(`${API_BASE_URL}/client-medical/client/${clientId}/history`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setMedicalRecords(data);
            } else {
                setError('Failed to load medical history');
            }
        } catch (err) {
            setError('Error loading medical history');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString();
    };

    const getStatusBadgeClass = (status: string) => {
        switch (status) {
            case 'pending': return 'badge-pending';
            case 'received': return 'badge-received';
            case 'approved': return 'badge-approved';
            case 'rejected': return 'badge-rejected';
            case 'reviewed': return 'badge-reviewed';
            default: return 'badge-default';
        }
    };

    const groupRecordsByRetreat = () => {
        const grouped: { [key: string]: MedicalRecord[] } = {};

        medicalRecords.forEach(record => {
            const retreatKey = record.retreatId?._id || record.retreatId || 'unknown';
            if (!grouped[retreatKey]) {
                grouped[retreatKey] = [];
            }
            grouped[retreatKey].push(record);
        });

        return grouped;
    };

    if (loading) {
        return (
            <div className="client-medical-history">
                <div className="loading">Loading medical history...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="client-medical-history">
                <div className="alert alert-danger">{error}</div>
            </div>
        );
    }

    const groupedRecords = groupByRetreat ? groupRecordsByRetreat() : { all: medicalRecords };

    return (
        <div className="client-medical-history">
            <div className="history-header">
                <h2>Medical History {clientName && `- ${clientName}`}</h2>
                <div className="view-controls">
                    <button
                        className={`view-btn ${groupByRetreat ? 'active' : ''}`}
                        onClick={() => setGroupByRetreat(true)}
                    >
                        <i className="fas fa-layer-group"></i> Group by Retreat
                    </button>
                    <button
                        className={`view-btn ${!groupByRetreat ? 'active' : ''}`}
                        onClick={() => setGroupByRetreat(false)}
                    >
                        <i className="fas fa-list"></i> Chronological
                    </button>
                </div>
            </div>

            {medicalRecords.length === 0 ? (
                <div className="no-records">
                    <i className="fas fa-file-medical fa-3x"></i>
                    <p>No medical records found for this client</p>
                </div>
            ) : (
                <div className="records-container">
                    {Object.entries(groupedRecords).map(([retreatKey, records]) => (
                        <div key={retreatKey} className="retreat-group">
                            {groupByRetreat && retreatKey !== 'all' && (
                                <div className="retreat-header">
                                    <h3>
                                        {records[0]?.retreatId?.name || 'Unknown Retreat'}
                                    </h3>
                                    <div className="retreat-info">
                                        <span>{records[0]?.retreatId?.location}</span>
                                        {records[0]?.retreatId?.startDate && (
                                            <span> • {formatDate(records[0].retreatId.startDate)}</span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {records.map((record) => (
                                <div key={record._id} className="medical-record-card">
                                    <div className="record-header">
                                        <div className="record-meta">
                                            <span className="record-type">{record.recordType}</span>
                                            {record.version && <span className="version">v{record.version}</span>}
                                            <span className="date">{formatDate(record.createdAt)}</span>
                                        </div>
                                        <div className="clearance-indicator">
                                            {record.finalMedicalClearance ? (
                                                <span className="clearance-approved">
                                                    <i className="fas fa-check-circle"></i> Cleared
                                                </span>
                                            ) : (
                                                <span className="clearance-pending">
                                                    <i className="fas fa-clock"></i> Pending
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="record-body">
                                        {!groupByRetreat && (
                                            <div className="retreat-context">
                                                <strong>Retreat:</strong> {record.retreatId?.name || 'N/A'}
                                                {record.bookingId && (
                                                    <span> (Booking: {record.bookingId.bookingNumber || record.bookingId})</span>
                                                )}
                                            </div>
                                        )}

                                        <div className="tests-grid">
                                            <div className="test-item">
                                                <h4><i className="fas fa-vial"></i> Liver Panel</h4>
                                                <div className={`status-badge ${getStatusBadgeClass(record.liverPanelStatus)}`}>
                                                    {record.liverPanelStatus}
                                                </div>
                                                {record.liverPanelFileName && (
                                                    <div className="file-info">
                                                        <i className="fas fa-file"></i> {record.liverPanelFileName}
                                                    </div>
                                                )}
                                                {record.liverPanelReceivedDate && (
                                                    <div className="date-info">
                                                        Received: {formatDate(record.liverPanelReceivedDate)}
                                                    </div>
                                                )}
                                                {record.liverPanelAdvisorNotes && (
                                                    <div className="notes">
                                                        <strong>Notes:</strong> {record.liverPanelAdvisorNotes}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="test-item">
                                                <h4><i className="fas fa-heartbeat"></i> EKG</h4>
                                                <div className={`status-badge ${getStatusBadgeClass(record.ekgStatus)}`}>
                                                    {record.ekgStatus}
                                                </div>
                                                {record.ekgFileName && (
                                                    <div className="file-info">
                                                        <i className="fas fa-file"></i> {record.ekgFileName}
                                                    </div>
                                                )}
                                                {record.ekgReceivedDate && (
                                                    <div className="date-info">
                                                        Received: {formatDate(record.ekgReceivedDate)}
                                                    </div>
                                                )}
                                                {record.ekgAdvisorNotes && (
                                                    <div className="notes">
                                                        <strong>Notes:</strong> {record.ekgAdvisorNotes}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {(record.bloodPressureSystolic || record.bloodPressureDiastolic) && (
                                            <div className="blood-pressure-section">
                                                <h4><i className="fas fa-tachometer-alt"></i> Blood Pressure</h4>
                                                <div className="bp-reading">
                                                    {record.bloodPressureSystolic}/{record.bloodPressureDiastolic} mmHg
                                                    {record.bloodPressureRecordedDate && (
                                                        <span className="bp-date">
                                                            ({formatDate(record.bloodPressureRecordedDate)})
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {record.medicalClearanceNotes && (
                                            <div className="clearance-notes">
                                                <h4><i className="fas fa-notes-medical"></i> Medical Clearance Notes</h4>
                                                <p>{record.medicalClearanceNotes}</p>
                                                {record.medicalClearanceDate && (
                                                    <div className="clearance-date">
                                                        Date: {formatDate(record.medicalClearanceDate)}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ClientMedicalHistory;