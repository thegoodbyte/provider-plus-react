import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { clientsApi } from '../services/api';
import { Client } from '../types';
import LoadingSpinner from './LoadingSpinner';
import AppleButton from './AppleButton';
import { FiArrowLeft, FiCamera, FiSave, FiUser } from 'react-icons/fi';
import './ClientEditPage.css';

// Icon wrapper component for consistent icon rendering
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
      } catch (cropError) {
        URL.revokeObjectURL(objectUrl);
        reject(cropError);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read this image file.'));
    };

    image.src = objectUrl;
  });
};

const ClientEditPage: React.FC = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = typeof (location.state as any)?.returnTo === 'string' && (location.state as any).returnTo.startsWith('/')
    ? (location.state as any).returnTo
    : null;
  const clientDetailPath = `/admin/clients/${clientId}`;
  const [isLoading, setIsLoading] = useState(true);
  const [client, setClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState<Client & {
    yearOfBirth?: number;
    medications?: string;
    allergies?: string;
    specialRequests?: string;
    language?: 'EN' | 'CZ' | 'PL' | 'RU' | 'OTHER'
  }>({} as any);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [uploadingProfilePicture, setUploadingProfilePicture] = useState(false);

  const getApiErrorMessage = (error: any, fallback: string) => {
    const message = error?.response?.data?.message || error?.response?.data?.error || error?.message;
    return Array.isArray(message) ? message.join(', ') : message || fallback;
  };

  useEffect(() => {
    if (clientId) {
      fetchClient();
    }
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

  const fetchClient = async () => {
    try {
      setIsLoading(true);
      const response = await clientsApi.getOne(clientId!);
      const clientData = response.data;
      setClient(clientData);

      // Extract year from dateOfBirth if present
      let yearOfBirth;
      if (clientData.dateOfBirth) {
        yearOfBirth = new Date(clientData.dateOfBirth).getFullYear();
      }

      setFormData({
        ...clientData,
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

  const normalizeOptionalValue = (value?: string) => {
    const trimmed = typeof value === 'string' ? value.trim() : value;
    return trimmed ? trimmed : undefined;
  };

  const handleProfilePictureUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!clientId || !file) return;
    if (!file.type.startsWith('image/')) {
      setValidationErrors(['Please choose an image file.']);
      return;
    }

    try {
      setUploadingProfilePicture(true);
      setValidationErrors([]);
      const croppedFile = await cropImageToProfileSquare(file, 200);
      const response = await clientsApi.uploadProfilePicture(clientId, croppedFile);
      setClient(response.data.client);
      setFormData((current) => ({ ...current, ...response.data.client }));
    } catch (error: any) {
      console.error('Error uploading profile picture:', error);
      setValidationErrors([error?.response?.data?.message || error?.message || 'Failed to upload profile picture.']);
    } finally {
      setUploadingProfilePicture(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors([]);

    // Validate required fields
    const errors: string[] = [];
    if (!formData.firstName?.trim()) errors.push('First name is required');
    if (!formData.lastName?.trim()) errors.push('Last name is required');
    if (!formData.phone?.trim()) errors.push('Phone number is required');
    if (formData.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.push('Email must be a valid email address or left blank');
    }
    const displayIdValue = formData.display_id as unknown;
    if (displayIdValue !== undefined && displayIdValue !== null && Number.isNaN(Number(displayIdValue))) {
      errors.push('Client ID must be a number');
    }
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
      // Prepare client data with proper typing
      const displayIdValue = formData.display_id as unknown;
      const clientData: Partial<Client> = {
        display_id: displayIdValue !== undefined && displayIdValue !== null && displayIdValue !== '' ? Number(displayIdValue) : undefined,
        firstName: formData.firstName?.trim(),
        lastName: formData.lastName?.trim(),
        email: formData.email?.trim() || undefined,
        // loginPin: normalizeOptionalValue(formData.loginPin), // Commented out - may be causing API error
        phone: formData.phone?.trim(),
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zipCode: formData.zipCode,
        country: formData.country,
        gender: normalizeOptionalValue(formData.gender) as Client['gender'],
        emergencyContact: formData.emergencyContact,
        emergencyContactPhone: formData.emergencyContactPhone,
        medicalConditions: formData.medicalConditions,
        dietaryRestrictions: formData.dietaryRestrictions,
        notes: formData.notes,
        status: normalizeOptionalValue(formData.status) as 'active' | 'inactive' | 'suspended' | undefined,
        language: normalizeOptionalValue(formData.language) as Client['language']
      };

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

      navigate(returnTo || clientDetailPath);
    } catch (error: any) {
      console.error('Error updating client:', error);
      setValidationErrors([getApiErrorMessage(error, 'Failed to update client. Please try again.')]);
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
    <div className="client-edit-page min-h-screen bg-white">
      <div className="w-full">
      <div className="mb-6 px-4 py-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-start">
          <AppleButton onClick={() => navigate(returnTo || clientDetailPath)} variant="ghost">
            <Icon icon={FiArrowLeft} className="w-4 h-4 mr-2" />
            {returnTo ? 'Back to Booking' : 'Back to Client'}
          </AppleButton>
        </div>

        <div className="w-full">
          <h1 className="text-2xl font-semibold text-slate-950">
            Edit Client: {formData.firstName} {formData.lastName}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-medium text-slate-700">
              Client ID: {formData.display_id || client.display_id || 'N/A'}
            </span>
            <span>Client ID is editable below and must remain unique.</span>
          </div>
        </div>

        {validationErrors.length > 0 && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            {validationErrors.map((error, index) => (
              <p key={index} className="text-sm">{error}</p>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="px-4">
        <aside className="mb-6">
          <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative h-24 w-24 overflow-hidden rounded-full border border-gray-200 bg-gray-50">
            {profilePictureUrl ? (
              <img src={profilePictureUrl} alt={`${formData.firstName || ''} ${formData.lastName || ''}`} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-gray-400">
                <Icon icon={FiUser} className="h-10 w-10" />
              </div>
            )}
            <label className="absolute inset-x-0 bottom-0 flex cursor-pointer items-center justify-center gap-2 bg-black/55 px-3 py-3 text-sm font-medium text-white transition hover:bg-black/70">
              <Icon icon={FiCamera} className="h-4 w-4" />
              {uploadingProfilePicture ? 'Uploading...' : 'Upload Photo'}
              <input type="file" accept="image/*" onChange={handleProfilePictureUpload} className="hidden" disabled={uploadingProfilePicture || isSubmitting} />
            </label>
          </div>
          <div className="flex-1">
            <div className="text-base font-semibold text-gray-900">{formData.firstName} {formData.lastName}</div>
            <p className="mt-1 text-sm text-gray-500">Upload profile photo</p>
          </div>
          </div>
        </aside>
        <div className="space-y-6">
          <section>
            <h4 className="mb-4 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900">Basic Information</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-full">
              <label htmlFor="display_id" className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
              <input
                type="number"
                id="display_id"
                name="display_id"
                value={formData.display_id ?? ''}
                onChange={handleInputChange}
                placeholder="Client ID"
                min="1001"
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
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

            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
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

            <div className="col-span-full">
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone || ''}
                onChange={handleInputChange}
                placeholder="Full number with country code"
                required
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">Country</label>
              <input
                type="text"
                id="country"
                name="country"
                value={formData.country || ''}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="col-span-full">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email || ''}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="loginPin" className="block text-sm font-medium text-gray-700 mb-1">Client Portal PIN</label>
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

            <div>
              <label htmlFor="yearOfBirth" className="block text-sm font-medium text-gray-700 mb-1">Year of Birth</label>
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

            <div>
              <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
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
                <option value="prefer-not-to-say">Prefer not to say</option>
              </select>
            </div>

            <div>
              <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-1">Preferred Language</label>
              <select
                id="language"
                name="language"
                value={formData.language || 'EN'}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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

          <section>
            <h4 className="mb-4 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900">Address Information</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-full">
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input
                type="text"
                id="address"
                name="address"
                value={formData.address || ''}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                id="city"
                name="city"
                value={formData.city || ''}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">State/Province</label>
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

            <div>
              <label htmlFor="zipCode" className="block text-sm font-medium text-gray-700 mb-1">Zip/Postal Code</label>
              <input
                type="text"
                id="zipCode"
                name="zipCode"
                value={formData.zipCode || ''}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            </div>
          </section>

          <section>
            <h4 className="mb-4 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900">Medical Information</h4>
            <div className="space-y-4">
            <div>
              <label htmlFor="medicalConditions" className="block text-sm font-medium text-gray-700 mb-1">Medical Conditions</label>
              <textarea
                id="medicalConditions"
                name="medicalConditions"
                value={formData.medicalConditions || ''}
                onChange={handleInputChange}
                rows={3}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="medications" className="block text-sm font-medium text-gray-700 mb-1">Current Medications</label>
              <textarea
                id="medications"
                name="medications"
                value={formData.medications || ''}
                onChange={handleInputChange}
                rows={3}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="allergies" className="block text-sm font-medium text-gray-700 mb-1">Allergies</label>
              <textarea
                id="allergies"
                name="allergies"
                value={formData.allergies || ''}
                onChange={handleInputChange}
                rows={2}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="dietaryRestrictions" className="block text-sm font-medium text-gray-700 mb-1">Dietary Restrictions</label>
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
          </section>

          <section>
            <h4 className="mb-4 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900">Emergency Contact</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="emergencyContact" className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact Name</label>
              <input
                type="text"
                id="emergencyContact"
                name="emergencyContact"
                value={formData.emergencyContact || ''}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="emergencyContactPhone" className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact Phone</label>
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
          </section>

          <section>
            <h4 className="mb-4 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900">Additional Information</h4>
            <div className="space-y-4">
            <div>
              <label htmlFor="specialRequests" className="block text-sm font-medium text-gray-700 mb-1">Special Requests</label>
              <textarea
                id="specialRequests"
                name="specialRequests"
                value={formData.specialRequests || ''}
                onChange={handleInputChange}
                rows={3}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">Internal Notes</label>
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
          </section>
        </div>

        <div className="flex justify-end gap-3 mt-8 py-4 border-t border-gray-200">
          <AppleButton
            type="button"
            onClick={() => navigate(returnTo || clientDetailPath)}
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
    </div>
  );
};

export default ClientEditPage;
