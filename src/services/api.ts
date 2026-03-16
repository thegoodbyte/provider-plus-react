import axios from 'axios';
import { Retreat, House, Client, RetreatClient, ClientMedical, Requirement, ClientRequirement, Reminder, ExpenseType, RetreatExpense, ExpenseSummary, Payment, PaymentSummary, ScreeningClient, Ceremony, CeremonyParticipant } from '../types';
import { authService } from './authService';
import { cacheService } from './cacheService';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3005';

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
      // Token expired or invalid
      authService.logout();
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// Helper function to cache GET requests
const cachedGet = async <T>(key: string, fetcher: () => Promise<any>, ttl: number = 30000): Promise<any> => {
  const cached = cacheService.get<T>(key);
  if (cached) {
    return { data: cached };
  }

  const response = await fetcher();
  cacheService.set(key, response.data, ttl);
  return response;
};

export const retreatsApi = {
  getAll: () => api.get<Retreat[]>('/retreats'),
  getOne: (id: string) => api.get<Retreat>(`/retreats/${id}`),
  create: (data: Omit<Retreat, '_id'>) => {
    cacheService.clearPattern('retreats:');
    return api.post<Retreat>('/retreats', data);
  },
  update: (id: string, data: Partial<Retreat>) => {
    cacheService.clearPattern('retreats:');
    return api.patch<Retreat>(`/retreats/${id}`, data);
  },
  delete: (id: string) => {
    cacheService.clearPattern('retreats:');
    return api.delete(`/retreats/${id}`);
  },
};

export const housesApi = {
  getAll: () => cachedGet<House[]>('houses:all', () => api.get<House[]>('/houses')),
  getOne: (id: string) => cachedGet<House>(`houses:${id}`, () => api.get<House>(`/houses/${id}`)),
  create: (data: Omit<House, '_id'>) => {
    cacheService.clearPattern('houses:');
    return api.post<House>('/houses', data);
  },
  update: (id: string, data: Partial<House>) => {
    cacheService.clearPattern('houses:');
    return api.patch<House>(`/houses/${id}`, data);
  },
  delete: (id: string) => {
    cacheService.clearPattern('houses:');
    return api.delete(`/houses/${id}`);
  },
};

