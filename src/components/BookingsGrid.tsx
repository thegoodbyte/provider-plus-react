import React, { useState, useEffect, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridReadyEvent } from 'ag-grid-community';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { RetreatClient, Client, Retreat } from '../types';
import { bookingsApi, clientsApi, retreatsApi } from '../services/api';
import BookingDetailView from './BookingDetailView';
import { formatBookingHashForDisplay } from '../utils/hashGenerator';
import './ClientsGrid.css';

ModuleRegistry.registerModules([AllCommunityModule]);

// Actions cell renderer component
const ActionsCellRenderer = (props: any) => {
  const { data, context } = props;

  return (
    <div className="action-buttons">
      <button
        className="view-btn"
        onClick={() => context.componentParent.handleView(data._id)}
      >
        View
      </button>
      <button
        className="edit-btn"
        onClick={() => context.componentParent.handleEdit(data._id)}
      >
        Edit
      </button>
      {!data.bookingHash && (
        <button
          className="generate-hash-btn"
          onClick={() => context.componentParent.handleGenerateHash(data._id)}
          title="Generate Booking Hash"
        >
          🔑
        </button>
      )}
      <button
        className="delete-btn"
        onClick={() => context.componentParent.handleDelete(data._id)}
      >
        Delete
      </button>
    </div>
  );
};

interface BookingWithDetails extends RetreatClient {
  clientDetails?: Client;
  retreatDetails?: Retreat;
}

