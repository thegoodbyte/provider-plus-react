import React, { useEffect, useMemo, useState } from 'react';
import { CheckSquare, Clock, GripVertical, Plus, Search, Trash2, Users } from 'lucide-react';
import { clientsApi, waitingListApi } from '../services/api';

type ClientSearchResult = {
  _id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
};

type WaitingListClient = {
  _id?: string;
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
};

type WaitingListEntry = {
  _id?: string;
  id?: string;
  position?: number;
  status?: string;
  priority?: string;
  notes?: string;
  joinedDate?: string;
  clientId?: string | WaitingListClient;
  retreatId?: string | { _id?: string; name?: string; code?: string; retreatCode?: string };
  client?: WaitingListClient;
};

interface RetreatReserveListPanelProps {
  retreatId: string;
  retreatName?: string;
}

const getEntryId = (entry: WaitingListEntry) => entry._id || entry.id || '';
const getClientId = (client?: string | WaitingListClient) => {
  if (!client) return '';
  if (typeof client === 'string') return client;
  return client._id || client.id || '';
};

const getClientLabel = (client?: WaitingListClient | string | null) => {
  if (!client) return 'Unknown client';
  if (typeof client === 'string') return client;
  return [client.firstName, client.lastName].filter(Boolean).join(' ') || client.email || 'Unknown client';
};

const formatDate = (value?: string) => {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleDateString();
};

const RetreatReserveListPanel: React.FC<RetreatReserveListPanelProps> = ({ retreatId, retreatName }) => {
  const [entries, setEntries] = useState<WaitingListEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ClientSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');

  const fetchEntries = async () => {
    if (!retreatId) return;
    setLoading(true);
    try {
      const response = await waitingListApi.getByRetreat(retreatId);
      setEntries((response.data || []) as WaitingListEntry[]);
    } catch (error) {
      console.error('Error loading reserve list:', error);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchEntries();
  }, [retreatId]);

  const currentClientIds = useMemo(
    () => new Set(entries.map((entry) => getClientId(entry.clientId || entry.client)).filter(Boolean)),
    [entries],
  );

  const handleSearch = async (value: string) => {
    setSearchQuery(value);
    if (!value.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await clientsApi.searchClients(value);
      const results = (response.data || []).map((client: any) => ({
        _id: client._id || '',
        firstName: client.firstName || '',
        lastName: client.lastName || '',
        email: client.email || '',
        phone: client.phone || '',
      })).filter((client: ClientSearchResult) => !currentClientIds.has(client._id));
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching clients for reserve list:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const addClient = async (clientId: string) => {
    if (!clientId || !retreatId) return;
    setSavingId(clientId);
    try {
      await waitingListApi.addToWaitingList({
        clientId,
        retreatId,
        priority: 'medium',
      });
      setSearchQuery('');
      setSearchResults([]);
      await fetchEntries();
    } catch (error: any) {
      console.error('Error adding client to reserve list:', error);
      alert(error?.response?.data?.message || 'Could not add the client to the reserve list.');
    } finally {
      setSavingId('');
    }
  };

  const removeEntry = async (entryId: string) => {
    if (!entryId) return;
    if (!window.confirm('Remove this client from the reserve list?')) return;
    setSavingId(entryId);
    try {
      await waitingListApi.removeFromWaitingList(entryId);
      await fetchEntries();
    } catch (error: any) {
      console.error('Error removing reserve-list entry:', error);
      alert(error?.response?.data?.message || 'Could not remove the client from the reserve list.');
    } finally {
      setSavingId('');
    }
  };

  const moveEntry = async (entryId: string, direction: 'up' | 'down') => {
    const index = entries.findIndex((entry) => getEntryId(entry) === entryId);
    if (index < 0) return;
    const targetPosition = direction === 'up' ? index : index + 2;
    if (targetPosition < 1 || targetPosition > entries.length) return;
    setSavingId(entryId);
    try {
      await waitingListApi.updatePositions(retreatId, {
        positions: [{ waitingListId: entryId, newPosition: targetPosition }],
      });
      await fetchEntries();
    } catch (error: any) {
      console.error('Error reordering reserve list:', error);
      alert(error?.response?.data?.message || 'Could not update the reserve-list position.');
    } finally {
      setSavingId('');
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
        Loading reserve list...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-blue-700">Reserve list</div>
            <h3 className="mt-1 text-lg font-semibold text-gray-900">{retreatName || 'This retreat'}</h3>
            <p className="mt-1 text-sm text-gray-600">
              Add clients who can step into this retreat if a place opens up.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
            <Users className="h-4 w-4" />
            {entries.length} reservist{entries.length === 1 ? '' : 's'}
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-2 block text-sm font-medium text-gray-700">Search client</label>
          <div className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2">
            <Search className="h-4 w-4 text-gray-400" />
            <input
              value={searchQuery}
              onChange={(e) => void handleSearch(e.target.value)}
              placeholder="Search clients by name, email, or phone..."
              className="w-full border-0 p-0 text-sm outline-none ring-0 focus:outline-none"
            />
          </div>
          {searching && <div className="mt-2 text-sm text-gray-500">Searching...</div>}
          {searchResults.length > 0 && (
            <div className="mt-2 max-h-60 overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm">
              {searchResults.map((client) => (
                <button
                  key={client._id}
                  type="button"
                  onClick={() => void addClient(client._id)}
                  disabled={savingId === client._id}
                  className="flex w-full items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 text-left text-sm hover:bg-gray-50 disabled:opacity-60"
                >
                  <div>
                    <div className="font-medium text-gray-900">{client.firstName} {client.lastName}</div>
                    <div className="text-xs text-gray-500">{client.email || client.phone || client._id}</div>
                  </div>
                  <Plus className="h-4 w-4 text-blue-600" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h4 className="text-base font-semibold text-gray-900">Current reservists</h4>
            <p className="text-sm text-gray-500">Ordered by waiting-list position.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">
            <CheckSquare className="h-4 w-4" />
            Ready to move into the retreat
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">
            No one on the reserve list yet.
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry, index) => (
              <div key={getEntryId(entry)} className="rounded-xl border border-gray-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-blue-100 px-2 text-sm font-semibold text-blue-800">
                        #{entry.position || index + 1}
                      </span>
                      <div className="text-base font-semibold text-gray-900">{getClientLabel(entry.client || entry.clientId)}</div>
                    </div>
                    <div className="mt-1 text-sm text-gray-500">
                      {entry.status || 'waiting'} · {entry.priority || 'medium'} priority · joined {formatDate(entry.joinedDate)}
                    </div>
                    {entry.notes && <div className="mt-2 text-sm text-gray-700">{entry.notes}</div>}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void moveEntry(getEntryId(entry), 'up')}
                      disabled={savingId === getEntryId(entry) || index === 0}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <GripVertical className="h-3.5 w-3.5" />
                      Up
                    </button>
                    <button
                      type="button"
                      onClick={() => void moveEntry(getEntryId(entry), 'down')}
                      disabled={savingId === getEntryId(entry) || index === entries.length - 1}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <GripVertical className="h-3.5 w-3.5" />
                      Down
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeEntry(getEntryId(entry))}
                      disabled={savingId === getEntryId(entry)}
                      className="inline-flex items-center gap-1 rounded-md border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RetreatReserveListPanel;
