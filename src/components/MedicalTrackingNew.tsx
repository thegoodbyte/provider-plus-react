import React, { useState, useEffect, useCallback } from 'react';
import { medicalTrackingApi, clientsApi } from '../services/api';
import { MedicalItem, Client } from '../types';
import AppleButton from './AppleButton';
import { FiPlus, FiEdit2, FiTrash2, FiImage, FiFileText, FiHeart, FiActivity } from 'react-icons/fi';

// Simple wrapper to fix TypeScript icon issues
const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

const MedicalTrackingNew: React.FC = () => {
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

  const fetchMedicalItems = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await medicalTrackingApi.getAll();
      setMedicalItems(response.data || []);
    } catch (error) {
      console.error('Error fetching medical tracking items:', error);
      setMedicalItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      const response = await clientsApi.getAll();
      setClients(response.data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
      setClients([]);
    }
  }, []);

  useEffect(() => {
    fetchMedicalItems();
    fetchClients();
  }, [fetchMedicalItems, fetchClients]);

  useEffect(() => {
    let filtered = medicalItems;

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

    setFilteredItems(filtered);
  }, [medicalItems, filterType, filterStatus]);

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c._id === clientId);
    return client ? `${client.firstName} ${client.lastName}` : 'Unknown Client';
  };

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

  const handleAdd = () => {
    setEditingItem(null);
    setFormData({
      type: 'EKG',
      client_id: '',
      notes: ''
    });
    setSelectedFile(null);
    setIsAddModalOpen(true);
  };

  const handleEdit = (item: MedicalItem) => {
    setEditingItem(item);
    setFormData(item);
    setSelectedFile(null);
    setIsEditModalOpen(true);
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

  const handleViewImage = (imageUrl: string) => {
    setViewingImage(imageUrl);
    setIsImageModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!formData.client_id || !formData.type) {
        alert('Please select a client and type');
        return;
      }

      const itemData = {
        ...formData,
        client_id: formData.client_id!,
        type: formData.type! as 'EKG' | 'Liver' | 'Question'
      };

      let savedItem: MedicalItem;

      if (editingItem) {
        const result = await medicalTrackingApi.update(editingItem._id!, itemData);
        savedItem = result.data;
      } else {
        const result = await medicalTrackingApi.create(itemData);
        savedItem = result.data;
      }

      // Upload image if selected
      if (selectedFile && savedItem._id) {
        await medicalTrackingApi.uploadImage(savedItem._id, selectedFile);
      }

      fetchMedicalItems();
      setIsAddModalOpen(false);
      setIsEditModalOpen(false);
      setFormData({});
      setEditingItem(null);
      setSelectedFile(null);
    } catch (error) {
      console.error('Error saving medical item:', error);
      alert('Error saving medical item. Please try again.');
    }
  };

  const handleReview = async (item: MedicalItem, reviewResult: 'OK' | 'caution' | 'NOT OK', notes: string) => {
    try {
      await medicalTrackingApi.reviewItem(item._id!, {
        medadvisor_review_result: reviewResult,
        medadvisor_review_notes: notes,
        medadvisor_review_date: new Date().toISOString()
      });
      fetchMedicalItems();
    } catch (error) {
      console.error('Error reviewing medical item:', error);
      alert('Error saving review. Please try again.');
    }
  };

  const handleExport = useCallback(() => {
    const csvContent = [
      ['ID', 'Type', 'Client', 'Notes', 'Review Date', 'Review Result', 'Review Notes', 'Created'].join(','),
      ...filteredItems.map(item => [
        item._id || '',
        item.type,
        getClientName(item.client_id),
        (item.notes || '').replace(/,/g, ';'),
        formatDate(item.medadvisor_review_date),
        item.medadvisor_review_result || 'Pending',
        (item.medadvisor_review_notes || '').replace(/,/g, ';'),
        formatDate(item.createdAt)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medical-tracking-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }, [filteredItems, getClientName]);

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
            🏥 Medical Tracking
          </h1>
          <p className="text-gray-600">Track EKG, Liver panels, and questionnaires with medical advisor reviews</p>
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
          <AppleButton onClick={handleExport} className="apple-button-secondary">
            <Icon icon={FiDownload} className="w-4 h-4 mr-2" />
            Export CSV
          </AppleButton>
          <AppleButton onClick={fetchMedicalItems} className="apple-button-secondary">
            <Icon icon={FiRefreshCw} className="w-4 h-4 mr-2" />
            Refresh
          </AppleButton>
          <AppleButton onClick={handleAdd} className="apple-button-primary">
            <Icon icon={FiPlus} className="w-4 h-4 mr-2" />
            Add Item
          </AppleButton>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-2xl font-bold text-gray-900">{filteredItems.length}</div>
          <div className="text-sm text-gray-600">Total Items</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-2xl font-bold text-blue-600">
            {filteredItems.filter(item => item.type === 'EKG').length}
          </div>
          <div className="text-sm text-gray-600">EKG Items</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-2xl font-bold text-red-600">
            {filteredItems.filter(item => item.type === 'Liver').length}
          </div>
          <div className="text-sm text-gray-600">Liver Items</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-2xl font-bold text-yellow-600">
            {filteredItems.filter(item => !item.medadvisor_review_result).length}
          </div>
          <div className="text-sm text-gray-600">Pending Review</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-2xl font-bold text-green-600">
            {filteredItems.filter(item => item.medadvisor_review_result === 'OK').length}
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
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Notes
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Image
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Review Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Review Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredItems.map((item) => (
                <tr key={item._id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Icon icon={getTypeIcon(item.type)} className="w-4 h-4 mr-2 text-gray-400" />
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getTypeColor(item.type)}`}>
                        {item.type}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{getClientName(item.client_id)}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm text-gray-900 max-w-xs truncate">
                      {item.notes || 'No notes'}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    {item.image ? (
                      <button
                        onClick={() => handleViewImage(item.image!)}
                        className="text-blue-600 hover:text-blue-900"
                        title="View Image"
                      >
                        <Icon icon={FiImage} className="w-4 h-4" />
                      </button>
                    ) : (
                      <span className="text-gray-400 text-xs">No image</span>
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
            <h2 className="text-lg font-semibold mb-4">Add New Medical Item</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                <select
                  value={formData.client_id || ''}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select a client</option>
                  {clients.map(client => (
                    <option key={client._id} value={client._id}>
                      {client.firstName} {client.lastName}
                    </option>
                  ))}
                </select>
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

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setFormData({});
                    setSelectedFile(null);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <AppleButton type="submit" className="apple-button-primary">
                  Create Item
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
                <select
                  value={formData.client_id || ''}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select a client</option>
                  {clients.map(client => (
                    <option key={client._id} value={client._id}>
                      {client.firstName} {client.lastName}
                    </option>
                  ))}
                </select>
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

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingItem(null);
                    setFormData({});
                    setSelectedFile(null);
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