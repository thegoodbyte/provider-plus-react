import React, { useState, useEffect } from 'react';
import { retreatsApi } from '../services/api';
import { Retreat } from '../types';
import AppleButton from './AppleButton';
import RetreatDetailView from './RetreatDetailView';
import { FiPlus, FiEdit2, FiTrash2, FiEye, FiCalendar, FiMapPin } from 'react-icons/fi';

// Simple wrapper to fix TypeScript icon issues
const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

const RetreatsGrid: React.FC = () => {
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewingRetreatId, setViewingRetreatId] = useState<string | null>(null);
  const [editingRetreat, setEditingRetreat] = useState<Retreat | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Retreat>>({});

  useEffect(() => {
    fetchRetreats();
  }, []);

  const fetchRetreats = async () => {
    try {
      setIsLoading(true);
      const response = await retreatsApi.getAll();
      setRetreats(response.data || []);
    } catch (error) {
      console.error('Error fetching retreats:', error);
      setRetreats([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      upcoming: 'bg-blue-100 text-blue-800',
      active: 'bg-green-100 text-green-800',
      completed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this retreat?')) {
      try {
        await retreatsApi.delete(id);
        fetchRetreats();
      } catch (error) {
        console.error('Error deleting retreat:', error);
      }
    }
  };

  const formatDate = (date: string | Date | undefined) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  };

  // If viewing a specific retreat, show the detail view
  if (viewingRetreatId) {
    return (
      <RetreatDetailView
        retreatId={viewingRetreatId}
        onBack={() => setViewingRetreatId(null)}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading retreats...</div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Retreats</h1>
        <AppleButton
          onClick={() => {
            setFormData({
              name: '',
              location: '',
              status: 'upcoming',
              capacity: 20,
              currentOccupancy: 0,
              type: 'regular'
            });
            setIsAddModalOpen(true);
          }}
          className="apple-button-primary"
        >
          <Icon icon={FiPlus} className="w-4 h-4 mr-2" />
          Add Retreat
        </AppleButton>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dates
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Capacity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {retreats.map((retreat) => (
                <tr key={retreat._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{retreat.name}</div>
                    {retreat.description && (
                      <div className="text-sm text-gray-500 truncate max-w-xs">
                        {retreat.description}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900">
                      <Icon icon={FiCalendar} className="w-4 h-4 mr-1 text-gray-400" />
                      <div>
                        <div>{formatDate(retreat.startDate)}</div>
                        <div className="text-xs text-gray-500">to {formatDate(retreat.endDate)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900">
                      <Icon icon={FiMapPin} className="w-4 h-4 mr-1 text-gray-400" />
                      {retreat.location || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {retreat.capacity ? `${retreat.currentOccupancy || 0}/${retreat.capacity}` : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(retreat.status || 'upcoming')}`}>
                      {retreat.status || 'upcoming'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {retreat.type || 'regular'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setViewingRetreatId(retreat._id!)}
                        className="text-blue-600 hover:text-blue-900"
                        title="View Details"
                      >
                        <Icon icon={FiEye} className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingRetreat(retreat);
                          setFormData(retreat);
                          setIsEditModalOpen(true);
                        }}
                        className="text-indigo-600 hover:text-indigo-900"
                        title="Edit"
                      >
                        <Icon icon={FiEdit2} className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(retreat._id!)}
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
          {retreats.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No retreats found
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-gray-700">
          Showing {retreats.length} retreat{retreats.length !== 1 ? 's' : ''}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-700">
            Upcoming: {retreats.filter(r => r.status === 'upcoming').length}
          </div>
          <div className="text-sm text-gray-700">
            Active: {retreats.filter(r => r.status === 'active').length}
          </div>
          <div className="text-sm text-gray-700">
            Completed: {retreats.filter(r => r.status === 'completed').length}
          </div>
        </div>
      </div>

      {/* Add Retreat Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md">
            <h2 className="text-lg font-semibold mb-4">Add New Retreat</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter retreat name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={formData.location || ''}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter location"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Capacity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.capacity || 20}
                    onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 20 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type
                  </label>
                  <select
                    value={formData.type || 'regular'}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as 'regular' | 'booster' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="regular">Regular</option>
                    <option value="booster">Booster</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Enter description (optional)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={formData.startDate ? new Date(formData.startDate).toISOString().split('T')[0] : ''}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={formData.endDate ? new Date(formData.endDate).toISOString().split('T')[0] : ''}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setFormData({});
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <AppleButton
                onClick={async () => {
                  try {
                    if (!formData.name || !formData.location) {
                      alert('Please enter name and location');
                      return;
                    }

                    const retreatData = {
                      name: formData.name!,
                      location: formData.location!,
                      status: formData.status || 'upcoming' as 'upcoming' | 'active' | 'completed' | 'cancelled',
                      capacity: formData.capacity || 20,
                      currentOccupancy: formData.currentOccupancy || 0,
                      type: formData.type || 'regular' as 'regular' | 'booster',
                      description: formData.description || '',
                      startDate: formData.startDate,
                      endDate: formData.endDate
                    };
                    await retreatsApi.create(retreatData);
                    fetchRetreats();
                    setIsAddModalOpen(false);
                    setFormData({});
                  } catch (error) {
                    console.error('Error creating retreat:', error);
                    alert('Error creating retreat. Please try again.');
                  }
                }}
                className="apple-button-primary"
              >
                Create Retreat
              </AppleButton>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md">
            <h2 className="text-lg font-semibold mb-4">Edit Retreat</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={formData.location || ''}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={formData.status || 'upcoming'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'upcoming' | 'active' | 'completed' | 'cancelled' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingRetreat(null);
                  setFormData({});
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <AppleButton
                onClick={async () => {
                  try {
                    if (editingRetreat?._id) {
                      await retreatsApi.update(editingRetreat._id, formData);
                      fetchRetreats();
                      setIsEditModalOpen(false);
                      setEditingRetreat(null);
                      setFormData({});
                    }
                  } catch (error) {
                    console.error('Error updating retreat:', error);
                  }
                }}
                className="apple-button-primary"
              >
                Save Changes
              </AppleButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RetreatsGrid;