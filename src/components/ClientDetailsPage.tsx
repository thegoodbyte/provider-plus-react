import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { clientsApi, paymentsApi, clientMedicalApi, bookingsApi, paymentRequestsApi, retreatsApi, medicalArtifactsApi } from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import AppleButton from './AppleButton';
import SearchablePaymentRequestSelect from './SearchablePaymentRequestSelect';
import EmailHistoryPanel from './EmailHistoryPanel';
import SubmissionNotificationsPage from './SubmissionNotificationsPage';
import NotificationCountBadge, { useNotificationCount } from './NotificationCountBadge';
import { MedicalArtifact, PaymentRequest } from '../types';
import { FiArrowLeft, FiCamera, FiEdit2, FiTrash2, FiUser, FiMapPin, FiCalendar, FiDollarSign, FiActivity, FiFileText, FiAlertCircle, FiPlus, FiMessageSquare, FiCheckSquare, FiHeart, FiEye, FiEyeOff, FiMail, FiBell } from 'react-icons/fi';
import MedicalRecordsManager from './MedicalRecordsManager';
import { formatCalendarDate, toDateInputValue } from '../utils/dateFormat';
import { CreateTaskDto, Task, taskService } from '../services/taskService';
import { cacheService } from '../services/cacheService';
import { TaskForm } from './Tasks/TaskForm';
import { TaskList } from './Tasks/TaskList';
import { buildClientMedicalArtifactInput, getClientEntryMedicalArtifacts, getClientMedicalArtifactUploadContext, upsertMedicalArtifact } from './clientMedicalArtifactUpload';
import { buildBookingCreateUrlFromPayment } from './bookingFromPayment.helpers';
import './ClientsGrid.css';

// Simple wrapper to fix TypeScript icon issues
const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

interface TabProps {
  label: React.ReactNode;
  icon: any;
  isActive: boolean;
  onClick: () => void;
}

