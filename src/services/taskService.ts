import { authFetch } from './authService';
import { API_BASE_URL } from '../config/api.config';

export interface Task {
  id: string;
  name: string;
  description: string;
  type: 'client' | 'retreat' | 'generic';
  urgency: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  dueDate?: string;
  clientId?: string | {
    firstName: string;
    lastName: string;
    email: string;
  };
  retreatId?: string | {
    name: string;
    code: string;
    startDate: string;
    endDate: string;
  };
  assignedTo?: string;
  completedAt?: string;
  completedBy?: string;
  tags: string[];
  notes?: string;
  sourceType?: string;
  sourceId?: string;
  bookingFlowItemId?: string | {
    _id: string;
    bookingId?: string | {
      _id: string;
      clientId?: any;
      retreatId?: any;
    };
    clientId?: any;
    retreatId?: any;
    templateId?: any;
    key?: string;
    title?: string;
    dueDate?: string;
    status?: string;
  };
  reminderKind?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskDto {
  name: string;
  description: string;
  type: 'client' | 'retreat' | 'generic';
  urgency: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
  clientId?: string;
  retreatId?: string;
  assignedTo?: string;
  tags?: string[];
  notes?: string;
  sourceType?: string;
  sourceId?: string;
  bookingFlowItemId?: string;
  reminderKind?: string;
}

export interface TaskFilters {
  type?: string;
  status?: string;
  urgency?: string;
  clientId?: string;
  retreatId?: string;
  sourceType?: string;
  sourceId?: string;
  bookingFlowItemId?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  overdue?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface TaskStatistics {
  byStatus: Array<{ _id: string; count: number }>;
  byType: Array<{ _id: string; count: number }>;
  byUrgency: Array<{ _id: string; count: number }>;
  overdue: Array<{ count: number }>;
  dueThisWeek: Array<{ count: number }>;
}

class TaskService {
  private baseUrl = `${API_BASE_URL}/tasks`;

  private async getErrorMessage(response: Response, fallback: string): Promise<string> {
    try {
      const data = await response.json();
      const message = Array.isArray(data?.message) ? data.message.join(', ') : data?.message;
      return message ? `${fallback}: ${message}` : `${fallback}: ${response.status} ${response.statusText}`;
    } catch {
      return `${fallback}: ${response.status} ${response.statusText}`;
    }
  }

  async createTask(taskData: CreateTaskDto): Promise<Task> {
    const response = await authFetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(taskData),
    });

    if (!response.ok) {
      throw new Error(await this.getErrorMessage(response, 'Failed to create task'));
    }

    return response.json();
  }

  async getTasks(filters?: TaskFilters): Promise<Task[]> {
    const queryParams = new URLSearchParams();

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });
    }

    const url = queryParams.toString()
      ? `${this.baseUrl}?${queryParams.toString()}`
      : this.baseUrl;

    const response = await authFetch(url);

    if (!response.ok) {
      throw new Error(await this.getErrorMessage(response, 'Failed to fetch tasks'));
    }

    return response.json();
  }

  async getTask(id: string): Promise<Task> {
    const response = await authFetch(`${this.baseUrl}/${id}`);

    if (!response.ok) {
      throw new Error(await this.getErrorMessage(response, 'Failed to fetch task'));
    }

    return response.json();
  }

  async getTasksByClient(clientId: string): Promise<Task[]> {
    const response = await authFetch(`${this.baseUrl}/client/${clientId}`);

    if (!response.ok) {
      throw new Error(await this.getErrorMessage(response, 'Failed to fetch client tasks'));
    }

    return response.json();
  }

  async getTasksByRetreat(retreatId: string): Promise<Task[]> {
    const response = await authFetch(`${this.baseUrl}/retreat/${retreatId}`);

    if (!response.ok) {
      throw new Error(await this.getErrorMessage(response, 'Failed to fetch retreat tasks'));
    }

    return response.json();
  }

  async seedRetreatDayPlan(retreatId: string): Promise<Task[]> {
    const response = await authFetch(`${this.baseUrl}/retreat/${retreatId}/day-plan/seed`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(await this.getErrorMessage(response, 'Failed to add 8-day retreat plan'));
    }

    return response.json();
  }

  async updateTask(id: string, updates: Partial<CreateTaskDto>): Promise<Task> {
    const response = await authFetch(`${this.baseUrl}/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error(await this.getErrorMessage(response, 'Failed to update task'));
    }

    return response.json();
  }

  async completeTask(id: string): Promise<Task> {
    const response = await authFetch(`${this.baseUrl}/${id}/complete`, {
      method: 'PATCH',
    });

    if (!response.ok) {
      throw new Error(await this.getErrorMessage(response, 'Failed to complete task'));
    }

    return response.json();
  }

  async deleteTask(id: string): Promise<void> {
    const response = await authFetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(await this.getErrorMessage(response, 'Failed to delete task'));
    }
  }

  async getStatistics(): Promise<TaskStatistics> {
    const response = await authFetch(`${this.baseUrl}/statistics`);

    if (!response.ok) {
      throw new Error(await this.getErrorMessage(response, 'Failed to fetch task statistics'));
    }

    return response.json();
  }

  // Utility methods
  getUrgencyColor(urgency: string): string {
    switch (urgency) {
      case 'urgent':
        return '#dc2626'; // red-600
      case 'high':
        return '#ea580c'; // orange-600
      case 'medium':
        return '#d97706'; // amber-600
      case 'low':
        return '#16a34a'; // green-600
      default:
        return '#6b7280'; // gray-500
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'completed':
        return '#16a34a'; // green-600
      case 'in_progress':
        return '#374151'; // blue-600
      case 'cancelled':
        return '#dc2626'; // red-600
      case 'pending':
      default:
        return '#6b7280'; // gray-500
    }
  }

  formatDueDate(dueDate: string): string {
    const date = new Date(dueDate);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return `Overdue by ${Math.abs(diffDays)} day(s)`;
    } else if (diffDays === 0) {
      return 'Due today';
    } else if (diffDays === 1) {
      return 'Due tomorrow';
    } else if (diffDays <= 7) {
      return `Due in ${diffDays} day(s)`;
    } else {
      return date.toLocaleDateString();
    }
  }

  isOverdue(dueDate: string, status: string): boolean {
    if (status === 'completed') return false;
    const date = new Date(dueDate);
    return date < new Date();
  }
}

export const taskService = new TaskService();
