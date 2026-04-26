import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiPlay, FiPause, FiRefreshCw } from 'react-icons/fi';
import './AutoReminderTemplates.css';

// Simple wrapper to fix TypeScript icon issues
const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

export interface ReminderTemplate {
  _id?: string;
  name: string;
  description: string;
  daysBeforeRetreat: number;
  actionType: 'ask_for_document' | 'review_document' | 'follow_up' | 'medical_clearance' | 'general' | 'payment';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  documentType?: string; // For ask_for_document actions
  title: string;
  isActive: boolean;
  autoAssignToAllClients: boolean; // If true, assigns to all clients in retreat
  createdAt?: Date;
  updatedAt?: Date;
}

export const AutoReminderTemplates: React.FC = () => {
  const [templates, setTemplates] = useState<ReminderTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ReminderTemplate | null>(null);
  const [formData, setFormData] = useState<Partial<ReminderTemplate>>({
    name: '',
    description: '',
    daysBeforeRetreat: 30,
    actionType: 'ask_for_document',
    priority: 'medium',
    documentType: '',
    title: '',
    isActive: true,
    autoAssignToAllClients: true
  });

  // Default templates
  const defaultTemplates: Omit<ReminderTemplate, '_id'>[] = [
    {
      name: 'Drug Intake Form - 30 Days',
      description: 'Request drug intake document from all retreat participants',
      daysBeforeRetreat: 30,
      actionType: 'ask_for_document',
      priority: 'high',
      documentType: 'drug_intake',
      title: 'Please submit your Drug Intake Form',
      isActive: true,
      autoAssignToAllClients: true
    },
    {
      name: 'Food Questionnaire - 14 Days',
      description: 'Request food questionnaire from all retreat participants',
      daysBeforeRetreat: 14,
      actionType: 'ask_for_document',
      priority: 'high',
      documentType: 'food_questionnaire',
      title: 'Please complete your Food Questionnaire',
      isActive: true,
      autoAssignToAllClients: true
    },
    {
      name: 'Medical Information Review - 45 Days',
      description: 'Review medical information for all retreat guests',
      daysBeforeRetreat: 45,
      actionType: 'review_document',
      priority: 'urgent',
      documentType: 'medical_clearance',
      title: 'Review Medical Information',
      isActive: true,
      autoAssignToAllClients: false
    },
    {
      name: 'Travel Details - 7 Days',
      description: 'Follow up on travel arrangements',
      daysBeforeRetreat: 7,
      actionType: 'follow_up',
      priority: 'medium',
      title: 'Confirm Travel Arrangements',
      isActive: true,
      autoAssignToAllClients: true
    },
    {
      name: 'Final Payment - 21 Days',
      description: 'Request final payment for retreat',
      daysBeforeRetreat: 21,
      actionType: 'payment',
      priority: 'high',
      title: 'Final Payment Due',
      isActive: true,
      autoAssignToAllClients: true
    }
  ];

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = () => {
    setIsLoading(true);
    // For now, we'll use localStorage to store templates
    const savedTemplates = localStorage.getItem('reminderTemplates');
    if (savedTemplates) {
      setTemplates(JSON.parse(savedTemplates));
    } else {
      // Initialize with default templates
      const templatesWithIds = defaultTemplates.map((template, index) => ({
        ...template,
        _id: `template_${index + 1}`,
        createdAt: new Date(),
        updatedAt: new Date()
      }));
      setTemplates(templatesWithIds);
      localStorage.setItem('reminderTemplates', JSON.stringify(templatesWithIds));
    }
    setIsLoading(false);
  };

  const saveTemplate = (template: Partial<ReminderTemplate>) => {
    const newTemplate = {
      ...template,
      _id: editingTemplate?._id || `template_${Date.now()}`,
      createdAt: editingTemplate?.createdAt || new Date(),
      updatedAt: new Date()
    } as ReminderTemplate;

    let updatedTemplates;
    if (editingTemplate) {
      updatedTemplates = templates.map(t => t._id === editingTemplate._id ? newTemplate : t);
    } else {
      updatedTemplates = [...templates, newTemplate];
    }

    setTemplates(updatedTemplates);
    localStorage.setItem('reminderTemplates', JSON.stringify(updatedTemplates));
  };

  const deleteTemplate = (id: string) => {
    const updatedTemplates = templates.filter(t => t._id !== id);
    setTemplates(updatedTemplates);
    localStorage.setItem('reminderTemplates', JSON.stringify(updatedTemplates));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveTemplate(formData);
    setShowAddForm(false);
    setEditingTemplate(null);
    setFormData({
      name: '',
      description: '',
      daysBeforeRetreat: 30,
      actionType: 'ask_for_document',
      priority: 'medium',
      documentType: '',
      title: '',
      isActive: true,
      autoAssignToAllClients: true
    });
  };

  const handleEdit = (template: ReminderTemplate) => {
    setEditingTemplate(template);
    setFormData(template);
    setShowAddForm(true);
  };

  const handleToggleActive = (template: ReminderTemplate) => {
    const updatedTemplate = { ...template, isActive: !template.isActive, updatedAt: new Date() };
    const updatedTemplates = templates.map(t => t._id === template._id ? updatedTemplate : t);
    setTemplates(updatedTemplates);
    localStorage.setItem('reminderTemplates', JSON.stringify(updatedTemplates));
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800'
    };
    return colors[priority] || 'bg-yellow-100 text-yellow-800';
  };

  const getActionTypeLabel = (actionType: string) => {
    const actionTypeMap: { [key: string]: string } = {
      'ask_for_document': 'Ask for Document',
      'review_document': 'Review Document',
      'follow_up': 'Follow Up',
      'medical_clearance': 'Medical Clearance',
      'general': 'General',
      'payment': 'Payment'
    };
    return actionTypeMap[actionType] || actionType;
  };

  const handleDeleteTemplate = (id: string) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      deleteTemplate(id);
    }
  };

  return (
    <div className="auto-reminder-templates">
      <div className="templates-header">
        <h2>🤖 Automatic Reminder Templates</h2>
        <p>Configure automatic reminders that will be created for retreat participants based on retreat dates.</p>

        <div className="flex gap-2">
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
            disabled={showAddForm}
          >
            <Icon icon={FiPlus} className="w-4 h-4" />
            Add Template
          </button>
          <button
            onClick={loadTemplates}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center gap-2"
          >
            <Icon icon={FiRefreshCw} className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Templates Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden mt-6">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Days Before
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Auto Assign
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {templates.map((template) => (
                <tr key={template._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{template.name}</div>
                    <div className="text-sm text-gray-500 truncate max-w-xs">
                      {template.description}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {template.daysBeforeRetreat} days
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {getActionTypeLabel(template.actionType)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getPriorityColor(template.priority)}`}>
                      {template.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {template.autoAssignToAllClients ? (
                      <span className="text-green-600 font-medium">All Clients</span>
                    ) : (
                      <span className="text-gray-500">Manual</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${template.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {template.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 max-w-xs truncate">
                    {template.title}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(template)}
                        className="text-indigo-600 hover:text-indigo-900"
                        title="Edit"
                      >
                        <Icon icon={FiEdit2} className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(template)}
                        className={`${template.isActive ? 'text-yellow-600 hover:text-yellow-900' : 'text-green-600 hover:text-green-900'}`}
                        title={template.isActive ? 'Pause' : 'Activate'}
                      >
                        <Icon icon={template.isActive ? FiPause : FiPlay} className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(template._id!)}
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
          {templates.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No templates found
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Form Modal */}
      {showAddForm && (
        <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
          <div className="modal template-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingTemplate ? 'Edit Template' : 'Create New Template'}</h3>
            <form onSubmit={handleFormSubmit}>
              <div className="template-form-grid">
                <div className="form-group">
                  <label htmlFor="template-name">Template Name *</label>
                  <input
                    type="text"
                    id="template-name"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                    placeholder="e.g., Drug Intake Form - 30 Days"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="template-days">Days Before Retreat *</label>
                  <input
                    type="number"
                    id="template-days"
                    value={formData.daysBeforeRetreat || 30}
                    onChange={(e) => setFormData({...formData, daysBeforeRetreat: parseInt(e.target.value)})}
                    required
                    min="1"
                    max="365"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="template-priority">Priority</label>
                  <select
                    id="template-priority"
                    value={formData.priority || 'medium'}
                    onChange={(e) => setFormData({...formData, priority: e.target.value as any})}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="template-action-type">Action Type</label>
                  <select
                    id="template-action-type"
                    value={formData.actionType || 'ask_for_document'}
                    onChange={(e) => setFormData({...formData, actionType: e.target.value as any})}
                  >
                    <option value="ask_for_document">Ask for Document</option>
                    <option value="review_document">Review Document</option>
                    <option value="follow_up">Follow Up</option>
                    <option value="medical_clearance">Medical Clearance</option>
                    <option value="payment">Payment</option>
                    <option value="general">General</option>
                  </select>
                </div>

                <div className="form-group full-width">
                  <label htmlFor="template-title">Reminder Title *</label>
                  <input
                    type="text"
                    id="template-title"
                    value={formData.title || ''}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    required
                    placeholder="e.g., Please submit your Drug Intake Form"
                  />
                </div>

                <div className="form-group full-width">
                  <label htmlFor="template-description">Description *</label>
                  <textarea
                    id="template-description"
                    value={formData.description || ''}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    rows={3}
                    required
                    placeholder="Describe what this reminder is for..."
                  />
                </div>

                {formData.actionType === 'ask_for_document' && (
                  <div className="form-group full-width">
                    <label htmlFor="template-document-type">Document Type</label>
                    <input
                      type="text"
                      id="template-document-type"
                      value={formData.documentType || ''}
                      onChange={(e) => setFormData({...formData, documentType: e.target.value})}
                      placeholder="e.g., drug_intake, food_questionnaire, medical_clearance"
                    />
                  </div>
                )}

                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.autoAssignToAllClients || false}
                      onChange={(e) => setFormData({...formData, autoAssignToAllClients: e.target.checked})}
                    />
                    Auto-assign to all retreat clients
                  </label>
                </div>

                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.isActive !== false}
                      onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                    />
                    Template is active
                  </label>
                </div>
              </div>

              <div className="form-buttons">
                <button type="submit" className="save-btn">
                  {editingTemplate ? 'Update Template' : 'Create Template'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingTemplate(null);
                    setFormData({
                      name: '',
                      description: '',
                      daysBeforeRetreat: 30,
                      actionType: 'ask_for_document',
                      priority: 'medium',
                      documentType: '',
                      title: '',
                      isActive: true,
                      autoAssignToAllClients: true
                    });
                  }}
                  className="cancel-btn"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};