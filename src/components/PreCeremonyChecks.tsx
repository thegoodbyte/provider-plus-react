import React, { useState, useEffect } from 'react';
import { Heart, Activity, FileText, Save, Clock, AlertCircle } from 'lucide-react';
import './PreCeremonyChecks.css';

interface Client {
  _id: string;
  clientNumber: string;
  firstName: string;
  lastName: string;
}

interface Booking {
  _id: string;
  bookingNumber: number;
  clientId: Client;
  retreatId: any;
}

interface MedicalRecord {
  _id: string;
  recordType: 'initial' | 'pre-ceremony';
  ekgStatus: string;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  bloodPressureRecordedDate?: string;
  bloodPressureNotes?: string;
  createdAt: string;
}

const PreCeremonyChecks: React.FC = () => {
  const [selectedRetreat, setSelectedRetreat] = useState<string>('');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [retreats, setRetreats] = useState<any[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states for new pre-ceremony check
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [notes, setNotes] = useState('');
  const [ekgFile, setEkgFile] = useState<File | null>(null);

  useEffect(() => {
    fetchUpcomingRetreats();
  }, []);

  useEffect(() => {
    if (selectedRetreat) {
      fetchRetreatBookings(selectedRetreat);
    }
  }, [selectedRetreat]);

  useEffect(() => {
    if (selectedBooking) {
      fetchMedicalRecords(selectedBooking._id);
    }
  }, [selectedBooking]);

  const fetchUpcomingRetreats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3005/retreats/upcoming', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch retreats');
      const data = await response.json();
      setRetreats(data);
    } catch (error) {
      console.error('Error fetching retreats:', error);
      setMessage({ type: 'error', text: 'Failed to load retreats' });
    }
  };

  const fetchRetreatBookings = async (retreatId: string) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3005/bookings?retreatId=${retreatId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch bookings');
      const data = await response.json();
      setBookings(data);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      setMessage({ type: 'error', text: 'Failed to load bookings' });
    } finally {
      setLoading(false);
    }
  };

  const fetchMedicalRecords = async (bookingId: string) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3005/client-medical/booking/${bookingId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch medical records');
      const data = await response.json();
      setMedicalRecords(data);
    } catch (error) {
      console.error('Error fetching medical records:', error);
      setMessage({ type: 'error', text: 'Failed to load medical records' });
    } finally {
      setLoading(false);
    }
  };

  const createPreCeremonyRecord = async () => {
    if (!selectedBooking) return;

    try {
      setSaving(true);
      const token = localStorage.getItem('token');

      // Create pre-ceremony record
      const response = await fetch('http://localhost:3005/client-medical/pre-ceremony', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bookingId: selectedBooking._id,
          clientId: selectedBooking.clientId._id,
          retreatId: selectedBooking.retreatId._id || selectedBooking.retreatId
        })
      });

      if (!response.ok) throw new Error('Failed to create pre-ceremony record');
      const newRecord = await response.json();

      // Update blood pressure if provided
      if (systolic && diastolic) {
        await updateBloodPressure(newRecord._id);
      }

      // Upload EKG if provided
      if (ekgFile) {
        await uploadEkg(newRecord._id);
      }

      // Refresh medical records
      await fetchMedicalRecords(selectedBooking._id);

      // Clear form
      setSystolic('');
      setDiastolic('');
      setNotes('');
      setEkgFile(null);

      setMessage({ type: 'success', text: 'Pre-ceremony check recorded successfully' });
    } catch (error) {
      console.error('Error creating pre-ceremony record:', error);
      setMessage({ type: 'error', text: 'Failed to record pre-ceremony check' });
    } finally {
      setSaving(false);
    }
  };

  const updateBloodPressure = async (recordId: string) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`http://localhost:3005/client-medical/${recordId}/blood-pressure`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        systolic: parseInt(systolic),
        diastolic: parseInt(diastolic),
        notes
      })
    });

    if (!response.ok) throw new Error('Failed to update blood pressure');
  };

  const uploadEkg = async (recordId: string) => {
    if (!ekgFile || !selectedBooking) return;

    const formData = new FormData();
    formData.append('file', ekgFile);
    formData.append('clientId', selectedBooking.clientId._id);
    formData.append('retreatId', selectedBooking.retreatId._id || selectedBooking.retreatId);

    const token = localStorage.getItem('token');
    const response = await fetch('http://localhost:3005/client-medical/upload/ekg', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) throw new Error('Failed to upload EKG');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPreCeremonyRecord = () => {
    return medicalRecords.find(r => r.recordType === 'pre-ceremony');
  };

  const getInitialRecord = () => {
    return medicalRecords.find(r => r.recordType === 'initial');
  };

  return (
    <div className="pre-ceremony-checks">
      <div className="header">
        <h1>Pre-Ceremony Medical Checks</h1>
        <p>Record vital signs and EKG before ceremony</p>
      </div>

      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
          <button onClick={() => setMessage(null)}>×</button>
        </div>
      )}

      <div className="selection-area">
        <div className="form-group">
          <label>Select Retreat</label>
          <select
            value={selectedRetreat}
            onChange={(e) => setSelectedRetreat(e.target.value)}
          >
            <option value="">-- Select Retreat --</option>
            {retreats.map(retreat => (
              <option key={retreat._id} value={retreat._id}>
                {retreat.name} - {new Date(retreat.startDate + 'T00:00:00').toLocaleDateString()}
              </option>
            ))}
          </select>
        </div>

        {selectedRetreat && (
          <div className="form-group">
            <label>Select Client</label>
            <select
              value={selectedBooking?._id || ''}
              onChange={(e) => {
                const booking = bookings.find(b => b._id === e.target.value);
                setSelectedBooking(booking || null);
              }}
              disabled={loading}
            >
              <option value="">-- Select Client --</option>
              {bookings.map(booking => (
                <option key={booking._id} value={booking._id}>
                  #{booking.bookingNumber} - {booking.clientId.firstName} {booking.clientId.lastName}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {selectedBooking && (
        <div className="client-medical-section">
          <div className="client-info">
            <h3>
              {selectedBooking.clientId.firstName} {selectedBooking.clientId.lastName}
            </h3>
            <p>Client #{selectedBooking.clientId.clientNumber} | Booking #{selectedBooking.bookingNumber}</p>
          </div>

          <div className="medical-history">
            <h4>Medical History</h4>

            {getInitialRecord() && (
              <div className="record-card initial">
                <div className="record-header">
                  <span className="record-type">Initial Medical</span>
                  <span className="record-date">{formatDate(getInitialRecord()!.createdAt)}</span>
                </div>
                <div className="record-status">
                  <span>EKG: {getInitialRecord()!.ekgStatus}</span>
                </div>
              </div>
            )}

            {getPreCeremonyRecord() && (
              <div className="record-card pre-ceremony">
                <div className="record-header">
                  <span className="record-type">Pre-Ceremony Check</span>
                  <span className="record-date">{formatDate(getPreCeremonyRecord()!.createdAt)}</span>
                </div>
                {getPreCeremonyRecord()!.bloodPressureSystolic && (
                  <div className="vital-reading">
                    <Heart size={16} />
                    Blood Pressure: {getPreCeremonyRecord()!.bloodPressureSystolic}/{getPreCeremonyRecord()!.bloodPressureDiastolic} mmHg
                  </div>
                )}
                {getPreCeremonyRecord()!.bloodPressureNotes && (
                  <div className="notes">{getPreCeremonyRecord()!.bloodPressureNotes}</div>
                )}
              </div>
            )}
          </div>

          <div className="new-check-form">
            <h4>New Pre-Ceremony Check</h4>

            <div className="form-row">
              <div className="form-group">
                <label>
                  <Heart size={16} />
                  Blood Pressure
                </label>
                <div className="bp-inputs">
                  <input
                    type="number"
                    placeholder="Systolic"
                    value={systolic}
                    onChange={(e) => setSystolic(e.target.value)}
                    min="60"
                    max="250"
                  />
                  <span>/</span>
                  <input
                    type="number"
                    placeholder="Diastolic"
                    value={diastolic}
                    onChange={(e) => setDiastolic(e.target.value)}
                    min="40"
                    max="150"
                  />
                  <span>mmHg</span>
                </div>
              </div>

              <div className="form-group">
                <label>
                  <Activity size={16} />
                  Pre-Ceremony EKG
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setEkgFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>

            <div className="form-group">
              <label>
                <FileText size={16} />
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any observations or concerns..."
                rows={3}
              />
            </div>

            <div className="form-actions">
              <button
                className="btn-primary"
                onClick={createPreCeremonyRecord}
                disabled={saving || (!systolic && !diastolic && !ekgFile)}
              >
                {saving ? (
                  <>
                    <Clock size={16} />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Record Pre-Ceremony Check
                  </>
                )}
              </button>
            </div>

            {(!systolic || !diastolic) && (
              <div className="warning-message">
                <AlertCircle size={16} />
                Blood pressure reading is recommended before ceremony
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PreCeremonyChecks;