import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { clientsApi } from '../services/api';
import { Client } from '../types';
import LoadingSpinner from './LoadingSpinner';
import AppleButton from './AppleButton';
import { FiArrowLeft, FiSave } from 'react-icons/fi';
import './ClientEditModal.css';

// Icon wrapper component for consistent icon rendering
const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

const COUNTRY_CODES = [
  { code: '+1', country: 'US/CA' },
  { code: '+420', country: 'Czech' },
  { code: '+421', country: 'Slovak' },
  { code: '+48', country: 'Poland' },
  { code: '+49', country: 'Germany' },
  { code: '+44', country: 'UK' },
  { code: '+33', country: 'France' },
  { code: '+34', country: 'Spain' },
  { code: '+39', country: 'Italy' },
  { code: '+31', country: 'Netherlands' },
  { code: '+32', country: 'Belgium' },
  { code: '+41', country: 'Switzerland' },
  { code: '+43', country: 'Austria' },
  { code: '+45', country: 'Denmark' },
  { code: '+46', country: 'Sweden' },
  { code: '+47', country: 'Norway' },
  { code: '+358', country: 'Finland' },
  { code: '+351', country: 'Portugal' },
  { code: '+30', country: 'Greece' },
  { code: '+90', country: 'Turkey' },
  { code: '+7', country: 'Russia' },
  { code: '+380', country: 'Ukraine' },
  { code: '+86', country: 'China' },
  { code: '+81', country: 'Japan' },
  { code: '+82', country: 'Korea' },
  { code: '+91', country: 'India' },
  { code: '+61', country: 'Australia' },
  { code: '+64', country: 'NZ' },
  { code: '+27', country: 'S.Africa' },
  { code: '+52', country: 'Mexico' },
  { code: '+55', country: 'Brazil' },
  { code: '+54', country: 'Argentina' },
  { code: '+972', country: 'Israel' },
  { code: '+971', country: 'UAE' }
];

