// API Configuration
// Uses a single environment-driven base URL with a safe local fallback.
export const API_BASE_URL =
  process.env.REACT_APP_PROVIDER_PLUS_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3001';

export const API_ENDPOINTS = {
  // Auth endpoints
  auth: {
    login: `${API_BASE_URL}/auth/login`,
    logout: `${API_BASE_URL}/auth/logout`,
    verify: `${API_BASE_URL}/auth/verify`
  },

  // Resource endpoints
  retreats: `${API_BASE_URL}/retreats`,
  clients: `${API_BASE_URL}/clients`,
  bookings: `${API_BASE_URL}/bookings`,
  houses: `${API_BASE_URL}/houses`,
  tasks: `${API_BASE_URL}/tasks`,
  payments: `${API_BASE_URL}/payments`,
  expenses: `${API_BASE_URL}/retreat-expenses`,
  expenseTypes: `${API_BASE_URL}/expense-types`,
  clientMedical: `${API_BASE_URL}/client-medical`,
  uploads: `${API_BASE_URL}/uploads`
};

// Helper function to build URL with query params
export const buildUrl = (endpoint: string, params?: Record<string, any>): string => {
  if (!params) return endpoint;

  const queryParams = new URLSearchParams(
    Object.entries(params)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)])
  ).toString();

  return queryParams ? `${endpoint}?${queryParams}` : endpoint;
};
