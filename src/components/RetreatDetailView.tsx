import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { retreatsApi, bookingsApi, retreatExpensesApi, paymentsApi, clientsApi, housesApi, communicationsApi, contactBookApi } from '../services/api';
import { Retreat, ExpenseSummary, House, Payment, EmailTemplate, ContactBookEntry, RetreatStaffAssignment } from '../types';
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
  FiImage,
  FiMail,
  FiPlus,
  FiRefreshCw,
  FiTrash2,
  FiUpload,
  FiUserPlus,
  FiX,
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
  initialTab?: RetreatDetailTab;
  onTabChange?: (tab: RetreatDetailTab) => void;
}

export type RetreatDetailTab = 'clients' | 'holisticView' | 'tracking' | 'expenses' | 'payments' | 'ceremonies' | 'analytics' | 'tasks';

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
  clientEmail?: string;
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

const getHouseIdValue = (houseId?: string | House) => {
  if (!houseId) return '';
  return typeof houseId === 'string' ? houseId : houseId._id || '';
};

const getHouseTown = (house?: House | null) =>
  String(house?.generalTown || house?.general_town || house?.city || house?.name || '').trim();

const getRetreatTown = (retreat?: Partial<Retreat> | null, houses: House[] = []) => {
  const explicitTown = String(retreat?.location_town || retreat?.locationTown || retreat?.location || '').trim();
  if (explicitTown && explicitTown !== 'Default Location') return explicitTown;

  const houseId = getHouseIdValue(retreat?.houseId as any);
  const house = houseId ? houses.find((item) => item._id === houseId) : null;
  return getHouseTown(house) || explicitTown;
};

const staffRoleOptions = [
  { value: 'helper', label: 'Helper' },
  { value: 'second_helper', label: 'Second helper' },
  { value: 'cook', label: 'Cook' },
];

const formatStaffRole = (role?: string) => {
  const match = staffRoleOptions.find((option) => option.value === role);
  if (match) return match.label;
  return (role || 'Staff').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const formatDateForInput = (date?: Date | string) => {
  if (!date) return '';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().split('T')[0];
};

const cropImageToHeroBanner = (file: File, width = 1200, height = 250): Promise<File> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file.'));
      return;
    }

    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Image editor is not available in this browser.');

        const sourceRatio = image.naturalWidth / image.naturalHeight;
        const targetRatio = width / height;
        let sourceWidth = image.naturalWidth;
        let sourceHeight = image.naturalHeight;
        let sourceX = 0;
        let sourceY = 0;

        if (sourceRatio > targetRatio) {
          sourceWidth = image.naturalHeight * targetRatio;
          sourceX = (image.naturalWidth - sourceWidth) / 2;
        } else {
          sourceHeight = image.naturalWidth / targetRatio;
          sourceY = (image.naturalHeight - sourceHeight) / 2;
        }

        context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(objectUrl);
          if (!blob) {
            reject(new Error('Could not prepare retreat hero image.'));
            return;
          }
          const baseName = file.name.replace(/\.[^/.]+$/, '').trim() || 'retreat-hero';
          resolve(new File([blob], `${baseName}-hero.jpg`, { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.9);
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(error);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read this image file.'));
    };

    image.src = objectUrl;
  });
};

