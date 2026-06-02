import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { clientsApi, retreatsApi, bookingsApi, clientMedicalApi } from '../services/api';
import { Client, Retreat, RetreatClient } from '../types';
import ClientDetailView from './ClientDetailView';
import QuickAddClient from './QuickAddClient';
import SimpleTable, { Column } from './SimpleTable';
import { IconButton, Chip } from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Visibility as VisibilityIcon, Link as LinkIcon } from '@mui/icons-material';
import './ClientsGrid.css';

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
interface ClientFormData extends Partial<Client> {
  totalAmount?: number;
  currency?: string;
  yearOfBirth?: number;
}

const getObjectId = (value: any): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value._id || value.id || '';
};

const getRetreatCode = (retreat: any) => {
  const rawName = String(retreat?.name || retreat?.location || 'Retreat').trim();
  const initials = rawName
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'RET';
  const dateValue = retreat?.startDate || retreat?.dates?.startDate;
  const date = dateValue ? new Date(dateValue) : null;
  if (!date || Number.isNaN(date.getTime())) return initials;
  const two = (value: number) => String(value).padStart(2, '0');
  return `${initials}-${two(date.getUTCMonth() + 1)}-${two(date.getUTCDate())}-${two(date.getUTCFullYear() % 100)}`;
};

const isBookedClient = (client: Client) => (
  (client.status as string) === 'booked' || client.workflowStatus === 'booked'
);

