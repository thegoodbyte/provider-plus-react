import React, { useState, useEffect, useCallback } from 'react';
import { retreatsApi, bookingsApi, retreatExpensesApi, paymentsApi, clientsApi, housesApi } from '../services/api';
import { Retreat, ExpenseSummary, House, Payment } from '../types';
import ExpensesTab from './ExpensesTab';
import PaymentsTab from './PaymentsTab';
import ClientDetailView from './ClientDetailView';
import CeremoniesGrid from './CeremoniesGrid';
import CeremonyAnalytics from './CeremonyAnalytics';
import SearchableClientSelector from './SearchableClientSelector';
import RetreatTrackingGrid from './RetreatTrackingGrid';
import BookingStepsMatrix from './BookingStepsMatrix';
import { TasksWidget } from './Tasks/TasksWidget';
import { Modal, Form, Input, Select, Button, message, Collapse } from 'antd';
import { Client } from '../types';
import {
  FiEdit2,
  FiEye,
  FiTrash2,
} from 'react-icons/fi';
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import CreditCardRoundedIcon from '@mui/icons-material/CreditCardRounded';
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import SavingsRoundedIcon from '@mui/icons-material/SavingsRounded';
import SpaRoundedIcon from '@mui/icons-material/SpaRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import './ClientsGrid.css';

// Simple wrapper to fix TypeScript icon issues
const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

const { Option } = Select;
const { TextArea } = Input;
const { Panel } = Collapse;

interface RetreatDetailViewProps {
  retreatId: string;
  onBack: () => void;
}

interface QuickBookingFormData {
  firstName: string;
  lastName: string;
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
  bookingNumber?: number | string;
  bookingHash?: string;
  clientId: string;
  clientDisplayId?: number;
  clientName: string;
  clientPhone: string;
  registrationDate: string;
  checkInDate?: string;
  checkOutDate?: string;
  status: string;
  totalAmount: number;
  amountPaid: number;
  amountPaidUSD: number;
  currency: string;
  roomAssignment?: string;
  specialRequests?: string;
  notes?: string;
}

const USD_FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  CZK: 0.044,
  PLN: 0.26
};

const convertAmountToUSD = (amount: number, currency?: string) => {
  const rate = USD_FALLBACK_RATES[(currency || 'USD').toUpperCase()] || 1;
  return amount * rate;
};

const convertUSDToAmount = (amountUSD: number, currency?: string) => {
  const rate = USD_FALLBACK_RATES[(currency || 'USD').toUpperCase()] || 1;
  return rate ? amountUSD / rate : amountUSD;
};

const convertAmount = (amount: number, fromCurrency?: string, toCurrency?: string) => {
  if ((fromCurrency || '').toUpperCase() === (toCurrency || '').toUpperCase()) return amount;
  return convertUSDToAmount(convertAmountToUSD(amount, fromCurrency), toCurrency);
};

