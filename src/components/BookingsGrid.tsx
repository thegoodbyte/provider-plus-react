import React, { useState, useEffect, useMemo } from 'react';
import { bookingsApi, clientsApi, retreatsApi } from '../services/api';
import { RetreatClient, Client, Retreat } from '../types';
import AppleButton from './AppleButton';
import { FiPlus, FiEdit2, FiTrash2, FiEye, FiUser, FiCalendar } from 'react-icons/fi';

// Simple wrapper to fix TypeScript icon issues
const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

interface BookingWithDetails extends RetreatClient {
  clientName?: string;
  retreatName?: string;
}

const BookingsGrid: React.FC = () => {
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [formData, setFormData] = useState({
    clientId: '',
    retreatId: '',
    totalAmount: 0,
    currency: 'EUR' as 'EUR' | 'USD' | 'CZK' | 'PLN',
    status: 'pending' as 'pending' | 'confirmed' | 'checked-in' | 'checked-out' | 'cancelled'
  });

  useEffect(() => {
    fetchBookings();
    fetchClientsAndRetreats();
  }, []);

  const fetchClientsAndRetreats = async () => {
    try {
      const [clientsResponse, retreatsResponse] = await Promise.all([
        clientsApi.getAll(),
        retreatsApi.getAll()
      ]);
      setClients(clientsResponse.data || []);
      setRetreats(retreatsResponse.data || []);
    } catch (error) {
      console.error('Error fetching clients and retreats:', error);
    }
  };

  const fetchBookings = async () => {
    try {
      setIsLoading(true);

      // First get bookings
      const bookingsResponse = await bookingsApi.getAll();

      if (!bookingsResponse.data || bookingsResponse.data.length === 0) {
        setBookings([]);
        return;
      }

      // Extract unique client and retreat IDs from bookings
      const clientIdsSet = new Set(
        bookingsResponse.data
          .map((booking: RetreatClient) =>
            typeof booking.clientId === 'string' ? booking.clientId : (booking.clientId as any)?._id
          )
          .filter(Boolean)
      );
      const clientIds = Array.from(clientIdsSet);

      const retreatIdsSet = new Set(
        bookingsResponse.data
          .map((booking: RetreatClient) =>
            typeof booking.retreatId === 'string' ? booking.retreatId : (booking.retreatId as any)?._id
          )
          .filter(Boolean)
      );
      const retreatIds = Array.from(retreatIdsSet);

      // Optimize: Only fetch needed data if we have IDs, otherwise use minimal data
      const [clientsResponse, retreatsResponse] = await Promise.all([
        clientIds.length > 0 ? clientsApi.getAll() : Promise.resolve({ data: [] }),
        retreatIds.length > 0 ? retreatsApi.getAll() : Promise.resolve({ data: [] })
      ]);

      // Create efficient lookups with only needed data
      const clientsMap = new Map<string, Client>();
      if (clientsResponse.data && clientIds.length > 0) {
        clientsResponse.data
          .filter((client: Client) => client._id && clientIds.includes(client._id))
          .forEach((client: Client) => clientsMap.set(client._id!, client));
      }

      const retreatsMap = new Map<string, Retreat>();
      if (retreatsResponse.data && retreatIds.length > 0) {
        retreatsResponse.data
          .filter((retreat: Retreat) => retreat._id && retreatIds.includes(retreat._id))
          .forEach((retreat: Retreat) => retreatsMap.set(retreat._id!, retreat));
      }

      // Process bookings with optimized lookups
      const enrichedBookings: BookingWithDetails[] = bookingsResponse.data.map((booking: RetreatClient) => {
        const clientId = typeof booking.clientId === 'string' ? booking.clientId : (booking.clientId as any)?._id;
        const retreatId = typeof booking.retreatId === 'string' ? booking.retreatId : (booking.retreatId as any)?._id;

        const client = clientId ? clientsMap.get(clientId) : undefined;
        const retreat = retreatId ? retreatsMap.get(retreatId) : undefined;

        return {
          ...booking,
          clientName: client ? `${client.firstName} ${client.lastName}` : 'Unknown Client',
          retreatName: retreat ? retreat.name : 'Unknown Retreat'
        };
      });

      setBookings(enrichedBookings);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      setBookings([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      confirmed: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      cancelled: 'bg-red-100 text-red-800',
      completed: 'bg-blue-100 text-blue-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this booking?')) {
      try {
        await bookingsApi.delete(id);
        fetchBookings();
      } catch (error) {
        console.error('Error deleting booking:', error);
      }
    }
  };

  const formatDate = (date: string | Date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  };

  // Memoize computed values to prevent unnecessary re-calculations
  const bookingStats = useMemo(() => ({
    total: bookings.length,
    confirmed: bookings.filter(b => b.status === 'confirmed').length,
    pending: bookings.filter(b => b.status === 'pending').length,
    checkedOut: bookings.filter(b => (b.status as string) === 'checked-out').length
  }), [bookings]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading bookings...</div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Bookings</h1>
        <AppleButton
          onClick={() => setShowAddModal(true)}
          className="apple-button-primary"
        >
          <Icon icon={FiPlus} className="w-4 h-4 mr-2" />
          Add Booking
        </AppleButton>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Booking #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Retreat
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Booking Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {bookings.map((booking) => (
                <tr key={booking._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      #{booking.bookingNumber || booking._id?.slice(-6)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Icon icon={FiUser} className="w-4 h-4 mr-2 text-gray-400" />
                      <div className="text-sm text-gray-900">{booking.clientName}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Icon icon={FiCalendar} className="w-4 h-4 mr-2 text-gray-400" />
                      <div className="text-sm text-gray-900">{booking.retreatName}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(booking.createdAt || (booking as any).bookingDate)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(booking.status || 'pending')}`}>
                      {booking.status || 'pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => console.log('View booking:', booking._id)}
                        className="text-blue-600 hover:text-blue-900"
                        title="View Details"
                      >
                        <Icon icon={FiEye} className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => console.log('Edit booking:', booking._id)}
                        className="text-indigo-600 hover:text-indigo-900"
                        title="Edit"
                      >
                        <Icon icon={FiEdit2} className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(booking._id!)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete"
                      >
                        <Icon icon={FiTrash2} className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {bookings.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No bookings found
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-gray-700">
          Showing {bookingStats.total} booking{bookingStats.total !== 1 ? 's' : ''}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-700">
            Confirmed: {bookingStats.confirmed}
          </div>
          <div className="text-sm text-gray-700">
            Pending: {bookingStats.pending}
          </div>
          <div className="text-sm text-gray-700">
            Checked-out: {bookingStats.checkedOut}
          </div>
        </div>
      </div>

      {/* Add Booking Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md">
            <h2 className="text-lg font-semibold mb-4">Add New Booking</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client
                </label>
                <select
                  value={formData.clientId}
                  onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select a client...</option>
                  {clients.map((client) => (
                    <option key={client._id} value={client._id}>
                      {client.firstName} {client.lastName} - {client.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Retreat
                </label>
                <select
                  value={formData.retreatId}
                  onChange={(e) => setFormData({ ...formData, retreatId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select a retreat...</option>
                  {retreats.map((retreat) => (
                    <option key={retreat._id} value={retreat._id}>
                      {retreat.name} - {retreat.location}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.totalAmount}
                    onChange={(e) => setFormData({ ...formData, totalAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Currency
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value as 'EUR' | 'USD' | 'CZK' | 'PLN' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="CZK">CZK</option>
                    <option value="PLN">PLN</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'pending' | 'confirmed' | 'checked-in' | 'checked-out' | 'cancelled' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="checked-in">Checked In</option>
                  <option value="checked-out">Checked Out</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setFormData({
                    clientId: '',
                    retreatId: '',
                    totalAmount: 0,
                    currency: 'EUR',
                    status: 'pending'
                  });
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <AppleButton
                onClick={async () => {
                  try {
                    if (!formData.clientId || !formData.retreatId) {
                      alert('Please select both client and retreat');
                      return;
                    }

                    const selectedRetreat = retreats.find(r => r._id === formData.retreatId);

                    const bookingData = {
                      clientId: formData.clientId,
                      retreatId: formData.retreatId,
                      totalAmount: formData.totalAmount,
                      currency: formData.currency,
                      status: formData.status,
                      registrationDate: new Date().toISOString(),
                      amountPaid: 0,
                      checkInDate: selectedRetreat?.startDate || new Date().toISOString(),
                      checkOutDate: selectedRetreat?.endDate || new Date().toISOString()
                    };

                    await bookingsApi.create(bookingData);
                    fetchBookings();
                    setShowAddModal(false);
                    setFormData({
                      clientId: '',
                      retreatId: '',
                      totalAmount: 0,
                      currency: 'EUR',
                      status: 'pending'
                    });
                  } catch (error) {
                    console.error('Error creating booking:', error);
                    alert('Error creating booking. Please try again.');
                  }
                }}
                className="apple-button-primary"
              >
                Create Booking
              </AppleButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingsGrid;