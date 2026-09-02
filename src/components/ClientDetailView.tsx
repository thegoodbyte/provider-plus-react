import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Client, ClientMedical, ClientRequirement, PaymentRequest, Reminder } from '../types';
import { clientsApi, clientMedicalApi, clientRequirementsApi, remindersApi, bookingsApi, notesApi, paymentRequestsApi } from '../services/api';
import MedicalTrackingTab from './MedicalTrackingTab';
import ComprehensiveMedicalTrackingTab from './ComprehensiveMedicalTrackingTab';
import ClientCeremoniesTab from './ClientCeremoniesTab';
import { TasksWidget } from './Tasks/TasksWidget';
import { generateBookingPDF } from './BookingConfirmationPDF';
import { normalizeClientTag } from '../utils/clientTags';
import './ClientsGrid.css';
import { loadClientCoreData } from '../services/clientCoreDataService';
import './ComprehensiveMedicalTrackingTab.css';

interface ClientDetailViewProps {
  clientId: string;
  onBack: () => void;
}

const ClientDetailView: React.FC<ClientDetailViewProps> = ({ clientId, onBack }) => {
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [medicalData, setMedicalData] = useState<ClientMedical[]>([]);
  const [requirements, setRequirements] = useState<ClientRequirement[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [clientBookings, setClientBookings] = useState<any[]>([]);
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
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
  const [pdfLanguage, setPdfLanguage] = useState<'pl' | 'cz' | 'en'>('en');
  const [generatingPDF, setGeneratingPDF] = useState<string | null>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [uploadingProfilePicture, setUploadingProfilePicture] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [editingNote, setEditingNote] = useState<any | null>(null);
  const [clientTagInput, setClientTagInput] = useState('');
  const [noteFormData, setNoteFormData] = useState({
    title: '',
    content: '',
    type: 'client' as 'client' | 'retreat' | 'general',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    tags: [] as string[]
  });

  useEffect(() => {
    fetchClientData();
  }, [clientId]);

  useEffect(() => {
    let active = true;
    let objectUrl = '';

    const loadProfilePicture = async () => {
      if (!clientId || !client?.profilePictureS3Key) {
        setProfilePictureUrl(null);
        return;
      }

      try {
        const response = await clientsApi.getProfilePictureBlob(clientId);
        objectUrl = URL.createObjectURL(response.data as Blob);
        if (active) setProfilePictureUrl(objectUrl);
      } catch (error) {
        console.error('Error loading profile picture:', error);
        if (active) setProfilePictureUrl(null);
      }
    };

    loadProfilePicture();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [clientId, client?.profilePictureS3Key, client?.updatedAt]);

  const fetchClientData = async () => {
    try {
      setLoading(true);
      const coreData = await loadClientCoreData(clientId);

      setClient(coreData.client);
      setMedicalData(coreData.medical || []);
      setClientBookings(coreData.bookings);

      // Extract retreats from bookings
      const clientRetreats = coreData.bookings.map((booking: any) => booking.retreatDetails || booking.retreatId).filter(Boolean);
      setRetreats(clientRetreats);

      // Fetch notes for this client
      try {
        const notesResponse = await notesApi.getByClient(clientId);
        const sortedNotes = [...(notesResponse.data || [])].sort((a, b) => {
          const bDate = new Date(b.createdAt || b.updatedAt || 0).getTime();
          const aDate = new Date(a.createdAt || a.updatedAt || 0).getTime();
          return bDate - aDate;
        });
        setNotes(sortedNotes);
      } catch (notesError) {
        console.error('Error fetching notes:', notesError);
        setNotes([]);
      }

      try {
        const paymentRequestsResponse = await paymentRequestsApi.getByClient(clientId);
        setPaymentRequests(paymentRequestsResponse.data || []);
      } catch (paymentRequestError) {
        console.error('Error fetching payment requests:', paymentRequestError);
        setPaymentRequests([]);
      }

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

  const handleProfilePictureUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please choose an image file.');
      return;
    }

    try {
      setUploadingProfilePicture(true);
      const response = await clientsApi.uploadProfilePicture(clientId, file);
      setClient(response.data.client);
    } catch (error: any) {
      console.error('Error uploading profile picture:', error);
      alert(error?.response?.data?.message || error?.message || 'Failed to upload profile image.');
    } finally {
      setUploadingProfilePicture(false);
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

  const handleAddClientTag = async () => {
    const nextTag = normalizeClientTag(clientTagInput);
    if (!nextTag || !client) return;
    const currentTags = Array.isArray(client.tags) ? client.tags : [];
    if (currentTags.includes(nextTag)) {
      setClientTagInput('');
      return;
    }

    try {
      const response = await clientsApi.update(clientId, { tags: [...currentTags, nextTag] });
      setClient(response.data || { ...client, tags: [...currentTags, nextTag] });
      setClientTagInput('');
    } catch (error) {
      console.error('Error adding client tag:', error);
      alert('Unable to add the tag.');
    }
  };

  const handleRemoveClientTag = async (tagToRemove: string) => {
    if (!client) return;
    const nextTags = (client.tags || []).filter((tag) => tag !== tagToRemove);
    try {
      const response = await clientsApi.update(clientId, { tags: nextTags });
      setClient(response.data || { ...client, tags: nextTags });
    } catch (error) {
      console.error('Error removing client tag:', error);
      alert('Unable to remove the tag.');
    }
  };

  const handleClearClientTags = async () => {
    if (!client || !window.confirm('Remove all tags from this client?')) return;
    try {
      const response = await clientsApi.update(clientId, { tags: [] });
      setClient(response.data || { ...client, tags: [] });
    } catch (error) {
      console.error('Error clearing client tags:', error);
      alert('Unable to clear tags.');
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

  const handleRegenerateHash = async () => {
    if (!window.confirm('Are you sure you want to regenerate the deposit form hash? The old link will no longer work.')) {
      return;
    }

    try {
      const response = await clientsApi.regenerateDepositHash(clientId);
      alert(`New deposit hash generated: ${response.data.hash}`);
      fetchClientData(); // Refresh client data to show new hash
    } catch (error) {
      console.error('Error regenerating hash:', error);
      alert('Error regenerating deposit hash. Please try again.');
    }
  };

  const getBookingRetreatId = (booking: any) => {
    const retreat = booking?.retreatDetails || booking?.retreatId || booking?.retreat;
    return retreat?._id || retreat || '';
  };

  const getBookingFullPrice = (booking: any) => (
    booking?.totalAmount || booking?.totalPrice || booking?.fullPrice || booking?.fullPriceQuote || ''
  );

  const handleCreateDepositPaymentRequest = () => {
    const selectedBooking = clientBookings.find((booking) => getBookingRetreatId(booking) === selectedRetreatId) || clientBookings[0];
    const retreatId = getBookingRetreatId(selectedBooking);
    const params = new URLSearchParams({
      clientId,
      requestType: 'deposit',
      paymentType: 'Other',
    });

    if (retreatId) params.set('retreatId', retreatId);
    const fullPrice = getBookingFullPrice(selectedBooking);
    if (fullPrice) params.set('fullPrice', String(fullPrice));
    if (selectedBooking?.currency) params.set('currency', selectedBooking.currency);

    navigate(`/admin/payment-requests/new?${params.toString()}`);
  };

  const getDepositPaymentUrl = (request: PaymentRequest) => (
    request.publicHash ? `https://ibogaspirit.com/clients/payments/deposit/v2/${request.publicHash}` : ''
  );

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
      case 'received': case 'reviewed': return '#374151';
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
    if (completedRequirements > 0) return { status: 'In Progress', color: '#374151' };
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
  const clientTags = client.tags || [];

  return (
    <div className="client-detail-container">
      <div className="client-detail-header">
        <button onClick={onBack} className="back-btn">← Back to Clients</button>
        <div className="client-header-profile">
          <div className="client-profile-avatar">
            {profilePictureUrl ? (
              <img src={profilePictureUrl} alt={`${client.firstName} ${client.lastName}`} />
            ) : (
              <span>{`${client.firstName?.[0] || ''}${client.lastName?.[0] || ''}` || 'Client'}</span>
            )}
            <label className="client-profile-upload">
              {uploadingProfilePicture ? 'Uploading' : 'Upload'}
              <input type="file" accept="image/*" onChange={handleProfilePictureUpload} disabled={uploadingProfilePicture} />
            </label>
          </div>
        <div className="client-header-info">
          <h1>{client.firstName} {client.lastName}</h1>
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
          className={`tab-btn ${activeTab === 'payments' ? 'active' : ''}`}
          onClick={() => setActiveTab('payments')}
        >
          💳 Payments
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
        <button
          className={`tab-btn ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          ✅ Tasks
        </button>
        <button
          className={`tab-btn ${activeTab === 'notes' ? 'active' : ''}`}
          onClick={() => setActiveTab('notes')}
        >
          📝 Notes
        </button>
      </div>

      <div className="client-detail-content">
        {activeTab === 'overview' && (
          <div className="overview-tab">
            <div className="info-columns">
              <div className="info-column">
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
                    <strong>Referral:</strong> {(typeof client.referralId === 'object' ? client.referralId?.name : '') || client.source || 'N/A'}
                    {client.referralPersonType === 'existing_client' && client.referralClientId && <> · Friend: {typeof client.referralClientId === 'object' ? `${client.referralClientId.firstName} ${client.referralClientId.lastName}` : 'Existing client'}</>}
                    {client.referralPersonType === 'someone_else' && client.referralPersonName && <> · Friend: {client.referralPersonName}</>}
                  </div>
                  <div className="info-row">
                    <strong>Year of Birth:</strong> {client.dateOfBirth ? new Date(client.dateOfBirth).getFullYear() : (client as any)?.screeningData?.year_of_birth || (client as any)?.screeningData?.yearOfBirth || 'N/A'}
                  </div>
                  <div className="info-row">
                    <strong>Gender:</strong> {client.gender || 'N/A'}
                  </div>
                  <div className="info-row">
                    <strong>Occupation:</strong> {client.occupation || 'N/A'}
                  </div>
                </div>

                <div className="info-card">
                  <h3>🏷️ Client Tags</h3>
                  <div className="info-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {clientTags.length > 0 ? (
                        clientTags.map((tag) => (
                          <span
                            key={tag}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '6px 10px',
                              borderRadius: 999,
                              background: '#eef2ff',
                              color: '#3730a3',
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={() => handleRemoveClientTag(tag)}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: 'inherit',
                                cursor: 'pointer',
                                padding: 0,
                                fontSize: 14,
                                lineHeight: 1,
                              }}
                              aria-label={`Remove tag ${tag}`}
                            >
                              ×
                            </button>
                          </span>
                        ))
                      ) : (
                        <span style={{ color: '#6b7280', fontSize: 13 }}>No tags yet.</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <input
                        value={clientTagInput}
                        onChange={(e) => setClientTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void handleAddClientTag();
                          }
                        }}
                        placeholder="Add tag, e.g. medically-approved"
                        style={{
                          flex: '1 1 220px',
                          padding: '8px 10px',
                          borderRadius: 6,
                          border: '1px solid #d1d5db',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => void handleAddClientTag()}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 6,
                          border: 'none',
                          background: '#1d4ed8',
                          color: 'white',
                          cursor: 'pointer',
                        }}
                      >
                        Add tag
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleClearClientTags()}
                        disabled={clientTags.length === 0}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 6,
                          border: '1px solid #d1d5db',
                          background: '#fff',
                          color: '#374151',
                          cursor: 'pointer',
                          opacity: clientTags.length === 0 ? 0.5 : 1,
                        }}
                      >
                        Clear all
                      </button>
                    </div>
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
              </div>

              <div className="info-column">
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
                    <strong>Country:</strong> {(() => {
                      if (!client.country) return 'N/A';
                      // Map common country codes to full names
                      const countryNames: { [key: string]: string } = {
                        'US': 'United States',
                        'CZ': 'Czech Republic',
                        'PL': 'Poland',
                        'GB': 'United Kingdom',
                        'CA': 'Canada',
                        'DE': 'Germany',
                        'FR': 'France',
                        'ES': 'Spain',
                        'IT': 'Italy',
                        'NL': 'Netherlands'
                      };
                      return countryNames[client.country] || client.country;
                    })()}
                  </div>
                </div>

                <div className="info-card">
                  <h3>🍴 Dietary Information</h3>
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

                <div className="info-card">
                  <h3>📋 Deposit Agreement Form</h3>
                <div className="info-row">
                  <strong>Hash:</strong> {client.depositFormHash || 'Not generated yet'}
                </div>
                {client.depositFormHash && (
                  <div className="info-row">
                    <strong>Public Link:</strong>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
                      <input
                        type="text"
                        value={`${window.location.origin}/api/clients/public/deposit-agreement/${client.depositFormHash}`}
                        readOnly
                        style={{
                          flex: 1,
                          padding: '8px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          backgroundColor: '#f9f9f9'
                        }}
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/api/clients/public/deposit-agreement/${client.depositFormHash}`);
                          alert('Link copied to clipboard!');
                        }}
                        style={{
                          padding: '8px 12px',
                          backgroundColor: '#374151',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}
                <div className="info-row" style={{ marginTop: '15px' }}>
                  <button
                    onClick={handleRegenerateHash}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: client.depositFormHash ? '#ffc107' : '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    {client.depositFormHash ? '🔄 Regenerate Hash' : '✨ Generate Hash'}
                  </button>
                </div>
              </div>
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
                  <ComprehensiveMedicalTrackingTab
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

        {activeTab === 'payments' && (
          <div className="payments-tab">
            <div className="info-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <h3>💳 Payment Requests</h3>
                  <p style={{ margin: '4px 0 0', color: '#6b7280' }}>
                    Create deposit links for this client and copy the public payment consent URL.
                  </p>
                </div>
                <button
                  onClick={handleCreateDepositPaymentRequest}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: '#374151',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    whiteSpace: 'nowrap'
                  }}
                >
                  Create Deposit Request
                </button>
              </div>

              {paymentRequests.length === 0 ? (
                <div className="no-medical-records">
                  <p>No payment requests yet.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {paymentRequests.map((request) => {
                    const paymentUrl = getDepositPaymentUrl(request);
                    return (
                      <div key={request._id} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                          <div>
                            <strong>{request.invoiceNumber || request._id}</strong>
                            <div style={{ color: '#6b7280', fontSize: '14px', marginTop: '4px' }}>
                              {request.requestType || request.paymentType} · {request.requestedAmount || request.amountPaid || 0} {request.currency} · {request.status}
                            </div>
                          </div>
                          <button
                            onClick={() => navigate(`/admin/payment-requests/${request._id}`)}
                            style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', background: 'white', cursor: 'pointer' }}
                          >
                            View
                          </button>
                          <button onClick={() => navigate(`/admin/payment-requests/${request._id}/edit`)} style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', background: 'white', cursor: 'pointer' }}>Edit</button>
                        </div>
                        {paymentUrl ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
                            <input
                              type="text"
                              value={paymentUrl}
                              readOnly
                              style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: '#f9f9f9' }}
                            />
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(paymentUrl);
                                alert('Payment link copied to clipboard.');
                              }}
                              style={{ padding: '8px 12px', backgroundColor: '#374151', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              Copy
                            </button>
                          </div>
                        ) : (
                          <p style={{ marginTop: '10px', color: '#b45309' }}>
                            Save this request again after deployment if it does not yet have a public hash.
                          </p>
                        )}
                      </div>
                    );
                  })}
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
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label style={{ fontSize: '13px', color: '#666' }}>PDF Language:</label>
                <select
                  value={pdfLanguage}
                  onChange={(e) => setPdfLanguage(e.target.value as 'pl' | 'cz' | 'en')}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid #ddd',
                    fontSize: '13px',
                    backgroundColor: 'white',
                    cursor: 'pointer'
                  }}
                >
                  <option value="en">English</option>
                  <option value="pl">Polish</option>
                  <option value="cz">Czech</option>
                </select>
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

                  <div className="booking-actions" style={{ marginTop: '15px', padding: '10px 0', borderTop: '1px solid #e1e5e9' }}>
                    <button
                      onClick={async () => {
                        setGeneratingPDF(booking._id);
                        try {
                          await generateBookingPDF({
                            booking,
                            language: pdfLanguage,
                            onComplete: () => {
                              setGeneratingPDF(null);
                            }
                          });
                        } catch (error) {
                          console.error('Error generating PDF:', error);
                          alert('Error generating PDF');
                          setGeneratingPDF(null);
                        }
                      }}
                      disabled={generatingPDF === booking._id}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: generatingPDF === booking._id ? '#ccc' : '#374151',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: generatingPDF === booking._id ? 'not-allowed' : 'pointer',
                        fontSize: '13px',
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      📄 {generatingPDF === booking._id ? 'Generating PDF...' : 'Generate Confirmation PDF'}
                    </button>
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
        {activeTab === 'tasks' && (
          <TasksWidget clientId={clientId} title="Client Tasks" />
        )}

        {activeTab === 'notes' && (
          <div className="notes-tab">
            <div className="notes-header">
              <h3>📝 Client Notes</h3>
              <button onClick={() => {
                setEditingNote(null);
                setNoteFormData({
                  title: '',
                  content: '',
                  type: 'client',
                  priority: 'medium',
                  tags: []
                });
                setShowNotesModal(true);
              }} className="add-note-btn">
                ➕ Add Note
              </button>
            </div>

            <div className="notes-list">
              {notes.length > 0 ? (
                notes.map((note) => (
                  <div key={note._id} className={`note-card priority-${note.priority || 'medium'}`}>
                    <div className="note-header">
                      <h4>📝 {note.title}</h4>
                      <div className="note-meta">
                        <span className={`priority-badge priority-${note.priority || 'medium'}`}>
                          {(note.priority || 'medium').toUpperCase()}
                        </span>
                        <span className="note-type">{note.type}</span>
                        <span className="note-date">
                          {new Date(note.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="note-content">
                      <p>{note.content}</p>
                    </div>

                    {note.tags && note.tags.length > 0 && (
                      <div className="note-tags">
                        {note.tags.map((tag: string, index: number) => (
                          <span key={index} className="tag">{tag}</span>
                        ))}
                      </div>
                    )}

                    <div className="note-actions">
                      <button
                        onClick={() => {
                          setEditingNote(note);
                          setNoteFormData({
                            title: note.title,
                            content: note.content,
                            type: note.type,
                            priority: note.priority || 'medium',
                            tags: note.tags || []
                          });
                          setShowNotesModal(true);
                        }}
                        className="edit-btn"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={async () => {
                          if (window.confirm('Are you sure you want to delete this note?')) {
                            try {
                              await notesApi.delete(note._id);
                              fetchClientData();
                            } catch (error) {
                              console.error('Error deleting note:', error);
                              alert('Error deleting note');
                            }
                          }
                        }}
                        className="delete-btn"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-notes">
                  <h3>📝 No Notes</h3>
                  <p>No notes found for this client. Click "Add Note" to create the first one.</p>
                </div>
              )}
            </div>
          </div>
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
                <button
                  type="button"
                  onClick={() => setShowReminderModal(false)}
                  className="cancel-btn"
                >
                  Cancel
                </button>
                <button type="submit" className="save-btn">
                  {editingReminder ? 'Update Reminder' : 'Create Reminder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Notes Add/Edit Modal */}
      {showNotesModal && (
        <div className="modal-overlay">
          <div className="modal notes-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingNote ? 'Edit Note' : 'Add New Note'}</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const submitData = {
                  ...noteFormData,
                  clientId,
                  createdBy: 'Admin' // You might want to get this from auth context
                };

                if (editingNote) {
                  await notesApi.update(editingNote._id, submitData);
                } else {
                  await notesApi.create(submitData);
                }

                setShowNotesModal(false);
                setEditingNote(null);
                setNoteFormData({
                  title: '',
                  content: '',
                  type: 'client',
                  priority: 'medium',
                  tags: []
                });
                fetchClientData();
              } catch (error) {
                console.error('Error saving note:', error);
                alert('Error saving note');
              }
            }}>
              <div className="note-form-grid">
                <div className="form-group">
                  <label htmlFor="note-title">Title *</label>
                  <input
                    type="text"
                    id="note-title"
                    value={noteFormData.title}
                    onChange={(e) => setNoteFormData({...noteFormData, title: e.target.value})}
                    required
                    placeholder="Note title..."
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="note-type">Type</label>
                  <select
                    id="note-type"
                    value={noteFormData.type}
                    onChange={(e) => setNoteFormData({...noteFormData, type: e.target.value as any})}
                  >
                    <option value="client">Client</option>
                    <option value="retreat">Retreat</option>
                    <option value="general">General</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="note-priority">Priority</label>
                  <select
                    id="note-priority"
                    value={noteFormData.priority}
                    onChange={(e) => setNoteFormData({...noteFormData, priority: e.target.value as any})}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div className="form-group full-width">
                  <label htmlFor="note-content">Content *</label>
                  <textarea
                    id="note-content"
                    value={noteFormData.content}
                    onChange={(e) => setNoteFormData({...noteFormData, content: e.target.value})}
                    rows={6}
                    required
                    placeholder="Write your note here..."
                  />
                </div>

                <div className="form-group full-width">
                  <label htmlFor="note-tags">Tags (comma separated)</label>
                  <input
                    type="text"
                    id="note-tags"
                    value={noteFormData.tags.join(', ')}
                    onChange={(e) => {
                      const tags = e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag);
                      setNoteFormData({...noteFormData, tags});
                    }}
                    placeholder="tag1, tag2, tag3..."
                  />
                </div>
              </div>

              <div className="form-buttons">
                <button
                  type="button"
                  onClick={() => setShowNotesModal(false)}
                  className="cancel-btn"
                >
                  Cancel
                </button>
                <button type="submit" className="save-btn">
                  {editingNote ? 'Update Note' : 'Create Note'}
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
