import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams, ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { clientsApi, retreatsApi, bookingsApi, clientMedicalApi } from '../services/api';
import { Client } from '../types';
import ClientDetailView from './ClientDetailView';
import QuickAddClient from './QuickAddClient';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import './ClientsGrid.css';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

// Countries list with codes for storage and full names for display
const COUNTRIES_WITH_CODES = [
  { code: 'US', name: 'United States' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'PL', name: 'Poland' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'BE', name: 'Belgium' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'AT', name: 'Austria' },
  { code: 'DK', name: 'Denmark' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'FI', name: 'Finland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'IE', name: 'Ireland' },
  { code: 'GR', name: 'Greece' },
  { code: 'TR', name: 'Turkey' },
  { code: 'RU', name: 'Russia' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'AU', name: 'Australia' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'JP', name: 'Japan' },
  { code: 'CN', name: 'China' },
  { code: 'KR', name: 'South Korea' },
  { code: 'IN', name: 'India' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'AR', name: 'Argentina' },
  { code: 'IL', name: 'Israel' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'EG', name: 'Egypt' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'KE', name: 'Kenya' },
  { code: 'MA', name: 'Morocco' },
  { code: 'TN', name: 'Tunisia' },
  { code: 'SG', name: 'Singapore' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'TH', name: 'Thailand' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'PH', name: 'Philippines' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'CL', name: 'Chile' },
  { code: 'CO', name: 'Colombia' },
  { code: 'PE', name: 'Peru' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'HR', name: 'Croatia' },
  { code: 'RS', name: 'Serbia' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'HU', name: 'Hungary' },
  { code: 'RO', name: 'Romania' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LV', name: 'Latvia' },
  { code: 'EE', name: 'Estonia' },
  { code: 'IS', name: 'Iceland' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MT', name: 'Malta' },
  { code: 'CY', name: 'Cyprus' }
].sort((a, b) => a.name.localeCompare(b.name));

// Common country codes
const COUNTRY_CODES = [
  { code: '+1', country: 'USA/Canada' },
  { code: '+420', country: 'Czech Republic' },
  { code: '+48', country: 'Poland' },
  { code: '+44', country: 'UK' },
  { code: '+33', country: 'France' },
  { code: '+34', country: 'Spain' },
  { code: '+39', country: 'Italy' },
  { code: '+49', country: 'Germany' },
  { code: '+31', country: 'Netherlands' },
  { code: '+32', country: 'Belgium' },
  { code: '+41', country: 'Switzerland' },
  { code: '+43', country: 'Austria' },
  { code: '+45', country: 'Denmark' },
  { code: '+46', country: 'Sweden' },
  { code: '+47', country: 'Norway' },
  { code: '+358', country: 'Finland' },
  { code: '+351', country: 'Portugal' },
  { code: '+353', country: 'Ireland' },
  { code: '+30', country: 'Greece' },
  { code: '+90', country: 'Turkey' },
  { code: '+7', country: 'Russia' },
  { code: '+380', country: 'Ukraine' },
  { code: '+86', country: 'China' },
  { code: '+81', country: 'Japan' },
  { code: '+82', country: 'South Korea' },
  { code: '+91', country: 'India' },
  { code: '+61', country: 'Australia' },
  { code: '+64', country: 'New Zealand' },
  { code: '+27', country: 'South Africa' },
  { code: '+234', country: 'Nigeria' },
  { code: '+52', country: 'Mexico' },
  { code: '+54', country: 'Argentina' },
  { code: '+55', country: 'Brazil' },
  { code: '+56', country: 'Chile' },
  { code: '+57', country: 'Colombia' },
  { code: '+58', country: 'Venezuela' },
  { code: '+51', country: 'Peru' },
  { code: '+972', country: 'Israel' },
  { code: '+971', country: 'UAE' },
  { code: '+966', country: 'Saudi Arabia' },
  { code: '+20', country: 'Egypt' },
  { code: '+212', country: 'Morocco' },
].sort((a, b) => a.country.localeCompare(b.country));

interface ClientFormData extends Partial<Client> {
  totalAmount?: number;
  currency?: string;
  countryCode?: string;
  phoneNumber?: string;
  yearOfBirth?: number;
}

const ClientsGrid: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [retreats, setRetreats] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState<ClientFormData>({});
  const [selectedRetreatId, setSelectedRetreatId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingClientId, setViewingClientId] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [workflowFilter, setWorkflowFilter] = useState<string>('all');
  const gridApiRef = useRef<GridApi | null>(null);

  // Helper function to get country name from code
  const getCountryName = (code: string) => {
    const country = COUNTRIES_WITH_CODES.find(c => c.code === code);
    return country ? country.name : code;
  };

  const ActionCellRenderer = React.memo((params: ICellRendererParams) => {
    return (
      <div className="action-buttons">
        <button onClick={() => handleView(params.data)} className="view-btn">👁️ View</button>
        <button onClick={() => handleEdit(params.data)} className="edit-btn">✏️ Edit</button>
        <button onClick={() => handleGenerateDepositLink(params.data)} className="link-btn">🔗 Deposit Link</button>
        <button onClick={() => handleDelete(params.data._id)} className="delete-btn">🗑️ Delete</button>
      </div>
    );
  });

  const StatusCellRenderer = React.memo((params: ICellRendererParams) => {
    const status = params.value;
    const statusClass = status === 'active' ? 'status-active' :
                      status === 'inactive' ? 'status-inactive' : 'status-suspended';
    return <span className={`status-badge ${statusClass}`}>{status}</span>;
  });

  const WorkflowStatusCellRenderer = React.memo((params: ICellRendererParams) => {
    const status = params.value || 'potential';
    let statusClass = '';
    switch(status) {
      case 'potential':
        statusClass = 'workflow-potential';
        break;
      case 'booked':
        statusClass = 'workflow-booked';
        break;
      case 'cancelled':
        statusClass = 'workflow-cancelled';
        break;
      case 'completed':
        statusClass = 'workflow-completed';
        break;
      case 'blacklisted':
        statusClass = 'workflow-blacklisted';
        break;
      default:
        statusClass = 'workflow-potential';
    }
    return <span className={`workflow-badge ${statusClass}`}>{status?.toUpperCase()}</span>;
  });

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
    {
      field: 'country',
      headerName: 'Country',
      sortable: true,
      filter: true,
      width: 120,
      valueFormatter: (params) => {
        if (params.value) {
          return getCountryName(params.value);
        }
        return '';
      }
    },
    {
      field: 'status',
      headerName: 'Status',
      sortable: true,
      filter: true,
      width: 120,
      cellRenderer: StatusCellRenderer
    },
    {
      field: 'workflowStatus',
      headerName: 'Workflow',
      sortable: true,
      filter: true,
      width: 130,
      cellRenderer: WorkflowStatusCellRenderer
    },
    { field: 'emergencyContact', headerName: 'Emergency Contact', sortable: true, filter: true },
    {
      field: 'dateOfBirth',
      headerName: 'Year of Birth',
      sortable: true,
      filter: true,
      valueFormatter: (params) => {
        if (params.value) {
          return new Date(params.value).getFullYear().toString();
        }
        return '';
      }
    },
    {
      headerName: 'Actions',
      cellRenderer: ActionCellRenderer,
      width: 280,
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
    setIsLoading(true);
    setApiError(false);
    try {
      const response = await clientsApi.getAll();
      setClients(response.data || []);
    } catch (error: any) {
      console.error('Error fetching clients:', error);
      setApiError(true);
      setClients([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchRetreats = useCallback(async () => {
    try {
      const response = await retreatsApi.getAll();
      setRetreats(response.data || []);
    } catch (error: any) {
      setRetreats([]);
    }
  }, []);

  // Initial data load
  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Apply filters to clients data
  const filteredClients = useMemo(() => {
    let result = [...clients];

    // Apply workflow filter
    if (workflowFilter === 'potential') {
      result = result.filter(c => {
        // Check various ways a client might be marked as potential
        return !c.status || c.status === 'active';
      });
    } else if (workflowFilter === 'blacklisted') {
      result = result.filter(c => {
        // Check if client has notes about being blacklisted
        return c.notes?.toLowerCase().includes('blacklist');
      });
    } else if (workflowFilter === 'booked') {
      result = result.filter(c => {
        // We'll need to check bookings separately
        return false; // For now, will need to join with bookings data
      });
    }

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(c =>
        c.firstName?.toLowerCase().includes(term) ||
        c.lastName?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        c.phone?.includes(term)
      );
    }

    return result;
  }, [clients, searchTerm, workflowFilter]);

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
      country: 'US', // Default to United States (code)
      countryCode: '+1', // Default to USA/Canada
      phoneNumber: '',
      yearOfBirth: new Date().getFullYear() - 30 // Default age around 30
    });
    setSelectedRetreatId('');
    setValidationErrors([]); // Clear any previous errors
    setIsModalOpen(true);
    // Only fetch retreats when modal is opened
    if (retreats.length === 0) {
      fetchRetreats();
    }
  };

  const handleView = (client: Client) => {
    setViewingClientId(client._id!);
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setValidationErrors([]); // Clear any previous errors

    // Parse phone number to extract country code
    let countryCode = '+420'; // Default to Czech Republic
    let phoneNumber = client.phone || '';

    // Check if phone starts with a country code
    if (phoneNumber.startsWith('+')) {
      // Try to match against known country codes
      const matchedCode = COUNTRY_CODES.find(cc => phoneNumber.startsWith(cc.code));
      if (matchedCode) {
        countryCode = matchedCode.code;
        phoneNumber = phoneNumber.substring(matchedCode.code.length).trim();
      }
    } else if (phoneNumber.match(/^\d/)) {
      // If it starts with a digit without +, keep as is
      // User might have stored without country code
    }

    // Extract year from dateOfBirth if present
    let yearOfBirth;
    if (client.dateOfBirth) {
      yearOfBirth = new Date(client.dateOfBirth).getFullYear();
    }

    setFormData({
      ...client,
      countryCode,
      phoneNumber,
      yearOfBirth
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this client?')) {
      try {
        await clientsApi.delete(id);
        fetchClients();
      } catch (error: any) {
        // Handle error silently
      }
    }
  };

  const handleGenerateDepositLink = async (client: Client) => {
    try {
      // Check if client already has a hash, if not generate one
      let hash = client.depositFormHash;
      if (!hash) {
        const response = await clientsApi.regenerateDepositHash(client._id!);
        hash = response.data.hash;
        // Refresh clients to show updated hash
        fetchClients();
      }

      const fullUrl = `${window.location.origin}/api/clients/public/deposit-agreement/${hash}`;

      navigator.clipboard.writeText(fullUrl).then(() => {
        alert(`Deposit form link copied to clipboard!\n\nFull URL: ${fullUrl}\n\nThe link has been copied to your clipboard.`);
      }).catch(() => {
        // Fallback for browsers that don't support clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = fullUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert(`Deposit form link generated!\n\nFull URL: ${fullUrl}\n\nThe link has been copied to your clipboard.`);
      });
    } catch (error: any) {
      console.error('Error generating deposit form link:', error);
      alert('Failed to generate deposit form link. Please try again.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors([]); // Clear previous errors

    // Validate required fields
    const errors: string[] = [];
    if (!formData.firstName?.trim()) errors.push('First name is required');
    if (!formData.lastName?.trim()) errors.push('Last name is required');
    if (!formData.email?.trim()) errors.push('Email is required');
    if (!formData.phoneNumber?.trim()) errors.push('Phone number is required');

    // Check if state is required for US customers
    if (formData.country === 'US' && !formData.state?.trim()) {
      errors.push('State is required for US customers');
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    try {
      const cleanData: any = {};

      // Required fields
      if (formData.firstName?.trim()) cleanData.firstName = formData.firstName.trim();
      if (formData.lastName?.trim()) cleanData.lastName = formData.lastName.trim();
      if (formData.email?.trim()) cleanData.email = formData.email.trim();

      // Combine country code and phone number
      if (formData.phoneNumber?.trim() || formData.phone?.trim()) {
        const phoneNum = formData.phoneNumber?.trim() || formData.phone?.trim() || '';
        const countryCode = formData.countryCode || '+1';
        cleanData.phone = phoneNum.startsWith('+') ? phoneNum : `${countryCode} ${phoneNum}`;
      }

      // Address is now optional
      if (formData.address?.trim()) cleanData.address = formData.address.trim();

      // Optional fields
      if (formData.city?.trim()) cleanData.city = formData.city.trim();
      if (formData.state?.trim()) cleanData.state = formData.state.trim();
      if (formData.zipCode?.trim()) cleanData.zipCode = formData.zipCode.trim();
      if (formData.country?.trim()) cleanData.country = formData.country.trim();

      // Convert year to date of birth
      if (formData.yearOfBirth) {
        cleanData.dateOfBirth = new Date(`${formData.yearOfBirth}-01-01`);
      }

      if (formData.emergencyContact?.trim()) cleanData.emergencyContact = formData.emergencyContact.trim();
      if (formData.emergencyContactPhone?.trim()) cleanData.emergencyContactPhone = formData.emergencyContactPhone.trim();
      if (formData.dietaryRestrictions?.trim()) cleanData.dietaryRestrictions = formData.dietaryRestrictions.trim();
      if (formData.notes?.trim()) cleanData.notes = formData.notes.trim();
      if (formData.occupation?.trim()) cleanData.occupation = formData.occupation.trim();
      if (formData.source?.trim()) cleanData.source = formData.source.trim();
      if (formData.gender) cleanData.gender = formData.gender;
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
      // Parse error message and display to user
      let errorMessage = 'An error occurred while saving the client';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }

      // Handle specific validation errors from backend
      if (error.response?.status === 400) {
        if (errorMessage.includes('duplicate') || errorMessage.includes('already exists')) {
          errorMessage = 'A client with this email already exists';
        }
      }

      setValidationErrors([errorMessage]);
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
          <div className="workflow-filter">
            <select
              value={workflowFilter}
              onChange={(e) => setWorkflowFilter(e.target.value)}
              className="workflow-select"
            >
              <option value="all">All Clients</option>
              <option value="potential">Potential Only</option>
              <option value="booked">Booked Only</option>
              <option value="blacklisted">Blacklisted</option>
            </select>
          </div>
          <button onClick={() => setIsQuickAddOpen(true)} className="quick-add-btn">⚡ Quick Add</button>
          <button onClick={handleAdd} className="add-btn">➕ Add New Client</button>
        </div>
        <div className="status-info">
          Status: {isLoading ? 'Loading...' : `${filteredClients.length} clients loaded`}
        </div>
      </div>

      {isLoading ? (
        <div className="loading-container">
          <div className="loading-spinner">⏳</div>
          <p>Loading clients...</p>
        </div>
      ) : (
        <>
          {apiError && (
            <div style={{ padding: '10px', textAlign: 'center', color: '#d32f2f', backgroundColor: '#ffebee', borderRadius: '4px', margin: '10px 0' }}>
              API Error: Unable to load clients data
            </div>
          )}
          <div className="ag-theme-alpine" style={{ height: 600, width: '100%' }}>
            <AgGridReact
              rowData={filteredClients}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              onGridReady={handleGridReady}
              animateRows={false}
              pagination={true}
              paginationPageSize={50}
              suppressNoRowsOverlay={false}
              suppressColumnVirtualisation={false}
              suppressRowVirtualisation={false}
            />
          </div>
        </>
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
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select
                        name="countryCode"
                        value={formData.countryCode || '+1'}
                        onChange={handleInputChange}
                        style={{ width: '160px' }}
                      >
                        {COUNTRY_CODES.map(cc => (
                          <option key={cc.code} value={cc.code}>
                            {cc.code} {cc.country}
                          </option>
                        ))}
                      </select>
                      <input
                        type="tel"
                        id="phoneNumber"
                        name="phoneNumber"
                        value={formData.phoneNumber || ''}
                        onChange={handleInputChange}
                        placeholder="Phone number"
                        required
                        style={{ flex: 1 }}
                      />
                    </div>
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
                    <label htmlFor="address">Address:</label>
                    <input
                      type="text"
                      id="address"
                      name="address"
                      value={formData.address || ''}
                      onChange={handleInputChange}
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
                    <label htmlFor="state">
                      State {formData.country === 'US' ? '*' : ''}
                      <span style={{ fontSize: '0.85em', color: '#666', marginLeft: '4px' }}>
                        {formData.country === 'US' ? '(required for US)' : '(optional)'}
                      </span>:
                    </label>
                    <input
                      type="text"
                      id="state"
                      name="state"
                      value={formData.state || ''}
                      onChange={handleInputChange}
                      placeholder={formData.country === 'US' ? 'State (e.g., NY, CA)' : 'State/Province (if applicable)'}
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
                    <select
                      id="country"
                      name="country"
                      value={formData.country || 'US'}
                      onChange={handleInputChange}
                    >
                      <option value="">Select Country</option>
                      {COUNTRIES_WITH_CODES.map(country => (
                        <option key={country.code} value={country.code}>{country.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-section">
                  <h4>Personal Details</h4>
                  <div className="form-group">
                    <label htmlFor="yearOfBirth">Year of Birth:</label>
                    <input
                      type="number"
                      id="yearOfBirth"
                      name="yearOfBirth"
                      value={formData.yearOfBirth || ''}
                      onChange={handleInputChange}
                      min="1920"
                      max={new Date().getFullYear()}
                      placeholder="YYYY"
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
                    <label htmlFor="source">Source (How they found you):</label>
                    <select
                      id="source"
                      name="source"
                      value={formData.source || ''}
                      onChange={handleInputChange}
                    >
                      <option value="">Select Source</option>
                      <option value="Website">Website</option>
                      <option value="Referral">Referral</option>
                      <option value="Social Media">Social Media</option>
                      <option value="Google Search">Google Search</option>
                      <option value="Friend">Friend</option>
                      <option value="Previous Client">Previous Client</option>
                      <option value="Other">Other</option>
                    </select>
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
                  <h4>Emergency Contact</h4>
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

              {/* Display validation errors */}
              {validationErrors.length > 0 && (
                <div style={{
                  backgroundColor: '#ffe6e6',
                  border: '1px solid #ff4444',
                  borderRadius: '4px',
                  padding: '12px',
                  marginBottom: '16px'
                }}>
                  <h4 style={{ color: '#cc0000', marginTop: 0, marginBottom: '8px' }}>⚠️ Please fix the following errors:</h4>
                  <ul style={{ margin: 0, paddingLeft: '20px', color: '#cc0000' }}>
                    {validationErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="form-buttons">
                <button type="submit" className="save-btn">💾 Save Client</button>
                <button type="button" onClick={() => { setIsModalOpen(false); setValidationErrors([]); }} className="cancel-btn">❌ Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <QuickAddClient
        visible={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onSuccess={fetchClients}
      />
    </div>
  );
};

export default ClientsGrid;