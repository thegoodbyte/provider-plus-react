import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { bookingsApi, clientsApi, retreatsApi } from '../services/api';
import { RetreatClient, Client, Retreat } from '../types';
import AppleButton from './AppleButton';
import SearchableClientSelect from './SearchableClientSelect';
import LoadingSpinner from './LoadingSpinner';
import { FiPlus, FiEdit2, FiTrash2, FiEye, FiUser, FiCalendar, FiFileText, FiSearch, FiChevronUp, FiChevronDown } from 'react-icons/fi';
import { generateBookingPDF } from './BookingConfirmationPDF';
import BookingEditorForm from './BookingEditorForm';

// Simple wrapper to fix TypeScript icon issues
const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

const getRetreatDisplayCode = (retreat?: Retreat | any): string => {
  if (!retreat) return 'Unknown Retreat';
  return retreat.retreatCode || retreat.code || retreat.name || 'Unknown Retreat';
};

interface BookingWithDetails extends RetreatClient {
  clientName?: string;
  retreatName?: string;
  retreatCode?: string;
  retreatBackgroundColor?: string;
}

type BookingFormData = {
  clientId: string;
  retreatId: string;
  totalAmount: number;
  currency: 'EUR' | 'USD' | 'CZK' | 'PLN';
  status: 'pending' | 'conditional' | 'confirmed' | 'approved' | 'declined' | 'moved' | 'checked-in' | 'checked-out' | 'cancelled';
  bookingNumber: string;
};

type SortField = 'bookingNumber' | 'clientName' | 'retreatName' | 'bookingDate' | 'status';
type SortDirection = 'asc' | 'desc';