const Tab: React.FC<TabProps> = ({ label, icon, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center space-x-2 rounded-lg border px-3 py-2 transition-colors sm:px-4 ${
      isActive
        ? 'border-blue-200 bg-blue-50 text-blue-700'
        : 'border-gray-200 bg-white text-gray-600 hover:border-blue-100 hover:bg-blue-50/40 hover:text-blue-700'
    }`}
  >
    <Icon icon={icon} className="w-4 h-4" />
    <span>{label}</span>
  </button>
);

const cropImageToProfileSquare = (file: File, size = 200): Promise<File> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        if (!context) {
          throw new Error('Image editor is not available in this browser.');
        }

        const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
        const sourceX = (image.naturalWidth - sourceSize) / 2;
        const sourceY = (image.naturalHeight - sourceSize) / 2;
        context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);

        canvas.toBlob((blob) => {
          URL.revokeObjectURL(objectUrl);
          if (!blob) {
            reject(new Error('Could not prepare profile picture.'));
            return;
          }
          const baseName = file.name.replace(/\.[^/.]+$/, '').trim() || 'profile-picture';
          resolve(new File([blob], `${baseName}-profile.jpg`, { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.9);
      } catch (cropError) {
        URL.revokeObjectURL(objectUrl);
        reject(cropError);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read this image file.'));
    };

    image.src = objectUrl;
  });
};

const ClientDetailsPage: React.FC = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [client, setClient] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [retreats, setRetreats] = useState<any[]>([]);
  const [retreatHeroUrls, setRetreatHeroUrls] = useState<Record<string, string>>({});
  const [medicalInfo, setMedicalInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => new URLSearchParams(location.search).get('tab') || 'overview');
  const [error, setError] = useState<string | null>(null);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<any | null>(null);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [showAddMedicalModal, setShowAddMedicalModal] = useState(false);
  const [showLoginPin, setShowLoginPin] = useState(false);
  const [resettingLoginPin, setResettingLoginPin] = useState(false);
  const [loginPinMessage, setLoginPinMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [medicalRecords, setMedicalRecords] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [newPayment, setNewPayment] = useState({
    date: '',
    type: '',
    amount: '',
    currency: 'EUR',
    retreatId: '',
    paymentRequestId: '',
    usdAmount: '',
    usdPreviewLoading: false,
    usdPreviewError: '',
    note: ''
  });
  const [newMedical, setNewMedical] = useState({
    type: '',
    title: '',
    notes: '',
    date: ''
  });
  const [showEKGUploadModal, setShowEKGUploadModal] = useState(false);
  const [showLiverPanelUploadModal, setShowLiverPanelUploadModal] = useState(false);
  const [medicalRecordsRefreshKey, setMedicalRecordsRefreshKey] = useState(0);
  const [ekgFiles, setEkgFiles] = useState<any[]>([]);
  const [liverPanelFiles, setLiverPanelFiles] = useState<any[]>([]);
  const [uploadingEKG, setUploadingEKG] = useState(false);
  const [uploadingLiverPanel, setUploadingLiverPanel] = useState(false);
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [uploadingProfilePicture, setUploadingProfilePicture] = useState(false);
  const [medicalArtifacts, setMedicalArtifacts] = useState<MedicalArtifact[]>([]);
  const notificationCount = useNotificationCount({ clientId });

  const handleResetLoginPin = async () => {
    if (!client?._id) return;
    if (!window.confirm('Generate a new client portal PIN?')) return;
    const notifyClient = window.confirm(
      'Notify the client by email?\n\nOK: change the PIN and send a localized email.\nCancel: change the PIN without sending an email.'
    );

    try {
      setResettingLoginPin(true);
      setLoginPinMessage(null);
      const response = await clientsApi.resetLoginPin(client._id, notifyClient);
      setClient((current: any) => current ? { ...current, loginPin: response.data.loginPin } : current);
      setLoginPinMessage(
        notifyClient
          ? (response.data.emailSent ? 'A new PIN was generated and emailed to the client in their preferred language.' : 'A new PIN was generated, but email delivery was not confirmed.')
          : 'A new PIN was generated without notifying the client.'
      );
    } catch (error: any) {
      console.error('Error resetting client PIN:', error);
      setLoginPinMessage(error?.response?.data?.message || error?.message || 'Failed to reset client PIN.');
    } finally {
      setResettingLoginPin(false);
    }
  };

  useEffect(() => {
    if (clientId) {
      fetchClientData();
    }
  }, [clientId]);

  useEffect(() => {
    const requestedTab = new URLSearchParams(location.search).get('tab');
    if (requestedTab) {
      setActiveTab(requestedTab);
    }

    const navigationState = location.state as { refreshClient?: boolean; client?: any } | null;
    if (navigationState?.client) {
      setClient(navigationState.client);
    }
    if (clientId && navigationState?.refreshClient) {
      fetchClientData();
    }
  }, [clientId, location.search, location.state]);

  useEffect(() => {
    const amount = Number(newPayment.amount);
    if (!amount || Number.isNaN(amount) || !newPayment.currency) {
      setNewPayment((current) => ({ ...current, usdAmount: '', usdPreviewError: '', usdPreviewLoading: false }));
      return;
    }

    let active = true;
    const timeout = window.setTimeout(async () => {
      try {
        setNewPayment((current) => ({ ...current, usdPreviewLoading: true, usdPreviewError: '' }));
        const response = await paymentsApi.convertToUsd(amount, newPayment.currency);
        if (active) {
          setNewPayment((current) => ({
            ...current,
            usdAmount: String(response.data.usd_amount ?? ''),
            usdPreviewLoading: false,
          }));
        }
      } catch (conversionError) {
        console.error('Error converting payment amount to USD:', conversionError);
        if (active) {
          setNewPayment((current) => ({
            ...current,
            usdAmount: '',
            usdPreviewLoading: false,
            usdPreviewError: 'USD conversion unavailable',
          }));
        }
      }
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [newPayment.amount, newPayment.currency]);

  useEffect(() => {
    let active = true;
    let objectUrl = '';

    const loadProfilePicture = async () => {
      if (!clientId || !client?.profilePictureS3Key) {
        setProfilePictureUrl(null);
        return;
      }

      try {
        const response = await clientsApi.getProfilePictureBlob(clientId);
        objectUrl = URL.createObjectURL(response.data as Blob);
        if (active) setProfilePictureUrl(objectUrl);
      } catch (pictureError) {
        console.error('Error loading profile picture:', pictureError);
        if (active) setProfilePictureUrl(null);
      }
    };

    loadProfilePicture();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [clientId, client?.profilePictureS3Key, client?.updatedAt]);

  const handleClientUpdate = (updatedClient: any) => {
    setClient(updatedClient);
  };

  const getId = (value: any) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return value._id || value.id || '';
  };

  const getDefaultRetreatId = () => getId(bookings[0]?.retreatId || bookings[0]?.retreat);

  const resetNewPayment = () => {
    setNewPayment({
      date: '',
      type: '',
      amount: '',
      currency: 'EUR',
      retreatId: getDefaultRetreatId(),
      paymentRequestId: '',
      usdAmount: '',
      usdPreviewLoading: false,
      usdPreviewError: '',
      note: ''
    });
  };

  const getBookingFullPrice = (booking: any) => (
    booking?.totalAmount || booking?.totalPrice || booking?.fullPrice || booking?.fullPriceQuote || ''
  );

  const getPaymentTypeFormValue = (paymentType?: string) => {
    const typeMap: Record<string, string> = {
      deposit_non_refundable: 'deposit',
      deposit_refundable: 'deposit',
      regular_payment: 'installment',
      balance_payment: 'full_payment',
      refund: 'refund',
      adjustment: 'installment',
    };
    return typeMap[paymentType || ''] || 'installment';
  };

  const getRetreatLabel = (retreat: any) => {
    if (!retreat) return 'Unknown retreat';
    return [
      retreat.code || retreat.retreatCode || retreat.name || retreat.title,
      retreat.location,
      retreat.startDate ? formatDate(retreat.startDate) : '',
    ].filter(Boolean).join(' - ') || getId(retreat);
  };

  const getRetreatById = (retreatId: string) => {
    if (!retreatId) return null;
    return retreats.find((retreat) => getId(retreat) === retreatId)
      || bookings.map((booking) => booking.retreat || booking.retreatId).find((retreat) => getId(retreat) === retreatId)
      || null;
  };

  const getBookingRetreat = (booking: any) => {
    const inlineRetreat = booking.retreat || (typeof booking.retreatId === 'object' ? booking.retreatId : null);
    const retreatId = getId(inlineRetreat || booking.retreatId);
    return inlineRetreat || getRetreatById(retreatId);
  };

  const isRetreatPast = (retreat: any) => {
    if (!retreat?.endDate) return false;
    const end = new Date(retreat.endDate);
    end.setHours(23, 59, 59, 999);
    return end.getTime() < Date.now();
  };

  const loadRetreatHeroUrls = async (bookingList: any[], retreatList: any[]) => {
    const retreatMap = new Map<string, any>();
    retreatList.forEach((retreat) => {
      const id = getId(retreat);
      if (id) retreatMap.set(id, retreat);
    });
    bookingList.forEach((booking) => {
      const retreat = booking.retreat || booking.retreatId;
      const id = getId(retreat);
      if (id && typeof retreat === 'object') retreatMap.set(id, retreat);
    });

    const entries = await Promise.all(Array.from(retreatMap.keys())
      .map(async (id) => {
        try {
          const response = await retreatsApi.getHeroImageUrl(id);
          return [id, response.data.heroImageUrl || ''] as const;
        } catch (error) {
          console.error('Error loading retreat hero image:', error);
          return [id, ''] as const;
        }
      }));

    setRetreatHeroUrls(Object.fromEntries(entries.filter(([, url]) => Boolean(url))));
  };

  const getRetreatOptions = () => {
    const options = new Map<string, any>();
    bookings.forEach((booking) => {
      const retreat = booking.retreat || booking.retreatId;
      const id = getId(retreat);
      if (id) options.set(id, retreat);
    });
    retreats.forEach((retreat) => {
      const id = getId(retreat);
      if (id && !options.has(id)) options.set(id, retreat);
    });
    return Array.from(options.entries()).map(([id, retreat]) => ({ id, label: getRetreatLabel(retreat) }));
  };

  const formatPaymentAmount = (payment: any) => {
    const amount = Number(payment.amount || 0);
    const currency = payment.currency || 'USD';
    return `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
  };

  const openAddPaymentModal = () => {
    setEditingPayment(null);
    resetNewPayment();
    setShowAddPaymentModal(true);
  };

  const openEditPaymentModal = (payment: any) => {
    setEditingPayment(payment);
    setNewPayment({
      date: toDateInputValue(payment.paymentDate),
      type: getPaymentTypeFormValue(payment.paymentType || payment.type),
      amount: payment.amount ? String(payment.amount) : '',
      currency: payment.currency || 'EUR',
      retreatId: getId(payment.retreatId) || getDefaultRetreatId(),
      paymentRequestId: getId(payment.paymentRequestId),
      usdAmount: payment.usd_amount ? String(payment.usd_amount) : '',
      usdPreviewLoading: false,
      usdPreviewError: '',
      note: payment.notes || payment.description || '',
    });
    setShowAddPaymentModal(true);
  };

  const getPaymentRequestUrl = (request: PaymentRequest) => (
    request.publicHash ? `https://ibogaspirit.com/clients/payments/deposit/v2/${request.publicHash}` : ''
  );

  const handleCreateDepositPaymentRequest = () => {
    if (!clientId) return;

    const selectedBooking = bookings[0];
    const retreatId = getId(selectedBooking?.retreatId || selectedBooking?.retreat);
    const params = new URLSearchParams({
      clientId,
      requestType: 'deposit',
      paymentType: 'Other',
    });

    if (retreatId) params.set('retreatId', retreatId);
    const fullPrice = getBookingFullPrice(selectedBooking);
    if (fullPrice) params.set('fullPrice', String(fullPrice));
    if (selectedBooking?.currency) params.set('currency', selectedBooking.currency);

    navigate(`/admin/payment-requests/new?${params.toString()}`);
  };

  const handlePaymentRequestSelect = (paymentRequestId: string, paymentRequest?: PaymentRequest) => {
    setNewPayment((current) => ({
      ...current,
      paymentRequestId,
      amount: paymentRequest ? String(paymentRequest.fullPriceQuote ?? paymentRequest.amountPaid ?? current.amount) : current.amount,
      currency: paymentRequest?.currency || current.currency,
      retreatId: paymentRequest ? getId(paymentRequest.retreatId) : current.retreatId,
      note: current.note || (paymentRequest ? `Payment for invoice ${paymentRequest.invoiceNumber || paymentRequest.display_id || ''}`.trim() : ''),
    }));
  };

  const handleSavePayment = async () => {
    if (!clientId || !newPayment.date || !newPayment.type || !newPayment.amount) return;

    const retreatId = newPayment.retreatId || getDefaultRetreatId();
    if (!retreatId) {
      alert('Please select a retreat for this payment.');
      return;
    }

    const paymentTypeMap: Record<string, string> = {
      deposit: 'deposit_non_refundable',
      full_payment: 'regular_payment',
      installment: 'regular_payment',
      refund: 'refund',
    };

    try {
      const paymentData = {
        clientId,
        retreatId,
        paymentRequestId: newPayment.paymentRequestId || undefined,
        amount: parseFloat(newPayment.amount),
        usd_amount: newPayment.usdAmount ? Number(newPayment.usdAmount) : undefined,
        currency: newPayment.currency as any,
        status: newPayment.type === 'refund' ? 'refunded' : 'completed',
        paymentMethod: 'other',
        paymentType: (paymentTypeMap[newPayment.type] || 'regular_payment') as any,
        description: newPayment.note || undefined,
        paymentDate: newPayment.date,
        notes: newPayment.note || undefined,
      } as any;

      if (editingPayment?._id) {
        await paymentsApi.update(editingPayment._id, paymentData);
      } else {
        await paymentsApi.create(paymentData);
      }

      await fetchClientData();
      resetNewPayment();
      setEditingPayment(null);
      setShowAddPaymentModal(false);
    } catch (paymentError) {
      console.error('Error saving payment:', paymentError);
      alert('Failed to save payment');
    }
  };

  const handleDeletePayment = async (payment: any) => {
    if (!payment?._id) return;
    if (!window.confirm('Delete this payment? This cannot be undone.')) return;

    try {
      await paymentsApi.delete(payment._id);
      await fetchClientData();
    } catch (paymentError) {
      console.error('Error deleting payment:', paymentError);
      alert('Failed to delete payment');
    }
  };

  const handleProfilePictureUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!clientId || !file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please choose an image file.');
      return;
    }

    try {
      setUploadingProfilePicture(true);
      const croppedFile = await cropImageToProfileSquare(file, 200);
      const response = await clientsApi.uploadProfilePicture(clientId, croppedFile);
      setClient(response.data.client);
    } catch (uploadError: any) {
      console.error('Error uploading profile picture:', uploadError);
      alert(uploadError?.response?.data?.message || uploadError?.message || 'Failed to upload profile picture.');
    } finally {
      setUploadingProfilePicture(false);
    }
  };

  const loadClientTasks = async () => {
    if (!clientId) return;

    try {
      setTaskError(null);
      const taskData = await taskService.getTasks({
        clientId,
        sortBy: 'dueDate',
        sortOrder: 'asc',
      });
      setTasks(taskData);
    } catch (taskLoadError: any) {
      console.error('Error loading client tasks:', taskLoadError);
      setTaskError(taskLoadError?.message || 'Failed to load client tasks');
      setTasks([]);
    }
  };

  const fetchClientData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch all data in parallel
      const [clientResponse, paymentsResponse, paymentRequestsResponse, bookingsResponse, retreatsResponse, medicalResponse, artifactsResponse] = await Promise.all([
        clientsApi.getOne(clientId!),
        paymentsApi.getByClient(clientId!).catch(() => ({ data: [] })),
        paymentRequestsApi.getByClient(clientId!).catch(() => ({ data: [] })),
        bookingsApi.getByClient(clientId!).catch(() => ({ data: [] })),
        retreatsApi.getAll().catch(() => ({ data: [] })),
        clientMedicalApi.getByClient(clientId!).catch(() => ({ data: null })),
        medicalArtifactsApi.getAll({ clientId: clientId! }).catch(() => ({ data: [] }))
      ]);

      setClient(clientResponse.data);
      setPayments(paymentsResponse.data || []);
      setPaymentRequests(paymentRequestsResponse.data || []);
      const bookingData = bookingsResponse.data || [];
      const retreatData = retreatsResponse.data || [];
      setBookings(bookingData);
      setRetreats(retreatData);
      await loadRetreatHeroUrls(bookingData, retreatData);
      // Artifact uploads are valid medical information even when no legacy ClientMedical row exists.
      // Keep the section mounted so newly uploaded EKG/liver artifacts are always visible.
      setMedicalInfo(medicalResponse.data || ({} as any));
      setMedicalArtifacts(artifactsResponse.data || []);
      await loadClientTasks();
    } catch (error: any) {
      console.error('Error fetching client data:', error);
      setError('Failed to load client data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTask = () => {
    setEditingTask(null);
    setTaskError(null);
    setShowAddTaskModal(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setTaskError(null);
    setShowAddTaskModal(true);
  };

  const handleSaveTask = async (taskData: CreateTaskDto) => {
    try {
      setTaskError(null);
      const payload: CreateTaskDto = {
        ...taskData,
        type: taskData.type || 'client',
        clientId: taskData.clientId || clientId,
      };

      if (editingTask?.id) {
        await taskService.updateTask(editingTask.id, payload);
      } else {
        await taskService.createTask(payload);
      }

      setShowAddTaskModal(false);
      setEditingTask(null);
      await loadClientTasks();
    } catch (taskSaveError: any) {
      console.error('Error saving client task:', taskSaveError);
      setTaskError(taskSaveError?.message || 'Failed to save task');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('Delete this task? This cannot be undone.')) return;

    try {
      setTaskError(null);
      await taskService.deleteTask(taskId);
      await loadClientTasks();
    } catch (taskDeleteError: any) {
      console.error('Error deleting client task:', taskDeleteError);
      setTaskError(taskDeleteError?.message || 'Failed to delete task');
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      setTaskError(null);
      await taskService.completeTask(taskId);
      await loadClientTasks();
    } catch (taskCompleteError: any) {
      console.error('Error completing client task:', taskCompleteError);
      setTaskError(taskCompleteError?.message || 'Failed to complete task');
    }
  };

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return 'N/A';
    return formatCalendarDate(date);
  };

  const getStatusBadge = (status: string) => {
    const statusColors: any = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      potential: 'bg-yellow-100 text-yellow-800',
      screening: 'bg-blue-100 text-blue-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      completed: 'bg-purple-100 text-purple-800',
      booked: 'bg-indigo-100 text-indigo-800',
      blacklisted: 'bg-red-100 text-red-800'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        statusColors[status] || 'bg-gray-100 text-gray-800'
      }`}>
        {status || 'unknown'}
      </span>
    );
  };

  const getLanguageLabel = (language?: string) => {
    const labels: Record<string, string> = {
      EN: 'English',
      CZ: 'Czech',
      PL: 'Polish',
      RU: 'Russian',
      OTHER: 'Other',
    };
    return labels[language || ''] || 'Not set';
  };

  const screeningData = client?.screeningData || {};
  const getScreeningValue = (...keys: string[]) => {
    for (const key of keys) {
      const value = screeningData?.[key] ?? client?.[key];
      if (value !== undefined && value !== null && value !== '') return value;
    }
    return '';
  };
  const screeningYearOfBirth = getScreeningValue('year_of_birth', 'yearOfBirth');

  const humanizeScreeningKey = (key: string) => (
    key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (letter) => letter.toUpperCase())
  );

  const formatScreeningValue = (value: any) => {
    if (!value || typeof value !== 'object') return value;

    const alcoholLabels: Record<string, string> = {
      wine: 'Wine',
      beer: 'Beer',
      whiskey: 'Whiskey',
      vodka: 'Vodka',
    };
    const hasAlcoholEntries = Object.keys(alcoholLabels).some((key) => value[key]?.selected);
    if (hasAlcoholEntries) {
      return Object.entries(alcoholLabels)
        .filter(([key]) => Boolean(value[key]?.selected))
        .map(([key, label]) => {
          const entry = value[key] || {};
          const details = [entry.frequency, entry.amount].filter(Boolean).join(', ');
          return details ? `${label}: ${details}` : label;
        })
        .join('\n');
    }

    const labels: Record<string, string> = {
      vitaminD: 'Vitamin D',
      vitaminB12: 'Vitamin B12',
      vitaminC: 'Vitamin C',
      omega3: 'Omega-3',
      magnesium: 'Magnesium',
      zinc: 'Zinc',
      iron: 'Iron',
      probiotics: 'Probiotics',
      multivitamin: 'Multivitamin',
      kratom: 'Kratom',
      creatine: 'Creatine',
      creatineFrequency: 'Creatine frequency',
      creatineGrams: 'Creatine grams',
      ashwagandha: 'Ashwagandha',
      potassium: 'Potassium',
      other: 'Other',
    };
    const selected = Object.entries(labels)
      .filter(([key]) => Boolean(value[key]))
      .map(([, label]) => label);
    const details = value.details || value.otherDetails;
    const extraValues = Object.entries(value)
      .filter(([key, entryValue]) => !labels[key] && !['details', 'otherDetails'].includes(key) && Boolean(entryValue))
      .map(([key, entryValue]) => `${humanizeScreeningKey(key)}: ${entryValue}`);
    return [
      selected.length ? `Selected: ${selected.join(', ')}` : '',
      details,
      ...extraValues,
    ].filter(Boolean).join('\n') || '';
  };

  const formatNicotineSummary = () => {
    const parts = [
      getScreeningValue('nicotineCurrent') ? 'Currently smoking / vaping' : '',
      getScreeningValue('nicotineWantsToQuit') ? 'Wants to quit' : '',
      getScreeningValue('nicotineSince') ? `Smoking since: ${getScreeningValue('nicotineSince')}` : '',
      getScreeningValue('nicotinePerDay') ? `Per day: ${getScreeningValue('nicotinePerDay')}` : '',
      getScreeningValue('nicotineNotes'),
    ].filter(Boolean);
    return parts.join('\n');
  };

  const getBooleanDetailValue = (flagKey: string, detailKey: string) => {
    const flag = getScreeningValue(flagKey);
    const details = getScreeningValue(detailKey);
    if (details) return details;
    if (flag === true || flag === 'true' || flag === 'yes' || flag === 'Yes') return 'Yes';
    return '';
  };

  const renderInlineFormattedText = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).filter(Boolean);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('_') && part.endsWith('_')) {
        return <em key={index}>{part.slice(1, -1)}</em>;
      }
      return <React.Fragment key={index}>{part}</React.Fragment>;
    });
  };

  const renderFormattedScreeningText = (value: string) => {
    const lines = value.split('\n');
    const elements: React.ReactNode[] = [];
    let listItems: string[] = [];
    let orderedItems: string[] = [];

    const flushLists = () => {
      if (listItems.length) {
        elements.push(
          <ul key={`ul-${elements.length}`} className="ml-5 list-disc space-y-1">
            {listItems.map((item, index) => <li key={index}>{renderInlineFormattedText(item)}</li>)}
          </ul>
        );
        listItems = [];
      }
      if (orderedItems.length) {
        elements.push(
          <ol key={`ol-${elements.length}`} className="ml-5 list-decimal space-y-1">
            {orderedItems.map((item, index) => <li key={index}>{renderInlineFormattedText(item)}</li>)}
          </ol>
        );
        orderedItems = [];
      }
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) {
        flushLists();
        elements.push(<div key={`blank-${index}`} className="h-2" />);
        return;
      }
      if (trimmed.startsWith('- ')) {
        if (orderedItems.length) flushLists();
        listItems.push(trimmed.slice(2));
        return;
      }
      const numberedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
      if (numberedMatch) {
        if (listItems.length) flushLists();
        orderedItems.push(numberedMatch[1]);
        return;
      }

      flushLists();
      if (trimmed.startsWith('### ')) {
        elements.push(<h4 key={index} className="font-semibold text-gray-800">{renderInlineFormattedText(trimmed.slice(4))}</h4>);
      } else if (trimmed.startsWith('> ')) {
        elements.push(<blockquote key={index} className="border-l-2 border-gray-300 pl-3 text-gray-600">{renderInlineFormattedText(trimmed.slice(2))}</blockquote>);
      } else {
        elements.push(<p key={index}>{renderInlineFormattedText(line)}</p>);
      }
    });

    flushLists();
    return <div className="space-y-2">{elements}</div>;
  };

  const renderScreeningField = (label: string, value: any) => {
    const formattedValue = formatScreeningValue(value);
    if (!formattedValue) return null;

    return (
      <div>
        <h3 className="text-sm font-medium text-gray-500 mb-2">{label}</h3>
        <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded whitespace-pre-wrap">
          {typeof formattedValue === 'string' ? renderFormattedScreeningText(formattedValue) : formattedValue}
        </div>
      </div>
    );
  };

  const renderScreeningGrid = (items: Array<{ label: string; value: any }>) => {
    const visibleItems = items.filter((item) => Boolean(formatScreeningValue(item.value)));
    if (visibleItems.length === 0) return null;

    return (
      <div className="grid gap-4 md:grid-cols-2">
        {visibleItems.map((item) => (
          <React.Fragment key={item.label}>
            {renderScreeningField(item.label, item.value)}
          </React.Fragment>
        ))}
      </div>
    );
  };

  const screeningFileUrl = getScreeningValue('handwritingImageUrl');
  const screeningFileName = screeningFileUrl ? decodeURIComponent(screeningFileUrl.split('/').pop() || 'Screening file') : '';
  const screeningFileLower = screeningFileName.toLowerCase();
  const isScreeningImage = /\.(png|jpe?g|gif|webp|bmp|heic|heif)$/i.test(screeningFileLower);
  const isScreeningPdf = /\.pdf($|\?)/i.test(screeningFileLower);
  const hasScreeningDetails = [
    'mainIntent',
    'whySeekingIboga',
    'riskNotes',
    'whatToChange',
    'heartCondition',
    'heartConditions',
    'liverCondition',
    'liverConditions',
    'asthmaCondition',
    'asthmaConditions',
    'medications',
    'currentMedications',
    'bloodPressure',
    'bloodPressureIssues',
    'bloodPressureStatus',
    'bloodPressureValue',
    'vitaminsSupplements',
    'age',
    'screeningDate',
    'riskLevel',
    'phoneNumber',
    'childhood',
    'sexualAbuse',
    'sexualAbuseDetails',
    'physicalAbuse',
    'physicalAbuseDetails',
    'psychologicalAbuse',
    'psychologicalAbuseDetails',
    'ssris',
    'drugsHistory',
    'marijuana',
    'marijuanaDetails',
    'cocaine',
    'cocaineDetails',
    'meth',
    'methDetails',
    'heroin',
    'heroinDetails',
    'benzos',
    'benzosDetails',
    'opioids',
    'opioidsDetails',
    'otherDrugs',
    'otherDrugsDetails',
    'alcoholSober',
    'alcoholUse',
    'alcoholHistory',
    'healthComplications',
    'ayahuasca',
    'ayahuascaDetails',
    'iboga',
    'ibogaDetails',
    'psilocybin',
    'psilocybinDetails',
    'bufo',
    'bufoDetails',
    'kambo',
    'kamboDetails',
    'sanPedro',
    'sanPedroDetails',
    'mescaline',
    'mescalineDetails',
    'dmt',
    'dmtDetails',
    'ketamine',
    'ketamineDetails',
    'mdma',
    'mdmaDetails',
    'sassafras',
    'sassafrasDetails',
    'amanitaMochomur',
    'amanitaMochomurDetails',
    'rappe',
    'rappeDetails',
    'otherPlantMedicine',
    'otherPlantMedicineDetails',
    'desiredRetreat',
    'quotedPrice',
    'screenedBy',
    'status',
    'generalNotes',
    'notes',
    'handwritingImageUrl',
  ].some((key) => Boolean(getScreeningValue(key)));

  const uploadClientMedicalArtifact = async (
    files: File[],
    artifactType: NonNullable<MedicalArtifact['artifactType']>,
  ) => {
    if (!clientId || files.length === 0) return;

    const isEkg = artifactType === 'ekg';
    const setUploading = isEkg ? setUploadingEKG : setUploadingLiverPanel;
    const setFiles = isEkg ? setEkgFiles : setLiverPanelFiles;
    const closeModal = isEkg ? setShowEKGUploadModal : setShowLiverPanelUploadModal;
    const title = isEkg ? 'Entry EKG' : 'Entry Liver Panel';
    const documentType = isEkg ? 'EKG' : 'Liver';
    const context = getClientMedicalArtifactUploadContext(bookings, medicalInfo);

    setUploading(true);

    try {
      const artifactInput = buildClientMedicalArtifactInput({
        clientId,
        title,
        artifactType,
        documentType,
        context,
      });
      const created = await medicalArtifactsApi.create(artifactInput);
      if (!created.data?._id) {
        throw new Error('Medical artifact was created without an id.');
      }
      const uploadResponse = await medicalArtifactsApi.uploadFiles(created.data._id, files);
      const uploadedArtifact = uploadResponse.data?.artifact as MedicalArtifact | undefined;
      if (uploadedArtifact) {
        // Show the persisted artifact immediately; do not depend on a second request to update the page.
        setMedicalArtifacts((current) => upsertMedicalArtifact(current, uploadedArtifact));
      }

      closeModal(false);
      setFiles([]);
      cacheService.clearPattern('medical:');
      cacheService.clearPattern('medical-artifacts:');
      setMedicalRecordsRefreshKey((value) => value + 1);
      // Reconcile with the server and await it. If this refresh fails, retain the successful upload response above.
      try {
        const refreshed = await medicalArtifactsApi.getAll({ clientId });
        setMedicalArtifacts(refreshed.data || (uploadedArtifact ? [uploadedArtifact] : []));
      } catch (refreshError) {
        console.warn(`Uploaded ${artifactType}, but could not refresh the artifact list:`, refreshError);
      }
    } catch (error) {
      console.error(`Error uploading ${artifactType} files:`, error);
      alert('Error uploading files. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleEKGFileUpload = async (files: File[]) => {
    return uploadClientMedicalArtifact(files, 'ekg');
  };

  const handleLiverPanelFileUpload = async (files: File[]) => {
    return uploadClientMedicalArtifact(files, 'liver_panel');
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading client details..." />;
  }

  if (error || !client) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          <Icon icon={FiAlertCircle} className="inline w-5 h-5 mr-2" />
          {error || 'Client not found'}
        </div>
        <AppleButton onClick={() => navigate(-1)} className="mt-4">
          <Icon icon={FiArrowLeft} className="w-4 h-4 mr-2" />
          Go Back
        </AppleButton>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 h-full overflow-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="relative h-[96px] w-[96px] shrink-0 overflow-hidden rounded-full border border-gray-200 bg-gray-100 shadow-sm sm:h-[160px] sm:w-[160px]">
              {profilePictureUrl ? (
                <img src={profilePictureUrl} alt={`${client.firstName} ${client.lastName}`} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-gray-400">
                  <Icon icon={FiUser} className="h-10 w-10" />
                </div>
              )}
              <label className="absolute inset-x-0 bottom-0 flex cursor-pointer items-center justify-center gap-1 bg-black/55 px-2 py-2 text-xs font-medium text-white transition hover:bg-black/70">
                <Icon icon={FiCamera} className="h-3.5 w-3.5" />
                {uploadingProfilePicture ? 'Uploading' : 'Photo'}
                <input type="file" accept="image/*" onChange={handleProfilePictureUpload} className="hidden" disabled={uploadingProfilePicture} />
              </label>
            </div>
            <div className="min-w-0 flex-1 pt-1">
              <button onClick={() => navigate(-1)} className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900">
                <Icon icon={FiArrowLeft} className="h-4 w-4" />
                Back
              </button>
              <div className="text-xl font-semibold leading-none text-gray-900 sm:text-2xl">
                Client ID: {client.display_id || client._id?.substring(0, 8)}
              </div>
              <h1 className="mt-2 break-words text-2xl font-semibold leading-tight text-gray-900 sm:text-4xl">
                {client.firstName} {client.lastName}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {getStatusBadge(client.workflowStatus || client.status)}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => navigate(`/admin/clients/${clientId}/screening`)}
                  className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Icon icon={FiPlus} className="h-4 w-4" />
                  Screening
                </button>
                <button
                  onClick={() => navigate(`/admin/clients/${clientId}/edit`)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  aria-label="Edit client"
                  title="Edit client"
                >
                  <Icon icon={FiEdit2} className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6 overflow-x-auto">
        <div className="flex min-w-max space-x-3 sm:space-x-6 pb-2">
          <Tab
            label="Overview"
            icon={FiUser}
            isActive={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
          />
          <Tab
            label="Screening Info"
            icon={FiFileText}
            isActive={activeTab === 'screening'}
            onClick={() => setActiveTab('screening')}
          />
          <Tab
            label="Medical Info"
            icon={FiActivity}
            isActive={activeTab === 'medical'}
            onClick={() => setActiveTab('medical')}
          />
          <Tab
            label="Bookings"
            icon={FiCalendar}
            isActive={activeTab === 'bookings'}
            onClick={() => setActiveTab('bookings')}
          />
          <Tab
            label="Payments"
            icon={FiDollarSign}
            isActive={activeTab === 'payments'}
            onClick={() => setActiveTab('payments')}
          />
          <Tab
            label="Emails"
            icon={FiMail}
            isActive={activeTab === 'emails'}
            onClick={() => setActiveTab('emails')}
          />
          <Tab
            label={<span className="inline-flex items-center">Notifications <NotificationCountBadge count={notificationCount} /></span> as any}
            icon={FiBell}
            isActive={activeTab === 'notifications'}
            onClick={() => setActiveTab('notifications')}
          />
          <Tab
            label="Notes"
            icon={FiMessageSquare}
            isActive={activeTab === 'notes'}
            onClick={() => setActiveTab('notes')}
          />
          <Tab
            label={`Tasks (${tasks.length})`}
            icon={FiCheckSquare}
            isActive={activeTab === 'tasks'}
            onClick={() => setActiveTab('tasks')}
          />
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
        {activeTab === 'overview' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Personal Information</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-3">Basic Details</h3>
                <dl className="space-y-2">
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt className="text-sm text-gray-600">Full Name:</dt>
                    <dd className="text-sm font-medium">{client.firstName} {client.lastName}</dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt className="text-sm text-gray-600">Phone:</dt>
                    <dd className="text-sm font-medium">{client.phone || 'N/A'}</dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt className="text-sm text-gray-600">Email:</dt>
                    <dd className="text-sm font-medium">{client.email || 'N/A'}</dd>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <dt className="text-sm text-gray-600">Client Portal Login PIN:</dt>
                    <dd className="flex items-center gap-2 text-sm font-medium">
                      <span className="font-mono tracking-wider">
                        {client.loginPin ? (showLoginPin ? client.loginPin : '••••••') : 'Not set'}
                      </span>
                      {client.loginPin && (
                        <button
                          type="button"
                          onClick={() => setShowLoginPin((current) => !current)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          aria-label={showLoginPin ? 'Hide client portal login PIN' : 'Reveal client portal login PIN'}
                          title={showLoginPin ? 'Hide PIN' : 'Reveal PIN'}
                        >
                          <Icon icon={showLoginPin ? FiEyeOff : FiEye} className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleResetLoginPin}
                        disabled={resettingLoginPin}
                        className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                      >
                        {resettingLoginPin ? 'Resetting...' : 'Reset PIN'}
                      </button>
                    </dd>
                  </div>
                  {loginPinMessage && (
                    <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                      {loginPinMessage}
                    </div>
                  )}
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt className="text-sm text-gray-600">Country:</dt>
                    <dd className="text-sm font-medium">{client.country || 'N/A'}</dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt className="text-sm text-gray-600">Preferred Language:</dt>
                    <dd className="text-sm font-medium">{getLanguageLabel(client.language)}</dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt className="text-sm text-gray-600">Referral:</dt>
                    <dd className="text-sm font-medium">{client.source || 'N/A'}</dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt className="text-sm text-gray-600">City:</dt>
                    <dd className="text-sm font-medium">{client.city || 'N/A'}</dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt className="text-sm text-gray-600">Address:</dt>
                    <dd className="text-sm font-medium">{client.address || 'N/A'}</dd>
                  </div>
                </dl>
              </div>

              <div className="hidden lg:block">
                <h3 className="text-sm font-medium text-gray-500 mb-3">Status & Dates</h3>
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-600">Status:</dt>
                    <dd>{getStatusBadge(client.status)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-600">Workflow Status:</dt>
                    <dd>{getStatusBadge(client.workflowStatus)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-600">Priority:</dt>
                    <dd className="text-sm font-medium">{client.priority || 'medium'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-600">Initial Contact:</dt>
                    <dd className="text-sm font-medium">{formatDate(client.initialContactDate)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-600">Created:</dt>
                    <dd className="text-sm font-medium">{formatDate(client.createdAt)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-600">Last Updated:</dt>
                    <dd className="text-sm font-medium">{formatDate(client.updatedAt)}</dd>
                  </div>
                </dl>
              </div>
            </div>

            <details className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-3 lg:hidden">
              <summary className="cursor-pointer text-sm font-semibold text-gray-700">More details</summary>
              <dl className="mt-3 space-y-2">
                <div className="flex justify-between gap-3">
                  <dt className="text-sm text-gray-600">Status:</dt>
                  <dd>{getStatusBadge(client.status)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-sm text-gray-600">Workflow:</dt>
                  <dd>{getStatusBadge(client.workflowStatus)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-sm text-gray-600">Priority:</dt>
                  <dd className="text-sm font-medium">{client.priority || 'medium'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-sm text-gray-600">Initial Contact:</dt>
                  <dd className="text-sm font-medium">{formatDate(client.initialContactDate)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-sm text-gray-600">Created:</dt>
                  <dd className="text-sm font-medium">{formatDate(client.createdAt)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-sm text-gray-600">Last Updated:</dt>
                  <dd className="text-sm font-medium">{formatDate(client.updatedAt)}</dd>
                </div>
              </dl>
            </details>

            {client.notes && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Notes</h3>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">{client.notes}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'screening' && (
          <div>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold">Screening Information</h2>
              <div className="flex gap-2">
                {hasScreeningDetails && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!clientId) return;
                      clientsApi.downloadScreeningPdf(clientId)
                        .then((response) => {
                          const blob = response.data as Blob;
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.href = url;
                          link.target = '_blank';
                          link.rel = 'noopener noreferrer';
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          window.setTimeout(() => URL.revokeObjectURL(url), 1000);
                        })
                        .catch((error) => {
                          console.error('Error downloading screening PDF:', error);
                        });
                    }}
                    className="inline-flex h-10 px-3 items-center justify-center rounded-md bg-green-600 text-white shadow-sm hover:bg-green-700"
                    aria-label="Download screening PDF"
                    title="Download screening PDF"
                  >
                    <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    PDF
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => navigate(`/admin/clients/${clientId}/screening`)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-blue-600 text-white shadow-sm hover:bg-blue-700"
                  aria-label={hasScreeningDetails ? 'Edit screening' : 'Add screening'}
                  title={hasScreeningDetails ? 'Edit screening' : 'Add screening'}
                >
                  <Icon icon={hasScreeningDetails ? FiEdit2 : FiPlus} className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Screening Status</h3>
                <div className="flex items-center space-x-4">
                  {getStatusBadge(client.workflowStatus)}
                  {client.rejectionReason && (
                    <p className="text-sm text-red-600">Rejection Reason: {client.rejectionReason}</p>
                  )}
                </div>
              </div>

              {!hasScreeningDetails && (
                <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
                  No screening details have been saved for this client yet.
                </div>
              )}

              {renderScreeningGrid([
                { label: 'Screening Date', value: getScreeningValue('screeningDate') ? formatDate(getScreeningValue('screeningDate')) : '' },
                { label: 'Year of Birth', value: screeningYearOfBirth },
                { label: 'Age', value: getScreeningValue('age') },
                { label: 'Risk Level', value: getScreeningValue('riskLevel') },
                { label: 'Screening Form Status', value: getScreeningValue('status') },
                { label: 'Desired Retreat', value: getScreeningValue('desiredRetreat') },
                { label: 'Quoted Price', value: getScreeningValue('quotedPrice') },
                { label: 'Screened By', value: getScreeningValue('screenedBy') },
                { label: 'Phone Number', value: getScreeningValue('phoneNumber') },
              ])}

              {renderScreeningGrid([
                { label: 'Why Seeking Iboga', value: getScreeningValue('whySeekingIboga', 'mainIntent') },
                { label: 'What to Change / Risk Notes', value: getScreeningValue('whatToChange', 'riskNotes') },
                { label: 'Childhood', value: getScreeningValue('childhood') },
                { label: 'Observations / General Notes', value: getScreeningValue('observations', 'generalNotes', 'notes') },
              ])}

        {renderScreeningGrid([
          { label: 'Sexual Abuse', value: getBooleanDetailValue('sexualAbuse', 'sexualAbuseDetails') },
          { label: 'Physical Abuse', value: getBooleanDetailValue('physicalAbuse', 'physicalAbuseDetails') },
          { label: 'Psychological Abuse', value: getBooleanDetailValue('psychologicalAbuse', 'psychologicalAbuseDetails') },
          { label: 'Depression diagnosed since', value: getScreeningValue('depressionSince') },
          { label: 'Depression details', value: getBooleanDetailValue('depression', 'depressionDetails') },
          { label: 'Anxiety diagnosed since', value: getScreeningValue('anxietySince') },
          { label: 'Anxiety details', value: getBooleanDetailValue('anxiety', 'anxietyDetails') },
          { label: 'In care of psychiatrist', value: getBooleanDetailValue('psychiatristCare', 'psychiatristCareDetails') },
        ])}

              {renderScreeningGrid([
                { label: 'Heart', value: getScreeningValue('heartConditions', 'heartCondition') },
                { label: 'Liver', value: getScreeningValue('liverConditions', 'liverCondition') },
                { label: 'Asthma', value: getScreeningValue('asthmaConditions', 'asthmaCondition') },
                { label: 'Current Medications', value: getScreeningValue('currentMedications', 'medications') },
                { label: 'SSRIs', value: getScreeningValue('ssris') },
                { label: 'Blood Pressure', value: getScreeningValue('bloodPressureIssues', 'bloodPressure') },
                { label: 'Blood Pressure Details', value: [getScreeningValue('bloodPressureStatus'), getScreeningValue('bloodPressureValue')].filter(Boolean).join(' - ') },
                { label: 'Sober', value: getScreeningValue('alcoholSober') ? 'Yes' : '' },
                { label: 'Alcohol Use', value: getScreeningValue('alcoholSober') ? 'Sober / does not drink alcohol' : getScreeningValue('alcoholUse') },
                { label: 'Alcohol History', value: getScreeningValue('alcoholHistory') },
                { label: 'Health Complications', value: getScreeningValue('healthComplications') },
                { label: 'EKG Requested', value: getScreeningValue('ekgRequested') ? 'Yes' : 'No' },
                { label: 'Liver Panel Requested', value: getScreeningValue('liverPanelRequested') ? 'Yes' : 'No' },
                { label: 'Medical Tests Details', value: getScreeningValue('medicalTestsDetails') },
                { label: 'Vitamins & Supplements', value: getScreeningValue('vitaminsSupplements') },
              ])}

              {renderScreeningGrid([
                { label: 'Drug History', value: getScreeningValue('drugsHistory') },
                { label: 'Nicotine', value: formatNicotineSummary() },
                { label: 'Marijuana', value: getBooleanDetailValue('marijuana', 'marijuanaDetails') },
                { label: 'Cocaine', value: getBooleanDetailValue('cocaine', 'cocaineDetails') },
                { label: 'Meth', value: getBooleanDetailValue('meth', 'methDetails') },
                { label: 'Heroin', value: getBooleanDetailValue('heroin', 'heroinDetails') },
                { label: 'Benzos', value: getBooleanDetailValue('benzos', 'benzosDetails') },
                { label: 'Opioids', value: getBooleanDetailValue('opioids', 'opioidsDetails') },
                { label: 'Other drugs', value: getBooleanDetailValue('otherDrugs', 'otherDrugsDetails') },
              ])}

              {renderScreeningGrid([
                { label: 'Ayahuasca', value: getBooleanDetailValue('ayahuasca', 'ayahuascaDetails') },
                { label: 'Iboga', value: getBooleanDetailValue('iboga', 'ibogaDetails') },
                { label: 'Psilocybin', value: getBooleanDetailValue('psilocybin', 'psilocybinDetails') },
                { label: 'Bufo', value: getBooleanDetailValue('bufo', 'bufoDetails') },
                { label: 'Kambo', value: getBooleanDetailValue('kambo', 'kamboDetails') },
                { label: 'San Pedro', value: getBooleanDetailValue('sanPedro', 'sanPedroDetails') },
                { label: 'Mescaline', value: getBooleanDetailValue('mescaline', 'mescalineDetails') },
                { label: 'DMT', value: getBooleanDetailValue('dmt', 'dmtDetails') },
                { label: 'Ketamine', value: getBooleanDetailValue('ketamine', 'ketamineDetails') },
                { label: 'MDMA', value: getBooleanDetailValue('mdma', 'mdmaDetails') },
                { label: 'Sassafras', value: getBooleanDetailValue('sassafras', 'sassafrasDetails') },
                { label: 'Amanita mochomur', value: getBooleanDetailValue('amanitaMochomur', 'amanitaMochomurDetails') },
                { label: 'Rappe', value: getBooleanDetailValue('rappe', 'rappeDetails') },
                { label: 'Other Plant Medicine', value: getBooleanDetailValue('otherPlantMedicine', 'otherPlantMedicineDetails') },
              ])}

              {screeningFileUrl && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Uploaded Screening File</h3>
                  <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
                    <div className="flex flex-col gap-2 border-b border-gray-100 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                      <span className="truncate text-sm font-medium text-gray-900">{screeningFileName}</span>
                      <a href={screeningFileUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-blue-700 hover:text-blue-800">
                        Open in new tab
                      </a>
                    </div>
                    <div className="flex min-h-[420px] items-center justify-center bg-gray-50">
                      {isScreeningImage && (
                        <img
                          src={screeningFileUrl}
                          alt={screeningFileName}
                          className="max-h-[620px] max-w-full object-contain"
                        />
                      )}
                      {isScreeningPdf && (
                        <iframe
                          src={screeningFileUrl}
                          title={screeningFileName}
                          className="h-[620px] w-full border-0 bg-white"
                        />
                      )}
                      {!isScreeningImage && !isScreeningPdf && (
                        <div className="px-4 text-sm text-gray-600">
                          Preview unavailable for this file type. Use "Open in new tab" to view it.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {client.followUpDate && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Follow-up Date</h3>
                  <p className="text-sm text-gray-700">{formatDate(client.followUpDate)}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'medical' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Medical Information</h2>
              <AppleButton
                onClick={() => setShowAddMedicalModal(true)}
                className="apple-button-primary px-3 py-2"
              >
                <Icon icon={FiPlus} className="w-4 h-4 mr-2" />
                Add Medical Record
              </AppleButton>
            </div>

            {/* Existing Medical Info */}
            {medicalInfo ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-3">Health Conditions</h3>
                    <dl className="space-y-2">
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-600">Heart Conditions:</dt>
                        <dd className="text-sm font-medium">{medicalInfo.heartConditions || 'N/A'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-600">Liver Conditions:</dt>
                        <dd className="text-sm font-medium">{medicalInfo.liverConditions || 'N/A'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-600">Blood Pressure:</dt>
                        <dd className="text-sm font-medium">{medicalInfo.bloodPressure || 'N/A'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-600">Allergies:</dt>
                        <dd className="text-sm font-medium">{medicalInfo.allergies || 'None'}</dd>
                      </div>
                    </dl>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-3">Medications</h3>
                    <dl className="space-y-2">
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-600">Current Medications:</dt>
                        <dd className="text-sm font-medium">{medicalInfo.currentMedications || 'None'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-600">Supplements:</dt>
                        <dd className="text-sm font-medium">{medicalInfo.vitaminsSupplements || 'None'}</dd>
                      </div>
                    </dl>
                  </div>
                </div>

                {medicalInfo.medicalIssues && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Medical Issues</h3>
                    <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">{medicalInfo.medicalIssues}</p>
                  </div>
                )}

                {/* EKG and Liver Panel Test Sections - Entry Documents */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                  {/* EKG Test Section */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                      <Icon icon={FiActivity} className="w-4 h-4 mr-2" />
                      Entry EKG Test
                    </h3>
                    {(() => {
                      // Find entry EKG artifacts from medical artifacts
                      const entryEkgArtifacts = getClientEntryMedicalArtifacts(medicalArtifacts, clientId || '', 'ekg', 'EKG');

                      const latestEkg = entryEkgArtifacts[0];
                      const hasEkg = !!latestEkg;

                      return (
                        <>
                          <dl className="space-y-2">
                            <div className="flex justify-between">
                              <dt className="text-xs text-gray-600">Status:</dt>
                              <dd className="text-xs font-medium">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  hasEkg ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {hasEkg ? 'Received' : 'Pending'}
                                </span>
                              </dd>
                            </div>
                            {latestEkg && (
                              <>
                                <div className="flex justify-between">
                                  <dt className="text-xs text-gray-600">Received:</dt>
                                  <dd className="text-xs font-medium">
                                    {new Date(latestEkg.receivedAt || latestEkg.createdAt || '').toLocaleDateString()}
                                  </dd>
                                </div>
                                {latestEkg.title && (
                                  <div className="flex justify-between">
                                    <dt className="text-xs text-gray-600">Title:</dt>
                                    <dd className="text-xs font-medium truncate">{latestEkg.title}</dd>
                                  </div>
                                )}
                                {(latestEkg.notes || latestEkg.description) && (
                                  <div className="mt-2">
                                    <dt className="text-xs text-gray-600 mb-1">Notes:</dt>
                                    <dd className="text-xs text-gray-700 bg-white p-2 rounded border">
                                      {latestEkg.notes || latestEkg.description}
                                    </dd>
                                  </div>
                                )}
                                {latestEkg.files && latestEkg.files.length > 0 && (
                                  <div className="mt-2">
                                    <dt className="text-xs text-gray-600 mb-1">Files:</dt>
                                    {latestEkg.files.map((file, idx) => (
                                      <dd key={idx} className="text-xs text-blue-600 truncate">
                                        {file.fileName || 'Document'}
                                      </dd>
                                    ))}
                                  </div>
                                )}
                              </>
                            )}
                          </dl>
                          <div className="mt-4 pt-3 border-t border-gray-200">
                            <AppleButton
                              onClick={() => setShowEKGUploadModal(true)}
                              variant="secondary"
                              className="w-full text-sm"
                            >
                              <Icon icon={FiPlus} className="w-4 h-4 mr-2" />
                              Upload Entry EKG
                            </AppleButton>
                            {entryEkgArtifacts.length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs text-gray-600 mb-1">
                                  {entryEkgArtifacts.length} EKG document(s) uploaded
                                </p>
                                <div className="text-xs text-gray-500 max-h-20 overflow-y-auto">
                                  {entryEkgArtifacts.slice(0, 3).map((artifact, index) => (
                                    <div key={artifact._id || index} className="truncate">
                                      {artifact.files?.[0]?.fileName || artifact.title || 'EKG Document'}
                                    </div>
                                  ))}
                                  {entryEkgArtifacts.length > 3 && (
                                    <div className="text-gray-400">...and {entryEkgArtifacts.length - 3} more</div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Liver Panel Test Section */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                      <Icon icon={FiHeart} className="w-4 h-4 mr-2" />
                      Entry Liver Panel Test
                    </h3>
                    {(() => {
                      // Find entry Liver Panel artifacts from medical artifacts
                      const entryLiverArtifacts = getClientEntryMedicalArtifacts(medicalArtifacts, clientId || '', 'liver_panel', 'Liver');

                      const latestLiver = entryLiverArtifacts[0];
                      const hasLiver = !!latestLiver;

                      return (
                        <>
                          <dl className="space-y-2">
                            <div className="flex justify-between">
                              <dt className="text-xs text-gray-600">Status:</dt>
                              <dd className="text-xs font-medium">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  hasLiver ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {hasLiver ? 'Received' : 'Pending'}
                                </span>
                              </dd>
                            </div>
                            {latestLiver && (
                              <>
                                <div className="flex justify-between">
                                  <dt className="text-xs text-gray-600">Received:</dt>
                                  <dd className="text-xs font-medium">
                                    {new Date(latestLiver.receivedAt || latestLiver.createdAt || '').toLocaleDateString()}
                                  </dd>
                                </div>
                                {latestLiver.title && (
                                  <div className="flex justify-between">
                                    <dt className="text-xs text-gray-600">Title:</dt>
                                    <dd className="text-xs font-medium truncate">{latestLiver.title}</dd>
                                  </div>
                                )}
                                {(latestLiver.notes || latestLiver.description) && (
                                  <div className="mt-2">
                                    <dt className="text-xs text-gray-600 mb-1">Notes:</dt>
                                    <dd className="text-xs text-gray-700 bg-white p-2 rounded border">
                                      {latestLiver.notes || latestLiver.description}
                                    </dd>
                                  </div>
                                )}
                                {latestLiver.files && latestLiver.files.length > 0 && (
                                  <div className="mt-2">
                                    <dt className="text-xs text-gray-600 mb-1">Files:</dt>
                                    {latestLiver.files.map((file, idx) => (
                                      <dd key={idx} className="text-xs text-blue-600 truncate">
                                        {file.fileName || 'Document'}
                                      </dd>
                                    ))}
                                  </div>
                                )}
                              </>
                            )}
                          </dl>
                          <div className="mt-4 pt-3 border-t border-gray-200">
                            <AppleButton
                              onClick={() => setShowLiverPanelUploadModal(true)}
                              variant="secondary"
                              className="w-full text-sm"
                            >
                              <Icon icon={FiPlus} className="w-4 h-4 mr-2" />
                              Upload Entry Liver Panel
                            </AppleButton>
                            {entryLiverArtifacts.length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs text-gray-600 mb-1">
                                  {entryLiverArtifacts.length} Liver Panel document(s) uploaded
                                </p>
                                <div className="text-xs text-gray-500 max-h-20 overflow-y-auto">
                                  {entryLiverArtifacts.slice(0, 3).map((artifact, index) => (
                                    <div key={artifact._id || index} className="truncate">
                                      {artifact.files?.[0]?.fileName || artifact.title || 'Liver Panel Document'}
                                    </div>
                                  ))}
                                  {entryLiverArtifacts.length > 3 && (
                                    <div className="text-gray-400">...and {entryLiverArtifacts.length - 3} more</div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 bg-gray-50 rounded-lg">
                <Icon icon={FiHeart} className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                <p className="text-sm text-gray-500">No medical information available</p>
              </div>
            )}

            {/* Medical Records Section */}
            <div className="mt-8">
              <MedicalRecordsManager
                clientId={clientId || ''}
                clientName={`${client.firstName} ${client.lastName}`}
                retreatId={getDefaultRetreatId()}
                retreatOptions={getRetreatOptions()}
                refreshKey={medicalRecordsRefreshKey}
              />
            </div>
          </div>
        )}


        {activeTab === 'bookings' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Client Bookings</h2>
            {bookings.length > 0 ? (
              <div className="space-y-4">
                {bookings.map((booking: any) => {
                  const bookingRetreat = getBookingRetreat(booking);
                  const bookingRetreatId = getId(bookingRetreat || booking.retreatId);
                  const heroUrl = retreatHeroUrls[bookingRetreatId];
                  const isPast = isRetreatPast(bookingRetreat);
                  const retreatCode = bookingRetreat?.code || bookingRetreat?.retreatCode || bookingRetreat?.name || booking.retreat?.name || 'Retreat';

                  return (
                  <div
                    key={booking._id}
                    className={`client-booking-hero-card ${isPast ? 'client-booking-hero-card-past' : ''}`}
                    style={heroUrl ? { backgroundImage: `linear-gradient(90deg, rgba(15,23,42,0.78), rgba(15,23,42,0.38)), url(${heroUrl})` } : undefined}
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-semibold text-white">{retreatCode}</h3>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                            booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            booking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {booking.status?.charAt(0).toUpperCase() + booking.status?.slice(1) || 'Unknown'}
                          </span>
                        </div>
                        <div className="text-sm text-white/85 space-y-1">
                          {bookingRetreat?.startDate && (
                            <div className="flex items-center">
                              <Icon icon={FiCalendar} className="w-4 h-4 mr-2" />
                              <span>
                                {formatDate(bookingRetreat.startDate)} - {' '}
                                {bookingRetreat.endDate ? formatDate(bookingRetreat.endDate) : 'TBD'}
                              </span>
                            </div>
                          )}
                          {booking.house?.name && (
                            <div className="flex items-center">
                              <Icon icon={FiMapPin} className="w-4 h-4 mr-2" />
                              <span>{booking.house.name}</span>
                            </div>
                          )}
                          <div className="flex items-center">
                            <Icon icon={FiUser} className="w-4 h-4 mr-2" />
                            <span>Booking ID: {booking._id.slice(-8)}</span>
                          </div>
                          {booking.bookingDate && (
                            <div className="text-xs text-white/70 mt-1">
                              Booked: {formatDate(booking.bookingDate)}
                            </div>
                          )}
                        </div>
                      </div>
                      <AppleButton
                        onClick={() => {
                          // Navigate to booking details - adjust the route as needed
                          navigate(`/admin/bookings/${booking._id}`);
                        }}
                        variant="ghost"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        View Booking
                      </AppleButton>
                    </div>
                  </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <Icon icon={FiCalendar} className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No bookings found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  This client has no bookings yet.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'payments' && (
          <div>
            <div className="flex w-full items-center gap-4 mb-4">
              <h2 className="text-lg font-semibold whitespace-nowrap">Payment History</h2>
              <AppleButton
                onClick={openAddPaymentModal}
                className="apple-button-primary ml-auto w-auto flex-none px-3 py-2 whitespace-nowrap"
              >
                <Icon icon={FiPlus} className="w-4 h-4 mr-2" />
                Add Payment
              </AppleButton>
            </div>

            <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Payment Requests</h3>
                  <p className="mt-1 text-xs text-gray-500">Create deposit requests and copy the public consent/payment link.</p>
                </div>
                <AppleButton
                  onClick={handleCreateDepositPaymentRequest}
                  className="apple-button-primary w-auto flex-none px-3 py-2 whitespace-nowrap"
                >
                  <Icon icon={FiPlus} className="w-4 h-4 mr-2" />
                  Create Deposit Request
                </AppleButton>
              </div>

              {paymentRequests.length > 0 ? (
                <div className="space-y-3">
                  {paymentRequests.map((request) => {
                    const paymentUrl = getPaymentRequestUrl(request);
                    return (
                      <div key={request._id} className="rounded-md border border-gray-200 bg-white p-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="text-sm font-semibold text-gray-900">
                              {request.invoiceNumber || request.display_id || request._id}
                            </div>
                            <div className="mt-1 text-xs text-gray-500">
                              {request.requestType || request.paymentType || 'request'} · {request.requestedAmount || request.amountPaid || 0} {request.currency} · {request.status}
                            </div>
                          </div>
                          <AppleButton
                            onClick={() => navigate(`/admin/payment-requests/${request._id}/edit`)}
                            className="apple-button-secondary w-auto flex-none px-3 py-2 whitespace-nowrap"
                          >
                            Edit Request
                          </AppleButton>
                        </div>

                        {paymentUrl ? (
                          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                            <input
                              value={paymentUrl}
                              readOnly
                              className="min-w-0 flex-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700"
                            />
                            <AppleButton
                              onClick={() => {
                                navigator.clipboard.writeText(paymentUrl);
                                alert('Payment request link copied.');
                              }}
                              className="apple-button-primary w-auto flex-none px-3 py-2 whitespace-nowrap"
                            >
                              Copy Link
                            </AppleButton>
                          </div>
                        ) : (
                          <p className="mt-3 text-xs text-amber-700">
                            This older request does not have a public hash yet. Open and save it once to generate the link.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No payment requests yet.</p>
              )}
            </div>

            {payments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Payment ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Retreat
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Payment Request
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reference
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {payments.map((payment) => {
                      const paymentRetreatId = getId(payment.retreatId);
                      const paymentRetreat = getRetreatById(paymentRetreatId);
                      const paymentRequest = typeof payment.paymentRequestId === 'object' ? payment.paymentRequestId : undefined;
                      return (
                        <tr key={payment._id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDate(payment.paymentDate)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            <button
                              type="button"
                              onClick={() => navigate(`/admin/payments/${payment._id}`, { state: { returnTo: location.pathname } })}
                              className="inline-flex items-center text-blue-700 hover:underline"
                              title="View payment"
                            >
                              {payment.display_id ? `#${payment.display_id}` : payment._id?.slice(-8) || 'N/A'}
                            </button>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {formatPaymentAmount(payment)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {paymentRetreat ? getRetreatLabel(paymentRetreat) : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {payment.paymentRequestId ? (() => {
                              const request: any = payment.paymentRequestId;
                              const requestId = getId(request);
                              const label = typeof request === 'object'
                                ? request.invoiceNumber || (request.display_id ? `#${request.display_id}` : `#${requestId.slice(-8)}`)
                                : `#${requestId.slice(-8)}`;
                              return <button type="button" onClick={() => navigate(`/admin/payment-requests/${requestId}`)} className="font-semibold text-blue-700 hover:underline">{label}</button>;
                            })() : '—'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {payment.paymentType || payment.type || 'Payment'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(payment.status || 'completed')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {payment.transactionReference || payment.transactionId || payment.reference || payment.description || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end gap-2">
                              {!getId(payment.bookingId) && (
                                <button
                                  type="button"
                                  onClick={() => navigate(buildBookingCreateUrlFromPayment({
                                    payment,
                                    clientId: clientId || undefined,
                                    retreatId: paymentRetreatId || undefined,
                                    paymentRequest,
                                  }))}
                                  className="inline-flex items-center rounded-md border border-green-200 px-2.5 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50"
                                  title="Create booking from this payment"
                                >
                                  <Icon icon={FiPlus} className="mr-1 h-3.5 w-3.5" />
                                  Create Booking
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => navigate(`/admin/payments/${payment._id}`, { state: { returnTo: location.pathname } })}
                                className="inline-flex items-center rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                              >
                                <Icon icon={FiEye} className="mr-1 h-3.5 w-3.5" />
                                View
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditPaymentModal(payment)}
                                className="inline-flex items-center rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
                              >
                                <Icon icon={FiEdit2} className="mr-1 h-3.5 w-3.5" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePayment(payment)}
                                className="inline-flex items-center rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                              >
                                <Icon icon={FiTrash2} className="mr-1 h-3.5 w-3.5" />
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No payment history available</p>
            )}
          </div>
        )}

        {activeTab === 'emails' && (
          <EmailHistoryPanel
            clientId={clientId}
            recipientEmail={client?.email}
            recipientName={[client?.firstName, client?.lastName].filter(Boolean).join(' ')}
            title="Client emails"
            subtitle="Sent and received emails for this client."
          />
        )}

        {activeTab === 'notifications' && (
          <SubmissionNotificationsPage clientId={clientId} title="Client notifications" subtitle="All notifications generated for this client, across their bookings." />
        )}

        {/* Notes Tab */}
        {activeTab === 'notes' && (
          <div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="truncate text-lg font-semibold">Client Notes</h2>
              <button
                type="button"
                onClick={() => setShowAddNoteModal(true)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white shadow-sm hover:bg-blue-700"
                aria-label="Add note"
                title="Add note"
              >
                <Icon icon={FiPlus} className="w-5 h-5" />
              </button>
            </div>

            {notes.length > 0 ? (
              <div className="space-y-4">
                {notes.map((note, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm text-gray-500">
                        {formatDate(note.createdAt)} by {note.createdBy || 'Admin'}
                      </span>
                    </div>
                    <p className="text-gray-900">{note.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Icon icon={FiMessageSquare} className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No notes yet</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Add a note to keep track of important client information.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tasks Tab */}
        {activeTab === 'tasks' && (
          <div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="truncate text-lg font-semibold">Client Tasks</h2>
              <button
                type="button"
                onClick={handleCreateTask}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white shadow-sm hover:bg-blue-700"
                aria-label="Add task"
                title="Add task"
              >
                <Icon icon={FiPlus} className="w-5 h-5" />
              </button>
            </div>

            {taskError && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {taskError}
              </div>
            )}

            {tasks.length > 0 ? (
              <TaskList
                tasks={tasks}
                onEditTask={handleEditTask}
                onDeleteTask={handleDeleteTask}
                onCompleteTask={handleCompleteTask}
              />
            ) : (
              <div className="text-center py-12">
                <Icon icon={FiCheckSquare} className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No tasks yet</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Add a task to keep track of client-related activities.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Note Modal */}
      {showAddNoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Add Client Note</h3>
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Enter your note here..."
                className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={4}
              />
              <div className="flex justify-end space-x-3 mt-4">
                <AppleButton
                  onClick={() => {
                    setShowAddNoteModal(false);
                    setNewNote('');
                  }}
                  variant="ghost"
                >
                  Cancel
                </AppleButton>
                <AppleButton
                  onClick={() => {
                    if (newNote.trim()) {
                      setNotes([{
                        content: newNote,
                        createdAt: new Date().toISOString(),
                        createdBy: 'Admin'
                      }, ...notes]);
                      setNewNote('');
                      setShowAddNoteModal(false);
                    }
                  }}
                  className="apple-button-primary"
                >
                  Add Note
                </AppleButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddTaskModal && (
        <TaskForm
          task={editingTask}
          clientId={clientId}
          onSubmit={handleSaveTask}
          onCancel={() => {
            setShowAddTaskModal(false);
            setEditingTask(null);
            setTaskError(null);
          }}
          error={taskError}
        />
      )}

      {/* Add Payment Modal */}
      {showAddPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">{editingPayment ? 'Edit Payment' : 'Add Payment'}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={newPayment.date}
                    onChange={(e) => setNewPayment({...newPayment, date: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type
                  </label>
                  <select
                    value={newPayment.type}
                    onChange={(e) => setNewPayment({...newPayment, type: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select payment type</option>
                    <option value="deposit">Deposit</option>
                    <option value="full_payment">Full Payment</option>
                    <option value="installment">Installment</option>
                    <option value="refund">Refund</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Retreat
                  </label>
                  <select
                    value={newPayment.retreatId}
                    onChange={(e) => setNewPayment({...newPayment, retreatId: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select retreat</option>
                    {getRetreatOptions().map((retreat) => (
                      <option key={retreat.id} value={retreat.id}>
                        {retreat.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Request (Optional)
                  </label>
                  <SearchablePaymentRequestSelect
                    selectedPaymentRequestId={newPayment.paymentRequestId}
                    onPaymentRequestSelect={handlePaymentRequestSelect}
                    placeholder="Search by invoice/display number, client, or retreat"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newPayment.amount}
                    onChange={(e) => setNewPayment({...newPayment, amount: e.target.value})}
                    placeholder="0.00"
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Currency
                    </label>
                    <select
                      value={newPayment.currency}
                      onChange={(e) => setNewPayment({...newPayment, currency: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                      <option value="CZK">CZK</option>
                      <option value="PLN">PLN</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      USD Amount
                    </label>
                    <input
                      type="text"
                      value={newPayment.usdPreviewLoading ? 'Calculating...' : newPayment.usdAmount ? `$${Number(newPayment.usdAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
                      readOnly
                      placeholder="Calculated"
                      className="w-full p-2 border border-gray-200 rounded-md bg-gray-50 text-gray-700"
                    />
                    {newPayment.usdPreviewError && <p className="mt-1 text-xs text-red-600">{newPayment.usdPreviewError}</p>}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Note (Optional)
                  </label>
                  <textarea
                    value={newPayment.note}
                    onChange={(e) => setNewPayment({...newPayment, note: e.target.value})}
                    placeholder="Add a note about this payment"
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <AppleButton
                  onClick={() => {
                    setShowAddPaymentModal(false);
                    setEditingPayment(null);
                    resetNewPayment();
                  }}
                  variant="ghost"
                >
                  Cancel
                </AppleButton>
                <AppleButton
                  onClick={handleSavePayment}
                  className="apple-button-primary"
                >
                  {editingPayment ? 'Update Payment' : 'Add Payment'}
                </AppleButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Medical Record Modal */}
      {showAddMedicalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Add Medical Record</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type
                  </label>
                  <select
                    value={newMedical.type}
                    onChange={(e) => setNewMedical({...newMedical, type: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select type</option>
                    <option value="consultation">Consultation</option>
                    <option value="test_result">Test Result</option>
                    <option value="diagnosis">Diagnosis</option>
                    <option value="treatment">Treatment</option>
                    <option value="medication">Medication</option>
                    <option value="allergy">Allergy</option>
                    <option value="vaccination">Vaccination</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={newMedical.title}
                    onChange={(e) => setNewMedical({...newMedical, title: e.target.value})}
                    placeholder="Enter record title"
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={newMedical.date}
                    onChange={(e) => setNewMedical({...newMedical, date: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={newMedical.notes}
                    onChange={(e) => setNewMedical({...newMedical, notes: e.target.value})}
                    placeholder="Enter detailed notes"
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={4}
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <AppleButton
                  onClick={() => {
                    setShowAddMedicalModal(false);
                    setNewMedical({ type: '', title: '', date: '', notes: '' });
                  }}
                  variant="ghost"
                >
                  Cancel
                </AppleButton>
                <AppleButton
                  onClick={() => {
                    if (newMedical.type && newMedical.title && newMedical.date) {
                      const record = {
                        _id: Date.now().toString(),
                        type: newMedical.type,
                        title: newMedical.title,
                        date: newMedical.date,
                        notes: newMedical.notes,
                        createdAt: new Date().toISOString()
                      };
                      setMedicalRecords([record, ...medicalRecords]);
                      setNewMedical({ type: '', title: '', date: '', notes: '' });
                      setShowAddMedicalModal(false);
                    }
                  }}
                  className="apple-button-primary"
                >
                  Add Record
                </AppleButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EKG Upload Modal */}
      {showEKGUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Upload EKG Files</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Files (Images/PDFs)
                </label>
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length > 0) {
                      // Store selected files in temporary state for preview
                      setEkgFiles(files.map(file => ({
                        name: file.name,
                        size: file.size,
                        type: file.type,
                        file: file // Store actual file for upload
                      })));
                    }
                  }}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Accepted formats: JPG, PNG, PDF. Multiple files allowed.
                </p>
              </div>

              {ekgFiles.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Uploaded Files:</h4>
                  <div className="space-y-1">
                    {ekgFiles.map((file, index) => (
                      <div key={index} className="flex justify-between items-center text-sm bg-gray-50 p-2 rounded">
                        <span>{file.name}</span>
                        <button
                          onClick={() => setEkgFiles(ekgFiles.filter((_, i) => i !== index))}
                          className="text-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <AppleButton
                onClick={() => {
                  setShowEKGUploadModal(false);
                  setEkgFiles([]);
                }}
                variant="ghost"
              >
                Cancel
              </AppleButton>
              <AppleButton
                onClick={() => {
                  const files = ekgFiles.map(f => f.file).filter(Boolean) as File[];
                  if (files.length > 0) {
                    handleEKGFileUpload(files);
                  }
                }}
                className="apple-button-primary"
                disabled={uploadingEKG || ekgFiles.length === 0}
              >
                {uploadingEKG ? 'Uploading...' : 'Upload'}
              </AppleButton>
            </div>
          </div>
        </div>
      )}

      {/* Liver Panel Upload Modal */}
      {showLiverPanelUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Upload Liver Panel Files</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Files (Images/PDFs)
                </label>
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length > 0) {
                      // Store selected files in temporary state for preview
                      setLiverPanelFiles(files.map(file => ({
                        name: file.name,
                        size: file.size,
                        type: file.type,
                        file: file // Store actual file for upload
                      })));
                    }
                  }}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Accepted formats: JPG, PNG, PDF. Multiple files allowed.
                </p>
              </div>

              {liverPanelFiles.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Uploaded Files:</h4>
                  <div className="space-y-1">
                    {liverPanelFiles.map((file, index) => (
                      <div key={index} className="flex justify-between items-center text-sm bg-gray-50 p-2 rounded">
                        <span>{file.name}</span>
                        <button
                          onClick={() => setLiverPanelFiles(liverPanelFiles.filter((_, i) => i !== index))}
                          className="text-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <AppleButton
                onClick={() => {
                  setShowLiverPanelUploadModal(false);
                  setLiverPanelFiles([]);
                }}
                variant="ghost"
              >
                Cancel
              </AppleButton>
              <AppleButton
                onClick={() => {
                  const files = liverPanelFiles.map(f => f.file).filter(Boolean) as File[];
                  if (files.length > 0) {
                    handleLiverPanelFileUpload(files);
                  }
                }}
                className="apple-button-primary"
                disabled={uploadingLiverPanel || liverPanelFiles.length === 0}
              >
                {uploadingLiverPanel ? 'Uploading...' : 'Upload'}
              </AppleButton>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ClientDetailsPage;
