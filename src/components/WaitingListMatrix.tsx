import React, { useState, useEffect } from 'react';
import { Plus, Search, AlertCircle, Trash2, MoveUp, MoveDown } from 'lucide-react';
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

const accentColors = ['#87bdf0', '#d9dd70', '#f4b285', '#ef476f', '#6366f1'];

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const sourceLabel = (source?: string) => (source === 'iboga_ready' ? 'Selected by guest in IR' : 'Added in RE');

const WaitingListMatrix: React.FC = () => {
  const [retreatColumns, setRetreatColumns] = useState<RetreatColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
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
      setSearchResults(prev => ({ ...prev, [retreatId]: clients }));
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

      setActiveSearch(prev => ({ ...prev, [retreatId]: '' }));
      setSearchResults(prev => ({ ...prev, [retreatId]: [] }));

      await fetchWaitingListMatrix();
    } catch (error) {
      console.error('Error adding client to waiting list:', error);
      alert('Error adding client to waiting list. They may already be on the list.');
    }
  };

  const removeFromWaitingList = async (entryId: string) => {
    if (!window.confirm('Are you sure you want to remove this client from the waiting list?')) {
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
        positions: [{ waitingListId: entryId, newPosition: newPosition }]
      });

      await fetchWaitingListMatrix();
    } catch (error) {
      console.error('Error updating position:', error);
      alert('Error updating position');
    }
  };

  const toggle = (id: string) =>
    setCollapsed(current => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const collapseAll = () => setCollapsed(new Set(retreatColumns.map(column => column._id)));

  if (loading) {
    return <LoadingSpinner message="Loading waiting list matrix..." />;
  }

  const totalWaiting = retreatColumns.reduce((sum, column) => sum + column.waitingList.length, 0);

  return (
    <div className="holistic-view waiting-list-holistic">
      <div className="holistic-controls">
        <div className="holistic-total">
          <span>Waiting list — across every retreat</span>
          <strong>{totalWaiting}<small> waiting</small></strong>
        </div>
        <div className="holistic-filters">
          <button onClick={collapseAll}>Collapse all</button>
        </div>
      </div>

      {retreatColumns.length === 0 ? (
        <div className="empty-state">
          <AlertCircle size={48} />
          <h3>No Upcoming Retreats</h3>
          <p>Create a retreat first to start managing waiting lists</p>
        </div>
      ) : (
        <div className="holistic-groups">
          {retreatColumns.map((column, index) => {
            const accent = accentColors[index % accentColors.length];
            const isCollapsed = collapsed.has(column._id);
            return (
              <section className="holistic-group" style={{ '--accent': accent } as React.CSSProperties} key={column._id}>
                <header>
                  <button onClick={() => toggle(column._id)}>
                    <b>{column.retreat.name}</b>
                    <span>
                      {formatDate(column.retreat.startDate)} – {formatDate(column.retreat.endDate)}
                      <small> · {column.retreat.location}</small>
                    </span>
                  </button>
                  <div className="holistic-group-progress">
                    <i>
                      <b
                        style={{
                          width: `${column.retreat.capacity ? Math.min(100, (column.retreat.currentOccupancy / column.retreat.capacity) * 100) : 0}%`
                        }}
                      />
                    </i>
                    <strong>
                      {column.retreat.currentOccupancy}
                      <small> / {column.retreat.capacity} booked</small>
                    </strong>
                  </div>
                  <button className="holistic-collapse" onClick={() => toggle(column._id)}>
                    {isCollapsed ? 'Show people' : 'Hide people'}
                  </button>
                </header>

                {!isCollapsed && (
                  <>
                    <div className="waiting-list-add">
                      <div className="waiting-list-add-input">
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
                        />
                      </div>

                      {searchResults[column._id] && searchResults[column._id].length > 0 && (
                        <div className="waiting-list-add-results">
                          {searchResults[column._id].map((client) => (
                            <div
                              key={client._id}
                              className="waiting-list-add-result"
                              onClick={() => addClientToWaitingList(column._id, client)}
                            >
                              <div>
                                <span className="waiting-list-add-name">{client.firstName} {client.lastName}</span>
                                <span className="waiting-list-add-email">{client.email}</span>
                              </div>
                              <Plus size={16} />
                            </div>
                          ))}
                        </div>
                      )}

                      {searchingClients[column._id] && <div className="waiting-list-add-loading">Searching...</div>}
                    </div>

                    <div className="holistic-people holistic-waiting-list-table">
                      <div className="holistic-head">
                        <span>#</span>
                        <span>Client</span>
                        <span>Priority</span>
                        <span>Joined</span>
                        <span>Notice</span>
                        <span>Source</span>
                        <span>Actions</span>
                      </div>
                      {column.waitingList.map((entry) => (
                        <article key={entry.id}>
                          <span>#{entry.position}</span>
                          <span className="waiting-list-client-cell">
                            <strong>{entry.client.name}</strong>
                            <small>{entry.client.email}</small>
                            <small>{entry.client.phone}</small>
                            {entry.notes && <small className="waiting-list-notes"><b>Notes:</b> {entry.notes}</small>}
                          </span>
                          <em className={`waiting-list-priority priority-${entry.priority}`}>{entry.priority}</em>
                          <span>{formatDate(entry.joinedDate)}</span>
                          <span>{entry.noticeDays || 1} day{Number(entry.noticeDays || 1) === 1 ? '' : 's'}</span>
                          <span>{sourceLabel(entry.source)}</span>
                          <span className="waiting-list-actions">
                            <button
                              onClick={() => movePosition(column._id, entry.id, 'up')}
                              disabled={entry.position === 1}
                              title="Move up"
                            >
                              <MoveUp size={14} />
                            </button>
                            <button
                              onClick={() => movePosition(column._id, entry.id, 'down')}
                              disabled={entry.position === column.waitingList.length}
                              title="Move down"
                            >
                              <MoveDown size={14} />
                            </button>
                            <button
                              className="is-danger"
                              onClick={() => removeFromWaitingList(entry.id)}
                              title="Remove from list"
                            >
                              <Trash2 size={14} />
                            </button>
                          </span>
                        </article>
                      ))}
                      {column.waitingList.length === 0 && <p>No one waiting.</p>}
                    </div>
                  </>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WaitingListMatrix;
