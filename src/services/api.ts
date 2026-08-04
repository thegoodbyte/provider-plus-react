import axios from 'axios';
import { Retreat, House, Client, ContactBookEntry, RetreatClient, ClientMedical, Requirement, ClientRequirement, Reminder, ExpenseType, PaymentMethod, RetreatExpense, ExpenseSummary, Payment, PaymentSummary, PaymentRequest, ScreeningClient, Ceremony, CeremonyParticipant, MedicalItem, MedicalArtifact, MedicalArtifactCreateInput, MedicalReviewRequest, MedicalReviewGroup, MedicalReviewGroupAccessLink, FileUpload, BookingFlowActionLog, BookingFlowItem, BookingFlowTemplate, BookingDocument, BookingDocumentType, MailSettings, EmailTemplate, EmailTemplateSeedOption, SentEmail, RetreatArtifactSubmissionsResponse, BloodPressureReading, ReferralReportRow } from '../types';
import type { Referral } from '../types';
import { authService } from './authService';
import { cacheService } from './cacheService';
import { API_BASE_URL } from '../config/api.config';


const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Enable sending cookies and auth headers with CORS
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = authService.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if ((error.config as any)?.suppressAuthRedirect) {
        return Promise.reject(error);
      }
      // Token expired or invalid
      authService.logout();
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// Helper function to cache GET requests
const cachedGet = async <T>(key: string, fetcher: () => Promise<any>, ttl: number = 60000): Promise<any> => {
  const cached = cacheService.get<T>(key);
  if (cached) {
    return { data: cached };
  }

  const response = await fetcher();
  cacheService.set(key, response.data, ttl);
  return response;
};

