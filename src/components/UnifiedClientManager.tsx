import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppleButton from './AppleButton';
import AppleInput from './AppleInput';
import SearchableCountrySelector from './SearchableCountrySelector';
import LoadingSpinner from './LoadingSpinner';
import { clientsApi } from '../services/api';
import { Client } from '../types';
import {
  FiPlus,
  FiSearch,
  FiChevronDown,
  FiMail,
  FiPhone,
  FiEdit2,
  FiUserCheck,
  FiCheck,
  FiX,
  FiTrash2
} from 'react-icons/fi';

// Simple wrapper to fix TypeScript icon issues
const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

const UnifiedClientManager: React.FC = () => {
  const navigate = useNavigate();
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
    phoneCountryCode: '+420',
    address: '',
    country: 'CZ',
    workflowStatus: 'potential',
    signupDate: new Date().toISOString().split('T')[0],
    status: 'active'
  } as Partial<Client>);

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
        client.phone?.toLowerCase().includes(term)
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
        'firstName', 'lastName', 'email', 'phoneCountryCode', 'phone', 'address',
        'city', 'state', 'zipCode', 'country', 'dateOfBirth', 'emergencyContact',
        'emergencyContactPhone', 'medicalConditions', 'dietaryRestrictions', 'status',
        'notes', 'preferredName', 'occupation', 'gender', 'height', 'weight', 'source',
        'display_id', 'signupDate', 'workflowStatus'
      ];

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
        } else {
          acc[key] = value;
        }

        return acc;
      }, {} as any);

      console.log('Cleaned data being sent:', JSON.stringify(cleanData, null, 2));
      console.log('Is update?', !!selectedClient?._id, 'ID:', selectedClient?._id);

      if (selectedClient?._id) {
        console.log('Calling update API...');
        const updateResult = await clientsApi.update(selectedClient._id, cleanData);
        console.log('Update API response:', updateResult);
      } else {
        console.log('Calling create API...');
        const createResult = await clientsApi.quickAdd(cleanData);
        console.log('Create API response:', createResult);
      }
      fetchClients();
      setShowForm(false);
      setSelectedClient(null);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        phoneCountryCode: '+420',
        address: '',
        country: 'CZ',
        workflowStatus: 'potential',
        signupDate: new Date().toISOString().split('T')[0],
        status: 'active'
      } as Partial<Client>);
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

  const handleEdit = (client: Client) => {
    console.log('=== EDIT STARTED ===');
    console.log('Original client:', JSON.stringify(client, null, 2));

    setSelectedClient(client);

    // Extract only the fields we need for the form, excluding MongoDB-specific fields
    const allowedFields = [
      'firstName', 'lastName', 'email', 'phoneCountryCode', 'phone', 'address',
      'city', 'state', 'zipCode', 'country', 'dateOfBirth', 'emergencyContact',
      'emergencyContactPhone', 'medicalConditions', 'dietaryRestrictions', 'status',
      'notes', 'preferredName', 'occupation', 'gender', 'height', 'weight', 'source',
      'display_id', 'signupDate', 'workflowStatus'
    ];

    const cleanFormData = allowedFields.reduce((acc, field) => {
      const clientValue = (client as any)[field];
      if (clientValue !== undefined && clientValue !== null) {
        // Convert dates to proper format for form inputs
        if ((field === 'dateOfBirth' || field === 'signupDate') && clientValue) {
          acc[field] = new Date(clientValue).toISOString().split('T')[0]; // YYYY-MM-DD format for date input
        } else {
          acc[field] = clientValue;
        }
      }
      return acc;
    }, {} as any);

    console.log('Cleaned form data for editing:', JSON.stringify(cleanFormData, null, 2));

    setFormData(cleanFormData);
    setShowForm(true);
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
    // Open the edit form for this client
    handleEdit(client);
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
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    );
  };

  const getSignupDateBadge = (signupDate?: string) => {
    if (!signupDate) return null;

    return (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-600">
        {new Date(signupDate).toLocaleDateString()}
      </span>
    );
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading clients..." />;
  }

  return (
    <div className="p-6 max-w-full">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-apple-gray-900">Clients</h1>
        <AppleButton
          variant="primary"
          onClick={() => {
            setSelectedClient(null);
            setFormData({
              firstName: '',
              lastName: '',
              email: '',
              phone: '',
              phoneCountryCode: '+420',
              address: '',
              country: 'CZ',
              workflowStatus: 'potential',
              signupDate: new Date().toISOString().split('T')[0],
              status: 'active'
            } as Partial<Client>);
            setShowForm(true);
          }}
        >
          <Icon icon={FiPlus} className="w-4 h-4 mr-2" />
          Add New Client
        </AppleButton>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Icon icon={FiSearch} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search clients..."
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
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
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
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center">
                    Name
                    {sortField === 'lastName' &&
                      <Icon icon={FiChevronDown} className={`ml-1 w-4 h-4 transform ${sortDirection === 'asc' ? '' : 'rotate-180'}`} />
                    }
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th
                  onClick={() => handleSort('workflowStatus')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center">
                    Status
                    {sortField === 'workflowStatus' &&
                      <Icon icon={FiChevronDown} className={`ml-1 w-4 h-4 transform ${sortDirection === 'asc' ? '' : 'rotate-180'}`} />
                    }
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Signup Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Country
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredClients.map((client) => (
                <tr key={client._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900">
                      {client.display_id || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <button
                        onClick={() => handleClientClick(client)}
                        style={{ color: '#1f2937', backgroundColor: 'white', border: '1px solid #d1d5db', padding: '4px 8px', borderRadius: '4px' }}
                        className="text-sm font-medium hover:bg-gray-50"
                      >
                        {client.firstName} {client.lastName}
                      </button>
                      {client.preferredName && (
                        <div className="text-xs text-gray-500">
                          Prefers: {client.preferredName}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {client.email && (
                        <div className="flex items-center">
                          <Icon icon={FiMail} className="w-3 h-3 mr-1 text-gray-400" />
                          {client.email}
                        </div>
                      )}
                      <div className="flex items-center">
                        <Icon icon={FiPhone} className="w-3 h-3 mr-1 text-gray-400" />
                        {client.phone}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(client.workflowStatus || 'potential')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getSignupDateBadge(typeof client.signupDate === 'string' ? client.signupDate : client.signupDate?.toISOString().split('T')[0])}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {client.country || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => handleEdit(client)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Edit"
                      >
                        <Icon icon={FiEdit2} className="w-4 h-4" />
                      </button>
                      {client.workflowStatus === 'potential' && (
                        <button
                          onClick={() => handleWorkflowStatusUpdate(client._id!, 'screening')}
                          className="text-yellow-600 hover:text-yellow-900"
                          title="Start Screening"
                        >
                          <Icon icon={FiUserCheck} className="w-4 h-4" />
                        </button>
                      )}
                      {client.workflowStatus === 'screening' && (
                        <>
                          <button
                            onClick={() => handleWorkflowStatusUpdate(client._id!, 'approved')}
                            className="text-green-600 hover:text-green-900"
                            title="Approve"
                          >
                            <Icon icon={FiCheck} className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleWorkflowStatusUpdate(client._id!, 'rejected', 'Not suitable')}
                            className="text-red-600 hover:text-red-900"
                            title="Reject"
                          >
                            <Icon icon={FiX} className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDelete(client._id!)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete"
                      >
                        <Icon icon={FiTrash2} className="w-4 h-4" />
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
          <div className="bg-white rounded-apple border border-apple-gray-200 shadow-xl w-full max-w-2xl max-h-screen overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-apple-gray-900">
                  {selectedClient ? 'Edit Client' : 'Add New Client'}
                </h3>
                <button
                  onClick={() => setShowForm(false)}
                  className="text-apple-gray-400 hover:text-apple-gray-600"
                >
                  <Icon icon={FiX} className="w-5 h-5" />
                </button>
              </div>

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

                <div>
                  <label className="block text-sm font-medium text-apple-gray-700 mb-1">Phone *</label>
                  <div className="flex">
                    <div className="w-48">
                      <SearchableCountrySelector
                        value={formData.phoneCountryCode || '+420'}
                        onChange={(phonePrefix, countryCode) => {
                          setFormData({
                            ...formData,
                            phoneCountryCode: phonePrefix,
                            country: countryCode
                          });
                        }}
                        placeholder="Select country"
                        className="rounded-r-none border-r-0"
                      />
                    </div>
                    <AppleInput
                      value={formData.phone || ''}
                      onChange={(value) => setFormData({ ...formData, phone: value })}
                      placeholder="Enter phone number"
                      className="rounded-l-none border-l-0 flex-1"
                    />
                  </div>
                </div>

                <AppleInput
                  label="Address"
                  value={formData.address || ''}
                  onChange={(value) => setFormData({ ...formData, address: value })}
                  placeholder="Enter address"
                />

                <div>
                  <label className="block text-sm font-medium text-apple-gray-700 mb-1">Country</label>
                  <SearchableCountrySelector
                    value={formData.phoneCountryCode || '+420'}
                    onChange={(phonePrefix, countryCode) => {
                      setFormData({
                        ...formData,
                        country: countryCode
                      });
                    }}
                    placeholder="Select country"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-apple-gray-700 mb-1">Workflow Status</label>
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
                    <label className="block text-sm font-medium text-apple-gray-700 mb-1">Signup Date</label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 border border-apple-gray-200 rounded-apple focus:outline-none focus:ring-2 focus:ring-apple-blue/20 bg-white text-sm"
                      value={typeof formData.signupDate === 'string' ? formData.signupDate : formData.signupDate?.toISOString().split('T')[0] || ''}
                      onChange={(e) => setFormData({ ...formData, signupDate: e.target.value } as Partial<Client>)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <AppleButton variant="primary" onClick={handleSave}>
                  {selectedClient ? 'Update' : 'Create'} Client
                </AppleButton>
                <AppleButton variant="secondary" onClick={() => setShowForm(false)}>
                  Cancel
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