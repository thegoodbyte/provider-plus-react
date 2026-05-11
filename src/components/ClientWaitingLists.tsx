import React, { useState, useEffect } from 'react';
import { Search, Calendar, MapPin, Users, Clock, CheckSquare, Square, Plus, Trash2 } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import { waitingListApi, clientsApi, retreatsApi } from '../services/api';
import './ClientWaitingLists.css';

interface Client {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

interface Retreat {
  _id: string;
  name: string;
  startDate: string;
  endDate: string;
  location: string;
  capacity: number;
  currentOccupancy: number;
  status: string;
}

interface WaitingListEntry {
  _id: string;
  position: number;
  status: string;
  priority: string;
  joinedDate: string;
  retreatId: Retreat;
  notes: string;
}

interface RetreatOption {
  retreat: Retreat;
  isOnWaitingList: boolean;
  waitingListEntry?: WaitingListEntry;
}

const ClientWaitingLists: React.FC = () => {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [clientSearchResults, setClientSearchResults] = useState<Client[]>([]);
  const [retreatOptions, setRetreatOptions] = useState<RetreatOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingRetreat, setUpdatingRetreat] = useState<string | null>(null);

  useEffect(() => {
    if (selectedClient) {
      fetchRetreatOptions();
    }
  }, [selectedClient]);

  const searchClients = async (query: string) => {
    if (!query.trim()) {
      setClientSearchResults([]);
      return;
    }

    try {
      const response = await clientsApi.searchClients(query);
      const clients = (response.data || []).map((client: any) => ({
        _id: client._id || '',
        firstName: client.firstName || '',
        lastName: client.lastName || '',
        email: client.email || '',
        phone: client.phone || ''
      }));
      setClientSearchResults(clients);
    } catch (error) {
      console.error('Error searching clients:', error);
      setClientSearchResults([]);
    }
  };

  const selectClient = async (client: Client) => {
    setSelectedClient(client);
    setClientSearchQuery('');
    setClientSearchResults([]);
  };

