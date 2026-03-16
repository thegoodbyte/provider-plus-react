import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams, ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { retreatsApi, bookingsApi, retreatExpensesApi, paymentsApi, clientsApi } from '../services/api';
import { Retreat, ExpenseSummary, PaymentSummary } from '../types';
import ExpensesTab from './ExpensesTab';
import PaymentsTab from './PaymentsTab';
import ClientDetailView from './ClientDetailView';
import CeremoniesGrid from './CeremoniesGrid';
import CeremonyAnalytics from './CeremonyAnalytics';
import { Modal, Form, Input, Select, Button, message, Collapse } from 'antd';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import './ClientsGrid.css';

const { Option } = Select;
const { TextArea } = Input;
const { Panel } = Collapse;

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

interface RetreatDetailViewProps {
  retreatId: string;
  onBack: () => void;
}

interface QuickBookingFormData {
  firstName: string;
  lastName: string;
  phoneCountryCode: string;
  phone: string;
  email: string;
  country: string;
  source: string;
  totalAmount: number;
  currency: string;
  notes: string;
}

interface RetreatClientData {
  _id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  registrationDate: string;
  checkInDate?: string;
  checkOutDate?: string;
  status: string;
  totalAmount: number;
  amountPaid: number;
  currency: string;
  roomAssignment?: string;
  specialRequests?: string;
  notes?: string;
}

