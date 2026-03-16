import React, { useState, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import './AutoReminderTemplates.css';

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

  const columnDefs: ColDef[] = [
    {
      headerName: 'Name',
      field: 'name',
      width: 200,
      pinned: 'left'
    },
    {
      headerName: 'Days Before',
      field: 'daysBeforeRetreat',
      width: 120,
      cellRenderer: (params: ICellRendererParams) => `${params.value} days`
    },
    {
      headerName: 'Action Type',
      field: 'actionType',
      width: 140,
      cellRenderer: (params: ICellRendererParams) => {
        const actionTypeMap: { [key: string]: string } = {
          'ask_for_document': 'Ask for Document',
          'review_document': 'Review Document',
          'follow_up': 'Follow Up',
          'medical_clearance': 'Medical Clearance',
          'general': 'General',
          'payment': 'Payment'
        };
        return actionTypeMap[params.value] || params.value;
      }
    },
    {
      headerName: 'Priority',
      field: 'priority',
      width: 100,
      cellRenderer: (params: ICellRendererParams) => {
        const colors = {
          low: '#28a745',
          medium: '#ffc107',
          high: '#fd7e14',
          urgent: '#dc3545'
        };
        return `<span style="color: ${colors[params.value as keyof typeof colors]}; font-weight: bold;">${params.value.toUpperCase()}</span>`;
      }
    },
    {
      headerName: 'Auto Assign',
      field: 'autoAssignToAllClients',
      width: 120,
      cellRenderer: (params: ICellRendererParams) => params.value ? '✅ All Clients' : '❌ Manual'
    },
    {
      headerName: 'Status',
      field: 'isActive',
      width: 100,
      cellRenderer: (params: ICellRendererParams) => {
        return `<span style="color: ${params.value ? '#28a745' : '#dc3545'}; font-weight: bold;">${params.value ? 'Active' : 'Inactive'}</span>`;
      }
    },
    {
      headerName: 'Title',
      field: 'title',
      width: 250,
      flex: 1
    },
    {
      headerName: 'Actions',
      width: 150,
      cellRenderer: (params: ICellRendererParams) => {
        const template = params.data as ReminderTemplate;
        return `
          <div class="action-buttons">
            <button class="edit-btn" onclick="window.editTemplate('${template._id}')">✏️</button>
            <button class="toggle-btn" onclick="window.toggleActive('${template._id}')">${template.isActive ? '⏸️' : '▶️'}</button>
            <button class="delete-btn" onclick="window.deleteTemplate('${template._id}')">🗑️</button>
          </div>
        `;
      }
    }
  ];

  // Expose functions to window for button clicks
  React.useEffect(() => {
    (window as any).editTemplate = (id: string) => {
      const template = templates.find(t => t._id === id);
      if (template) handleEdit(template);
    };
    (window as any).toggleActive = (id: string) => {
      const template = templates.find(t => t._id === id);
      if (template) handleToggleActive(template);
    };
    (window as any).deleteTemplate = (id: string) => {
      if (window.confirm('Are you sure you want to delete this template?')) {
        deleteTemplate(id);
      }
    };
  }, [templates]);

  return (
    <div className="auto-reminder-templates">
      <div className="templates-header">
        <h2>🤖 Automatic Reminder Templates</h2>
        <p>Configure automatic reminders that will be created for retreat participants based on retreat dates.</p>

        <div className="templates-controls">
          <button
            onClick={() => setShowAddForm(true)}
            className="add-btn"
            disabled={showAddForm}
          >
            ➕ Add Template
          </button>
          <button onClick={loadTemplates} className="refresh-btn">
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="ag-theme-alpine templates-grid">
        <AgGridReact
          rowData={templates}
          columnDefs={columnDefs}
          domLayout="autoHeight"
          pagination={true}
          paginationPageSize={20}
          loading={isLoading}
          suppressHorizontalScroll={false}
        />
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