const RetreatDetailView: React.FC<RetreatDetailViewProps> = ({ retreatId, onBack, initialTab = 'clients', onTabChange }) => {
  const location = useLocation();
  const [retreat, setRetreat] = useState<Retreat | null>(null);
  const [clients, setClients] = useState<RetreatClientData[]>([]);
  const [expensesSummary, setExpensesSummary] = useState<ExpenseSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<RetreatDetailTab>(initialTab);
  const [viewingClientId, setViewingClientId] = useState<string | null>(null);
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showQuickBookingModal, setShowQuickBookingModal] = useState(false);
  const [showExistingClientModal, setShowExistingClientModal] = useState(false);
  const [showRetreatEmailModal, setShowRetreatEmailModal] = useState(false);
  const [retreatEmailTemplates, setRetreatEmailTemplates] = useState<EmailTemplate[]>([]);
  const [retreatEmailLoading, setRetreatEmailLoading] = useState(false);
  const [metricsCollapsed, setMetricsCollapsed] = useState(true);
  const [showRetreatEditModal, setShowRetreatEditModal] = useState(false);
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);
  const [heroImageSource, setHeroImageSource] = useState<'retreat' | 'house' | null>(null);
  const [heroImageUploading, setHeroImageUploading] = useState(false);
  const [houses, setHouses] = useState<House[]>([]);
  const [staffDirectory, setStaffDirectory] = useState<ContactBookEntry[]>([]);
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
  const [retreatEmailForm] = Form.useForm();
  const [quickBookingLoading, setQuickBookingLoading] = useState(false);
  const [existingClientBookingLoading, setExistingClientBookingLoading] = useState(false);
  const heroImageInputRef = useRef<HTMLInputElement | null>(null);
  const firstRouteSegment = location.pathname.split('/').filter(Boolean)[0];
  const routePrefix = ['admin', 'medical', 'staff', 'user', 'helper'].includes(firstRouteSegment) ? firstRouteSegment : 'admin';

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

  const loadHeroImageUrl = async (targetRetreat: Retreat) => {
    if (!targetRetreat?._id) {
      setHeroImageUrl(null);
      setHeroImageSource(null);
      return;
    }

    try {
      const response = await retreatsApi.getHeroImageUrl(targetRetreat._id);
      setHeroImageUrl(response.data.heroImageUrl || null);
      setHeroImageSource(response.data.source || null);
    } catch (error) {
      console.error('Error loading retreat hero image:', error);
      setHeroImageUrl(null);
      setHeroImageSource(null);
    }
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
      await loadHeroImageUrl(retreatResponse.data);
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
          clientEmail: booking.clientId?.email || '',
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

  const loadStaffDirectory = useCallback(async () => {
    try {
      const [helpersResponse, cooksResponse] = await Promise.all([
        contactBookApi.getAll({ role: 'helper' }),
        contactBookApi.getAll({ role: 'cook' }),
      ]);
      const byId = new Map<string, ContactBookEntry>();
      [...(helpersResponse.data || []), ...(cooksResponse.data || [])].forEach((contact) => {
        if (contact._id && contact.isActive !== false) {
          byId.set(contact._id, contact);
        }
      });
      setStaffDirectory(Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Error fetching helper directory:', error);
      setStaffDirectory([]);
    }
  }, []);

  useEffect(() => {
    fetchRetreatData();
  }, [fetchRetreatData]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const handleTabChange = useCallback((tab: RetreatDetailTab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  }, [onTabChange]);

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
      const retreatCode = String(retreatFormData.code || retreatFormData.retreatCode || '').trim();
      if (retreatCode) {
        cleanData.code = retreatCode;
        cleanData.retreatCode = retreatCode;
      }
      const houseId = getHouseIdValue(retreatFormData.houseId).trim();
      const selectedHouse = houseId ? houses.find((house) => house._id === houseId) : null;
      const retreatTown = getRetreatTown(retreatFormData, houses) || getRetreatTown(retreat, houses) || getHouseTown(selectedHouse);
      if (retreatTown) {
        cleanData.location = retreatTown;
        cleanData.location_town = retreatTown;
      }
      if (retreatFormData.startDate) cleanData.startDate = retreatFormData.startDate;
      cleanData.startTime = retreatFormData.startTime?.trim() || undefined;
      if (retreatFormData.endDate) cleanData.endDate = retreatFormData.endDate;
      cleanData.endTime = retreatFormData.endTime?.trim() || undefined;
      if (retreatFormData.capacity !== undefined && retreatFormData.capacity !== null && !Number.isNaN(Number(retreatFormData.capacity))) {
        cleanData.capacity = Number(retreatFormData.capacity);
      }
      if (retreatFormData.helpers?.trim()) cleanData.helpers = retreatFormData.helpers.trim();
      cleanData.retreatStaff = (retreatFormData.retreatStaff || []).map((assignment) => ({
        ...assignment,
        plannedSalary: assignment.plannedSalary === undefined || assignment.plannedSalary === null
          ? undefined
          : Number(assignment.plannedSalary),
      }));
      if (retreatFormData.description?.trim()) cleanData.description = retreatFormData.description.trim();
      if (houseId) cleanData.houseId = houseId;
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
    if (name === 'houseId') {
      const selectedHouse = houses.find((house) => house._id === value);
      const town = getHouseTown(selectedHouse);
      setRetreatFormData(prev => ({
        ...prev,
        houseId: value,
        ...(town ? { location: town, location_town: town } : {}),
      }));
      return;
    }

    setRetreatFormData(prev => ({
      ...prev,
      [name]: name === 'capacity' ? parseInt(value) : value
    }));
  };

  const handleStaffAssignmentChange = (
    index: number,
    field: keyof RetreatStaffAssignment,
    value: string | number
  ) => {
    setRetreatFormData((prev) => {
      const retreatStaff = [...(prev.retreatStaff || [])];
      const current = { ...(retreatStaff[index] || {}) };

      if (field === 'contactId') {
        const contact = staffDirectory.find((item) => item._id === value);
        retreatStaff[index] = {
          ...current,
          contactId: String(value || ''),
          name: contact?.name || current.name || '',
          phone: contact?.phone || current.phone || '',
          email: contact?.email || current.email || '',
        };
      } else if (field === 'plannedSalary') {
        retreatStaff[index] = {
          ...current,
          plannedSalary: value === '' ? undefined : Number(value),
        };
      } else {
        retreatStaff[index] = {
          ...current,
          [field]: value,
        };
      }

      return { ...prev, retreatStaff };
    });
  };

  const addStaffAssignment = () => {
    const defaultStartDate = formatDateForInput(retreatFormData.startDate || retreat?.startDate);
    const defaultEndDate = formatDateForInput(retreatFormData.endDate || retreat?.endDate);
    setRetreatFormData((prev) => ({
      ...prev,
      retreatStaff: [
        ...(prev.retreatStaff || []),
        {
          role: 'helper',
          contactId: '',
          name: '',
          phone: '',
          email: '',
          startDate: defaultStartDate,
          startTime: prev.startTime || retreat?.startTime || '12:00',
          endDate: defaultEndDate,
          endTime: prev.endTime || retreat?.endTime || '10:00',
          plannedSalary: undefined,
          salaryCurrency: 'CZK',
          notes: '',
        },
      ],
    }));
  };

  const removeStaffAssignment = (index: number) => {
    setRetreatFormData((prev) => ({
      ...prev,
      retreatStaff: (prev.retreatStaff || []).filter((_, itemIndex) => itemIndex !== index),
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
      const bookingData: any = {
        clientId: clientId!,
        retreatId: retreatId,
        totalAmount: values.totalAmount,
        currency: values.currency as 'EUR' | 'USD' | 'CZK' | 'PLN',
        status: 'confirmed' as const,
        registrationDate: new Date().toISOString(),
        amountPaid: 0,
        amountPaidUSD: 0,
      };
      if (retreat?.startDate) bookingData.checkInDate = retreat.startDate;
      if (retreat?.endDate) bookingData.checkOutDate = retreat.endDate;

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
      const bookingData: any = {
        clientId: selectedClient._id!,
        retreatId: retreatId,
        totalAmount: 3000, // Default amount, can be edited later
        currency: 'EUR' as const,
        status: 'confirmed' as const,
        registrationDate: new Date().toISOString(),
        amountPaid: 0,
        amountPaidUSD: 0,
      };
      if (retreat?.startDate) bookingData.checkInDate = retreat.startDate;
      if (retreat?.endDate) bookingData.checkOutDate = retreat.endDate;

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

  const openRetreatEmailModal = async () => {
    const retreatLabel = retreat?.code || retreat?.retreatCode || retreat?.name || 'retreat';
    retreatEmailForm.setFieldsValue({
      templateId: '',
      subject: `Information for ${retreatLabel}`,
      bodyText: '',
    });
    setShowRetreatEmailModal(true);

    if (retreatEmailTemplates.length === 0) {
      try {
        const response = await communicationsApi.getTemplates();
        setRetreatEmailTemplates((response.data || []).filter((template: EmailTemplate) => template.active !== false));
      } catch (error) {
        console.error('Error loading email templates:', error);
        message.warning('Email templates could not be loaded. You can still write the email manually.');
      }
    }
  };

  const handleRetreatEmailTemplateChange = (templateId: string) => {
    const template = retreatEmailTemplates.find((item) => item._id === templateId);
    if (!template) return;
    retreatEmailForm.setFieldsValue({
      subject: template.subject || '',
      bodyText: template.bodyText || '',
    });
  };

  const handleRetreatEmailSend = async (values: { templateId?: string; subject: string; bodyText: string }) => {
    try {
      setRetreatEmailLoading(true);
      const response = await communicationsApi.sendRetreatEmail(retreatId, {
        templateId: values.templateId || undefined,
        subject: values.subject,
        bodyText: values.bodyText,
        variables: {
          retreatName: retreat?.name,
          retreatCode: retreat?.code || retreat?.retreatCode || retreat?.name,
          retreatStartDate: retreat?.startDate,
          retreatEndDate: retreat?.endDate,
        },
      });
      message.success(`Retreat email sent to ${response.data.sent}. Failed: ${response.data.failed}. Skipped: ${response.data.skipped}.`);
      setShowRetreatEmailModal(false);
      retreatEmailForm.resetFields();
    } catch (error: any) {
      console.error('Error sending retreat email:', error);
      message.error(error?.response?.data?.message || 'Failed to send retreat email.');
    } finally {
      setRetreatEmailLoading(false);
    }
  };

  const handleHeroImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!retreat?._id || !file) return;

    try {
      setHeroImageUploading(true);
      const croppedFile = await cropImageToHeroBanner(file);
      const response = await retreatsApi.uploadHeroImage(retreat._id, croppedFile);
      setRetreat(response.data.retreat);
      setHeroImageUrl(response.data.heroImageUrl);
      setHeroImageSource('retreat');
      message.success('Retreat hero image uploaded.');
    } catch (error: any) {
      console.error('Error uploading retreat hero image:', error);
      message.error(error?.response?.data?.message || error?.message || 'Failed to upload retreat hero image.');
    } finally {
      setHeroImageUploading(false);
    }
  };

  const handleClearHeroImage = async () => {
    if (!retreat?._id) return;
    if (!window.confirm('Remove the custom retreat hero image and use the house default?')) return;

    try {
      const response = await retreatsApi.clearHeroImage(retreat._id);
      setRetreat(response.data.retreat);
      setHeroImageUrl(response.data.heroImageUrl || null);
      setHeroImageSource(response.data.source || null);
      message.success(response.data.heroImageUrl ? 'Using house default hero image.' : 'Retreat hero image removed.');
    } catch (error: any) {
      console.error('Error clearing retreat hero image:', error);
      message.error(error?.response?.data?.message || error?.message || 'Failed to remove retreat hero image.');
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

  const retreatEmailRecipientCount = React.useMemo(() => {
    return new Set(
      clients
        .map((client) => String(client.clientEmail || '').trim().toLowerCase())
        .filter(Boolean)
    ).size;
  }, [clients]);

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
        <button onClick={onBack} className="back-btn" title="Back to retreats" aria-label="Back to retreats">←</button>
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
  const retreatCode = retreat.code || retreat.retreatCode || retreat.name || 'Retreat';
  const retreatCodeColor = retreat.backgroundColor || retreat.textColor || '#111827';
  const retreatHouse = retreat.houseId && typeof retreat.houseId === 'object' ? retreat.houseId : null;
  const retreatPlace = retreatHouse?.generalTown
    || retreatHouse?.general_town
    || retreatHouse?.city
    || retreat.location_town
    || retreat.locationTown
    || retreat.location
    || 'Location TBD';
  const retreatCapacity = Number(retreat.capacity || 0);
  const availableSpaces = retreatCapacity ? Math.max(retreatCapacity - clients.length, 0) : 0;
  const retreatDateText = `${formatDate(retreat.startDate || '')} - ${formatDate(retreat.endDate || '')}`;

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
          <button onClick={onBack} className="back-btn" title="Back to retreats" aria-label="Back to retreats">←</button>
          <input
            ref={heroImageInputRef}
            type="file"
            accept="image/*"
            onChange={handleHeroImageSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => heroImageInputRef.current?.click()}
            className="edit-retreat-btn retreat-icon-action"
            disabled={heroImageUploading}
            title={heroImageSource === 'house' ? 'Upload a custom hero image for this retreat' : 'Upload Hero Image'}
            aria-label={heroImageSource === 'house' ? 'Upload custom hero image' : 'Upload hero image'}
          >
            <Icon icon={FiUpload} className="w-4 h-4" />
            <span className="retreat-action-label">
              {heroImageUploading ? 'Uploading image...' : heroImageSource === 'house' ? 'Override Hero Image' : 'Upload Hero Image'}
            </span>
          </button>
          {retreat.heroImageS3Key && (
            <button
              type="button"
              onClick={handleClearHeroImage}
              className="edit-retreat-btn retreat-icon-action"
              title="Remove custom retreat hero and use the house default"
              aria-label="Use house hero image"
            >
              <Icon icon={FiImage} className="w-4 h-4" />
              <span className="retreat-action-label">Use House Hero</span>
            </button>
          )}
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
            if (staffDirectory.length === 0) {
              await loadStaffDirectory();
            }

            setRetreatFormData({
              ...retreat,
              startDate: retreat?.startDate || '',
              startTime: retreat?.startTime || '',
              endDate: retreat?.endDate || '',
              endTime: retreat?.endTime || '',
              capacity: retreat?.capacity || 0,
              retreatStaff: (retreat?.retreatStaff || []).map((assignment) => ({
                ...assignment,
                contactId: typeof assignment.contactId === 'object' ? assignment.contactId._id : assignment.contactId,
                startDate: formatDateForInput(assignment.startDate),
                endDate: formatDateForInput(assignment.endDate),
                salaryCurrency: assignment.salaryCurrency || 'CZK',
              })),
            });
            setShowRetreatEditModal(true);
          }} className="edit-retreat-btn retreat-icon-action" title="Edit retreat" aria-label="Edit retreat">
            <Icon icon={FiEdit2} className="w-4 h-4" />
            <span className="retreat-action-label">Edit Retreat</span>
          </button>
        </div>
        <div
          className="retreat-hero-banner"
          style={{
            backgroundImage: heroImageUrl
              ? `linear-gradient(rgba(255,255,255,0.25), rgba(255,255,255,0.25)), url(${heroImageUrl})`
              : 'linear-gradient(135deg, #1f2937 0%, #475569 100%)',
          }}
        >
          <div className="retreat-hero-content">
            <div className="retreat-code-cutout">
              <span
                style={{ color: retreatCodeColor }}
              >
                {retreatCode}
              </span>
            </div>
            <div className="retreat-hero-primary">
              <span>{retreatPlace}</span>
              {retreatCapacity > 0 && <span>{availableSpaces}/{retreatCapacity}</span>}
            </div>
            <div className="retreat-hero-secondary">
              <span>{retreatDateText}</span>
              <span className={`status-badge status-${retreat.status}`} style={{ textTransform: 'uppercase' }}>
                {retreat.status || 'upcoming'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <section className="mb-5 rounded-lg border border-gray-200 bg-white px-4 py-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Helper Directory Assignments</h2>
            <p className="text-sm text-gray-500">Helpers and cooks assigned from Contact Book.</p>
          </div>
          <button
            type="button"
            onClick={async () => {
              if (houses.length === 0) {
                try {
                  const housesResponse = await housesApi.getAll();
                  setHouses(housesResponse.data);
                } catch (error) {
                  console.error('Error fetching houses:', error);
                }
              }
              if (staffDirectory.length === 0) {
                await loadStaffDirectory();
              }
              setRetreatFormData({
                ...retreat,
                startDate: retreat?.startDate || '',
                startTime: retreat?.startTime || '',
                endDate: retreat?.endDate || '',
                endTime: retreat?.endTime || '',
                capacity: retreat?.capacity || 0,
                retreatStaff: (retreat?.retreatStaff || []).map((assignment) => ({
                  ...assignment,
                  contactId: typeof assignment.contactId === 'object' ? assignment.contactId._id : assignment.contactId,
                  startDate: formatDateForInput(assignment.startDate),
                  endDate: formatDateForInput(assignment.endDate),
                  salaryCurrency: assignment.salaryCurrency || 'CZK',
                })),
              });
              setShowRetreatEditModal(true);
            }}
            className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Edit assignments
          </button>
        </div>

        {Boolean(retreat.retreatStaff?.length) ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {(retreat.retreatStaff || []).map((assignment, index) => (
              <div key={`${assignment.contactId || assignment.name || 'staff'}-${index}`} className="rounded-md border border-gray-100 bg-gray-50 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{assignment.name || 'Unnamed person'}</div>
                    <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{formatStaffRole(assignment.role)}</div>
                  </div>
                  {assignment.plannedSalary !== undefined && assignment.plannedSalary !== null && (
                    <div className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-gray-700">
                      {Number(assignment.plannedSalary).toLocaleString()} {assignment.salaryCurrency || 'CZK'}
                    </div>
                  )}
                </div>
                <div className="mt-2 space-y-1 text-sm text-gray-700">
                  <div>{formatDate(assignment.startDate || '')} {assignment.startTime || ''} - {formatDate(assignment.endDate || '')} {assignment.endTime || ''}</div>
                  {assignment.phone && <a className="block hover:underline" href={`tel:${assignment.phone}`}>{assignment.phone}</a>}
                  {assignment.email && <a className="block hover:underline" href={`mailto:${assignment.email}`}>{assignment.email}</a>}
                  {assignment.notes && <div className="text-gray-500">{assignment.notes}</div>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-500">
            No helpers or cooks assigned yet.
          </div>
        )}
      </section>

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
      <div className="tab-navigation retreat-detail-tabs" role="tablist" aria-label="Retreat sections">
        <button
          className={`tab-btn ${activeTab === 'clients' ? 'active' : ''}`}
          onClick={() => handleTabChange('clients')}
          role="tab"
          aria-selected={activeTab === 'clients'}
        >
          <PeopleAltRoundedIcon className="retreat-tab-icon" />
          <span>Clients ({clients.length})</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'holisticView' ? 'active' : ''}`}
          onClick={() => handleTabChange('holisticView')}
          role="tab"
          aria-selected={activeTab === 'holisticView'}
        >
          <AssignmentTurnedInRoundedIcon className="retreat-tab-icon" />
          <span>Retreat Readiness</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'tracking' ? 'active' : ''}`}
          onClick={() => handleTabChange('tracking')}
          role="tab"
          aria-selected={activeTab === 'tracking'}
        >
          <FactCheckRoundedIcon className="retreat-tab-icon" />
          <span>Tracking Grid</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'expenses' ? 'active' : ''}`}
          onClick={() => handleTabChange('expenses')}
          role="tab"
          aria-selected={activeTab === 'expenses'}
        >
          <SavingsRoundedIcon className="retreat-tab-icon" />
          <span>Expenses</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'payments' ? 'active' : ''}`}
          onClick={() => handleTabChange('payments')}
          role="tab"
          aria-selected={activeTab === 'payments'}
        >
          <CreditCardRoundedIcon className="retreat-tab-icon" />
          <span>Payments</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'ceremonies' ? 'active' : ''}`}
          onClick={() => handleTabChange('ceremonies')}
          role="tab"
          aria-selected={activeTab === 'ceremonies'}
        >
          <SpaRoundedIcon className="retreat-tab-icon" />
          <span>Ceremonies</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => handleTabChange('analytics')}
          role="tab"
          aria-selected={activeTab === 'analytics'}
        >
          <InsightsRoundedIcon className="retreat-tab-icon" />
          <span>Analytics</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => handleTabChange('tasks')}
          role="tab"
          aria-selected={activeTab === 'tasks'}
        >
          <TaskAltRoundedIcon className="retreat-tab-icon" />
          <span>Tasks</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="retreat-detail-tab-content">
        {activeTab === 'clients' && (
        <div className="clients-section">
          <div className="section-header">
            <h2>📋 Retreat Clients ({clients.length})</h2>
            <div className="section-actions">
              <button
                onClick={() => setShowQuickBookingModal(true)}
                className="retreat-client-action retreat-client-action-book"
                title="Quick book client"
                aria-label="Quick book client"
              >
                <Icon icon={FiPlus} className="w-4 h-4" />
                <span>Quick Book Client</span>
              </button>
              <button
                onClick={() => setShowExistingClientModal(true)}
                className="retreat-client-action retreat-client-action-existing"
                title="Add existing client"
                aria-label="Add existing client"
              >
                <Icon icon={FiUserPlus} className="w-4 h-4" />
                <span>Add Existing Client</span>
              </button>
              <button
                onClick={openRetreatEmailModal}
                className="retreat-client-action retreat-client-action-email"
                disabled={retreatEmailRecipientCount === 0}
                title={retreatEmailRecipientCount === 0 ? 'No clients with email addresses in this retreat' : 'Send email to all clients in this retreat'}
                aria-label={`Email retreat clients (${retreatEmailRecipientCount})`}
              >
                <Icon icon={FiMail} className="w-4 h-4" />
                <span>Email Retreat ({retreatEmailRecipientCount})</span>
              </button>
              <button
                onClick={fetchRetreatData}
                className="retreat-client-action retreat-client-action-refresh"
                title="Refresh"
                aria-label="Refresh retreat clients"
              >
                <Icon icon={FiRefreshCw} className="w-4 h-4" />
                <span>Refresh</span>
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
                        <Link
                          to={`/${routePrefix}/bookings/${client._id}`}
                          className="font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                          title="View booking"
                        >
                          #{client.bookingNumber || client._id?.slice(-6)}
                        </Link>
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
          <CeremoniesGrid retreatId={retreatId} retreats={retreat ? [retreat] : []} />
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
      </div>

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

      {/* Retreat Email Modal */}
      <Modal
        title={`Email Everyone in ${retreatCode}`}
        open={showRetreatEmailModal}
        onCancel={() => setShowRetreatEmailModal(false)}
        footer={null}
        width={760}
        destroyOnClose
      >
        <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          This sends one logged email per client in this retreat. Current eligible recipients: <strong>{retreatEmailRecipientCount}</strong>.
          Clients without an email address are skipped.
        </div>
        <Form
          form={retreatEmailForm}
          layout="vertical"
          onFinish={handleRetreatEmailSend}
        >
          <Form.Item name="templateId" label="Template">
            <Select
              allowClear
              placeholder="Optional template"
              onChange={(value) => handleRetreatEmailTemplateChange(value)}
            >
              {retreatEmailTemplates.map((template) => (
                <Option key={template._id} value={template._id}>
                  {template.display_id ? `#${template.display_id} ` : ''}{template.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="subject"
            label="Subject"
            rules={[{ required: true, message: 'Subject is required' }]}
          >
            <Input placeholder="Email subject" />
          </Form.Item>

          <Form.Item
            name="bodyText"
            label="Message"
            rules={[{ required: true, message: 'Message is required' }]}
          >
            <TextArea rows={12} placeholder="Write the email that should be sent to everyone in this retreat." />
          </Form.Item>

          <div className="flex justify-end gap-3">
            <Button onClick={() => setShowRetreatEmailModal(false)}>
              Cancel
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={retreatEmailLoading}
              disabled={retreatEmailRecipientCount === 0}
            >
              Send to {retreatEmailRecipientCount}
            </Button>
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
                <label htmlFor="retreat-code">Code:</label>
                <input
                  type="text"
                  id="retreat-code"
                  name="code"
                  value={retreatFormData.code || retreatFormData.retreatCode || ''}
                  onChange={(event) => {
                    const value = event.target.value;
                    setRetreatFormData(prev => ({
                      ...prev,
                      code: value,
                      retreatCode: value,
                    }));
                  }}
                  placeholder="e.g. JNO-09-22-26"
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
                <label htmlFor="retreat-startTime">Start Time:</label>
                <input
                  type="time"
                  id="retreat-startTime"
                  name="startTime"
                  value={retreatFormData.startTime || ''}
                  onChange={handleRetreatInputChange}
                />
              </div>

              <div className="form-group">
                <label htmlFor="retreat-endTime">End Time:</label>
                <input
                  type="time"
                  id="retreat-endTime"
                  name="endTime"
                  value={retreatFormData.endTime || ''}
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
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label>Retreat helpers and cooks:</label>
                  <button
                    type="button"
                    onClick={addStaffAssignment}
                    className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Icon icon={FiPlus} className="h-4 w-4" />
                    Add person
                  </button>
                </div>

                <div className="space-y-3">
                  {(retreatFormData.retreatStaff || []).map((assignment, index) => (
                    <div key={`${assignment.contactId || 'staff'}-${index}`} className="rounded-md border border-gray-200 bg-gray-50 p-3">
                      <div className="grid gap-3 md:grid-cols-[150px_1fr_120px]">
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-gray-600">Role</span>
                          <select
                            value={assignment.role || 'helper'}
                            onChange={(event) => handleStaffAssignmentChange(index, 'role', event.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                          >
                            {staffRoleOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-gray-600">Directory person</span>
                          <select
                            value={typeof assignment.contactId === 'object' ? assignment.contactId._id || '' : assignment.contactId || ''}
                            onChange={(event) => handleStaffAssignmentChange(index, 'contactId', event.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                          >
                            <option value="">Select helper or cook</option>
                            {staffDirectory.map((contact) => (
                              <option key={contact._id} value={contact._id}>
                                {contact.name} ({contact.role}){contact.phone ? ` - ${contact.phone}` : ''}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-gray-600">Planned salary</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={assignment.plannedSalary ?? ''}
                            onChange={(event) => handleStaffAssignmentChange(index, 'plannedSalary', event.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                          />
                        </label>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-4">
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-gray-600">From date</span>
                          <input
                            type="date"
                            value={assignment.startDate ? formatDateForInput(assignment.startDate) : ''}
                            onChange={(event) => handleStaffAssignmentChange(index, 'startDate', event.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-gray-600">From time</span>
                          <input
                            type="time"
                            value={assignment.startTime || ''}
                            onChange={(event) => handleStaffAssignmentChange(index, 'startTime', event.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-gray-600">To date</span>
                          <input
                            type="date"
                            value={assignment.endDate ? formatDateForInput(assignment.endDate) : ''}
                            onChange={(event) => handleStaffAssignmentChange(index, 'endDate', event.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-gray-600">To time</span>
                          <input
                            type="time"
                            value={assignment.endTime || ''}
                            onChange={(event) => handleStaffAssignmentChange(index, 'endTime', event.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                          />
                        </label>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_120px_auto]">
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-gray-600">Phone</span>
                          <input
                            value={assignment.phone || ''}
                            onChange={(event) => handleStaffAssignmentChange(index, 'phone', event.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-gray-600">Email</span>
                          <input
                            type="email"
                            value={assignment.email || ''}
                            onChange={(event) => handleStaffAssignmentChange(index, 'email', event.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-gray-600">Currency</span>
                          <select
                            value={assignment.salaryCurrency || 'CZK'}
                            onChange={(event) => handleStaffAssignmentChange(index, 'salaryCurrency', event.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                          >
                            <option value="CZK">CZK</option>
                            <option value="EUR">EUR</option>
                            <option value="USD">USD</option>
                            <option value="PLN">PLN</option>
                          </select>
                        </label>
                        <button
                          type="button"
                          onClick={() => removeStaffAssignment(index)}
                          className="mt-5 inline-flex h-10 items-center justify-center rounded-md border border-red-200 bg-white px-3 text-sm font-medium text-red-700 hover:bg-red-50"
                          title="Remove assignment"
                          aria-label="Remove assignment"
                        >
                          <Icon icon={FiX} className="h-4 w-4" />
                        </button>
                      </div>

                      <label className="mt-3 block">
                        <span className="mb-1 block text-xs font-medium text-gray-600">Notes</span>
                        <textarea
                          value={assignment.notes || ''}
                          onChange={(event) => handleStaffAssignmentChange(index, 'notes', event.target.value)}
                          rows={2}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                          placeholder="Arrival details, coverage, agreement notes..."
                        />
                      </label>
                    </div>
                  ))}

                  {(retreatFormData.retreatStaff || []).length === 0 && (
                    <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-sm text-gray-500">
                      No helpers or cooks assigned yet. Add a person from the Contact Book helper/cook directory.
                    </div>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="retreat-houseId">House:</label>
                <select
                  id="retreat-houseId"
                  name="houseId"
                  value={getHouseIdValue(retreatFormData.houseId)}
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