const RetreatDetailView: React.FC<RetreatDetailViewProps> = ({ retreatId, onBack }) => {
  const [retreat, setRetreat] = useState<Retreat | null>(null);
  const [clients, setClients] = useState<RetreatClientData[]>([]);
  const [expensesSummary, setExpensesSummary] = useState<ExpenseSummary | null>(null);
  const [paymentsSummary, setPaymentsSummary] = useState<PaymentSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'clients' | 'expenses' | 'payments' | 'ceremonies' | 'analytics'>('clients');
  const [viewingClientId, setViewingClientId] = useState<string | null>(null);
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showQuickBookingModal, setShowQuickBookingModal] = useState(false);
  const [metricsCollapsed, setMetricsCollapsed] = useState(true);
  const [editFormData, setEditFormData] = useState({
    checkInDate: '',
    checkOutDate: '',
    status: 'pending',
    totalAmount: 0,
    amountPaid: 0,
    currency: 'EUR',
    roomAssignment: '',
    specialRequests: '',
    notes: ''
  });
  const gridApiRef = useRef<GridApi | null>(null);
  const [quickBookingForm] = Form.useForm();
  const [quickBookingLoading, setQuickBookingLoading] = useState(false);

  const StatusCellRenderer = (params: ICellRendererParams) => {
    const status = params.value?.toLowerCase() || 'pending';
    const statusClass = `status-${status}`;
    return `<span class="status-badge ${statusClass}">${params.value || 'Pending'}</span>`;
  };

  const AmountCellRenderer = (params: ICellRendererParams) => {
    const amount = params.value || 0;
    const currency = params.data.currency || 'EUR';
    return `${amount.toFixed(2)} ${currency}`;
  };

  const DateCellRenderer = (params: ICellRendererParams) => {
    if (!params.value) return '<span style="color: #999;">Not set</span>';
    return new Date(params.value).toLocaleDateString();
  };

  const ClientActionCellRenderer = (params: ICellRendererParams) => {
    return `
      <div class="booking-actions" style="display: flex; gap: 4px; justify-content: center; align-items: center;">
        <button class="view-client-btn" data-client-id="${params.data.clientId}" data-booking-id="${params.data._id}" data-action="view-client" style="
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: white;
          border: none;
          padding: 4px 6px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 10px;
          font-weight: 500;
        ">👁️</button>
        <button class="edit-booking-btn" data-booking-id="${params.data._id}" data-action="edit-booking" style="
          background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
          color: white;
          border: none;
          padding: 4px 6px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 10px;
          font-weight: 500;
        ">✏️</button>
        <button class="delete-booking-btn" data-booking-id="${params.data._id}" data-action="delete-booking" style="
          background: linear-gradient(135deg, #fd746c 0%, #ff9068 100%);
          color: white;
          border: none;
          padding: 4px 6px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 10px;
          font-weight: 500;
        ">🗑️</button>
      </div>
    `;
  };

  const columnDefs: ColDef[] = [
    {
      headerName: 'Booking #',
      field: 'bookingNumber',
      width: 110,
      pinned: 'left',
      cellStyle: { fontWeight: 'bold' }
    },
    {
      headerName: 'Client Name',
      field: 'clientName',
      width: 180,
      cellStyle: { fontWeight: 'bold' }
    },
    {
      headerName: 'Email',
      field: 'clientEmail',
      width: 200
    },
    {
      headerName: 'Phone',
      field: 'clientPhone',
      width: 140
    },
    {
      headerName: 'Registration Date',
      field: 'registrationDate',
      width: 150,
      cellRenderer: DateCellRenderer
    },
    {
      headerName: 'Status',
      field: 'status',
      width: 120,
      cellRenderer: StatusCellRenderer
    },
    {
      headerName: 'Total Amount',
      field: 'totalAmount',
      width: 130,
      cellRenderer: AmountCellRenderer
    },
    {
      headerName: 'Amount Paid',
      field: 'amountPaid',
      width: 130,
      cellRenderer: AmountCellRenderer
    },
    {
      headerName: 'Actions',
      field: 'actions',
      width: 120,
      cellRenderer: ClientActionCellRenderer,
      sortable: false,
      filter: false,
      pinned: 'right'
    }
  ];

  const defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
  };

  const fetchRetreatData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [retreatResponse, clientsResponse, expensesSummaryResponse, paymentsSummaryResponse] = await Promise.all([
        retreatsApi.getOne(retreatId),
        bookingsApi.getByRetreatWithDetails(retreatId),
        retreatExpensesApi.getRetreatSummary(retreatId),
        paymentsApi.getRetreatSummary(retreatId)
      ]);

      setRetreat(retreatResponse.data);
      setExpensesSummary(expensesSummaryResponse.data);
      setPaymentsSummary(paymentsSummaryResponse.data);

      // Transform booking data to client data format
      const transformedClients: RetreatClientData[] = clientsResponse.data.map((booking: any) => ({
        _id: booking._id,
        clientId: booking.clientId?._id || booking.clientId || '', // Store the actual client ID
        clientName: booking.clientId
          ? `${booking.clientId.firstName || booking.clientId.fname || ''} ${booking.clientId.lastName || booking.clientId.lname || ''}`.trim()
          : 'Unknown Client',
        clientEmail: booking.clientId?.email || '',
        clientPhone: booking.clientId?.phone || '',
        registrationDate: booking.registrationDate,
        checkInDate: booking.checkInDate,
        checkOutDate: booking.checkOutDate,
        status: booking.status || 'pending',
        totalAmount: booking.totalAmount || 0,
        amountPaid: booking.amountPaid || 0,
        currency: booking.currency || 'EUR',
        roomAssignment: booking.roomAssignment,
        specialRequests: booking.specialRequests,
        notes: booking.notes
      }));

      setClients(transformedClients);
    } catch (error) {
      console.error('Error fetching retreat data:', error);
      setRetreat(null);
      setClients([]);
      setExpensesSummary(null);
      setPaymentsSummary(null);
    } finally {
      setIsLoading(false);
    }
  }, [retreatId]);

  useEffect(() => {
    fetchRetreatData();
  }, [fetchRetreatData]);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    gridApiRef.current = params.api;
    params.api.sizeColumnsToFit();
  }, []);

  const handleDeleteBooking = useCallback(async (bookingId: string) => {
    if (window.confirm('Are you sure you want to delete this booking? This action cannot be undone.')) {
      try {
        await bookingsApi.delete(bookingId);
        await fetchRetreatData(); // Refresh the data
      } catch (error) {
        console.error('Error deleting booking:', error);
        alert('Error deleting booking. Please try again.');
      }
    }
  }, [fetchRetreatData]);

  const onCellClicked = useCallback((event: any) => {
    const target = event.event?.target;
    const action = target?.dataset?.action;

    if (action === 'view-client') {
      const clientId = target.dataset.clientId;
      if (clientId) {
        setViewingClientId(clientId);
      }
    } else if (action === 'edit-booking') {
      const bookingId = target.dataset.bookingId;
      if (bookingId) {
        // Find the booking data to populate the form
        const bookingData = clients.find(client => client._id === bookingId);
        if (bookingData) {
          setEditFormData({
            checkInDate: bookingData.checkInDate ? new Date(bookingData.checkInDate).toISOString().split('T')[0] : '',
            checkOutDate: bookingData.checkOutDate ? new Date(bookingData.checkOutDate).toISOString().split('T')[0] : '',
            status: bookingData.status || 'pending',
            totalAmount: bookingData.totalAmount || 0,
            amountPaid: bookingData.amountPaid || 0,
            currency: bookingData.currency || 'EUR',
            roomAssignment: bookingData.roomAssignment || '',
            specialRequests: bookingData.specialRequests || '',
            notes: bookingData.notes || ''
          });
        }
        setEditingBookingId(bookingId);
        setShowEditModal(true);
      }
    } else if (action === 'delete-booking') {
      const bookingId = target.dataset.bookingId;
      if (bookingId) {
        handleDeleteBooking(bookingId);
      }
    }
  }, [handleDeleteBooking, clients]);

  const handleEditSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBookingId) return;

    try {
      const updateData = {
        ...editFormData,
        checkInDate: editFormData.checkInDate ? editFormData.checkInDate : undefined,
        checkOutDate: editFormData.checkOutDate ? editFormData.checkOutDate : undefined,
        status: editFormData.status as "pending" | "confirmed" | "checked-in" | "checked-out" | "cancelled",
        currency: editFormData.currency as 'EUR' | 'USD' | 'CZK' | 'PLN' | undefined,
        totalAmount: Number(editFormData.totalAmount),
        amountPaid: Number(editFormData.amountPaid)
      };

      await bookingsApi.update(editingBookingId, updateData);
      setShowEditModal(false);
      setEditingBookingId(null);
      await fetchRetreatData(); // Refresh the data
    } catch (error) {
      console.error('Error updating booking:', error);
      alert('Error updating booking. Please try again.');
    }
  }, [editingBookingId, editFormData, fetchRetreatData]);

  const handleExport = useCallback(() => {
    if (gridApiRef.current) {
      const fileName = `retreat-${retreat?.name || 'unknown'}-clients-${new Date().toISOString().split('T')[0]}.csv`;
      gridApiRef.current.exportDataAsCsv({
        fileName: fileName
      });
    }
  }, [retreat]);

  const handleQuickBooking = async (values: QuickBookingFormData) => {
    try {
      setQuickBookingLoading(true);

      // First, create the client
      const clientData = {
        firstName: values.firstName,
        lastName: values.lastName,
        phoneCountryCode: values.phoneCountryCode,
        phone: values.phone,
        email: values.email,
        country: values.country,
        source: values.source,
        notes: values.notes,
        address: 'TBD',
        workflowStatus: 'booked'
      };

      const clientResponse = await clientsApi.create(clientData);
      const clientId = clientResponse.data._id;

      // Then create the booking
      const bookingData = {
        clientId: clientId!,
        retreatId: retreatId,
        totalAmount: values.totalAmount,
        currency: values.currency as 'EUR' | 'USD' | 'CZK' | 'PLN',
        status: 'confirmed' as const,
        registrationDate: new Date().toISOString(),
        amountPaid: 0,
        checkInDate: retreat?.startDate || new Date().toISOString(),
        checkOutDate: retreat?.endDate || new Date().toISOString()
      };

      await bookingsApi.create(bookingData);

      message.success(`${values.firstName} ${values.lastName} has been booked for this retreat!`);
      quickBookingForm.resetFields();
      setShowQuickBookingModal(false);
      await fetchRetreatData(); // Refresh the data
    } catch (error: any) {
      console.error('Error creating quick booking:', error);
      message.error(error.response?.data?.message || 'Failed to create booking');
    } finally {
      setQuickBookingLoading(false);
    }
  };

  const countryCodeOptions = [
    { label: 'United States (+1)', value: '+1' },
    { label: 'Canada (+1)', value: '+1' },
    { label: 'United Kingdom (+44)', value: '+44' },
    { label: 'Germany (+49)', value: '+49' },
    { label: 'France (+33)', value: '+33' },
    { label: 'Spain (+34)', value: '+34' },
    { label: 'Italy (+39)', value: '+39' },
    { label: 'Poland (+48)', value: '+48' },
    { label: 'Czech Republic (+420)', value: '+420' },
    { label: 'Netherlands (+31)', value: '+31' },
    { label: 'Belgium (+32)', value: '+32' },
    { label: 'Switzerland (+41)', value: '+41' },
    { label: 'Austria (+43)', value: '+43' }
  ];

  const countryOptions = [
    'USA', 'Canada', 'UK', 'Germany', 'France', 'Spain', 'Italy',
    'Poland', 'Czech Republic', 'Netherlands', 'Belgium', 'Switzerland', 'Austria', 'Other'
  ];

  const sourceOptions = [
    'Website', 'Referral', 'Social Media', 'Google Search',
    'Friend', 'Previous Client', 'Other'
  ];

  const currencyOptions = [
    { label: 'EUR (Euro)', value: 'EUR' },
    { label: 'USD (Dollar)', value: 'USD' },
    { label: 'CZK (Czech Crown)', value: 'CZK' },
    { label: 'PLN (Polish Złoty)', value: 'PLN' }
  ];

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">🏃‍♂️</div>
        <p>Loading retreat details...</p>
      </div>
    );
  }

  if (!retreat) {
    return (
      <div className="error-container">
        <h2>❌ Retreat Not Found</h2>
        <p>The retreat with ID "{retreatId}" could not be found or there was an error loading the data.</p>
        <p>Please try again or contact support if the issue persists.</p>
        <button onClick={onBack} className="back-btn">← Back to Retreats</button>
      </div>
    );
  }

  const totalRevenue = paymentsSummary?.completedPaymentsEUR || 0;
  const totalExpected = clients.reduce((sum, client) => sum + (client.totalAmount || 0), 0);
  const totalExpenses = expensesSummary?.totalExpenses || 0;
  // Convert expenses from CZK to EUR for consistency (simple conversion rate)
  const totalExpensesEUR = totalExpenses / 25; // Approximate CZK to EUR conversion
  const profit = totalRevenue - totalExpensesEUR;
  const occupancyRate = retreat.capacity ? Math.round((clients.length / retreat.capacity) * 100) : 0;

  // If viewing a specific client, show the client detail view
  if (viewingClientId) {
    return (
      <ClientDetailView
        clientId={viewingClientId}
        onBack={() => setViewingClientId(null)}
      />
    );
  }

  return (
    <div className="retreat-detail-container">
      <div className="retreat-detail-header">
        <button onClick={onBack} className="back-btn">← Back to Retreats</button>
        <div className="retreat-info">
          <h1>{retreat.name}</h1>
          <div className="retreat-meta">
            <div className="meta-item">
              <strong>Location:</strong> {retreat.location}
            </div>
            <div className="meta-item">
              <strong>Dates:</strong> {new Date(retreat.startDate!).toLocaleDateString()} - {new Date(retreat.endDate!).toLocaleDateString()}
            </div>
            <div className="meta-item">
              <strong>Capacity:</strong> {retreat.capacity || 'N/A'}
            </div>
            <div className="meta-item">
              <strong>Status:</strong> <span className={`status-badge status-${retreat.status}`}>{retreat.status}</span>
            </div>
            {retreat.description && (
              <div className="meta-item">
                <strong>Description:</strong> {retreat.description}
              </div>
            )}
          </div>
        </div>
      </div>

      <Collapse
        activeKey={metricsCollapsed ? [] : ['metrics']}
        onChange={(keys) => setMetricsCollapsed(!keys.includes('metrics'))}
        style={{ marginBottom: '20px' }}
      >
        <Panel header="📊 Financial Metrics" key="metrics">
          <div className="retreat-stats">
            <div className="stat-card">
              <div className="stat-number">{clients.length}</div>
              <div className="stat-label">Total Clients</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{occupancyRate}%</div>
              <div className="stat-label">Occupancy Rate</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{totalRevenue.toFixed(2)} EUR</div>
              <div className="stat-label">Revenue Collected</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{totalExpected.toFixed(2)} EUR</div>
              <div className="stat-label">Expected Revenue</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{clients.filter(c => c.status === 'confirmed').length}</div>
              <div className="stat-label">Confirmed</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{clients.filter(c => c.status === 'checked-in').length}</div>
              <div className="stat-label">Checked In</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{totalExpensesEUR.toFixed(2)} EUR</div>
              <div className="stat-label">Total Expenses</div>
            </div>
            <div className="stat-card">
              <div className={`stat-number ${profit >= 0 ? 'profit-positive' : 'profit-negative'}`}>
                {profit.toFixed(2)} EUR
              </div>
              <div className="stat-label">Profit</div>
            </div>
          </div>
        </Panel>
      </Collapse>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-btn ${activeTab === 'clients' ? 'active' : ''}`}
          onClick={() => setActiveTab('clients')}
        >
          📋 Clients ({clients.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'expenses' ? 'active' : ''}`}
          onClick={() => setActiveTab('expenses')}
        >
          💰 Expenses
        </button>
        <button
          className={`tab-btn ${activeTab === 'payments' ? 'active' : ''}`}
          onClick={() => setActiveTab('payments')}
        >
          💳 Payments
        </button>
        <button
          className={`tab-btn ${activeTab === 'ceremonies' ? 'active' : ''}`}
          onClick={() => setActiveTab('ceremonies')}
        >
          🔮 Ceremonies
        </button>
        <button
          className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          📊 Analytics
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'clients' && (
        <div className="clients-section">
          <div className="section-header">
            <h2>📋 Retreat Clients ({clients.length})</h2>
            <div className="section-actions">
              <button
                onClick={() => setShowQuickBookingModal(true)}
                className="add-booking-btn"
                style={{
                  background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  marginRight: '8px',
                  fontWeight: '500'
                }}
              >
                ➕ Quick Book Client
              </button>
              <button onClick={handleExport} className="export-btn">
                📊 Export CSV
              </button>
              <button onClick={fetchRetreatData} className="refresh-btn">
                🔄 Refresh
              </button>
            </div>
          </div>

          <div className="ag-theme-alpine" style={{ height: 500, width: '100%' }}>
            <AgGridReact
              rowData={clients}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              onGridReady={onGridReady}
              onCellClicked={onCellClicked}
              rowSelection="multiple"
              suppressRowClickSelection={true}
              pagination={true}
              paginationPageSize={20}
              enableBrowserTooltips={true}
              headerHeight={40}
              rowHeight={45}
            />
          </div>
        </div>
      )}

      {activeTab === 'expenses' && (
        <div className="expenses-section">
          <ExpensesTab retreatId={retreatId} />
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="payments-section">
          <PaymentsTab retreatId={retreatId} />
        </div>
      )}

      {activeTab === 'ceremonies' && (
        <div className="ceremonies-section">
          <CeremoniesGrid retreatId={retreatId} />
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="analytics-section">
          <CeremonyAnalytics retreatId={retreatId} />
        </div>
      )}

      {/* Edit Booking Modal */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal large-modal" onClick={(e) => e.stopPropagation()}>
            <h3>✏️ Edit Booking</h3>
            <form onSubmit={handleEditSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="edit-checkin">Check-in Date:</label>
                  <input
                    type="date"
                    id="edit-checkin"
                    value={editFormData.checkInDate}
                    onChange={(e) => setEditFormData({...editFormData, checkInDate: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="edit-checkout">Check-out Date:</label>
                  <input
                    type="date"
                    id="edit-checkout"
                    value={editFormData.checkOutDate}
                    onChange={(e) => setEditFormData({...editFormData, checkOutDate: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="edit-status">Status:</label>
                  <select
                    id="edit-status"
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({...editFormData, status: e.target.value})}
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="checked-in">Checked In</option>
                    <option value="checked-out">Checked Out</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="edit-total">Total Amount:</label>
                  <input
                    type="number"
                    id="edit-total"
                    value={editFormData.totalAmount}
                    onChange={(e) => setEditFormData({...editFormData, totalAmount: Number(e.target.value)})}
                    min="0"
                    step="0.01"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="edit-paid">Amount Paid:</label>
                  <input
                    type="number"
                    id="edit-paid"
                    value={editFormData.amountPaid}
                    onChange={(e) => setEditFormData({...editFormData, amountPaid: Number(e.target.value)})}
                    min="0"
                    step="0.01"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="edit-currency">Currency:</label>
                  <select
                    id="edit-currency"
                    value={editFormData.currency}
                    onChange={(e) => setEditFormData({...editFormData, currency: e.target.value})}
                  >
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="CZK">CZK</option>
                    <option value="PLN">PLN</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="edit-room">Room Assignment:</label>
                  <input
                    type="text"
                    id="edit-room"
                    value={editFormData.roomAssignment}
                    onChange={(e) => setEditFormData({...editFormData, roomAssignment: e.target.value})}
                    placeholder="e.g., Room 101, Cabin A"
                  />
                </div>

                <div className="form-group full-width">
                  <label htmlFor="edit-requests">Special Requests:</label>
                  <textarea
                    id="edit-requests"
                    value={editFormData.specialRequests}
                    onChange={(e) => setEditFormData({...editFormData, specialRequests: e.target.value})}
                    rows={3}
                    placeholder="Dietary restrictions, accessibility needs, etc."
                  />
                </div>

                <div className="form-group full-width">
                  <label htmlFor="edit-notes">Notes:</label>
                  <textarea
                    id="edit-notes"
                    value={editFormData.notes}
                    onChange={(e) => setEditFormData({...editFormData, notes: e.target.value})}
                    rows={3}
                    placeholder="Additional notes about this booking"
                  />
                </div>
              </div>

              <div className="form-buttons">
                <button type="submit" className="save-btn">Update Booking</button>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="cancel-btn"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Booking Modal */}
      <Modal
        title="📅 Quick Book Client for Retreat"
        open={showQuickBookingModal}
        onCancel={() => {
          setShowQuickBookingModal(false);
          quickBookingForm.resetFields();
        }}
        footer={null}
        width={700}
      >
        <Form
          form={quickBookingForm}
          layout="vertical"
          onFinish={handleQuickBooking}
          autoComplete="off"
          initialValues={{
            phoneCountryCode: '+1',
            country: 'USA',
            currency: 'EUR',
            totalAmount: 3000
          }}
        >
          <div style={{ display: 'flex', gap: '16px' }}>
            <Form.Item
              name="firstName"
              label="First Name"
              rules={[{ required: true, message: 'Please enter first name' }]}
              style={{ flex: 1 }}
            >
              <Input placeholder="John" />
            </Form.Item>

            <Form.Item
              name="lastName"
              label="Last Name"
              rules={[{ required: true, message: 'Please enter last name' }]}
              style={{ flex: 1 }}
            >
              <Input placeholder="Doe" />
            </Form.Item>
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <Form.Item
              name="phoneCountryCode"
              label="Country Code"
              style={{ flex: 0.3 }}
            >
              <Select placeholder="Code">
                {countryCodeOptions.map(option => (
                  <Option key={option.value} value={option.value}>{option.label}</Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="phone"
              label="Phone Number"
              rules={[{ required: true, message: 'Please enter phone number' }]}
              style={{ flex: 0.7 }}
            >
              <Input placeholder="234 567 8900" />
            </Form.Item>
          </div>

          <Form.Item
            name="email"
            label="Email"
            rules={[{ required: true, type: 'email', message: 'Please enter valid email' }]}
          >
            <Input placeholder="john.doe@example.com" />
          </Form.Item>

          <div style={{ display: 'flex', gap: '16px' }}>
            <Form.Item
              name="country"
              label="Country"
              rules={[{ required: true, message: 'Please select country' }]}
              style={{ flex: 1 }}
            >
              <Select placeholder="Select country">
                {countryOptions.map(country => (
                  <Option key={country} value={country}>{country}</Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="source"
              label="Source"
              style={{ flex: 1 }}
            >
              <Select placeholder="How did they find you?">
                {sourceOptions.map(source => (
                  <Option key={source} value={source}>{source}</Option>
                ))}
              </Select>
            </Form.Item>
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <Form.Item
              name="totalAmount"
              label="Total Amount"
              rules={[{ required: true, message: 'Please enter total amount' }]}
              style={{ flex: 1 }}
            >
              <Input type="number" placeholder="3000" min="0" step="50" />
            </Form.Item>

            <Form.Item
              name="currency"
              label="Currency"
              rules={[{ required: true, message: 'Please select currency' }]}
              style={{ flex: 1 }}
            >
              <Select placeholder="Select currency">
                {currencyOptions.map(option => (
                  <Option key={option.value} value={option.value}>{option.label}</Option>
                ))}
              </Select>
            </Form.Item>
          </div>

          <Form.Item
            name="notes"
            label="Initial Notes"
          >
            <TextArea
              rows={3}
              placeholder="Any notes about this booking..."
            />
          </Form.Item>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '20px',
            padding: '16px',
            background: '#f8f9fa',
            borderRadius: '6px'
          }}>
            <div>
              <strong>Status:</strong> <span style={{ color: '#28a745', fontWeight: '500' }}>BOOKED & CONFIRMED</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button onClick={() => {
                setShowQuickBookingModal(false);
                quickBookingForm.resetFields();
              }}>
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={quickBookingLoading}
                style={{ background: '#28a745', borderColor: '#28a745' }}
              >
                Book Client
              </Button>
            </div>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default RetreatDetailView;