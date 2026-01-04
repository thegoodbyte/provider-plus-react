import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams, ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { clientsApi, retreatsApi, bookingsApi, clientMedicalApi } from '../services/api';
import { Client } from '../types';
import ClientDetailView from './ClientDetailView';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import './ClientsGrid.css';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

interface ClientFormData extends Partial<Client> {
  totalAmount?: number;
  currency?: string;
}

const ClientsGrid: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [retreats, setRetreats] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState<ClientFormData>({});
  const [selectedRetreatId, setSelectedRetreatId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingClientId, setViewingClientId] = useState<string | null>(null);
  const gridApiRef = useRef<GridApi | null>(null);

  const ActionCellRenderer = (params: ICellRendererParams) => {
    return (
      <div className="action-buttons">
        <button onClick={() => handleView(params.data)} className="view-btn">👁️ View</button>
        <button onClick={() => handleEdit(params.data)} className="edit-btn">✏️ Edit</button>
        <button onClick={() => handleDelete(params.data._id)} className="delete-btn">🗑️ Delete</button>
      </div>
    );
  };

  const StatusCellRenderer = (params: ICellRendererParams) => {
    const status = params.value;
    const statusClass = status === 'active' ? 'status-active' :
                      status === 'inactive' ? 'status-inactive' : 'status-suspended';
    return <span className={`status-badge ${statusClass}`}>{status}</span>;
  };

  const columnDefs: ColDef[] = [
    { field: '_id', headerName: 'ID', hide: true },
    {
      field: 'fullName',
      headerName: 'Full Name',
      sortable: true,
      filter: true,
      pinned: 'left',
      width: 200,
      valueGetter: (params) => {
        const firstName = params.data.firstName || params.data.fname || '';
        const lastName = params.data.lastName || params.data.lname || '';
        return `${firstName} ${lastName}`.trim();
      }
    },
    { field: 'email', headerName: 'Email', sortable: true, filter: true, width: 250 },
    { field: 'phone', headerName: 'Phone', sortable: true, filter: true, width: 150 },
    { field: 'city', headerName: 'City', sortable: true, filter: true, width: 120 },
    { field: 'state', headerName: 'State', sortable: true, filter: true, width: 100 },
    { field: 'country', headerName: 'Country', sortable: true, filter: true, width: 120 },
    {
      field: 'status',
      headerName: 'Status',
      sortable: true,
      filter: true,
      width: 120,
      cellRenderer: StatusCellRenderer
    },
    { field: 'occupation', headerName: 'Occupation', sortable: true, filter: true },
    { field: 'emergencyContact', headerName: 'Emergency Contact', sortable: true, filter: true },
    {
      field: 'dateOfBirth',
      headerName: 'Date of Birth',
      sortable: true,
      filter: true,
      valueFormatter: (params) => {
        if (params.value) {
          return new Date(params.value).toLocaleDateString();
        }
        return '';
      }
    },
    {
      headerName: 'Actions',
      cellRenderer: ActionCellRenderer,
      width: 200,
      suppressSizeToFit: true,
      pinned: 'right'
    }
  ];

  const defaultColDef = {
    resizable: true,
    minWidth: 100,
    flex: 1
  };

  const fetchClients = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = searchTerm ?
        await clientsApi.search(searchTerm) :
        await clientsApi.getAll();
      setClients(response.data || []);
    } catch (error: any) {
      console.error('Error fetching clients:', error);
      setClients([]);
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm]);

  const fetchRetreats = useCallback(async () => {
    try {
      const response = await retreatsApi.getAll();
      setRetreats(response.data || []);
    } catch (error: any) {
      console.error('Error fetching retreats:', error);
      setRetreats([]);
    }
  }, []);

  useEffect(() => {
    fetchClients();
    fetchRetreats();
  }, [fetchClients, fetchRetreats]);

  const handleGridReady = (params: GridReadyEvent) => {
    gridApiRef.current = params.api;
    params.api.sizeColumnsToFit();
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleAdd = () => {
    setEditingClient(null);
    setFormData({
      status: 'active',
      country: 'USA'
    });
    setSelectedRetreatId('');
    setIsModalOpen(true);
  };

  const handleView = (client: Client) => {
    setViewingClientId(client._id!);
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData(client);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this client?')) {
      try {
        await clientsApi.delete(id);
        fetchClients();
      } catch (error: any) {
        console.error('Error deleting client:', error);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const cleanData: any = {};

      // Required fields
      if (formData.firstName?.trim()) cleanData.firstName = formData.firstName.trim();
      if (formData.lastName?.trim()) cleanData.lastName = formData.lastName.trim();
      if (formData.email?.trim()) cleanData.email = formData.email.trim();
      if (formData.phone?.trim()) cleanData.phone = formData.phone.trim();
      if (formData.address?.trim()) cleanData.address = formData.address.trim();

      // Optional fields
      if (formData.city?.trim()) cleanData.city = formData.city.trim();
      if (formData.state?.trim()) cleanData.state = formData.state.trim();
      if (formData.zipCode?.trim()) cleanData.zipCode = formData.zipCode.trim();
      if (formData.country?.trim()) cleanData.country = formData.country.trim();
      if (formData.dateOfBirth) cleanData.dateOfBirth = formData.dateOfBirth;
      if (formData.emergencyContact?.trim()) cleanData.emergencyContact = formData.emergencyContact.trim();
      if (formData.emergencyContactPhone?.trim()) cleanData.emergencyContactPhone = formData.emergencyContactPhone.trim();
      if (formData.medicalConditions?.trim()) cleanData.medicalConditions = formData.medicalConditions.trim();
      if (formData.dietaryRestrictions?.trim()) cleanData.dietaryRestrictions = formData.dietaryRestrictions.trim();
      if (formData.notes?.trim()) cleanData.notes = formData.notes.trim();
      if (formData.preferredName?.trim()) cleanData.preferredName = formData.preferredName.trim();
      if (formData.occupation?.trim()) cleanData.occupation = formData.occupation.trim();
      if (formData.gender) cleanData.gender = formData.gender;
      if (formData.height?.trim()) cleanData.height = formData.height.trim();
      if (formData.weight && formData.weight > 0) cleanData.weight = Number(formData.weight);
      if (formData.status) cleanData.status = formData.status;

      if (editingClient) {
        await clientsApi.update(editingClient._id!, cleanData);
      } else {
        // Create the client first
        const clientResponse = await clientsApi.create(cleanData);
        const newClient = clientResponse.data;

        // If a retreat is selected, create the booking and medical record
        if (selectedRetreatId && newClient._id) {
          try {
            // Create booking with custom pricing if provided
            const bookingData = {
              clientId: newClient._id,
              retreatId: selectedRetreatId,
              registrationDate: new Date(),
              checkInDate: undefined,
              checkOutDate: undefined,
              totalAmount: formData.totalAmount ? Number(formData.totalAmount) : 0,
              amountPaid: 0,
              currency: formData.currency || 'EUR',
              status: 'confirmed' as "confirmed" | "pending" | "checked-in" | "checked-out" | "cancelled"
            };
            await bookingsApi.create(bookingData as any);

            // Create medical record (only required fields)
            const medicalData = {
              clientId: newClient._id,
              retreatId: selectedRetreatId,
              liverPanelStatus: 'pending' as "pending" | "received" | "reviewed" | "approved" | "rejected",
              ekgStatus: 'pending' as "pending" | "received" | "reviewed" | "approved" | "rejected",
              finalMedicalClearance: false
            };
            await clientMedicalApi.create(medicalData as any);

            console.log('Created booking and medical record for client');
          } catch (bookingError) {
            console.error('Error creating booking/medical record:', bookingError);
            // Client was created successfully, but booking/medical failed
            alert('Client created, but there was an error creating the booking or medical record. You can create these manually.');
          }
        }
      }
      setIsModalOpen(false);
      setFormData({});
      setSelectedRetreatId('');
      setEditingClient(null);
      fetchClients();
    } catch (error: any) {
      console.error('Error saving client:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'weight' ? parseFloat(value) : value
    }));
  };

  const handleBackFromDetail = () => {
    setViewingClientId(null);
  };

  // If viewing a client's detail, show the detail view
  if (viewingClientId) {
    return <ClientDetailView clientId={viewingClientId} onBack={handleBackFromDetail} />;
  }

  return (
    <div className="clients-container">
      <div className="clients-header">
        <h2>👥 Clients Management</h2>
        <div className="header-actions">
          <div className="search-box">
            <input
              type="text"
              placeholder="🔍 Search clients..."
              value={searchTerm}
              onChange={handleSearch}
              className="search-input"
            />
          </div>
          <button onClick={handleAdd} className="add-btn">➕ Add New Client</button>
        </div>
        <div className="status-info">
          Status: {isLoading ? 'Loading...' : `${clients.length} clients loaded`}
        </div>
      </div>

      {isLoading ? (
        <div className="loading-container">
          <div className="loading-spinner">⏳</div>
          <p>Loading clients...</p>
        </div>
      ) : (
        <div className="ag-theme-alpine" style={{ height: 600, width: '100%' }}>
          <AgGridReact
            rowData={clients}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            onGridReady={handleGridReady}
            animateRows={true}
            pagination={true}
            paginationPageSize={20}
            suppressNoRowsOverlay={false}
          />
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal large-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingClient ? 'Edit Client' : 'Add New Client'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-section">
                  <h4>Basic Information</h4>
                  <div className="form-group">
                    <label htmlFor="firstName">First Name *:</label>
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
                    <label htmlFor="lastName">Last Name *:</label>
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
                    <label htmlFor="preferredName">Preferred Name:</label>
                    <input
                      type="text"
                      id="preferredName"
                      name="preferredName"
                      value={formData.preferredName || ''}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="email">Email *:</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email || ''}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="phone">Phone *:</label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone || ''}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>

                {/* Retreat Selection Section - Only show for new clients */}
                {!editingClient && (
                  <div className="form-section">
                    <h4>🏔️ Retreat Assignment</h4>
                    <div className="form-group">
                      <label htmlFor="retreatSelect">Select Retreat (Optional):</label>
                      <select
                        id="retreatSelect"
                        value={selectedRetreatId}
                        onChange={(e) => setSelectedRetreatId(e.target.value)}
                        className="form-control"
                      >
                        <option value="">No retreat - client only</option>
                        {retreats.map((retreat) => (
                          <option key={retreat._id} value={retreat._id}>
                            {retreat.name} - {retreat.location} ({new Date(retreat.startDate || retreat.dates?.startDate || '').toLocaleDateString()})
                          </option>
                        ))}
                      </select>
                      <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
                        Selecting a retreat will automatically create a booking and medical tracking record for this client.
                      </small>
                    </div>

                    {selectedRetreatId && (
                      <>
                        <div className="form-group">
                          <label htmlFor="totalAmount">Custom Price (Optional):</label>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <input
                              type="number"
                              id="totalAmount"
                              name="totalAmount"
                              value={formData.totalAmount || ''}
                              onChange={handleInputChange}
                              placeholder="0.00"
                              min="0"
                              step="0.01"
                              style={{ flex: 2 }}
                            />
                            <select
                              id="currency"
                              name="currency"
                              value={formData.currency || 'EUR'}
                              onChange={handleInputChange}
                              style={{ flex: 1 }}
                            >
                              <option value="EUR">EUR</option>
                              <option value="CZK">CZK</option>
                              <option value="PLN">PLN</option>
                            </select>
                          </div>
                          <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
                            Leave empty to use standard retreat pricing. Enter custom amount for discounts.
                          </small>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="form-section">
                  <h4>Address Information</h4>
                  <div className="form-group">
                    <label htmlFor="address">Address *:</label>
                    <input
                      type="text"
                      id="address"
                      name="address"
                      value={formData.address || ''}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="city">City:</label>
                    <input
                      type="text"
                      id="city"
                      name="city"
                      value={formData.city || ''}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="state">State:</label>
                    <input
                      type="text"
                      id="state"
                      name="state"
                      value={formData.state || ''}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="zipCode">Zip Code:</label>
                    <input
                      type="text"
                      id="zipCode"
                      name="zipCode"
                      value={formData.zipCode || ''}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="country">Country:</label>
                    <input
                      type="text"
                      id="country"
                      name="country"
                      value={formData.country || ''}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                <div className="form-section">
                  <h4>Personal Details</h4>
                  <div className="form-group">
                    <label htmlFor="dateOfBirth">Date of Birth:</label>
                    <input
                      type="date"
                      id="dateOfBirth"
                      name="dateOfBirth"
                      value={formData.dateOfBirth ? new Date(formData.dateOfBirth).toISOString().split('T')[0] : ''}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="gender">Gender:</label>
                    <select
                      id="gender"
                      name="gender"
                      value={formData.gender || ''}
                      onChange={handleInputChange}
                    >
                      <option value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                      <option value="prefer-not-to-say">Prefer not to say</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="height">Height:</label>
                    <input
                      type="text"
                      id="height"
                      name="height"
                      value={formData.height || ''}
                      onChange={handleInputChange}
                      placeholder="e.g., 5'8&quot; or 173cm"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="weight">Weight (lbs):</label>
                    <input
                      type="number"
                      id="weight"
                      name="weight"
                      value={formData.weight || ''}
                      onChange={handleInputChange}
                      min="0"
                      step="0.1"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="occupation">Occupation:</label>
                    <input
                      type="text"
                      id="occupation"
                      name="occupation"
                      value={formData.occupation || ''}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="status">Status:</label>
                    <select
                      id="status"
                      name="status"
                      value={formData.status || 'active'}
                      onChange={handleInputChange}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                </div>

                <div className="form-section">
                  <h4>Emergency & Medical</h4>
                  <div className="form-group">
                    <label htmlFor="emergencyContact">Emergency Contact:</label>
                    <input
                      type="text"
                      id="emergencyContact"
                      name="emergencyContact"
                      value={formData.emergencyContact || ''}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="emergencyContactPhone">Emergency Contact Phone:</label>
                    <input
                      type="tel"
                      id="emergencyContactPhone"
                      name="emergencyContactPhone"
                      value={formData.emergencyContactPhone || ''}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="medicalConditions">Medical Conditions:</label>
                    <textarea
                      id="medicalConditions"
                      name="medicalConditions"
                      value={formData.medicalConditions || ''}
                      onChange={handleInputChange}
                      rows={3}
                      placeholder="Any known medical conditions..."
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="dietaryRestrictions">Dietary Restrictions:</label>
                    <textarea
                      id="dietaryRestrictions"
                      name="dietaryRestrictions"
                      value={formData.dietaryRestrictions || ''}
                      onChange={handleInputChange}
                      rows={3}
                      placeholder="Any dietary restrictions or allergies..."
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="notes">Additional Notes:</label>
                    <textarea
                      id="notes"
                      name="notes"
                      value={formData.notes || ''}
                      onChange={handleInputChange}
                      rows={4}
                      placeholder="Any additional notes about the client..."
                    />
                  </div>
                </div>
              </div>

              <div className="form-buttons">
                <button type="submit" className="save-btn">💾 Save Client</button>
                <button type="button" onClick={() => setIsModalOpen(false)} className="cancel-btn">❌ Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientsGrid;