import React, { useMemo, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';
import { retreatsApi, housesApi, bookingsApi, bookingFlowApi } from '../services/api';
import { Retreat, House, RetreatClient, BookingFlowItem, BookingFlowTemplate } from '../types';
import AppleButton from './AppleButton';
import { FiPlus, FiEdit2, FiTrash2, FiEye, FiList } from 'react-icons/fi';
import { buildBookingStepOptions, formatRetreatCalendarDate, getSelectedStepCellTone, isBookingStepComplete, retreatEndDateFromStart, retreatMonthGroup, validateRetreatCreateData } from './RetreatsGrid.helpers';
import { apiErrorMessage } from '../utils/apiErrorMessage';
import './RetreatsListRedesign.css';
import RetreatHolisticView from './RetreatHolisticView';
import { isCancelledBookingStatus } from './retreatClientVisibility';

// Simple wrapper to fix TypeScript icon issues
const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

const RetreatsGrid: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [bookings, setBookings] = useState<RetreatClient[]>([]);
  const [houses, setHouses] = useState<House[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'holistic' | 'requirements'>('list');
  const [isLoadingStepData, setIsLoadingStepData] = useState(false);
  const [retreatMatrices, setRetreatMatrices] = useState<Record<string, { items: BookingFlowItem[]; templates: BookingFlowTemplate[] }>>({});
  const [selectedBookingStepKey, setSelectedBookingStepKey] = useState('');
  const [editingRetreat, setEditingRetreat] = useState<Retreat | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Retreat>>({});
  const [editSaveError, setEditSaveError] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [pastRetreatsOpen, setPastRetreatsOpen] = useState(false);
  const [cancelledRetreatsOpen, setCancelledRetreatsOpen] = useState(false);
  const [retreatSearch, setRetreatSearch] = useState('');
  const [retreatStatusFilter, setRetreatStatusFilter] = useState('all');

  useEffect(() => {
    fetchRetreats();
    fetchHouses();
  }, []);

  const routePrefix = location.pathname.split('/').filter(Boolean)[0] || 'admin';
  const handleViewRetreat = (retreatId: string) => {
    navigate(`/${routePrefix}/retreats/${retreatId}`);
  };

  const fetchRetreats = async () => {
    try {
      setIsLoading(true);
      const [retreatsResponse, bookingsResponse] = await Promise.all([
        retreatsApi.getAll(),
        bookingsApi.getAll(),
      ]);
      const sortedRetreats = [...(retreatsResponse.data || [])].sort((a, b) => {
        const aTime = a.startDate ? new Date(a.startDate).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.startDate ? new Date(b.startDate).getTime() : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      });
      setRetreats(sortedRetreats);
      setBookings(bookingsResponse.data || []);
    } catch (error) {
      console.error('Error fetching retreats:', error);
      setRetreats([]);
      setBookings([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHouses = async () => {
    try {
      const response = await housesApi.getAll();
      setHouses(response.data || []);
    } catch (error) {
      console.error('Error fetching houses:', error);
      setHouses([]);
    }
  };

  // Function to generate unique background colors for each retreat row
  const getRetreatRowColor = (retreatId: string, index: number) => {
    const colors = [
      'bg-blue-50 hover:bg-blue-100',
      'bg-green-50 hover:bg-green-100',
      'bg-purple-50 hover:bg-purple-100',
      'bg-pink-50 hover:bg-pink-100',
      'bg-indigo-50 hover:bg-indigo-100',
      'bg-yellow-50 hover:bg-yellow-100',
      'bg-red-50 hover:bg-red-100',
      'bg-cyan-50 hover:bg-cyan-100',
      'bg-orange-50 hover:bg-orange-100',
      'bg-emerald-50 hover:bg-emerald-100',
      'bg-violet-50 hover:bg-violet-100',
      'bg-rose-50 hover:bg-rose-100'
    ];

    // Use index to assign colors consistently
    return colors[index % colors.length];
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this retreat?')) {
      try {
        await retreatsApi.delete(id);
        fetchRetreats();
      } catch (error) {
        console.error('Error deleting retreat:', error);
      }
    }
  };

  const formatDate = (date: string | Date | undefined) => {
    return formatRetreatCalendarDate(date);
  };

  const getRetreatCodeValue = (retreat: Partial<Retreat>) =>
    retreat.code || retreat.retreatCode || '';

  const getRetreatTown = (retreat: Partial<Retreat>) => {
    const explicitTown = String(retreat.location_town || retreat.locationTown || retreat.location || '').trim();
    if (explicitTown && explicitTown !== 'Default Location') return explicitTown;
    const houseId = getObjectId(retreat.houseId);
    const house = retreat.houseId && typeof retreat.houseId === 'object'
      ? retreat.houseId as House
      : houses.find((item) => item._id === houseId);
    return house?.generalTown || house?.general_town || house?.city || house?.name || explicitTown;
  };

  const getObjectId = (value: any): string => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return value._id || value.id || '';
  };

  const { operationalRetreats, pastRetreats, cancelledRetreats } = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const cancelled = retreats.filter((retreat) => retreat.status === 'cancelled');
    const past = retreats.filter((retreat) => {
      if (retreat.status === 'cancelled') return false;
      const endTime = retreat.endDate ? new Date(retreat.endDate).getTime() : NaN;
      return retreat.status === 'completed' || (Number.isFinite(endTime) && endTime < startOfToday.getTime());
    }).sort((left, right) => new Date(right.endDate || right.startDate || 0).getTime() - new Date(left.endDate || left.startDate || 0).getTime());
    const pastIds = new Set(past.map((retreat) => getObjectId(retreat)));
    const operational = retreats.filter((retreat) => retreat.status !== 'cancelled' && !pastIds.has(getObjectId(retreat)))
      .sort((left, right) => {
        const isCurrent = (retreat: Retreat) => {
          if (retreat.status === 'active') return true;
          const start = retreat.startDate ? new Date(retreat.startDate).getTime() : Number.POSITIVE_INFINITY;
          const end = retreat.endDate ? new Date(retreat.endDate).getTime() : Number.NEGATIVE_INFINITY;
          return start <= Date.now() && end >= startOfToday.getTime();
        };
        const currentDifference = Number(isCurrent(right)) - Number(isCurrent(left));
        if (currentDifference) return currentDifference;
        return new Date(left.startDate || 8640000000000000).getTime() - new Date(right.startDate || 8640000000000000).getTime();
      });
    return { operationalRetreats: operational, pastRetreats: past, cancelledRetreats: cancelled };
  }, [retreats]);

  const getRetreatBookings = (retreat: Retreat) => {
    const retreatId = getObjectId(retreat);
    return bookings
      .filter((booking: any) => getObjectId(booking.retreatId) === retreatId && !isCancelledBookingStatus(booking.status))
      .sort((a, b) => Number(a.bookingNumber || 0) - Number(b.bookingNumber || 0));
  };

  const displayedRetreats = operationalRetreats.filter((retreat) => {
    const search = retreatSearch.trim().toLowerCase();
    const occupied = getRetreatBookings(retreat).length;
    const capacity = Number(retreat.capacity || 0);
    const visualStatus = capacity > 0 && occupied >= capacity ? 'full' : occupied > 0 ? 'filling' : 'upcoming';
    const matchesStatus = retreatStatusFilter === 'all' || visualStatus === retreatStatusFilter || retreat.status === retreatStatusFilter;
    const matchesSearch = !search || [getRetreatCodeValue(retreat), retreat.name, getRetreatTown(retreat)].filter(Boolean).join(' ').toLowerCase().includes(search);
    return matchesStatus && matchesSearch;
  });

  const groupedRetreats = useMemo(() => displayedRetreats.reduce<Array<{ key: string; label: string; retreats: Retreat[] }>>((groups, retreat) => {
    const month = retreatMonthGroup(retreat.startDate);
    let group = groups.find((candidate) => candidate.key === month.key);
    if (!group) {
      group = { ...month, retreats: [] };
      groups.push(group);
    }
    group.retreats.push(retreat);
    return groups;
  }, []), [displayedRetreats]);

  const loadStepData = async () => {
    const retreatIds = retreats.map((retreat) => getObjectId(retreat)).filter(Boolean);
    if (retreatIds.length === 0) {
      setRetreatMatrices({});
      return;
    }

    setIsLoadingStepData(true);
    try {
      const libraryResponse = await bookingFlowApi.getLibraryTemplates().catch(() => ({ data: [] as BookingFlowTemplate[] }));
      const libraryTemplates = libraryResponse.data || [];
      const results = await Promise.all(
        retreatIds.map(async (retreatId) => {
          try {
            const response = await bookingFlowApi.getMatrix(retreatId);
            return [
              retreatId,
              {
                items: response.data?.items || [],
                // Include the global library metadata so the Requirements
                // view uses the same source of truth as Booking Requirements.
                templates: [...(response.data?.templates || []), ...libraryTemplates],
              },
            ] as const;
          } catch (error) {
            console.error('Error loading retreat booking step data:', error);
            return [retreatId, { items: [], templates: [] }] as const;
          }
        })
      );
      setRetreatMatrices(Object.fromEntries(results) as Record<string, { items: BookingFlowItem[]; templates: BookingFlowTemplate[] }>);
    } finally {
      setIsLoadingStepData(false);
    }
  };

  useEffect(() => {
    if ((viewMode !== 'holistic' && viewMode !== 'requirements') || retreats.length === 0) return;
    loadStepData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, retreats]);

  const bookingStepOptions = useMemo(() => {
    return buildBookingStepOptions(Object.values(retreatMatrices));
  }, [retreatMatrices]);

  useEffect(() => {
    if (viewMode !== 'holistic' && viewMode !== 'requirements') return;
    if (bookingStepOptions.length === 0) {
      setSelectedBookingStepKey('');
      return;
    }

    setSelectedBookingStepKey((current) => {
      if (current && bookingStepOptions.some((option) => option.key === current)) {
        return current;
      }
      const contractOption = bookingStepOptions.find((option) => option.key.toLowerCase().includes('contract'));
      return contractOption?.key || bookingStepOptions[0].key;
    });
  }, [bookingStepOptions, viewMode]);

  const selectedBookingStepOption = useMemo(
    () => bookingStepOptions.find((option) => option.key === selectedBookingStepKey) || null,
    [bookingStepOptions, selectedBookingStepKey]
  );

  const getStepStatusForBooking = (retreatId: string, bookingId: string) => {
    if (!selectedBookingStepOption) return null;
    const matrix = retreatMatrices[retreatId];
    if (!matrix?.items?.length) return null;
    const item = matrix.items.find((candidate) => getObjectId(candidate.bookingId) === bookingId && candidate.key === selectedBookingStepOption.key);
    return item || null;
  };

  const getClientName = (booking: any) => {
    const client = booking.clientId;
    if (client && typeof client === 'object') {
      return [client.firstName || client.fname, client.lastName || client.lname].filter(Boolean).join(' ') || client.email || 'Unknown client';
    }
    return 'Unknown client';
  };

  const getClientEmail = (booking: any) => {
    const client = booking.clientId;
    if (client && typeof client === 'object') {
      return String(client.email || '').trim();
    }
    return '';
  };

  const getClientDisplayId = (booking: any) => {
    const client = booking.clientId;
    if (client && typeof client === 'object') {
      return client.display_id || client.clientNumber || getObjectId(client).slice(-6);
    }
    return getObjectId(client).slice(-6) || '-';
  };

  const getClientLanguage = (booking: any) => {
    const client = booking.clientId;
    return client && typeof client === 'object' ? client.language || '-' : '-';
  };

  const handleHouseSelection = (value: string) => {
    if (!value) {
      setFormData((prev) => ({
        ...prev,
        houseId: '',
      }));
      return;
    }

    const selectedHouse = houses.find((house) => house.name === value || house._id === value);
    const houseCapacity = selectedHouse?.capacity || selectedHouse?.guestCapacity;
    const town = selectedHouse?.generalTown || selectedHouse?.general_town || selectedHouse?.city || selectedHouse?.name;

    setFormData((prev) => ({
      ...prev,
      ...(town ? { location: town, location_town: town } : {}),
      houseId: selectedHouse?._id || prev.houseId,
      capacity: houseCapacity ? Number(houseCapacity) : prev.capacity,
    }));
  };

  const retreatLabelStyle = (retreat: Partial<Retreat>) => ({
    backgroundColor: retreat.backgroundColor || 'transparent',
    color: retreat.textColor || (retreat.backgroundColor ? '#111827' : 'inherit'),
    padding: retreat.backgroundColor ? '4px 12px' : '0',
    borderRadius: retreat.backgroundColor ? '4px' : '0',
    display: 'inline-block',
  });

  const renderColorControls = () => (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Label Color
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={formData.textColor || '#111827'}
              onChange={(e) => setFormData({ ...formData, textColor: e.target.value })}
              className="h-10 w-14 cursor-pointer rounded border border-gray-300 bg-white"
            />
            <input
              type="text"
              value={formData.textColor || '#111827'}
              onChange={(e) => setFormData({ ...formData, textColor: e.target.value })}
              placeholder="#111827"
              className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Background Color
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={formData.backgroundColor || '#FFFFFF'}
              onChange={(e) => setFormData({ ...formData, backgroundColor: e.target.value })}
              className="h-10 w-14 cursor-pointer rounded border border-gray-300 bg-white"
            />
            <input
              type="text"
              value={formData.backgroundColor || ''}
              onChange={(e) => setFormData({ ...formData, backgroundColor: e.target.value || undefined })}
              placeholder="#FFFFFF"
              className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-md border border-gray-200 bg-white p-3">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Preview</div>
        <div className="grid grid-cols-3 items-center gap-3 rounded-md border border-gray-100 px-3 py-3 text-sm">
          <div className="font-medium text-gray-900">
            <span style={retreatLabelStyle(formData)}>
              {formData.name || 'Retreat name'}
            </span>
          </div>
          <div className="text-gray-600">{getRetreatTown(formData) || 'Location town'}</div>
          <div className="text-gray-600">{formData.status || 'upcoming'}</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFormData({ ...formData, textColor: undefined })}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          Clear label
        </button>
        <button
          type="button"
          onClick={() => setFormData({ ...formData, backgroundColor: undefined })}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          Clear background
        </button>
      </div>
    </div>
  );

  if (isLoading) {
    return <LoadingSpinner message="Loading retreats..." />;
  }

  return (
    <div className="retreat-register-page">
      <div className="retreat-register-header">
        <div>
          <h1>Retreats</h1>
          <p>{operationalRetreats.length} upcoming · {operationalRetreats.reduce((sum, retreat) => sum + Math.max(0, Number(retreat.capacity || 0) - getRetreatBookings(retreat).length), 0)} places still open{operationalRetreats[0]?.startDate ? ` · next one starts in ${Math.max(0, Math.ceil((new Date(operationalRetreats[0].startDate).getTime() - Date.now()) / 86400000))} days` : ''}</p>
          <div className="retreat-register-tabs">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={viewMode === 'list' ? 'is-active' : ''}
            >
              Retreat List
            </button>
            <button
              type="button"
              onClick={() => setViewMode('holistic')}
              className={viewMode === 'holistic' ? 'is-active' : ''}
            >
              Holistic View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('requirements')}
              className={viewMode === 'requirements' ? 'is-active' : ''}
            >
              Requirements
            </button>
            <Link
              to={`/${routePrefix}/booking-step-deadlines`}
              className=""
            >
              Step Deadlines
            </Link>
          </div>
        </div>
        <div className="retreat-register-primary-actions">
          <button
            onClick={fetchRetreats}
            className="retreat-register-refresh"
          >
            Refresh
          </button>
          <button
            onClick={() => {
              setFormData({
                name: '',
                code: '',
                retreatCode: '',
                location: '',
                location_town: '',
                status: 'upcoming',
                capacity: 20,
                currentOccupancy: 0,
                type: 'regular',
                startTime: '18:00',
                endTime: '21:00'
              });
              setEditSaveError('');
              setIsAddModalOpen(true);
            }}
            className="retreat-register-add"
          >
            <Icon icon={FiPlus} className="w-4 h-4 mr-1" />
            <span className="retreat-register-add-wide">Add retreat</span><span className="retreat-register-add-short">Add</span>
          </button>
        </div>
      </div>

      {viewMode === 'list' && <div className="retreat-register-filters">
        <input value={retreatSearch} onChange={(event) => setRetreatSearch(event.target.value)} placeholder="Find retreat or code" aria-label="Find retreat or code" />
        <select value={retreatStatusFilter} onChange={(event) => setRetreatStatusFilter(event.target.value)} aria-label="Filter retreats by status">
          <option value="all">All statuses</option><option value="full">Full</option><option value="filling">Filling</option><option value="upcoming">Upcoming</option><option value="active">Active</option>
        </select>
      </div>}

      {viewMode === 'holistic' || viewMode === 'requirements' ? (
        <><RetreatHolisticView requirementsMode={viewMode === 'requirements'} retreats={operationalRetreats} options={bookingStepOptions} selectedKey={selectedBookingStepKey} onSelect={setSelectedBookingStepKey} matrices={retreatMatrices} getId={getObjectId} getBookings={getRetreatBookings} getCode={getRetreatCodeValue} getTown={getRetreatTown} getClientName={getClientName} getClientDisplayId={getClientDisplayId} getClientLanguage={getClientLanguage} routePrefix={routePrefix} />{false && <div className="space-y-6">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Holistic retreat status</h2>
                <p className="text-sm text-gray-500">
                  {selectedBookingStepOption
                    ? `Showing who has ${selectedBookingStepOption?.label} completed across every retreat.`
                    : 'Choose a booking step to see who has completed it across every retreat.'}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:min-w-[320px]">
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Booking step</label>
                <select
                  value={selectedBookingStepKey}
                  onChange={(event) => setSelectedBookingStepKey(event.target.value)}
                  className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700"
                >
                  <option value="">{isLoadingStepData ? 'Loading booking steps...' : 'Select a booking step'}</option>
                  {bookingStepOptions.map((option) => (
                    <option key={option.key} value={option.key}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {operationalRetreats.map((retreat, index) => {
            const retreatBookings = getRetreatBookings(retreat);
            const retreatCode = getRetreatCodeValue(retreat) || retreat.name;
            const headerStyle = retreat.backgroundColor || retreat.textColor
              ? {
                  backgroundColor: retreat.backgroundColor || undefined,
                  color: retreat.textColor || undefined,
                }
              : undefined;

            return (
              <section key={retreat._id} className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => handleViewRetreat(retreat._id!)}
                  className={`flex w-full items-center justify-between px-5 py-4 text-left ${getRetreatRowColor(retreat._id!, index).replace('hover:bg-', 'bg-').split(' ')[0]}`}
                  style={headerStyle}
                >
                  <div>
                    <div className="text-2xl font-bold tracking-wide">
                      {retreatCode}
                    </div>
                    <div className="mt-1 text-sm font-medium opacity-80">
                      {formatDate(retreat.startDate)} to {formatDate(retreat.endDate)} · {getRetreatTown(retreat) || 'No location'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold">
                      {retreatBookings.length}{retreat.capacity ? ` / ${retreat.capacity}` : ''}
                    </div>
                    <div className="text-xs font-semibold uppercase tracking-wide opacity-75">people</div>
                  </div>
                </button>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Booking #</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Client ID</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Name</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Language</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                          {selectedBookingStepOption ? selectedBookingStepOption.label : 'Selected step'}
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {retreatBookings.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-4 text-sm text-gray-500">No bookings for this retreat.</td>
                        </tr>
                      ) : (
                        retreatBookings.map((booking: any) => {
                          const selectedStepItem = getStepStatusForBooking(getObjectId(retreat), getObjectId(booking));
                          const completed = isBookingStepComplete(selectedStepItem);
                          const tone = getSelectedStepCellTone(completed);
                          return (
                            <tr key={booking._id} className="hover:bg-gray-50">
                            <td className="whitespace-nowrap px-4 py-2 text-sm font-semibold text-gray-900">
                              <button
                                type="button"
                                onClick={() => handleViewRetreat(retreat._id!)}
                                className="text-blue-700 hover:underline"
                              >
                                {booking.bookingNumber || booking._id?.slice(-6) || '-'}
                              </button>
                            </td>
                            <td className="whitespace-nowrap px-4 py-2 text-sm font-semibold text-gray-900">
                              <Link
                                to={`/${routePrefix}/clients/${getObjectId(booking.clientId)}`}
                                className="text-blue-700 hover:underline"
                                title="View client profile"
                              >
                                Client #{getClientDisplayId(booking)}
                              </Link>
                            </td>
                            <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-900">
                              <Link
                                to={`/${routePrefix}/clients/${getObjectId(booking.clientId)}`}
                                className="block font-medium text-blue-700 hover:underline"
                                title="View client profile"
                              >
                                {getClientName(booking)}
                              </Link>
                              {!getClientEmail(booking) && (
                                <div className="mt-0.5 text-xs font-semibold text-red-600">
                                  No email
                                </div>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-700">
                              {getClientLanguage(booking)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2 text-sm">
                              <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                                {booking.status || 'pending'}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-2 text-sm">
                              {selectedBookingStepOption ? (
                                <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${tone.badge}`}>
                                  {completed ? 'Yes' : 'No'}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-700">
                              {booking.totalAmount ? `${booking.totalAmount} ${booking.currency || ''}` : '-'}
                            </td>
                          </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>}</>
      ) : (
      <div className="retreat-register-list">
        {groupedRetreats.map((group) => <section className="retreat-month" key={group.key}>
          <header><h2>{group.label}</h2><span>{group.retreats.length} retreat{group.retreats.length === 1 ? '' : 's'} · {group.retreats.reduce((sum, retreat) => sum + Math.max(0, Number(retreat.capacity || 0) - getRetreatBookings(retreat).length), 0)} places open</span></header>
          {group.retreats.map((retreat) => {
            const occupied = getRetreatBookings(retreat).length;
            const capacity = Number(retreat.capacity || 0);
            const places = Math.max(0, capacity - occupied);
            const percent = capacity ? Math.min(100, occupied / capacity * 100) : 0;
            const daysAway = retreat.startDate ? Math.max(0, Math.ceil((new Date(retreat.startDate).getTime() - Date.now()) / 86400000)) : null;
            const visualStatus = capacity && occupied >= capacity ? 'full' : occupied > 0 ? 'filling' : 'upcoming';
            const accent = retreat.backgroundColor || ['#3b82f6', '#aab98d', '#ef8749', '#65d70a', '#6366f1'][displayedRetreats.indexOf(retreat) % 5];
            const edit = () => navigate(`/${routePrefix}/retreats/${retreat._id}/edit`);
            return <article className="retreat-register-card" style={{ '--retreat-accent': accent } as React.CSSProperties} key={retreat._id}>
              <button className="retreat-register-code" type="button" onClick={() => handleViewRetreat(retreat._id!)}>{getRetreatCodeValue(retreat) || retreat.name}</button>
              <div className="retreat-register-details"><strong>{formatRetreatCalendarDate(retreat.startDate, { month: 'short', day: 'numeric' })} – {formatRetreatCalendarDate(retreat.endDate, { month: 'short', day: 'numeric', year: 'numeric' })}</strong><span>{getRetreatTown(retreat) || 'No location'} · {retreat.type || 'Regular'}</span></div>
              <span className={`retreat-register-status is-${visualStatus}`}>{visualStatus}</span>
              <div className="retreat-register-capacity"><strong>{occupied}<small>/{capacity || '—'}</small></strong><span>{places === 0 ? 'no places left' : `${places} place${places === 1 ? '' : 's'} open`}</span></div>
              <div className="retreat-register-progress"><div><i style={{ width: `${percent}%` }} /></div><span>{daysAway === null ? 'Date not set' : `${daysAway} days away`}</span></div>
              <div className="retreat-register-actions">
                <button onClick={() => handleViewRetreat(retreat._id!)} title="View retreat"><Icon icon={FiEye} /><span>View</span></button>
                <button onClick={edit} title="Edit retreat"><Icon icon={FiEdit2} /><span>Edit</span></button>
                <button onClick={() => { setViewMode('holistic'); }} title="View retreat clients"><Icon icon={FiList} /></button>
                <button className="is-danger" onClick={() => handleDelete(retreat._id!)} title="Delete retreat"><Icon icon={FiTrash2} /></button>
              </div>
            </article>;
          })}
        </section>)}
        {displayedRetreats.length === 0 && <div className="retreat-register-empty">No retreats match these filters.</div>}
      </div>
      )}

      {pastRetreats.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <button type="button" onClick={() => setPastRetreatsOpen((open) => !open)} className="flex w-full items-center justify-between px-5 py-4 text-left font-semibold text-gray-700 hover:bg-gray-50" aria-expanded={pastRetreatsOpen}>
            <span>Past retreats ({pastRetreats.length})</span>
            <span aria-hidden="true">{pastRetreatsOpen ? '▲' : '▼'}</span>
          </button>
          {pastRetreatsOpen && (
            <div className="divide-y divide-gray-100 border-t border-gray-200">
              {pastRetreats.map((retreat) => (
                <button key={retreat._id} type="button" onClick={() => handleViewRetreat(retreat._id!)} className="grid w-full grid-cols-1 gap-1 px-5 py-3 text-left hover:bg-gray-50 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-6">
                  <strong>{getRetreatCodeValue(retreat) || retreat.name}</strong>
                  <span className="text-sm text-gray-500">{formatDate(retreat.startDate)} – {formatDate(retreat.endDate)}</span>
                  <span className="text-sm text-gray-500">{getRetreatTown(retreat) || 'No location'}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {cancelledRetreats.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white">
          <button type="button" onClick={() => setCancelledRetreatsOpen((open) => !open)} className="flex w-full items-center justify-between px-5 py-3 text-left text-sm font-semibold text-gray-500 hover:bg-gray-50" aria-expanded={cancelledRetreatsOpen}>
            <span>Cancelled retreats ({cancelledRetreats.length})</span>
            <span aria-hidden="true">{cancelledRetreatsOpen ? '▲' : '▼'}</span>
          </button>
          {cancelledRetreatsOpen && cancelledRetreats.map((retreat) => (
            <button key={retreat._id} type="button" onClick={() => handleViewRetreat(retreat._id!)} className="flex w-full justify-between border-t border-gray-100 px-5 py-3 text-left text-sm text-gray-500 hover:bg-gray-50">
              <span>{getRetreatCodeValue(retreat) || retreat.name}</span><span>{formatDate(retreat.startDate)}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-gray-700">
          Showing {operationalRetreats.length} current or upcoming retreat{operationalRetreats.length !== 1 ? 's' : ''}
        </div>
        <div className="hidden items-center gap-4 md:flex">
          <div className="text-sm text-gray-700">
            Upcoming: {retreats.filter(r => r.status === 'upcoming').length}
          </div>
          <div className="text-sm text-gray-700">
            Active: {retreats.filter(r => r.status === 'active').length}
          </div>
          <div className="text-sm text-gray-700">
            Completed: {retreats.filter(r => r.status === 'completed').length}
          </div>
        </div>
      </div>

      {/* Add Retreat Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-white md:bg-black/50 md:items-center">
          <div className="w-full h-full overflow-y-auto bg-white p-4 md:h-auto md:max-h-[90vh] md:w-[42rem] md:rounded-lg md:p-6">
            <h2 className="mb-4 text-lg font-semibold">Add New Retreat</h2>

            <div className="space-y-3 md:space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter retreat name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code
                </label>
                <input
                  type="text"
                  value={formData.code || formData.retreatCode || ''}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value, retreatCode: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. BEN-08-03-26"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location town
                </label>
                <input
                  type="text"
                  value={formData.location_town || formData.location || ''}
                  onChange={(e) => setFormData({ ...formData, location_town: e.target.value, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Benesov"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  House
                </label>
                <select
                  value={getObjectId(formData.houseId)}
                  onChange={(e) => handleHouseSelection(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a house</option>
                  {houses.map((house) => (
                    <option key={house._id} value={house._id || house.name}>
                      {house.name} - {house.address}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Number of ceremonies</label>
                <input type="number" min="1" value={formData.ceremonyCount ?? 2}
                  onChange={(e) => setFormData({ ...formData, ceremonyCount: Math.max(1, parseInt(e.target.value, 10) || 2) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Capacity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.capacity ?? ''}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value === '' ? undefined : parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type
                  </label>
                  <select
                    value={formData.type || 'regular'}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as 'regular' | 'booster' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="regular">Regular</option>
                    <option value="booster">Booster</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Enter description (optional)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={formData.startDate ? new Date(formData.startDate).toISOString().split('T')[0] : ''}
                  onChange={(e) => {
                    const startDate = e.target.value;
                    setFormData({
                      ...formData,
                      startDate: startDate ? new Date(startDate).toISOString() : undefined,
                      endDate: startDate ? retreatEndDateFromStart(startDate) : undefined,
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  value={formData.startTime || ''}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value || undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={formData.endDate ? new Date(formData.endDate).toISOString().split('T')[0] : ''}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  value={formData.endTime || ''}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value || undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {renderColorControls()}
            </div>

            <div className="flex flex-col-reverse gap-3 pt-6 md:flex-row md:justify-end">
              {editSaveError && (
                <div className="w-full rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 md:mr-auto">
                  {editSaveError}
                </div>
              )}
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setFormData({});
                }}
                className="w-full px-4 py-2 text-gray-600 hover:text-gray-800 md:w-auto"
              >
                Cancel
              </button>
              <AppleButton
                variant="secondary"
                onClick={async () => {
                  setEditSaveError('');
                  try {
                    const town = getRetreatTown(formData);
                    const validationErrors = validateRetreatCreateData({ ...formData, location: town });
                    if (validationErrors.length) {
                      setEditSaveError(validationErrors.join(' '));
                      return;
                    }
                    setCreateSaving(true);

                    const retreatData = {
                      name: formData.name!,
                      code: formData.code?.trim() || formData.retreatCode?.trim() || undefined,
                      retreatCode: formData.code?.trim() || formData.retreatCode?.trim() || undefined,
                      location_town: town,
                      location: town,
                      houseId: getObjectId(formData.houseId) || undefined,
                      status: formData.status || 'upcoming' as 'upcoming' | 'active' | 'completed' | 'cancelled',
                      capacity: formData.capacity ?? 20,
                      currentOccupancy: formData.currentOccupancy || 0,
                      type: formData.type || 'regular' as 'regular' | 'booster',
                      ceremonyCount: formData.ceremonyCount ?? 2,
                      description: formData.description || '',
                      startDate: formData.startDate,
                      startTime: formData.startTime,
                      endDate: formData.endDate,
                      endTime: formData.endTime,
                      backgroundColor: formData.backgroundColor,
                      textColor: formData.textColor
                    };
                    await retreatsApi.create(retreatData);
                    fetchRetreats();
                    setIsAddModalOpen(false);
                    setFormData({});
                  } catch (error) {
                    console.error('Error creating retreat:', error);
                    setEditSaveError(apiErrorMessage(error, 'Unable to create retreat.'));
                  } finally {
                    setCreateSaving(false);
                  }
                }}
                disabled={createSaving}
                className="w-full md:w-auto"
              >
                {createSaving ? 'Creating…' : 'Create Retreat'}
              </AppleButton>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-white md:bg-black/50 md:items-center">
          <div className="w-full h-full overflow-y-auto bg-white p-4 md:h-auto md:max-h-[90vh] md:w-[42rem] md:rounded-lg md:p-6">
            <h2 className="mb-4 text-lg font-semibold">Edit Retreat</h2>

            <div className="space-y-3 md:space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter retreat name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code
                </label>
                <input
                  type="text"
                  value={formData.code || formData.retreatCode || ''}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value, retreatCode: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. BEN-08-03-26"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location town
                </label>
                <input
                  type="text"
                  value={formData.location_town || formData.location || ''}
                  onChange={(e) => setFormData({ ...formData, location_town: e.target.value, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Benesov"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  House
                </label>
                <select
                  value={getObjectId(formData.houseId)}
                  onChange={(e) => handleHouseSelection(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a house</option>
                  {houses.map((house) => (
                    <option key={house._id} value={house._id || house.name}>
                      {house.name} - {house.address}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Number of ceremonies</label>
                <input type="number" min="1" value={formData.ceremonyCount ?? 2}
                  onChange={(e) => setFormData({ ...formData, ceremonyCount: Math.max(1, parseInt(e.target.value, 10) || 2) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Capacity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.capacity ?? ''}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value === '' ? undefined : parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type
                  </label>
                  <select
                    value={formData.type || 'regular'}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as 'regular' | 'booster' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="regular">Regular</option>
                    <option value="booster">Booster</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Enter description (optional)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={formData.startDate ? new Date(formData.startDate).toISOString().split('T')[0] : ''}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  value={formData.startTime || ''}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value || undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={formData.endDate ? new Date(formData.endDate).toISOString().split('T')[0] : ''}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  value={formData.endTime || ''}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value || undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={formData.status || 'upcoming'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'upcoming' | 'active' | 'completed' | 'cancelled' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {renderColorControls()}
            </div>

            <div className="flex flex-col-reverse gap-3 pt-6 md:flex-row md:justify-end">
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingRetreat(null);
                  setFormData({});
                }}
                className="w-full px-4 py-2 text-gray-600 hover:text-gray-800 md:w-auto"
              >
                Cancel
              </button>
              <AppleButton
                variant="secondary"
                onClick={async () => {
                  setEditSaveError('');
                  try {
                    if (editingRetreat?._id) {
                      const town = getRetreatTown(formData);
                      if (!formData.name?.trim() || !town || !formData.startDate || !formData.endDate || !formData.capacity) {
                        setEditSaveError('Name, location, dates, and capacity are required.');
                        return;
                      }
                      setEditSaving(true);
                      const code = formData.code?.trim() || formData.retreatCode?.trim() || undefined;
                      const updateData: Partial<Retreat> = {
                        name: formData.name.trim(),
                        code,
                        retreatCode: code,
                        location_town: town,
                        location: town,
                        houseId: getObjectId(formData.houseId) || undefined,
                        ceremonyCount: formData.ceremonyCount,
                        capacity: Number(formData.capacity),
                        currentOccupancy: Number(formData.currentOccupancy || 0),
                        type: formData.type || 'regular',
                        description: formData.description || '',
                        startDate: formData.startDate,
                        startTime: formData.startTime || undefined,
                        endDate: formData.endDate,
                        endTime: formData.endTime || undefined,
                        status: formData.status || 'upcoming',
                        backgroundColor: formData.backgroundColor,
                        textColor: formData.textColor,
                      };
                      await retreatsApi.update(editingRetreat._id, updateData);
                      await fetchRetreats();
                      setIsEditModalOpen(false);
                      setEditingRetreat(null);
                      setFormData({});
                    }
                  } catch (error: any) {
                    console.error('Error updating retreat:', error);
                    const message = error?.response?.data?.message || error?.message || 'Unable to save retreat.';
                    setEditSaveError(Array.isArray(message) ? message.join(' ') : String(message));
                  } finally {
                    setEditSaving(false);
                  }
                }}
                disabled={editSaving}
                className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 md:w-auto"
              >
                {editSaving ? 'Saving…' : 'Save Changes'}
              </AppleButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RetreatsGrid;
