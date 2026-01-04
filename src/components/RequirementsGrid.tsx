import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams, ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { requirementsApi } from '../services/api';
import { Requirement } from '../types';
import RetreatRequirementsGrid from './RetreatRequirementsGrid';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import './RetreatsGrid.css';

ModuleRegistry.registerModules([AllCommunityModule]);

const RequirementsGrid: React.FC = () => {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRequirement, setEditingRequirement] = useState<Requirement | null>(null);
  const [formData, setFormData] = useState<Partial<Requirement>>({});
  const [activeTab, setActiveTab] = useState<'requirements' | 'overview'>('requirements');
  const gridApiRef = useRef<GridApi | null>(null);

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

  const handleGridReady = (params: GridReadyEvent) => {
    gridApiRef.current = params.api;
    params.api.sizeColumnsToFit();
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

  const CategoryCellRenderer = (params: ICellRendererParams) => {
    const categoryColors: { [key: string]: string } = {
      payment: '#27ae60',
      medical: '#e74c3c',
      questionnaire: '#3498db',
      dietary: '#f39c12',
      document: '#9b59b6',
      other: '#95a5a6'
    };
    const color = categoryColors[params.value] || '#95a5a6';
    return (
      <span style={{
        color: color,
        fontWeight: 'bold',
        textTransform: 'capitalize'
      }}>
        {params.value}
      </span>
    );
  };

  const PriorityCellRenderer = (params: ICellRendererParams) => {
    const priorityColors: { [key: string]: string } = {
      low: '#95a5a6',
      medium: '#f39c12',
      high: '#e67e22',
      critical: '#e74c3c'
    };
    const color = priorityColors[params.value] || '#95a5a6';
    return (
      <span style={{
        color: color,
        fontWeight: 'bold',
        textTransform: 'capitalize'
      }}>
        {params.value}
      </span>
    );
  };

  const RequirementsCellRenderer = (params: ICellRendererParams) => {
    const requirements = [];
    if (params.data.requiresFile) requirements.push('📄 File');
    if (params.data.requiresAmount) requirements.push('💰 Amount');
    if (params.data.requiresApproval) requirements.push('✅ Approval');

    return (
      <span style={{ fontSize: '12px' }}>
        {requirements.join(', ') || 'None'}
      </span>
    );
  };

  const ActionCellRenderer = (params: ICellRendererParams) => {
    return (
      <div className="action-buttons">
        <button onClick={() => handleEdit(params.data)} className="edit-btn">✏️ Edit</button>
        <button onClick={() => handleDelete(params.data._id)} className="delete-btn">🗑️ Delete</button>
      </div>
    );
  };

  const columnDefs: ColDef[] = [
    { field: '_id', headerName: 'ID', hide: true },
    {
      field: 'order',
      headerName: 'Order',
      sortable: true,
      width: 80
    },
    {
      field: 'name',
      headerName: 'Requirement Name',
      sortable: true,
      filter: true,
      flex: 1
    },
    {
      field: 'category',
      headerName: 'Category',
      sortable: true,
      filter: true,
      cellRenderer: CategoryCellRenderer,
      width: 120
    },
    {
      field: 'weeksBeforeRetreat',
      headerName: 'Weeks Before',
      sortable: true,
      width: 120,
      valueFormatter: (params) => `${params.value} weeks`
    },
    {
      field: 'priority',
      headerName: 'Priority',
      sortable: true,
      filter: true,
      cellRenderer: PriorityCellRenderer,
      width: 100
    },
    {
      headerName: 'Requirements',
      cellRenderer: RequirementsCellRenderer,
      width: 150
    },
    {
      field: 'isActive',
      headerName: 'Active',
      sortable: true,
      width: 80,
      valueFormatter: (params) => params.value ? '✅' : '❌'
    },
    {
      headerName: 'Actions',
      cellRenderer: ActionCellRenderer,
      width: 150,
      suppressSizeToFit: true
    }
  ];

  const defaultColDef = {
    resizable: true,
    minWidth: 100
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

  return (
    <div className="retreats-container">
      <div className="retreats-header">
        <h2>📋 Requirements Management</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div className="tab-buttons" style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setActiveTab('requirements')}
              className={`tab-btn ${activeTab === 'requirements' ? 'active' : ''}`}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: '2px solid #e1e5e9',
                backgroundColor: activeTab === 'requirements' ? '#007bff' : 'white',
                color: activeTab === 'requirements' ? 'white' : '#333',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              ⚙️ Manage Requirements
            </button>
            <button
              onClick={() => setActiveTab('overview')}
              className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: '2px solid #e1e5e9',
                backgroundColor: activeTab === 'overview' ? '#007bff' : 'white',
                color: activeTab === 'overview' ? 'white' : '#333',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              👁️ Retreat Overview
            </button>
          </div>
          {activeTab === 'requirements' && (
            <>
              <button onClick={handleSeedRequirements} className="add-btn" style={{ backgroundColor: '#27ae60' }}>
                🌱 Seed Default Requirements
              </button>
              <button onClick={handleAdd} className="add-btn">➕ Add New Requirement</button>
              <div style={{ fontSize: '14px', color: '#666' }}>
                {isLoading ? 'Loading...' : `${requirements.length} requirements`}
              </div>
            </>
          )}
        </div>
      </div>

      {activeTab === 'overview' ? (
        <RetreatRequirementsGrid />
      ) : (
        <>

      {isLoading ? (
        <div style={{ padding: '40px', textAlign: 'center', fontSize: '18px', color: '#666' }}>
          Loading requirements...
        </div>
      ) : (
        <div className="ag-theme-alpine" style={{ height: 600, width: '100%' }}>
          <AgGridReact
            rowData={requirements}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            onGridReady={handleGridReady}
            animateRows={true}
            pagination={true}
            paginationPageSize={15}
            suppressNoRowsOverlay={false}
          />
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <h3>{editingRequirement ? 'Edit Requirement' : 'Add New Requirement'}</h3>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label htmlFor="name">Name*:</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name || ''}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="category">Category*:</label>
                  <select
                    id="category"
                    name="category"
                    value={formData.category || 'medical'}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="payment">Payment</option>
                    <option value="medical">Medical</option>
                    <option value="questionnaire">Questionnaire</option>
                    <option value="dietary">Dietary</option>
                    <option value="document">Document</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="weeksBeforeRetreat">Weeks Before Retreat*:</label>
                  <input
                    type="number"
                    id="weeksBeforeRetreat"
                    name="weeksBeforeRetreat"
                    value={formData.weeksBeforeRetreat || 4}
                    onChange={handleInputChange}
                    min="1"
                    max="52"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="gracePeriodWeeks">Grace Period (weeks):</label>
                  <input
                    type="number"
                    id="gracePeriodWeeks"
                    name="gracePeriodWeeks"
                    value={formData.gracePeriodWeeks || 1}
                    onChange={handleInputChange}
                    min="0"
                    max="4"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="priority">Priority:</label>
                  <select
                    id="priority"
                    name="priority"
                    value={formData.priority || 'medium'}
                    onChange={handleInputChange}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="order">Order:</label>
                  <input
                    type="number"
                    id="order"
                    name="order"
                    value={formData.order || 1}
                    onChange={handleInputChange}
                    min="1"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="description">Description*:</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description || ''}
                  onChange={handleInputChange}
                  rows={3}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="instructions">Instructions:</label>
                <textarea
                  id="instructions"
                  name="instructions"
                  value={formData.instructions || ''}
                  onChange={handleInputChange}
                  rows={2}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '15px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    name="requiresFile"
                    checked={formData.requiresFile || false}
                    onChange={handleInputChange}
                  />
                  Requires File Upload
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    name="requiresAmount"
                    checked={formData.requiresAmount || false}
                    onChange={handleInputChange}
                  />
                  Requires Amount
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    name="requiresApproval"
                    checked={formData.requiresApproval || false}
                    onChange={handleInputChange}
                  />
                  Requires Approval
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={formData.isActive !== false}
                    onChange={handleInputChange}
                  />
                  Active
                </label>
              </div>

              <div className="form-buttons">
                <button type="submit" className="save-btn">Save Requirement</button>
                <button type="button" onClick={() => setIsModalOpen(false)} className="cancel-btn">Cancel</button>
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