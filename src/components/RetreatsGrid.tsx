import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams, ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { retreatsApi, housesApi } from '../services/api';
import { Retreat, House } from '../types';
import RetreatDetailView from './RetreatDetailView';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import './RetreatsGrid.css';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

const RetreatsGrid: React.FC = () => {
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [houses, setHouses] = useState<House[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRetreat, setEditingRetreat] = useState<Retreat | null>(null);
  const [formData, setFormData] = useState<Partial<Retreat>>({});
  const [viewingRetreatId, setViewingRetreatId] = useState<string | null>(null);
  const gridApiRef = useRef<GridApi | null>(null);

  const fetchRetreats = useCallback(async () => {
    try {
      console.log('Starting to fetch retreats...');
      setIsLoading(true);
      const response = await retreatsApi.getAll();
      console.log('Retreats API response received:', response);
      setRetreats(response.data || []);
    } catch (error: any) {
      console.error('Error fetching retreats:', error);
      setRetreats([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchHouses = useCallback(async () => {
    try {
      console.log('Fetching houses...');
      const response = await housesApi.getAll();
      console.log('Houses response:', response.data);
      setHouses(response.data);
    } catch (error: any) {
      console.error('Error fetching houses:', error);
      setHouses([]);
    }
  }, []);

  useEffect(() => {
    fetchRetreats();
    fetchHouses();
  }, [fetchRetreats, fetchHouses]);

  const handleGridReady = (params: GridReadyEvent) => {
    gridApiRef.current = params.api;
    params.api.sizeColumnsToFit();
  };

  const handleAdd = () => {
    setEditingRetreat(null);
    setFormData({
      status: 'upcoming',
      currentOccupancy: 0
    });
    setIsModalOpen(true);
  };

  const handleView = (retreat: Retreat) => {
    setViewingRetreatId(retreat._id!);
  };

  const handleEdit = (retreat: Retreat) => {
    setEditingRetreat(retreat);
    const formattedRetreat = {
      ...retreat,
      startDate: retreat.startDate || retreat.dates?.startDate || '',
      endDate: retreat.endDate || '',
      capacity: retreat.capacity || 0,
      currentOccupancy: retreat.currentOccupancy || 0
    };
    setFormData(formattedRetreat);
    setIsModalOpen(true);
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

  const ActionCellRenderer = (params: ICellRendererParams) => {
    return (
      <div className="action-buttons">
        <button onClick={() => handleView(params.data)} className="view-btn">👁️ View</button>
        <button onClick={() => handleEdit(params.data)} className="edit-btn">✏️ Edit</button>
        <button onClick={() => handleDelete(params.data._id)} className="delete-btn">🗑️ Delete</button>
      </div>
    );
  };

  const columnDefs: ColDef[] = [
    { field: '_id', headerName: 'ID', hide: true },
    { field: 'name', headerName: 'Name', sortable: true, filter: true },
    { field: 'location', headerName: 'Location', sortable: true, filter: true },
    {
      field: 'startDate',
      headerName: 'Start Date',
      sortable: true,
      filter: true,
      valueGetter: (params) => {
        return params.data.startDate || params.data.dates?.startDate || '';
      },
      valueFormatter: (params) => {
        if (params.value) {
          return new Date(params.value).toLocaleDateString();
        }
        return '';
      }
    },
    {
      field: 'endDate',
      headerName: 'End Date',
      sortable: true,
      filter: true,
      valueGetter: (params) => {
        return params.data.endDate || '';
      },
      valueFormatter: (params) => {
        if (params.value) {
          return new Date(params.value).toLocaleDateString();
        }
        return '';
      }
    },
    {
      field: 'capacity',
      headerName: 'Capacity',
      sortable: true,
      filter: true,
      valueFormatter: (params) => params.value || 'N/A'
    },
    {
      field: 'currentOccupancy',
      headerName: 'Current Occupancy',
      sortable: true,
      filter: true,
      valueFormatter: (params) => params.value || '0'
    },
    { field: 'status', headerName: 'Status', sortable: true, filter: true },
    { field: 'description', headerName: 'Description', flex: 1 },
    {
      field: 'houseId',
      headerName: 'House',
      valueGetter: (params) => {
        const house = houses.find(h => h._id === params.data.houseId);
        return house ? (house.name || house.city || 'Unnamed House') : '';
      }
    },
    {
      headerName: 'Actions',
      cellRenderer: ActionCellRenderer,
      width: 200,
      suppressSizeToFit: true
    }
  ];

  const defaultColDef = {
    resizable: true,
    minWidth: 100,
    flex: 1
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      console.log('Submitting form with data:', formData);

      const cleanData: any = {};

      if (formData.name?.trim()) cleanData.name = formData.name.trim();
      if (formData.location?.trim()) cleanData.location = formData.location.trim();
      if (formData.startDate) cleanData.startDate = formData.startDate;
      if (formData.endDate) cleanData.endDate = formData.endDate;
      if (formData.capacity && formData.capacity > 0) cleanData.capacity = Number(formData.capacity);
      if (formData.currentOccupancy !== undefined) cleanData.currentOccupancy = Number(formData.currentOccupancy);
      if (formData.description?.trim()) cleanData.description = formData.description.trim();
      if (formData.houseId?.trim()) cleanData.houseId = formData.houseId.trim();
      if (formData.status) cleanData.status = formData.status;

      console.log('Cleaned data for submission:', cleanData);

      if (editingRetreat) {
        await retreatsApi.update(editingRetreat._id!, cleanData);
      } else {
        await retreatsApi.create(cleanData);
      }
      setIsModalOpen(false);
      setFormData({});
      setEditingRetreat(null);
      fetchRetreats();
    } catch (error: any) {
      console.error('Error saving retreat:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'capacity' || name === 'currentOccupancy' ? parseInt(value) : value
    }));
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

  return (
    <div className="retreats-container">
      <div className="retreats-header">
        <h2>🏃‍♂️ Retreats Management</h2>
        <button onClick={handleAdd} className="add-btn">➕ Add New Retreat</button>
        <div style={{ marginLeft: '20px', fontSize: '14px', color: '#666' }}>
          Status: {isLoading ? 'Loading...' : `${retreats.length} retreats loaded`}
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: '40px', textAlign: 'center', fontSize: '18px', color: '#666' }}>
          Loading retreats...
        </div>
      ) : (
        <div className="ag-theme-alpine" style={{ height: 600, width: '100%' }}>
          <AgGridReact
            rowData={retreats}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            onGridReady={handleGridReady}
            animateRows={true}
            pagination={true}
            paginationPageSize={10}
            suppressNoRowsOverlay={false}
          />
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingRetreat ? 'Edit Retreat' : 'Add New Retreat'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="name">Name:</label>
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
                <label htmlFor="location">Location:</label>
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={formData.location || ''}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="startDate">Start Date:</label>
                <input
                  type="date"
                  id="startDate"
                  name="startDate"
                  value={formData.startDate ? new Date(formData.startDate).toISOString().split('T')[0] : ''}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label htmlFor="endDate">End Date:</label>
                <input
                  type="date"
                  id="endDate"
                  name="endDate"
                  value={formData.endDate ? new Date(formData.endDate).toISOString().split('T')[0] : ''}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label htmlFor="capacity">Capacity:</label>
                <input
                  type="number"
                  id="capacity"
                  name="capacity"
                  value={formData.capacity || ''}
                  onChange={handleInputChange}
                  min="0"
                />
              </div>

              <div className="form-group">
                <label htmlFor="currentOccupancy">Current Occupancy:</label>
                <input
                  type="number"
                  id="currentOccupancy"
                  name="currentOccupancy"
                  value={formData.currentOccupancy || 0}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label htmlFor="houseId">House:</label>
                <select
                  id="houseId"
                  name="houseId"
                  value={formData.houseId || ''}
                  onChange={handleInputChange}
                >
                  <option value="">Select a house</option>
                  {houses.map(house => (
                    <option key={house._id} value={house._id}>
                      {house.name || house.city || 'Unnamed House'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="status">Status:</label>
                <select
                  id="status"
                  name="status"
                  value={formData.status || 'upcoming'}
                  onChange={handleInputChange}
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="description">Description:</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description || ''}
                  onChange={handleInputChange}
                  rows={3}
                />
              </div>

              <div className="form-buttons">
                <button type="submit" className="save-btn">Save</button>
                <button type="button" onClick={() => setIsModalOpen(false)} className="cancel-btn">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RetreatsGrid;