export const clientsApi = {
  getAll: () => cachedGet<Client[]>('clients:all', () => api.get<Client[]>('/clients')),
  getOne: (id: string) => cachedGet<Client>(`clients:${id}`, () => api.get<Client>(`/clients/${id}`)),
  create: (data: Omit<Client, '_id'>) => {
    cacheService.clearPattern('clients:');
    return api.post<Client>('/clients', data);
  },
  quickAdd: (data: Partial<Client>) => {
    cacheService.clearPattern('clients:');
    return api.post<Client>('/clients/quick-add', data);
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
  getByEmail: (email: string) => api.get<Client>(`/clients/by-email/${email}`),
  getByRetreat: (retreatId: string) => cachedGet<Client[]>(`clients:retreat:${retreatId}`, () => api.get<Client[]>(`/clients/by-retreat/${retreatId}`)),
  regenerateDepositHash: (id: string) => api.post<{ hash: string }>(`/clients/${id}/regenerate-deposit-hash`, {}),
  getPotential: () => api.get<Client[]>('/clients/potential'),
  getBlacklisted: () => api.get<Client[]>('/clients/blacklisted'),
  blacklist: (id: string, reason: string) => {
    cacheService.clearPattern('clients:');
    return api.put(`/clients/${id}/blacklist`, { reason });
  },
  updateWorkflowStatus: (id: string, status: string, reason?: string) => {
    cacheService.clearPattern('clients:');
    return api.put(`/clients/${id}/workflow-status`, { status, reason });
  },
};

export const clientMedicalApi = {
  getAll: () => api.get<ClientMedical[]>('/client-medical'),
  getOne: (id: string) => api.get<ClientMedical>(`/client-medical/${id}`),
  getByClient: (clientId: string) => api.get<ClientMedical[]>(`/client-medical/client/${clientId}`),
  getByRetreat: (retreatId: string) => api.get<ClientMedical[]>(`/client-medical/retreat/${retreatId}`),
  getByClientAndRetreat: (clientId: string, retreatId: string) => api.get<ClientMedical>(`/client-medical/client/${clientId}/retreat/${retreatId}`),
  create: (data: Omit<ClientMedical, '_id'>) => api.post<ClientMedical>('/client-medical', data),
  update: (id: string, data: Partial<ClientMedical>) => api.patch<ClientMedical>(`/client-medical/${id}`, data),
  delete: (id: string) => api.delete(`/client-medical/${id}`),
  uploadFile: (formData: FormData, type: 'liver-panel' | 'ekg') => api.post(`/client-medical/upload/${type}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
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
  getAll: () => api.get<Reminder[]>('/reminders'),
  getPending: () => api.get<Reminder[]>('/reminders?status=pending'),
  getByClient: (clientId: string) => api.get<Reminder[]>(`/reminders/client/${clientId}`),
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
  getByHash: (hash: string) => cachedGet<RetreatClient>(`bookings:hash:${hash}`, () => api.get<RetreatClient>(`/bookings/by-hash/${hash}`)),
  getByRetreat: (retreatId: string) => cachedGet<RetreatClient[]>(`bookings:retreat:${retreatId}`, () => api.get<RetreatClient[]>(`/bookings/retreat/${retreatId}`)),
  getByClient: (clientId: string) => cachedGet<RetreatClient[]>(`bookings:client:${clientId}`, () => api.get<RetreatClient[]>(`/bookings/client/${clientId}`)),
  getByRetreatWithDetails: (retreatId: string) => cachedGet<RetreatClient[]>(`bookings:retreat-details:${retreatId}`, () => api.get<RetreatClient[]>(`/bookings/retreat/${retreatId}/with-details`)),
  create: (data: Omit<RetreatClient, '_id'>) => {
    cacheService.clearPattern('bookings:');
    return api.post<RetreatClient>('/bookings', data);
  },
  update: (id: string, data: Partial<RetreatClient>) => {
    cacheService.clearPattern('bookings:');
    return api.patch<RetreatClient>(`/bookings/${id}`, data);
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

export const expenseTypesApi = {
  getAll: () => api.get<ExpenseType[]>('/expense-types'),
  getOne: (id: string) => api.get<ExpenseType>(`/expense-types/${id}`),
  create: (data: Omit<ExpenseType, '_id'>) => api.post<ExpenseType>('/expense-types', data),
  update: (id: string, data: Partial<ExpenseType>) => api.patch<ExpenseType>(`/expense-types/${id}`, data),
  delete: (id: string) => api.delete(`/expense-types/${id}`),
  activate: (id: string) => api.patch(`/expense-types/${id}/activate`, {}),
  deactivate: (id: string) => api.patch(`/expense-types/${id}/deactivate`, {}),
  seed: () => api.post('/expense-types/seed', {}),
};

export const retreatExpensesApi = {
  getAll: () => api.get<RetreatExpense[]>('/retreat-expenses'),
  getOne: (id: string) => api.get<RetreatExpense>(`/retreat-expenses/${id}`),
  getByRetreat: (retreatId: string) => api.get<RetreatExpense[]>(`/retreat-expenses/retreat/${retreatId}`),
  getByExpenseType: (expenseTypeId: string) => api.get<RetreatExpense[]>(`/retreat-expenses/expense-type/${expenseTypeId}`),
  getRetreatSummary: (retreatId: string) => api.get<ExpenseSummary>(`/retreat-expenses/retreat/${retreatId}/summary`),
  create: (data: Omit<RetreatExpense, '_id'>) => api.post<RetreatExpense>('/retreat-expenses', data),
  update: (id: string, data: Partial<RetreatExpense>) => api.patch<RetreatExpense>(`/retreat-expenses/${id}`, data),
  delete: (id: string) => api.delete(`/retreat-expenses/${id}`),
  initializeRetreatExpenses: (retreatId: string) => api.post(`/retreat-expenses/retreat/${retreatId}/initialize`, {}),
  autoGenerateHouseCost: (retreatId: string) => api.post<RetreatExpense>(`/retreat-expenses/retreat/${retreatId}/auto-generate-house-cost`, {}),
};

export const paymentsApi = {
  getAll: () => cachedGet<Payment[]>('payments:all', () => api.get<Payment[]>('/payments')),
  getOne: (id: string) => cachedGet<Payment>(`payments:${id}`, () => api.get<Payment>(`/payments/${id}`)),
  getByRetreat: (retreatId: string) => cachedGet<Payment[]>(`payments:retreat:${retreatId}`, () => api.get<Payment[]>(`/payments/by-retreat/${retreatId}`)),
  getByClient: (clientId: string) => cachedGet<Payment[]>(`payments:client:${clientId}`, () => api.get<Payment[]>(`/payments/by-client/${clientId}`)),
  getByBooking: (bookingId: string) => cachedGet<Payment[]>(`payments:booking:${bookingId}`, () => api.get<Payment[]>(`/payments/by-booking/${bookingId}`)),
  getByBookingHash: (bookingHash: string) => cachedGet<Payment[]>(`payments:hash:${bookingHash}`, () => api.get<Payment[]>(`/payments/by-booking-hash/${bookingHash}`)),
  getByClientAndRetreat: (clientId: string, retreatId: string) => cachedGet<Payment[]>(`payments:client-retreat:${clientId}-${retreatId}`, () => api.get<Payment[]>(`/payments/by-client-and-retreat?clientId=${clientId}&retreatId=${retreatId}`)),
  getRetreatSummary: (retreatId: string) => cachedGet<PaymentSummary>(`payments:summary:${retreatId}`, () => api.get<PaymentSummary>(`/payments/retreat-summary/${retreatId}`)),
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
  getAll: () => api.get<Requirement[]>('/requirements'),
  getOne: (id: string) => api.get<Requirement>(`/requirements/${id}`),
  getByCategory: (category: string) => api.get<Requirement[]>(`/requirements/category/${category}`),
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