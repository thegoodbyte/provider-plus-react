import React, { useState, useEffect } from 'react';
import { Client, ClientMedical, ClientRequirement, Reminder } from '../types';
import { clientsApi, clientMedicalApi, clientRequirementsApi, remindersApi, bookingsApi } from '../services/api';
import MedicalTrackingTab from './MedicalTrackingTab';
import ClientCeremoniesTab from './ClientCeremoniesTab';
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
  const [clientBookings, setClientBookings] = useState<any[]>([]);
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
      const [clientResponse, medicalResponse, bookingsResponse] = await Promise.all([
        clientsApi.getOne(clientId),
        clientMedicalApi.getByClient(clientId),
        bookingsApi.getByClient(clientId)
      ]);

      setClient(clientResponse.data);
      setMedicalData(medicalResponse.data || []);
      setClientBookings(bookingsResponse.data || []);

      // Extract retreats from bookings
      const clientRetreats = bookingsResponse.data.map((booking: any) => booking.retreatDetails || booking.retreatId).filter(Boolean);
      setRetreats(clientRetreats);

      // Set first retreat as selected by default
      if (clientRetreats.length > 0) {
        setSelectedRetreatId(clientRetreats[0]._id || clientRetreats[0]);

        // Fetch requirements for this client
        try {
          const requirementsResponse = await clientRequirementsApi.getByClient(clientId);
          setRequirements(requirementsResponse.data || []);
        } catch (reqError) {
          console.error('Error fetching requirements:', reqError);
          setRequirements([]);
        }

        // Fetch reminders for this client
        try {
          const remindersResponse = await remindersApi.getByClient(clientId);
          setReminders(remindersResponse.data || []);
        } catch (remError) {
          console.error('Error fetching reminders:', remError);
          setReminders([]);
        }
      } else {
        setRequirements([]);
        setReminders([]);
      }
    } catch (error) {
      console.error('Error fetching client data:', error);
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
        <button
          className={`tab-btn ${activeTab === 'retreats' ? 'active' : ''}`}
          onClick={() => setActiveTab('retreats')}
        >
          🏃‍♂️ Retreat History
        </button>
        <button
          className={`tab-btn ${activeTab === 'ceremonies' ? 'active' : ''}`}
          onClick={() => setActiveTab('ceremonies')}
        >
          🔮 Ceremonies
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
            {/* Retreat Selector for Requirements */}
            {retreats.length > 0 ? (
              <>
                <div className="retreat-selector" style={{ marginBottom: '24px' }}>
                  <label htmlFor="retreat-req-select" style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                    Select Retreat for Requirements:
                  </label>
                  <select
                    id="retreat-req-select"
                    value={selectedRetreatId}
                    onChange={async (e) => {
                      setSelectedRetreatId(e.target.value);
                      if (e.target.value) {
                        try {
                          const requirementsResponse = await clientRequirementsApi.getByClientAndRetreat(clientId, e.target.value);
                          setRequirements(requirementsResponse.data || []);
                        } catch (error) {
                          console.error('Error fetching requirements for retreat:', error);
                          setRequirements([]);
                        }
                      }
                    }}
                    style={{ padding: '12px', borderRadius: '8px', border: '2px solid #e1e5e9', fontSize: '14px', minWidth: '300px' }}
                  >
                    <option value="">Select a retreat...</option>
                    {retreats.map((retreat) => (
                      <option key={retreat._id || retreat} value={retreat._id || retreat}>
                        {retreat.name || `Retreat ${retreat._id || retreat}`} - {retreat.location || 'Location TBD'}
                      </option>
                    ))}
                  </select>
                  {selectedRetreatId && (
                    <button
                      onClick={async () => {
                        try {
                          await clientRequirementsApi.initialize(clientId, selectedRetreatId);
                          const requirementsResponse = await clientRequirementsApi.getByClientAndRetreat(clientId, selectedRetreatId);
                          setRequirements(requirementsResponse.data || []);
                        } catch (error) {
                          console.error('Error initializing requirements:', error);
                          alert('Error initializing requirements');
                        }
                      }}
                      className="add-btn"
                      style={{ marginLeft: '16px' }}
                    >
                      🏗️ Initialize Requirements
                    </button>
                  )}
                </div>

                {selectedRetreatId && (
                  <>
                    <div className="requirements-summary">
                      <h3>📊 Requirements Summary</h3>
                      <div className="summary-stats">
                        <div className="stat-card completed">
                          <span className="stat-number">{requirements.filter(r => r.status === 'approved').length}</span>
                          <span className="stat-label">Approved</span>
                        </div>
                        <div className="stat-card received">
                          <span className="stat-number">{requirements.filter(r => r.status === 'received' || r.status === 'reviewed').length}</span>
                          <span className="stat-label">Received</span>
                        </div>
                        <div className="stat-card pending">
                          <span className="stat-number">{requirements.filter(r => r.status === 'pending').length}</span>
                          <span className="stat-label">Pending</span>
                        </div>
                        <div className="stat-card total">
                          <span className="stat-number">{requirements.length}</span>
                          <span className="stat-label">Total</span>
                        </div>
                      </div>
                    </div>

                    <div className="requirements-list">
                      {requirements.sort((a, b) => {
                        const aOrder = (a.requirementId as any)?.order || 0;
                        const bOrder = (b.requirementId as any)?.order || 0;
                        return aOrder - bOrder;
                      }).map((req) => (
                        <div key={req._id} className="requirement-card">
                          <div className="requirement-header">
                            <h4>
                              {(req.requirementId as any)?.name || 'Unknown Requirement'}
                              <span className="requirement-category" style={{
                                marginLeft: '12px',
                                fontSize: '12px',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                backgroundColor: '#e9ecef',
                                color: '#495057'
                              }}>
                                {(req.requirementId as any)?.category || 'general'}
                              </span>
                            </h4>
                            <span
                              className="status-badge"
                              style={{ backgroundColor: getStatusColor(req.status || 'pending') }}
                            >
                              {req.status}
                            </span>
                          </div>

                          {(req.requirementId as any)?.description && (
                            <div className="requirement-description">
                              <p>{(req.requirementId as any)?.description}</p>
                            </div>
                          )}

                          <div className="requirement-details">
                            <div className="detail-row">
                              <strong>Due Date:</strong> {req.dueDate ? new Date(req.dueDate).toLocaleDateString() : 'Not set'}
                            </div>

                            {(req.requirementId as any)?.requiresAmount && req.amount && (
                              <div className="detail-row">
                                <strong>Amount:</strong> €{req.amount} {req.receivedDate && '✅ Received'}
                              </div>
                            )}

                            {req.fileName && (
                              <div className="detail-row">
                                <strong>File:</strong> 📄 {req.fileName}
                                <span style={{ marginLeft: '8px', fontSize: '12px', color: '#666' }}>
                                  ({req.fileSize ? `${Math.round(req.fileSize / 1024)}KB` : 'Unknown size'})
                                </span>
                              </div>
                            )}

                            {req.receivedDate && (
                              <div className="detail-row">
                                <strong>Received:</strong> {new Date(req.receivedDate).toLocaleDateString()}
                              </div>
                            )}

                            {req.reviewedDate && (
                              <div className="detail-row">
                                <strong>Reviewed:</strong> {new Date(req.reviewedDate).toLocaleDateString()}
                              </div>
                            )}

                            {req.approvedDate && (
                              <div className="detail-row">
                                <strong>Approved:</strong> {new Date(req.approvedDate).toLocaleDateString()}
                                {req.approvedBy && ` by ${req.approvedBy}`}
                              </div>
                            )}

                            {req.rejectedBy && (
                              <div className="detail-row">
                                <strong>Rejected by:</strong> {req.rejectedBy}
                                {req.rejectionReason && (
                                  <div className="text-content" style={{ color: '#dc3545' }}>
                                    {req.rejectionReason}
                                  </div>
                                )}
                              </div>
                            )}

                            {req.reviewerNotes && (
                              <div className="detail-row">
                                <strong>Notes:</strong>
                                <div className="text-content">{req.reviewerNotes}</div>
                              </div>
                            )}
                          </div>

                          <div className="requirement-actions">
                            {(req.requirementId as any)?.requiresFile && req.status === 'pending' && (
                              <label className="file-upload-btn">
                                📄 Upload File
                                <input
                                  type="file"
                                  style={{ display: 'none' }}
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      try {
                                        await clientRequirementsApi.uploadFile(req._id!, file);
                                        fetchClientData();
                                      } catch (error) {
                                        console.error('Error uploading file:', error);
                                        alert('Error uploading file');
                                      }
                                    }
                                  }}
                                />
                              </label>
                            )}

                            {(req.requirementId as any)?.requiresAmount && req.status === 'pending' && (
                              <button
                                onClick={async () => {
                                  const amount = prompt('Enter amount received:');
                                  if (amount && !isNaN(Number(amount))) {
                                    try {
                                      await clientRequirementsApi.markReceived(req._id!, {
                                        amount: Number(amount),
                                        receivedDate: new Date()
                                      });
                                      fetchClientData();
                                    } catch (error) {
                                      console.error('Error marking amount received:', error);
                                      alert('Error marking amount received');
                                    }
                                  }
                                }}
                                className="mark-received-btn"
                              >
                                💰 Mark Amount Received
                              </button>
                            )}

                            {(req.status === 'pending' || req.status === 'received') &&
                             !(req.requirementId as any)?.requiresAmount &&
                             !(req.requirementId as any)?.requiresFile && (
                              <button
                                onClick={async () => {
                                  try {
                                    await clientRequirementsApi.markReceived(req._id!, {});
                                    fetchClientData();
                                  } catch (error) {
                                    console.error('Error marking received:', error);
                                    alert('Error marking received');
                                  }
                                }}
                                className="mark-received-btn"
                              >
                                ✅ Mark Received
                              </button>
                            )}

                            {(req.status === 'received' && (req.requirementId as any)?.requiresApproval) && (
                              <>
                                <button
                                  onClick={async () => {
                                    const notes = prompt('Review notes (optional):');
                                    try {
                                      await clientRequirementsApi.markReviewed(req._id!, notes || '');
                                      fetchClientData();
                                    } catch (error) {
                                      console.error('Error marking reviewed:', error);
                                      alert('Error marking reviewed');
                                    }
                                  }}
                                  className="review-btn"
                                >
                                  📋 Mark Reviewed
                                </button>
                              </>
                            )}

                            {(req.status === 'reviewed' || (req.status === 'received' && !(req.requirementId as any)?.requiresApproval)) && (
                              <button
                                onClick={async () => {
                                  const approverName = prompt('Approver name:') || 'Admin';
                                  const notes = prompt('Approval notes (optional):');
                                  try {
                                    await clientRequirementsApi.markApproved(req._id!, approverName, notes || '');
                                    fetchClientData();
                                  } catch (error) {
                                    console.error('Error approving:', error);
                                    alert('Error approving requirement');
                                  }
                                }}
                                className="approve-btn"
                              >
                                ✅ Approve
                              </button>
                            )}

                            {(req.status === 'received' || req.status === 'reviewed') && (
                              <button
                                onClick={async () => {
                                  const rejectorName = prompt('Rejector name:') || 'Admin';
                                  const reason = prompt('Rejection reason:');
                                  if (reason) {
                                    try {
                                      await clientRequirementsApi.markRejected(req._id!, rejectorName, reason);
                                      fetchClientData();
                                    } catch (error) {
                                      console.error('Error rejecting:', error);
                                      alert('Error rejecting requirement');
                                    }
                                  }
                                }}
                                className="reject-btn"
                                style={{ backgroundColor: '#dc3545' }}
                              >
                                ❌ Reject
                              </button>
                            )}
                          </div>
                        </div>
                      ))}

                      {requirements.length === 0 && (
                        <div className="no-requirements">
                          <h3>📋 No Requirements Initialized</h3>
                          <p>Click "Initialize Requirements" to set up the requirements for this retreat.</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="no-requirements">
                <h3>📋 No Retreat Bookings</h3>
                <p>This client has no retreat bookings. Requirements are tied to specific retreats.</p>
              </div>
            )}
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

        {activeTab === 'retreats' && (
          <div className="retreats-tab">
            <div className="retreats-header">
              <h3>🏃‍♂️ Retreat History</h3>
              <div className="retreat-stats">
                <div className="stat-card">
                  <strong>{clientBookings.length}</strong>
                  <span>Total Retreats</span>
                </div>
                <div className="stat-card">
                  <strong>{clientBookings.filter(b => new Date(b.registrationDate) < new Date()).length}</strong>
                  <span>Past Retreats</span>
                </div>
                <div className="stat-card">
                  <strong>{clientBookings.filter(b => new Date(b.registrationDate) >= new Date()).length}</strong>
                  <span>Upcoming</span>
                </div>
              </div>
            </div>

            <div className="retreat-bookings">
              {clientBookings.sort((a, b) => new Date(b.registrationDate).getTime() - new Date(a.registrationDate).getTime()).map((booking) => (
                <div key={booking._id} className={`booking-card ${booking.status || 'pending'}`}>
                  <div className="booking-header">
                    <h4>🏃‍♂️ {booking.retreatId?.name || 'Unknown Retreat'}</h4>
                    <span
                      className={`status-badge status-${booking.status || 'pending'}`}
                      style={{ backgroundColor: getStatusColor(booking.status || 'pending') }}
                    >
                      {(booking.status || 'pending').toUpperCase()}
                    </span>
                  </div>

                  <div className="booking-details">
                    <div className="detail-row">
                      <strong>Retreat Type:</strong>
                      <span className="retreat-type">
                        {booking.retreatId?.type ? booking.retreatId.type.charAt(0).toUpperCase() + booking.retreatId.type.slice(1) : 'Regular'}
                      </span>
                    </div>

                    <div className="detail-row">
                      <strong>Location:</strong> {booking.retreatId?.location || 'N/A'}
                    </div>

                    <div className="detail-row">
                      <strong>Registration Date:</strong>
                      {new Date(booking.registrationDate).toLocaleDateString()}
                    </div>

                    {booking.retreatId?.startDate && (
                      <div className="detail-row">
                        <strong>Retreat Dates:</strong>
                        {new Date(booking.retreatId.startDate).toLocaleDateString()}
                        {booking.retreatId.endDate && ` - ${new Date(booking.retreatId.endDate).toLocaleDateString()}`}
                      </div>
                    )}

                    <div className="detail-row">
                      <strong>Total Amount:</strong>
                      <span className="amount">{booking.totalAmount?.toFixed(2) || '0.00'} {booking.currency || 'EUR'}</span>
                    </div>

                    <div className="detail-row">
                      <strong>Amount Paid:</strong>
                      <span className="amount paid">{booking.amountPaid?.toFixed(2) || '0.00'} {booking.currency || 'EUR'}</span>
                    </div>

                    {booking.roomAssignment && (
                      <div className="detail-row">
                        <strong>Room Assignment:</strong> {booking.roomAssignment}
                      </div>
                    )}

                    {booking.specialRequests && (
                      <div className="detail-row">
                        <strong>Special Requests:</strong>
                        <div className="text-content">{booking.specialRequests}</div>
                      </div>
                    )}

                    {booking.notes && (
                      <div className="detail-row">
                        <strong>Notes:</strong>
                        <div className="text-content">{booking.notes}</div>
                      </div>
                    )}
                  </div>

                  <div className="booking-timeline">
                    {booking.checkInDate && (
                      <div className="timeline-item completed">
                        <span className="timeline-icon">✅</span>
                        <span>Checked In: {new Date(booking.checkInDate).toLocaleDateString()}</span>
                      </div>
                    )}
                    {booking.checkOutDate && (
                      <div className="timeline-item completed">
                        <span className="timeline-icon">🏁</span>
                        <span>Checked Out: {new Date(booking.checkOutDate).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {clientBookings.length === 0 && (
                <div className="no-bookings">
                  <h3>🏃‍♂️ No Retreat History</h3>
                  <p>This client has not been assigned to any retreats yet.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'ceremonies' && (
          <ClientCeremoniesTab clientId={clientId} />
        )}

      {/* Reminder Add/Edit Modal */}
      {showReminderModal && (
        <div className="modal-overlay">
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