const BookingsGrid: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBooking, setEditingBooking] = useState<BookingWithDetails | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [formData, setFormData] = useState<BookingFormData>({
    clientId: '',
    retreatId: '',
    totalAmount: 0,
    currency: 'EUR' as 'EUR' | 'USD' | 'CZK' | 'PLN',
    status: 'pending',
    bookingNumber: ''
  });
  const [bookingNumberError, setBookingNumberError] = useState('');
  const [pdfLanguage, setPdfLanguage] = useState<'pl' | 'cz' | 'en'>('en');
  const [generatingPDF, setGeneratingPDF] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('bookingNumber');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const isMobileViewport = () => window.matchMedia('(max-width: 767px)').matches;
  const routePrefix = useMemo(() => {
    const firstSegment = location.pathname.split('/').filter(Boolean)[0];
    return ['admin', 'medical', 'staff', 'user'].includes(firstSegment) ? `/${firstSegment}` : '';
  }, [location.pathname]);

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
          retreatName: getRetreatDisplayCode(retreat || (typeof booking.retreatId === 'object' ? booking.retreatId : undefined)),
          retreatCode: getRetreatDisplayCode(retreat || (typeof booking.retreatId === 'object' ? booking.retreatId : undefined)),
          retreatBackgroundColor: retreat?.backgroundColor
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
      approved: 'bg-emerald-100 text-emerald-800',
      conditional: 'bg-amber-100 text-amber-800',
      pending: 'bg-yellow-100 text-yellow-800',
      declined: 'bg-orange-100 text-orange-800',
      moved: 'bg-purple-100 text-purple-800',
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

  const checkBookingNumberUniqueness = async (bookingNumber: string, currentBookingId?: string) => {
    if (!bookingNumber.trim()) {
      setBookingNumberError('');
      return true;
    }

    try {
      const existingBooking = bookings.find(booking =>
        booking.bookingNumber?.toString() === bookingNumber &&
        booking._id !== currentBookingId
      );

      if (existingBooking) {
        setBookingNumberError(`Booking number "${bookingNumber}" is already in use`);
        return false;
      } else {
        setBookingNumberError('');
        return true;
      }
    } catch (error) {
      console.error('Error checking booking number uniqueness:', error);
      setBookingNumberError('Error checking booking number');
      return false;
    }
  };

  const validateBookingNumber = async (bookingNumber: string, currentBookingId?: string): Promise<boolean> => {
    if (!bookingNumber || bookingNumber.trim() === '') {
      setBookingNumberError('');
      return true; // Allow empty booking numbers
    }

    const numericBookingNumber = parseInt(bookingNumber);
    if (isNaN(numericBookingNumber)) {
      setBookingNumberError('Booking number must be a valid number');
      return false;
    }

    // Check for duplicates in current bookings
    const isDuplicate = bookings.some(booking =>
      Number(booking.bookingNumber) === numericBookingNumber &&
      booking._id !== currentBookingId
    );

    if (isDuplicate) {
      setBookingNumberError(`Booking number ${numericBookingNumber} is already in use`);
      return false;
    }

    setBookingNumberError('');
    return true;
  };

  const handleBookingNumberChange = async (value: string, currentBookingId?: string) => {
    setFormData(prev => ({ ...prev, bookingNumber: value }));
    await validateBookingNumber(value, currentBookingId);
  };

  const formatDate = (date: string | Date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  };

  // Helper function to get contrast text color for background
  const getContrastColor = (hexColor: string): string => {
    if (!hexColor) return '#000000';
    // Remove # if present
    const hex = hexColor.replace('#', '');
    // Convert to RGB
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
  };

  // Sort function
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filter and sort bookings
  const filteredAndSortedBookings = useMemo(() => {
    let filtered = bookings;

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = bookings.filter(booking =>
        (booking.bookingNumber?.toString() || '').toLowerCase().includes(searchLower) ||
        (booking.clientName || '').toLowerCase().includes(searchLower) ||
        (booking.retreatName || '').toLowerCase().includes(searchLower) ||
        (booking.status || '').toLowerCase().includes(searchLower) ||
        (booking._id || '').toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let aValue, bValue;

      switch (sortField) {
        case 'bookingNumber':
          aValue = a.bookingNumber || 0;
          bValue = b.bookingNumber || 0;
          break;
        case 'clientName':
          aValue = a.clientName || '';
          bValue = b.clientName || '';
          break;
        case 'retreatName':
          aValue = a.retreatName || '';
          bValue = b.retreatName || '';
          break;
        case 'bookingDate':
          aValue = new Date(a.createdAt || (a as any).bookingDate || 0).getTime();
          bValue = new Date(b.createdAt || (b as any).bookingDate || 0).getTime();
          break;
        case 'status':
          aValue = a.status || '';
          bValue = b.status || '';
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [bookings, searchTerm, sortField, sortDirection]);

  // Memoize computed values to prevent unnecessary re-calculations
  const bookingStats = useMemo(() => ({
    total: filteredAndSortedBookings.length,
    confirmed: filteredAndSortedBookings.filter(b => b.status === 'confirmed').length,
    pending: filteredAndSortedBookings.filter(b => b.status === 'pending').length,
    checkedOut: filteredAndSortedBookings.filter(b => (b.status as string) === 'checked-out').length
  }), [filteredAndSortedBookings]);

  if (isLoading) {
    return <LoadingSpinner message="Loading bookings..." />;
  }

  const SortableHeader: React.FC<{ field: SortField; children: React.ReactNode }> = ({ field, children }) => (
    <th
      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center space-x-1">
        <span>{children}</span>
        {sortField === field && (
          <Icon
            icon={sortDirection === 'asc' ? FiChevronUp : FiChevronDown}
            className="w-4 h-4"
          />
        )}
      </div>
    </th>
  );

  return (
    <div className="p-6 h-full">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Bookings</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">PDF Language:</label>
            <select
              value={pdfLanguage}
              onChange={(e) => setPdfLanguage(e.target.value as 'pl' | 'cz' | 'en')}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="en">English</option>
              <option value="pl">Polish</option>
              <option value="cz">Czech</option>
            </select>
          </div>
          <AppleButton
            onClick={() => {
              if (isMobileViewport()) {
                navigate(`${routePrefix}/bookings/new`);
                return;
              }
              setShowAddModal(true);
            }}
            className="apple-button-primary"
          >
            <Icon icon={FiPlus} className="w-4 h-4 mr-2" />
            Add Booking
          </AppleButton>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Icon icon={FiSearch} className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by booking number, client name, retreat, or status..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <SortableHeader field="bookingNumber">Booking #</SortableHeader>
                <SortableHeader field="clientName">Client</SortableHeader>
                <SortableHeader field="retreatName">Retreat</SortableHeader>
                <SortableHeader field="bookingDate">Booking Date</SortableHeader>
                <SortableHeader field="status">Status</SortableHeader>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedBookings.map((booking) => (
                <tr key={booking._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => navigate(`${routePrefix}/bookings/${booking._id}`)}
                      className="booking-number-link !border-0 !bg-transparent !p-0 text-sm font-semibold text-gray-900 !shadow-none hover:!bg-transparent hover:text-gray-950 hover:underline"
                      title="View booking"
                    >
                      #{booking.bookingNumber || booking._id?.slice(-6)}
                    </button>
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
                      <span
                        className="text-sm px-3 py-1 rounded-full font-medium"
                        style={{
                          backgroundColor: booking.retreatBackgroundColor || 'transparent',
                          color: booking.retreatBackgroundColor ? getContrastColor(booking.retreatBackgroundColor) : '#111827'
                        }}
                      >
                        {booking.retreatCode || booking.retreatName}
                      </span>
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
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => navigate(`${routePrefix}/bookings/${booking._id}`)}
                        className="icon-action-btn icon-action-btn-view"
                        title="View Details"
                      >
                        <Icon icon={FiEye} />
                      </button>
                      <button
                        onClick={async () => {
                          setGeneratingPDF(booking._id!);
                          try {
                            await generateBookingPDF({
                              booking,
                              language: pdfLanguage,
                              onComplete: () => {
                                setGeneratingPDF(null);
                              }
                            });
                          } catch (error) {
                            console.error('Error generating PDF:', error);
                            alert('Error generating PDF');
                            setGeneratingPDF(null);
                          }
                        }}
                        className="icon-action-btn icon-action-btn-success"
                        title={generatingPDF === booking._id ? 'Generating...' : 'Generate PDF'}
                        disabled={generatingPDF === booking._id}
                      >
                        <Icon icon={FiFileText} className={generatingPDF === booking._id ? 'animate-pulse' : ''} />
                      </button>
                      <button
                        onClick={() => handleDelete(booking._id!)}
                        className="icon-action-btn icon-action-btn-danger"
                        title="Delete"
                      >
                        <Icon icon={FiTrash2} />
                      </button>
                      <button
                        onClick={() => {
                          if (isMobileViewport()) {
                            navigate(`${routePrefix}/bookings/${booking._id}/edit`);
                            return;
                          }
                          setEditingBooking(booking);
                          setFormData({
                            clientId: typeof booking.clientId === 'string' ? booking.clientId : (booking.clientId as any)?._id || '',
                            retreatId: typeof booking.retreatId === 'string' ? booking.retreatId : (booking.retreatId as any)?._id || '',
                            totalAmount: booking.totalAmount || 0,
                            currency: booking.currency || 'EUR',
                            status: (booking.status || 'pending') as typeof formData.status,
                            bookingNumber: booking.bookingNumber?.toString() || ''
                          });
                          setBookingNumberError('');
                          setShowEditModal(true);
                        }}
                        className="icon-action-btn icon-action-btn-edit"
                        title="Edit"
                      >
                        <Icon icon={FiEdit2} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredAndSortedBookings.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? `No bookings found matching "${searchTerm}"` : 'No bookings found'}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-gray-700">
          Showing {bookingStats.total} booking{bookingStats.total !== 1 ? 's' : ''}
          {searchTerm && <span> matching "{searchTerm}"</span>}
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
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-medium mb-4">Add New Booking</h2>
            <BookingEditorForm
              mode="create"
              onCancel={() => setShowAddModal(false)}
              onSaved={() => {
                fetchBookings();
                setShowAddModal(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Edit Booking Modal */}
      {showEditModal && editingBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-medium mb-4">Edit Booking</h2>
            <BookingEditorForm
              mode="edit"
              initialBooking={editingBooking}
              bookingId={editingBooking._id}
              onCancel={() => {
                setShowEditModal(false);
                setEditingBooking(null);
              }}
              onSaved={() => {
                fetchBookings();
                setShowEditModal(false);
                setEditingBooking(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingsGrid;
