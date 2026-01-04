import axios from 'axios';
import { Retreat, House, Client, RetreatClient, ClientMedical, Requirement, ClientRequirement, Reminder, ExpenseType, RetreatExpense, ExpenseSummary, Payment, PaymentSummary, ScreeningClient } from '../types';
import { authService } from './authService';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3007';

const api = axios.create({
  baseURL: API_BASE_URL,
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

export const retreatsApi = {
  getAll: () => api.get<Retreat[]>('/retreats'),
  getOne: (id: string) => api.get<Retreat>(`/retreats/${id}`),
  create: (data: Omit<Retreat, '_id'>) => api.post<Retreat>('/retreats', data),
  update: (id: string, data: Partial<Retreat>) => api.patch<Retreat>(`/retreats/${id}`, data),
  delete: (id: string) => api.delete(`/retreats/${id}`),
};

export const housesApi = {
  getAll: () => api.get<House[]>('/houses'),
  getOne: (id: string) => api.get<House>(`/houses/${id}`),
  create: (data: Omit<House, '_id'>) => api.post<House>('/houses', data),
  update: (id: string, data: Partial<House>) => api.patch<House>(`/houses/${id}`, data),
  delete: (id: string) => api.delete(`/houses/${id}`),
};

export const clientsApi = {
  getAll: () => api.get<Client[]>('/clients'),
  getOne: (id: string) => api.get<Client>(`/clients/${id}`),
  create: (data: Omit<Client, '_id'>) => api.post<Client>('/clients', data),
  update: (id: string, data: Partial<Client>) => api.patch<Client>(`/clients/${id}`, data),
  delete: (id: string) => api.delete(`/clients/${id}`),
  search: (searchTerm: string) => api.get<Client[]>(`/clients?search=${searchTerm}`),
  getByEmail: (email: string) => api.get<Client>(`/clients/by-email/${email}`),
  getByRetreat: (retreatId: string) => api.get<Client[]>(`/clients/by-retreat/${retreatId}`),
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

export const requirementsApi = {
  getAll: () => api.get<Requirement[]>('/requirements'),
  getOne: (id: string) => api.get<Requirement>(`/requirements/${id}`),
  create: (data: Omit<Requirement, '_id'>) => api.post<Requirement>('/requirements', data),
  update: (id: string, data: Partial<Requirement>) => api.patch<Requirement>(`/requirements/${id}`, data),
  delete: (id: string) => api.delete(`/requirements/${id}`),
};

export const clientRequirementsApi = {
  getAll: () => api.get<ClientRequirement[]>('/client-requirements'),
  getByClient: (clientId: string) => api.get<ClientRequirement[]>(`/client-requirements/client/${clientId}`),
  getByRetreat: (retreatId: string) => api.get<ClientRequirement[]>(`/client-requirements/retreat/${retreatId}`),
  getByClientAndRetreat: (clientId: string, retreatId: string) => api.get<ClientRequirement[]>(`/client-requirements/client/${clientId}/retreat/${retreatId}`),
  create: (data: Omit<ClientRequirement, '_id'>) => api.post<ClientRequirement>('/client-requirements', data),
  update: (id: string, data: Partial<ClientRequirement>) => api.patch<ClientRequirement>(`/client-requirements/${id}`, data),
  markCompleted: (id: string) => api.patch(`/client-requirements/${id}/complete`, {}),
  delete: (id: string) => api.delete(`/client-requirements/${id}`),
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
  getAll: () => api.get<RetreatClient[]>('/bookings'),
  getOne: (id: string) => api.get<RetreatClient>(`/bookings/${id}`),
  getByRetreat: (retreatId: string) => api.get<RetreatClient[]>(`/bookings/retreat/${retreatId}`),
  getByClient: (clientId: string) => api.get<RetreatClient[]>(`/bookings/client/${clientId}`),
  getByRetreatWithDetails: (retreatId: string) => api.get<RetreatClient[]>(`/bookings/retreat/${retreatId}/with-details`),
  create: (data: Omit<RetreatClient, '_id'>) => api.post<RetreatClient>('/bookings', data),
  update: (id: string, data: Partial<RetreatClient>) => api.patch<RetreatClient>(`/bookings/${id}`, data),
  checkIn: (id: string) => api.patch<RetreatClient>(`/bookings/${id}/check-in`, {}),
  checkOut: (id: string) => api.patch<RetreatClient>(`/bookings/${id}/check-out`, {}),
  delete: (id: string) => api.delete(`/bookings/${id}`),
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
  getAll: () => api.get<Payment[]>('/payments'),
  getOne: (id: string) => api.get<Payment>(`/payments/${id}`),
  getByRetreat: (retreatId: string) => api.get<Payment[]>(`/payments/by-retreat/${retreatId}`),
  getByClient: (clientId: string) => api.get<Payment[]>(`/payments/by-client/${clientId}`),
  getByClientAndRetreat: (clientId: string, retreatId: string) => api.get<Payment[]>(`/payments/by-client-and-retreat?clientId=${clientId}&retreatId=${retreatId}`),
  getRetreatSummary: (retreatId: string) => api.get<PaymentSummary>(`/payments/retreat-summary/${retreatId}`),
  create: (data: Omit<Payment, '_id'>) => api.post<Payment>('/payments', data),
  update: (id: string, data: Partial<Payment>) => api.put<Payment>(`/payments/${id}`, data),
  delete: (id: string) => api.delete(`/payments/${id}`),
  processRefund: (id: string, refundAmount: number) => api.put<Payment>(`/payments/${id}/refund`, { refundAmount }),
};

export const screeningClientsApi = {
  getAll: () => api.get<ScreeningClient[]>('/screening-clients'),
  getOne: (id: string) => api.get<ScreeningClient>(`/screening-clients/${id}`),
  getByStatus: (status: string) => api.get<ScreeningClient[]>(`/screening-clients?status=${status}`),
  getOverdue: () => api.get<ScreeningClient[]>('/screening-clients/overdue'),
  create: (data: Omit<ScreeningClient, '_id'>) => api.post<ScreeningClient>('/screening-clients', data),
  update: (id: string, data: Partial<ScreeningClient>) => api.patch<ScreeningClient>(`/screening-clients/${id}`, data),
  delete: (id: string) => api.delete(`/screening-clients/${id}`),
  promoteToClient: (id: string) => api.post<{ screeningClient: ScreeningClient; client: Client }>(`/screening-clients/${id}/promote`, {}),
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