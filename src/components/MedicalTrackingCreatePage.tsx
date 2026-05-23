import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import AppleButton from './AppleButton';
import LoadingSpinner from './LoadingSpinner';
import SearchableClientDropdown from './SearchableClientDropdown';
import SearchableRetreatSelect from './SearchableRetreatSelect';
import { clientMedicalApi, clientsApi, retreatsApi } from '../services/api';
import { Client, Retreat } from '../types';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => <IconComponent className={className} />;

const MedicalTrackingCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const routePrefix = location.pathname.startsWith('/medical/') ? '/medical' : '/admin';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [clientId, setClientId] = useState('');
  const [retreatId, setRetreatId] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [liverPanelStatus, setLiverPanelStatus] = useState<'pending' | 'received' | 'reviewed' | 'approved' | 'rejected'>('pending');
  const [ekgStatus, setEkgStatus] = useState<'pending' | 'received' | 'reviewed' | 'approved' | 'rejected'>('pending');
  const [finalMedicalClearance, setFinalMedicalClearance] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [clientsResponse, retreatsResponse] = await Promise.all([
          clientsApi.getAll(),
          retreatsApi.getAll(),
        ]);
        setClients(clientsResponse.data || []);
        setRetreats(retreatsResponse.data || []);
      } catch (error) {
        console.error('Error loading medical tracking create page:', error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const selectedClient = useMemo(() => clients.find((client) => client._id === clientId), [clients, clientId]);
  const selectedRetreat = useMemo(() => retreats.find((retreat) => retreat._id === retreatId), [retreats, retreatId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !retreatId) {
      alert('Select a client and retreat first');
      return;
    }

    try {
      setSaving(true);
      const response = await clientMedicalApi.create({
        clientId,
        retreatId,
        clientDisplayId: selectedClient?.display_id,
        liverPanelStatus,
        ekgStatus,
        finalMedicalClearance,
        generalNotes,
      } as any);

      navigate(`${routePrefix}/medical-tracking/${response.data._id}/edit`);
    } catch (error: any) {
      console.error('Error creating medical tracking record:', error);
      const message = error?.response?.data?.message || error?.message || 'Failed to create medical tracking record';
      alert(Array.isArray(message) ? message.join(', ') : message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading medical tracking form..." />;
  }

  return (
    <div className="min-h-[calc(100vh-96px)] bg-white px-3 py-4 sm:px-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mb-3 inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Icon icon={ArrowLeft} className="h-4 w-4" />
            Back
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">Add Medical Tracking Record</h1>
          <p className="text-sm text-gray-600">Create the client medical record first, then upload files on the edit page.</p>
        </div>
        <div className="text-sm text-gray-500 sm:text-right">
          {selectedClient && <div>{selectedClient.firstName} {selectedClient.lastName}</div>}
          {selectedRetreat && <div>{selectedRetreat.name}</div>}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <label className="mb-2 block text-sm font-medium text-gray-700">Client</label>
            <SearchableClientDropdown
              clients={clients}
              selectedClientId={clientId}
              onClientSelect={setClientId}
              placeholder="Search client by name, email, phone, or display ID"
              required
            />
            <div className="mt-2 text-xs text-gray-500">
              The client display ID will be saved with the record.
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <label className="mb-2 block text-sm font-medium text-gray-700">Retreat</label>
            <SearchableRetreatSelect
              retreats={retreats}
              selectedRetreatId={retreatId}
              onRetreatSelect={setRetreatId}
              placeholder="Search retreat"
              required
            />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">EKG Status</label>
                <select value={ekgStatus} onChange={(e) => setEkgStatus(e.target.value as typeof ekgStatus)} className="w-full rounded-md border border-gray-300 px-3 py-2">
                  <option value="pending">pending</option>
                  <option value="received">received</option>
                  <option value="reviewed">reviewed</option>
                  <option value="approved">approved</option>
                  <option value="rejected">rejected</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Liver Status</label>
                <select value={liverPanelStatus} onChange={(e) => setLiverPanelStatus(e.target.value as typeof liverPanelStatus)} className="w-full rounded-md border border-gray-300 px-3 py-2">
                  <option value="pending">pending</option>
                  <option value="received">received</option>
                  <option value="reviewed">reviewed</option>
                  <option value="approved">approved</option>
                  <option value="rejected">rejected</option>
                </select>
              </div>
            </div>

            <label className="mt-4 flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={finalMedicalClearance}
                onChange={(e) => setFinalMedicalClearance(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              Final medical clearance
            </label>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <label className="mb-2 block text-sm font-medium text-gray-700">General Notes</label>
            <textarea
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              rows={7}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              placeholder="Optional internal notes about this medical record"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <AppleButton type="button" onClick={() => navigate(-1)} variant="secondary">
            Cancel
          </AppleButton>
          <AppleButton type="submit" disabled={saving} className="min-w-36">
            <Icon icon={Save} className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Create Record'}
          </AppleButton>
        </div>
      </form>
    </div>
  );
};

export default MedicalTrackingCreatePage;
