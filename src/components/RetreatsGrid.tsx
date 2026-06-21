import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';
import { retreatsApi, housesApi, bookingsApi } from '../services/api';
import { Retreat, House, RetreatClient } from '../types';
import AppleButton from './AppleButton';
import { FiPlus, FiEdit2, FiTrash2, FiEye, FiCalendar, FiMapPin } from 'react-icons/fi';

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
  const [viewMode, setViewMode] = useState<'list' | 'holistic'>('list');
  const [editingRetreat, setEditingRetreat] = useState<Retreat | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Retreat>>({});

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

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      upcoming: 'bg-blue-100 text-blue-800',
      active: 'bg-green-100 text-green-800',
      completed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
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
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  };

  const getRetreatCodeValue = (retreat: Partial<Retreat>) =>
    retreat.code || retreat.retreatCode || '';

  const getRetreatTown = (retreat: Partial<Retreat>) =>
    retreat.location_town || retreat.locationTown || retreat.location || '';

  const getObjectId = (value: any): string => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return value._id || value.id || '';
  };

  const getRetreatBookings = (retreat: Retreat) => {
    const retreatId = getObjectId(retreat);
    return bookings
      .filter((booking: any) => getObjectId(booking.retreatId) === retreatId && booking.status !== 'cancelled')
      .sort((a, b) => Number(a.bookingNumber || 0) - Number(b.bookingNumber || 0));
  };

  const getClientName = (booking: any) => {
    const client = booking.clientId;
    if (client && typeof client === 'object') {
      return [client.firstName || client.fname, client.lastName || client.lname].filter(Boolean).join(' ') || client.email || 'Unknown client';
    }
    return 'Unknown client';
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
    <div className="p-6 h-full">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Retreats</h1>
          <div className="mt-3 inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              Retreat List
            </button>
            <button
              type="button"
              onClick={() => setViewMode('holistic')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${viewMode === 'holistic' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              Holistic View
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchRetreats}
            className="inline-flex w-auto shrink-0 items-center whitespace-nowrap rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300"
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
                type: 'regular'
              });
              setIsAddModalOpen(true);
            }}
            className="inline-flex w-auto shrink-0 items-center whitespace-nowrap rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300"
          >
            <Icon icon={FiPlus} className="w-4 h-4 mr-1" />
            Add New Retreat
          </button>
        </div>
      </div>

      {viewMode === 'holistic' ? (
        <div className="space-y-6">
          {retreats.map((retreat, index) => {
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
                        <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {retreatBookings.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-4 text-sm text-gray-500">No bookings for this retreat.</td>
                        </tr>
                      ) : (
                        retreatBookings.map((booking: any) => (
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
                              {getClientDisplayId(booking)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-900">
                              {getClientName(booking)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-700">
                              {getClientLanguage(booking)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2 text-sm">
                              <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                                {booking.status || 'pending'}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-700">
                              {booking.totalAmount ? `${booking.totalAmount} ${booking.currency || ''}` : '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      ) : (
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dates
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location town
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Capacity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {retreats.map((retreat, index) => (
                <tr key={retreat._id} className={getRetreatRowColor(retreat._id!, index)}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleViewRetreat(retreat._id!)}
                        className="rounded px-2 py-1 text-left text-sm font-medium text-gray-700 hover:text-gray-900 hover:underline focus:outline-none focus:ring-2 focus:ring-gray-500 bg-transparent"
                        style={retreatLabelStyle(retreat)}
                      >
                        {retreat.name}
                      </button>
                    </div>
                    {retreat.description && (
                      <div className="text-sm text-gray-500 truncate max-w-xs mt-1">
                        {retreat.description}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                    {retreat._id ? (
                      <button
                        type="button"
                        onClick={() => handleViewRetreat(retreat._id!)}
                        className="text-gray-700 hover:text-gray-900 hover:underline focus:outline-none"
                        style={{
                          backgroundColor: 'transparent !important',
                          border: 'none',
                          padding: '0',
                          background: 'none !important',
                          boxShadow: 'none',
                          borderRadius: '0'
                        }}
                      >
                        <span style={{ backgroundColor: 'transparent !important', background: 'none !important' }}>
                          {getRetreatCodeValue(retreat) || '-'}
                        </span>
                      </button>
                    ) : (
                      <span className="text-gray-900" style={{ backgroundColor: 'transparent !important', background: 'none !important' }}>
                        {getRetreatCodeValue(retreat) || '-'}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900">
                      <Icon icon={FiCalendar} className="w-4 h-4 mr-1 text-gray-400" />
                      <div>
                        <div>{formatDate(retreat.startDate)}</div>
                        <div className="text-xs text-gray-500">to {formatDate(retreat.endDate)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900">
                      <Icon icon={FiMapPin} className="w-4 h-4 mr-1 text-gray-400" />
                      {getRetreatTown(retreat) || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {retreat.capacity ? `${retreat.currentOccupancy || 0}/${retreat.capacity}` : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(retreat.status || 'upcoming')}`}>
                      {retreat.status || 'upcoming'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {retreat.type || 'regular'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewRetreat(retreat._id!)}
                        className="icon-action-btn icon-action-btn-view"
                        title="View Details"
                      >
                        <Icon icon={FiEye} />
                      </button>
                      <button
                        onClick={() => {
                          setEditingRetreat(retreat);
                          setFormData({
                            ...retreat,
                            code: getRetreatCodeValue(retreat),
                            retreatCode: getRetreatCodeValue(retreat),
                            location_town: getRetreatTown(retreat),
                            location: getRetreatTown(retreat),
                          });
                          setIsEditModalOpen(true);
                        }}
                        className="icon-action-btn icon-action-btn-edit"
                        title="Edit"
                      >
                        <Icon icon={FiEdit2} />
                      </button>
                      <button
                        onClick={() => handleDelete(retreat._id!)}
                        className="icon-action-btn icon-action-btn-danger"
                        title="Delete"
                      >
                        <Icon icon={FiTrash2} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {retreats.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No retreats found
            </div>
          )}
        </div>
      </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-gray-700">
          Showing {retreats.length} retreat{retreats.length !== 1 ? 's' : ''}
        </div>
        <div className="flex items-center gap-4">
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
                  value={formData.houseId || ''}
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
                  End Date
                </label>
                <input
                  type="date"
                  value={formData.endDate ? new Date(formData.endDate).toISOString().split('T')[0] : ''}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {renderColorControls()}
            </div>

            <div className="flex flex-col-reverse gap-3 pt-6 md:flex-row md:justify-end">
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
                  try {
                    if (!formData.name || !getRetreatTown(formData)) {
                      alert('Please enter name and location town');
                      return;
                    }

                    const retreatData = {
                      name: formData.name!,
                      code: formData.code?.trim() || formData.retreatCode?.trim() || undefined,
                      retreatCode: formData.code?.trim() || formData.retreatCode?.trim() || undefined,
                      location_town: getRetreatTown(formData),
                      location: getRetreatTown(formData),
                      houseId: formData.houseId,
                      status: formData.status || 'upcoming' as 'upcoming' | 'active' | 'completed' | 'cancelled',
                      capacity: formData.capacity ?? 20,
                      currentOccupancy: formData.currentOccupancy || 0,
                      type: formData.type || 'regular' as 'regular' | 'booster',
                      description: formData.description || '',
                      startDate: formData.startDate,
                      endDate: formData.endDate,
                      backgroundColor: formData.backgroundColor,
                      textColor: formData.textColor
                    };
                    await retreatsApi.create(retreatData);
                    fetchRetreats();
                    setIsAddModalOpen(false);
                    setFormData({});
                  } catch (error) {
                    console.error('Error creating retreat:', error);
                    alert('Error creating retreat. Please try again.');
                  }
                }}
                className="w-full md:w-auto"
              >
                Create Retreat
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
                  value={formData.houseId || ''}
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
                  try {
                    if (editingRetreat?._id) {
                      const updateData = {
                        ...formData,
                        code: formData.code?.trim() || formData.retreatCode?.trim() || undefined,
                        retreatCode: formData.code?.trim() || formData.retreatCode?.trim() || undefined,
                        location_town: getRetreatTown(formData),
                        location: getRetreatTown(formData),
                      };
                      await retreatsApi.update(editingRetreat._id, updateData);
                      fetchRetreats();
                      setIsEditModalOpen(false);
                      setEditingRetreat(null);
                      setFormData({});
                    }
                  } catch (error) {
                    console.error('Error updating retreat:', error);
                  }
                }}
                className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 md:w-auto"
              >
                Save Changes
              </AppleButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RetreatsGrid;