const ClientEditPage: React.FC = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [client, setClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState<Client & {
    countryCode?: string;
    phoneNumber?: string;
    yearOfBirth?: number;
    medications?: string;
    allergies?: string;
    specialRequests?: string;
    language?: 'EN' | 'PL' | 'CZ' | 'ES' | 'FR' | 'DE'
  }>({} as any);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (clientId) {
      fetchClient();
    }
  }, [clientId]);

  const fetchClient = async () => {
    try {
      setIsLoading(true);
      const response = await clientsApi.getOne(clientId!);
      const clientData = response.data;
      setClient(clientData);

      // Parse phone number to extract country code
      let countryCode = '+420'; // Default to Czech Republic
      let phoneNumber = clientData.phone || '';

      // Check if phone starts with a country code
      if (phoneNumber.startsWith('+')) {
        // Try to match against known country codes
        const matchedCode = COUNTRY_CODES.find(cc => phoneNumber.startsWith(cc.code));
        if (matchedCode) {
          countryCode = matchedCode.code;
          phoneNumber = phoneNumber.substring(matchedCode.code.length).trim();
        }
      }

      // Extract year from dateOfBirth if present
      let yearOfBirth;
      if (clientData.dateOfBirth) {
        yearOfBirth = new Date(clientData.dateOfBirth).getFullYear();
      }

      setFormData({
        ...clientData,
        countryCode,
        phoneNumber,
        yearOfBirth
      });
    } catch (error) {
      console.error('Error fetching client:', error);
      setValidationErrors(['Failed to load client data']);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors([]);

    // Validate required fields
    const errors: string[] = [];
    if (!formData.firstName?.trim()) errors.push('First name is required');
    if (!formData.lastName?.trim()) errors.push('Last name is required');
    if (!formData.email?.trim()) errors.push('Email is required');
    if (!formData.phoneNumber?.trim()) errors.push('Phone number is required');
    if (formData.loginPin && !/^\d{4,6}$/.test(formData.loginPin)) {
      errors.push('Client portal PIN must be 4-6 digits');
    }

    // Check if state is required for US customers
    if (formData.country === 'US' && !formData.state?.trim()) {
      errors.push('State is required for US customers');
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setIsSubmitting(true);

    try {
      // Combine country code and phone number
      const fullPhone = `${formData.countryCode}${formData.phoneNumber}`;

      // Prepare client data with proper typing
      const clientData: Partial<Client> = {
        firstName: formData.firstName?.trim(),
        lastName: formData.lastName?.trim(),
        email: formData.email?.trim(),
        loginPin: formData.loginPin?.trim() || undefined,
        phone: fullPhone,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zipCode: formData.zipCode,
        country: formData.country,
        gender: formData.gender,
        emergencyContact: formData.emergencyContact,
        emergencyContactPhone: formData.emergencyContactPhone,
        medicalConditions: formData.medicalConditions,
        dietaryRestrictions: formData.dietaryRestrictions,
        notes: formData.notes,
        status: formData.status as 'active' | 'inactive' | 'suspended' | undefined,
        language: formData.language
      };

      if (!formData.loginPin?.trim()) {
        (clientData as any).loginPin = null;
      }

      // Convert yearOfBirth to dateOfBirth if provided
      if (formData.yearOfBirth) {
        clientData.dateOfBirth = `${formData.yearOfBirth}-01-01`;
      } else if (formData.dateOfBirth) {
        // Ensure dateOfBirth is a string
        clientData.dateOfBirth = typeof formData.dateOfBirth === 'string'
          ? formData.dateOfBirth
          : formData.dateOfBirth.toISOString().split('T')[0];
      }

      // Add optional medical fields if they exist
      if ((formData as any).medications) {
        (clientData as any).medications = (formData as any).medications;
      }
      if ((formData as any).allergies) {
        (clientData as any).allergies = (formData as any).allergies;
      }
      if ((formData as any).specialRequests) {
        (clientData as any).specialRequests = (formData as any).specialRequests;
      }

      // Update the client
      await clientsApi.update(clientId!, clientData);

      // Navigate back to client details page
      navigate(`/admin/clients/${clientId}`);
    } catch (error: any) {
      console.error('Error updating client:', error);
      if (error.response?.data?.message) {
        setValidationErrors([error.response.data.message]);
      } else {
        setValidationErrors(['Failed to update client. Please try again.']);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading client data..." />;
  }

  if (!client) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Client not found
        </div>
        <AppleButton onClick={() => navigate(-1)} className="mt-4">
          <Icon icon={FiArrowLeft} className="w-4 h-4 mr-2" />
          Go Back
        </AppleButton>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center space-x-4 mb-4">
          <AppleButton onClick={() => navigate(`/admin/clients/${clientId}`)} variant="ghost">
            <Icon icon={FiArrowLeft} className="w-4 h-4 mr-2" />
            Back to Client
          </AppleButton>
          <h1 className="text-2xl font-semibold text-gray-900">
            Edit Client: {formData.firstName} {formData.lastName}
          </h1>
        </div>

        {validationErrors.length > 0 && (
          <div className="validation-errors bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {validationErrors.map((error, index) => (
              <p key={index} className="error-message">{error}</p>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-6">
        <div className="form-grid">
          <div className="form-section">
            <h4 className="text-lg font-medium mb-4">Basic Information</h4>
            <div className="form-group">
              <label htmlFor="firstName">First Name *:</label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName || ''}
                onChange={handleInputChange}
                required
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="form-group">
              <label htmlFor="loginPin">Client Portal PIN:</label>
              <input
                type="text"
                id="loginPin"
                name="loginPin"
                value={formData.loginPin || ''}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setFormData(prev => ({
                    ...prev,
                    loginPin: value
                  }));
                }}
                placeholder="4-6 digit login PIN"
                inputMode="numeric"
                maxLength={6}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="yearOfBirth">Year of Birth:</label>
              <input
                type="number"
                id="yearOfBirth"
                name="yearOfBirth"
                value={formData.yearOfBirth || ''}
                onChange={handleInputChange}
                placeholder="YYYY"
                min="1900"
                max={new Date().getFullYear()}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="form-group">
              <label htmlFor="gender">Gender:</label>
              <select
                id="gender"
                name="gender"
                value={formData.gender || ''}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select...</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="language">Preferred Language:</label>
              <select
                id="language"
                name="language"
                value={formData.language || 'EN'}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="EN">English</option>
                <option value="PL">Polish</option>
                <option value="CZ">Czech</option>
                <option value="ES">Spanish</option>
                <option value="FR">French</option>
                <option value="DE">German</option>
              </select>
            </div>
          </div>

          <div className="form-section">
            <h4 className="text-lg font-medium mb-4">Address Information</h4>
            <div className="form-group">
              <label htmlFor="address">Address:</label>
              <input
                type="text"
                id="address"
                name="address"
                value={formData.address || ''}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="form-group">
              <label htmlFor="state">State/Province:</label>
              <input
                type="text"
                id="state"
                name="state"
                value={formData.state || ''}
                onChange={handleInputChange}
                placeholder={formData.country === 'US' ? 'Required for US' : 'Optional'}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="form-group">
              <label htmlFor="zipCode">Zip/Postal Code:</label>
              <input
                type="text"
                id="zipCode"
                name="zipCode"
                value={formData.zipCode || ''}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="form-section">
            <h4 className="text-lg font-medium mb-4">Medical Information</h4>
            <div className="form-group">
              <label htmlFor="medicalConditions">Medical Conditions:</label>
              <textarea
                id="medicalConditions"
                name="medicalConditions"
                value={formData.medicalConditions || ''}
                onChange={handleInputChange}
                rows={3}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="form-group">
              <label htmlFor="medications">Current Medications:</label>
              <textarea
                id="medications"
                name="medications"
                value={formData.medications || ''}
                onChange={handleInputChange}
                rows={3}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="form-group">
              <label htmlFor="dietaryRestrictions">Dietary Restrictions:</label>
              <textarea
                id="dietaryRestrictions"
                name="dietaryRestrictions"
                value={formData.dietaryRestrictions || ''}
                onChange={handleInputChange}
                rows={2}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="form-section">
            <h4 className="text-lg font-medium mb-4">Emergency Contact</h4>
            <div className="form-group">
              <label htmlFor="emergencyContact">Emergency Contact Name:</label>
              <input
                type="text"
                id="emergencyContact"
                name="emergencyContact"
                value={formData.emergencyContact || ''}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="form-section full-width">
            <h4 className="text-lg font-medium mb-4">Additional Information</h4>
            <div className="form-group">
              <label htmlFor="specialRequests">Special Requests:</label>
              <textarea
                id="specialRequests"
                name="specialRequests"
                value={formData.specialRequests || ''}
                onChange={handleInputChange}
                rows={3}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="form-group">
              <label htmlFor="notes">Internal Notes:</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes || ''}
                onChange={handleInputChange}
                rows={3}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="modal-actions flex justify-end gap-3 mt-6 pt-6 border-t">
          <AppleButton
            type="button"
            onClick={() => navigate(`/admin/clients/${clientId}`)}
            variant="ghost"
            disabled={isSubmitting}
          >
            Cancel
          </AppleButton>
          <AppleButton
            type="submit"
            className="apple-button-primary"
            disabled={isSubmitting}
          >
            <Icon icon={FiSave} className="w-4 h-4 mr-2" />
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </AppleButton>
        </div>
      </form>
    </div>
  );
};

export default ClientEditPage;