  const fetchRetreatOptions = async () => {
    if (!selectedClient) return;

    setLoading(true);
    try {
      // Fetch all upcoming retreats
      const retreatsResponse = await retreatsApi.getUpcomingRetreats();
      const allRetreats = retreatsResponse.data || [];

      // Fetch client's current waiting list entries
      const waitingListResponse = await waitingListApi.getClientWaitingLists(selectedClient._id);
      const waitingListEntries = waitingListResponse.data || [];

      // Create retreat options with waiting list status
      const options = allRetreats.map((retreat: Retreat) => {
        const waitingListEntry = waitingListEntries.find(
          (entry: WaitingListEntry) => entry.retreatId._id === retreat._id
        );

        return {
          retreat,
          isOnWaitingList: !!waitingListEntry,
          waitingListEntry
        };
      });

      setRetreatOptions(options);
    } catch (error) {
      console.error('Error fetching retreat options:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleWaitingList = async (retreatId: string, isCurrentlyOnList: boolean) => {
    if (!selectedClient) return;

    setUpdatingRetreat(retreatId);

    try {
      if (isCurrentlyOnList) {
        // Remove from waiting list
        const entry = retreatOptions.find(opt =>
          opt.retreat._id === retreatId
        )?.waitingListEntry;

        if (entry) {
          await waitingListApi.removeFromWaitingList(entry._id);
        }
      } else {
        // Add to waiting list
        await waitingListApi.addToWaitingList({
          clientId: selectedClient._id,
          retreatId: retreatId,
          priority: 'medium',
          notes: ''
        });
      }

      // Refresh the options
      await fetchRetreatOptions();
    } catch (error) {
      console.error('Error updating waiting list:', error);
      alert(isCurrentlyOnList
        ? 'Error removing from waiting list'
        : 'Error adding to waiting list. The client may already be on the list.'
      );
    } finally {
      setUpdatingRetreat(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = formatDate(startDate);
    const end = formatDate(endDate);
    return `${start} - ${end}`;
  };

  const getAvailableSpots = (retreat: Retreat) => {
    return Math.max(0, retreat.capacity - retreat.currentOccupancy);
  };

  if (loading && selectedClient) {
    return <LoadingSpinner message="Loading waiting list options..." />;
  }

  return (
    <div className="client-waiting-lists">
      <div className="page-header">
        <h1>Manage Client Waiting Lists</h1>
        <p className="page-subtitle">
          Select a client and choose which retreats they want to join the waiting list for
        </p>
      </div>

      {/* Client Search */}
      <div className="client-search-section">
        <h2>Select Client</h2>
        <div className="search-container">
          <Search size={20} />
          <input
            type="text"
            placeholder="Search clients by name or email..."
            value={clientSearchQuery}
            onChange={(e) => {
              setClientSearchQuery(e.target.value);
              searchClients(e.target.value);
            }}
            className="client-search-input"
          />
        </div>

        {clientSearchResults.length > 0 && (
          <div className="client-search-results">
            {clientSearchResults.map((client) => (
              <div
                key={client._id}
                className="client-search-result"
                onClick={() => selectClient(client)}
              >
                <div className="client-details">
                  <span className="client-name">
                    {client.firstName} {client.lastName}
                  </span>
                  <span className="client-email">{client.email}</span>
                  <span className="client-phone">{client.phone}</span>
                </div>
                <Plus size={16} />
              </div>
            ))}
          </div>
        )}

        {selectedClient && (
          <div className="selected-client">
            <div className="selected-client-info">
              <h3>{selectedClient.firstName} {selectedClient.lastName}</h3>
              <p>{selectedClient.email} • {selectedClient.phone}</p>
            </div>
            <button
              className="change-client-btn"
              onClick={() => {
                setSelectedClient(null);
                setRetreatOptions([]);
              }}
            >
              Change Client
            </button>
          </div>
        )}
      </div>

      {/* Retreat Options */}
      {selectedClient && (
        <div className="retreat-options-section">
          <h2>Waiting List Options</h2>

          {retreatOptions.length === 0 ? (
            <div className="empty-state">
              <Calendar size={48} />
              <h3>No Upcoming Retreats</h3>
              <p>There are no upcoming retreats available for waiting lists.</p>
            </div>
          ) : (
            <div className="retreat-options-grid">
              {retreatOptions.map((option) => (
                <div
                  key={option.retreat._id}
                  className={`retreat-option ${option.isOnWaitingList ? 'on-waiting-list' : ''}`}
                >
                  <div className="retreat-header">
                    <div className="retreat-info">
                      <h3>{option.retreat.name}</h3>
                      <div className="retreat-details">
                        <div className="detail-row">
                          <Calendar size={14} />
                          <span>{formatDateRange(option.retreat.startDate, option.retreat.endDate)}</span>
                        </div>
                        <div className="detail-row">
                          <MapPin size={14} />
                          <span>{option.retreat.location}</span>
                        </div>
                        <div className="detail-row">
                          <Users size={14} />
                          <span>
                            {option.retreat.currentOccupancy}/{option.retreat.capacity} occupied
                            {getAvailableSpots(option.retreat) > 0 && (
                              <span className="available-spots">
                                ({getAvailableSpots(option.retreat)} available)
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="waiting-list-toggle">
                      <button
                        className={`toggle-btn ${option.isOnWaitingList ? 'active' : ''}`}
                        onClick={() => toggleWaitingList(option.retreat._id, option.isOnWaitingList)}
                        disabled={updatingRetreat === option.retreat._id}
                      >
                        {updatingRetreat === option.retreat._id ? (
                          <Clock size={16} />
                        ) : option.isOnWaitingList ? (
                          <CheckSquare size={16} />
                        ) : (
                          <Square size={16} />
                        )}
                        {option.isOnWaitingList ? 'On Waiting List' : 'Join Waiting List'}
                      </button>
                    </div>
                  </div>

                  {option.isOnWaitingList && option.waitingListEntry && (
                    <div className="waiting-list-details">
                      <div className="position-info">
                        <div className="position-badge">
                          Position #{option.waitingListEntry.position}
                        </div>
                        <div className="joined-date">
                          <Clock size={12} />
                          Joined {formatDate(option.waitingListEntry.joinedDate)}
                        </div>
                      </div>

                      <div className="status-priority">
                        <span className={`status status-${option.waitingListEntry.status}`}>
                          {option.waitingListEntry.status}
                        </span>
                        <span className={`priority priority-${option.waitingListEntry.priority}`}>
                          {option.waitingListEntry.priority} priority
                        </span>
                      </div>

                      {option.waitingListEntry.notes && (
                        <div className="entry-notes">
                          <strong>Notes:</strong> {option.waitingListEntry.notes}
                        </div>
                      )}
                    </div>
                  )}

                  {getAvailableSpots(option.retreat) === 0 && (
                    <div className="full-notice">
                      <span className="full-badge">FULL</span>
                      <span>Join waiting list for cancellations</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ClientWaitingLists;