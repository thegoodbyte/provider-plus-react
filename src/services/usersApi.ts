import { api } from './api';

export interface User {
  _id: string;
  email: string;
  role: 'admin' | 'user' | 'facilitator' | 'helper' | 'medical_staff' | 'medical_advisor';
  firstName?: string;
  lastName?: string;
  isActive: boolean;
  lastLogin?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateUserData {
  email: string;
  password: string;
  role: 'admin' | 'user' | 'facilitator' | 'helper' | 'medical_staff' | 'medical_advisor';
  firstName?: string;
  lastName?: string;
}

export interface UpdateUserData {
  email?: string;
  role?: 'admin' | 'user' | 'facilitator' | 'helper' | 'medical_staff' | 'medical_advisor';
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
}

export const usersApi = {
  // Get all users (admin only)
  async getAll(): Promise<{ data: User[] }> {
    const response = await api.get('/users');
    return response;
  },

  // Get specific user (admin only)
  async getById(id: string): Promise<{ data: User }> {
    const response = await api.get(`/users/${id}`);
    return response;
  },

  // Create new user (admin only)
  async create(userData: CreateUserData): Promise<{ data: User }> {
    const response = await api.post('/users', userData);
    return response;
  },

  // Update user (admin only)
  async update(id: string, userData: UpdateUserData): Promise<{ data: User }> {
    const response = await api.put(`/users/${id}`, userData);
    return response;
  },

  // Delete user (admin only)
  async delete(id: string): Promise<{ message: string }> {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  },

  // Get current user profile
  async getProfile(): Promise<{ data: User }> {
    const response = await api.get('/users/profile');
    return response;
  },

  // Update current user profile
  async updateProfile(userData: { firstName?: string; lastName?: string; email?: string }): Promise<{ data: User }> {
    const response = await api.put('/users/profile', userData);
    return response;
  },

  // Change password
  async changePassword(passwordData: { oldPassword: string; newPassword: string }): Promise<{ message: string }> {
    const response = await api.put('/users/change-password', passwordData);
    return response.data;
  },

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const response = await api.post('/users/forgot-password', { email });
    return response.data;
  },

  async validatePasswordResetToken(token: string): Promise<{ data: { valid: boolean; email?: string; expiresAt?: string } }> {
    const response = await api.get(`/users/change-password/${encodeURIComponent(token)}`);
    return response;
  },

  async resetPasswordWithToken(token: string, password: string): Promise<{ message: string }> {
    const response = await api.post(`/users/change-password/${encodeURIComponent(token)}`, { password });
    return response.data;
  },

  // Reset password (admin only)
  async resetPassword(userId: string, password: string): Promise<{ data: any }> {
    const response = await api.post(`/users/${userId}/reset-password`, { password });
    return response;
  },
};
