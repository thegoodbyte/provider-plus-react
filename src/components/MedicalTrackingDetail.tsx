import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { medicalTrackingApi, clientsApi } from '../services/api';
import { MedicalItem, Client } from '../types';
import AppleButton from './AppleButton';
import { FiArrowLeft, FiEdit2, FiTrash2 } from 'react-icons/fi';

// Simple wrapper to fix TypeScript icon issues
const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

// Helper function to determine if file is an image or document
const isImageFile = (filename: string): boolean => {
  if (!filename) return false;
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
  const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return imageExtensions.includes(extension);
};

// Helper function to get filename from S3 key
const getFilenameFromS3Key = (s3Key: string): string => {
  if (!s3Key) return '';
  const parts = s3Key.split('/');
  const filename = parts[parts.length - 1];
  // Remove timestamp prefix if present (format: timestamp_originalfilename)
  const underscoreIndex = filename.indexOf('_');
  return underscoreIndex > 0 ? filename.substring(underscoreIndex + 1) : filename;
};

const MedicalTrackingDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<MedicalItem | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [loadingDocument, setLoadingDocument] = useState(false);

  useEffect(() => {
    fetchItemDetails();
  }, [id]);

  const fetchItemDetails = async () => {
    if (!id) return;

    try {
      setIsLoading(true);
      const itemResponse = await medicalTrackingApi.getOne(id);
      const itemData = itemResponse.data;
      setItem(itemData);

      // Fetch client details
      if (itemData.client_id) {
        const clientResponse = await clientsApi.getOne(itemData.client_id);
        setClient(clientResponse.data);
      }

      // Load document URL if there's an image/document attached
      if (itemData.image) {
        loadDocumentUrl(itemData);
      }
    } catch (error) {
      console.error('Error fetching medical tracking details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDocumentUrl = async (itemData: MedicalItem) => {
    if (!itemData.image || !itemData._id) return;

    try {
      setLoadingDocument(true);
      const response = await medicalTrackingApi.getFileUrl(itemData._id, itemData.image);
      setDocumentUrl(response.data.presignedUrl);
      setImageError(false);
    } catch (error) {
      console.error('Error loading document URL:', error);
      setImageError(true);
    } finally {
      setLoadingDocument(false);
    }
  };

  const formatDate = (date: string | Date | undefined) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OK':
        return 'bg-green-100 text-green-800';
      case 'NOT OK':
        return 'bg-red-100 text-red-800';
      case 'caution':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      EKG: 'bg-blue-100 text-blue-800',
      Liver: 'bg-red-100 text-red-800',
      Question: 'bg-green-100 text-green-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const handleEdit = () => {
    // Navigate back to list with edit modal open
    navigate('/medical-tracking', { state: { editItemId: id } });
  };

  const handleDelete = async () => {
    if (!item || !window.confirm('Are you sure you want to delete this medical tracking item?')) {
      return;
    }

    try {
      await medicalTrackingApi.delete(item._id!);
      navigate('/medical-tracking');
    } catch (error) {
      console.error('Error deleting medical item:', error);
      alert('Error deleting item. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading medical tracking details...</div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="p-6">
        <div className="text-red-500">Medical tracking item not found</div>
        <AppleButton onClick={() => navigate('/medical-tracking')} className="mt-4">
          Back to List
        </AppleButton>
      </div>
    );
  }

  // Get filename and determine file type
  const filename = item.image ? getFilenameFromS3Key(item.image) : '';
  const isImage = filename ? isImageFile(filename) : false;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/medical-tracking')}
            className="text-gray-600 hover:text-gray-900 flex items-center gap-2"
          >
            <Icon icon={FiArrowLeft} className="w-5 h-5" />
            Back to List
          </button>
          <h1 className="text-2xl font-bold">Medical Tracking #{item.display_id}</h1>
        </div>
        <div className="flex gap-2">
          <AppleButton onClick={handleEdit} variant="secondary">
            <Icon icon={FiEdit2} className="w-4 h-4 mr-2" />
            Edit
          </AppleButton>
          <AppleButton onClick={handleDelete} variant="danger">
            <Icon icon={FiTrash2} className="w-4 h-4 mr-2" />
            Delete
          </AppleButton>
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Item Information */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Item Information</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Display ID:</span>
              <span className="font-medium">#{item.display_id}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Type:</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getTypeColor(item.type)}`}>
                {item.type}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Client:</span>
              {client ? (
                <button
                  onClick={() => navigate(`/clients?id=${item.client_id}`)}
                  className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {client.firstName} {client.lastName}
                  {client.display_id && ` - #${client.display_id}`}
                </button>
              ) : (
                <span className="font-medium">Loading...</span>
              )}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Date Received:</span>
              <span className="font-medium">{formatDate(item.date_received)}</span>
            </div>
            <div>
              <span className="text-gray-600">Notes:</span>
              <p className="mt-1 text-gray-900">{item.notes || 'No notes provided'}</p>
            </div>
          </div>
        </div>

        {/* Right Column - Medical Advisor Review */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Medical Advisor Review</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Review Status:</span>
              {item.medadvisor_review_result ? (
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(item.medadvisor_review_result)}`}>
                  {item.medadvisor_review_result}
                </span>
              ) : (
                <span className="text-gray-400">Pending review</span>
              )}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Review Date:</span>
              <span className="font-medium">{formatDate(item.medadvisor_review_date)}</span>
            </div>
            <div>
              <span className="text-gray-600">Review Notes:</span>
              <p className="mt-1 text-gray-900">
                {item.medadvisor_review_notes || 'No review notes provided'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Document/Image Section */}
      {item.image && (
        <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Document/Image</h2>
          <div className="border rounded-lg p-4 bg-gray-50">
            {loadingDocument ? (
              <div className="text-center text-gray-500 py-8">
                Loading document...
              </div>
            ) : imageError ? (
              <div className="text-center text-red-500 py-8">
                Failed to load document
              </div>
            ) : documentUrl ? (
              isImage ? (
                <img
                  src={documentUrl}
                  alt={`Medical document for ${item.type}`}
                  className="max-w-full max-h-[600px] object-contain mx-auto"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="text-center py-8">
                  <div className="mb-4">
                    <span className="text-sm text-gray-600">PDF Document: </span>
                    <span className="text-sm font-medium">{filename}</span>
                  </div>
                  <button
                    onClick={() => window.open(documentUrl, '_blank')}
                    className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    Open PDF Document
                  </button>
                </div>
              )
            ) : (
              <div className="text-center text-gray-500 py-8">
                Preparing document...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicalTrackingDetail;