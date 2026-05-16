import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { medicalTrackingApi, clientsApi, medicalAdvisorApi } from '../services/api';
import { MedicalItem, Client } from '../types';
import AppleButton from './AppleButton';
import SearchableClientDropdown from './SearchableClientDropdown';
import { FiPlus, FiEdit2, FiTrash2, FiImage, FiFileText, FiHeart, FiActivity } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

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

const getMedicalItemClientId = (item: Partial<MedicalItem> | undefined | null): string => {
  if (!item) return '';
  return item.client_id || (item as any).clientId || '';
};

const MedicalTrackingNew: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [medicalItems, setMedicalItems] = useState<MedicalItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filteredItems, setFilteredItems] = useState<MedicalItem[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MedicalItem | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<MedicalItem>>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // Debug: Log when component mounts (only once)
  // console.log('[MedicalTrackingNew] Component mounted, user role:', user?.role);

  const fetchMedicalItems = useCallback(async () => {
    try {
      setIsLoading(true);
      // Use medical advisor API if user is a medical advisor
      const response = user?.role === 'medical_advisor'
        ? await medicalAdvisorApi.getMedicalTracking()
        : await medicalTrackingApi.getAll();
      const items = Array.isArray(response.data) ? response.data.filter(Boolean) : [];
      setMedicalItems(items as MedicalItem[]);
    } catch (error) {
      console.error('Error fetching medical tracking items:', error);
      setMedicalItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.role]);

  const fetchClients = useCallback(async () => {
    // Medical advisors don't need client list - they get client info with medical items
    if (user?.role === 'medical_advisor') {
      setClients([]);
      return;
    }

    try {
      const response = await clientsApi.getAll();
      setClients(response.data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
      setClients([]);
    }
  }, [user?.role]);

  useEffect(() => {
    fetchMedicalItems();
  }, [fetchMedicalItems]);

  useEffect(() => {
    // Only fetch clients if not a medical advisor
    if (user?.role !== 'medical_advisor') {
      fetchClients();
    }
  }, [fetchClients, user?.role]);

  useEffect(() => {
    // console.log('Filtering medical items:', { medicalItems, filterType, filterStatus });
    let filtered = Array.isArray(medicalItems) ? medicalItems : [];

    if (filterType !== 'all') {
      filtered = filtered.filter(item => item.type === filterType);
    }

    if (filterStatus !== 'all') {
      if (filterStatus === 'reviewed') {
        filtered = filtered.filter(item => item.medadvisor_review_result);
      } else if (filterStatus === 'pending') {
        filtered = filtered.filter(item => !item.medadvisor_review_result);
      } else {
        filtered = filtered.filter(item => item.medadvisor_review_result === filterStatus);
      }
    }

    // console.log('Filtered items result:', filtered);
    setFilteredItems(filtered.filter(Boolean));
  }, [medicalItems, filterType, filterStatus]);

  const getClientName = useCallback((clientIdOrItem: string | MedicalItem) => {
    // For medical advisors, client info is embedded in the medical item
    if (user?.role === 'medical_advisor' && typeof clientIdOrItem === 'object') {
      const item = clientIdOrItem as any;
      if (item.client) {
        return `${item.client.firstName} ${item.client.lastName}`;
      }
    }

    // For other roles, look up client from the clients list
    const clientId = typeof clientIdOrItem === 'string' ? clientIdOrItem : getMedicalItemClientId(clientIdOrItem);
    const client = clients.find(c => c._id === clientId);
    return client ? `${client.firstName} ${client.lastName}` : 'Unknown Client';
  }, [clients, user?.role]);

  const getRoutePrefix = useCallback(() => {
    switch (user?.role) {
      case 'admin':
        return 'admin';
      case 'medical_staff':
        return 'medical';
      case 'medical_advisor':
        return 'medical';
      case 'facilitator':
        return 'staff';
      case 'user':
        return 'user';
      default:
        return 'user';
    }
  }, [user?.role]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'EKG':
        return FiActivity;
      case 'Liver':
        return FiHeart;
      case 'Question':
        return FiFileText;
      default:
        return FiFileText;
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

  const getStatusColor = (result?: string) => {
    if (!result) return 'bg-gray-100 text-gray-800';
    const colors: Record<string, string> = {
      'OK': 'bg-green-100 text-green-800',
      'caution': 'bg-yellow-100 text-yellow-800',
      'NOT OK': 'bg-red-100 text-red-800'
    };
    return colors[result] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (date: string | Date | undefined) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  };

  const handleAdd = async () => {
    try {
      const response = await medicalTrackingApi.getNextDisplayId();
      setEditingItem(null);
      setFormData({
        display_id: response.data,
        type: 'EKG',
        client_id: '',
        notes: ''
      });
      setSelectedFile(null);
      setSelectedFiles([]);
      setIsAddModalOpen(true);
    } catch (error) {
      console.error('Error fetching next display ID:', error);
      setEditingItem(null);
      setFormData({
        display_id: 1001, // Fallback to 1001
        type: 'EKG',
        client_id: '',
        notes: ''
      });
      setSelectedFile(null);
      setSelectedFiles([]);
      setIsAddModalOpen(true);
    }
  };

  const handleEdit = (item: MedicalItem) => {
    if (!item._id) return;
    navigate(`/medical-tracking/${item._id}/edit`);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this medical tracking item?')) {
      try {
        await medicalTrackingApi.delete(id);
        fetchMedicalItems();
      } catch (error) {
        console.error('Error deleting medical item:', error);
      }
    }
  };

  const handleViewImage = async (item: MedicalItem) => {
    if (!item.image || !item._id) return;

    try {
      // Get presigned URL for S3 image
      const response = await medicalTrackingApi.getFileUrl(item._id, item.image);
      const imageUrl = response.data.presignedUrl;
      setViewingImage(imageUrl);
      setIsImageModalOpen(true);
    } catch (error) {
      console.error('Error loading image URL:', error);
      alert('Error loading image. Please try again.');
    }
  };

  const handleViewDocument = async (item: MedicalItem) => {
    if (!item.image || !item._id) return;

    try {
      const filename = getFilenameFromS3Key(item.image);

      if (isImageFile(filename)) {
        // Handle as image - use existing modal
        handleViewImage(item);
      } else {
        // Handle as document - open in new tab
        const response = await medicalTrackingApi.getFileUrl(item._id, item.image);
        const documentUrl = response.data.presignedUrl;
        window.open(documentUrl, '_blank');
      }
    } catch (error) {
      console.error('Error loading document URL:', error);
      alert('Error loading document. Please try again.');
    }
  };

  const handleViewDetails = (item: MedicalItem) => {
    // Medical advisors get taken to the review interface
    if (user?.role === 'medical_advisor') {
      navigate(`/medical/medical-review/${item._id}`);
    } else {
      // Regular users get the detail view
      navigate(`/medical-tracking/${item._id}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!formData.client_id || !formData.type) {
        alert('Please select a client and type');
        return;
      }

      const itemData: Partial<MedicalItem> = {
        display_id: formData.display_id,
        type: formData.type! as 'EKG' | 'Liver' | 'Question',
        client_id: formData.client_id!,
        notes: formData.notes || '',
        date_received: formData.date_received
      };

      let savedItem: MedicalItem;

      if (editingItem) {
        const updateData = {
          ...itemData,
          medadvisor_review_date: formData.medadvisor_review_date,
          medadvisor_review_result: formData.medadvisor_review_result,
          medadvisor_review_notes: formData.medadvisor_review_notes
        };
        const result = await medicalTrackingApi.update(editingItem._id!, updateData);
        savedItem = result.data;
      } else {
        // For create, only send the fields expected by CreateMedicalTrackingDto
        const createData = {
          display_id: itemData.display_id,
          type: itemData.type!,
          client_id: itemData.client_id!,
          notes: itemData.notes,
          date_received: itemData.date_received
        };
        console.log('Creating medical tracking item with data:', createData);
        const result = await medicalTrackingApi.create(createData as Omit<MedicalItem, '_id'>);
        savedItem = result.data;
      }

      // Upload image if selected
      if (selectedFile && savedItem._id) {
        await medicalTrackingApi.uploadImage(savedItem._id, selectedFile);
      }

      // Upload additional files if selected (only for admin)
      if (selectedFiles.length > 0 && savedItem._id && user?.role === 'admin') {
        await medicalTrackingApi.uploadFiles(savedItem._id, selectedFiles);
      }

      fetchMedicalItems();
      setIsAddModalOpen(false);
      setIsEditModalOpen(false);
      setFormData({});
      setEditingItem(null);
      setSelectedFile(null);
      setSelectedFiles([]);
    } catch (error: any) {
      console.error('Error saving medical item:', error);
      if (error.response) {
        console.error('Error response:', error.response.data);
        alert(`Error saving medical item: ${error.response.data.message || 'Please try again.'}`);
      } else {
        alert('Error saving medical item. Please try again.');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading medical tracking data...</div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
            🏥 {user?.role === 'medical_advisor' ? 'Medical Tracking Records' : 'Medical Tracking Reviews'}
          </h1>
          <p className="text-gray-600">
            {user?.role === 'medical_advisor'
              ? 'Review and approve medical tracking items'
              : 'All medical tracking items and their review status'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="type-filter" className="text-sm font-medium text-gray-700">
              Type:
            </label>
            <select
              id="type-filter"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="all">All Types</option>
              <option value="EKG">EKG</option>
              <option value="Liver">Liver</option>
              <option value="Question">Question</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="status-filter" className="text-sm font-medium text-gray-700">
              Status:
            </label>
            <select
              id="status-filter"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending Review</option>
              <option value="reviewed">Reviewed</option>
              <option value="OK">OK</option>
              <option value="caution">Caution</option>
              <option value="NOT OK">NOT OK</option>
            </select>
          </div>
          {user?.role !== 'medical_advisor' && (
            <AppleButton onClick={handleAdd} className="apple-button-primary">
              <Icon icon={FiPlus} className="w-4 h-4 mr-2" />
              Add Medical Tracking
            </AppleButton>
          )}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-2xl font-bold text-gray-900">{(filteredItems || []).length}</div>
          <div className="text-sm text-gray-600">Total Items</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-2xl font-bold text-blue-600">
            {(filteredItems || []).filter(item => item.type === 'EKG').length}
          </div>
          <div className="text-sm text-gray-600">EKG Items</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-2xl font-bold text-red-600">
            {(filteredItems || []).filter(item => item.type === 'Liver').length}
          </div>
          <div className="text-sm text-gray-600">Liver Items</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-2xl font-bold text-yellow-600">
            {(filteredItems || []).filter(item => !item.medadvisor_review_result).length}
          </div>
          <div className="text-sm text-gray-600">Pending Review</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-2xl font-bold text-green-600">
            {(filteredItems || []).filter(item => item.medadvisor_review_result === 'OK').length}
          </div>
          <div className="text-sm text-gray-600">Approved</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Display ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date Received
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Notes
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Document/Image
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Medical Advisor Review
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Review Date
                </th>
                {user?.role !== 'medical_advisor' && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(filteredItems || []).map((item) => (
                <tr key={item._id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleViewDetails(item)}
                      className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      #{item.display_id}
                    </button>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Icon icon={getTypeIcon(item.type)} className="w-4 h-4 mr-2 text-gray-400" />
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getTypeColor(item.type)}`}>
                        {item.type}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <button
                      onClick={() => navigate(`/clients?id=${getMedicalItemClientId(item)}`)}
                      className="text-sm font-medium text-gray-900 hover:text-blue-600 hover:underline"
                    >
                      {getClientName(user?.role === 'medical_advisor' ? item : getMedicalItemClientId(item))}
                    </button>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(item.date_received)}
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm text-gray-900 max-w-xs truncate">
                      {item.notes || 'No notes'}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    {item.image ? (
                      (() => {
                        const filename = getFilenameFromS3Key(item.image);
                        const isImage = isImageFile(filename);

                        return (
                          <button
                            onClick={() => handleViewDocument(item)}
                            className="text-blue-600 hover:text-blue-900 text-left"
                            title={isImage ? "View Image" : "Open Document"}
                          >
                            {isImage ? (
                              <div className="flex items-center">
                                <Icon icon={FiImage} className="w-4 h-4 mr-1" />
                                <span className="text-xs">Image</span>
                              </div>
                            ) : (
                              <div className="flex items-center">
                                <Icon icon={FiFileText} className="w-4 h-4 mr-1" />
                                <span className="text-xs max-w-24 truncate" title={filename}>
                                  {filename}
                                </span>
                              </div>
                            )}
                          </button>
                        );
                      })()
                    ) : (
                      <span className="text-gray-400 text-xs">No file</span>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    {item.medadvisor_review_result ? (
                      <div>
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(item.medadvisor_review_result)}`}>
                          {item.medadvisor_review_result}
                        </span>
                        {item.medadvisor_review_notes && (
                          <div className="text-xs text-gray-500 mt-1 max-w-xs truncate">
                            {item.medadvisor_review_notes}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">Pending review</span>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(item.medadvisor_review_date)}
                  </td>
                  {user?.role !== 'medical_advisor' && (
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(item)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Edit"
                        >
                          <Icon icon={FiEdit2} className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item._id!)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete"
                        >
                          <Icon icon={FiTrash2} className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {filteredItems.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No medical tracking items found
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-gray-700">
          Showing {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md">
            <h2 className="text-lg font-semibold mb-4">Add New Medical Tracking Item</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display ID
                </label>
                <input
                  type="number"
                  value={formData.display_id || 1001}
                  onChange={(e) => setFormData({ ...formData, display_id: parseInt(e.target.value) || 1001 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min={1001}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Human-readable ID (must be 1001 or higher)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <select
                  value={formData.type || 'EKG'}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as 'EKG' | 'Liver' | 'Question' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="EKG">EKG</option>
                  <option value="Liver">Liver</option>
                  <option value="Question">Question</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client
                </label>
                <SearchableClientDropdown
                  clients={clients}
                  selectedClientId={formData.client_id || ''}
                  onClientSelect={(clientId) => setFormData({ ...formData, client_id: clientId })}
                  placeholder="Select a client"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date Received
                </label>
                <input
                  type="date"
                  value={formData.date_received ? new Date(formData.date_received).toISOString().split('T')[0] : ''}
                  onChange={(e) => setFormData({ ...formData, date_received: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Enter notes (optional)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Image
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {user?.role === 'admin' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Additional Files (Admin Only)
                  </label>
                  <input
                    type="file"
                    accept="image/*,.pdf,.doc,.docx"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setSelectedFiles(files);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Upload up to 5 additional files (images, PDFs, documents). Max 10MB each.
                  </p>
                  {selectedFiles.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm font-medium text-gray-700">Selected files:</p>
                      <ul className="text-xs text-gray-600 mt-1">
                        {selectedFiles.map((file, index) => (
                          <li key={index} className="flex justify-between items-center">
                            <span>{file.name}</span>
                            <span>({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Medical Advisor Review
                </label>
                <div className="space-y-2">
                  <select
                    value={formData.medadvisor_review_result || ''}
                    onChange={(e) => setFormData({ ...formData, medadvisor_review_result: e.target.value as 'OK' | 'caution' | 'NOT OK' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Pending Review</option>
                    <option value="OK">OK</option>
                    <option value="caution">Caution</option>
                    <option value="NOT OK">NOT OK</option>
                  </select>
                  <textarea
                    value={formData.medadvisor_review_notes || ''}
                    onChange={(e) => setFormData({ ...formData, medadvisor_review_notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={2}
                    placeholder="Medical advisor notes (optional)"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setFormData({});
                    setSelectedFile(null);
      setSelectedFiles([]);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <AppleButton type="submit" className="apple-button-primary">
                  Create Medical Tracking
                </AppleButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md">
            <h2 className="text-lg font-semibold mb-4">Edit Medical Item</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display ID
                </label>
                <input
                  type="number"
                  value={formData.display_id || 1001}
                  onChange={(e) => setFormData({ ...formData, display_id: parseInt(e.target.value) || 1001 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min={1001}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Human-readable ID (must be 1001 or higher)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <select
                  value={formData.type || 'EKG'}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as 'EKG' | 'Liver' | 'Question' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="EKG">EKG</option>
                  <option value="Liver">Liver</option>
                  <option value="Question">Question</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client
                </label>
                <SearchableClientDropdown
                  clients={clients}
                  selectedClientId={formData.client_id || ''}
                  onClientSelect={(clientId) => setFormData({ ...formData, client_id: clientId })}
                  placeholder="Select a client"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date Received
                </label>
                <input
                  type="date"
                  value={formData.date_received ? new Date(formData.date_received).toISOString().split('T')[0] : ''}
                  onChange={(e) => setFormData({ ...formData, date_received: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Enter notes (optional)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Medical Advisor Review
                </label>
                <div className="space-y-2">
                  <select
                    value={formData.medadvisor_review_result || ''}
                    onChange={(e) => setFormData({ ...formData, medadvisor_review_result: e.target.value as 'OK' | 'caution' | 'NOT OK' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Pending Review</option>
                    <option value="OK">OK</option>
                    <option value="caution">Caution</option>
                    <option value="NOT OK">NOT OK</option>
                  </select>
                  <textarea
                    value={formData.medadvisor_review_notes || ''}
                    onChange={(e) => setFormData({ ...formData, medadvisor_review_notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={2}
                    placeholder="Medical advisor notes (optional)"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Replace Image
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {user?.role === 'admin' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Add Additional Files (Admin Only)
                  </label>
                  <input
                    type="file"
                    accept="image/*,.pdf,.doc,.docx"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setSelectedFiles(files);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Upload up to 5 additional files (images, PDFs, documents). Max 10MB each.
                  </p>
                  {selectedFiles.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm font-medium text-gray-700">Selected files:</p>
                      <ul className="text-xs text-gray-600 mt-1">
                        {selectedFiles.map((file, index) => (
                          <li key={index} className="flex justify-between items-center">
                            <span>{file.name}</span>
                            <span>({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingItem(null);
                    setFormData({});
                    setSelectedFile(null);
      setSelectedFiles([]);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <AppleButton type="submit" className="apple-button-primary">
                  Save Changes
                </AppleButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Modal */}
      {isImageModalOpen && viewingImage && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl max-h-4xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Medical Image</h2>
              <button
                onClick={() => setIsImageModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <img
              src={viewingImage}
              alt="Medical item"
              className="max-w-full max-h-96 object-contain"
            />
          </div>
        </div>
      )}

    </div>
  );
};

export default MedicalTrackingNew;
