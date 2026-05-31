import React, { useState, useEffect } from 'react';
import { clientsApi } from '../services/api';
import { Client } from '../types';
import './ClientEditModal.css';

interface ClientEditModalProps {
  client: Client;
  onClose: () => void;
  onSave: (client: Client) => void;
}

const ClientEditModal: React.FC<ClientEditModalProps> = ({ client, onClose, onSave }) => {
  const [formData, setFormData] = useState<Client & { yearOfBirth?: number; medications?: string; allergies?: string; specialRequests?: string; language?: 'EN' | 'PL' | 'CZ' | 'ES' | 'FR' | 'DE' }>({
    ...client
  });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Extract year from dateOfBirth if present
    let yearOfBirth;
    if (client.dateOfBirth) {
      yearOfBirth = new Date(client.dateOfBirth).getFullYear();
    }

    setFormData({
      ...client,
      yearOfBirth
    });
  }, [client]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors([]);

    // Validate required fields
    const errors: string[] = [];
    if (!formData.firstName?.trim()) errors.push('First name is required');
    if (!formData.lastName?.trim()) errors.push('Last name is required');
    if (!formData.email?.trim()) errors.push('Email is required');
    if (!formData.phone?.trim()) errors.push('Phone number is required');
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
      const clientData: Partial<Client> = {
        firstName: formData.firstName?.trim(),
        lastName: formData.lastName?.trim(),
        email: formData.email?.trim(),
        loginPin: normalizeOptionalValue(formData.loginPin),
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
      const response = await clientsApi.update(client._id!, clientData);
      onSave(response.data);
      onClose();
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal large-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Client Information</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {validationErrors.length > 0 && (
          <div className="validation-errors">
            {validationErrors.map((error, index) => (
              <p key={index} className="error-message">{error}</p>
            ))}
          </div>
        )}

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
                  placeholder="Full number with country code"
                  required
                />
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
                  <option value="PL">Polish</option>
                  <option value="CZ">Czech</option>
                  <option value="ES">Spanish</option>
                  <option value="FR">French</option>
                  <option value="DE">German</option>
                </select>
              </div>
            </div>

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
                <label htmlFor="state">State/Province:</label>
                <input
                  type="text"
                  id="state"
                  name="state"
                  value={formData.state || ''}
                  onChange={handleInputChange}
                  placeholder={formData.country === 'US' ? 'Required for US' : 'Optional'}
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
              <h4>Medical Information</h4>
              <div className="form-group">
                <label htmlFor="medicalConditions">Medical Conditions:</label>
                <textarea
                  id="medicalConditions"
                  name="medicalConditions"
                  value={formData.medicalConditions || ''}
                  onChange={handleInputChange}
                  rows={3}
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

              <div className="form-group">
                <label htmlFor="dietaryRestrictions">Dietary Restrictions:</label>
                <textarea
                  id="dietaryRestrictions"
                  name="dietaryRestrictions"
                  value={formData.dietaryRestrictions || ''}
                  onChange={handleInputChange}
                  rows={2}
                />
              </div>
            </div>

            <div className="form-section">
              <h4>Emergency Contact</h4>
              <div className="form-group">
                <label htmlFor="emergencyContact">Emergency Contact Name:</label>
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
            </div>

            <div className="form-section full-width">
              <h4>Additional Information</h4>
              <div className="form-group">
                <label htmlFor="specialRequests">Special Requests:</label>
                <textarea
                  id="specialRequests"
                  name="specialRequests"
                  value={formData.specialRequests || ''}
                  onChange={handleInputChange}
                  rows={3}
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
                />
              </div>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="primary-btn" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClientEditModal;
