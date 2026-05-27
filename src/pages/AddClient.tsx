import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AppleButton from '../components/AppleButton';
import AppleInput from '../components/AppleInput';
import SearchableCountrySelector from '../components/SearchableCountrySelector';
import { clientsApi } from '../services/api';
import { Client } from '../types';
import { useAuth } from '../context/AuthContext';

const AddClient: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [formData, setFormData] = useState<Partial<Client>>({
    workflowStatus: 'potential',
    phoneCountryCode: '+420',
    country: 'CZ'
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Fetch next display ID on mount
  useEffect(() => {
    const fetchNextDisplayId = async () => {
      try {
        const response = await clientsApi.getAll();
        const clients = response.data || [];
        console.log('Fetched clients:', clients.length);

        let maxDisplayId = 1000; // Default starting point

        clients.forEach((client: any) => {
          const displayId = client.display_id || 0;
          const numericId = typeof displayId === 'string' ? parseInt(displayId) : displayId;
          if (numericId && numericId > maxDisplayId) {
            maxDisplayId = numericId;
          }
        });

        const nextId = maxDisplayId + 1;
        console.log('Setting next display_id to:', nextId);

        setFormData(prev => {
          const newData = {
            ...prev,
            display_id: nextId
          };
          console.log('Updated formData with display_id:', newData);
          return newData;
        });
      } catch (err) {
        console.error('Error fetching next display ID:', err);
        // Default to 1001 if error
        setFormData(prev => ({
          ...prev,
          display_id: 1001
        }));
      }
    };

    fetchNextDisplayId();
  }, []);

  const handleSave = async () => {
    console.log('Save button clicked');
    console.log('Form data:', formData);

    if (!formData.firstName || !formData.lastName || !formData.phone) {
      setError('First name, last name, and phone are required');
      return;
    }

    if (formData.loginPin && !/^\d{4,6}$/.test(formData.loginPin)) {
      setError('Client portal PIN must be 4-6 digits');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const dataToSave = {
        ...formData,
        loginPin: formData.loginPin || undefined,
        signupDate: formData.signupDate || new Date()
      };

      console.log('Saving client with data:', dataToSave);
      const response = await clientsApi.create(dataToSave as Omit<Client, '_id'>);
      console.log('Client created successfully:', response);

      // Navigate based on user role
      const rolePrefix = user?.role === 'admin' ? '/admin' :
                        user?.role === 'medical_advisor' ? '/medical' :
                        user?.role === 'provider' ? '/provider' :
                        user?.role === 'facilitator' ? '/facilitator' : '';
      navigate(`${rolePrefix}/clients`);
    } catch (err: any) {
      console.error('Error saving client:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to create client';
      setError(Array.isArray(errorMessage) ? errorMessage.join(', ') : errorMessage);
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Navigate based on user role
    const rolePrefix = user?.role === 'admin' ? '/admin' :
                      user?.role === 'medical_advisor' ? '/medical' :
                      user?.role === 'provider' ? '/provider' :
                      user?.role === 'facilitator' ? '/facilitator' : '';
    navigate(`${rolePrefix}/clients`);
  };

  return (
    <div className="bg-apple-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-apple-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center min-w-0 flex-1">
              <button
                onClick={handleCancel}
                className="mr-4 p-2 hover:bg-apple-gray-100 rounded-apple transition-colors"
              >
                ← Back
              </button>
              <h1 className="text-xl font-semibold text-apple-gray-900 whitespace-nowrap">Add New Client</h1>
            </div>
            <div className="flex items-center space-x-3">
              {/* Cancel button on the left side of actions */}
              <AppleButton variant="secondary" onClick={handleCancel}>
                Cancel
              </AppleButton>
              <AppleButton
                variant="primary"
                onClick={() => {
                  console.log('Button clicked - calling handleSave');
                  handleSave();
                }}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Client'}
              </AppleButton>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-apple text-red-600">
            {error}
          </div>
        )}

        <div className="bg-white rounded-apple border border-apple-gray-200 p-6">
          <div className="space-y-6">
            {/* Basic Information */}
            <div>
              <h2 className="text-lg font-medium text-apple-gray-900 mb-4">Basic Information</h2>
              <div className="space-y-4">
                <AppleInput
                  label="Client ID"
                  value={formData.display_id?.toString() || ''}
                  onChange={(value) => setFormData({ ...formData, display_id: value ? parseInt(value) : undefined })}
                  placeholder="Auto-generated"
                  type="number"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <AppleInput
                    label="First Name *"
                    value={formData.firstName || ''}
                    onChange={(value) => setFormData({ ...formData, firstName: value })}
                    placeholder="Enter first name"
                    required
                  />
                  <AppleInput
                    label="Last Name *"
                    value={formData.lastName || ''}
                    onChange={(value) => setFormData({ ...formData, lastName: value })}
                    placeholder="Enter last name"
                    required
                  />
                </div>

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
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-apple-gray-700 mb-1">Country</label>
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
                  />
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div>
              <h2 className="text-lg font-medium text-apple-gray-900 mb-4">Contact Information</h2>
              <div className="space-y-4">
                <AppleInput
                  label="Email"
                  value={formData.email || ''}
                  onChange={(value) => setFormData({ ...formData, email: value })}
                  placeholder="Enter email address"
                  type="email"
                />

                <div>
                  <label className="block text-sm font-medium text-apple-gray-700 mb-1">Client Portal PIN</label>
                  <input
                    type="text"
                    value="Generated automatically on save"
                    readOnly
                    className="w-full px-3 py-2 border border-apple-gray-200 rounded-apple bg-apple-gray-50 text-apple-gray-500 text-sm"
                  />
                  <p className="mt-1 text-xs text-apple-gray-500">
                    A secure 6-digit PIN is assigned by the server when the client is created.
                  </p>
                </div>

                <AppleInput
                  label="Address"
                  value={formData.address || ''}
                  onChange={(value) => setFormData({ ...formData, address: value })}
                  placeholder="Enter address"
                />
              </div>
            </div>

            {/* Additional Information */}
            <div>
              <h2 className="text-lg font-medium text-apple-gray-900 mb-4">Additional Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-apple-gray-700 mb-1">Gender</label>
                  <select
                    className="w-full px-3 py-2 border border-apple-gray-200 rounded-apple focus:outline-none focus:ring-2 focus:ring-apple-blue/20 bg-white text-sm"
                    value={formData.gender || ''}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value as Client['gender'] })}
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer-not-to-say">Prefer not to say</option>
                  </select>
                </div>
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
          </div>

          {/* Form Actions - Mobile Friendly */}
          <div className="mt-8 pt-6 border-t border-apple-gray-200 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <AppleButton
              variant="secondary"
              onClick={handleCancel}
              className="w-full sm:w-auto"
            >
              Cancel
            </AppleButton>
            <AppleButton
              variant="primary"
              onClick={() => {
                console.log('Bottom button clicked - calling handleSave');
                handleSave();
              }}
              disabled={saving}
              className="w-full sm:w-auto"
            >
              {saving ? 'Saving...' : 'Save Client'}
            </AppleButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddClient;
