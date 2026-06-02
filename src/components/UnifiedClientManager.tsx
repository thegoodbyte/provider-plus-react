import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppleButton from './AppleButton';
import AppleInput from './AppleInput';
import LoadingSpinner from './LoadingSpinner';
import { clientsApi } from '../services/api';
import { Client } from '../types';
import {
  FiPlus,
  FiSearch,
  FiChevronDown,
  FiEdit2,
  FiUserCheck,
  FiCheck,
  FiX,
  FiTrash2,
  FiCamera,
  FiUser
} from 'react-icons/fi';

// Simple wrapper to fix TypeScript icon issues
const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

const cropImageToProfileSquare = (file: File, size = 200): Promise<File> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Image editor is not available in this browser.');

        const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
        const sourceX = (image.naturalWidth - sourceSize) / 2;
        const sourceY = (image.naturalHeight - sourceSize) / 2;
        context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);

        canvas.toBlob((blob) => {
          URL.revokeObjectURL(objectUrl);
          if (!blob) {
            reject(new Error('Could not prepare profile picture.'));
            return;
          }
          const baseName = file.name.replace(/\.[^/.]+$/, '').trim() || 'profile-picture';
          resolve(new File([blob], `${baseName}-profile.jpg`, { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.9);
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(error);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read this image file.'));
    };

    image.src = objectUrl;
  });
};