const BookingsGrid: React.FC = () => {
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<BookingWithDetails | null>(null);
  const [formData, setFormData] = useState<Partial<RetreatClient>>({});
  const [viewingBookingId, setViewingBookingId] = useState<string | null>(null);
  const gridApiRef = useRef<any>(null);

  const columnDefs: ColDef[] = [
    {
      headerName: 'Booking #',
      field: 'bookingNumber',
      sortable: true,
      filter: true,
      width: 120
    },
    {
      headerName: 'Booking Hash',
      field: 'bookingHash',
      valueFormatter: (params) => {
        return params.value ? formatBookingHashForDisplay(params.value) : 'Not Generated';
      },
      sortable: true,
      filter: true,
      width: 160
    },
    {
      headerName: 'Client',
      valueGetter: (params) => {
        // Check both clientDetails (legacy) and clientId (populated by Mongoose)
        const client = params.data.clientDetails || params.data.clientId;
        if (client) {
          const firstName = client.firstName || client.fname;
          const lastName = client.lastName || client.lname;
          return `${firstName || ''} ${lastName || ''}`.trim();
        }
        return 'Unknown Client';
      },
      sortable: true,
      filter: true,
      flex: 1
    },
    // {
    //   headerName: 'Email',
    //   valueGetter: (params) => {
    //     const client = params.data.clientDetails || params.data.clientId;
    //     return client?.email || '';
    //   },
    //   sortable: true,
    //   filter: true,
    //   flex: 1
    // },
    {
      headerName: 'Retreat',
      valueGetter: (params) => {
        // Check both retreatDetails (legacy) and retreatId (populated by Mongoose)
        const retreat = params.data.retreatDetails || params.data.retreatId;
        if (retreat) {
          const type = retreat.type ? ` (${retreat.type.charAt(0).toUpperCase() + retreat.type.slice(1)})` : '';
          return `${retreat.name}${type}`;
        }
        return 'Unknown Retreat';
      },
      sortable: true,
      filter: true,
      flex: 1.5
    },
    // {
    //   headerName: 'Booking Type',
    //   field: 'bookingType',
    //   valueFormatter: (params) => {
    //     if (params.value === 'booster') return 'Booster';
    //     return 'Full Retreat';
    //   },
    //   cellStyle: (params) => {
    //     if (params.value === 'booster') {
    //       return { backgroundColor: '#e3f2fd', fontWeight: 'bold' };
    //     }
    //     return { backgroundColor: '#f3e5f5', fontWeight: 'bold' };
    //   },
    //   sortable: true,
    //   filter: true,
    //   width: 120
    // },
    {
      headerName: 'Retreat Type',
      valueGetter: (params) => {
        const retreat = params.data.retreatDetails || params.data.retreatId;
        return retreat?.type ? retreat.type.charAt(0).toUpperCase() + retreat.type.slice(1) : 'Regular';
      },
      sortable: true,
      filter: true,
      width: 120
    },
    {
      headerName: 'Retreat Dates',
      valueGetter: (params) => {
        const retreat = params.data.retreatDetails || params.data.retreatId;
        if (retreat && retreat.startDate) {
          const startDate = new Date(retreat.startDate).toLocaleDateString();
          const endDate = retreat.endDate ? ` - ${new Date(retreat.endDate).toLocaleDateString()}` : '';
          return `${startDate}${endDate}`;
        }
        return '';
      },
      sortable: true,
      filter: true,
      flex: 1
    },
    // {
    //   headerName: 'Location',
    //   valueGetter: (params) => {
    //     const retreat = params.data.retreatDetails || params.data.retreatId;
    //     return retreat?.location || '';
    //   },
    //   sortable: true,
    //   filter: true,
    //   flex: 1
    // },
    // {
    //   headerName: 'Registration Date',
    //   field: 'registrationDate',
    //   valueFormatter: (params) => params.value ? new Date(params.value).toLocaleDateString() : '',
    //   sortable: true,
    //   filter: true,
    //   flex: 1
    // },
    // {
    //   headerName: 'Status',
    //   field: 'status',
    //   cellRenderer: (params: any) => {
    //     const status = params.value || 'pending';
    //     const statusClass = `status-${status}`;
    //     return `<span class="status-badge ${statusClass}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>`;
    //   },
    //   sortable: true,
    //   filter: true,
    //   flex: 1
    // },
    {
      headerName: 'Total Amount',
      valueGetter: (params) => {
        const amount = params.data.totalAmount || 0;
        const currency = params.data.currency || 'EUR';
        return `${amount.toFixed(2)} ${currency}`;
      },
      sortable: true,
      filter: true,
      flex: 1
    },
    {
      headerName: 'Amount Paid',
      valueGetter: (params) => {
        const amount = params.data.amountPaid || 0;
        const currency = params.data.currency || 'EUR';
        return `${amount.toFixed(2)} ${currency}`;
      },
      sortable: true,
      filter: true,
      flex: 1
    },
    {
      headerName: 'Actions',
      cellRenderer: 'actionsCellRenderer',
      sortable: false,
      filter: false,
      width: 180
    }
  ];

  const defaultColDef = {
    resizable: true,
    sortable: true,
    filter: true,
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setIsLoading(true);

      // Fetch all data in parallel for maximum speed
      const [bookingsResponse, clientsResponse, retreatsResponse] = await Promise.all([
        bookingsApi.getAll(),
        clientsApi.getAll(),
        retreatsApi.getAll()
      ]);

      const bookingsData = bookingsResponse.data;
      const clientsData = clientsResponse.data;
      const retreatsData = retreatsResponse.data;

      // Set clients and retreats for dropdowns
      setClients(clientsData);
      setRetreats(retreatsData);

      // Create lookup maps for O(1) access instead of making API calls
      const clientsMap = new Map<string, Client>(clientsData.filter((client: Client) => client._id).map((client: Client) => [client._id!, client]));
      const retreatsMap = new Map<string, Retreat>(retreatsData.filter((retreat: Retreat) => retreat._id).map((retreat: Retreat) => [retreat._id!, retreat]));

      // Enhance bookings with cached data - no additional API calls needed!
      const enhancedBookings = bookingsData.map((booking: RetreatClient) => ({
        ...booking,
        clientDetails: clientsMap.get(booking.clientId),
        retreatDetails: retreatsMap.get(booking.retreatId)
      }));

      setBookings(enhancedBookings);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Keep these for backwards compatibility but they're not used in initial load
  const fetchBookings = async () => {
    await fetchAllData();
  };

  const fetchClients = async () => {
    try {
      const response = await clientsApi.getAll();
      setClients(response.data);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const fetchRetreats = async () => {
    try {
      const response = await retreatsApi.getAll();
      setRetreats(response.data);
    } catch (error) {
      console.error('Error fetching retreats:', error);
    }
  };

  const handleGridReady = (params: GridReadyEvent) => {
    gridApiRef.current = params.api;
    params.api.sizeColumnsToFit();
  };

  const handleAdd = () => {
    setEditingBooking(null);
    setFormData({
      status: 'pending',
      registrationDate: new Date().toISOString(),
      totalAmount: 0,
      amountPaid: 0
    });
    setIsModalOpen(true);
  };

  const handleView = (id: string) => {
    setViewingBookingId(id);
  };

  const handleBackFromDetail = () => {
    setViewingBookingId(null);
  };

  const handleEdit = (id: string) => {
    const booking = bookings.find(b => b._id === id);
    if (booking) {
      setEditingBooking(booking);
      setFormData(booking);
      setIsModalOpen(true);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this booking?')) {
      try {
        await bookingsApi.delete(id);
        fetchAllData(); // Use the optimized fetch
      } catch (error: any) {
        console.error('Error deleting booking:', error);
      }
    }
  };

  const handleGenerateHash = async (id: string) => {
    if (window.confirm('Generate a unique booking hash for this booking? This will enable payment linking.')) {
      try {
        await bookingsApi.regenerateBookingHash(id);
        fetchAllData(); // Use the optimized fetch
      } catch (error: any) {
        console.error('Error generating booking hash:', error);
        alert('Error generating booking hash: ' + (error.response?.data?.message || error.message));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const cleanData: any = {};

      // Include booking number if provided
      if (formData.bookingNumber) cleanData.bookingNumber = formData.bookingNumber;
      if (formData.clientId) cleanData.clientId = formData.clientId;
      if (formData.retreatId) cleanData.retreatId = formData.retreatId;
      if (formData.bookingType) cleanData.bookingType = formData.bookingType || 'full_retreat';
      if (formData.registrationDate) cleanData.registrationDate = formData.registrationDate;
      if (formData.totalAmount !== undefined) cleanData.totalAmount = Number(formData.totalAmount);
      if (formData.currency) cleanData.currency = formData.currency || 'EUR';
      if (formData.amountPaid !== undefined) cleanData.amountPaid = Number(formData.amountPaid);
      if (formData.status) cleanData.status = formData.status;
      if (formData.specialRequests) cleanData.specialRequests = formData.specialRequests;
      if (formData.notes) cleanData.notes = formData.notes;

      if (editingBooking) {
        await bookingsApi.update(editingBooking._id!, cleanData);
      } else {
        await bookingsApi.create(cleanData);
      }

      setIsModalOpen(false);
      setFormData({});
      setEditingBooking(null);
      fetchAllData(); // Use the optimized fetch
    } catch (error: any) {
      console.error('Error saving booking:', error);
      alert('Error saving booking: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: ['totalAmount', 'amountPaid'].includes(name) ? parseFloat(value) || 0 : value
    }));
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    applyFilters(e.target.value, statusFilter, typeFilter);
  };

  const handleStatusFilter = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
    applyFilters(searchTerm, e.target.value, typeFilter);
  };

  const handleRetreatTypeFilter = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTypeFilter(e.target.value);
    applyFilters(searchTerm, statusFilter, e.target.value);
  };

  const applyFilters = (search: string, status: string, type: string) => {
    if (gridApiRef.current) {
      gridApiRef.current.setFilterModel({
        status: status ? { type: 'equals', filter: status } : null,
        'retreatDetails.type': type ? { type: 'equals', filter: type } : null
      });
      gridApiRef.current.setQuickFilter(search);
    }
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">📅</div>
        <p>Loading bookings...</p>
      </div>
    );
  }

  // If viewing a booking's detail, show the detail view
  if (viewingBookingId) {
    return <BookingDetailView bookingId={viewingBookingId} onBack={handleBackFromDetail} />;
  }

  return (
    <div className="clients-container">
      <div className="clients-header">
        <h2>📅 Retreat Bookings</h2>
        <div className="header-actions">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search clients, retreats, or locations..."
              value={searchTerm}
              onChange={handleSearch}
              className="search-input"
            />
          </div>
          <select
            className="filter-select"
            onChange={handleStatusFilter}
            style={{ marginRight: '10px' }}
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="checked-in">Checked In</option>
            <option value="checked-out">Checked Out</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            className="filter-select"
            onChange={handleRetreatTypeFilter}
            style={{ marginRight: '10px' }}
          >
            <option value="">All Types</option>
            <option value="regular">Regular</option>
            <option value="booster">Booster</option>
          </select>
          <button onClick={handleAdd} className="add-btn">📅 Book Client to Retreat</button>
          <div className="status-info">
            {bookings.length} booking{bookings.length !== 1 ? 's' : ''} found
          </div>
        </div>
      </div>

      <div className="ag-theme-alpine" style={{ height: 600, width: '100%' }}>
        <AgGridReact
          rowData={bookings}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          onGridReady={handleGridReady}
          animateRows={true}
          pagination={true}
          paginationPageSize={20}
          suppressNoRowsOverlay={false}
          components={{
            actionsCellRenderer: ActionsCellRenderer
          }}
          context={{
            componentParent: {
              handleView,
              handleEdit,
              handleDelete,
              handleGenerateHash
            }
          }}
        />
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal large-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingBooking ? 'Edit Booking' : 'Add New Booking'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-section">
                  <h4>Booking Details</h4>

                  <div className="form-group">
                    <label htmlFor="bookingNumber">Booking Number (optional - auto-generated if empty):</label>
                    <input
                      type="text"
                      id="bookingNumber"
                      name="bookingNumber"
                      value={formData.bookingNumber || ''}
                      onChange={handleInputChange}
                      placeholder="Auto-generated (e.g., BK000001)"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="clientId">Client:</label>
                    <select
                      id="clientId"
                      name="clientId"
                      value={formData.clientId || ''}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="">Select a client...</option>
                      {clients.map(client => (
                        <option key={client._id} value={client._id}>
                          {(client.firstName || client.fname)} {(client.lastName || client.lname)} {client.email ? `(${client.email})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="retreatId">Retreat:</label>
                    <select
                      id="retreatId"
                      name="retreatId"
                      value={formData.retreatId || ''}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="">Select a retreat...</option>
                      {retreats.map(retreat => (
                        <option key={retreat._id} value={retreat._id}>
                          {retreat.name} - {retreat.location}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="registrationDate">Registration Date:</label>
                    <input
                      type="datetime-local"
                      id="registrationDate"
                      name="registrationDate"
                      value={formData.registrationDate ? new Date(formData.registrationDate).toISOString().slice(0, 16) : ''}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="bookingType">Booking Type:</label>
                    <select
                      id="bookingType"
                      name="bookingType"
                      value={formData.bookingType || 'full_retreat'}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="full_retreat">Full Retreat</option>
                      <option value="booster">Booster</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="status">Status:</label>
                    <select
                      id="status"
                      name="status"
                      value={formData.status || 'pending'}
                      onChange={handleInputChange}
                    >
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="checked-in">Checked In</option>
                      <option value="checked-out">Checked Out</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div className="form-section">
                  <h4>Financial Information</h4>

                  <div className="form-group">
                    <label htmlFor="currency">Currency:</label>
                    <select
                      id="currency"
                      name="currency"
                      value={formData.currency || 'EUR'}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="EUR">EUR (Euro)</option>
                      <option value="USD">USD (US Dollar)</option>
                      <option value="CZK">CZK (Czech Koruna)</option>
                      <option value="PLN">PLN (Polish Złoty)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="totalAmount">Total Amount:</label>
                    <input
                      type="number"
                      id="totalAmount"
                      name="totalAmount"
                      value={formData.totalAmount || ''}
                      onChange={handleInputChange}
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="amountPaid">Amount Paid:</label>
                    <input
                      type="number"
                      id="amountPaid"
                      name="amountPaid"
                      value={formData.amountPaid || ''}
                      onChange={handleInputChange}
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>

                <div className="form-section">
                  <h4>Additional Information</h4>


                  <div className="form-group">
                    <label htmlFor="specialRequests">Special Requests:</label>
                    <textarea
                      id="specialRequests"
                      name="specialRequests"
                      value={formData.specialRequests || ''}
                      onChange={handleInputChange}
                      placeholder="Any special dietary or accommodation requests..."
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="notes">Notes:</label>
                    <textarea
                      id="notes"
                      name="notes"
                      value={formData.notes || ''}
                      onChange={handleInputChange}
                      placeholder="Any additional notes about this booking..."
                    />
                  </div>
                </div>
              </div>

              <div className="form-buttons">
                <button type="submit" className="save-btn">
                  {editingBooking ? 'Update Booking' : 'Create Booking'}
                </button>
                <button type="button" onClick={() => setIsModalOpen(false)} className="cancel-btn">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingsGrid;