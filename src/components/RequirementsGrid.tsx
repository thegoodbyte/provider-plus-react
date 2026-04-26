import React, { useState, useEffect, useCallback } from 'react';
import { requirementsApi } from '../services/api';
import { Requirement } from '../types';
import RetreatRequirementsGrid from './RetreatRequirementsGrid';
import AppleButton from './AppleButton';
import { FiPlus, FiEdit2, FiTrash2, FiCheck, FiX, FiPackage } from 'react-icons/fi';

// Simple wrapper to fix TypeScript icon issues
const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

const RequirementsGrid: React.FC = () => {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRequirement, setEditingRequirement] = useState<Requirement | null>(null);
  const [formData, setFormData] = useState<Partial<Requirement>>({});
  const [activeTab, setActiveTab] = useState<'requirements' | 'overview'>('requirements');

  const fetchRequirements = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await requirementsApi.getAll();
      setRequirements(response.data || []);
    } catch (error: any) {
      console.error('Error fetching requirements:', error);
      setRequirements([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequirements();
  }, [fetchRequirements]);

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      payment: 'bg-green-100 text-green-800',
      medical: 'bg-red-100 text-red-800',
      questionnaire: 'bg-blue-100 text-blue-800',
      dietary: 'bg-yellow-100 text-yellow-800',
      document: 'bg-purple-100 text-purple-800',
      other: 'bg-gray-100 text-gray-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority: string) => {
    const colors: { [key: string]: string } = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  const handleAdd = () => {
    setEditingRequirement(null);
    setFormData({
      category: 'medical',
      priority: 'medium',
      isActive: true,
      requiresFile: false,
      requiresAmount: false,
      requiresApproval: false,
      weeksBeforeRetreat: 4,
      gracePeriodWeeks: 1,
      order: requirements.length + 1
    });
    setIsModalOpen(true);
  };

  const handleEdit = (requirement: Requirement) => {
    setEditingRequirement(requirement);
    setFormData({ ...requirement });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this requirement?')) {
      try {
        await requirementsApi.delete(id);
        fetchRequirements();
      } catch (error) {
        console.error('Error deleting requirement:', error);
      }
    }
  };

  const handleSeedRequirements = async () => {
    if (window.confirm('This will create default requirements. Continue?')) {
      try {
        await requirementsApi.seed();
        fetchRequirements();
        alert('Default requirements created successfully!');
      } catch (error) {
        console.error('Error seeding requirements:', error);
        alert('Error creating default requirements');
      }
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const cleanData: any = {};

      if (formData.name?.trim()) cleanData.name = formData.name.trim();
      if (formData.description?.trim()) cleanData.description = formData.description.trim();
      if (formData.category) cleanData.category = formData.category;
      if (formData.weeksBeforeRetreat !== undefined) cleanData.weeksBeforeRetreat = Number(formData.weeksBeforeRetreat);
      if (formData.gracePeriodWeeks !== undefined) cleanData.gracePeriodWeeks = Number(formData.gracePeriodWeeks);
      if (formData.priority) cleanData.priority = formData.priority;
      if (formData.order !== undefined) cleanData.order = Number(formData.order);
      if (formData.instructions?.trim()) cleanData.instructions = formData.instructions.trim();

      cleanData.isActive = formData.isActive !== false;
      cleanData.requiresFile = formData.requiresFile === true;
      cleanData.requiresAmount = formData.requiresAmount === true;
      cleanData.requiresApproval = formData.requiresApproval === true;

      if (editingRequirement) {
        await requirementsApi.update(editingRequirement._id!, cleanData);
      } else {
        await requirementsApi.create(cleanData);
      }

      setIsModalOpen(false);
      setFormData({});
      setEditingRequirement(null);
      fetchRequirements();
    } catch (error: any) {
      console.error('Error saving requirement:', error);
      alert('Error saving requirement: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked :
              (name === 'weeksBeforeRetreat' || name === 'gracePeriodWeeks' || name === 'order') ? parseInt(value) || 0 :
              value
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading requirements...</div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">📋 Requirements Management</h1>
        <div className="flex items-center gap-4">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('requirements')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'requirements'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              ⚙️ Manage Requirements
            </button>
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'overview'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              👁️ Retreat Overview
            </button>
          </div>
          {activeTab === 'requirements' && (
            <>
              <AppleButton onClick={handleSeedRequirements} className="apple-button-secondary">
                <Icon icon={FiPackage} className="w-4 h-4 mr-2" />
                Seed Defaults
              </AppleButton>
              <AppleButton onClick={handleAdd} className="apple-button-primary">
                <Icon icon={FiPlus} className="w-4 h-4 mr-2" />
                Add Requirement
              </AppleButton>
            </>
          )}
        </div>
      </div>

      {activeTab === 'overview' ? (
        <RetreatRequirementsGrid />
      ) : (
        <>
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Requirement Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timing
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Priority
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Requirements
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {requirements.map((requirement) => (
                    <tr key={requirement._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {requirement.order}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{requirement.name}</div>
                        {requirement.description && (
                          <div className="text-sm text-gray-500">{requirement.description}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getCategoryColor(requirement.category)}`}>
                          {requirement.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {requirement.weeksBeforeRetreat} weeks before
                        {requirement.gracePeriodWeeks && (
                          <div className="text-xs text-gray-500">
                            +{requirement.gracePeriodWeeks} week grace
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getPriorityColor(requirement.priority || 'medium')}`}>
                          {requirement.priority || 'medium'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1 text-xs">
                          {requirement.requiresFile && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">📄 File</span>
                          )}
                          {requirement.requiresAmount && (
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded">💰 Amount</span>
                          )}
                          {requirement.requiresApproval && (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded">✅ Approval</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {requirement.isActive ? (
                            <Icon icon={FiCheck} className="w-5 h-5 text-green-500" />
                          ) : (
                            <Icon icon={FiX} className="w-5 h-5 text-red-500" />
                          )}
                          <span className="ml-2 text-sm text-gray-900">
                            {requirement.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(requirement)}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="Edit"
                          >
                            <Icon icon={FiEdit2} className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(requirement._id!)}
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
              {requirements.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No requirements found
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-700">
            Showing {requirements.length} requirement{requirements.length !== 1 ? 's' : ''}
          </div>

          {isModalOpen && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
              <div className="bg-white p-6 rounded-lg shadow-xl max-w-2xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  {editingRequirement ? 'Edit Requirement' : 'Add New Requirement'}
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                        Name*
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name || ''}
                        onChange={handleInputChange}
                        required
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      />
                    </div>

                    <div>
                      <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                        Category*
                      </label>
                      <select
                        id="category"
                        name="category"
                        value={formData.category || 'medical'}
                        onChange={handleInputChange}
                        required
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      >
                        <option value="payment">Payment</option>
                        <option value="medical">Medical</option>
                        <option value="questionnaire">Questionnaire</option>
                        <option value="dietary">Dietary</option>
                        <option value="document">Document</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label htmlFor="weeksBeforeRetreat" className="block text-sm font-medium text-gray-700">
                        Weeks Before*
                      </label>
                      <input
                        type="number"
                        id="weeksBeforeRetreat"
                        name="weeksBeforeRetreat"
                        value={formData.weeksBeforeRetreat || 4}
                        onChange={handleInputChange}
                        min="1"
                        max="52"
                        required
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      />
                    </div>

                    <div>
                      <label htmlFor="gracePeriodWeeks" className="block text-sm font-medium text-gray-700">
                        Grace Period
                      </label>
                      <input
                        type="number"
                        id="gracePeriodWeeks"
                        name="gracePeriodWeeks"
                        value={formData.gracePeriodWeeks || 1}
                        onChange={handleInputChange}
                        min="0"
                        max="4"
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      />
                    </div>

                    <div>
                      <label htmlFor="priority" className="block text-sm font-medium text-gray-700">
                        Priority
                      </label>
                      <select
                        id="priority"
                        name="priority"
                        value={formData.priority || 'medium'}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="order" className="block text-sm font-medium text-gray-700">
                        Order
                      </label>
                      <input
                        type="number"
                        id="order"
                        name="order"
                        value={formData.order || 1}
                        onChange={handleInputChange}
                        min="1"
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                      Description*
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description || ''}
                      onChange={handleInputChange}
                      rows={3}
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="instructions" className="block text-sm font-medium text-gray-700">
                      Instructions
                    </label>
                    <textarea
                      id="instructions"
                      name="instructions"
                      value={formData.instructions || ''}
                      onChange={handleInputChange}
                      rows={2}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="requiresFile"
                        checked={formData.requiresFile || false}
                        onChange={handleInputChange}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm text-gray-900">File Upload</span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="requiresAmount"
                        checked={formData.requiresAmount || false}
                        onChange={handleInputChange}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm text-gray-900">Amount</span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="requiresApproval"
                        checked={formData.requiresApproval || false}
                        onChange={handleInputChange}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm text-gray-900">Approval</span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="isActive"
                        checked={formData.isActive !== false}
                        onChange={handleInputChange}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm text-gray-900">Active</span>
                    </label>
                  </div>

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700"
                    >
                      Save Requirement
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default RequirementsGrid;