const UnifiedClientManager: React.FC = () => {
  const navigate = useNavigate();
  const validClientStatuses = ['active', 'inactive', 'suspended'] as const;
  const isValidClientStatus = (value: unknown): value is Client['status'] =>
    typeof value === 'string' && validClientStatuses.includes(value as any);
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortField, setSortField] = useState<keyof Client>('lastName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState<Partial<Client>>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    country: 'CZ',
    language: 'EN',
    workflowStatus: 'potential',
    signupDate: new Date().toISOString().split('T')[0],
    status: 'active'
  } as Partial<Client>);
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);
  const [profilePicturePreviewUrl, setProfilePicturePreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (profilePicturePreviewUrl) URL.revokeObjectURL(profilePicturePreviewUrl);
    };
  }, [profilePicturePreviewUrl]);

  useEffect(() => {
    let active = true;
    let objectUrl = '';

    const loadProfilePicture = async () => {
      if (!showForm || !selectedClient?._id || !selectedClient.profilePictureS3Key || profilePictureFile) {
        if (!profilePictureFile) setProfilePicturePreviewUrl(null);
        return;
      }

      try {
        const response = await clientsApi.getProfilePictureBlob(selectedClient._id);
        objectUrl = URL.createObjectURL(response.data as Blob);
        if (active) setProfilePicturePreviewUrl(objectUrl);
      } catch (error) {
        console.error('Error loading profile picture:', error);
        if (active) setProfilePicturePreviewUrl(null);
      }
    };

    loadProfilePicture();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [showForm, selectedClient?._id, selectedClient?.profilePictureS3Key, profilePictureFile]);

  const resetForm = () => {
    setSelectedClient(null);
    setProfilePictureFile(null);
    if (profilePicturePreviewUrl) URL.revokeObjectURL(profilePicturePreviewUrl);
    setProfilePicturePreviewUrl(null);
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      address: '',
      country: 'CZ',
      language: 'EN',
      workflowStatus: 'potential',
      signupDate: new Date().toISOString().split('T')[0],
      status: 'active'
    } as Partial<Client>);
  };

  // Fetch clients
  const fetchClients = async () => {
    setIsLoading(true);
    try {
      const response = await clientsApi.getAll();
      setClients(response.data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  // Filter and search clients
  useEffect(() => {
    let filtered = [...clients];

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(client => client.workflowStatus === filterStatus);
    }

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(client =>
        client.firstName?.toLowerCase().includes(term) ||
        client.lastName?.toLowerCase().includes(term) ||
        client.email?.toLowerCase().includes(term) ||
        client.phone?.toLowerCase().includes(term) ||
        client.display_id?.toString().includes(term)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      const aVal = a[sortField] || '';
      const bVal = b[sortField] || '';
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    setFilteredClients(filtered);
  }, [clients, filterStatus, searchTerm, sortField, sortDirection]);

  const handleSave = async () => {
    console.log('=== SAVE STARTED ===');
    console.log('Original formData:', JSON.stringify(formData, null, 2));

    if (!formData.firstName?.trim() || !formData.lastName?.trim() || !formData.phone?.trim()) {
      alert('First name, last name, and phone are required');
      return;
    }

    try {
      // Define allowed fields for client creation/update
      const allowedFields = [
        'firstName', 'lastName', 'email', 'loginPin', 'phone', 'address',
        'city', 'state', 'zipCode', 'country', 'dateOfBirth', 'emergencyContact',
        'emergencyContactPhone', 'medicalConditions', 'dietaryRestrictions', 'status',
        'notes', 'preferredName', 'occupation', 'gender', 'height', 'weight', 'source',
        'display_id', 'signupDate', 'workflowStatus', 'language'
      ];

      if (formData.loginPin && !/^\d{4,6}$/.test(formData.loginPin)) {
        alert('Client portal PIN must be 4-6 digits');
        return;
      }

      // Clean up data - only include allowed fields and handle types properly
      const cleanData = Object.entries(formData).reduce((acc, [key, value]) => {
        // Skip if not an allowed field
        if (!allowedFields.includes(key)) return acc;

        // Skip empty strings, null, or undefined
        if (value === '' || value === null || value === undefined) return acc;

        // Handle type conversions
        if (key === 'weight' && value) {
          acc[key] = typeof value === 'string' ? parseFloat(value) : value;
        } else if (key === 'display_id' && value) {
          acc[key] = typeof value === 'string' ? parseInt(value) : value;
        } else if ((key === 'dateOfBirth' || key === 'signupDate') && value) {
          // Ensure date is properly formatted for backend
          if (typeof value === 'string') {
            acc[key] = value;
          } else if (value instanceof Date) {
            acc[key] = value.toISOString().split('T')[0];
          } else {
            acc[key] = new Date(value as string | number).toISOString().split('T')[0];
          }
        } else if (key === 'status') {
          if (isValidClientStatus(value)) {
            acc[key] = value;
          }
        } else {
          acc[key] = value;
        }

        return acc;
      }, {} as any);

      if (selectedClient?._id && !formData.loginPin?.trim()) {
        cleanData.loginPin = null;
      }

      console.log('Cleaned data being sent:', JSON.stringify(cleanData, null, 2));
      console.log('Is update?', !!selectedClient?._id, 'ID:', selectedClient?._id);

      if (selectedClient?._id) {
        console.log('Calling update API...');
        const updateResult = await clientsApi.update(selectedClient._id, cleanData);
        console.log('Update API response:', updateResult);
        if (profilePictureFile) {
          await clientsApi.uploadProfilePicture(selectedClient._id, profilePictureFile);
        }
      } else {
        console.log('Calling create API...');
        const createResult = await clientsApi.quickAdd(cleanData);
        console.log('Create API response:', createResult);
        const createdClientId = (createResult.data as Client)?._id;
        if (profilePictureFile && createdClientId) {
          await clientsApi.uploadProfilePicture(createdClientId, profilePictureFile);
        }
      }
      fetchClients();
      setShowForm(false);
      resetForm();
    } catch (error: any) {
      console.error('=== SAVE ERROR ===');
      console.error('Error object:', error);
      console.error('Error response data:', error?.response?.data);
      console.error('Error response status:', error?.response?.status);
      console.error('Error message:', error?.message);

      const errorMessage = error?.response?.data?.message || error?.message || 'Unknown error';
      alert(`Failed to save client: ${errorMessage}\n\nCheck console for details.`);
    }
  };

  const handleWorkflowStatusUpdate = async (clientId: string, status: string, reason?: string) => {
    try {
      await clientsApi.updateWorkflowStatus(clientId, status, reason);
      fetchClients();
    } catch (error) {
      console.error('Error updating workflow status:', error);
      alert('Error updating status. Please try again.');
    }
  };

  const buildClientFormData = (client: Client): Partial<Client> => {
    const allowedFields = [
      'firstName', 'lastName', 'email', 'loginPin', 'phone', 'address',
      'city', 'state', 'zipCode', 'country', 'dateOfBirth', 'emergencyContact',
      'emergencyContactPhone', 'medicalConditions', 'dietaryRestrictions', 'status',
      'notes', 'preferredName', 'occupation', 'gender', 'height', 'weight', 'source',
      'display_id', 'signupDate', 'workflowStatus', 'language'
    ];

    return allowedFields.reduce((acc, field) => {
      const clientValue = (client as any)[field];
      if (clientValue !== undefined && clientValue !== null) {
        if ((field === 'dateOfBirth' || field === 'signupDate') && clientValue) {
          const date = new Date(clientValue);
          if (!Number.isNaN(date.getTime())) {
            (acc as any)[field] = date.toISOString().split('T')[0];
          }
        } else if (field === 'status') {
          if (isValidClientStatus(clientValue)) {
            (acc as any)[field] = clientValue;
          }
        } else {
          (acc as any)[field] = clientValue;
        }
      }
      return acc;
    }, {} as Partial<Client>);
  };

  const handleEdit = (client: Client) => {
    try {
      const cleanFormData = buildClientFormData(client);
      setSelectedClient(client);
      setFormData(cleanFormData);
      setProfilePictureFile(null);
      setShowForm(true);
    } catch (error) {
      console.error('Error opening client editor:', error);
      alert('Could not open the client editor. Check the console for details.');
    }
  };

  const handleDelete = async (clientId: string) => {
    if (window.confirm('Are you sure you want to delete this client?')) {
      try {
        await clientsApi.delete(clientId);
        fetchClients();
      } catch (error) {
        console.error('Error deleting client:', error);
        alert('Error deleting client. Please try again.');
      }
    }
  };

  const handleClientClick = (client: Client) => {
    // Navigate to the client details page
    navigate(`/clients/${client._id}`);
  };

  const handleNewClient = () => {
    resetForm();
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    resetForm();
  };

  const handleProfilePictureSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please choose an image file.');
      return;
    }

    try {
      const croppedFile = await cropImageToProfileSquare(file, 200);
      if (profilePicturePreviewUrl) URL.revokeObjectURL(profilePicturePreviewUrl);
      setProfilePictureFile(croppedFile);
      setProfilePicturePreviewUrl(URL.createObjectURL(croppedFile));
    } catch (error: any) {
      console.error('Error preparing profile picture:', error);
      alert(error?.message || 'Could not prepare profile picture.');
    }
  };

  const handleSort = (field: keyof Client) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusColors: { [key: string]: string } = {
      potential: 'bg-blue-100 text-blue-800',
      screening: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      booked: 'bg-purple-100 text-purple-800',
      completed: 'bg-gray-100 text-gray-800',
      blacklisted: 'bg-black text-white'
    };

    return (
      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    );
  };

  const getSignupDateBadge = (signupDate?: string) => {
    if (!signupDate) return null;

    return (
      <span className="text-xs text-gray-600">
        {new Date(signupDate).toLocaleDateString()}
      </span>
    );
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading clients..." />;
  }

  return (
    <div className="p-3 max-w-full">
      {/* Header */}
      <div className="mb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h1 className="text-2xl font-bold text-apple-gray-900">Clients</h1>
        <AppleButton
          variant="primary"
          onClick={handleNewClient}
          className="w-auto shrink-0 whitespace-nowrap"
        >
          <Icon icon={FiPlus} className="w-4 h-4 mr-2" />
          Add Client
        </AppleButton>
      </div>

      {/* Filters */}
      <div className="mb-3 flex flex-col sm:flex-row gap-2">
        <div className="flex-1">
          <div className="relative">
            <Icon icon={FiSearch} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search clients, email, phone, or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-apple focus:outline-none focus:ring-2 focus:ring-apple-blue/20 focus:border-apple-blue"
            />
          </div>
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-apple focus:outline-none focus:ring-2 focus:ring-apple-blue/20 focus:border-apple-blue"
        >
          <option value="all">All Statuses</option>
          <option value="potential">Potential</option>
          <option value="screening">Screening</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="booked">Booked</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-apple border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  onClick={() => handleSort('display_id')}
                  className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center">
                    ID
                    {sortField === 'display_id' &&
                      <Icon icon={FiChevronDown} className={`ml-1 w-4 h-4 transform ${sortDirection === 'asc' ? '' : 'rotate-180'}`} />
                    }
                  </div>
                </th>
                <th
                  onClick={() => handleSort('lastName')}
                  className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center">
                    Name
                    {sortField === 'lastName' &&
                      <Icon icon={FiChevronDown} className={`ml-1 w-4 h-4 transform ${sortDirection === 'asc' ? '' : 'rotate-180'}`} />
                    }
                  </div>
                </th>
                <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th
                  onClick={() => handleSort('workflowStatus')}
                  className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center">
                    Status
                    {sortField === 'workflowStatus' &&
                      <Icon icon={FiChevronDown} className={`ml-1 w-4 h-4 transform ${sortDirection === 'asc' ? '' : 'rotate-180'}`} />
                    }
                  </div>
                </th>
                <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Signup Date
                </th>
                <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Country
                </th>
                <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredClients.map((client) => (
                <tr key={client._id} className="hover:bg-gray-50">
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900">
                      {client.display_id || '-'}
                    </div>
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    <div>
                      <button
                        onClick={() => handleClientClick(client)}
                        className="text-sm font-medium text-gray-900 hover:text-blue-600"
                      >
                        {client.firstName} {client.lastName}
                      </button>
                      {client.preferredName && (
                        <span className="text-xs text-gray-400 ml-1">
                          ({client.preferredName})
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    <div className="text-xs text-gray-700">
                      {client.email && (
                        <div>{client.email}</div>
                      )}
                      <div>{client.phone}</div>
                    </div>
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    {getStatusBadge(client.workflowStatus || 'potential')}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    {getSignupDateBadge(typeof client.signupDate === 'string' ? client.signupDate : client.signupDate?.toISOString().split('T')[0])}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-sm text-gray-500">
                    {client.country || '-'}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        type="button"
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          handleEdit(client);
                        }}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-blue-700 hover:bg-blue-50 hover:text-blue-900"
                        title="Edit"
                      >
                        <Icon icon={FiEdit2} className="w-3.5 h-3.5" />
                        <span className="text-xs">Edit</span>
                      </button>
                      {client.workflowStatus === 'potential' && (
                        <button
                          onClick={() => handleWorkflowStatusUpdate(client._id!, 'screening')}
                          className="text-yellow-600 hover:text-yellow-900"
                          title="Start Screening"
                        >
                          <Icon icon={FiUserCheck} className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {client.workflowStatus === 'screening' && (
                        <>
                          <button
                            onClick={() => handleWorkflowStatusUpdate(client._id!, 'approved')}
                            className="text-green-600 hover:text-green-900"
                            title="Approve"
                          >
                            <Icon icon={FiCheck} className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleWorkflowStatusUpdate(client._id!, 'rejected', 'Not suitable')}
                            className="text-red-600 hover:text-red-900"
                            title="Reject"
                          >
                            <Icon icon={FiX} className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDelete(client._id!)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete"
                      >
                        <Icon icon={FiTrash2} className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No clients found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="w-full max-w-6xl max-h-[92vh] overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
                <h3 className="text-lg font-semibold text-slate-950">
                  {selectedClient ? 'Edit Client' : 'Add New Client'}
                </h3>
                <button
                  onClick={handleCloseForm}
                  className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <Icon icon={FiX} className="w-5 h-5" />
                </button>
            </div>

            <div className="max-h-[calc(92vh-73px)] overflow-y-auto p-5">
              <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
                <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-0 lg:self-start">
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative h-36 w-36 overflow-hidden rounded-full border border-slate-200 bg-slate-50 shadow-sm">
                      {profilePicturePreviewUrl ? (
                        <img src={profilePicturePreviewUrl} alt="Client profile preview" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-400">
                          <Icon icon={FiUser} className="h-12 w-12" />
                        </div>
                      )}
                      <label className="absolute inset-x-0 bottom-0 flex cursor-pointer items-center justify-center gap-2 bg-black/60 px-3 py-2 text-xs font-semibold text-white hover:bg-black/75">
                        <Icon icon={FiCamera} className="h-3.5 w-3.5" />
                        Upload
                        <input type="file" accept="image/*" onChange={handleProfilePictureSelect} className="hidden" />
                      </label>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-semibold text-slate-900">{formData.firstName || 'New'} {formData.lastName || 'Client'}</div>
                      <p className="mt-1 text-xs text-slate-500">Profile images are center-cropped to 200 x 200.</p>
                    </div>
                  </div>
                </aside>

                <div className="grid gap-5 lg:grid-cols-2">
                  <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <h4 className="mb-4 border-b border-slate-200 pb-3 text-base font-semibold text-slate-900">Basic Information</h4>
                    <div className="space-y-4">
                      <AppleInput
                        label="Client ID"
                        value={formData.display_id?.toString() || ''}
                        onChange={(value) => setFormData({ ...formData, display_id: value ? parseInt(value) : undefined })}
                        placeholder="Auto-generated if empty (min 1001)"
                        type="number"
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <AppleInput
                          label="First Name *"
                          value={formData.firstName || ''}
                          onChange={(value) => setFormData({ ...formData, firstName: value })}
                          placeholder="Enter first name"
                        />
                        <AppleInput
                          label="Last Name *"
                          value={formData.lastName || ''}
                          onChange={(value) => setFormData({ ...formData, lastName: value })}
                          placeholder="Enter last name"
                        />
                      </div>

                      <AppleInput
                        label="Email"
                        value={formData.email || ''}
                        onChange={(value) => setFormData({ ...formData, email: value })}
                        placeholder="Enter email address"
                        type="email"
                      />

                      <AppleInput
                        label="Client Portal PIN"
                        value={formData.loginPin || ''}
                        onChange={(value) => setFormData({
                          ...formData,
                          loginPin: value.replace(/\D/g, '').slice(0, 6)
                        })}
                        placeholder="4-6 digit login PIN"
                        type="text"
                      />

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Phone *</label>
                        <AppleInput
                          value={formData.phone || ''}
                          onChange={(value) => setFormData({ ...formData, phone: value })}
                          placeholder="Enter full number with country code"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Preferred Language</label>
                        <select
                          className="w-full px-3 py-2 border border-apple-gray-200 rounded-apple focus:outline-none focus:ring-2 focus:ring-apple-blue/20 bg-white text-sm"
                          value={formData.language || 'EN'}
                          onChange={(e) => setFormData({ ...formData, language: e.target.value as Client['language'] })}
                        >
                          <option value="EN">English</option>
                          <option value="CZ">Czech</option>
                          <option value="PL">Polish</option>
                          <option value="RU">Russian</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <h4 className="mb-4 border-b border-slate-200 pb-3 text-base font-semibold text-slate-900">Address and Status</h4>
                    <div className="space-y-4">
                      <AppleInput
                        label="Address"
                        value={formData.address || ''}
                        onChange={(value) => setFormData({ ...formData, address: value })}
                        placeholder="Enter address"
                      />

                      <AppleInput
                        label="Country"
                        value={formData.country || ''}
                        onChange={(value) => setFormData({ ...formData, country: value })}
                        placeholder="Enter country"
                      />

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Workflow Status</label>
                    <select
                      className="w-full px-3 py-2 border border-apple-gray-200 rounded-apple focus:outline-none focus:ring-2 focus:ring-apple-blue/20 bg-white text-sm"
                      value={formData.workflowStatus || 'potential'}
                      onChange={(e) => setFormData({ ...formData, workflowStatus: e.target.value as any })}
                    >
                      <option value="potential">Potential</option>
                      <option value="screening">Screening</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="booked">Booked</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Signup Date</label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 border border-apple-gray-200 rounded-apple focus:outline-none focus:ring-2 focus:ring-apple-blue/20 bg-white text-sm"
                      value={typeof formData.signupDate === 'string' ? formData.signupDate : formData.signupDate?.toISOString().split('T')[0] || ''}
                      onChange={(e) => setFormData({ ...formData, signupDate: e.target.value } as Partial<Client>)}
                    />
                  </div>
                    </div>
                  </section>
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <AppleButton variant="secondary" onClick={handleCloseForm}>
                  Cancel
                </AppleButton>
                <AppleButton variant="primary" onClick={handleSave}>
                  {selectedClient ? 'Update' : 'Create'} Client
                </AppleButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnifiedClientManager;