export const retreatsApi = {
  getAll: () => cachedGet<Retreat[]>('retreats:all', () => api.get<Retreat[]>('/retreats')),
  getUpcomingRetreats: () => cachedGet<any>('retreats:upcoming', () => api.get<any>('/retreats?status=upcoming'), 30000),
  getOne: (id: string) => cachedGet<Retreat>(`retreats:${id}`, () => api.get<Retreat>(`/retreats/${id}`)),
  create: (data: Omit<Retreat, '_id'>) => {
    cacheService.clearPattern('retreats:');
    return api.post<Retreat>('/retreats', data);
  },
  update: (id: string, data: Partial<Retreat>) => {
    cacheService.clearPattern('retreats:');
    return api.patch<Retreat>(`/retreats/${id}`, data);
  },
  uploadHeroImage: (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    cacheService.clearPattern('retreats:');
    return api.post<{ retreat: Retreat; heroImageUrl: string }>(`/retreats/${id}/hero-image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getHeroImageUrl: (id: string) => api.get<{ heroImageUrl: string | null; source?: 'retreat' | 'house' }>(`/retreats/${id}/hero-image-url`),
  clearHeroImage: (id: string) => {
    cacheService.clearPattern('retreats:');
    return api.delete<{ retreat: Retreat; heroImageUrl: string | null; source?: 'retreat' | 'house' }>(`/retreats/${id}/hero-image`);
  },
  delete: (id: string) => {
    cacheService.clearPattern('retreats:');
    return api.delete(`/retreats/${id}`);
  },
};

export const housesApi = {
  getAll: () => cachedGet<House[]>('houses:all', () => api.get<House[]>('/houses'), 300000), // 5 minutes - houses don't change often
  getOne: (id: string) => cachedGet<House>(`houses:${id}`, () => api.get<House>(`/houses/${id}`), 300000),
  create: (data: Omit<House, '_id'>) => {
    cacheService.clearPattern('houses:');
    return api.post<House>('/houses', data);
  },
  update: (id: string, data: Partial<House>) => {
    cacheService.clearPattern('houses:');
    return api.patch<House>(`/houses/${id}`, data);
  },
  uploadHeroImage: (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    cacheService.clearPattern('houses:');
    cacheService.clearPattern('retreats:');
    return api.post<{ house: House; heroImageUrl: string }>(`/houses/${id}/hero-image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getHeroImageUrl: (id: string) => api.get<{ heroImageUrl: string | null }>(`/houses/${id}/hero-image-url`),
  clearHeroImage: (id: string) => {
    cacheService.clearPattern('houses:');
    cacheService.clearPattern('retreats:');
    return api.delete<{ house: House; heroImageUrl: string | null }>(`/houses/${id}/hero-image`);
  },
  delete: (id: string) => {
    cacheService.clearPattern('houses:');
    return api.delete(`/houses/${id}`);
  },
};

export const clientsApi = {
  getAll: () => cachedGet<Client[]>('clients:all', () => api.get<Client[]>('/clients')),
  getBookingOptions: () => cachedGet<Client[]>('clients:booking-options', () => api.get<Client[]>('/clients/booking-options'), 30000),
  getOne: (id: string) => cachedGet<Client>(`clients:${id}`, () => api.get<Client>(`/clients/${id}`)),
  create: (data: Omit<Client, '_id'>) => {
    cacheService.clearPattern('clients:');
    const { loginPin: _loginPin, ...safeData } = data as Partial<Client> & { loginPin?: string };
    return api.post<Client>('/clients', safeData);
  },
  quickAdd: (data: Partial<Client>) => {
    cacheService.clearPattern('clients:');
    const { loginPin: _loginPin, ...safeData } = data as Partial<Client> & { loginPin?: string };
    return api.post<Client>('/clients/quick-add', safeData);
  },
  update: (id: string, data: Partial<Client>) => {
    cacheService.clearPattern('clients:');
    return api.patch<Client>(`/clients/${id}`, data);
  },
  delete: (id: string) => {
    cacheService.clearPattern('clients:');
    return api.delete(`/clients/${id}`);
  },
  search: (searchTerm: string) => api.get<Client[]>(`/clients?search=${searchTerm}`),
  searchClients: (searchTerm: string) => api.get<Client[]>(`/clients/search?query=${searchTerm}`),
  getByEmail: (email: string) => api.get<Client>(`/clients/by-email/${email}`),
  getByRetreat: (retreatId: string) => cachedGet<Client[]>(`clients:retreat:${retreatId}`, () => api.get<Client[]>(`/clients/by-retreat/${retreatId}`)),
  regenerateDepositHash: (id: string) => api.post<{ hash: string }>(`/clients/${id}/regenerate-deposit-hash`, {}),
  getPotential: () => api.get<Client[]>('/clients/potential'),
  getActive: () => api.get<Client[]>('/clients/active'),
  getByPriority: (priority: string) => api.get<Client[]>(`/clients/by-priority/${priority}`),
  getBlacklisted: () => api.get<Client[]>('/clients/blacklisted'),
  getNextDisplayId: () => api.get<number>('/clients/next-display-id'),
  blacklist: (id: string, reason: string) => {
    cacheService.clearPattern('clients:');
    return api.put(`/clients/${id}/blacklist`, { reason });
  },
  updateWorkflowStatus: (id: string, status: string, reason?: string) => {
    cacheService.clearPattern('clients:');
    return api.put(`/clients/${id}/workflow-status`, { status, reason });
  },
  downloadScreeningPdf: (id: string) =>
    api.get(`/clients/${id}/screening/download-pdf`, {
      responseType: 'blob',
      suppressGlobalError: true,
    } as any),
  updateScreening: (id: string, screeningData: any) => {
    cacheService.clearPattern('clients:');
    return api.put(`/clients/${id}/screening`, screeningData);
  },
  uploadProfilePicture: (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    cacheService.clearPattern('clients:');
    return api.post<{ client: Client; fileUpload: FileUpload }>(`/clients/${id}/profile-picture`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  resetLoginPin: (id: string, notifyClient: boolean) =>
    api.post<{ client: Client; loginPin: string; emailSent: boolean }>(`/clients/${id}/login-pin/reset`, { notifyClient }),
  getProfilePictureBlob: (id: string) =>
    api.get(`/clients/${id}/profile-picture`, { responseType: 'blob', suppressGlobalError: true } as any),
};

export const contactBookApi = {
  getAll: (filters: { search?: string; role?: string; includeInactive?: boolean } = {}) => {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.role) params.set('role', filters.role);
    if (filters.includeInactive) params.set('includeInactive', 'true');
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return cachedGet<ContactBookEntry[]>(`contact-book:${suffix || 'all'}`, () => api.get<ContactBookEntry[]>(`/contact-book${suffix}`), 30000);
  },
  getOne: (id: string) => cachedGet<ContactBookEntry>(`contact-book:${id}`, () => api.get<ContactBookEntry>(`/contact-book/${id}`)),
  create: (data: Omit<ContactBookEntry, '_id'>) => {
    cacheService.clearPattern('contact-book:');
    return api.post<ContactBookEntry>('/contact-book', data);
  },
  update: (id: string, data: Partial<ContactBookEntry>) => {
    cacheService.clearPattern('contact-book:');
    return api.patch<ContactBookEntry>(`/contact-book/${id}`, data);
  },
  delete: (id: string) => {
    cacheService.clearPattern('contact-book:');
    return api.delete(`/contact-book/${id}`);
  },
};

export const clientMedicalApi = {
  getAll: () => cachedGet<ClientMedical[]>('medical:all', () => api.get<ClientMedical[]>('/client-medical')),
  getOne: (id: string) => cachedGet<ClientMedical>(`medical:${id}`, () => api.get<ClientMedical>(`/client-medical/${id}`)),
  getByClient: (clientId: string) => cachedGet<ClientMedical[]>(`medical:client:${clientId}`, () => api.get<ClientMedical[]>(`/client-medical/client/${clientId}`)),
  getByRetreat: (retreatId: string) => api.get<ClientMedical[]>(`/client-medical/retreat/${retreatId}`),
  getByClientAndRetreat: (clientId: string, retreatId: string) => api.get<ClientMedical>(`/client-medical/client/${clientId}/retreat/${retreatId}`),
  create: (data: Omit<ClientMedical, '_id'>) => {
    cacheService.clearPattern('medical:');
    return api.post<ClientMedical>('/client-medical', data);
  },
  update: (id: string, data: Partial<ClientMedical>) => {
    cacheService.clearPattern('medical:');
    return api.patch<ClientMedical>(`/client-medical/${id}`, data);
  },
  delete: (id: string) => api.delete(`/client-medical/${id}`),
  uploadFile: (formData: FormData, type: 'liver-panel' | 'ekg') => api.post(`/client-medical/upload/${type}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  clearEkgFile: (id: string) => api.delete(`/client-medical/${id}/ekg-file`),
  clearLiverFile: (id: string) => api.delete(`/client-medical/${id}/liver-file`),
  getFileBlob: (id: string, type: 'liver-panel' | 'ekg') =>
    api.get(`/client-medical/${id}/file/${type}`, { responseType: 'blob' }),
  reviewLiverPanel: (id: string, reviewData: { advisorNotes: string; status: string }) =>
    api.patch(`/client-medical/${id}/liver-panel/review`, reviewData),
  reviewEkg: (id: string, reviewData: { advisorNotes: string; status: string }) =>
    api.patch(`/client-medical/${id}/ekg/review`, reviewData),
  updateMedicalClearance: (id: string, clearanceData: {
    finalMedicalClearance: boolean;
    medicalClearanceNotes: string;
    medicalAdvisorName?: string;
    medicalAdvisorEmail?: string;
  }) => api.patch(`/client-medical/${id}/medical-clearance`, clearanceData),
};



export const remindersApi = {
  getAll: () => cachedGet<Reminder[]>('reminders:all', () => api.get<Reminder[]>('/reminders')),
  getPending: () => cachedGet<Reminder[]>('reminders:pending', () => api.get<Reminder[]>('/reminders?status=pending')),
  getByClient: (clientId: string) => cachedGet<Reminder[]>(`reminders:client:${clientId}`, () => api.get<Reminder[]>(`/reminders/client/${clientId}`)),
  getByRetreat: (retreatId: string) => api.get<Reminder[]>(`/reminders/retreat/${retreatId}`),
  create: (data: Omit<Reminder, '_id'>) => api.post<Reminder>('/reminders', data),
  update: (id: string, data: Partial<Reminder>) => api.patch<Reminder>(`/reminders/${id}`, data),
  complete: (id: string) => api.patch(`/reminders/${id}/complete`, {}),
  dismiss: (id: string) => api.patch(`/reminders/${id}/dismiss`, {}),
  delete: (id: string) => api.delete(`/reminders/${id}`),
};

export const bookingsApi = {
  getAll: () => cachedGet<RetreatClient[]>('bookings:all', () => api.get<RetreatClient[]>('/bookings')),
  getOne: (id: string) => cachedGet<RetreatClient>(`bookings:${id}`, () => api.get<RetreatClient>(`/bookings/${id}`)),
  getActivity: (id: string) => api.get<import('../types').BookingActivityEvent[]>(`/bookings/${id}/activity`),
  getByHash: (hash: string) => cachedGet<RetreatClient>(`bookings:hash:${hash}`, () => api.get<RetreatClient>(`/bookings/by-hash/${hash}`)),
  getByRetreat: (retreatId: string) => cachedGet<RetreatClient[]>(`bookings:retreat:${retreatId}`, () => api.get<RetreatClient[]>(`/bookings/retreat/${retreatId}`)),
  // Booking ownership can be corrected outside this browser session. Do not cache
  // this relationship: medical record creation must always see the current link.
  getByClient: (clientId: string) => api.get<RetreatClient[]>(`/bookings/client/${clientId}`),
  getByRetreatWithDetails: (retreatId: string) => cachedGet<RetreatClient[]>(`bookings:retreat-details:${retreatId}`, () => api.get<RetreatClient[]>(`/bookings/retreat/${retreatId}/with-details`)),
  getNextBookingNumber: () => api.get<number>('/bookings/next-booking-number'),
  isBookingNumberAvailable: (bookingNumber: number, excludeId?: string) => api.get<{ available: boolean }>(
    `/bookings/booking-number-available?bookingNumber=${encodeURIComponent(String(bookingNumber))}${excludeId ? `&excludeId=${encodeURIComponent(excludeId)}` : ''}`
  ),
  create: (data: Omit<RetreatClient, '_id'>) => {
    cacheService.clearPattern('bookings:');
    cacheService.clearPattern('payments:');
    return api.post<RetreatClient>('/bookings', data);
  },
  update: (id: string, data: Partial<RetreatClient>) => {
    cacheService.clearPattern('bookings:');
    cacheService.clearPattern('payments:');
    return api.patch<RetreatClient>(`/bookings/${id}`, data);
  },
  cancel: (id: string, data: { cancellationDate: string; cancellationReason: string; cancellationNotes?: string; cancellationDepositTreatment: 'none' | 'retained' | 'refund_pending' | 'partially_refunded' | 'credited'; cancellationRefundAmount?: number }) => {
    cacheService.clearPattern('bookings:');
    cacheService.clearPattern('payments:');
    return api.patch<RetreatClient>(`/bookings/${id}/cancel`, data);
  },
  recordConfirmationHistory: (id: string, data: {
    action?: 'created' | 'updated' | 'sent';
    reason: string;
    language?: string;
    sentEmailId?: string;
    sentEmailDisplayId?: number;
    sentAt?: string;
  }) => {
    cacheService.clearPattern('bookings:');
    return api.post<RetreatClient>(`/bookings/${id}/confirmation-history`, data);
  },
  storeConfirmationPdf: (id: string, language: 'en' | 'cz' | 'pl', blob: Blob, fileName: string) => {
    const formData = new FormData();
    formData.append('file', blob, fileName);
    cacheService.clearPattern('bookings:');
    return api.post(`/bookings/${id}/confirmation-pdf?language=${language}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  checkIn: (id: string) => {
    cacheService.clearPattern('bookings:');
    return api.patch<RetreatClient>(`/bookings/${id}/check-in`, {});
  },
  checkOut: (id: string) => {
    cacheService.clearPattern('bookings:');
    return api.patch<RetreatClient>(`/bookings/${id}/check-out`, {});
  },
  delete: (id: string) => {
    cacheService.clearPattern('bookings:');
    return api.delete(`/bookings/${id}`);
  },
  regenerateBookingHash: (id: string) => {
    cacheService.clearPattern('bookings:');
    return api.post<{ bookingHash: string }>(`/bookings/${id}/regenerate-booking-hash`, {});
  },
};

// Keep the old retreat-clients API for backward compatibility
export const retreatClientsApi = bookingsApi;

export const referralsApi = {
  getAll: () => api.get<Referral[]>('/referrals'),
  getReport: () => api.get<ReferralReportRow[]>('/referrals/report'),
  create: (data: Omit<Referral, '_id'>) => api.post<Referral>('/referrals', data),
  update: (id: string, data: Partial<Referral>) => api.patch<Referral>(`/referrals/${id}`, data),
  delete: (id: string) => api.delete(`/referrals/${id}`),
};

export const expenseTypesApi = {
  getAll: () => api.get<ExpenseType[]>('/expense-types'),
  getAllIncludingInactive: () => api.get<ExpenseType[]>('/expense-types?includeInactive=true'),
  getOne: (id: string) => api.get<ExpenseType>(`/expense-types/${id}`),
  create: (data: Omit<ExpenseType, '_id'>) => api.post<ExpenseType>('/expense-types', data),
  update: (id: string, data: Partial<ExpenseType>) => api.patch<ExpenseType>(`/expense-types/${id}`, data),
  delete: (id: string) => api.delete(`/expense-types/${id}`),
  activate: (id: string) => api.patch(`/expense-types/${id}/activate`, {}),
  deactivate: (id: string) => api.patch(`/expense-types/${id}/deactivate`, {}),
  seed: (dryRun: boolean = false) => api.post(`/expense-types/seed${dryRun ? '?dryRun=true' : ''}`, {}),
};

export const paymentMethodsApi = {
  getAll: (includeInactive = false) => api.get<PaymentMethod[]>(`/payment-methods${includeInactive ? '?includeInactive=true' : ''}`),
  create: (data: Omit<PaymentMethod, '_id'>) => api.post<PaymentMethod>('/payment-methods', data),
  update: (id: string, data: Partial<PaymentMethod>) => api.patch<PaymentMethod>(`/payment-methods/${id}`, data),
  activate: (id: string) => api.patch<PaymentMethod>(`/payment-methods/${id}/activate`, {}),
  deactivate: (id: string) => api.patch<PaymentMethod>(`/payment-methods/${id}/deactivate`, {}),
};

export const retreatExpensesApi = {
  getAll: () => api.get<RetreatExpense[]>('/retreat-expenses'),
  getOne: (id: string) => api.get<RetreatExpense>(`/retreat-expenses/${id}`),
  getByRetreat: (retreatId: string) => api.get<RetreatExpense[]>(`/retreat-expenses/retreat/${retreatId}`),
  getByExpenseType: (expenseTypeId: string) => api.get<RetreatExpense[]>(`/retreat-expenses/expense-type/${expenseTypeId}`),
  getRetreatSummary: (retreatId: string) => api.get<ExpenseSummary>(`/retreat-expenses/retreat/${retreatId}/summary`),
  create: (data: Omit<RetreatExpense, '_id'>) => api.post<RetreatExpense>('/retreat-expenses', data),
  update: (id: string, data: Partial<RetreatExpense>) => api.patch<RetreatExpense>(`/retreat-expenses/${id}`, data),
  uploadReceipt: (id: string, receipt: File) => {
    const formData = new FormData();
    formData.append('receipt', receipt);
    return api.post<{ expense: RetreatExpense; receiptUrl: string }>(`/retreat-expenses/${id}/receipt`, formData);
  },
  uploadReceipts: (id: string, receipts: File[]) => {
    const formData = new FormData();
    receipts.forEach((receipt) => formData.append('receipts', receipt));
    return api.post<{ expense: RetreatExpense; receipts: Array<{ url: string; fileName?: string; mimeType?: string; uploadedAt?: string }> }>(`/retreat-expenses/${id}/receipt-images`, formData);
  },
  getReceiptUrl: (id: string) => api.get<{ url: string; fileName?: string; mimeType?: string }>(`/retreat-expenses/${id}/receipt-url`),
  getReceiptUrls: (id: string) => api.get<Array<{ url: string; fileName?: string; mimeType?: string; uploadedAt?: string }>>(`/retreat-expenses/${id}/receipt-urls`),
  delete: (id: string) => api.delete(`/retreat-expenses/${id}`),
  initializeRetreatExpenses: (retreatId: string) => api.post(`/retreat-expenses/retreat/${retreatId}/initialize`, {}),
  autoGenerateHouseCost: (retreatId: string) => api.post<RetreatExpense>(`/retreat-expenses/retreat/${retreatId}/auto-generate-house-cost`, {}),
};

export const paymentsApi = {
  getAll: () => cachedGet<Payment[]>('payments:all', () => api.get<Payment[]>('/payments')),
  getOne: (id: string) => cachedGet<Payment>(`payments:${id}`, () => api.get<Payment>(`/payments/${id}`)),
  getByRetreat: (retreatId: string) => cachedGet<Payment[]>(`payments:retreat:${retreatId}`, () => api.get<Payment[]>(`/payments/by-retreat/${retreatId}`)),
  getByRetreatFresh: (retreatId: string) => api.get<Payment[]>(`/payments/by-retreat/${retreatId}`),
  getByClient: (clientId: string) => cachedGet<Payment[]>(`payments:client:${clientId}`, () => api.get<Payment[]>(`/payments/by-client/${clientId}`)),
  getByBooking: (bookingId: string) => cachedGet<Payment[]>(`payments:booking:${bookingId}`, () => api.get<Payment[]>(`/payments/by-booking/${bookingId}`)),
  getUnlinkedCandidatesByBooking: (bookingId: string) => api.get<Payment[]>(`/payments/unlinked-candidates/by-booking/${bookingId}`),
  autoLinkByBooking: (bookingId: string) => {
    cacheService.clearPattern('payments:');
    cacheService.clearPattern('bookings:');
    return api.post<{ linked: number; skipped: number; reason?: string }>(`/payments/auto-link/by-booking/${bookingId}`);
  },
  getByBookingHash: (bookingHash: string) => cachedGet<Payment[]>(`payments:hash:${bookingHash}`, () => api.get<Payment[]>(`/payments/by-booking-hash/${bookingHash}`)),
  getByClientAndRetreat: (clientId: string, retreatId: string) => cachedGet<Payment[]>(`payments:client-retreat:${clientId}-${retreatId}`, () => api.get<Payment[]>(`/payments/by-client-and-retreat?clientId=${clientId}&retreatId=${retreatId}`)),
  getRetreatSummary: (retreatId: string) => cachedGet<PaymentSummary>(`payments:summary:${retreatId}`, () => api.get<PaymentSummary>(`/payments/retreat-summary/${retreatId}`)),
  getNextDisplayId: () => api.get<number>('/payments/next-display-id'),
  convertToUsd: (amount: number, currency: string) => api.get<{ amount: number; currency: string; usd_amount: number }>(`/payments/convert-to-usd?amount=${encodeURIComponent(String(amount))}&currency=${encodeURIComponent(currency)}`),
  convert: (amount: number, from: string, to: string) => api.get<{ amount: number; from: string; to: string; provider: string }>(`/payments/convert?amount=${encodeURIComponent(String(amount))}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  create: (data: Omit<Payment, '_id'>) => {
    cacheService.clearPattern('payments:');
    cacheService.clearPattern('bookings:'); // Clear bookings cache too as payments affect booking status
    return api.post<Payment>('/payments', data);
  },
  update: (id: string, data: Partial<Payment>) => {
    cacheService.clearPattern('payments:');
    cacheService.clearPattern('bookings:');
    return api.put<Payment>(`/payments/${id}`, data);
  },
  delete: (id: string) => {
    cacheService.clearPattern('payments:');
    cacheService.clearPattern('bookings:');
    return api.delete(`/payments/${id}`);
  },
  refund: (id: string, refundData: { amount: number; reason: string }) => {
    cacheService.clearPattern('payments:');
    cacheService.clearPattern('bookings:');
    return api.patch<Payment>(`/payments/${id}/refund`, refundData);
  },
  processRefund: (id: string, refundAmount: number) => {
    cacheService.clearPattern('payments:');
    cacheService.clearPattern('bookings:');
    return api.put<Payment>(`/payments/${id}/refund`, { refundAmount });
  },
};

export const paymentRequestsApi = {
  getAll: () => cachedGet<PaymentRequest[]>('payment-requests:all', () => api.get<PaymentRequest[]>('/payment-requests')),
  getAllFresh: () => api.get<PaymentRequest[]>('/payment-requests'),
  getOne: (id: string) => cachedGet<PaymentRequest>(`payment-requests:${id}`, () => api.get<PaymentRequest>(`/payment-requests/${id}`)),
  getOneFresh: (id: string) => api.get<PaymentRequest>(`/payment-requests/${id}`),
  getPublicDeposit: (hash: string) => api.get(`/payment-requests/public/deposit/${hash}`),
  getPublicInvoice: (hash: string) => api.get(`/public/invoices/${hash}`),
  getNextDisplayId: () => api.get<number>('/payment-requests/next-display-id'),
  getNextDisplayIdFresh: () => api.get<number>('/payment-requests/next-display-id'),
  getByRetreat: (retreatId: string) => cachedGet<PaymentRequest[]>(`payment-requests:retreat:${retreatId}`, () => api.get<PaymentRequest[]>(`/payment-requests?retreatId=${retreatId}`)),
  getByClient: (clientId: string) => cachedGet<PaymentRequest[]>(`payment-requests:client:${clientId}`, () => api.get<PaymentRequest[]>(`/payment-requests?clientId=${clientId}`)),
  create: (data: Omit<PaymentRequest, '_id'>) => {
    cacheService.clearPattern('payment-requests:');
    return api.post<PaymentRequest>('/payment-requests', data);
  },
  update: (id: string, data: Partial<PaymentRequest>) => {
    cacheService.clearPattern('payment-requests:');
    return api.put<PaymentRequest>(`/payment-requests/${id}`, data);
  },
  delete: (id: string) => {
    cacheService.clearPattern('payment-requests:');
    return api.delete(`/payment-requests/${id}`);
  },
  markAsPaid: (id: string, paymentId: string) => {
    cacheService.clearPattern('payment-requests:');
    cacheService.clearPattern('payments:');
    return api.put<PaymentRequest>(`/payment-requests/${id}/mark-paid`, { paymentId });
  },
  markAsOverdue: (id: string) => {
    cacheService.clearPattern('payment-requests:');
    return api.put<PaymentRequest>(`/payment-requests/${id}/mark-overdue`);
  },
  sendReminder: (id: string) => {
    cacheService.clearPattern('payment-requests:');
    return api.put<PaymentRequest>(`/payment-requests/${id}/send-reminder`);
  },
};

export const bloodPressureReadingsApi = {
  getByClient: (clientId: string) => api.get<BloodPressureReading[]>(`/blood-pressure-readings?clientId=${encodeURIComponent(clientId)}`),
  create: (data: Partial<BloodPressureReading> & { clientId: string; systolic: number; diastolic: number; recordedAt: string }) => api.post<BloodPressureReading>('/blood-pressure-readings', data),
  update: (id: string, data: Partial<BloodPressureReading>) => api.patch<BloodPressureReading>(`/blood-pressure-readings/${id}`, data),
  delete: (id: string) => api.delete<{ deleted: boolean; id: string }>(`/blood-pressure-readings/${id}`),
};

export const communicationsApi = {
  getSettings: (config: any = {}) => api.get<MailSettings>('/communications/settings', config),
  saveSettings: (data: Partial<MailSettings>) => api.patch<MailSettings>('/communications/settings', data),
  getAuthUrl: () => api.get<{ authUrl: string; state: string; redirectUri: string }>('/communications/gmail/auth-url'),
  disconnect: () => api.post<MailSettings>('/communications/gmail/disconnect', {}),
  testConnection: () => api.post<{ settings: MailSettings; profile: Record<string, any> }>('/communications/gmail/test', {}),
  getTemplates: () => cachedGet<EmailTemplate[]>('communications:templates', () => api.get<EmailTemplate[]>('/communications/templates')),
  getTemplate: (id: string) => cachedGet<EmailTemplate>(`communications:templates:${id}`, () => api.get<EmailTemplate>(`/communications/templates/${id}`)),
  getTemplateByCategoryAndLanguage: (category: string, language: string) => cachedGet<EmailTemplate>(
    `communications:templates:${category}:${language}`,
    () => api.get<EmailTemplate>(`/communications/templates/category/${category}/${language}`)
  ),
  getTemplateSeedOptions: () => api.get<EmailTemplateSeedOption[]>('/communications/templates/seed-options'),
  getNextTemplateDisplayId: () => api.get<number>('/communications/templates/next-display-id'),
  seedDefaultTemplates: (options: { overwrite?: boolean; templateKey?: string; language?: string; templateSelections?: Array<{ templateKey?: string; language?: string }> } = {}) => {
    cacheService.clearPattern('communications:templates');
    return api.post<{ created: number; updated: number; skipped: number; templates: EmailTemplate[] }>('/communications/templates/seed-defaults', options);
  },
  createTemplate: (data: Omit<EmailTemplate, '_id' | 'createdAt' | 'updatedAt'>) => {
    cacheService.clearPattern('communications:templates');
    return api.post<EmailTemplate>('/communications/templates', data);
  },
  updateTemplate: (id: string, data: Partial<EmailTemplate>) => {
    cacheService.clearPattern('communications:templates');
    return api.patch<EmailTemplate>(`/communications/templates/${id}`, data);
  },
  deleteTemplate: (id: string) => {
    cacheService.clearPattern('communications:templates');
    return api.delete(`/communications/templates/${id}`);
  },
  getSentEmails: (params: { clientId?: string; bookingId?: string; retreatId?: string; relatedEntityType?: string; relatedEntityId?: string } = {}, config: any = {}) => {
    const query = new URLSearchParams();
    if (params.clientId) query.set('clientId', params.clientId);
    if (params.bookingId) query.set('bookingId', params.bookingId);
    if (params.retreatId) query.set('retreatId', params.retreatId);
    if (params.relatedEntityType) query.set('relatedEntityType', params.relatedEntityType);
    if (params.relatedEntityId) query.set('relatedEntityId', params.relatedEntityId);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    if (config?.suppressGlobalError) return api.get<SentEmail[]>(`/communications/sent-emails${suffix}`, config);
    return cachedGet<SentEmail[]>(`communications:sent-emails${suffix}`, () => api.get<SentEmail[]>(`/communications/sent-emails${suffix}`));
  },
  getSentEmail: (id: string) => cachedGet<SentEmail>(`communications:sent-emails:${id}`, () => api.get<SentEmail>(`/communications/sent-emails/${id}`)),
  deleteSentEmail: (id: string) => {
    cacheService.clearPattern('communications:sent-emails');
    return api.delete(`/communications/sent-emails/${id}`);
  },
  setupGmailWatch: () => api.post('/communications/gmail/watch', {}),
  getInboundEmails: (params: { status?: string; limit?: number; clientId?: string } = {}, config: any = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.limit) query.set('limit', String(params.limit));
    if (params.clientId) query.set('clientId', params.clientId);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return api.get(`/communications/inbound-emails${suffix}`, config);
  },
  getInboundEmailJobs: (limit = 100) => api.get(`/communications/inbound-email-jobs?limit=${limit}`),
  processInboundEmails: (limit = 25) => {
    cacheService.clearPattern('communications:');
    return api.post('/communications/inbound-emails/process', { limit });
  },
  reprocessInboundEmail: (id: string) => {
    cacheService.clearPattern('communications:');
    return api.post(`/communications/inbound-emails/${id}/reprocess`, {});
  },
  updateInboundEmail: (id: string, data: any) => {
    cacheService.clearPattern('communications:');
    return api.patch(`/communications/inbound-emails/${id}`, data);
  },
  sendEmail: (data: {
    to: string;
    cc?: string;
    bcc?: string;
    subject?: string;
    bodyText?: string;
    bodyHtml?: string;
    templateId?: string;
    clientId?: string;
    retreatId?: string;
    bookingId?: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
    actionKey?: string;
    actionLabel?: string;
    bookingFlowStepKey?: string;
    bookingFlowStatusOnSend?: string;
    fromName?: string;
    fromEmail?: string;
    replyTo?: string;
    variables?: Record<string, any>;
    attachments?: Array<{
      fileName: string;
      mimeType?: string;
      contentBase64: string;
    }>;
    createdBy?: string;
  }) => {
    cacheService.clearPattern('communications:sent-emails');
    return api.post<SentEmail>('/communications/send', data);
  },
  sendRetreatEmail: (retreatId: string, data: {
    subject: string;
    bodyText: string;
    bodyHtml?: string;
    templateId?: string;
    cc?: string;
    bcc?: string;
    fromName?: string;
    fromEmail?: string;
    replyTo?: string;
    bookingFlowStepKey?: string;
    bookingFlowStatusOnSend?: string;
    excludedClientIds?: string[];
    variables?: Record<string, any>;
    attachments?: Array<{
      fileName: string;
      mimeType?: string;
      contentBase64: string;
    }>;
  }) => {
    cacheService.clearPattern('communications:sent-emails');
    return api.post<{
      retreatId: string;
      batchId: string;
      totalBookings: number;
      sent: number;
      failed: number;
      skipped: number;
      results: any[];
    }>(`/communications/retreats/${retreatId}/send`, data);
  },
};

export const screeningClientsApi = {
  getAll: () => cachedGet<ScreeningClient[]>('screening:all', () => api.get<ScreeningClient[]>('/screening-clients')),
  getOne: (id: string) => cachedGet<ScreeningClient>(`screening:${id}`, () => api.get<ScreeningClient>(`/screening-clients/${id}`)),
  getByStatus: (status: string) => cachedGet<ScreeningClient[]>(`screening:status:${status}`, () => api.get<ScreeningClient[]>(`/screening-clients?status=${status}`)),
  getOverdue: () => cachedGet<ScreeningClient[]>('screening:overdue', () => api.get<ScreeningClient[]>('/screening-clients/overdue')),
  create: (data: Omit<ScreeningClient, '_id'>) => {
    cacheService.clearPattern('screening:');
    return api.post<ScreeningClient>('/screening-clients', data);
  },
  update: (id: string, data: Partial<ScreeningClient>) => {
    cacheService.clearPattern('screening:');
    return api.patch<ScreeningClient>(`/screening-clients/${id}`, data);
  },
  delete: (id: string) => {
    cacheService.clearPattern('screening:');
    return api.delete(`/screening-clients/${id}`);
  },
  promoteToClient: (id: string) => {
    cacheService.clearPattern('screening:');
    cacheService.clearPattern('clients:'); // Clear clients cache as we're creating a new client
    return api.post<{ screeningClient: ScreeningClient; client: Client }>(`/screening-clients/${id}/promote`, {});
  },
};

export const requirementsApi = {
  getAll: () => cachedGet<Requirement[]>('requirements:all', () => api.get<Requirement[]>('/requirements')),
  getOne: (id: string) => cachedGet<Requirement>(`requirements:${id}`, () => api.get<Requirement>(`/requirements/${id}`)),
  getByCategory: (category: string) => cachedGet<Requirement[]>(`requirements:cat:${category}`, () => api.get<Requirement[]>(`/requirements/category/${category}`)),
  create: (data: Omit<Requirement, '_id'>) => api.post<Requirement>('/requirements', data),
  update: (id: string, data: Partial<Requirement>) => api.patch<Requirement>(`/requirements/${id}`, data),
  updateOrder: (requirements: { id: string; order: number }[]) => api.put('/requirements/reorder', requirements),
  delete: (id: string) => api.delete(`/requirements/${id}`),
  seed: () => api.post('/requirements/seed', {}),
};

export const clientRequirementsApi = {
  getAll: () => api.get<ClientRequirement[]>('/client-requirements'),
  getOne: (id: string) => api.get<ClientRequirement>(`/client-requirements/${id}`),
  getByClient: (clientId: string) => api.get<ClientRequirement[]>(`/client-requirements/client/${clientId}`),
  getByRetreat: (retreatId: string) => api.get<ClientRequirement[]>(`/client-requirements/retreat/${retreatId}`),
  getByClientAndRetreat: (clientId: string, retreatId: string) => api.get<ClientRequirement[]>(`/client-requirements/client/${clientId}/retreat/${retreatId}`),
  getRetreatOverview: (retreatId: string) => api.get<any>(`/client-requirements/retreat/${retreatId}/overview`),
  create: (data: Omit<ClientRequirement, '_id'>) => api.post<ClientRequirement>('/client-requirements', data),
  update: (id: string, data: Partial<ClientRequirement>) => api.patch<ClientRequirement>(`/client-requirements/${id}`, data),
  uploadFile: (id: string, file: File, uploadDir?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    const url = `/client-requirements/${id}/upload${uploadDir ? `?uploadDir=${uploadDir}` : ''}`;
    return api.post<ClientRequirement>(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  markReceived: (id: string, data: any) => api.patch<ClientRequirement>(`/client-requirements/${id}/received`, data),
  markReviewed: (id: string, reviewerNotes: string) => api.patch<ClientRequirement>(`/client-requirements/${id}/reviewed`, { reviewerNotes }),
  markApproved: (id: string, approvedBy: string, notes?: string) => api.patch<ClientRequirement>(`/client-requirements/${id}/approved`, { approvedBy, notes }),
  markRejected: (id: string, rejectedBy: string, rejectionReason: string) => api.patch<ClientRequirement>(`/client-requirements/${id}/rejected`, { rejectedBy, rejectionReason }),
  initialize: (clientId: string, retreatId: string) => api.post<ClientRequirement[]>(`/client-requirements/initialize/${clientId}/${retreatId}`, {}),
  delete: (id: string) => api.delete(`/client-requirements/${id}`),
};

export const ceremoniesApi = {
  getAll: () => api.get<Ceremony[]>('/ceremonies'),
  getOne: (id: string) => api.get<Ceremony>(`/ceremonies/${id}`),
  getByRetreat: (retreatId: string) => api.get<Ceremony[]>(`/ceremonies/retreat/${retreatId}`),
  create: (data: Omit<Ceremony, '_id'>) => api.post<Ceremony>('/ceremonies', data),
  update: (id: string, data: Partial<Ceremony>) => api.patch<Ceremony>(`/ceremonies/${id}`, data),
  updateStatus: (id: string, status: string) => api.patch<Ceremony>(`/ceremonies/${id}/status`, { status }),
  updateMedicalApproval: (id: string, approvalData: any) => api.patch<Ceremony>(`/ceremonies/${id}/medical-approval`, approvalData),
  delete: (id: string) => api.delete(`/ceremonies/${id}`),

  // Participant endpoints
  addParticipant: (data: Omit<CeremonyParticipant, '_id'>) => api.post<CeremonyParticipant>('/ceremonies/participant', data),
  getParticipants: (ceremonyId: string) => api.get<CeremonyParticipant[]>(`/ceremonies/${ceremonyId}/participants`),
  getClientParticipations: (clientId: string) => api.get<CeremonyParticipant[]>(`/ceremonies/client/${clientId}/participations`),
  updateParticipant: (id: string, data: Partial<CeremonyParticipant>) => api.patch<CeremonyParticipant>(`/ceremonies/participant/${id}`, data),
  updateMedicalCheck: (id: string, medicalData: any) => api.patch<CeremonyParticipant>(`/ceremonies/participant/${id}/medical`, medicalData),
  recordSpoonIntake: (id: string, spoonData: any) => api.patch<CeremonyParticipant>(`/ceremonies/participant/${id}/spoons`, spoonData),
  recordPurge: (id: string, purgeData: any) => api.patch<CeremonyParticipant>(`/ceremonies/participant/${id}/purge`, purgeData),
  getRetreatSummary: (retreatId: string) => api.get<any>(`/ceremonies/retreat/${retreatId}/summary`),
};

// Export the base api instance and Client type for use in other services
export { api };
export type { Client };

const medicalTrackingBaseUrl = '/client-medical';

export const medicalTrackingApi = {
  getAll: () => cachedGet<MedicalItem[]>('medical-tracking:all', () => api.get<MedicalItem[]>(medicalTrackingBaseUrl)),
  getNextDisplayId: async () => {
    const response = await medicalTrackingApi.getAll();
    const items = response.data || [];
    const nextDisplayId = items.reduce((max: number, item: MedicalItem) => {
      return Math.max(max, Number(item.display_id) || 0);
    }, 1000) + 1;
    return { data: nextDisplayId };
  },
  getOne: (id: string) => cachedGet<MedicalItem>(`medical-tracking:${id}`, () => api.get<MedicalItem>(`${medicalTrackingBaseUrl}/${id}`)),
  getByClient: (clientId: string) => cachedGet<MedicalItem[]>(`medical-tracking:client:${clientId}`, () => api.get<MedicalItem[]>(`${medicalTrackingBaseUrl}/client/${clientId}`)),
  getByType: async (type: 'EKG' | 'Liver' | 'Question') => {
    const response = await medicalTrackingApi.getAll();
    return { data: (response.data || []).filter((item: MedicalItem) => item.type === type) };
  },
  create: (data: Omit<MedicalItem, '_id'>) => {
    cacheService.clearPattern('medical-tracking:');
    return api.post<MedicalItem>(medicalTrackingBaseUrl, data);
  },
  update: (id: string, data: Partial<MedicalItem>) => {
    cacheService.clearPattern('medical-tracking:');
    return api.patch<MedicalItem>(`${medicalTrackingBaseUrl}/${id}`, data);
  },
  reviewItem: (id: string, reviewData: {
    medadvisor_review_result: 'OK' | 'caution' | 'NOT OK';
    medadvisor_review_notes: string;
    medadvisor_review_date?: Date | string;
  }) => {
    cacheService.clearPattern('medical-tracking:');
    return api.patch<MedicalItem>(`${medicalTrackingBaseUrl}/${id}`, reviewData);
  },
  uploadImage: (id: string, file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    cacheService.clearPattern('medical-tracking:');
    return api.post<MedicalItem>(`${medicalTrackingBaseUrl}/${id}/upload-image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  uploadFiles: (id: string, files: File[]) => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });
    cacheService.clearPattern('medical-tracking:');
    return api.post(`${medicalTrackingBaseUrl}/${id}/upload-files`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  getFileUrl: (id: string, filePathOrKey: string) => {
    const normalized = (filePathOrKey || '').toLowerCase();
    const type = normalized.includes('liver') ? 'liver-panel' : 'ekg';
    return api.get(`${medicalTrackingBaseUrl}/${id}/file/${type}`, { responseType: 'blob' });
  },
  delete: (id: string) => {
    cacheService.clearPattern('medical-tracking:');
    return api.delete(`${medicalTrackingBaseUrl}/${id}`);
  },
};

// Medical Advisor API - restricted access for medical advisors only
export const medicalAdvisorApi = {
  // Get medical tracking items for review (medical advisor only)
  getMedicalTracking: () => cachedGet<MedicalItem[]>('medical-advisor:tracking', () => api.get<MedicalItem[]>('/medical-advisor/medical-tracking')),

  // Get specific medical tracking item for review
  getMedicalTrackingItem: (id: string) => cachedGet<MedicalItem>(`medical-advisor:tracking:${id}`, () => api.get<MedicalItem>(`/medical-advisor/medical-tracking/${id}`)),

  // Review medical tracking item (approve/deny/caution)
  reviewMedicalTracking: (id: string, reviewData: {
    medadvisor_review_result: 'OK' | 'caution' | 'NOT OK';
    medadvisor_review_notes: string;
  }) => {
    cacheService.clearPattern('medical-advisor:');
    return api.patch<MedicalItem>(`/medical-advisor/medical-tracking/${id}/review`, reviewData);
  },

  // Get basic client info for medical review
  getClientInfo: (clientId: string) => cachedGet<Client>(`medical-advisor:client:${clientId}`, () => api.get<Client>(`/medical-advisor/client/${clientId}`)),

  // Get dashboard statistics
  getDashboardStats: () => cachedGet<any>('medical-advisor:stats', () => api.get<any>('/medical-advisor/dashboard/stats'), 30000), // 30 second cache
};

export const medicalArtifactsApi = {
  getForBooking: (bookingId: string) => api.get<MedicalArtifact[]>(`/medical-artifacts/booking/${encodeURIComponent(bookingId)}`),
  getAll: (filters: {
    clientId?: string;
    retreatId?: string;
    bookingId?: string;
    bookingFlowItemId?: string;
    bookingFlowItemKey?: string;
    ceremonyId?: string;
    artifactType?: MedicalArtifact['artifactType'];
    status?: MedicalArtifact['status'];
    contextType?: MedicalArtifact['contextType'];
    purpose?: MedicalArtifact['purpose'];
    documentStage?: MedicalArtifact['documentStage'];
    documentType?: MedicalArtifact['documentType'];
    summary?: boolean;
  } = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
    });
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return cachedGet<MedicalArtifact[]>(`medical-artifacts:${suffix || 'all'}`, () => api.get<MedicalArtifact[]>(`/medical-artifacts${suffix}`));
  },
  getRetreatSubmissions: (filters: {
    retreat: string;
    artifactType?: MedicalArtifact['artifactType'] | 'all';
    documentStage?: MedicalArtifact['documentStage'] | 'all';
    status?: 'all' | 'missing' | 'received';
    search?: string;
  }) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== 'all') params.set(key, value);
    });
    return api.get<RetreatArtifactSubmissionsResponse>(`/medical-artifacts/retreat-submissions?${params.toString()}`);
  },
  getOne: (id: string) => cachedGet<MedicalArtifact>(`medical-artifacts:${id}`, () => api.get<MedicalArtifact>(`/medical-artifacts/${id}`)),
  getNextDisplayId: () => api.get<number>('/medical-artifacts/next-display-id'),
  getUploadTargetPreview: (artifactType: NonNullable<MedicalArtifact['artifactType']>, fileName?: string) => api.get<{
    storage: string;
    bucket: string | null;
    keyPattern: string;
    note: string;
    requiredEnvironment?: string[];
  }>(`/medical-artifacts/upload-target/preview?artifactType=${encodeURIComponent(artifactType)}&fileName=${encodeURIComponent(fileName || 'medical-record.pdf')}`),
  create: (data: MedicalArtifactCreateInput) => {
    cacheService.clearPattern('medical-artifacts:');
    return api.post<MedicalArtifact>('/medical-artifacts', data);
  },
  uploadFiles: (id: string, files: File[], options: { reviewRequestNumber?: number | string } = {}) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    cacheService.clearPattern('medical-artifacts:');
    const params = new URLSearchParams();
    if (options.reviewRequestNumber) params.set('reviewRequestNumber', String(options.reviewRequestNumber));
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const fileSummary = files.map((file) => ({
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified,
    }));
    console.debug('[medical-artifact-upload] starting', {
      artifactId: id,
      reviewRequestNumber: options.reviewRequestNumber,
      fileCount: files.length,
      files: fileSummary,
    });
    return api.post(`/medical-artifacts/${id}/upload-files${suffix}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((response) => {
      console.debug('[medical-artifact-upload] success', {
        artifactId: id,
        status: response.status,
        response: response.data,
      });
      return response;
    }).catch((error) => {
      console.error('[medical-artifact-upload] failed', {
        artifactId: id,
        status: error?.response?.status,
        response: error?.response?.data,
        files: fileSummary,
        requestUrl: error?.config?.url,
        method: error?.config?.method,
        message: error?.message,
      });
      throw error;
    });
  },
  deleteFile: (id: string, storedPath: string) => {
    cacheService.clearPattern('medical-artifacts:');
    return api.delete<MedicalArtifact>(`/medical-artifacts/${id}/files?storedPath=${encodeURIComponent(storedPath)}`);
  },
  getFileBlob: (id: string, storedPath: string) => {
    const legacyFileUploadMatch = storedPath.match(/(?:^|\/)file-uploads\/view\/([^/?#]+)/);
    if (legacyFileUploadMatch?.[1]) {
      return api.get(`/file-uploads/view/${encodeURIComponent(legacyFileUploadMatch[1])}`, { responseType: 'blob', suppressGlobalError: true } as any);
    }
    return api.get(`/medical-artifacts/${id}/files/view?storedPath=${encodeURIComponent(storedPath)}`, { responseType: 'blob', suppressGlobalError: true } as any);
  },
  update: (id: string, data: Partial<MedicalArtifact>) => {
    cacheService.clearPattern('medical-artifacts:');
    return api.patch<MedicalArtifact>(`/medical-artifacts/${id}`, data);
  },
  delete: (id: string) => {
    cacheService.clearPattern('medical-artifacts:');
    return api.delete(`/medical-artifacts/${id}`);
  },
};

export const helperAccessApi = {
  getCurrentRetreat: () => cachedGet<any>('helper-current-retreat', () => api.get('/helper/current-retreat'), 15000),
  uploadEkg: (bookingId: string, files: File[], data: { notes?: string; receivedAt?: string } = {}) => {
    const formData = new FormData();
    formData.append('bookingId', bookingId);
    if (data.notes !== undefined) formData.append('notes', data.notes);
    if (data.receivedAt) formData.append('receivedAt', data.receivedAt);
    files.forEach((file) => formData.append('files', file));
    cacheService.clearPattern('helper-current-retreat');
    cacheService.clearPattern('medical-artifacts:');
    return api.post('/helper/current-retreat/ekg', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  createBloodPressure: (bookingId: string, data: {
    systolic: number | string;
    diastolic: number | string;
    pulse?: number | string;
    measuredAt?: string;
    notes?: string;
  }) => {
    cacheService.clearPattern('helper-current-retreat');
    cacheService.clearPattern('medical-artifacts:');
    return api.post('/helper/current-retreat/blood-pressure', { bookingId, ...data });
  },
  updateRecord: (id: string, data: Record<string, any>) => {
    cacheService.clearPattern('helper-current-retreat');
    cacheService.clearPattern('medical-artifacts:');
    return api.patch(`/helper/current-retreat/records/${id}`, data);
  },
  deleteRecord: (id: string) => {
    cacheService.clearPattern('helper-current-retreat');
    cacheService.clearPattern('medical-artifacts:');
    return api.delete(`/helper/current-retreat/records/${id}`);
  },
};

export const fileUploadsApi = {
  upload: (formData: FormData) => {
    cacheService.clearPattern('file-uploads:');
    return api.post<FileUpload>('/file-uploads/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  getAll: (filters: { documentKind?: FileUpload['documentKind']; foreignKey?: string; isActive?: boolean; uploadedBy?: string } = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params.set(key, String(value));
    });
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return cachedGet<FileUpload[]>(`file-uploads:${suffix || 'all'}`, () => api.get<FileUpload[]>(`/file-uploads${suffix}`));
  },
  getStats: () => cachedGet<any>('file-uploads:stats', () => api.get('/file-uploads/stats')),
  getViewBlob: (fileHash: string) =>
    api.get(`/file-uploads/view/${fileHash}`, { responseType: 'blob', suppressGlobalError: true } as any),
};

export const jotformApi = {
  resolveContractLink: (bookingId: string) => api.get<{ redirectUrl: string }>(`/jotform/contracts/link/${bookingId}`, {
    suppressAuthRedirect: true,
  } as any),
};

export const configSummaryApi = {
  get: () => api.get('/config-summary'),
};

export const auditLogsApi = {
  getAll: (filters: {
    action?: string;
    entityType?: string;
    entityId?: string;
    actorEmail?: string;
    keyword?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  } = {}) => api.get('/audit-logs', { params: filters }),
  getOne: (id: string) => api.get(`/audit-logs/${id}`),
};

export const backupsApi = {
  exportBackup: (options: { redactEmails?: boolean; emailReplacement?: string; collections?: string } = {}) =>
    api.get('/backups/export', {
      params: options,
      responseType: 'blob',
    }),
  importBackup: (file: File, options: {
    dryRun?: boolean;
    confirm?: string;
    emailMode?: 'preserve' | 'override';
    overrideEmail?: string;
    collections?: string;
  } = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/backups/import', formData, {
      params: {
        dryRun: options.dryRun === false ? 'false' : 'true',
        confirm: options.confirm,
        emailMode: options.emailMode || 'preserve',
        overrideEmail: options.overrideEmail,
        collections: options.collections,
      },
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  exportToS3: (options: {
    bucket?: string;
    environment?: string;
    compress?: boolean;
    redactEmails?: boolean;
    emailReplacement?: string;
    collections?: string;
  } = {}) => api.post('/backups/s3/export', {}, { params: options }),
  listS3Files: (options: {
    bucket?: string;
    environment?: string;
    prefix?: string;
    maxKeys?: number;
    continuationToken?: string;
  } = {}) => api.get('/backups/s3/files', { params: options }),
  downloadS3File: (options: { bucket?: string; key: string }) =>
    api.get('/backups/s3/download', {
      params: options,
      responseType: 'blob',
    }),
  importFromS3: (options: {
    bucket?: string;
    key: string;
    dryRun?: boolean;
    confirm?: string;
    emailMode?: 'preserve' | 'override';
    overrideEmail?: string;
    collections?: string;
  }) => api.post('/backups/s3/import', {}, {
    params: {
      ...options,
      dryRun: options.dryRun === false ? 'false' : 'true',
    },
  }),
  getLogs: (filters: { action?: string; storage?: string; limit?: number } = {}) =>
    api.get('/backups/logs', { params: filters }),
};

export const medicalReviewRequestsApi = {
  getAll: (filters: {
    clientId?: string;
    retreatId?: string;
    bookingFlowItemId?: string;
    medicalTrackingId?: string;
    artifactId?: string;
    bookingId?: string;
    documentStage?: MedicalArtifact['documentStage'];
    documentType?: MedicalArtifact['documentType'];
    artifactType?: MedicalArtifact['artifactType'];
    requestType?: MedicalReviewRequest['requestType'];
  } = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return cachedGet<MedicalReviewRequest[]>(`medical-review-requests:${suffix || 'all'}`, () => api.get<MedicalReviewRequest[]>(`/medical-review-requests${suffix}`));
  },
  getQueue: () => cachedGet<MedicalReviewRequest[]>('medical-review-requests:queue', () => api.get<MedicalReviewRequest[]>('/medical-review-requests/queue')),
  getOne: (id: string) => cachedGet<MedicalReviewRequest>(`medical-review-requests:${id}`, () => api.get<MedicalReviewRequest>(`/medical-review-requests/${id}`)),
  getContext: (id: string) => cachedGet<any>(`medical-review-requests:${id}:context`, () => api.get<any>(`/medical-review-requests/${id}/context`)),
  getByClientAndRetreat: (clientId: string, retreatId: string) => cachedGet<MedicalReviewRequest[]>(`medical-review-requests:${clientId}:${retreatId}`, () => api.get<MedicalReviewRequest[]>(`/medical-review-requests?clientId=${clientId}&retreatId=${retreatId}`)),
  getByMedicalTracking: (medicalTrackingId: string) => cachedGet<MedicalReviewRequest[]>(`medical-review-requests:tracking:${medicalTrackingId}`, () => api.get<MedicalReviewRequest[]>(`/medical-review-requests?medicalTrackingId=${medicalTrackingId}`)),
  getByArtifact: (artifactId: string) => cachedGet<MedicalReviewRequest[]>(`medical-review-requests:artifact:${artifactId}`, () => api.get<MedicalReviewRequest[]>(`/medical-review-requests?artifactId=${artifactId}`)),
  getByArtifacts: (artifactIds: string[]) => {
    const normalizedIds = Array.from(new Set(artifactIds.filter(Boolean))).sort();
    if (!normalizedIds.length) {
      return Promise.resolve({ data: [] as MedicalReviewRequest[] });
    }
    return cachedGet<MedicalReviewRequest[]>(
      `medical-review-requests:artifacts:${normalizedIds.join(',')}`,
      () => api.get<MedicalReviewRequest[]>(`/medical-review-requests/by-artifacts?artifactIds=${encodeURIComponent(normalizedIds.join(','))}`)
    );
  },
  getNextDisplayId: () => api.get<number>('/medical-review-requests/next-display-id'),
  create: (data: Omit<MedicalReviewRequest, '_id'>) => {
    cacheService.clearPattern('medical-review-requests:');
    return api.post<MedicalReviewRequest>('/medical-review-requests', data);
  },
  createFromTracking: (medicalTrackingId: string, requestType?: 'ekg' | 'liver' | 'both', data: Partial<MedicalReviewRequest> = {}) => {
    cacheService.clearPattern('medical-review-requests:');
    return api.post<MedicalReviewRequest>(`/medical-review-requests/from-tracking/${medicalTrackingId}`, { ...data, requestType });
  },
  createFromArtifact: (artifactId: string, requestType?: MedicalReviewRequest['requestType'], data: Partial<MedicalReviewRequest> = {}) => {
    cacheService.clearPattern('medical-review-requests:');
    return api.post<MedicalReviewRequest>(`/medical-review-requests/from-artifact/${artifactId}`, { ...data, requestType });
  },
  update: (id: string, data: Partial<MedicalReviewRequest>) => {
    cacheService.clearPattern('medical-review-requests:');
    return api.patch<MedicalReviewRequest>(`/medical-review-requests/${id}`, data);
  },
  getPublic: (token: string) => api.get<{ request: MedicalReviewRequest; artifacts: MedicalArtifact[] }>(
    `/medical-review-public/${encodeURIComponent(token)}`,
    { suppressAuthRedirect: true, suppressGlobalError: true } as any
  ),
  exchangeAccessLink: (token: string) => api.post<{
    access_token: string;
    expiresAt: string;
    redirectTo: string;
    reviewRequestId: string;
    user: {
      id?: string;
      email: string;
      role: string;
      firstName?: string;
      lastName?: string;
      accessType?: string;
      medicalReviewRequestId?: string;
      accessLinkId?: string;
    };
  }>(
    `/medical-review-public/access/${encodeURIComponent(token)}`,
    {},
    { suppressAuthRedirect: true, suppressGlobalError: true } as any
  ),
  getAccessLinks: (id: string) => api.get<any[]>(`/medical-review-requests/${id}/access-links`),
  createAccessLink: (id: string) => api.post<any>(`/medical-review-requests/${id}/access-links`, {}),
  revokeAccessLink: (accessLinkId: string) => api.patch<any>(`/medical-review-requests/access-links/${accessLinkId}/revoke`, {}),
  getGroups: () => api.get<MedicalReviewGroup[]>('/medical-review-requests/groups'),
  getGroup: (id: string) => api.get<MedicalReviewGroup>(`/medical-review-requests/groups/${id}`),
  getGroupAccessLinks: (id: string) => api.get<MedicalReviewGroupAccessLink[]>(`/medical-review-requests/groups/${id}/access-links`),
  issueGroupAccessLink: (id: string, data: { expiresInDays?: number } = {}) => api.post<MedicalReviewGroupAccessLink>(`/medical-review-requests/groups/${id}/access-links`, data),
  revokeGroupAccessLink: (accessLinkId: string) => api.patch<MedicalReviewGroupAccessLink>(`/medical-review-requests/groups/access-links/${accessLinkId}/revoke`, {}),
  reorderGroups: (orderedGroupIds: string[]) => {
    cacheService.clearPattern('medical-review-requests:');
    return api.patch<MedicalReviewGroup[]>('/medical-review-requests/groups/order', { orderedGroupIds });
  },
  updateGroup: (id: string, data: {
    title?: string;
    groupType?: 'retreat' | 'ceremony' | 'custom';
    retreatId?: string;
    ceremonyNumber?: number;
    sortOrder?: number;
    reviewRequestIds?: string[];
    removeReviewRequestIds?: string[];
    replaceReviewRequestIds?: string[];
    reviewerUserId?: string;
  }) => {
    cacheService.clearPattern('medical-review-requests:');
    return api.patch<MedicalReviewGroup>(`/medical-review-requests/groups/${id}`, data);
  },
  addRequestsToGroup: (id: string, reviewRequestIds: string[]) => {
    cacheService.clearPattern('medical-review-requests:');
    return api.post<MedicalReviewGroup>(`/medical-review-requests/groups/${id}/requests`, { reviewRequestIds });
  },
  deleteGroup: (id: string) => {
    cacheService.clearPattern('medical-review-requests:');
    return api.delete<{ deleted: boolean; groupId: string; removedRequestIds: string[] }>(`/medical-review-requests/groups/${id}`);
  },
  createGroup: (data: {
    title?: string;
    groupType?: 'retreat' | 'ceremony' | 'custom';
    retreatId?: string;
    ceremonyNumber?: number;
    reviewRequestIds: string[];
    reviewerUserId: string;
    expiresInDays?: number;
  }) => {
    cacheService.clearPattern('medical-review-requests:');
    return api.post<any>('/medical-review-requests/groups', data);
  },
  exchangeGroupAccessLink: (token: string) => api.post<{
    access_token: string;
    expiresAt: string;
    redirectTo: string;
    reviewGroupId: string;
    user: {
      id?: string;
      email: string;
      role: string;
      firstName?: string;
      lastName?: string;
      accessType?: string;
      medicalReviewGroupId?: string;
    };
  }>(
    `/medical-review-public/group-access/${encodeURIComponent(token)}`,
    {},
    { suppressAuthRedirect: true, suppressGlobalError: true } as any
  ),
  review: (id: string, reviewData: {
    status?: string;
    reviewDecision?: 'OK' | 'caution' | 'more_info_needed' | 'NOT OK';
    reviewNotes?: string;
    overallNotes?: string;
    medicalStaffNotes?: string;
    fileReviews?: MedicalReviewRequest['fileReviews'];
    ekgReviewDecision?: 'OK' | 'caution' | 'NOT OK';
    ekgReviewNotes?: string;
    liverReviewDecision?: 'OK' | 'caution' | 'NOT OK';
    liverReviewNotes?: string;
    reviewedBy?: string;
    followUpDeadline?: string;
    followUpEmailTemplateId?: string;
  }) => {
    cacheService.clearPattern('medical-review-requests:');
    return api.patch<MedicalReviewRequest>(`/medical-review-requests/${id}/review`, reviewData);
  },
  resetReview: (id: string, reason?: string) => {
    cacheService.clearPattern('medical-review-requests:');
    return api.patch<MedicalReviewRequest>(`/medical-review-requests/${id}/reset-review`, { reason });
  },
  delete: (id: string) => {
    cacheService.clearPattern('medical-review-requests:');
    return api.delete(`/medical-review-requests/${id}`);
  },
};

export const bookingFlowApi = {
  getTemplates: (retreatId: string) => cachedGet<BookingFlowTemplate[]>(`booking-flow:templates:${retreatId}`, () => api.get<BookingFlowTemplate[]>(`/booking-flow/templates?retreatId=${retreatId}`)),
  getLibraryTemplates: () => cachedGet<BookingFlowTemplate[]>(
    'booking-flow:library:templates',
    async () => {
      try {
        return await api.get<BookingFlowTemplate[]>('/booking-flow/library/templates');
      } catch (error: any) {
        if (error?.response?.status === 404) {
          return api.get<BookingFlowTemplate[]>('/booking-flow/templates?templateScope=global');
        }
        throw error;
      }
    }
  ),
  exportLibraryBackup: () => api.get<any>('/booking-flow/library/backup/export'),
  previewLibraryImport: (backup: any, mode: 'merge_by_key' | 'restore_exact_ids') => api.post<any>('/booking-flow/library/backup/preview', { backup, mode }),
  importLibraryBackup: (backup: any, mode: 'merge_by_key' | 'restore_exact_ids') => {
    cacheService.clearPattern('booking-flow:');
    return api.post<any>('/booking-flow/library/backup/import', { backup, mode });
  },
  createTemplate: (data: Omit<BookingFlowTemplate, '_id'>) => {
    cacheService.clearPattern('booking-flow:');
    return api.post<BookingFlowTemplate>('/booking-flow/templates', data);
  },
  createLibraryTemplate: (data: Omit<BookingFlowTemplate, '_id'>) => {
    cacheService.clearPattern('booking-flow:');
    return api.post<BookingFlowTemplate>('/booking-flow/library/templates', data);
  },
  updateTemplate: (id: string, data: Partial<BookingFlowTemplate>) => {
    cacheService.clearPattern('booking-flow:');
    return api.patch<BookingFlowTemplate>(`/booking-flow/templates/${id}`, data);
  },
  updateLibraryTemplate: (id: string, data: Partial<BookingFlowTemplate>) => {
    cacheService.clearPattern('booking-flow:');
    return api.patch<BookingFlowTemplate>(`/booking-flow/library/templates/${id}`, data);
  },
  deleteTemplate: (id: string) => {
    cacheService.clearPattern('booking-flow:');
    return api.delete(`/booking-flow/templates/${id}`);
  },
  deleteLibraryTemplate: (id: string) => {
    cacheService.clearPattern('booking-flow:');
    return api.delete(`/booking-flow/library/templates/${id}`);
  },
  seedTemplates: (retreatId: string) => {
    cacheService.clearPattern('booking-flow:');
    return api.post(`/booking-flow/templates/seed/${retreatId}`, {});
  },
  seedLibraryTemplates: () => {
    cacheService.clearPattern('booking-flow:');
    return api.post('/booking-flow/library/templates/seed', {});
  },
  applyLibraryToRetreat: (retreatId: string) => {
    cacheService.clearPattern('booking-flow:');
    return api.post(`/booking-flow/library/templates/apply/${retreatId}`, {});
  },
  applyLibraryTemplateToRetreat: (templateId: string, retreatId: string) => {
    cacheService.clearPattern('booking-flow:');
    return api.post(`/booking-flow/library/templates/${templateId}/apply/${retreatId}`, {});
  },
  generateForBooking: (bookingId: string) => {
    cacheService.clearPattern('booking-flow:');
    return api.post<BookingFlowItem[]>(`/booking-flow/generate/booking/${bookingId}`, {});
  },
  generateForRetreat: (retreatId: string) => {
    cacheService.clearPattern('booking-flow:');
    return api.post<BookingFlowItem[]>(`/booking-flow/generate/retreat/${retreatId}`, {});
  },
  getItems: (params: { bookingId?: string; retreatId?: string; clientId?: string }) => {
    const query = new URLSearchParams();
    if (params.bookingId) query.set('bookingId', params.bookingId);
    if (params.retreatId) query.set('retreatId', params.retreatId);
    if (params.clientId) query.set('clientId', params.clientId);
    const key = `booking-flow:items:${query.toString()}`;
    return cachedGet<BookingFlowItem[]>(key, () => api.get<BookingFlowItem[]>(`/booking-flow/items?${query.toString()}`));
  },
  getBookingRequirements: (bookingId: string) => cachedGet<{
    items: BookingFlowItem[];
    templates: BookingFlowTemplate[];
    libraryTemplates: BookingFlowTemplate[];
    actionLogs: BookingFlowActionLog[];
  }>(
    `booking-flow:booking-requirements:${bookingId}`,
    () => api.get(`/booking-flow/bookings/${bookingId}/requirements`)
  ),
  getMatrix: (retreatId: string) => cachedGet<any>(`booking-flow:matrix:${retreatId}`, () => api.get<any>(`/booking-flow/matrix/${retreatId}`)),
  getItem: (id: string) => cachedGet<BookingFlowItem>(`booking-flow:item:${id}`, () => api.get<BookingFlowItem>(`/booking-flow/items/${id}`)),
  createItem: (data: Partial<BookingFlowItem> & { bookingId: string; title: string }) => {
    cacheService.clearPattern('booking-flow:');
    return api.post<BookingFlowItem>('/booking-flow/items', data);
  },
  updateItem: (id: string, data: Partial<BookingFlowItem>) => {
    cacheService.clearPattern('booking-flow:');
    return api.patch<BookingFlowItem>(`/booking-flow/items/${id}`, data);
  },
  completeItem: (id: string, notes?: string) => {
    cacheService.clearPattern('booking-flow:');
    return api.patch<BookingFlowItem>(`/booking-flow/items/${id}/complete`, { notes });
  },
  sendItemEmail: (id: string) => {
    cacheService.clearPattern('booking-flow:');
    cacheService.clearPattern('communications:sent-emails');
    return api.post<{ item: BookingFlowItem; sentEmail: SentEmail }>(`/booking-flow/items/${id}/send-email`, {});
  },
  getItemEmailComposeData: async (id: string, actionKey?: string) => {
    const request = () => api.get<{
    to: string;
    templateId: string;
    configuredTemplateId?: string;
    requestedLanguage?: string;
    resolvedLanguage?: string;
    languageFallbackUsed?: boolean;
    clientId: string;
    retreatId: string;
    relatedEntityType: string;
    relatedEntityId: string;
    actionKey?: string;
    actionLabel?: string;
    variables: Record<string, any>;
    }>(`/booking-flow/items/${id}/email-compose-data${actionKey ? `?actionKey=${encodeURIComponent(actionKey)}` : ''}`);

    try {
      return await request();
    } catch (error: any) {
      // A GET is safe to retry when a deploy/gateway interruption produced no
      // HTTP response. Do not retry application, authorization, or validation errors.
      if (error?.response) throw error;
      await new Promise((resolve) => setTimeout(resolve, 750));
      return request();
    }
  },
  getItemReminderPreview: (id: string) => api.get<{
    to: string;
    subject: string;
    bodyText: string;
    stepKey: string;
    stepTitle: string;
    dueDate?: string;
    uploadUrl: string;
    actionKey: string;
    reminderCount: number;
    lastReminderAt?: string;
    duplicateBlocked: boolean;
    duplicateWarning: boolean;
    suggestedFollowUpDate: string;
    history: BookingFlowActionLog[];
  }>(`/booking-flow/items/${id}/reminder-preview`),
  sendItemReminder: (id: string, data: { subject: string; bodyText: string; followUpDate?: string; overrideDuplicate?: boolean }) => {
    cacheService.clearPattern('booking-flow:');
    cacheService.clearPattern('communications:sent-emails');
    return api.post(`/booking-flow/items/${id}/send-reminder`, data);
  },
  getItemReminderAutomation: (id: string) => api.get<{
    paused: boolean;
    pauseReason?: string;
    resumeAt?: string;
    schedules: Array<{
      _id: string;
      ruleKey: string;
      actionType: 'send_email' | 'create_staff_task';
      scheduledFor: string;
      status: string;
      executedAt?: string;
      lastError?: string;
    }>;
  }>(`/booking-flow/items/${id}/reminder-automation`),
  setItemReminderAutomationPaused: (id: string, data: { paused: boolean; reason?: string; resumeAt?: string }) => {
    cacheService.clearPattern('booking-flow:');
    return api.patch(`/booking-flow/items/${id}/reminder-automation/pause`, data);
  },
  syncReminderAutomation: () => api.post('/booking-flow/reminder-automation/sync', {}),
  processReminderAutomation: (limit = 50) => api.post('/booking-flow/reminder-automation/process', { limit }),
  getReminderSchedules: (params: Record<string, any> = {}) => api.get('/booking-flow/reminder-automation/schedules', { params }),
  updateReminderSchedule: (id: string, data: { scheduledFor?: string; status?: 'scheduled' | 'paused' | 'cancelled' }) =>
    api.patch(`/booking-flow/reminder-automation/schedules/${id}`, data),
  getMedicationStopPlan: (bookingId: string) => api.get(`/booking-flow/bookings/${bookingId}/medication-stop-plan`),
  saveMedicationStopPlan: (bookingId: string, entries: Record<string, any>[]) =>
    api.put(`/booking-flow/bookings/${bookingId}/medication-stop-plan`, { entries }),
  getItemActionLogs: (id: string) => cachedGet<BookingFlowActionLog[]>(
    `booking-flow:item-action-logs:${id}`,
    () => api.get<BookingFlowActionLog[]>(`/booking-flow/items/${id}/action-logs`)
  ),
  getBookingActionLogs: (bookingId: string) => cachedGet<BookingFlowActionLog[]>(
    `booking-flow:booking-action-logs:${bookingId}`,
    () => api.get<BookingFlowActionLog[]>(`/booking-flow/bookings/${bookingId}/action-logs`)
  ),
  recordItemEmailSent: (id: string, sentEmailId: string, actionKey?: string) => {
    cacheService.clearPattern('booking-flow:');
    cacheService.clearPattern('communications:sent-emails');
    return api.post<{ item: BookingFlowItem; actionLog: BookingFlowActionLog }>(`/booking-flow/items/${id}/record-email-sent`, { sentEmailId, actionKey });
  },
  recordItemAction: (id: string, data: { actionKey?: string; actionLabel?: string; actionType?: string; statusAfter?: string; notes?: string; metadata?: Record<string, any> }) => {
    cacheService.clearPattern('booking-flow:');
    return api.post<{ item: BookingFlowItem; actionLog: BookingFlowActionLog }>(`/booking-flow/items/${id}/record-action`, data);
  },
  sendTemplateEmailToRetreat: (retreatId: string, templateId: string) => {
    cacheService.clearPattern('booking-flow:');
    cacheService.clearPattern('communications:sent-emails');
    return api.post<{ sent: number; failed: number; skipped: number; results: any[] }>(`/booking-flow/retreat/${retreatId}/templates/${templateId}/send-email`, {});
  },
  deleteItem: (id: string) => {
    cacheService.clearPattern('booking-flow:');
    return api.delete(`/booking-flow/items/${id}`);
  },
};

export const bookingDocumentsApi = {
  getSubmittedData: (category = 'all') => api.get(`/booking-documents/submitted-data/list?category=${encodeURIComponent(category)}`),
  getTypes: (includeInactive = false) => cachedGet<BookingDocumentType[]>(
    `booking-documents:types:${includeInactive}`,
    () => api.get<BookingDocumentType[]>(`/booking-documents/types${includeInactive ? '?includeInactive=true' : ''}`)
  ),
  seedTypes: () => {
    cacheService.clearPattern('booking-documents:');
    return api.post<{ created: number; updated: number; types: BookingDocumentType[] }>('/booking-documents/types/seed', {});
  },
  createType: (data: Omit<BookingDocumentType, '_id' | 'createdAt' | 'updatedAt'>) => {
    cacheService.clearPattern('booking-documents:');
    return api.post<BookingDocumentType>('/booking-documents/types', data);
  },
  updateType: (id: string, data: Partial<BookingDocumentType>) => {
    cacheService.clearPattern('booking-documents:');
    return api.patch<BookingDocumentType>(`/booking-documents/types/${id}`, data);
  },
  deleteType: (id: string) => {
    cacheService.clearPattern('booking-documents:');
    return api.delete(`/booking-documents/types/${id}`);
  },
  getAll: (params: { bookingId?: string; clientId?: string; retreatId?: string; documentType?: string; summary?: boolean } = {}) => {
    const query = new URLSearchParams();
    if (params.bookingId) query.set('bookingId', params.bookingId);
    if (params.clientId) query.set('clientId', params.clientId);
    if (params.retreatId) query.set('retreatId', params.retreatId);
    if (params.documentType) query.set('documentType', params.documentType);
    if (params.summary) query.set('summary', 'true');
    const key = `booking-documents:${query.toString()}`;
    return cachedGet<BookingDocument[]>(key, () => api.get<BookingDocument[]>(`/booking-documents?${query.toString()}`));
  },
  getOne: (id: string) => api.get<BookingDocument>(`/booking-documents/${id}`),
  create: (data: Partial<BookingDocument> & { bookingId: string; documentType: string }) => {
    cacheService.clearPattern('booking-documents:');
    return api.post<BookingDocument>('/booking-documents', data);
  },
  update: (id: string, data: Partial<BookingDocument> & { bookingId?: string; documentType?: string }) => {
    cacheService.clearPattern('booking-documents:');
    return api.patch<BookingDocument>(`/booking-documents/${id}`, data);
  },
  uploadFiles: (id: string, files: File[]) => {
    cacheService.clearPattern('booking-documents:');
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    return api.post(`/booking-documents/${id}/upload-files`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getFileViewUrl: (id: string, storedPath: string) => `${api.defaults.baseURL}/booking-documents/${id}/files/view?storedPath=${encodeURIComponent(storedPath)}`,
  delete: (id: string, reason = 'Upload rollback') => {
    cacheService.clearPattern('booking-documents:');
    return api.delete(`/booking-documents/${id}`, { data: { reason } });
  },
};

export const notesApi = {
  getAll: (params?: any) => api.get('/notes', { params }),
  getOne: (id: string) => api.get(`/notes/${id}`),
  getByClient: (clientId: string) => api.get(`/notes/client/${clientId}`),
  getByRetreat: (retreatId: string) => api.get(`/notes/retreat/${retreatId}`),
  getStatistics: () => cachedGet<any>('notes:stats', () => api.get<any>('/notes/statistics'), 60000),
  create: (data: any) => {
    cacheService.clearPattern('notes:');
    return api.post('/notes', data);
  },
  update: (id: string, data: any) => {
    cacheService.clearPattern('notes:');
    return api.patch(`/notes/${id}`, data);
  },
  archive: (id: string) => {
    cacheService.clearPattern('notes:');
    return api.patch(`/notes/${id}/archive`);
  },
  unarchive: (id: string) => {
    cacheService.clearPattern('notes:');
    return api.patch(`/notes/${id}/unarchive`);
  },
  delete: (id: string) => {
    cacheService.clearPattern('notes:');
    return api.delete(`/notes/${id}`);
  },
};

// Waiting List API
export const waitingListApi = {
  // Get waiting list matrix (all retreats with their waiting lists)
  getMatrix: () => cachedGet<any>('waiting-list:matrix', () => api.get<any>('/waiting-list/matrix'), 30000),

  // Get waiting list by retreat
  getByRetreat: (retreatId: string) =>
    cachedGet<any>(`waiting-list:retreat:${retreatId}`, () => api.get<any>(`/waiting-list/retreat/${retreatId}`), 30000),

  // Get client's waiting lists
  getClientWaitingLists: (clientId: string) =>
    cachedGet<any>(`waiting-list:client:${clientId}`, () => api.get<any>(`/waiting-list/client/${clientId}`), 30000),

  // Add client to waiting list
  addToWaitingList: (data: any) => {
    cacheService.clearPattern('waiting-list:');
    return api.post('/waiting-list', data);
  },

  // Update waiting list entry
  updateEntry: (id: string, data: any) => {
    cacheService.clearPattern('waiting-list:');
    return api.put(`/waiting-list/${id}`, data);
  },

  // Update positions
  updatePositions: (retreatId: string, data: any) => {
    cacheService.clearPattern('waiting-list:');
    return api.put(`/waiting-list/positions/${retreatId}`, data);
  },

  // Remove from waiting list
  removeFromWaitingList: (id: string) => {
    cacheService.clearPattern('waiting-list:');
    return api.delete(`/waiting-list/${id}`);
  },

  // Convert to booking
  convertToBooking: (id: string) => {
    cacheService.clearPattern('waiting-list:');
    return api.post(`/waiting-list/${id}/convert-to-booking`);
  },

  // Notify next in line
  notifyNextInLine: (retreatId: string) => {
    cacheService.clearPattern('waiting-list:');
    return api.post(`/waiting-list/notify/${retreatId}`);
  },
};

// Screening API
export const screeningApi = {
  // Create screening
  create: (data: any) => {
    cacheService.clearPattern('clients:');
    return api.put(`/clients/${data.clientId}/screening`, data);
  },

  // Get all screenings
  getAll: () => api.get('/screening'),

  // Get screening by ID
  getOne: (id: string) => api.get(`/screening/${id}`),

  // Get screenings by client
  getByClient: (clientId: string) => api.get(`/screening/client/${clientId}`),

  // Update screening
  update: (id: string, data: any) => {
    cacheService.clearPattern('clients:');
    return api.put(`/clients/${id}/screening`, data);
  },

  // Delete screening
  delete: (id: string) => api.delete(`/screening/${id}`),

  // Upload handwriting image
  uploadHandwriting: async (id: string, formData: FormData) => {
    formData.set('documentKind', 'other');
    formData.set('foreignKey', id);
    formData.set('description', 'Screening handwriting upload');

    const response = await fileUploadsApi.upload(formData);
    const storedFileName = response.data.storedFileName;
    return {
      ...response,
      data: {
        ...response.data,
        imageUrl: storedFileName ? `${API_BASE_URL}/uploads/medical-tracking/${storedFileName}` : '',
      },
    };
  },
};

export type AssistantFinding = {
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  link?: string;
};

export type AssistantAction = {
  label: string;
  reason: string;
  link?: string;
  priority: 'high' | 'medium' | 'low';
};

export type BookingReadinessAssistantResult = {
  generatedAt: string;
  generatedBy: 'rules' | 'openai';
  model?: string;
  aiUnavailableReason?: string;
  booking: {
    id: string;
    bookingNumber?: number;
    status?: string;
    totalAmount?: number;
    currency?: string;
    paidAmount?: number;
    balanceDue?: number;
    link?: string;
  };
  client: {
    id?: string;
    displayId?: number;
    name?: string;
    email?: string;
    phone?: string;
    link?: string;
  };
  retreat: {
    id?: string;
    name?: string;
    code?: string;
    startDate?: string;
    endDate?: string;
    location?: string;
    daysUntilRetreat?: number | null;
    link?: string;
  };
  metrics: Record<string, number | string | null | undefined>;
  findings: AssistantFinding[];
  suggestedActions: AssistantAction[];
  summary: string;
  aiSummary?: string;
};

export type RetreatReadinessClientRow = {
  bookingId: string;
  bookingNumber?: number;
  bookingStatus?: string;
  bookingLink: string;
  clientId?: string;
  clientDisplayId?: number;
  clientName: string;
  clientEmail?: string;
  clientLink?: string;
  ekgReceived: boolean;
  liverReceived: boolean;
  medicalReviewSent: boolean;
  medicalApproved: boolean;
  pendingMedicalReviews: number;
  openBlockingSteps: number;
  overdueSteps: number;
  missingSteps: string[];
  nextAction: string;
  severity: 'high' | 'medium' | 'low';
};

export type RetreatReadinessAssistantResult = {
  generatedAt: string;
  generatedBy: 'rules' | 'openai';
  model?: string;
  aiUnavailableReason?: string;
  retreat: {
    id: string;
    name?: string;
    code?: string;
    startDate?: string;
    endDate?: string;
    location?: string;
    daysUntilRetreat?: number | null;
    link?: string;
  };
  metrics: Record<string, number | string | null | undefined>;
  findings: AssistantFinding[];
  suggestedActions: AssistantAction[];
  clients: RetreatReadinessClientRow[];
  summary: string;
  aiSummary?: string;
};

export type AssistantChatResponse = {
  answer: string;
  generatedBy: 'rules' | 'openai';
  model?: string;
  aiUnavailableReason?: string;
  analysis?: BookingReadinessAssistantResult | RetreatReadinessAssistantResult;
};

export const assistantApi = {
  analyzeBookingReadiness: (bookingId: string) =>
    api.get<BookingReadinessAssistantResult>(`/assistant/booking-readiness/${bookingId}`),
  analyzeRetreatReadiness: (retreatId: string) =>
    api.get<RetreatReadinessAssistantResult>(`/assistant/retreat-readiness/${retreatId}`),
  chat: (data: { scope: 'retreat' | 'booking'; retreatId?: string; bookingId?: string; message: string }) =>
    api.post<AssistantChatResponse>('/assistant/chat', data),
};
