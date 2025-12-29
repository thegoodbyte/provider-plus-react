import React, { useState, useEffect } from 'react';
import { Client, ClientMedical, ClientRequirement, Reminder } from '../types';
import { clientsApi, clientMedicalApi, clientRequirementsApi, remindersApi, retreatsApi, bookingsApi } from '../services/api';
import MedicalTrackingTab from './MedicalTrackingTab';
import './ClientsGrid.css';

interface ClientDetailViewProps {
  clientId: string;
  onBack: () => void;
}

const ClientDetailView: React.FC<ClientDetailViewProps> = ({ clientId, onBack }) => {
  const [client, setClient] = useState<Client | null>(null);
  const [medicalData, setMedicalData] = useState<ClientMedical[]>([]);
  const [requirements, setRequirements] = useState<ClientRequirement[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedRetreatId, setSelectedRetreatId] = useState<string>('');
  const [retreats, setRetreats] = useState<any[]>([]);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [reminderFormData, setReminderFormData] = useState({
    title: '',
    description: '',
    dueDate: new Date().toISOString().split('T')[0],
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    actionType: 'general' as 'ask_for_document' | 'review_document' | 'follow_up' | 'medical_clearance' | 'general' | 'payment',
    notes: '',
    retreatId: ''
  });

  useEffect(() => {
    fetchClientData();
  }, [clientId]);

  const fetchClientData = async () => {
    try {
      setLoading(true);
      // Only call endpoints that exist - requirements and reminders APIs don't exist yet
      const [clientResponse, medicalResponse, bookingsResponse] = await Promise.all([
        clientsApi.getOne(clientId),
        clientMedicalApi.getByClient(clientId),
        bookingsApi.getByClient(clientId)
      ]);

      setClient(clientResponse.data);
      setMedicalData(medicalResponse.data || []);
      // Set empty arrays for features not yet implemented
      setRequirements([]);
      setReminders([]);

      // Extract retreats from bookings
      const clientRetreats = bookingsResponse.data.map((booking: any) => booking.retreatDetails || booking.retreatId).filter(Boolean);
      setRetreats(clientRetreats);

      // Set first retreat as selected by default
      if (clientRetreats.length > 0) {
        setSelectedRetreatId(clientRetreats[0]._id || clientRetreats[0]);
      }
    } catch (error) {
      console.error('Error fetching client data:', error);
      // Set error state or show user-friendly message
      alert('Error loading client details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (type: 'liver' | 'ekg', retreatId: string) => {
    if (!selectedFile) return;

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('clientId', clientId);
      formData.append('retreatId', retreatId);

      await clientMedicalApi.uploadFile(formData, type === 'liver' ? 'liver-panel' : 'ekg');
      setSelectedFile(null);
      fetchClientData(); // Refresh data
    } catch (error) {
      console.error('Error uploading file:', error);
    }
  };

  const handleRequirementUpdate = async (requirementId: string, updates: Partial<ClientRequirement>) => {
    try {
      await clientRequirementsApi.update(requirementId, updates);
      fetchClientData(); // Refresh data
    } catch (error) {
      console.error('Error updating requirement:', error);
    }
  };

  const handleMedicalUpdate = async (medicalId: string, updates: Partial<ClientMedical>) => {
    try {
      await clientMedicalApi.update(medicalId, updates);
      fetchClientData(); // Refresh data
    } catch (error) {
      console.error('Error updating medical data:', error);
    }
  };

  const handleAddReminder = () => {
    setEditingReminder(null);
    setReminderFormData({
      title: '',
      description: '',
      dueDate: new Date().toISOString().split('T')[0],
      priority: 'medium',
      actionType: 'general',
      notes: '',
      retreatId: ''
    });
    setShowReminderModal(true);
  };

  const handleEditReminder = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setReminderFormData({
      title: reminder.title,
      description: reminder.description,
      dueDate: new Date(reminder.dueDate).toISOString().split('T')[0],
      priority: reminder.priority || 'medium',
      actionType: reminder.actionType,
      notes: reminder.notes || '',
      retreatId: reminder.retreatId || ''
    });
    setShowReminderModal(true);
  };

  const handleDeleteReminder = async (reminderId: string) => {
    if (window.confirm('Are you sure you want to delete this reminder?')) {
      try {
        await remindersApi.delete(reminderId);
        fetchClientData(); // Refresh data
      } catch (error) {
        console.error('Error deleting reminder:', error);
        alert('Error deleting reminder');
      }
    }
  };

  const handleReminderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const submitData = {
        ...reminderFormData,
        clientId,
        dueDate: new Date(reminderFormData.dueDate),
        status: 'pending' as const
      };

      if (editingReminder) {
        await remindersApi.update(editingReminder._id!, submitData);
      } else {
        await remindersApi.create(submitData);
      }

      setShowReminderModal(false);
      setEditingReminder(null);
      setReminderFormData({
        title: '',
        description: '',
        dueDate: new Date().toISOString().split('T')[0],
        priority: 'medium',
        actionType: 'general',
        notes: '',
        retreatId: ''
      });
      fetchClientData(); // Refresh data
    } catch (error) {
      console.error('Error saving reminder:', error);
      alert('Error saving reminder');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': case 'completed': return '#28a745';
      case 'received': case 'reviewed': return '#007bff';
      case 'pending': case 'sent': return '#ffc107';
      case 'overdue': case 'rejected': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const getOverallStatus = () => {
    const totalRequirements = requirements.length;
    const completedRequirements = requirements.filter(r => r.status === 'approved').length;
    const overdueRequirements = requirements.filter(r => r.isOverdue).length;

    if (overdueRequirements > 0) return { status: 'Overdue Items', color: '#dc3545' };
    if (completedRequirements === totalRequirements && totalRequirements > 0) return { status: 'All Complete', color: '#28a745' };
    if (completedRequirements > 0) return { status: 'In Progress', color: '#007bff' };
    return { status: 'Not Started', color: '#6c757d' };
  };

  if (loading) {
    return (
      <div className="client-detail-loading">
        <div className="loading-spinner">⏳</div>
        <p>Loading client details...</p>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="client-detail-error">
        <h2>❌ Client Not Found</h2>
        <button onClick={onBack} className="back-btn">← Back to Clients</button>
      </div>
    );
  }

  const overallStatus = getOverallStatus();

  return (
    <div className="client-detail-container">
      <div className="client-detail-header">
        <button onClick={onBack} className="back-btn">← Back to Clients</button>
        <div className="client-header-info">
          <h1>👤 {client.firstName} {client.lastName}</h1>
          <div className="client-meta">
            <span className="client-id">ID: {client._id}</span>
            <span className="client-email">📧 {client.email}</span>
            <span className="client-phone">📞 {client.phone}</span>
            <span className={`overall-status`} style={{ backgroundColor: overallStatus.color }}>
              {overallStatus.status}
            </span>
          </div>
        </div>
      </div>

      <div className="client-detail-tabs">
        <button
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📋 Overview
        </button>
        <button
          className={`tab-btn ${activeTab === 'medical' ? 'active' : ''}`}
          onClick={() => setActiveTab('medical')}
        >
          🏥 Medical Records
        </button>
        <button
          className={`tab-btn ${activeTab === 'requirements' ? 'active' : ''}`}
          onClick={() => setActiveTab('requirements')}
        >
          ✅ Requirements
        </button>
        <button
          className={`tab-btn ${activeTab === 'reminders' ? 'active' : ''}`}
          onClick={() => setActiveTab('reminders')}
        >
          🔔 Reminders
        </button>
      </div>

      <div className="client-detail-content">
        {activeTab === 'overview' && (
          <div className="overview-tab">
            <div className="info-grid">
              <div className="info-card">
                <h3>👤 Personal Information</h3>
                <div className="info-row">
                  <strong>Full Name:</strong> {client.firstName} {client.lastName}
                </div>
                <div className="info-row">
                  <strong>Preferred Name:</strong> {client.preferredName || 'N/A'}
                </div>
                <div className="info-row">
                  <strong>Email:</strong> {client.email}
                </div>
                <div className="info-row">
                  <strong>Phone:</strong> {client.phone}
                </div>
                <div className="info-row">
                  <strong>Date of Birth:</strong> {client.dateOfBirth ? new Date(client.dateOfBirth).toLocaleDateString() : 'N/A'}
                </div>
                <div className="info-row">
                  <strong>Gender:</strong> {client.gender || 'N/A'}
                </div>
                <div className="info-row">
                  <strong>Occupation:</strong> {client.occupation || 'N/A'}
                </div>
              </div>

              <div className="info-card">
                <h3>🏠 Address Information</h3>
                <div className="info-row">
                  <strong>Address:</strong> {client.address}
                </div>
                <div className="info-row">
                  <strong>City:</strong> {client.city || 'N/A'}
                </div>
                <div className="info-row">
                  <strong>State:</strong> {client.state || 'N/A'}
                </div>
                <div className="info-row">
                  <strong>Zip Code:</strong> {client.zipCode || 'N/A'}
                </div>
                <div className="info-row">
                  <strong>Country:</strong> {client.country || 'N/A'}
                </div>
              </div>

              <div className="info-card">
                <h3>🚨 Emergency Contact</h3>
                <div className="info-row">
                  <strong>Emergency Contact:</strong> {client.emergencyContact || 'N/A'}
                </div>
                <div className="info-row">
                  <strong>Emergency Phone:</strong> {client.emergencyContactPhone || 'N/A'}
                </div>
              </div>

              <div className="info-card">
                <h3>🏥 Health Information</h3>
                <div className="info-row">
                  <strong>Height:</strong> {client.height || 'N/A'}
                </div>
                <div className="info-row">
                  <strong>Weight:</strong> {client.weight ? `${client.weight} lbs` : 'N/A'}
                </div>
                <div className="info-row">
                  <strong>Medical Conditions:</strong>
                  <div className="text-content">{client.medicalConditions || 'None reported'}</div>
                </div>
                <div className="info-row">
                  <strong>Dietary Restrictions:</strong>
                  <div className="text-content">{client.dietaryRestrictions || 'None reported'}</div>
                </div>
                {client.notes && (
                  <div className="info-row">
                    <strong>Notes:</strong>
                    <div className="text-content">{client.notes}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'medical' && (
          <div className="medical-tab">
            {retreats.length > 0 ? (
              <>
                <div className="retreat-selector" style={{ marginBottom: '24px' }}>
                  <label htmlFor="retreat-select" style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                    Select Retreat for Medical Tracking:
                  </label>
                  <select
                    id="retreat-select"
                    value={selectedRetreatId}
                    onChange={(e) => setSelectedRetreatId(e.target.value)}
                    style={{ padding: '12px', borderRadius: '8px', border: '2px solid #e1e5e9', fontSize: '14px', minWidth: '300px' }}
                  >
                    <option value="">Select a retreat...</option>
                    {retreats.map((retreat) => (
                      <option key={retreat._id || retreat} value={retreat._id || retreat}>
                        {retreat.name || `Retreat ${retreat._id || retreat}`} - {retreat.location || 'Location TBD'}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedRetreatId && (
                  <MedicalTrackingTab
                    clientId={clientId}
                    retreatId={selectedRetreatId}
                  />
                )}
              </>
            ) : (
              <div className="no-medical-records">
                <h3>📋 No Retreat Bookings</h3>
                <p>This client has no retreat bookings. Medical tracking is only available for clients who are booked for retreats.</p>
                <p>To enable medical tracking, first create a booking for this client in the Bookings section.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'requirements' && (
          <div className="requirements-tab">
            <div className="requirements-summary">
              <h3>📊 Requirements Summary</h3>
              <div className="summary-stats">
                <div className="stat-card completed">
                  <span className="stat-number">{requirements.filter(r => r.status === 'approved').length}</span>
                  <span className="stat-label">Completed</span>
                </div>
                <div className="stat-card pending">
                  <span className="stat-number">{requirements.filter(r => r.status === 'pending' || r.status === 'sent').length}</span>
                  <span className="stat-label">Pending</span>
                </div>
                <div className="stat-card overdue">
                  <span className="stat-number">{requirements.filter(r => r.isOverdue).length}</span>
                  <span className="stat-label">Overdue</span>
                </div>
                <div className="stat-card total">
                  <span className="stat-number">{requirements.length}</span>
                  <span className="stat-label">Total</span>
                </div>
              </div>
            </div>

            <div className="requirements-list">
              {requirements.map((req) => (
                <div key={req._id} className="requirement-card">
                  <div className="requirement-header">
                    <h4>{req.requirementId}</h4>
                    <span
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(req.status || 'pending') }}
                    >
                      {req.status}
                    </span>
                  </div>
                  <div className="requirement-details">
                    <div className="detail-row">
                      <strong>Due Date:</strong> {req.dueDate ? new Date(req.dueDate).toLocaleDateString() : 'Not set'}
                    </div>
                    <div className="detail-row">
                      <strong>Sent Date:</strong> {req.sentDate ? new Date(req.sentDate).toLocaleDateString() : 'Not sent'}
                    </div>
                    <div className="detail-row">
                      <strong>Received Date:</strong> {req.receivedDate ? new Date(req.receivedDate).toLocaleDateString() : 'Not received'}
                    </div>
                    {req.isOverdue && (
                      <div className="detail-row overdue-warning">
                        <strong>⚠️ Overdue by:</strong> {req.daysPastDue} days
                      </div>
                    )}
                    {req.fileName && (
                      <div className="detail-row">
                        <strong>File:</strong> 📄 {req.fileName}
                      </div>
                    )}
                    {req.notes && (
                      <div className="detail-row">
                        <strong>Notes:</strong>
                        <div className="text-content">{req.notes}</div>
                      </div>
                    )}
                  </div>
                  <div className="requirement-actions">
                    <button
                      onClick={() => handleRequirementUpdate(req._id!, {
                        status: 'received',
                        receivedDate: new Date()
                      })}
                      className="mark-received-btn"
                      disabled={req.status === 'approved' || req.status === 'received'}
                    >
                      ✅ Mark Received
                    </button>
                    <button
                      onClick={() => handleRequirementUpdate(req._id!, {
                        status: 'approved',
                        approvedDate: new Date()
                      })}
                      className="approve-btn"
                      disabled={req.status === 'approved'}
                    >
                      ✅ Approve
                    </button>
                  </div>
                </div>
              ))}

              {requirements.length === 0 && (
                <div className="no-requirements">
                  <h3>📋 No Requirements</h3>
                  <p>No requirements found for this client.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'reminders' && (
          <div className="reminders-tab">
            <div className="reminders-header">
              <h3>🔔 Reminders</h3>
              <button onClick={handleAddReminder} className="add-reminder-btn">
                ➕ Add Reminder
              </button>
            </div>
            <div className="reminders-list">
              {reminders.map((reminder) => (
                <div key={reminder._id} className={`reminder-card priority-${reminder.priority}`}>
                  <div className="reminder-header">
                    <h4>🔔 {reminder.title}</h4>
                    <span
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(reminder.status || 'pending') }}
                    >
                      {reminder.status}
                    </span>
                  </div>
                  <div className="reminder-details">
                    <p>{reminder.description}</p>
                    <div className="detail-row">
                      <strong>Due Date:</strong> {new Date(reminder.dueDate).toLocaleDateString()}
                    </div>
                    <div className="detail-row">
                      <strong>Priority:</strong>
                      <span className={`priority-badge priority-${reminder.priority}`}>
                        {reminder.priority?.toUpperCase()}
                      </span>
                    </div>
                    <div className="detail-row">
                      <strong>Action Type:</strong> {reminder.actionType}
                    </div>
                    {reminder.assignedTo && (
                      <div className="detail-row">
                        <strong>Assigned To:</strong> {reminder.assignedTo}
                      </div>
                    )}
                    {reminder.notes && (
                      <div className="detail-row">
                        <strong>Notes:</strong>
                        <div className="text-content">{reminder.notes}</div>
                      </div>
                    )}
                  </div>
                  <div className="reminder-actions">
                    <button
                      onClick={() => handleEditReminder(reminder)}
                      className="edit-btn"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => handleDeleteReminder(reminder._id!)}
                      className="delete-btn"
                    >
                      🗑️ Delete
                    </button>
                    <button
                      onClick={() => remindersApi.complete(reminder._id!)}
                      className="complete-btn"
                      disabled={reminder.status === 'completed'}
                    >
                      ✅ Complete
                    </button>
                    <button
                      onClick={() => remindersApi.dismiss(reminder._id!)}
                      className="dismiss-btn"
                      disabled={reminder.status === 'dismissed'}
                    >
                      ❌ Dismiss
                    </button>
                  </div>
                </div>
              ))}

              {reminders.length === 0 && (
                <div className="no-reminders">
                  <h3>🔔 No Reminders</h3>
                  <p>No reminders found for this client.</p>
                </div>
              )}
            </div>
          </div>
        )}

      {/* Reminder Add/Edit Modal */}
      {showReminderModal && (
        <div className="modal-overlay" onClick={() => setShowReminderModal(false)}>
          <div className="modal reminder-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingReminder ? 'Edit Reminder' : 'Add New Reminder'}</h3>
            <form onSubmit={handleReminderSubmit}>
              <div className="reminder-form-grid">
                <div className="form-group">
                  <label htmlFor="reminder-title">Title *</label>
                  <input
                    type="text"
                    id="reminder-title"
                    value={reminderFormData.title}
                    onChange={(e) => setReminderFormData({...reminderFormData, title: e.target.value})}
                    required
                    placeholder="e.g., Follow up on medical clearance"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="reminder-priority">Priority</label>
                  <select
                    id="reminder-priority"
                    value={reminderFormData.priority}
                    onChange={(e) => setReminderFormData({...reminderFormData, priority: e.target.value as any})}
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
                    value={reminderFormData.dueDate}
                    onChange={(e) => setReminderFormData({...reminderFormData, dueDate: e.target.value})}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="reminder-action-type">Action Type</label>
                  <select
                    id="reminder-action-type"
                    value={reminderFormData.actionType}
                    onChange={(e) => setReminderFormData({...reminderFormData, actionType: e.target.value as any})}
                  >
                    <option value="general">General</option>
                    <option value="ask_for_document">Ask for Document</option>
                    <option value="review_document">Review Document</option>
                    <option value="follow_up">Follow Up</option>
                    <option value="medical_clearance">Medical Clearance</option>
                    <option value="payment">Payment</option>
                  </select>
                </div>

                {retreats.length > 0 && (
                  <div className="form-group">
                    <label htmlFor="reminder-retreat">Related Retreat</label>
                    <select
                      id="reminder-retreat"
                      value={reminderFormData.retreatId}
                      onChange={(e) => setReminderFormData({...reminderFormData, retreatId: e.target.value})}
                    >
                      <option value="">No specific retreat</option>
                      {retreats.map((retreat) => (
                        <option key={retreat._id || retreat} value={retreat._id || retreat}>
                          {retreat.name || `Retreat ${retreat._id || retreat}`} - {retreat.location || 'Location TBD'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-group full-width">
                  <label htmlFor="reminder-description">Description *</label>
                  <textarea
                    id="reminder-description"
                    value={reminderFormData.description}
                    onChange={(e) => setReminderFormData({...reminderFormData, description: e.target.value})}
                    rows={3}
                    required
                    placeholder="Describe what needs to be done..."
                  />
                </div>

                <div className="form-group full-width">
                  <label htmlFor="reminder-notes">Additional Notes</label>
                  <textarea
                    id="reminder-notes"
                    value={reminderFormData.notes}
                    onChange={(e) => setReminderFormData({...reminderFormData, notes: e.target.value})}
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
                  onClick={() => setShowReminderModal(false)}
                  className="cancel-btn"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default ClientDetailView;