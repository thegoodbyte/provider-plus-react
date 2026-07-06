import React, { useMemo, useState, useEffect } from 'react';
import { Search, Calendar, MapPin, Users, Clock, CheckSquare, Square, Plus, Save, RotateCcw } from 'lucide-react';
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
  const [pendingRetreatIds, setPendingRetreatIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [updatingRetreat, setUpdatingRetreat] = useState<string | null>(null);
  const [savingSelections, setSavingSelections] = useState(false);

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
      setPendingRetreatIds(
        new Set(
          options
            .filter((option: RetreatOption) => option.isOnWaitingList)
            .map((option: RetreatOption) => option.retreat._id)
        )
      );
    } catch (error) {
      console.error('Error fetching retreat options:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleRetreatSelection = (retreatId: string) => {
    setPendingRetreatIds((current) => {
      const next = new Set(current);
      if (next.has(retreatId)) {
        next.delete(retreatId);
      } else {
        next.add(retreatId);
      }
      return next;
    });
  };

  const resetPendingSelections = () => {
    setPendingRetreatIds(
      new Set(
        retreatOptions
          .filter((option) => option.isOnWaitingList)
          .map((option) => option.retreat._id)
      )
    );
  };

  const hasSelectionChanges = useMemo(() => {
    return retreatOptions.some(
      (option) => pendingRetreatIds.has(option.retreat._id) !== option.isOnWaitingList
    );
  }, [pendingRetreatIds, retreatOptions]);

  const saveWaitingListSelections = async () => {
    if (!selectedClient) return;

    setSavingSelections(true);

    try {
      for (const option of retreatOptions) {
        const shouldBeOnList = pendingRetreatIds.has(option.retreat._id);
        if (shouldBeOnList === option.isOnWaitingList) continue;

        setUpdatingRetreat(option.retreat._id);

        if (shouldBeOnList) {
          await waitingListApi.addToWaitingList({
            clientId: selectedClient._id,
            retreatId: option.retreat._id,
            priority: 'medium',
            notes: ''
          });
        } else if (option.waitingListEntry?._id) {
          await waitingListApi.removeFromWaitingList(option.waitingListEntry._id);
        }
      }

      await fetchRetreatOptions();
    } catch (error) {
      console.error('Error updating waiting list:', error);
      alert('Error saving waiting list selections. One of the selected retreats may already have a duplicate waiting-list entry.');
    } finally {
      setUpdatingRetreat(null);
      setSavingSelections(false);
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
                setPendingRetreatIds(new Set());
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
          <div className="waiting-list-toolbar">
            <div>
              <h2>Waiting List Options</h2>
              <p>Check every retreat this client wants to wait for, then save the changes.</p>
            </div>
            <div className="waiting-list-actions">
              <button
                type="button"
                className="reset-selections-btn"
                onClick={resetPendingSelections}
                disabled={!hasSelectionChanges || savingSelections}
              >
                <RotateCcw size={16} />
                Reset
              </button>
              <button
                type="button"
                className="save-selections-btn"
                onClick={saveWaitingListSelections}
                disabled={!hasSelectionChanges || savingSelections}
              >
                <Save size={16} />
                {savingSelections ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>

          {retreatOptions.length === 0 ? (
            <div className="empty-state">
              <Calendar size={48} />
              <h3>No Upcoming Retreats</h3>
              <p>There are no upcoming retreats available for waiting lists.</p>
            </div>
          ) : (
            <div className="retreat-selection-table">
              <div className="retreat-selection-header">
                <span>Selected</span>
                <span>Retreat</span>
                <span>Dates</span>
                <span>Location</span>
                <span>Capacity</span>
                <span>Status</span>
              </div>
              {retreatOptions.map((option) => (
                <button
                  type="button"
                  key={option.retreat._id}
                  className={[
                    'retreat-selection-row',
                    pendingRetreatIds.has(option.retreat._id) ? 'selected' : '',
                    option.isOnWaitingList ? 'on-waiting-list' : ''
                  ].filter(Boolean).join(' ')}
                  onClick={() => toggleRetreatSelection(option.retreat._id)}
                  disabled={savingSelections}
                >
                  <span className="retreat-check">
                    {updatingRetreat === option.retreat._id ? (
                      <Clock size={18} />
                    ) : pendingRetreatIds.has(option.retreat._id) ? (
                      <CheckSquare size={18} />
                    ) : (
                      <Square size={18} />
                    )}
                    {pendingRetreatIds.has(option.retreat._id) ? 'Yes' : 'No'}
                  </span>

                  <span className="retreat-main">
                    <strong>{option.retreat.name}</strong>
                    {option.isOnWaitingList && option.waitingListEntry ? (
                      <span>
                        Position #{option.waitingListEntry.position} - Joined {formatDate(option.waitingListEntry.joinedDate)}
                      </span>
                    ) : (
                      <span>Not currently on this waiting list</span>
                    )}
                  </span>

                  <span className="retreat-table-meta">
                    <Calendar size={14} />
                    {formatDateRange(option.retreat.startDate, option.retreat.endDate)}
                  </span>

                  <span className="retreat-table-meta">
                    <MapPin size={14} />
                    {option.retreat.location || 'No location'}
                  </span>

                  <span className="retreat-table-meta">
                    <Users size={14} />
                    {option.retreat.currentOccupancy}/{option.retreat.capacity}
                    {getAvailableSpots(option.retreat) > 0 && (
                      <span className="available-spots">
                        {getAvailableSpots(option.retreat)} open
                      </span>
                    )}
                    {getAvailableSpots(option.retreat) === 0 && (
                      <span className="full-badge">FULL</span>
                    )}
                  </span>

                  <span className="retreat-status-cell">
                    {option.isOnWaitingList && option.waitingListEntry ? (
                      <>
                        <span className={`status status-${option.waitingListEntry.status}`}>
                          {option.waitingListEntry.status}
                        </span>
                        <span className={`priority priority-${option.waitingListEntry.priority}`}>
                          {option.waitingListEntry.priority}
                        </span>
                      </>
                    ) : (
                      <span className="not-listed">Not listed</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ClientWaitingLists;
