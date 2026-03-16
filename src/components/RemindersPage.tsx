import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams, ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { remindersApi, clientsApi, retreatsApi, bookingsApi } from '../services/api';
import { Reminder, Client, Retreat, RetreatClient } from '../types';
import { AutoReminderTemplates } from './AutoReminderTemplates';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import './ClientsGrid.css';

ModuleRegistry.registerModules([AllCommunityModule]);

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
  const gridApiRef = useRef<GridApi | null>(null);

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

  const StatusCellRenderer = (params: ICellRendererParams) => {
    const status = params.value?.toLowerCase() || 'pending';
    const statusClass = `status-${status}`;
    return `<span class="status-badge ${statusClass}">${params.value || 'Pending'}</span>`;
  };

  const PriorityCellRenderer = (params: ICellRendererParams) => {
    const priority = params.value?.toLowerCase() || 'medium';
    const priorityIcons = {
      low: '🟢',
      medium: '🟡',
      high: '🟠',
      urgent: '🔴'
    };
    const icon = priorityIcons[priority as keyof typeof priorityIcons] || '🟡';
    const displayName = priority.charAt(0).toUpperCase() + priority.slice(1);
    return `${icon} ${displayName}`;
  };

  const ActionsCellRenderer = (params: ICellRendererParams) => {
    const id = params.data._id || '';
    return `
      <div class="cell-actions">
        <button class="edit-btn" data-action="edit" data-id="${id}">✏️</button>
        <button class="delete-btn" data-action="delete" data-id="${id}">🗑️</button>
        <button class="complete-btn" data-action="complete" data-id="${id}">✅</button>
      </div>
    `;
  };

  const columnDefs: ColDef[] = [
    {
      headerName: 'Title',
      field: 'title',
      width: 200,
      pinned: 'left',
      cellStyle: { fontWeight: 'bold' }
    },
    {
      headerName: 'Client',
      field: 'clientName',
      width: 150
    },
    {
      headerName: 'Retreat',
      field: 'retreatName',
      width: 150
    },
    {
      headerName: 'Priority',
      field: 'priority',
      width: 120,
      cellRenderer: PriorityCellRenderer
    },
    {
      headerName: 'Status',
      field: 'status',
      width: 120,
      cellRenderer: StatusCellRenderer
    },
    {
      headerName: 'Due Date',
      field: 'dueDate',
      width: 120,
      cellRenderer: (params: ICellRendererParams) => {
        if (!params.value) return '';
        // Handle date properly to avoid timezone issues
        const date = new Date(params.value + 'T00:00:00');
        return date.toLocaleDateString();
      }
    },
    {
      headerName: 'Action Type',
      field: 'actionType',
      width: 140
    },
    {
      headerName: 'Description',
      field: 'description',
      width: 300,
      flex: 1
    },
    {
      headerName: 'Actions',
      field: 'actions',
      width: 120,
      cellRenderer: ActionsCellRenderer,
      sortable: false,
      filter: false,
      pinned: 'right'
    }
  ];

  const defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
  };

  const onGridReady = useCallback((params: GridReadyEvent) => {
    gridApiRef.current = params.api;
    params.api.sizeColumnsToFit();
  }, []);

  const onCellClicked = useCallback((event: any) => {
    const target = event.event?.target;
    if (target?.dataset?.action === 'edit') {
      const reminderId = target.dataset.id;
      const reminder = reminders.find(r => r._id === reminderId);
      if (reminder) {
        setEditingReminder(reminder);
        setFormData({
          title: reminder.title,
          description: reminder.description,
          dueDate: new Date(reminder.dueDate).toISOString().split('T')[0],
          priority: reminder.priority || 'medium',
          actionType: reminder.actionType as any,
          notes: reminder.notes || '',
          clientId: reminder.clientId,
          retreatId: reminder.retreatId
        });
        setShowAddForm(true);
      }
    } else if (target?.dataset?.action === 'delete') {
      const reminderId = target.dataset.id;
      handleDeleteReminder(reminderId);
    } else if (target?.dataset?.action === 'complete') {
      const reminderId = target.dataset.id;
      handleCompleteReminder(reminderId);
    }
  }, [reminders]);

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
            className="add-btn"
            disabled={showAddForm}
          >
            ➕ Add New Reminder
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
      <div className="reminders-grid">
        <div className="ag-theme-alpine" style={{ height: 600, width: '100%' }}>
          <AgGridReact
            rowData={filteredReminders}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            onGridReady={onGridReady}
            onCellClicked={onCellClicked}
            rowSelection="multiple"
            suppressRowClickSelection={true}
            pagination={true}
            paginationPageSize={20}
            enableBrowserTooltips={true}
            headerHeight={40}
            rowHeight={45}
          />
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