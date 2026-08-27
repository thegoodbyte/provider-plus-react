import React, { useState, useEffect } from 'react';
import { Task, CreateTaskDto } from '../../services/taskService';
import { bookingsApi, clientsApi, retreatsApi } from '../../services/api';
import { SearchableSelect } from './SearchableSelect';
import './TaskForm.css';

interface TaskFormProps {
  task?: Task | null;
  onSubmit: (taskData: CreateTaskDto) => void;
  onCancel: () => void;
  clientId?: string;
  retreatId?: string;
  bookingId?: string;
  bookingLabel?: string;
  initialType?: CreateTaskDto['type'];
  error?: string | null;
}

export const TaskForm: React.FC<TaskFormProps> = ({
  task,
  onSubmit,
  onCancel,
  clientId,
  retreatId,
  bookingId,
  bookingLabel,
  initialType,
  error,
}) => {
  const [formData, setFormData] = useState<CreateTaskDto>({
    name: '',
    description: '',
    type: initialType || 'generic',
    urgency: 'medium',
    dueDate: '',
    clientId: clientId || '',
    retreatId: retreatId || '',
    bookingId: bookingId || '',
    tags: [],
    notes: '',
  });

  const [tagInput, setTagInput] = useState('');
  const [clients, setClients] = useState<any[]>([]);
  const [retreats, setRetreats] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [loadingRetreats, setLoadingRetreats] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(false);

  const normalizeList = (response: any): any[] => {
    const data = response?.data;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.results)) return data.results;
    return [];
  };

  useEffect(() => {
    if (task) {
      setFormData({
        name: task.name,
        description: task.description,
        type: task.type,
        urgency: task.urgency,
        dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
        clientId: typeof task.clientId === 'string' ? task.clientId : ((task.clientId as any)?._id || (task.clientId as any)?.id || clientId || ''),
        retreatId: typeof task.retreatId === 'string' ? task.retreatId : ((task.retreatId as any)?._id || (task.retreatId as any)?.id || retreatId || ''),
        bookingId: typeof task.bookingId === 'string' ? task.bookingId : (task.bookingId?._id || task.bookingId?.id || ''),
        tags: task.tags,
        notes: task.notes || '',
      });
    } else {
      // Set type based on context
      let taskType: CreateTaskDto['type'] = initialType || 'generic';
      if (bookingId) taskType = 'booking';
      else if (clientId) taskType = 'client';
      else if (retreatId) taskType = 'retreat';

      setFormData(prev => ({
        ...prev,
        type: taskType,
        clientId: clientId || '',
        retreatId: retreatId || '',
        bookingId: bookingId || '',
      }));
    }
  }, [task, clientId, retreatId, bookingId, initialType]);

  // Load clients and retreats when form opens
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingClients(true);
        setLoadingRetreats(true);
        setLoadingBookings(true);

        const [clientsResponse, retreatsResponse, bookingsResponse] = await Promise.all([
          clientsApi.getAll(),
          retreatsApi.getAll(),
          bookingsApi.getAll(),
        ]);

        setClients(normalizeList(clientsResponse));
        setRetreats(normalizeList(retreatsResponse));
        setBookings(normalizeList(bookingsResponse));
      } catch (error) {
        console.error('Error loading clients and retreats:', error);
      } finally {
        setLoadingClients(false);
        setLoadingRetreats(false);
        setLoadingBookings(false);
      }
    };

    loadData();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!formData.tags?.includes(tagInput.trim())) {
        setFormData(prev => ({
          ...prev,
          tags: [...(prev.tags || []), tagInput.trim()],
        }));
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags?.filter(tag => tag !== tagToRemove) || [],
    }));
  };

  const handleClientChange = (clientId: string) => {
    setFormData(prev => ({
      ...prev,
      clientId: clientId,
    }));
  };

  const handleRetreatChange = (retreatId: string) => {
    setFormData(prev => ({
      ...prev,
      retreatId: retreatId,
    }));
  };

  const handleBookingChange = (selectedBookingId: string) => {
    const booking = bookings.find(item => (item._id || item.id) === selectedBookingId);
    setFormData(prev => ({
      ...prev,
      bookingId: selectedBookingId,
      clientId: booking ? (typeof booking.clientId === 'object' ? booking.clientId?._id || booking.clientId?.id : booking.clientId) : prev.clientId,
      retreatId: booking ? (typeof booking.retreatId === 'object' ? booking.retreatId?._id || booking.retreatId?.id : booking.retreatId) : prev.retreatId,
    }));
  };

  const formatInputDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const setDueDateOffset = (daysFromToday: number) => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromToday);
    setFormData(prev => ({
      ...prev,
      dueDate: formatInputDate(date),
    }));
  };

  const formatDate = (value?: string | Date) => {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
  };

  // Create options for searchable selects
  const clientOptions = clients
    .map(client => {
      const id = client._id || client.id;
      const displayId = client.display_id || client.displayId || client.clientNumber;
      const displayLabel = displayId ? `Client #${displayId}` : 'No client #';
      const name = `${client.firstName || client.fname || ''} ${client.lastName || client.lname || ''}`.trim();
      return {
        id,
        label: [displayLabel, name || client.email || 'Unnamed client'].filter(Boolean).join(' - '),
        sublabel: [client.email, client.phone, client.workflowStatus || client.status].filter(Boolean).join(' • '),
      };
    })
    .filter(option => option.id);

  const retreatOptions = retreats
    .map(retreat => {
      const id = retreat._id || retreat.id;
      const startDate = formatDate(retreat.startDate || retreat.dates?.startDate);
      const endDate = formatDate(retreat.endDate);
      const dateRange = [startDate, endDate].filter(Boolean).join(' - ');
      const displayId = retreat.display_id || retreat.displayId || retreat.retreatNumber || retreat.code;
      return {
        id,
        label: [displayId ? `Retreat #${displayId}` : '', retreat.name || retreat.title || retreat.retreatName || 'Unnamed retreat'].filter(Boolean).join(' - '),
        sublabel: [dateRange, retreat.location, retreat.status].filter(Boolean).join(' • '),
      };
    })
    .filter(option => option.id);

  const bookingOptions = bookings
    .map(booking => {
      const id = booking._id || booking.id;
      const client = typeof booking.clientId === 'object' ? booking.clientId : {};
      const retreat = typeof booking.retreatId === 'object' ? booking.retreatId : {};
      const clientName = `${client.firstName || client.fname || ''} ${client.lastName || client.lname || ''}`.trim();
      const bookingNumber = booking.bookingNumber || booking.display_id || booking.bookingHash || String(id || '').slice(-6);
      return {
        id,
        label: `Booking #${bookingNumber}${clientName ? ` — ${clientName}` : ''}`,
        sublabel: [retreat.code || retreat.name, booking.status].filter(Boolean).join(' • '),
      };
    })
    .filter(option => option.id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Create submission data
    const submitData: CreateTaskDto = {
      ...formData,
      description: formData.description.trim() || formData.name.trim(),
      // Convert empty strings to undefined for optional fields
      dueDate: formData.dueDate || undefined,
      clientId: formData.clientId || undefined,
      retreatId: formData.retreatId || undefined,
      bookingId: formData.bookingId || undefined,
      notes: formData.notes || undefined,
    };

    onSubmit(submitData);
  };

  return (
    <div className="task-form-overlay">
      <div className="task-form-modal">
        <div className="task-form-header">
          <h2>{task ? 'Edit Task' : 'Create New Task'}</h2>
          <button className="close-btn" onClick={onCancel}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="task-form">
          {error && <div className="error-message">{error}</div>}
          {bookingId && (
            <div className="task-context-banner">
              <span>Booking</span>
              <strong>{bookingLabel || `#${bookingId.slice(-6)}`}</strong>
            </div>
          )}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="name">Task Name *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="Enter task name..."
              />
            </div>

            <div className="form-group">
              <label htmlFor="type">Type *</label>
              <select
                id="type"
                name="type"
                value={formData.type}
                onChange={handleChange}
                required
              >
                <option value="generic">Generic</option>
                <option value="client">Client Related</option>
                <option value="booking">Booking Related</option>
                <option value="retreat">Retreat Related</option>
              </select>
            </div>
          </div>

          {/* Dynamic fields based on type */}
          {formData.type === 'client' && (
            <div className="form-group">
              <label htmlFor="clientId">Select Client *</label>
              <SearchableSelect
                id="clientId"
                name="clientId"
                value={formData.clientId || ''}
                options={clientOptions}
                placeholder="Search for a client..."
                onChange={handleClientChange}
                required
                loading={loadingClients}
              />
            </div>
          )}

          {formData.type === 'retreat' && (
            <div className="form-group">
              <label htmlFor="retreatId">Select Retreat *</label>
              <SearchableSelect
                id="retreatId"
                name="retreatId"
                value={formData.retreatId || ''}
                options={retreatOptions}
                placeholder="Search for a retreat..."
                onChange={handleRetreatChange}
                required
                loading={loadingRetreats}
              />
            </div>
          )}

          {formData.type === 'booking' && (
            <div className="form-group">
              <label htmlFor="bookingId">Select Booking *</label>
              <SearchableSelect
                id="bookingId"
                name="bookingId"
                value={formData.bookingId || ''}
                options={bookingOptions}
                placeholder="Search by booking or client..."
                onChange={handleBookingChange}
                required
                loading={loadingBookings}
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="description">Description (optional)</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              placeholder="Add details only if the title is not enough."
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="urgency">Urgency *</label>
              <select
                id="urgency"
                name="urgency"
                value={formData.urgency}
                onChange={handleChange}
                required
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="dueDate">Due Date</label>
              <input
                type="date"
                id="dueDate"
                name="dueDate"
                value={formData.dueDate}
                onChange={handleChange}
                min={formatInputDate(new Date())}
              />
              <div className="quick-date-actions" aria-label="Quick due date actions">
                <button type="button" onClick={() => setDueDateOffset(0)}>
                  Today
                </button>
                <button type="button" onClick={() => setDueDateOffset(1)}>
                  Tomorrow
                </button>
              </div>
            </div>
          </div>



          <div className="form-group">
            <label htmlFor="tags">Tags</label>
            <div className="tags-input-container">
              <input
                type="text"
                id="tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="Type a tag and press Enter"
              />
              <div className="tags-display">
                {formData.tags?.map((tag, index) => (
                  <span key={index} className="tag">
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="tag-remove"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              placeholder="Additional notes or comments..."
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {task ? 'Update Task' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
