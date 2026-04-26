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
  retreatName?: string;
  createdAt?: string;
}

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
    retreatId: ''
  });
  const [clients, setClients] = useState<Client[]>([]);
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [filteredClientsForForm, setFilteredClientsForForm] = useState<Client[]>([]);
  const [bookings, setBookings] = useState<RetreatClient[]>([]);
  const [selectedClientFilter, setSelectedClientFilter] = useState<string>('');
  const [selectedRetreatFilter, setSelectedRetreatFilter] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'reminders' | 'templates'>('reminders');

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
          retreatName: retreat ? retreat.name : 'Unknown Retreat'
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

      setFormData({
        title: editingReminder.title || '',
        description: editingReminder.description || '',
        dueDate: dateValue,
        priority: (editingReminder.priority as any) || 'medium',
        actionType: (editingReminder.actionType as any) || 'general',
        notes: editingReminder.notes || '',
        clientId: editingReminder.clientId || '',
        retreatId: editingReminder.retreatId || ''
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
        retreatId: ''
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

    setFormData({
      title: reminder.title || '',
      description: reminder.description || '',
      dueDate: dateValue,
      priority: (reminder.priority as any) || 'medium',
      actionType: (reminder.actionType as any) || 'general',
      notes: reminder.notes || '',
      clientId: reminder.clientId || '',
      retreatId: reminder.retreatId || ''
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
      const submitData = {
        ...formData,
        dueDate: new Date(formData.dueDate),
        status: 'pending' as const
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
        retreatId: ''
      });
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

                <div className="form-group">
                  <label htmlFor="reminder-retreat">Retreat *</label>
                  <select
                    id="reminder-retreat"
                    value={formData.retreatId}
                    onChange={(e) => setFormData({...formData, retreatId: e.target.value, clientId: ''})}
                    required
                  >
                    <option value="">Select a retreat first...</option>
                    {retreats.map((retreat) => (
                      <option key={retreat._id} value={retreat._id}>
                        {retreat.name} - {retreat.location}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="reminder-client">Client *</label>
                  <select
                    id="reminder-client"
                    value={formData.clientId}
                    onChange={(e) => setFormData({...formData, clientId: e.target.value})}
                    required
                    disabled={!formData.retreatId}
                  >
                    <option value="">{!formData.retreatId ? 'Select a retreat first...' : 'Select a client...'}</option>
                    {filteredClientsForForm.map((client) => (
                      <option key={client._id} value={client._id}>
                        {client.firstName} {client.lastName} ({client.email})
                      </option>
                    ))}
                  </select>
                  {formData.retreatId && filteredClientsForForm.length === 0 && (
                    <small style={{color: '#ff6b6b', fontSize: '12px', marginTop: '4px', display: 'block'}}>
                      No clients found for this retreat. Make sure clients have bookings for this retreat.
                    </small>
                  )}
                </div>

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
                    <div className="flex items-center text-sm text-gray-900">
                      <Icon icon={FiUser} className="w-4 h-4 mr-2 text-gray-400" />
                      {reminder.clientName}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900">
                      <Icon icon={FiCalendar} className="w-4 h-4 mr-2 text-gray-400" />
                      {reminder.retreatName}
                    </div>
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