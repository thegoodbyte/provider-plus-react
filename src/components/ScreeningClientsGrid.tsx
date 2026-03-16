import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams, ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { screeningClientsApi, clientsApi } from '../services/api';
import { ScreeningClient } from '../types';
import { Collapse } from 'antd';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import './RetreatsGrid.css';

const { Panel } = Collapse;

ModuleRegistry.registerModules([AllCommunityModule]);

const ScreeningClientsGrid: React.FC = () => {
  const [screeningClients, setScreeningClients] = useState<ScreeningClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ScreeningClient | null>(null);
  const [formData, setFormData] = useState<Partial<ScreeningClient>>({});
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showPotentialClientForm, setShowPotentialClientForm] = useState(false);
  const [savePotentialClient, setSavePotentialClient] = useState(false);
  const [potentialClientData, setPotentialClientData] = useState({
    firstName: '',
    phone: '',
    country: '',
    age: ''
  });
  const gridApiRef = useRef<GridApi | null>(null);

  const fetchScreeningClients = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = filterStatus === 'all' ?
        await screeningClientsApi.getAll() :
        await screeningClientsApi.getByStatus(filterStatus);
      setScreeningClients(response.data || []);
    } catch (error: any) {
      console.error('Error fetching screening clients:', error);
      setScreeningClients([]);
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchScreeningClients();
  }, [fetchScreeningClients]);

  const handleGridReady = (params: GridReadyEvent) => {
    gridApiRef.current = params.api;
    params.api.sizeColumnsToFit();
  };

  const handleAdd = () => {
    setEditingClient(null);
    setFormData({
      status: 'initial',
      priority: 'medium',
      firstContactDate: new Date()
    });
    setSavePotentialClient(false);
    setPotentialClientData({
      firstName: '',
      phone: '',
      country: '',
      age: ''
    });
    setIsModalOpen(true);
  };

  const handleEdit = (client: ScreeningClient) => {
    setEditingClient(client);
    setFormData({
      ...client,
      firstContactDate: client.firstContactDate || new Date(),
      followUpDate: client.followUpDate || undefined
    });
    setSavePotentialClient(false);
    setPotentialClientData({
      firstName: '',
      phone: '',
      country: '',
      age: ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this screening client?')) {
      try {
        await screeningClientsApi.delete(id);
        fetchScreeningClients();
      } catch (error) {
        console.error('Error deleting screening client:', error);
      }
    }
  };

  const handlePromoteToClient = async (id: string) => {
    if (window.confirm('Are you sure you want to promote this screening client to a full client?')) {
      try {
        const response = await screeningClientsApi.promoteToClient(id);
        alert(`Successfully promoted to client! New client ID: ${response.data.client._id}`);
        fetchScreeningClients();
      } catch (error: any) {
        console.error('Error promoting to client:', error);
        alert('Error promoting to client: ' + (error.response?.data?.message || error.message));
      }
    }
  };

  const StatusCellRenderer = (params: ICellRendererParams) => {
    const statusColors: { [key: string]: string } = {
      initial: '#f39c12',
      in_progress: '#3498db',
      completed: '#2ecc71',
      approved: '#27ae60',
      rejected: '#e74c3c',
      converted: '#9b59b6'
    };
    const color = statusColors[params.value] || '#95a5a6';
    return (
      <span style={{
        color: color,
        fontWeight: 'bold',
        textTransform: 'capitalize'
      }}>
        {params.value?.replace('_', ' ') || 'Initial'}
      </span>
    );
  };

  const PriorityCellRenderer = (params: ICellRendererParams) => {
    const priorityColors: { [key: string]: string } = {
      low: '#95a5a6',
      medium: '#f39c12',
      high: '#e67e22',
      urgent: '#e74c3c'
    };
    const color = priorityColors[params.value] || '#95a5a6';
    return (
      <span style={{
        color: color,
        fontWeight: 'bold',
        textTransform: 'capitalize'
      }}>
        {params.value || 'Medium'}
      </span>
    );
  };

  const ActionCellRenderer = (params: ICellRendererParams) => {
    return (
      <div className="action-buttons">
        <button onClick={() => handleEdit(params.data)} className="edit-btn">✏️ Edit</button>
        {params.data.status !== 'converted' && (
          <button
            onClick={() => handlePromoteToClient(params.data._id)}
            className="view-btn"
            style={{ backgroundColor: '#27ae60' }}
          >
            ↗️ Promote
          </button>
        )}
        <button onClick={() => handleDelete(params.data._id)} className="delete-btn">🗑️ Delete</button>
      </div>
    );
  };

  const columnDefs: ColDef[] = [
    { field: '_id', headerName: 'ID', hide: true },
    {
      field: 'firstName',
      headerName: 'First Name',
      sortable: true,
      filter: true,
      width: 120
    },
    {
      field: 'lastName',
      headerName: 'Last Name',
      sortable: true,
      filter: true,
      width: 120
    },
    {
      field: 'phone',
      headerName: 'Phone',
      sortable: true,
      filter: true,
      width: 130
    },
    {
      field: 'country',
      headerName: 'Country',
      sortable: true,
      filter: true,
      width: 100
    },
    {
      field: 'firstContactDate',
      headerName: 'First Contact',
      sortable: true,
      filter: true,
      width: 120,
      valueFormatter: (params) => {
        if (params.value) {
          return new Date(params.value).toLocaleDateString();
        }
        return '';
      }
    },
    {
      field: 'status',
      headerName: 'Status',
      sortable: true,
      filter: true,
      cellRenderer: StatusCellRenderer,
      width: 120
    },
    {
      field: 'priority',
      headerName: 'Priority',
      sortable: true,
      filter: true,
      cellRenderer: PriorityCellRenderer,
      width: 100
    },
    {
      field: 'whySeekingIboga',
      headerName: 'Why Seeking Iboga',
      flex: 1,
      minWidth: 200,
      tooltipField: 'whySeekingIboga',
      valueFormatter: (params) => {
        return params.value ? (params.value.length > 50 ? params.value.substring(0, 50) + '...' : params.value) : '';
      }
    },
    {
      headerName: 'Actions',
      cellRenderer: ActionCellRenderer,
      width: 200,
      suppressSizeToFit: true
    }
  ];

  const defaultColDef = {
    resizable: true,
    minWidth: 100
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const cleanData: any = {};

      // Basic fields
      if (formData.firstName?.trim()) cleanData.firstName = formData.firstName.trim();
      if (formData.lastName?.trim()) cleanData.lastName = formData.lastName.trim();
      if (formData.phone?.trim()) cleanData.phone = formData.phone.trim();
      if (formData.country?.trim()) cleanData.country = formData.country.trim();
      if (formData.email?.trim()) cleanData.email = formData.email.trim();
      if (formData.firstContactDate) cleanData.firstContactDate = formData.firstContactDate;

      // Status and priority
      if (formData.status) cleanData.status = formData.status;
      if (formData.priority) cleanData.priority = formData.priority;

      // Required text areas
      if (formData.whySeekingIboga?.trim()) cleanData.whySeekingIboga = formData.whySeekingIboga.trim();
      if (formData.whatToChange?.trim()) cleanData.whatToChange = formData.whatToChange.trim();

      // Optional fields
      if (formData.previousPlantMedicines?.trim()) cleanData.previousPlantMedicines = formData.previousPlantMedicines.trim();
      if (formData.spiritualBackground?.trim()) cleanData.spiritualBackground = formData.spiritualBackground.trim();
      if (formData.childhood?.trim()) cleanData.childhood = formData.childhood.trim();
      if (formData.traumaHistory?.trim()) cleanData.traumaHistory = formData.traumaHistory.trim();
      if (formData.mentalHealthHistory?.trim()) cleanData.mentalHealthHistory = formData.mentalHealthHistory.trim();
      if (formData.addictionHistory?.trim()) cleanData.addictionHistory = formData.addictionHistory.trim();

      // Health fields
      if (formData.heartConditions?.trim()) cleanData.heartConditions = formData.heartConditions.trim();
      if (formData.liverConditions?.trim()) cleanData.liverConditions = formData.liverConditions.trim();
      if (formData.asthmaConditions?.trim()) cleanData.asthmaConditions = formData.asthmaConditions.trim();
      if (formData.otherMedicalComplications?.trim()) cleanData.otherMedicalComplications = formData.otherMedicalComplications.trim();
      if (formData.bloodPressureIssues?.trim()) cleanData.bloodPressureIssues = formData.bloodPressureIssues.trim();
      if (formData.seizureHistory?.trim()) cleanData.seizureHistory = formData.seizureHistory.trim();
      if (formData.psychoticEpisodes?.trim()) cleanData.psychoticEpisodes = formData.psychoticEpisodes.trim();

      // Substances
      if (formData.currentMedications?.trim()) cleanData.currentMedications = formData.currentMedications.trim();
      if (formData.recreationalDrugs?.trim()) cleanData.recreationalDrugs = formData.recreationalDrugs.trim();
      if (formData.vitaminsSupplements?.trim()) cleanData.vitaminsSupplements = formData.vitaminsSupplements.trim();
      if (formData.alcoholConsumption?.trim()) cleanData.alcoholConsumption = formData.alcoholConsumption.trim();

      // Safety
      if (formData.suicidalThoughts?.trim()) cleanData.suicidalThoughts = formData.suicidalThoughts.trim();
      if (formData.hospitalizations?.trim()) cleanData.hospitalizations = formData.hospitalizations.trim();
      if (formData.allergies?.trim()) cleanData.allergies = formData.allergies.trim();
      if (formData.weightRange?.trim()) cleanData.weightRange = formData.weightRange.trim();
      if (formData.pregnancyStatus?.trim()) cleanData.pregnancyStatus = formData.pregnancyStatus.trim();

      // Admin
      if (formData.notes?.trim()) cleanData.notes = formData.notes.trim();
      if (formData.followUpDate) cleanData.followUpDate = formData.followUpDate;

      if (editingClient) {
        await screeningClientsApi.update(editingClient._id!, cleanData);
      } else {
        await screeningClientsApi.create(cleanData);
      }

      // Save potential client if checkbox is checked and has data
      if (savePotentialClient && potentialClientData.firstName.trim()) {
        try {
          const potentialClientPayload = {
            firstName: potentialClientData.firstName.trim(),
            lastName: '', // Not collected in potential client form
            email: '', // Not collected in potential client form
            phone: potentialClientData.phone.trim() || '',
            address: '', // Not collected in potential client form
            country: potentialClientData.country.trim() || '',
            age: potentialClientData.age ? parseInt(potentialClientData.age) : undefined,
            notes: `Created from screening for ${formData.firstName} ${formData.lastName}`,
            status: 'active' as const
          };

          await clientsApi.create(potentialClientPayload);
          alert('Potential client saved successfully!');
        } catch (potentialClientError: any) {
          console.error('Error saving potential client:', potentialClientError);
          alert('Screening saved but failed to save potential client: ' +
                (potentialClientError.response?.data?.message || potentialClientError.message));
        }
      }

      setIsModalOpen(false);
      setFormData({});
      setEditingClient(null);
      setSavePotentialClient(false);
      setPotentialClientData({
        firstName: '',
        phone: '',
        country: '',
        age: ''
      });
      fetchScreeningClients();
    } catch (error: any) {
      console.error('Error saving screening client:', error);
      alert('Error saving screening client: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="retreats-container">
      <div className="retreats-header">
        <h2>🔍 Screening Clients Management</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          >
            <option value="all">All Statuses</option>
            <option value="initial">Initial</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="converted">Converted</option>
          </select>
          <button onClick={handleAdd} className="add-btn">➕ Add New Screening</button>
          <div style={{ fontSize: '14px', color: '#666' }}>
            Status: {isLoading ? 'Loading...' : `${screeningClients.length} screening clients`}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: '40px', textAlign: 'center', fontSize: '18px', color: '#666' }}>
          Loading screening clients...
        </div>
      ) : (
        <div className="ag-theme-alpine" style={{ height: 600, width: '100%' }}>
          <AgGridReact
            rowData={screeningClients}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            onGridReady={handleGridReady}
            animateRows={true}
            pagination={true}
            paginationPageSize={15}
            suppressNoRowsOverlay={false}
            tooltipShowDelay={500}
          />
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => {
          setIsModalOpen(false);
          setSavePotentialClient(false);
          setPotentialClientData({
            firstName: '',
            phone: '',
            country: '',
            age: ''
          });
        }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '90vh', overflow: 'auto' }}>
            <h3>{editingClient ? 'Edit Screening Client' : 'Add New Screening Client'}</h3>
            <form onSubmit={handleSubmit}>
              {/* Basic Information Section */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ color: '#2c3e50', borderBottom: '2px solid #3498db', paddingBottom: '5px' }}>Basic Information</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="form-group">
                    <label htmlFor="firstName">First Name*:</label>
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      value={formData.firstName || ''}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="lastName">Last Name*:</label>
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      value={formData.lastName || ''}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="phone">Phone*:</label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone || ''}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="country">Country*:</label>
                    <input
                      type="text"
                      id="country"
                      name="country"
                      value={formData.country || ''}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="email">Email:</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email || ''}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="firstContactDate">First Contact Date*:</label>
                    <input
                      type="date"
                      id="firstContactDate"
                      name="firstContactDate"
                      value={formData.firstContactDate ? new Date(formData.firstContactDate).toISOString().split('T')[0] : ''}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Status Section */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ color: '#2c3e50', borderBottom: '2px solid #e67e22', paddingBottom: '5px' }}>Status</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                  <div className="form-group">
                    <label htmlFor="status">Status:</label>
                    <select
                      id="status"
                      name="status"
                      value={formData.status || 'initial'}
                      onChange={handleInputChange}
                    >
                      <option value="initial">Initial</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="priority">Priority:</label>
                    <select
                      id="priority"
                      name="priority"
                      value={formData.priority || 'medium'}
                      onChange={handleInputChange}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="followUpDate">Follow Up Date:</label>
                    <input
                      type="date"
                      id="followUpDate"
                      name="followUpDate"
                      value={formData.followUpDate ? new Date(formData.followUpDate).toISOString().split('T')[0] : ''}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              </div>

              {/* Motivation & Goals Section */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ color: '#2c3e50', borderBottom: '2px solid #27ae60', paddingBottom: '5px' }}>Motivation & Goals</h4>
                <div className="form-group">
                  <label htmlFor="whySeekingIboga">Why Seeking Iboga*:</label>
                  <textarea
                    id="whySeekingIboga"
                    name="whySeekingIboga"
                    value={formData.whySeekingIboga || ''}
                    onChange={handleInputChange}
                    rows={3}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="whatToChange">What They Want to Change*:</label>
                  <textarea
                    id="whatToChange"
                    name="whatToChange"
                    value={formData.whatToChange || ''}
                    onChange={handleInputChange}
                    rows={3}
                    required
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="form-group">
                    <label htmlFor="previousPlantMedicines">Previous Plant Medicines:</label>
                    <textarea
                      id="previousPlantMedicines"
                      name="previousPlantMedicines"
                      value={formData.previousPlantMedicines || ''}
                      onChange={handleInputChange}
                      rows={2}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="spiritualBackground">Spiritual Background:</label>
                    <textarea
                      id="spiritualBackground"
                      name="spiritualBackground"
                      value={formData.spiritualBackground || ''}
                      onChange={handleInputChange}
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              {/* Personal History Section */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ color: '#2c3e50', borderBottom: '2px solid #8e44ad', paddingBottom: '5px' }}>Personal History</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="form-group">
                    <label htmlFor="childhood">Childhood:</label>
                    <textarea
                      id="childhood"
                      name="childhood"
                      value={formData.childhood || ''}
                      onChange={handleInputChange}
                      rows={2}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="traumaHistory">Trauma History:</label>
                    <textarea
                      id="traumaHistory"
                      name="traumaHistory"
                      value={formData.traumaHistory || ''}
                      onChange={handleInputChange}
                      rows={2}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="mentalHealthHistory">Mental Health History:</label>
                    <textarea
                      id="mentalHealthHistory"
                      name="mentalHealthHistory"
                      value={formData.mentalHealthHistory || ''}
                      onChange={handleInputChange}
                      rows={2}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="addictionHistory">Addiction History:</label>
                    <textarea
                      id="addictionHistory"
                      name="addictionHistory"
                      value={formData.addictionHistory || ''}
                      onChange={handleInputChange}
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              {/* Health Information Section */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ color: '#2c3e50', borderBottom: '2px solid #e74c3c', paddingBottom: '5px' }}>Health Information</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="form-group">
                    <label htmlFor="heartConditions">Heart Conditions:</label>
                    <textarea
                      id="heartConditions"
                      name="heartConditions"
                      value={formData.heartConditions || ''}
                      onChange={handleInputChange}
                      rows={2}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="liverConditions">Liver Conditions:</label>
                    <textarea
                      id="liverConditions"
                      name="liverConditions"
                      value={formData.liverConditions || ''}
                      onChange={handleInputChange}
                      rows={2}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="asthmaConditions">Asthma:</label>
                    <textarea
                      id="asthmaConditions"
                      name="asthmaConditions"
                      value={formData.asthmaConditions || ''}
                      onChange={handleInputChange}
                      rows={2}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="bloodPressureIssues">Blood Pressure Issues:</label>
                    <textarea
                      id="bloodPressureIssues"
                      name="bloodPressureIssues"
                      value={formData.bloodPressureIssues || ''}
                      onChange={handleInputChange}
                      rows={2}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="seizureHistory">Seizure History:</label>
                    <textarea
                      id="seizureHistory"
                      name="seizureHistory"
                      value={formData.seizureHistory || ''}
                      onChange={handleInputChange}
                      rows={2}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="psychoticEpisodes">Psychotic Episodes:</label>
                    <textarea
                      id="psychoticEpisodes"
                      name="psychoticEpisodes"
                      value={formData.psychoticEpisodes || ''}
                      onChange={handleInputChange}
                      rows={2}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="otherMedicalComplications">Other Complications:</label>
                    <textarea
                      id="otherMedicalComplications"
                      name="otherMedicalComplications"
                      value={formData.otherMedicalComplications || ''}
                      onChange={handleInputChange}
                      rows={2}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="allergies">Allergies:</label>
                    <textarea
                      id="allergies"
                      name="allergies"
                      value={formData.allergies || ''}
                      onChange={handleInputChange}
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              {/* Substances Section */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ color: '#2c3e50', borderBottom: '2px solid #f39c12', paddingBottom: '5px' }}>Current Medications & Substances</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="form-group">
                    <label htmlFor="currentMedications">Current Medications:</label>
                    <textarea
                      id="currentMedications"
                      name="currentMedications"
                      value={formData.currentMedications || ''}
                      onChange={handleInputChange}
                      rows={2}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="recreationalDrugs">Recreational Drugs:</label>
                    <textarea
                      id="recreationalDrugs"
                      name="recreationalDrugs"
                      value={formData.recreationalDrugs || ''}
                      onChange={handleInputChange}
                      rows={2}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="vitaminsSupplements">Vitamins/Supplements:</label>
                    <textarea
                      id="vitaminsSupplements"
                      name="vitaminsSupplements"
                      value={formData.vitaminsSupplements || ''}
                      onChange={handleInputChange}
                      rows={2}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="alcoholConsumption">Alcohol Consumption:</label>
                    <textarea
                      id="alcoholConsumption"
                      name="alcoholConsumption"
                      value={formData.alcoholConsumption || ''}
                      onChange={handleInputChange}
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              {/* Safety Section */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ color: '#2c3e50', borderBottom: '2px solid #e74c3c', paddingBottom: '5px' }}>Safety Considerations</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="form-group">
                    <label htmlFor="suicidalThoughts">Suicidal Thoughts:</label>
                    <textarea
                      id="suicidalThoughts"
                      name="suicidalThoughts"
                      value={formData.suicidalThoughts || ''}
                      onChange={handleInputChange}
                      rows={2}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="hospitalizations">Hospitalizations:</label>
                    <textarea
                      id="hospitalizations"
                      name="hospitalizations"
                      value={formData.hospitalizations || ''}
                      onChange={handleInputChange}
                      rows={2}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="weightRange">Weight Range:</label>
                    <input
                      type="text"
                      id="weightRange"
                      name="weightRange"
                      value={formData.weightRange || ''}
                      onChange={handleInputChange}
                      placeholder="e.g., 70-80 kg"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="pregnancyStatus">Pregnancy Status:</label>
                    <select
                      id="pregnancyStatus"
                      name="pregnancyStatus"
                      value={formData.pregnancyStatus || ''}
                      onChange={handleInputChange}
                    >
                      <option value="">Not Applicable</option>
                      <option value="not_pregnant">Not Pregnant</option>
                      <option value="pregnant">Pregnant</option>
                      <option value="trying_to_conceive">Trying to Conceive</option>
                      <option value="breastfeeding">Breastfeeding</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Notes Section */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ color: '#2c3e50', borderBottom: '2px solid #95a5a6', paddingBottom: '5px' }}>Additional Notes</h4>
                <div className="form-group">
                  <label htmlFor="notes">Notes:</label>
                  <textarea
                    id="notes"
                    name="notes"
                    value={formData.notes || ''}
                    onChange={handleInputChange}
                    rows={4}
                    placeholder="Additional notes, observations, or important information..."
                  />
                </div>
              </div>

              {/* Potential Client Section */}
              <div style={{ marginBottom: '20px' }}>
                <Collapse
                  ghost
                  expandIconPosition="end"
                  style={{
                    backgroundColor: '#f8f9fa',
                    border: '1px solid #dee2e6',
                    borderRadius: '6px'
                  }}
                >
                  <Panel
                    header={
                      <span style={{ fontWeight: 'bold', color: '#495057', fontSize: '16px' }}>
                        💾 Save Potential Client Information
                      </span>
                    }
                    key="1"
                  >
                    <div style={{ padding: '10px 0' }}>
                      <div className="form-group" style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={savePotentialClient}
                            onChange={(e) => setSavePotentialClient(e.target.checked)}
                            style={{ transform: 'scale(1.2)' }}
                          />
                          <span style={{ fontWeight: '500', color: '#28a745' }}>
                            Save as potential client
                          </span>
                        </label>
                      </div>

                      {savePotentialClient && (
                        <div style={{
                          backgroundColor: '#ffffff',
                          padding: '15px',
                          borderRadius: '4px',
                          border: '1px solid #e9ecef',
                          marginTop: '10px'
                        }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                            <div className="form-group">
                              <label htmlFor="potentialFirstName">First Name:</label>
                              <input
                                type="text"
                                id="potentialFirstName"
                                value={potentialClientData.firstName}
                                onChange={(e) => setPotentialClientData(prev => ({
                                  ...prev,
                                  firstName: e.target.value
                                }))}
                                placeholder="Enter first name"
                              />
                            </div>
                            <div className="form-group">
                              <label htmlFor="potentialPhone">Phone:</label>
                              <input
                                type="tel"
                                id="potentialPhone"
                                value={potentialClientData.phone}
                                onChange={(e) => setPotentialClientData(prev => ({
                                  ...prev,
                                  phone: e.target.value
                                }))}
                                placeholder="Enter phone number"
                              />
                            </div>
                            <div className="form-group">
                              <label htmlFor="potentialCountry">Country:</label>
                              <input
                                type="text"
                                id="potentialCountry"
                                value={potentialClientData.country}
                                onChange={(e) => setPotentialClientData(prev => ({
                                  ...prev,
                                  country: e.target.value
                                }))}
                                placeholder="Enter country"
                              />
                            </div>
                            <div className="form-group">
                              <label htmlFor="potentialAge">Age:</label>
                              <input
                                type="number"
                                id="potentialAge"
                                value={potentialClientData.age}
                                onChange={(e) => setPotentialClientData(prev => ({
                                  ...prev,
                                  age: e.target.value
                                }))}
                                placeholder="Enter age"
                                min="1"
                                max="120"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </Panel>
                </Collapse>
              </div>

              <div className="form-buttons">
                <button type="submit" className="save-btn">Save Screening</button>
                <button type="button" onClick={() => {
                  setIsModalOpen(false);
                  setSavePotentialClient(false);
                  setPotentialClientData({
                    firstName: '',
                    phone: '',
                    country: '',
                    age: ''
                  });
                }} className="cancel-btn">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScreeningClientsGrid;