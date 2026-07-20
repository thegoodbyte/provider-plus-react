import React, { useState, useEffect } from 'react';
import { Plus, Search, Calendar, MapPin, Users, Clock, AlertCircle, Trash2, MoveUp, MoveDown } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import { waitingListApi, clientsApi } from '../services/api';
import './WaitingListMatrix.css';

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
}

interface WaitingListEntry {
  id: string;
  position: number;
  status: string;
  priority: string;
  joinedDate: string;
  client: Client;
  notes: string;
  noticeDays?: number;
  source?: string;
}

interface RetreatColumn {
  _id: string;
  retreat: {
    _id: string;
    name: string;
    startDate: string;
    endDate: string;
    location: string;
    capacity: number;
    currentOccupancy: number;
  };
  waitingList: WaitingListEntry[];
}

interface ClientSearchResult {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

const WaitingListMatrix: React.FC = () => {
  const [retreatColumns, setRetreatColumns] = useState<RetreatColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchingClients, setSearchingClients] = useState<{ [key: string]: boolean }>({});
  const [searchResults, setSearchResults] = useState<{ [key: string]: ClientSearchResult[] }>({});
  const [activeSearch, setActiveSearch] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    fetchWaitingListMatrix();
  }, []);

  const fetchWaitingListMatrix = async () => {
    try {
      setLoading(true);
      const response = await waitingListApi.getMatrix();
      setRetreatColumns(response.data || []);
    } catch (error) {
      console.error('Error fetching waiting list matrix:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchClients = async (retreatId: string, query: string) => {
    if (!query.trim()) {
      setSearchResults(prev => ({ ...prev, [retreatId]: [] }));
      return;
    }

    setSearchingClients(prev => ({ ...prev, [retreatId]: true }));

    try {
      const response = await clientsApi.searchClients(query);
      const clients = (response.data || []).map((client: any) => ({
        _id: client._id || '',
        firstName: client.firstName || '',
        lastName: client.lastName || '',
        email: client.email || '',
        phone: client.phone || ''
      }));
      setSearchResults(prev => ({
        ...prev,
        [retreatId]: clients
      }));
    } catch (error) {
      console.error('Error searching clients:', error);
      setSearchResults(prev => ({ ...prev, [retreatId]: [] }));
    } finally {
      setSearchingClients(prev => ({ ...prev, [retreatId]: false }));
    }
  };

  const addClientToWaitingList = async (retreatId: string, client: ClientSearchResult) => {
    try {
      await waitingListApi.addToWaitingList({
        clientId: client._id,
        retreatId: retreatId,
        priority: 'medium'
      });

      // Clear search
      setActiveSearch(prev => ({ ...prev, [retreatId]: '' }));
      setSearchResults(prev => ({ ...prev, [retreatId]: [] }));

      // Refresh matrix
      await fetchWaitingListMatrix();
    } catch (error) {
      console.error('Error adding client to waiting list:', error);
      alert('Error adding client to waiting list. They may already be on the list.');
    }
  };

  const removeFromWaitingList = async (entryId: string) => {
    if (!confirm('Are you sure you want to remove this client from the waiting list?')) {
      return;
    }

    try {
      await waitingListApi.removeFromWaitingList(entryId);
      await fetchWaitingListMatrix();
    } catch (error) {
      console.error('Error removing from waiting list:', error);
      alert('Error removing from waiting list');
    }
  };

  const movePosition = async (retreatId: string, entryId: string, direction: 'up' | 'down') => {
    const retreat = retreatColumns.find(col => col._id === retreatId);
    if (!retreat) return;

    const entry = retreat.waitingList.find(item => item.id === entryId);
    if (!entry) return;

    const newPosition = direction === 'up' ? entry.position - 1 : entry.position + 1;

    if (newPosition < 1 || newPosition > retreat.waitingList.length) {
      return;
    }

    try {
      await waitingListApi.updatePositions(retreatId, {
        positions: [{
          waitingListId: entryId,
          newPosition: newPosition
        }]
      });

      await fetchWaitingListMatrix();
    } catch (error) {
      console.error('Error updating position:', error);
      alert('Error updating position');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'priority-high';
      case 'medium': return 'priority-medium';
      case 'low': return 'priority-low';
      default: return 'priority-medium';
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading waiting list matrix..." />;
  }

  return (
    <div className="waiting-list-matrix">
      <div className="matrix-header">
        <h1>Retreat Waiting List Matrix</h1>
        <p className="matrix-subtitle">
          Manage waiting lists across all upcoming retreats
        </p>
      </div>

      {retreatColumns.length === 0 ? (
        <div className="empty-state">
          <AlertCircle size={48} />
          <h3>No Upcoming Retreats</h3>
          <p>Create a retreat first to start managing waiting lists</p>
        </div>
      ) : (
        <div className="matrix-grid">
          {retreatColumns.map((column) => (
            <div key={column._id} className="retreat-column">
              {/* Column Header */}
              <div className="column-header">
                <div className="retreat-info">
                  <h3>{column.retreat.name}</h3>
                  <div className="retreat-details">
                    <div className="detail-item">
                      <Calendar size={14} />
                      <span>{formatDate(column.retreat.startDate)}</span>
                    </div>
                    <div className="detail-item">
                      <MapPin size={14} />
                      <span>{column.retreat.location}</span>
                    </div>
                    <div className="detail-item">
                      <Users size={14} />
                      <span>{column.retreat.currentOccupancy}/{column.retreat.capacity}</span>
                    </div>
                  </div>
                </div>

                <div className="waiting-count">
                  <Clock size={16} />
                  <span>{column.waitingList.length} waiting</span>
                </div>
              </div>

              {/* Client Search */}
              <div className="client-search">
                <div className="search-input-container">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Search clients to add..."
                    value={activeSearch[column._id] || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setActiveSearch(prev => ({ ...prev, [column._id]: value }));
                      searchClients(column._id, value);
                    }}
                    className="search-input"
                  />
                </div>

                {/* Search Results */}
                {searchResults[column._id] && searchResults[column._id].length > 0 && (
                  <div className="search-results">
                    {searchResults[column._id].map((client) => (
                      <div
                        key={client._id}
                        className="search-result"
                        onClick={() => addClientToWaitingList(column._id, client)}
                      >
                        <div className="client-info">
                          <span className="client-name">
                            {client.firstName} {client.lastName}
                          </span>
                          <span className="client-email">{client.email}</span>
                        </div>
                        <Plus size={16} />
                      </div>
                    ))}
                  </div>
                )}

                {searchingClients[column._id] && (
                  <div className="search-loading">Searching...</div>
                )}
              </div>

              {/* Waiting List */}
              <div className="waiting-list">
                {column.waitingList.length === 0 ? (
                  <div className="empty-list">
                    <Clock size={24} />
                    <p>No one waiting</p>
                  </div>
                ) : (
                  column.waitingList.map((entry, index) => (
                    <div
                      key={entry.id}
                      className={`waiting-entry ${getPriorityColor(entry.priority)}`}
                    >
                      <div className="entry-header">
                        <div className="position-badge">#{entry.position}</div>
                        <div className="client-name">{entry.client.name}</div>
                        <div className="entry-actions">
                          <button
                            className="action-btn"
                            onClick={() => movePosition(column._id, entry.id, 'up')}
                            disabled={entry.position === 1}
                            title="Move up"
                          >
                            <MoveUp size={14} />
                          </button>
                          <button
                            className="action-btn"
                            onClick={() => movePosition(column._id, entry.id, 'down')}
                            disabled={entry.position === column.waitingList.length}
                            title="Move down"
                          >
                            <MoveDown size={14} />
                          </button>
                          <button
                            className="action-btn danger"
                            onClick={() => removeFromWaitingList(entry.id)}
                            title="Remove from list"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="entry-details">
                        <div className="contact-info">
                          <span className="email">{entry.client.email}</span>
                          <span className="phone">{entry.client.phone}</span>
                        </div>

                        <div className="meta-info">
                          <span className={`priority priority-${entry.priority}`}>
                            {entry.priority} priority
                          </span>
                          <span className="joined-date">
                            Joined {formatDate(entry.joinedDate)}
                          </span>
                          <span className="joined-date">
                            {entry.noticeDays || 1} day{Number(entry.noticeDays || 1) === 1 ? '' : 's'} notice
                          </span>
                          <span className="joined-date">
                            {entry.source === 'iboga_ready' ? 'Selected by guest in IR' : 'Added in RE'}
                          </span>
                        </div>

                        {entry.notes && (
                          <div className="notes">
                            <strong>Notes:</strong> {entry.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WaitingListMatrix;
