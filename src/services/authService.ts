import { API_BASE_URL } from '../config/api.config';
import { cacheService } from './cacheService';

interface LoginResponse {
  access_token: string;
  user: {
    username: string; // This is now the email for compatibility
    email: string;
    role: string;
    firstName?: string;
    lastName?: string;
  };
}

export const authService = {
  async login(username: string, password: string): Promise<LoginResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        // Check if it's an authentication error (401) or other server error
        if (response.status === 401) {
          throw new Error('Invalid credentials');
        } else if (response.status >= 500) {
          throw new Error('Server error. Please try again later.');
        } else {
          throw new Error(`Error: ${response.statusText}`);
        }
      }

      const data = await response.json();

      cacheService.clear();
      // Store token in localStorage
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));

      return data;
    } catch (error: any) {
      // Check if it's a network/connection error
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error('CONNECTION_ERROR');
      }
      // Re-throw the error if it's already our custom error
      if (error.message === 'Invalid credentials' ||
          error.message === 'CONNECTION_ERROR' ||
          error.message.startsWith('Server error') ||
          error.message.startsWith('Error:')) {
        throw error;
      }
      // Default to connection error for any other unexpected errors
      throw new Error('CONNECTION_ERROR');
    }
  },

  logout() {
    cacheService.clear();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  getToken(): string | null {
    return localStorage.getItem('token');
  },

  getUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  isAuthenticated(): boolean {
    return !!this.getToken();
  }
};

export const authFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const token = authService.getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers ? (options.headers as Record<string, string>) : {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(url, {
    ...options,
    headers,
  });
};
