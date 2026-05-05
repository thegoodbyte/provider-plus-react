import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { clientMedicationsApi, ClientMedication, CreateClientMedicationDto, UpdateClientMedicationDto } from '../services/clientMedicationsApi';
import { clientsApi, Client } from '../services/api';
import AppleButton from './AppleButton';
import { FiArrowLeft, FiUpload, FiFileText, FiSave, FiX } from 'react-icons/fi';

// Icon wrapper to fix TypeScript issues
const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

interface ClientMedicationFormProps {
  mode: 'create' | 'edit' | 'view';
}

const ClientMedicationForm: React.FC<ClientMedicationFormProps> = ({ mode }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [formData, setFormData] = useState<Partial<ClientMedication>>({
    client_id: '',
    date_collected: new Date(),
    admin_notes: '',
    medstaff_review_notes: '',
  });

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const isReadOnly = mode === 'view';
  const isEditing = mode === 'edit' && id;
  const isCreating = mode === 'create';

  useEffect(() => {
    fetchClients();
    if (id && (mode === 'edit' || mode === 'view')) {
      fetchMedicationData();
    }
  }, [id, mode]);

  const fetchClients = async () => {
    try {
      const response = await clientsApi.getAll();
      setClients(response.data);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const fetchMedicationData = async () => {
    if (!id) return;

    try {
      setIsLoading(true);
      const response = await clientMedicationsApi.getOne(id);
      setFormData(response.data);
    } catch (error) {
      console.error('Error fetching medication data:', error);
      alert('Error loading medication data. Please try again.');
      navigate('/admin/client-medications');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'date_collected' ? new Date(value) : value
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        alert('Please select a PDF file.');
        return;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        alert('File size must be less than 10MB.');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      let medicationId = id;

      if (isCreating) {
        const createData: CreateClientMedicationDto = {
          client_id: formData.client_id!,
          date_collected: formData.date_collected!,
          admin_notes: formData.admin_notes || '',
          medstaff_review_notes: formData.medstaff_review_notes || '',
        };

        const response = await clientMedicationsApi.create(createData);
        medicationId = response.data._id;
      } else if (isEditing) {
        const updateData: UpdateClientMedicationDto = {
          client_id: formData.client_id,
          date_collected: formData.date_collected,
          admin_notes: formData.admin_notes,
          medstaff_review_notes: formData.medstaff_review_notes,
        };

        await clientMedicationsApi.update(id!, updateData);
      }

      // Upload PDF if selected
      if (selectedFile && medicationId) {
        setUploadProgress(10);
        await clientMedicationsApi.uploadPdf(medicationId, selectedFile);
        setUploadProgress(100);
      }

      alert(`Medication record ${isCreating ? 'created' : 'updated'} successfully!`);
      navigate('/admin/client-medications');
    } catch (error) {
      console.error('Error saving medication:', error);
      alert('Error saving medication record. Please try again.');
    } finally {
      setIsSaving(false);
      setUploadProgress(0);
    }
  };

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c._id === clientId);
    return client ? `${client.firstName} ${client.lastName}` : 'Select Client';
  };

  const getClientDisplayId = (clientId: string) => {
    const client = clients.find(c => c._id === clientId);
    return client?.display_id ? `#${client.display_id}` : '';
  };

  const handleClientClick = () => {
    if (formData.client_id) {
      navigate(`/admin/clients?id=${formData.client_id}`);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading medication data...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/client-medications')}
            className="text-gray-600 hover:text-gray-900 flex items-center gap-2"
          >
            <Icon icon={FiArrowLeft} className="w-5 h-5" />
            Back to Medications
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isCreating ? 'Create' : isReadOnly ? 'View' : 'Edit'} Medication Record
              {formData.display_id && ` #${formData.display_id}`}
            </h1>
            {formData.createdAt && (
              <p className="text-gray-600 text-sm mt-1">
                Created: {new Date(formData.createdAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Main Information */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold mb-4">Medication Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Client Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Client *
                </label>
                {isReadOnly && formData.client_id ? (
                  <button
                    type="button"
                    onClick={handleClientClick}
                    className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                  >
                    {getClientName(formData.client_id)}
                    <span className="text-gray-500 text-sm ml-1">
                      {getClientDisplayId(formData.client_id)}
                    </span>
                  </button>
                ) : (
                  <select
                    name="client_id"
                    value={formData.client_id}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isReadOnly}
                  >
                    <option value="">Select Client</option>
                    {clients.map(client => (
                      <option key={client._id} value={client._id}>
                        {client.firstName} {client.lastName} {client.display_id && `(#${client.display_id})`}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Date Collected */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date Collected *
                </label>
                <input
                  type="date"
                  name="date_collected"
                  value={formData.date_collected ? new Date(formData.date_collected).toISOString().split('T')[0] : ''}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isReadOnly}
                />
              </div>
            </div>
          </div>

          {/* PDF Upload */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold mb-4">PDF Document</h2>

            {/* Current PDF */}
            {formData.pdf_file && (
              <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Icon icon={FiFileText} className="w-5 h-5 text-green-600 mr-2" />
                    <span className="text-green-800 font-medium">PDF document uploaded</span>
                  </div>
                  <a
                    href={`${process.env.REACT_APP_API_URL || 'http://localhost:3005'}${formData.pdf_file}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-600 hover:text-green-800 font-medium"
                  >
                    View PDF
                  </a>
                </div>
              </div>
            )}

            {/* Upload new PDF */}
            {!isReadOnly && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {formData.pdf_file ? 'Replace PDF Document' : 'Upload PDF Document'}
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Icon icon={FiUpload} className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <div className="mb-2">
                    <label className="cursor-pointer">
                      <span className="text-blue-600 hover:text-blue-800 font-medium">
                        Choose PDF file
                      </span>
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <p className="text-xs text-gray-500">PDF files only, max 10MB</p>
                  {selectedFile && (
                    <div className="mt-2 text-sm text-green-600">
                      Selected: {selectedFile.name}
                    </div>
                  )}
                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold mb-4">Notes</h2>
            <div className="space-y-4">
              {/* Admin Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Admin Notes
                </label>
                <textarea
                  name="admin_notes"
                  value={formData.admin_notes}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Internal notes for administrative purposes..."
                  disabled={isReadOnly}
                />
              </div>

              {/* MedStaff Review Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Medical Staff Review Notes
                </label>
                <textarea
                  name="medstaff_review_notes"
                  value={formData.medstaff_review_notes}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Medical staff review and assessment notes..."
                  disabled={isReadOnly}
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {!isReadOnly && (
            <div className="flex justify-end space-x-4">
              <AppleButton
                type="button"
                variant="secondary"
                onClick={() => navigate('/admin/client-medications')}
              >
                <Icon icon={FiX} className="w-4 h-4 mr-2" />
                Cancel
              </AppleButton>

              <AppleButton
                type="submit"
                disabled={isSaving}
              >
                <Icon icon={FiSave} className="w-4 h-4 mr-2" />
                {isSaving ? 'Saving...' : (isCreating ? 'Create Record' : 'Update Record')}
              </AppleButton>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default ClientMedicationForm;