const formatUSD = (amount: number) => {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const RetreatDetailView: React.FC<RetreatDetailViewProps> = ({ retreatId, onBack }) => {
  const [retreat, setRetreat] = useState<Retreat | null>(null);
  const [clients, setClients] = useState<RetreatClientData[]>([]);
  const [expensesSummary, setExpensesSummary] = useState<ExpenseSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'clients' | 'holisticView' | 'tracking' | 'expenses' | 'payments' | 'ceremonies' | 'analytics' | 'tasks'>('clients');
  const [viewingClientId, setViewingClientId] = useState<string | null>(null);
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showQuickBookingModal, setShowQuickBookingModal] = useState(false);
  const [showExistingClientModal, setShowExistingClientModal] = useState(false);
  const [metricsCollapsed, setMetricsCollapsed] = useState(true);
  const [showRetreatEditModal, setShowRetreatEditModal] = useState(false);
  const [houses, setHouses] = useState<House[]>([]);
  const [retreatFormData, setRetreatFormData] = useState<Partial<Retreat>>({});
  const [sortField, setSortField] = useState<'bookingNumber' | 'clientName' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
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
  const [quickBookingForm] = Form.useForm();
  const [quickBookingLoading, setQuickBookingLoading] = useState(false);
  const [existingClientBookingLoading, setExistingClientBookingLoading] = useState(false);

  const formatDateUTC = (date: Date) => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${month}/${day}/${year}`;
  };

  const formatAmount = (amount: number, currency: string) => {
    if (amount === null || amount === undefined) return '';
    return `${amount.toFixed(2)} ${currency}`;
  };

  const formatDate = (date: string | Date) => {
    if (!date) return 'Not set';
    return formatDateUTC(new Date(date));
  };


  const fetchRetreatData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [retreatResponse, clientsResponse, expensesSummaryResponse, paymentsResponse] = await Promise.all([
        retreatsApi.getOne(retreatId),
        bookingsApi.getByRetreatWithDetails(retreatId),
        retreatExpensesApi.getRetreatSummary(retreatId),
        paymentsApi.getByRetreat(retreatId)
      ]);

      setRetreat(retreatResponse.data);
      setExpensesSummary(expensesSummaryResponse.data);

      const payments = paymentsResponse.data || [];
      const getObjectId = (value: any) => typeof value === 'object' ? value?._id || value?.id : value;
      const getPaymentsForBooking = (booking: any) => {
        const bookingId = getObjectId(booking);
        const bookingHash = booking.bookingHash;
        return payments.filter((payment: Payment) => (
          getObjectId(payment.bookingId) === bookingId ||
          (bookingHash && payment.bookingHash === bookingHash)
        ));
      };
      const getPaymentNetAmount = (payment: Payment) => Math.max((payment.amount || 0) - (payment.refundedAmount || 0), 0);
      const getPaymentNetUSD = (payment: Payment) => {
        const netAmount = getPaymentNetAmount(payment);
        if (typeof payment.usd_amount === 'number') {
          const refundRatio = payment.amount ? netAmount / payment.amount : 1;
          return payment.usd_amount * refundRatio;
        }
        return convertAmountToUSD(netAmount, payment.currency);
      };
      const getPaidAmountForBooking = (booking: any) => {
        const targetCurrency = booking.currency || 'EUR';
        const matchedPayments = getPaymentsForBooking(booking);
        return matchedPayments
          .filter((payment: Payment) => payment.status === 'completed')
          .reduce((sum: number, payment: Payment) => {
            return sum + convertAmount(getPaymentNetAmount(payment), payment.currency, targetCurrency);
          }, 0);
      };
      const getPaidUsdForBooking = (booking: any) => getPaymentsForBooking(booking)
        .filter((payment: Payment) => payment.status === 'completed')
        .reduce((sum: number, payment: Payment) => sum + getPaymentNetUSD(payment), 0);

      // Transform booking data to client data format
      const transformedClients: RetreatClientData[] = clientsResponse.data.map((booking: any) => {
        const currency = booking.currency || 'EUR';
        return {
          _id: booking._id,
          bookingNumber: booking.bookingNumber || booking.display_id || booking.displayId,
          bookingHash: booking.bookingHash,
          clientId: booking.clientId?._id || booking.clientId || '', // Store the actual client ID
          clientDisplayId: booking.clientId?.display_id,
          clientName: booking.clientId
            ? `${booking.clientId.firstName || booking.clientId.fname || ''} ${booking.clientId.lastName || booking.clientId.lname || ''}`.trim()
            : 'Unknown Client',
          clientPhone: booking.clientId?.phone || '',
          registrationDate: booking.registrationDate,
          checkInDate: booking.checkInDate,
          checkOutDate: booking.checkOutDate,
          status: booking.status || 'pending',
          totalAmount: booking.totalAmount || 0,
          amountPaid: getPaidAmountForBooking({ ...booking, currency }),
          amountPaidUSD: getPaidUsdForBooking(booking),
          currency,
          roomAssignment: booking.roomAssignment,
          specialRequests: booking.specialRequests,
          notes: booking.notes
        };
      });

      setClients(transformedClients);
    } catch (error) {
      console.error('Error fetching retreat data:', error);
      setRetreat(null);
      setClients([]);
      setExpensesSummary(null);
    } finally {
      setIsLoading(false);
    }
  }, [retreatId]);

  useEffect(() => {
    fetchRetreatData();
  }, [fetchRetreatData]);

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

  const handleViewClient = useCallback((clientId: string) => {
    setViewingClientId(clientId);
  }, []);

  const handleEditBooking = useCallback((bookingId: string) => {
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
  }, [clients]);

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
    // CSV export functionality can be implemented using a CSV library
    // For now, we'll show a simple message
    const fileName = `retreat-${retreat?.name || 'unknown'}-clients-${new Date().toISOString().split('T')[0]}.csv`;
    console.log('Export functionality needs CSV library implementation for:', fileName);
    alert('CSV export functionality requires implementation with a CSV library');
  }, [retreat]);

  const handleRetreatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const cleanData: any = {};

      if (retreatFormData.name?.trim()) cleanData.name = retreatFormData.name.trim();
      cleanData.location = 'Default Location'; // Backend requires location
      if (retreatFormData.startDate) cleanData.startDate = retreatFormData.startDate;
      if (retreatFormData.endDate) cleanData.endDate = retreatFormData.endDate;
      if (retreatFormData.capacity !== undefined && retreatFormData.capacity !== null && !Number.isNaN(Number(retreatFormData.capacity))) {
        cleanData.capacity = Number(retreatFormData.capacity);
      }
      if (retreatFormData.helpers?.trim()) cleanData.helpers = retreatFormData.helpers.trim();
      if (retreatFormData.description?.trim()) cleanData.description = retreatFormData.description.trim();
      if (retreatFormData.houseId?.trim()) cleanData.houseId = retreatFormData.houseId.trim();
      if (retreatFormData.status) cleanData.status = retreatFormData.status;
      if (retreatFormData.type) cleanData.type = retreatFormData.type;
      if (retreatFormData.backgroundColor !== undefined) cleanData.backgroundColor = retreatFormData.backgroundColor;
      if (retreatFormData.textColor !== undefined) cleanData.textColor = retreatFormData.textColor;

      await retreatsApi.update(retreatId, cleanData);
      setShowRetreatEditModal(false);
      setRetreatFormData({});
      await fetchRetreatData(); // Refresh the data
    } catch (error: any) {
      console.error('Error updating retreat:', error);
      alert('Error updating retreat. Please try again.');
    }
  };

  const handleRetreatInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setRetreatFormData(prev => ({
      ...prev,
      [name]: name === 'capacity' ? parseInt(value) : value
    }));
  };

  const handleQuickBooking = async (values: QuickBookingFormData) => {
    try {
      setQuickBookingLoading(true);

      // First, create the client
      const clientData = {
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone,
        email: values.email,
        country: values.country,
        source: values.source,
        notes: values.notes,
        address: 'TBD',
        workflowStatus: 'booked' as const
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
        amountPaidUSD: 0,
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

  const handleExistingClientSelect = async (selectedClient: Client) => {
    try {
      setExistingClientBookingLoading(true);

      // Create booking for existing client
      const bookingData = {
        clientId: selectedClient._id!,
        retreatId: retreatId,
        totalAmount: 3000, // Default amount, can be edited later
        currency: 'EUR' as const,
        status: 'confirmed' as const,
        registrationDate: new Date().toISOString(),
        amountPaid: 0,
        amountPaidUSD: 0,
        checkInDate: retreat?.startDate || new Date().toISOString(),
        checkOutDate: retreat?.endDate || new Date().toISOString()
      };

      await bookingsApi.create(bookingData);

      const fullName = `${selectedClient.firstName || ''} ${selectedClient.lastName || ''}`.trim();
      message.success(`${fullName} has been added to this retreat!`);
      setShowExistingClientModal(false);
      await fetchRetreatData(); // Refresh the data
    } catch (error: any) {
      console.error('Error adding existing client:', error);
      message.error(error.response?.data?.message || 'Failed to add client to retreat');
    } finally {
      setExistingClientBookingLoading(false);
    }
  };

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

  // Sort clients based on current sort field and direction
  const sortedClients = React.useMemo(() => {
    if (!sortField) return clients;

    return [...clients].sort((a, b) => {
      let compareValue = 0;

      if (sortField === 'bookingNumber') {
        const aNum = a.bookingNumber || a._id?.slice(-6) || '';
        const bNum = b.bookingNumber || b._id?.slice(-6) || '';
        compareValue = String(aNum).localeCompare(String(bNum), undefined, { numeric: true });
      } else if (sortField === 'clientName') {
        compareValue = a.clientName.localeCompare(b.clientName);
      }

      return sortDirection === 'asc' ? compareValue : -compareValue;
    });
  }, [clients, sortField, sortDirection]);

  const handleSort = (field: 'bookingNumber' | 'clientName') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

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

  const totalRevenueUSD = clients.reduce((sum, client) => sum + (client.amountPaidUSD || 0), 0);
  const totalExpectedUSD = clients.reduce(
    (sum, client) => sum + convertAmountToUSD(client.totalAmount || 0, client.currency),
    0
  );
  const totalExpensesUSD = expensesSummary?.totalExpensesUSD || 0;
  const profitUSD = totalRevenueUSD - totalExpensesUSD;
  const expectedProfitUSD = totalExpectedUSD - totalExpensesUSD;
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
        <div className="retreat-detail-actions">
          <button onClick={onBack} className="back-btn">← Back to Retreats</button>
          <button onClick={async () => {
            // Fetch houses when edit modal is opened
            if (houses.length === 0) {
              try {
                const housesResponse = await housesApi.getAll();
                setHouses(housesResponse.data);
              } catch (error) {
                console.error('Error fetching houses:', error);
              }
            }

            setRetreatFormData({
              ...retreat,
              startDate: retreat?.startDate || '',
              endDate: retreat?.endDate || '',
              capacity: retreat?.capacity || 0
            });
            setShowRetreatEditModal(true);
          }} className="edit-retreat-btn">
            <Icon icon={FiEdit2} className="w-4 h-4" />
            Edit Retreat
          </button>
        </div>
        <div className="retreat-info">
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
            <span
              className="retreat-name-badge"
              style={{
                backgroundColor: retreat.backgroundColor || 'transparent',
                color: retreat.textColor || (retreat.backgroundColor ? '#111827' : 'inherit'),
                padding: retreat.backgroundColor ? '8px 16px' : '0'
              }}
            >
              {retreat.name}
            </span>
          </h1>
          <div className="retreat-meta" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
              <div className="meta-item" style={{ fontWeight: '600' }}>
                {retreat.code || retreat.retreatCode || 'No Code'}
              </div>
              <div className="meta-item">
                <strong>Town:</strong> {retreat.location_town || retreat.locationTown || retreat.location || 'N/A'}
              </div>
            </div>
            <div className="meta-item">
              <strong>Address:</strong> {retreat.address || retreat.location || 'Default Location'}
            </div>
            <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
              <div className="meta-item">
                <strong>Capacity:</strong> {retreat.capacity || 'N/A'}
              </div>
              <div className="meta-item">
                <strong>Status:</strong> <span className={`status-badge status-${retreat.status}`} style={{ textTransform: 'uppercase' }}>{retreat.status}</span>
              </div>
            </div>
            <div className="meta-item">
              <strong>Dates:</strong> {(() => {
                const startDate = new Date(retreat.startDate!);
                const endDate = new Date(retreat.endDate!);
                return `${formatDateUTC(startDate)} - ${formatDateUTC(endDate)}`;
              })()}
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
              <div className="stat-number">{formatUSD(totalRevenueUSD)}</div>
              <div className="stat-label">Revenue Collected</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{formatUSD(totalExpectedUSD)}</div>
              <div className="stat-label">Expected Revenue</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{clients.filter(c => c.status === 'confirmed').length}</div>
              <div className="stat-label">Confirmed</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{formatUSD(totalExpensesUSD)}</div>
              <div className="stat-label">Total Expenses</div>
            </div>
            <div className="stat-card">
              <div className={`stat-number ${profitUSD >= 0 ? 'profit-positive' : 'profit-negative'}`}>
                {formatUSD(profitUSD)}
              </div>
              <div className="stat-label">Profit</div>
            </div>
            <div className="stat-card">
              <div className={`stat-number ${expectedProfitUSD >= 0 ? 'profit-positive' : 'profit-negative'}`}>
                {formatUSD(expectedProfitUSD)}
              </div>
              <div className="stat-label">Expected Profit</div>
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
          <PeopleAltRoundedIcon className="retreat-tab-icon" />
          <span>Clients ({clients.length})</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'holisticView' ? 'active' : ''}`}
          onClick={() => setActiveTab('holisticView')}
        >
          <AssignmentTurnedInRoundedIcon className="retreat-tab-icon" />
          <span>Retreat Readiness</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'tracking' ? 'active' : ''}`}
          onClick={() => setActiveTab('tracking')}
        >
          <FactCheckRoundedIcon className="retreat-tab-icon" />
          <span>Tracking Grid</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'expenses' ? 'active' : ''}`}
          onClick={() => setActiveTab('expenses')}
        >
          <SavingsRoundedIcon className="retreat-tab-icon" />
          <span>Expenses</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'payments' ? 'active' : ''}`}
          onClick={() => setActiveTab('payments')}
        >
          <CreditCardRoundedIcon className="retreat-tab-icon" />
          <span>Payments</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'ceremonies' ? 'active' : ''}`}
          onClick={() => setActiveTab('ceremonies')}
        >
          <SpaRoundedIcon className="retreat-tab-icon" />
          <span>Ceremonies</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          <InsightsRoundedIcon className="retreat-tab-icon" />
          <span>Analytics</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          <TaskAltRoundedIcon className="retreat-tab-icon" />
          <span>Tasks</span>
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
              <button
                onClick={() => setShowExistingClientModal(true)}
                className="add-existing-client-btn"
                style={{
                  background: 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  marginRight: '8px',
                  fontWeight: '500'
                }}
              >
                👥 Add Existing Client
              </button>
              <button onClick={fetchRetreatData} className="refresh-btn">
                🔄 Refresh
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm overflow-hidden max-h-96">
            <div className="overflow-x-auto overflow-y-auto max-h-96">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('bookingNumber')}
                    >
                      <div className="flex items-center gap-1">
                        Booking #
                        {sortField === 'bookingNumber' && (
                          <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('clientName')}
                    >
                      <div className="flex items-center gap-1">
                        Client Name
                        {sortField === 'clientName' && (
                          <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Phone
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Registration Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount Paid
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedClients.map((client) => (
                    <tr key={client._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        #{client.bookingNumber || client._id?.slice(-6)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <div>{client.clientName}</div>
                        {client.clientDisplayId && (
                          <div className="mt-1 text-xs font-semibold text-gray-500">
                            Client #{client.clientDisplayId}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {client.clientPhone}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(client.registrationDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatAmount(client.totalAmount, client.currency)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatAmount(client.amountPaid, client.currency)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleViewClient(client.clientId)}
                            className="icon-action-btn icon-action-btn-view"
                            title="View Client"
                          >
                            <Icon icon={FiEye} />
                          </button>
                          <button
                            onClick={() => handleEditBooking(client._id)}
                            className="icon-action-btn icon-action-btn-edit"
                            title="Edit Booking"
                          >
                            <Icon icon={FiEdit2} />
                          </button>
                          <button
                            onClick={() => handleDeleteBooking(client._id)}
                            className="icon-action-btn icon-action-btn-danger"
                            title="Delete Booking"
                          >
                            <Icon icon={FiTrash2} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {clients.length === 0 && !isLoading && (
                <div className="text-center py-8 text-gray-500">
                  No bookings found
                </div>
              )}
              {isLoading && (
                <div className="text-center py-8 text-gray-500">
                  Loading bookings...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'holisticView' && (
        <div className="booking-steps-section">
          <BookingStepsMatrix retreatId={retreatId} />
        </div>
      )}

      {activeTab === 'tracking' && (
        <div className="tracking-section">
          <RetreatTrackingGrid retreatId={retreatId} />
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

      {activeTab === 'tasks' && (
        <div className="tasks-section">
          <TasksWidget retreatId={retreatId} title="Retreat Tasks" />
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
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="cancel-btn"
                >
                  Cancel
                </button>
                <button type="submit" className="save-btn">Update Booking</button>
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

          <Form.Item
            name="phone"
            label="Phone Number"
            rules={[{ required: true, message: 'Please enter phone number' }]}
          >
            <Input placeholder="+1 234 567 8900" />
          </Form.Item>

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

      {/* Existing Client Selector Modal */}
      <SearchableClientSelector
        isVisible={showExistingClientModal}
        onClose={() => setShowExistingClientModal(false)}
        onSelectClient={handleExistingClientSelect}
        title="Add Existing Client to Retreat"
      />

      {/* Retreat Edit Modal */}
      {showRetreatEditModal && (
        <div className="modal-overlay">
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>✏️ Edit Retreat</h3>
            <form onSubmit={handleRetreatSubmit}>
              <div className="form-group">
                <label htmlFor="retreat-name">Name:</label>
                <input
                  type="text"
                  id="retreat-name"
                  name="name"
                  value={retreatFormData.name || ''}
                  onChange={handleRetreatInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="retreat-startDate">Start Date:</label>
                <input
                  type="date"
                  id="retreat-startDate"
                  name="startDate"
                  value={retreatFormData.startDate ? new Date(retreatFormData.startDate).toISOString().split('T')[0] : ''}
                  onChange={handleRetreatInputChange}
                />
              </div>

              <div className="form-group">
                <label htmlFor="retreat-endDate">End Date:</label>
                <input
                  type="date"
                  id="retreat-endDate"
                  name="endDate"
                  value={retreatFormData.endDate ? new Date(retreatFormData.endDate).toISOString().split('T')[0] : ''}
                  onChange={handleRetreatInputChange}
                />
              </div>

              <div className="form-group">
                <label htmlFor="retreat-capacity">Capacity:</label>
                <input
                  type="number"
                  id="retreat-capacity"
                  name="capacity"
                  value={retreatFormData.capacity || ''}
                  onChange={handleRetreatInputChange}
                  min="0"
                />
              </div>

              <div className="form-group">
                <label htmlFor="retreat-helpers">Helpers:</label>
                <select
                  id="retreat-helpers"
                  name="helpers"
                  value={retreatFormData.helpers || ''}
                  onChange={handleRetreatInputChange}
                >
                  <option value="">Select a helper</option>
                  <option value="Martina">Martina</option>
                  <option value="Radim">Radim</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="retreat-houseId">House:</label>
                <select
                  id="retreat-houseId"
                  name="houseId"
                  value={retreatFormData.houseId || ''}
                  onChange={handleRetreatInputChange}
                >
                  <option value="">Select a house</option>
                  {houses.map(house => (
                    <option key={house._id} value={house._id}>
                      {house.name || house.city || 'Unnamed House'}{house.address ? ` - ${house.address}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="retreat-status">Status:</label>
                <select
                  id="retreat-status"
                  name="status"
                  value={retreatFormData.status || 'upcoming'}
                  onChange={handleRetreatInputChange}
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="retreat-type">Type:</label>
                <select
                  id="retreat-type"
                  name="type"
                  value={retreatFormData.type || 'regular'}
                  onChange={handleRetreatInputChange}
                >
                  <option value="regular">Regular</option>
                  <option value="booster">Booster</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="retreat-description">Description:</label>
                <textarea
                  id="retreat-description"
                  name="description"
                  value={retreatFormData.description || ''}
                  onChange={handleRetreatInputChange}
                  rows={3}
                />
              </div>

              <div className="form-buttons">
                <button type="button" onClick={() => setShowRetreatEditModal(false)} className="cancel-btn">Cancel</button>
                <button type="submit" className="save-btn">Update Retreat</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RetreatDetailView;
