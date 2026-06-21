import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, RefreshCw } from 'lucide-react';
import CeremoniesGrid from './CeremoniesGrid';
import LoadingSpinner from './LoadingSpinner';
import SearchableRetreatSelect from './SearchableRetreatSelect';
import { retreatsApi } from '../services/api';
import { Retreat } from '../types';

const formatDate = (value?: string | Date | null) => {
  if (!value) return 'No date';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'No date' : date.toLocaleDateString();
};

const getRetreatStartDate = (retreat: Retreat) => retreat.startDate || retreat.dates?.startDate || null;

const CeremoniesPage: React.FC = () => {
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [selectedRetreatId, setSelectedRetreatId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRetreats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await retreatsApi.getAll();
      const list = response.data || [];
      setRetreats(list);
      setSelectedRetreatId((current) => current);
    } catch (err) {
      console.error('Error loading retreats for ceremonies:', err);
      setError('Unable to load retreats.');
      setRetreats([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRetreats();
  }, []);

  const selectedRetreat = useMemo(
    () => retreats.find((retreat) => retreat._id === selectedRetreatId),
    [retreats, selectedRetreatId]
  );

  if (loading) {
    return <LoadingSpinner message="Loading retreats..." />;
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Ceremonies</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage ceremony dates, times, retreat links, medical approval, and participant tracking.
          </p>
        </div>
        <button
          type="button"
          onClick={loadRetreats}
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(280px,420px)_1fr]">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Retreat</label>
          <SearchableRetreatSelect
            retreats={retreats}
            selectedRetreatId={selectedRetreatId}
            onRetreatSelect={setSelectedRetreatId}
            placeholder="All ceremonies, or search a retreat"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setSelectedRetreatId('')}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                !selectedRetreatId
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              All ceremonies
            </button>
          </div>
        </div>

        {selectedRetreat && (
          <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="flex items-start gap-3">
              <CalendarDays className="mt-0.5 h-5 w-5 text-blue-700" />
              <div>
                <div className="font-medium text-gray-900">{selectedRetreat.name}</div>
                <div className="mt-1 text-sm text-gray-600">
                  {selectedRetreat.location || 'No location'} · {formatDate(getRetreatStartDate(selectedRetreat))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <CeremoniesGrid retreatId={selectedRetreatId || undefined} retreats={retreats} />
    </div>
  );
};

export default CeremoniesPage;
