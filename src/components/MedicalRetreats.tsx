import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Users, MapPin, AlertCircle, FileText, Heart } from 'lucide-react';
import { API_BASE_URL } from '../config/api.config';
import './MedicalRetreats.css';

interface MedicalRecord {
  liverPanelStatus: string;
  ekgStatus: string;
  finalMedicalClearance: boolean;
  liverPanelReceivedDate?: string;
  ekgReceivedDate?: string;
}

interface Client {
  _id: string;
  clientNumber: string;
  firstName: string;
  lastName: string;
  medicalRecord?: MedicalRecord;
}

interface Retreat {
  _id: string;
  name: string;
  location: string;
  startDate: string;
  endDate: string;
  capacity: number;
  clients: Client[];
}

const MedicalRetreats: React.FC = () => {
  const navigate = useNavigate();
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRetreat, setExpandedRetreat] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'cleared'>('all');

  const fetchUpcomingRetreats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');

      // Use the optimized endpoint that gets retreats with bookings in a single call
      const retreatsResponse = await fetch(`${API_BASE_URL}/retreats/upcoming/with-bookings`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!retreatsResponse.ok) {
        throw new Error('Failed to fetch retreats');
      }

      const retreatsWithClients = await retreatsResponse.json();

      setRetreats(retreatsWithClients);
    } catch (error) {
      console.error('Error fetching retreats:', error);
      setError('Error loading data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUpcomingRetreats();
  }, [fetchUpcomingRetreats]);

  const formatDate = (dateString: string) => {
    // Add T00:00:00 to ensure the date is parsed in local timezone
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getDaysUntil = (dateString: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(dateString + 'T00:00:00');
    const days = Math.floor((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const getMedicalStatusIcon = (record?: MedicalRecord) => {
    if (!record) return { icon: <AlertCircle size={16} />, color: 'pending' };

    if (record.finalMedicalClearance) {
      return { icon: '✓', color: 'cleared' };
    }

    if (record.liverPanelStatus === 'received' || record.ekgStatus === 'received') {
      return { icon: <AlertCircle size={16} />, color: 'review' };
    }

    return { icon: <AlertCircle size={16} />, color: 'pending' };
  };

  const getFilteredClients = (clients: Client[]) => {
    if (filterStatus === 'all') return clients;

    return clients.filter(client => {
      if (!client.medicalRecord) return filterStatus === 'pending';

      if (filterStatus === 'cleared') {
        return client.medicalRecord.finalMedicalClearance;
      }

      if (filterStatus === 'pending') {
        return !client.medicalRecord.finalMedicalClearance;
      }

      return true;
    });
  };

  const toggleRetreat = (retreatId: string) => {
    setExpandedRetreat(expandedRetreat === retreatId ? null : retreatId);
  };

  if (loading) {
    return (
      <div className="medical-retreats">
        <div className="loading">Loading upcoming retreats...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="medical-retreats">
        <div className="error-message">
          {error}
          <button onClick={fetchUpcomingRetreats} className="retry-btn">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="medical-retreats">
      <div className="retreats-header">
        <h1>Upcoming Retreats</h1>
        <div className="filter-controls">
          <button
            className={`filter-btn ${filterStatus === 'all' ? 'active' : ''}`}
            onClick={() => setFilterStatus('all')}
          >
            All Clients
          </button>
          <button
            className={`filter-btn ${filterStatus === 'pending' ? 'active' : ''}`}
            onClick={() => setFilterStatus('pending')}
          >
            Pending Review
          </button>
          <button
            className={`filter-btn ${filterStatus === 'cleared' ? 'active' : ''}`}
            onClick={() => setFilterStatus('cleared')}
          >
            Cleared
          </button>
        </div>
      </div>

      <div className="retreats-list">
        {retreats.map(retreat => {
          const daysUntil = getDaysUntil(retreat.startDate);
          const isExpanded = expandedRetreat === retreat._id;
          const filteredClients = getFilteredClients(retreat.clients);

          return (
            <div key={retreat._id} className="retreat-card">
              <div
                className="retreat-header"
                onClick={() => toggleRetreat(retreat._id)}
              >
                <div className="retreat-info">
                  <h3>{retreat.name}</h3>
                  <div className="retreat-details">
                    <span className="detail-item">
                      <Calendar size={14} />
                      {formatDate(retreat.startDate)} - {formatDate(retreat.endDate)}
                    </span>
                    <span className="detail-item">
                      <MapPin size={14} />
                      {retreat.location}
                    </span>
                    <span className="detail-item">
                      <Users size={14} />
                      {retreat.clients.length} / {retreat.capacity} clients
                    </span>
                  </div>
                </div>
                <div className="retreat-status">
                  {daysUntil <= 14 && (
                    <span className="urgency-badge">
                      {daysUntil} days
                    </span>
                  )}
                  <span className="expand-icon">
                    {isExpanded ? '−' : '+'}
                  </span>
                </div>
              </div>

              {isExpanded && (
                <div className="retreat-clients">
                  {filteredClients.length === 0 ? (
                    <div className="no-clients">
                      No {filterStatus !== 'all' ? filterStatus : ''} clients for this retreat
                    </div>
                  ) : (
                    <table className="clients-table">
                      <thead>
                        <tr>
                          <th>Client #</th>
                          <th>Name</th>
                          <th>Liver Panel</th>
                          <th>EKG</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredClients.map(client => {
                          const statusInfo = getMedicalStatusIcon(client.medicalRecord);
                          return (
                            <tr key={client._id}>
                              <td>{client.clientNumber}</td>
                              <td>
                                <span
                                  className="client-name-link"
                                  onClick={() => navigate(`/medical/client/${client._id}`)}
                                  style={{ cursor: 'pointer', color: '#667eea', textDecoration: 'underline' }}
                                >
                                  {client.firstName} {client.lastName}
                                </span>
                              </td>
                              <td>
                                <span className={`status-indicator ${client.medicalRecord?.liverPanelStatus || 'pending'}`}>
                                  {client.medicalRecord?.liverPanelStatus === 'received' ? (
                                    <FileText size={14} />
                                  ) : (
                                    '○'
                                  )}
                                  {client.medicalRecord?.liverPanelStatus || 'Pending'}
                                </span>
                              </td>
                              <td>
                                <span className={`status-indicator ${client.medicalRecord?.ekgStatus || 'pending'}`}>
                                  {client.medicalRecord?.ekgStatus === 'received' ? (
                                    <Heart size={14} />
                                  ) : (
                                    '○'
                                  )}
                                  {client.medicalRecord?.ekgStatus || 'Pending'}
                                </span>
                              </td>
                              <td>
                                <span className={`clearance-status ${statusInfo.color}`}>
                                  {statusInfo.icon}
                                  {client.medicalRecord?.finalMedicalClearance ? 'Cleared' : 'Pending'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {retreats.length === 0 && !error && (
          <div className="no-retreats">
            No upcoming retreats found
          </div>
        )}
      </div>
    </div>
  );
};

export default MedicalRetreats;
