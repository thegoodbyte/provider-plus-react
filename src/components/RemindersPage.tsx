import React, { useState, useEffect, useCallback } from 'react';
import { remindersApi, clientsApi, retreatsApi, bookingsApi } from '../services/api';
import { Reminder, Client, Retreat, RetreatClient } from '../types';
import { AutoReminderTemplates } from './AutoReminderTemplates';
import { FiPlus, FiEdit2, FiTrash2, FiCheck, FiClock, FiUser, FiCalendar } from 'react-icons/fi';
import './ClientsGrid.css';

// Simple wrapper to fix TypeScript icon issues
const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

interface ReminderWithDetails {
  _id?: string;
  title: string;
  description: string;
  dueDate: Date | string;
  status?: 'pending' | 'sent' | 'completed' | 'dismissed' | 'overdue';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  actionType: string;
  notes?: string;
  clientId: string;
  retreatId: string;
  clientName?: string;
  clientDisplayId?: number;
  retreatName?: string;
  createdAt?: string;
}

const getRetreatCode = (retreat?: Retreat) => {
  if (!retreat) return 'Unknown Retreat';
  return retreat.retreatCode || retreat.code || retreat.name || 'Unknown Retreat';
};

const RemindersPage: React.FC = () => {
  const [reminders, setReminders] = useState<ReminderWithDetails[]>([]);
  const [filteredReminders, setFilteredReminders] = useState<ReminderWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingReminder, setEditingReminder] = useState<ReminderWithDetails | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dueDate: new Date().toLocaleDateString('en-CA'), // Use local date format YYYY-MM-DD
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    actionType: 'general' as 'ask_for_document' | 'review_document' | 'follow_up' | 'medical_clearance' | 'general' | 'payment',
    notes: '',
    clientId: '',
    retreatId: '',
    reminderType: 'client' as 'client' | 'retreat'  // New field to determine type
  });
  const [clients, setClients] = useState<Client[]>([]);
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [filteredClientsForForm, setFilteredClientsForForm] = useState<Client[]>([]);
  const [bookings, setBookings] = useState<RetreatClient[]>([]);
  const [selectedClientFilter, setSelectedClientFilter] = useState<string>('');
  const [selectedRetreatFilter, setSelectedRetreatFilter] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'reminders' | 'templates'>('reminders');
  const [clientSearchTerm, setClientSearchTerm] = useState<string>('');
  const [showClientDropdown, setShowClientDropdown] = useState<boolean>(false);

  const fetchReminders = useCallback(async () => {
    try {
      setIsLoading(true);
      const [remindersResponse, clientsResponse, retreatsResponse, bookingsResponse] = await Promise.all([
        remindersApi.getAll(),
        clientsApi.getAll(),
        retreatsApi.getAll(),
        bookingsApi.getAll()
      ]);

      const clientsMap = new Map<string, Client>(clientsResponse.data.filter((client: Client) => client._id).map((client: Client) => [client._id!, client]));
      const retreatsMap = new Map<string, Retreat>(retreatsResponse.data.filter((retreat: Retreat) => retreat._id).map((retreat: Retreat) => [retreat._id!, retreat]));

      const enrichedReminders: ReminderWithDetails[] = remindersResponse.data.map((reminder: Reminder) => {
        const client = clientsMap.get(reminder.clientId);
        const retreat = retreatsMap.get(reminder.retreatId);

        return {
          ...reminder,
          clientName: client ? `${client.firstName} ${client.lastName}` : 'Unknown Client',
          clientDisplayId: client?.display_id,
          retreatName: getRetreatCode(retreat)
        };
      });

      setReminders(enrichedReminders);
      setFilteredReminders(enrichedReminders);
      setClients(clientsResponse.data);
      setRetreats(retreatsResponse.data);
      setBookings(bookingsResponse.data);
    } catch (error) {
      console.error('Error fetching reminders:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  // Filter clients based on selected retreat in the form
  useEffect(() => {
    if (formData.retreatId && bookings.length > 0 && clients.length > 0) {
      const retreatBookings = bookings.filter(booking => booking.retreatId === formData.retreatId);
      const retreatClientIds = retreatBookings.map(booking => booking.clientId);
      const retreatClients = clients.filter(client => client._id && retreatClientIds.includes(client._id));
      setFilteredClientsForForm(retreatClients);
      // Clear client selection if previously selected client is not in this retreat
      if (formData.clientId && !retreatClientIds.includes(formData.clientId)) {
        setFormData(prev => ({ ...prev, clientId: '' }));
      }
    } else {
      setFilteredClientsForForm(clients);
    }
  }, [formData.retreatId, bookings, clients, formData.clientId]);

  // Populate form when editing a reminder
  useEffect(() => {
    if (editingReminder) {
      // Convert date to YYYY-MM-DD format for date input, handling timezone issues
      const dateValue = editingReminder.dueDate ?
        new Date(editingReminder.dueDate + 'T00:00:00').toLocaleDateString('en-CA') :
        new Date().toLocaleDateString('en-CA');

      // Determine reminder type based on which ID is present
      const reminderType = editingReminder.clientId ? 'client' : 'retreat';

      setFormData({
        title: editingReminder.title || '',
        description: editingReminder.description || '',
        dueDate: dateValue,
        priority: (editingReminder.priority as any) || 'medium',
        actionType: (editingReminder.actionType as any) || 'general',
        notes: editingReminder.notes || '',
        clientId: editingReminder.clientId || '',
        retreatId: editingReminder.retreatId || '',
        reminderType: reminderType
      });
    } else {
      // Reset form for new reminder
      setFormData({
        title: '',
        description: '',
        dueDate: new Date().toLocaleDateString('en-CA'),
        priority: 'medium',
        actionType: 'general',
        notes: '',
        clientId: '',
        retreatId: '',
        reminderType: 'client'
      });
    }
  }, [editingReminder]);

  useEffect(() => {
    let filtered = [...reminders];

    if (selectedClientFilter) {
      filtered = filtered.filter(r => r.clientId === selectedClientFilter);
    }

    if (selectedRetreatFilter) {
      filtered = filtered.filter(r => r.retreatId === selectedRetreatFilter);
    }

    setFilteredReminders(filtered);
  }, [selectedClientFilter, selectedRetreatFilter, reminders]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      sent: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      dismissed: 'bg-gray-100 text-gray-800',
      overdue: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-yellow-100 text-yellow-800';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800'
    };
    return colors[priority] || 'bg-yellow-100 text-yellow-800';
  };

  const formatDate = (date: string | Date) => {
    if (!date) return 'N/A';
    const dateObj = new Date(date);
    return dateObj.toLocaleDateString();
  };

  const handleEditReminder = (reminder: ReminderWithDetails) => {
    setEditingReminder(reminder);
    const dateValue = reminder.dueDate ?
      new Date(reminder.dueDate + 'T00:00:00').toLocaleDateString('en-CA') :
      new Date().toLocaleDateString('en-CA');

    // Determine reminder type based on which ID is present
    const reminderType = reminder.clientId ? 'client' : 'retreat';

    setFormData({
      title: reminder.title || '',
      description: reminder.description || '',
      dueDate: dateValue,
      priority: (reminder.priority as any) || 'medium',
      actionType: (reminder.actionType as any) || 'general',
      notes: reminder.notes || '',
      clientId: reminder.clientId || '',
      retreatId: reminder.retreatId || '',
      reminderType: reminderType
    });
    setShowAddForm(true);
  };

  const handleDeleteReminder = async (reminderId: string) => {
    if (window.confirm('Are you sure you want to delete this reminder?')) {
      try {
        await remindersApi.delete(reminderId);
        await fetchReminders();
      } catch (error) {
        console.error('Error deleting reminder:', error);
        alert('Error deleting reminder');
      }
    }
  };

  const handleCompleteReminder = async (reminderId: string) => {
    try {
      await remindersApi.complete(reminderId);
      await fetchReminders();
    } catch (error) {
      console.error('Error completing reminder:', error);
      alert('Error completing reminder');
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Prepare submit data based on reminder type
      const submitData: any = {
        title: formData.title,
        description: formData.description,
        dueDate: new Date(formData.dueDate),
        priority: formData.priority,
        actionType: formData.actionType,
        notes: formData.notes,
        status: 'pending' as const,
        // Set either clientId OR retreatId based on type
        clientId: formData.reminderType === 'client' ? formData.clientId : '',
        retreatId: formData.reminderType === 'retreat' ? formData.retreatId : ''
      };

      if (editingReminder && editingReminder._id) {
        await remindersApi.update(editingReminder._id, submitData);
      } else {
        await remindersApi.create(submitData);
      }

      setShowAddForm(false);
      setEditingReminder(null);
      setFormData({
        title: '',
        description: '',
        dueDate: new Date().toISOString().split('T')[0],
        priority: 'medium',
        actionType: 'general',
        notes: '',
        clientId: '',
        retreatId: '',
        reminderType: 'client'
      });
      setClientSearchTerm('');
      await fetchReminders();
    } catch (error) {
      console.error('Error saving reminder:', error);
      alert('Error saving reminder');
    }
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">🔔</div>
        <p>Loading reminders...</p>
      </div>
    );
  }

  return (
    <div className="reminders-page-container">
      <div className="reminders-header">
        <h2>🔔 Reminders Management</h2>

        {/* Tab Navigation */}
        <div className="tab-navigation">
          <button
            className={`tab-button ${activeTab === 'reminders' ? 'active' : ''}`}
            onClick={() => setActiveTab('reminders')}
          >
            📝 Active Reminders
          </button>
          <button
            className={`tab-button ${activeTab === 'templates' ? 'active' : ''}`}
            onClick={() => setActiveTab('templates')}
          >
            🤖 Auto Templates
          </button>
        </div>

        {activeTab === 'reminders' && (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select
            value={selectedClientFilter}
            onChange={(e) => setSelectedClientFilter(e.target.value)}
            style={{
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #ddd',
              fontSize: '14px',
              minWidth: '200px'
            }}
          >
            <option value="">All Clients</option>
            {clients.map((client) => (
              <option key={client._id} value={client._id}>
                {client.firstName} {client.lastName}
              </option>
            ))}
          </select>

          <select
            value={selectedRetreatFilter}
            onChange={(e) => setSelectedRetreatFilter(e.target.value)}
            style={{
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #ddd',
              fontSize: '14px',
              minWidth: '200px'
            }}
          >
            <option value="">All Retreats</option>
            {retreats.map((retreat) => (
              <option key={retreat._id} value={retreat._id}>
                {retreat.name} - {retreat.location}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowAddForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
            disabled={showAddForm}
          >
            <Icon icon={FiPlus} className="w-4 h-4" />
            Add New Reminder
          </button>
        </div>
        )}
      </div>

      {activeTab === 'reminders' && (
        <>
      {/* Summary Cards */}
      <div className="reminders-summary">
        <div className="summary-cards">
          <div className="summary-card">
            <div className="summary-number">{filteredReminders.filter(r => r.status === 'pending' || r.status === undefined).length}</div>
            <div className="summary-label">Pending</div>
          </div>
          <div className="summary-card">
            <div className="summary-number">{filteredReminders.filter(r => r.status === 'completed').length}</div>
            <div className="summary-label">Completed</div>
          </div>
          <div className="summary-card">
            <div className="summary-number">{filteredReminders.filter(r => r.priority === 'urgent').length}</div>
            <div className="summary-label">Urgent</div>
          </div>
          <div className="summary-card">
            <div className="summary-number">{filteredReminders.length}</div>
            <div className="summary-label">Total</div>
          </div>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="modal-overlay">
          <div className="modal reminder-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingReminder ? 'Edit Reminder' : 'Create New Reminder'}</h3>
            <form onSubmit={handleFormSubmit}>
              <div className="reminder-form-grid">
                {/* Reminder Type Selection */}
                <div className="form-group full-width">
                  <label>Reminder Type *</label>
                  <div style={{ display: 'flex', gap: '20px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        value="client"
                        checked={formData.reminderType === 'client'}
                        onChange={(e) => setFormData({...formData, reminderType: 'client', retreatId: ''})}
                        style={{ marginRight: '8px' }}
                      />
                      <Icon icon={FiUser} className="w-4 h-4 mr-1" />
                      Client-based
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        value="retreat"
                        checked={formData.reminderType === 'retreat'}
                        onChange={(e) => setFormData({...formData, reminderType: 'retreat', clientId: ''})}
                        style={{ marginRight: '8px' }}
                      />
                      <Icon icon={FiCalendar} className="w-4 h-4 mr-1" />
                      Retreat-based
                    </label>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="reminder-title">Title *</label>
                  <input
                    type="text"
                    id="reminder-title"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    required
                    placeholder="e.g., Follow up on medical clearance"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="reminder-priority">Priority</label>
                  <select
                    id="reminder-priority"
                    value={formData.priority}
                    onChange={(e) => setFormData({...formData, priority: e.target.value as any})}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="reminder-due-date">Due Date *</label>
                  <input
                    type="date"
                    id="reminder-due-date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="reminder-action-type">Action Type</label>
                  <select
                    id="reminder-action-type"
                    value={formData.actionType}
                    onChange={(e) => setFormData({...formData, actionType: e.target.value as any})}
                  >
                    <option value="general">General</option>
                    <option value="ask_for_document">Ask for Document</option>
                    <option value="review_document">Review Document</option>
                    <option value="follow_up">Follow Up</option>
                    <option value="medical_clearance">Medical Clearance</option>
                    <option value="payment">Payment</option>
                  </select>
                </div>

                {/* Show Retreat field only if retreat-based */}
                {formData.reminderType === 'retreat' && (
                  <div className="form-group">
                    <label htmlFor="reminder-retreat">Retreat *</label>
                    <select
                      id="reminder-retreat"
                      value={formData.retreatId}
                      onChange={(e) => setFormData({...formData, retreatId: e.target.value})}
                      required
                    >
                      <option value="">Select a retreat...</option>
                      {retreats.map((retreat) => (
                        <option key={retreat._id} value={retreat._id}>
                          {retreat.name} - {retreat.location}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Show Client field only if client-based */}
                {formData.reminderType === 'client' && (
                  <div className="form-group">
                    <label htmlFor="reminder-client">Client * (searchable)</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        id="client-search"
                        value={clientSearchTerm}
                        onChange={(e) => {
                          setClientSearchTerm(e.target.value);
                          setShowClientDropdown(true);
                        }}
                        onFocus={() => setShowClientDropdown(true)}
                        placeholder="Search by name or email..."
                        className="w-full"
                      />
                      {showClientDropdown && (
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          maxHeight: '200px',
                          overflowY: 'auto',
                          backgroundColor: 'white',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          zIndex: 1000,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }}>
                          {clients
                            .filter(client => {
                              const search = clientSearchTerm.toLowerCase();
                              return (
                                client.firstName?.toLowerCase().includes(search) ||
                                client.lastName?.toLowerCase().includes(search) ||
                                client.email?.toLowerCase().includes(search)
                              );
                            })
                            .slice(0, 10)
                            .map(client => (
                              <div
                                key={client._id}
                                onClick={() => {
                                  setFormData({...formData, clientId: client._id!});
                                  setClientSearchTerm(`${client.firstName} ${client.lastName} (${client.email})`);
                                  setShowClientDropdown(false);
                                }}
                                style={{
                                  padding: '8px 12px',
                                  cursor: 'pointer',
                                  borderBottom: '1px solid #f0f0f0'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                              >
                                {client.firstName} {client.lastName}
                                <span style={{ color: '#666', fontSize: '12px', marginLeft: '8px' }}>
                                  {client.email}
                                </span>
                              </div>
                            ))}
                          {clients.filter(client => {
                            const search = clientSearchTerm.toLowerCase();
                            return (
                              client.firstName?.toLowerCase().includes(search) ||
                              client.lastName?.toLowerCase().includes(search) ||
                              client.email?.toLowerCase().includes(search)
                            );
                          }).length === 0 && (
                            <div style={{ padding: '12px', color: '#666', textAlign: 'center' }}>
                              No clients found
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <input type="hidden" value={formData.clientId} required />
                  </div>
                )}

                <div className="form-group full-width">
                  <label htmlFor="reminder-description">Description *</label>
                  <textarea
                    id="reminder-description"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    rows={3}
                    required
                    placeholder="Describe what needs to be done..."
                  />
                </div>

                <div className="form-group full-width">
                  <label htmlFor="reminder-notes">Additional Notes</label>
                  <textarea
                    id="reminder-notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    rows={2}
                    placeholder="Any additional notes or context..."
                  />
                </div>
              </div>

              <div className="form-buttons">
                <button type="submit" className="save-btn">
                  {editingReminder ? 'Update Reminder' : 'Create Reminder'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingReminder(null);
                  }}
                  className="cancel-btn"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reminders Grid */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Retreat
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredReminders.map((reminder) => (
                <tr key={reminder._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{reminder.title}</div>
                    <div className="text-sm text-gray-500 truncate max-w-xs">
                      {reminder.description}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {reminder.clientName ? (
                      <div className="flex items-center text-sm text-gray-900">
                        <Icon icon={FiUser} className="w-4 h-4 mr-2 text-gray-400" />
                        <span className="font-semibold text-blue-700">
                          {reminder.clientDisplayId ? `#${reminder.clientDisplayId}` : ''}
                        </span>
                        <span className="ml-1">{reminder.clientName}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {reminder.retreatName ? (
                      <div className="flex items-center text-sm text-gray-900">
                        <Icon icon={FiCalendar} className="w-4 h-4 mr-2 text-gray-400" />
                        {reminder.retreatName}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getPriorityColor(reminder.priority || 'medium')}`}>
                      {reminder.priority || 'medium'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(reminder.status || 'pending')}`}>
                      {reminder.status || 'pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900">
                      <Icon icon={FiClock} className="w-4 h-4 mr-2 text-gray-400" />
                      {formatDate(reminder.dueDate)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {reminder.actionType}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditReminder(reminder)}
                        className="text-indigo-600 hover:text-indigo-900"
                        title="Edit"
                      >
                        <Icon icon={FiEdit2} className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleCompleteReminder(reminder._id!)}
                        className="text-green-600 hover:text-green-900"
                        title="Mark Complete"
                      >
                        <Icon icon={FiCheck} className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteReminder(reminder._id!)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete"
                      >
                        <Icon icon={FiTrash2} className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredReminders.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No reminders found
            </div>
          )}
        </div>
      </div>
        </>
      )}

      {activeTab === 'templates' && (
        <AutoReminderTemplates />
      )}
    </div>
  );
};

export default RemindersPage;
