import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { medicalTrackingApi, clientsApi } from '../services/api';
import { MedicalItem, Client } from '../types';
import AppleButton from './AppleButton';
import { FiArrowLeft, FiSave, FiImage, FiUser, FiCalendar, FiFileText, FiCheck, FiX, FiAlertTriangle } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

const MedicalAdvisorReview: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [item, setItem] = useState<MedicalItem | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [additionalFiles, setAdditionalFiles] = useState<{key: string, url: string}[]>([]);

  // Review form state
  const [reviewStatus, setReviewStatus] = useState<'OK' | 'caution' | 'NOT OK' | ''>('');
  const [reviewNotes, setReviewNotes] = useState('');

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

      // Set current review state if exists
      if (itemData.medadvisor_review_result) {
        setReviewStatus(itemData.medadvisor_review_result);
      }
      if (itemData.medadvisor_review_notes) {
        setReviewNotes(itemData.medadvisor_review_notes);
      }

      // Fetch client details
      if (itemData.client_id) {
        const clientResponse = await clientsApi.getOne(itemData.client_id);
        setClient(clientResponse.data);
      }

      // Load presigned URLs for image and additional files
      if (itemData.image) {
        try {
          const imageUrlResponse = await medicalTrackingApi.getFileUrl(id, itemData.image);
          setImageUrl(imageUrlResponse.data.presignedUrl);
        } catch (error) {
          console.error('Error loading image URL:', error);
          setImageError(true);
        }
      }

      // Load additional files URLs
      if (itemData.files && itemData.files.length > 0) {
        try {
          const fileUrlPromises = itemData.files.map(async (fileKey: string) => {
            const fileUrlResponse = await medicalTrackingApi.getFileUrl(id, fileKey);
            return {
              key: fileKey,
              url: fileUrlResponse.data.presignedUrl
            };
          });
          const fileUrls = await Promise.all(fileUrlPromises);
          setAdditionalFiles(fileUrls);
        } catch (error) {
          console.error('Error loading additional file URLs:', error);
        }
      }
    } catch (error) {
      console.error('Error fetching medical tracking details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (date: string | Date | undefined) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      EKG: 'bg-blue-100 text-blue-800 border-blue-200',
      Liver: 'bg-red-100 text-red-800 border-red-200',
      Question: 'bg-green-100 text-green-800 border-green-200'
    };
    return colors[type] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'OK':
        return FiCheck;
      case 'NOT OK':
        return FiX;
      case 'caution':
        return FiAlertTriangle;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OK':
        return 'bg-green-500 text-white hover:bg-green-600';
      case 'NOT OK':
        return 'bg-red-500 text-white hover:bg-red-600';
      case 'caution':
        return 'bg-yellow-500 text-white hover:bg-yellow-600';
      default:
        return 'bg-gray-200 text-gray-700 hover:bg-gray-300';
    }
  };

  const handleSaveReview = async () => {
    if (!item || !reviewStatus) {
      alert('Please select a review status before saving.');
      return;
    }

    try {
      setIsSaving(true);

      const updateData = {
        medadvisor_review_result: reviewStatus,
        medadvisor_review_notes: reviewNotes,
        medadvisor_review_date: new Date().toISOString(),
      };

      await medicalTrackingApi.update(item._id!, updateData);

      // Refresh the item data
      await fetchItemDetails();

      alert('Review saved successfully!');
    } catch (error) {
      console.error('Error saving review:', error);
      alert('Error saving review. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading medical tracking item...</div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="p-6">
        <div className="text-red-500">Medical tracking item not found</div>
        <AppleButton onClick={() => navigate('/medical/medical-tracking')} className="mt-4">
          Back to Medical Tracking
        </AppleButton>
      </div>
    );
  }


  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/medical/medical-tracking')}
            className="text-gray-600 hover:text-gray-900 flex items-center gap-2 transition-colors"
          >
            <Icon icon={FiArrowLeft} className="w-5 h-5" />
            Back to Medical Tracking
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 whitespace-nowrap">Medical Review #{item.display_id}</h1>
            <p className="text-gray-600 whitespace-nowrap">Review and approve medical tracking item</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {item.medadvisor_review_result && (
            <div className="text-sm text-gray-500">
              Previously reviewed: {formatDate(item.medadvisor_review_date)}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Medical Item Information */}
        <div className="lg:col-span-2 space-y-6">
          {/* Item Details Card */}
          <div className="bg-white rounded-apple-lg shadow-apple-sm p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Icon icon={FiFileText} className="w-5 h-5 mr-2 text-gray-600" />
              Item Details
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-600 font-medium">Type:</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getTypeColor(item.type)}`}>
                  {item.type}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-600 font-medium">Display ID:</span>
                <span className="font-bold text-gray-900">#{item.display_id}</span>
              </div>

              <div className="col-span-2 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 font-medium flex items-center">
                    <Icon icon={FiUser} className="w-4 h-4 mr-1" />
                    Client:
                  </span>
                  {client ? (
                    <button
                      onClick={() => navigate(`/medical/clients?id=${item.client_id}`)}
                      className="font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                    >
                      {client.firstName} {client.lastName}
                      {client.display_id && ` (#${client.display_id})`}
                    </button>
                  ) : (item as any).client ? (
                    <span className="font-medium text-gray-900">
                      {(item as any).client.firstName} {(item as any).client.lastName}
                      {(item as any).client.display_id && ` (#${(item as any).client.display_id})`}
                    </span>
                  ) : (
                    <span className="text-gray-500">Loading client info...</span>
                  )}
                </div>
              </div>

              <div className="col-span-2 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 font-medium flex items-center">
                    <Icon icon={FiCalendar} className="w-4 h-4 mr-1" />
                    Date Received:
                  </span>
                  <span className="font-medium text-gray-900">{formatDate(item.date_received)}</span>
                </div>
              </div>

              {item.notes && (
                <div className="col-span-2 p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600 font-medium block mb-2">Notes:</span>
                  <p className="text-gray-900">{item.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Primary Document/Image */}
          {imageUrl && (
            <div className="bg-white rounded-apple-lg shadow-apple-sm p-6 border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Icon icon={FiImage} className="w-5 h-5 mr-2 text-gray-600" />
                Primary Medical Document
              </h2>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50 max-h-96 overflow-auto">
                {!imageError ? (
                  <img
                    src={imageUrl}
                    alt={`Medical document for ${item.type}`}
                    className="max-w-full h-auto object-contain mx-auto rounded-lg shadow-sm"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className="text-center text-red-500 py-8">
                    <Icon icon={FiX} className="w-8 h-8 mx-auto mb-2" />
                    Failed to load medical document
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Additional Files */}
          {additionalFiles.length > 0 && (
            <div className="bg-white rounded-apple-lg shadow-apple-sm p-6 border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Icon icon={FiFileText} className="w-5 h-5 mr-2 text-gray-600" />
                Additional Files ({additionalFiles.length})
              </h2>

              <div className="grid gap-4">
                {additionalFiles.map((file, index) => {
                  const fileName = file.key.split('/').pop() || `File ${index + 1}`;
                  const isImage = /\.(jpg|jpeg|png|gif)$/i.test(fileName);

                  return (
                    <div key={file.key} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900">{fileName}</span>
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
                        >
                          View File
                        </a>
                      </div>

                      {isImage ? (
                        <div className="max-h-48 overflow-hidden rounded border">
                          <img
                            src={file.url}
                            alt={fileName}
                            className="max-w-full h-auto object-contain mx-auto"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              const nextElement = e.currentTarget.nextElementSibling as HTMLElement;
                              if (nextElement) {
                                nextElement.style.display = 'block';
                              }
                            }}
                          />
                          <div className="text-center text-red-500 py-4" style={{ display: 'none' }}>
                            <Icon icon={FiX} className="w-6 h-6 mx-auto mb-1" />
                            Failed to load image
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-gray-500 py-4">
                          <Icon icon={FiFileText} className="w-8 h-8 mx-auto mb-2" />
                          <p className="text-sm">{isImage ? 'Image file' : 'Document file'}</p>
                          <p className="text-xs text-gray-400">Click "View File" to open</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Review Panel */}
        <div className="space-y-6">
          {/* Review Status Card */}
          <div className="bg-white rounded-apple-lg shadow-apple-sm p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Medical Advisor Review</h2>

            <div className="space-y-4">
              {/* Status Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Review Status *
                </label>
                <div className="grid gap-2">
                  {(['OK', 'caution', 'NOT OK'] as const).map((status) => {
                    const StatusIcon = getStatusIcon(status);
                    const isSelected = reviewStatus === status;

                    return (
                      <button
                        key={status}
                        onClick={() => setReviewStatus(status)}
                        className={`
                          flex items-center justify-center gap-2 p-3 rounded-lg border-2 font-medium transition-all
                          ${isSelected
                            ? `${getStatusColor(status)} border-transparent shadow-sm`
                            : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                          }
                        `}
                      >
                        {StatusIcon && <Icon icon={StatusIcon} className="w-4 h-4" />}
                        {status === 'OK' ? 'Approve' : status === 'NOT OK' ? 'Deny' : 'Caution'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Review Notes */}
              <div>
                <label htmlFor="reviewNotes" className="block text-sm font-medium text-gray-700 mb-2">
                  Review Notes
                </label>
                <textarea
                  id="reviewNotes"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Enter your medical advisor notes and recommendations..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  rows={6}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Provide detailed feedback and reasoning for your decision
                </p>
              </div>

              {/* Save Button */}
              <div
                style={{
                  opacity: (!reviewStatus || isSaving) ? 0.6 : 1,
                  cursor: (!reviewStatus || isSaving) ? 'not-allowed' : 'pointer'
                }}
              >
                <AppleButton
                  onClick={handleSaveReview}
                  disabled={!reviewStatus || isSaving}
                  className={`w-full justify-center relative z-10 ${reviewStatus ? 'apple-button-primary' : 'apple-button-disabled'}`}
                >
                  <Icon icon={FiSave} className="w-4 h-4 mr-2" />
                  {isSaving ? 'Saving Review...' : reviewStatus ? 'Save Review' : 'Select Review Status First'}
                </AppleButton>
              </div>
              {!reviewStatus && (
                <p className="text-xs text-red-500 mt-1 text-center">
                  Please select a review status (OK, Caution, or NOT OK) to enable the Save button
                </p>
              )}
            </div>
          </div>

          {/* Previous Review (if exists) */}
          {item.medadvisor_review_result && (
            <div className="bg-gray-50 rounded-apple-lg p-4 border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Previous Review</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs text-gray-600">Status:</span>
                  <span className={`px-2 py-1 text-xs rounded-full ${item.medadvisor_review_result === 'OK' ? 'bg-green-100 text-green-800' : item.medadvisor_review_result === 'NOT OK' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {item.medadvisor_review_result}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-gray-600">Date:</span>
                  <span className="text-xs text-gray-900 ml-2">{formatDate(item.medadvisor_review_date)}</span>
                </div>
                {item.medadvisor_review_notes && (
                  <div>
                    <span className="text-xs text-gray-600 block mb-1">Notes:</span>
                    <p className="text-xs text-gray-900">{item.medadvisor_review_notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Reviewer Info */}
          <div className="bg-blue-50 rounded-apple-lg p-4 border border-blue-200">
            <h3 className="text-sm font-semibold text-blue-800 mb-2">Reviewing As</h3>
            <div className="text-xs text-blue-700">
              <div>{user?.email}</div>
              <div className="text-blue-600">Medical Advisor</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MedicalAdvisorReview;