const ClientNameCell: React.FC<{
  client: Client;
  name: string;
  onView: (client: Client) => void;
}> = ({ client, name, onView }) => {
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(client.profilePictureUrl || null);
  const hasProfilePicture = Boolean(client.profilePictureUrl || client.profilePictureS3Key || client.profilePictureFileUploadId);

  useEffect(() => {
    if (!client._id || client.profilePictureUrl || !hasProfilePicture) {
      setProfilePictureUrl(client.profilePictureUrl || null);
      return;
    }

    let objectUrl: string | null = null;
    let active = true;

    clientsApi.getProfilePictureBlob(client._id)
      .then((response) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(response.data);
        setProfilePictureUrl(objectUrl);
      })
      .catch(() => {
        if (active) setProfilePictureUrl(null);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [client._id, client.profilePictureFileUploadId, client.profilePictureS3Key, client.profilePictureUrl, hasProfilePicture]);

  return (
    <button
      className="client-name-button"
      onClick={(e) => {
        e.stopPropagation();
        onView(client);
      }}
    >
      {hasProfilePicture && (
        <span className="client-list-avatar" aria-hidden="true">
          {profilePictureUrl ? (
            <img src={profilePictureUrl} alt="" />
          ) : (
            <span>{name.charAt(0).toUpperCase()}</span>
          )}
        </span>
      )}
      <span className="client-name-text">{name}</span>
    </button>
  );
};

const ClientsGrid: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [retreats, setRetreats] = useState<any[]>([]);
  const [bookings, setBookings] = useState<RetreatClient[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState<ClientFormData>({});
  const [selectedRetreatId, setSelectedRetreatId] = useState<string>('');
  const [viewingClientId, setViewingClientId] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [workflowFilter, setWorkflowFilter] = useState<string>('all');
  const [refreshKey, setRefreshKey] = useState(0);

  // Helper function to get country name from code
  const getCountryName = (code: string) => {
    const country = COUNTRIES_WITH_CODES.find(c => c.code === code);
    return country ? country.name : code;
  };

  const handleRefresh = () => {
    fetchClients();
    setRefreshKey(prev => prev + 1);
  };

  const handleView = useCallback((client: Client) => {
    setViewingClientId(client._id!);
  }, []);

  const handleEdit = useCallback((client: Client) => {
    if (!client?._id) return;
    navigate(`/admin/clients/${client._id}/edit`);
  }, [navigate]);

  const handleDelete = useCallback(async (id: string) => {
    if (window.confirm('Are you sure you want to delete this client?')) {
      try {
        await clientsApi.delete(id);
        fetchClients();
      } catch (error: any) {
        console.error('Error deleting client:', error);
      }
    }
  }, []);

  const handleGenerateDepositLink = useCallback(async (client: Client) => {
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
  }, []);

  const getBookingRetreat = useCallback((booking: RetreatClient) => {
    const retreatValue = (booking as any).retreatId || (booking as any).retreat || (booking as any).retreatDetails;
    const retreatId = getObjectId(retreatValue);
    if (retreatValue && typeof retreatValue === 'object' && (retreatValue.name || retreatValue.location)) {
      return retreatValue;
    }
    return retreats.find((retreat: Retreat) => retreat._id === retreatId);
  }, [retreats]);

  const getClientBooking = useCallback((client: Client) => {
    if (!client._id) return undefined;
    const activeStatuses = new Set(['confirmed', 'approved', 'checked-in', 'pending', 'conditional']);
    return bookings.find((booking) => {
      const bookingClientId = getObjectId((booking as any).clientId || (booking as any).client);
      return bookingClientId === client._id && activeStatuses.has(String(booking.status || 'pending'));
    });
  }, [bookings]);

  const columns: Column[] = useMemo(() => [
    {
      field: 'fullName',
      headerName: 'Full Name',
      width: 200,
      valueGetter: (row) => {
        const firstName = row.firstName || row.fname || '';
        const lastName = row.lastName || row.lname || '';
        return `${firstName} ${lastName}`.trim();
      },
      renderCell: (value, row) => (
        <ClientNameCell client={row} name={value || 'Unnamed client'} onView={handleView} />
      ),
      sortable: true
    },
    {
      field: 'email',
      headerName: 'Email',
      width: 250,
      sortable: true
    },
    {
      field: 'phone',
      headerName: 'Phone',
      width: 150,
      sortable: true
    },
    {
      field: 'country',
      headerName: 'Country',
      width: 120,
      renderCell: (value) => value ? getCountryName(value) : '',
      sortable: true
    },
    {
      field: 'language',
      headerName: 'Language',
      width: 90,
      renderCell: (value) => value || 'EN',
      sortable: true
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (value) => {
        let color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' = 'default';
        switch(value) {
          case 'active':
            color = 'success';
            break;
          case 'inactive':
            color = 'error';
            break;
          case 'potential':
            color = 'info';
            break;
          case 'booked':
            color = 'primary';
            break;
        }
        return <Chip label={value?.toUpperCase() || 'N/A'} color={color} size="small" />;
      },
      sortable: true
    },
    {
      field: 'workflowStatus',
      headerName: 'Workflow',
      width: 130,
      valueGetter: (row) => row.workflowStatus || 'potential',
      renderCell: (value) => {
        let color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' = 'default';
        switch(value) {
          case 'booked':
            color = 'primary';
            break;
          case 'blacklisted':
            color = 'error';
            break;
          default:
            color = 'warning';
        }
        return <Chip label={value?.toUpperCase() || 'POTENTIAL'} color={color} size="small" />;
      },
      sortable: true
    },
    {
      field: 'retreatCode',
      headerName: 'Retreat',
      width: 140,
      valueGetter: (row) => {
        const booking = getClientBooking(row);
        return isBookedClient(row) && booking ? getRetreatCode(getBookingRetreat(booking)) : '';
      },
      renderCell: (_, row) => {
        const booking = getClientBooking(row);
        if (!isBookedClient(row) || !booking) return '';
        const retreat = getBookingRetreat(booking);
        const code = getRetreatCode(retreat);
        return code ? <span className="client-retreat-code">{code}</span> : '';
      },
      sortable: true
    },
    {
      field: 'emergencyContact',
      headerName: 'Emergency Contact',
      sortable: true
    },
    {
      field: 'dateOfBirth',
      headerName: 'Year of Birth',
      renderCell: (value) => {
        if (value) {
          return new Date(value).getFullYear().toString();
        }
        return '';
      },
      sortable: true,
      type: 'number'
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 280,
      align: 'center',
      sortable: false,
      renderCell: (_, row) => (
        <div style={{ display: 'flex', gap: '4px' }}>
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleView(row); }} title="View">
            <VisibilityIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleEdit(row); }} title="Edit">
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleGenerateDepositLink(row); }} title="Deposit Link">
            <LinkIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDelete(row._id!); }} color="error" title="Delete">
            <DeleteIcon fontSize="small" />
          </IconButton>
        </div>
      )
    }
  ], [handleView, handleEdit, handleGenerateDepositLink, handleDelete, getClientBooking, getBookingRetreat]);

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

  const fetchBookings = useCallback(async () => {
    try {
      const response = await bookingsApi.getAll();
      setBookings(response.data || []);
    } catch (error: any) {
      console.error('Error fetching bookings:', error);
      setBookings([]);
    }
  }, []);

  // Initial data load
  useEffect(() => {
    fetchClients();
    fetchBookings();
    fetchRetreats();
  }, [fetchClients, fetchBookings, fetchRetreats]);

  // Handle URL parameters for direct navigation to client detail
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const clientId = searchParams.get('id');
    if (clientId) {
      setViewingClientId(clientId);
    } else {
      setViewingClientId(null);
    }
  }, [location.search]);

  // Apply filters to clients data
  const filteredClients = useMemo(() => {
    let result = [...clients];

    // Apply workflow filter
    if (workflowFilter === 'potential') {
      result = result.filter(c => {
        return !c.status || c.status === 'active';
      });
    } else if (workflowFilter === 'blacklisted') {
      result = result.filter(c => {
        return c.notes?.toLowerCase().includes('blacklist');
      });
    } else if (workflowFilter === 'booked') {
      result = result.filter(c => {
        return isBookedClient(c) || Boolean(getClientBooking(c));
      });
    }

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(c =>
        c.firstName?.toLowerCase().includes(term) ||
        c.lastName?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        c.phone?.toLowerCase().includes(term) ||
        c.country?.toLowerCase().includes(term)
      );
    }

    return result;
  }, [clients, workflowFilter, searchTerm, bookings, getClientBooking]);

  const handleAdd = () => {
    setEditingClient(null);
    setFormData({
      status: 'active',
      country: 'US',
      phone: '',
      yearOfBirth: new Date().getFullYear() - 30
    });
    setSelectedRetreatId('');
    setValidationErrors([]);
    setIsModalOpen(true);
    if (retreats.length === 0) {
      fetchRetreats();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'weight' ? parseFloat(value) : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors([]);

    try {
      const cleanData: any = {
        firstName: formData.firstName?.trim(),
        lastName: formData.lastName?.trim(),
        email: formData.email?.trim(),
        phone: formData.phone?.trim() || undefined,
        country: formData.country,
        status: formData.status || 'active',
        weight: formData.weight
      };

      // Add year of birth as a date
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
      let errorMessage = 'An error occurred while saving the client';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }

      if (error.response?.status === 400) {
        if (errorMessage.includes('duplicate') || errorMessage.includes('already exists')) {
          errorMessage = 'A client with this email already exists';
        }
      }

      setValidationErrors([errorMessage]);
    }
  };

  const handleBackFromDetail = () => {
    setViewingClientId(null);
    navigate('/clients', { replace: true });
  };

  // If viewing a client's detail, show the detail view
  if (viewingClientId) {
    return <ClientDetailView clientId={viewingClientId} onBack={handleBackFromDetail} />;
  }

  return (
    <div className="clients-container" style={{ padding: '24px' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '600', color: '#1f2937', margin: 0 }}>👥 Clients Management</h1>
        <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px', marginBottom: '16px' }}>Manage your client database and information</p>

        {/* Toolbar - All Actions in One Line */}
        <div style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          padding: '12px 16px',
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}>
          {/* Search */}
          <div style={{ flex: 1, maxWidth: '300px' }}>
            <input
              type="text"
              placeholder="🔍 Search clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #e5e7eb',
                fontSize: '14px'
              }}
            />
          </div>

          {/* Filter */}
          <select
            value={workflowFilter}
            onChange={(e) => setWorkflowFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #e5e7eb',
              backgroundColor: 'white',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            <option value="all">All Clients</option>
            <option value="potential">Potential Only</option>
            <option value="booked">Booked Only</option>
            <option value="blacklisted">Blacklisted</option>
          </select>

          {/* Spacer */}
          <div style={{ flex: 1 }}></div>

          {/* Action Buttons */}
          <button
            onClick={() => setIsQuickAddOpen(true)}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              backgroundColor: '#fef3c7',
              border: '1px solid #fbbf24',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            ⚡ Quick Add
          </button>

          <button
            onClick={handleAdd}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            ➕ Add New Client
          </button>
        </div>
      </div>

      {apiError && (
        <div style={{ padding: '10px', textAlign: 'center', color: '#d32f2f', backgroundColor: '#ffebee', borderRadius: '4px', margin: '10px 0' }}>
          API Error: Unable to load clients data
        </div>
      )}

      <SimpleTable
        key={refreshKey}
        columns={columns}
        rows={filteredClients}
        onRowClick={handleView}
        loading={isLoading}
        onRefresh={handleRefresh}
        searchable={false}
        pageSize={50}
        pageSizeOptions={[25, 50, 100]}
        stickyHeader={true}
        maxHeight="75vh"
        showToolbar={false}
      />

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
                    <label htmlFor="phone">Phone:</label>
                    <input
                      type="tel"
                      name="phone"
                      placeholder="Full number with country code"
                      value={formData.phone || ''}
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
                      {COUNTRIES_WITH_CODES.map(c => (
                        <option key={c.code} value={c.code}>{c.name}</option>
                      ))}
                    </select>
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
                    <label htmlFor="yearOfBirth">Year of Birth:</label>
                    <input
                      type="number"
                      id="yearOfBirth"
                      name="yearOfBirth"
                      min="1900"
                      max={new Date().getFullYear()}
                      value={formData.yearOfBirth || ''}
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
                      <option value="">Select...</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                      <option value="prefer-not-to-say">Prefer not to say</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="language">Preferred Language:</label>
                    <select
                      id="language"
                      name="language"
                      value={formData.language || 'EN'}
                      onChange={handleInputChange}
                    >
                      <option value="EN">English</option>
                      <option value="CZ">Czech</option>
                      <option value="PL">Polish</option>
                      <option value="RU">Russian</option>
                      <option value="OTHER">Other</option>
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
                      <option value="potential">Potential</option>
                    </select>
                  </div>
                </div>

                <div className="form-section">
                  <h4>Additional Information</h4>
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
                    <label htmlFor="source">How they heard about us:</label>
                    <input
                      type="text"
                      id="source"
                      name="source"
                      value={formData.source || ''}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="weight">Weight (kg):</label>
                    <input
                      type="number"
                      id="weight"
                      name="weight"
                      step="0.1"
                      value={formData.weight || ''}
                      onChange={handleInputChange}
                    />
                  </div>

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
                      rows={3}
                      value={formData.dietaryRestrictions || ''}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="notes">Notes:</label>
                    <textarea
                      id="notes"
                      name="notes"
                      rows={3}
                      value={formData.notes || ''}
                      onChange={handleInputChange}
                    />
                  </div>

                  {!editingClient && (
                    <>
                      <h4>Create Booking (Optional)</h4>
                      <div className="form-group">
                        <label htmlFor="retreatId">Select Retreat:</label>
                        <select
                          id="retreatId"
                          value={selectedRetreatId}
                          onChange={(e) => setSelectedRetreatId(e.target.value)}
                        >
                          <option value="">No Retreat Selected</option>
                          {retreats.map(retreat => (
                            <option key={retreat._id} value={retreat._id}>
                              {retreat.name} - {new Date(retreat.startDate).toLocaleDateString()}
                            </option>
                          ))}
                        </select>
                      </div>

                      {selectedRetreatId && (
                        <>
                          <div className="form-group">
                            <label htmlFor="totalAmount">Custom Price (leave empty for default):</label>
                            <input
                              type="number"
                              id="totalAmount"
                              name="totalAmount"
                              step="0.01"
                              value={formData.totalAmount || ''}
                              onChange={handleInputChange}
                              placeholder="Leave empty for retreat default price"
                            />
                          </div>

                          <div className="form-group">
                            <label htmlFor="currency">Currency:</label>
                            <select
                              id="currency"
                              name="currency"
                              value={formData.currency || 'EUR'}
                              onChange={handleInputChange}
                            >
                              <option value="EUR">EUR</option>
                              <option value="USD">USD</option>
                              <option value="CZK">CZK</option>
                            </select>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>

              {validationErrors.length > 0 && (
                <div className="error-messages">
                  {validationErrors.map((error, index) => (
                    <p key={index} className="error-message">{error}</p>
                  ))}
                </div>
              )}

              <div className="form-actions">
                <button type="button" onClick={() => setIsModalOpen(false)} className="cancel-btn">Cancel</button>
                <button type="submit" className="submit-btn">{editingClient ? 'Update' : 'Add'} Client</button>
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
