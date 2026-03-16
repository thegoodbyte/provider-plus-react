import React, { useState, useEffect } from 'react';
import { authService } from '../services/authService';
import './BookingMedicalUpload.css';

interface BookingMedicalUploadProps {
    bookingId: string;
    clientId: string;
    retreatId: string;
    onUploadComplete?: () => void;
}

interface MedicalRecord {
    _id: string;
    recordType: 'booking' | 'ceremony';
    version: number;
    testDate: string;
    liverPanelStatus: string;
    liverPanelReceivedDate?: string;
    liverPanelFileName?: string;
    ekgStatus: string;
    ekgReceivedDate?: string;
    ekgFileName?: string;
    bloodPressureSystolic?: number;
    bloodPressureDiastolic?: number;
    bloodPressureRecordedDate?: string;
    finalMedicalClearance: boolean;
    createdAt: string;
}

const BookingMedicalUpload: React.FC<BookingMedicalUploadProps> = ({
    bookingId,
    clientId,
    retreatId,
    onUploadComplete
}) => {
    const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploadingLiver, setUploadingLiver] = useState(false);
    const [uploadingEkg, setUploadingEkg] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3005';

    useEffect(() => {
        fetchBookingMedicalHistory();
    }, [bookingId]);

    const fetchBookingMedicalHistory = async () => {
        try {
            setLoading(true);
            const token = authService.getToken();
            const response = await fetch(`${API_BASE_URL}/client-medical/booking/${bookingId}/history`, {
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

    const createNewMedicalRecord = async () => {
        try {
            const token = authService.getToken();
            const response = await fetch(`${API_BASE_URL}/client-medical/booking-medical`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ bookingId, clientId, retreatId })
            });

            if (response.ok) {
                await fetchBookingMedicalHistory();
                return true;
            } else {
                setError('Failed to create medical record');
                return false;
            }
        } catch (err) {
            setError('Error creating medical record');
            return false;
        }
    };

    const handleFileUpload = async (type: 'liver' | 'ekg', file: File) => {
        const setUploading = type === 'liver' ? setUploadingLiver : setUploadingEkg;
        setUploading(true);
        setError(null);

        try {
            // Check if we have a booking medical record, if not create one
            const bookingRecords = medicalRecords.filter(r => r.recordType === 'booking');
            if (bookingRecords.length === 0) {
                const created = await createNewMedicalRecord();
                if (!created) {
                    setUploading(false);
                    return;
                }
            }

            const formData = new FormData();
            formData.append('file', file);
            formData.append('clientId', clientId);
            formData.append('retreatId', retreatId);
            formData.append('bookingId', bookingId);

            const token = authService.getToken();
            const endpoint = type === 'liver'
                ? `${API_BASE_URL}/client-medical/upload/liver-panel`
                : `${API_BASE_URL}/client-medical/upload/ekg`;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (response.ok) {
                await fetchBookingMedicalHistory();
                if (onUploadComplete) onUploadComplete();
            } else {
                setError(`Failed to upload ${type === 'liver' ? 'liver panel' : 'EKG'}`);
            }
        } catch (err) {
            setError(`Error uploading ${type === 'liver' ? 'liver panel' : 'EKG'}`);
        } finally {
            setUploading(false);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString();
    };

    const getStatusBadgeClass = (status: string) => {
        switch (status) {
            case 'pending': return 'badge-pending';
            case 'received': return 'badge-received';
            case 'approved': return 'badge-approved';
            case 'rejected': return 'badge-rejected';
            default: return 'badge-default';
        }
    };

    const latestBookingRecord = medicalRecords
        .filter(r => r.recordType === 'booking')
        .sort((a, b) => b.version - a.version)[0];

    const ceremonyRecords = medicalRecords
        .filter(r => r.recordType === 'ceremony')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return (
        <div className="booking-medical-upload">
            <h3>Medical Records</h3>

            {error && <div className="alert alert-danger">{error}</div>}

            {/* Current Booking Medical Status */}
            <div className="current-medical-section">
                <h4>Booking Medical Tests</h4>

                {latestBookingRecord ? (
                    <div className="medical-status-card">
                        <div className="version-info">
                            Version {latestBookingRecord.version}
                            {latestBookingRecord.testDate && ` - Test Date: ${formatDate(latestBookingRecord.testDate)}`}
                        </div>

                        <div className="medical-tests-grid">
                            <div className="medical-test-card">
                                <h5>Liver Panel</h5>
                                <div className={`status-badge ${getStatusBadgeClass(latestBookingRecord.liverPanelStatus)}`}>
                                    {latestBookingRecord.liverPanelStatus}
                                </div>
                                {latestBookingRecord.liverPanelFileName ? (
                                    <div className="file-info">
                                        <i className="fas fa-file-medical"></i> {latestBookingRecord.liverPanelFileName}
                                        {latestBookingRecord.liverPanelReceivedDate &&
                                            <div className="upload-date">Uploaded: {formatDate(latestBookingRecord.liverPanelReceivedDate)}</div>
                                        }
                                    </div>
                                ) : (
                                    <div className="upload-section">
                                        <input
                                            type="file"
                                            id="liver-upload"
                                            accept=".pdf,.jpg,.jpeg,.png"
                                            onChange={(e) => e.target.files?.[0] && handleFileUpload('liver', e.target.files[0])}
                                            disabled={uploadingLiver}
                                        />
                                        <label htmlFor="liver-upload" className="btn btn-sm btn-primary">
                                            {uploadingLiver ? 'Uploading...' : 'Upload Liver Panel'}
                                        </label>
                                    </div>
                                )}
                            </div>

                            <div className="medical-test-card">
                                <h5>EKG</h5>
                                <div className={`status-badge ${getStatusBadgeClass(latestBookingRecord.ekgStatus)}`}>
                                    {latestBookingRecord.ekgStatus}
                                </div>
                                {latestBookingRecord.ekgFileName ? (
                                    <div className="file-info">
                                        <i className="fas fa-file-medical"></i> {latestBookingRecord.ekgFileName}
                                        {latestBookingRecord.ekgReceivedDate &&
                                            <div className="upload-date">Uploaded: {formatDate(latestBookingRecord.ekgReceivedDate)}</div>
                                        }
                                    </div>
                                ) : (
                                    <div className="upload-section">
                                        <input
                                            type="file"
                                            id="ekg-upload"
                                            accept=".pdf,.jpg,.jpeg,.png"
                                            onChange={(e) => e.target.files?.[0] && handleFileUpload('ekg', e.target.files[0])}
                                            disabled={uploadingEkg}
                                        />
                                        <label htmlFor="ekg-upload" className="btn btn-sm btn-primary">
                                            {uploadingEkg ? 'Uploading...' : 'Upload EKG'}
                                        </label>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="clearance-status">
                            <strong>Medical Clearance:</strong>
                            <span className={latestBookingRecord.finalMedicalClearance ? 'text-success' : 'text-warning'}>
                                {latestBookingRecord.finalMedicalClearance ? ' Approved' : ' Pending'}
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="no-record-card">
                        <p>No booking medical record exists yet.</p>
                        <button
                            className="btn btn-primary"
                            onClick={createNewMedicalRecord}
                            disabled={loading}
                        >
                            Create Medical Record
                        </button>
                    </div>
                )}

                {/* Option to create new version if tests need to be redone */}
                {latestBookingRecord && (latestBookingRecord.liverPanelStatus === 'rejected' || latestBookingRecord.ekgStatus === 'rejected') && (
                    <div className="redo-tests-section">
                        <button
                            className="btn btn-warning"
                            onClick={createNewMedicalRecord}
                            disabled={loading}
                        >
                            <i className="fas fa-redo"></i> Redo Tests (Create New Version)
                        </button>
                    </div>
                )}
            </div>

            {/* Ceremony Records */}
            {ceremonyRecords.length > 0 && (
                <div className="ceremony-records-section">
                    <h4>Pre-Ceremony Checks</h4>
                    {ceremonyRecords.map((record) => (
                        <div key={record._id} className="ceremony-record-card">
                            <div className="record-date">
                                {formatDate(record.createdAt)}
                            </div>
                            {record.bloodPressureSystolic && record.bloodPressureDiastolic && (
                                <div className="blood-pressure">
                                    Blood Pressure: {record.bloodPressureSystolic}/{record.bloodPressureDiastolic}
                                    {record.bloodPressureRecordedDate &&
                                        ` (${formatDate(record.bloodPressureRecordedDate)})`
                                    }
                                </div>
                            )}
                            {record.ekgFileName && (
                                <div className="file-info">
                                    <i className="fas fa-heartbeat"></i> Pre-ceremony EKG: {record.ekgFileName}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* History Toggle */}
            <div className="history-section">
                <button
                    className="btn btn-link"
                    onClick={() => setShowHistory(!showHistory)}
                >
                    <i className={`fas fa-chevron-${showHistory ? 'up' : 'down'}`}></i>
                    {showHistory ? 'Hide' : 'Show'} Full History
                </button>

                {showHistory && (
                    <div className="history-records">
                        <h5>All Medical Records</h5>
                        {medicalRecords.map((record) => (
                            <div key={record._id} className="history-record">
                                <div className="record-header">
                                    <span className="record-type">{record.recordType}</span>
                                    {record.version && <span className="version">v{record.version}</span>}
                                    <span className="date">{formatDate(record.createdAt)}</span>
                                </div>
                                <div className="record-details">
                                    <div>Liver Panel: {record.liverPanelStatus}</div>
                                    <div>EKG: {record.ekgStatus}</div>
                                    {record.finalMedicalClearance && <div className="text-success">Cleared</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default BookingMedicalUpload;