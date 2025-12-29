import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams, ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { housesApi } from '../services/api';
import { House } from '../types';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import './HousesGrid.css';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

const HousesGrid: React.FC = () => {
  const [houses, setHouses] = useState<House[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHouse, setEditingHouse] = useState<House | null>(null);
  const [formData, setFormData] = useState<Partial<House>>({});
  const gridApiRef = useRef<GridApi | null>(null);

  const ActionCellRenderer = (params: ICellRendererParams) => {
    return (
      <div className="action-buttons">
        <button onClick={() => handleEdit(params.data)} className="edit-btn">Edit</button>
        <button onClick={() => handleDelete(params.data._id)} className="delete-btn">Delete</button>
      </div>
    );
  };

  const columnDefs: ColDef[] = [
    { field: '_id', headerName: 'ID', hide: true },
    {
      field: 'name',
      headerName: 'House Name',
      sortable: true,
      filter: true,
      valueGetter: (params) => params.data.name || params.data.city || 'Unnamed House'
    },
    { field: 'address', headerName: 'Address', sortable: true, filter: true },
    { field: 'city', headerName: 'City', sortable: true, filter: true },
    {
      field: 'capacity',
      headerName: 'Capacity',
      sortable: true,
      filter: true,
      valueGetter: (params) => params.data.capacity || params.data.guestCapacity || 0
    },
    {
      field: 'numberOfRooms',
      headerName: 'Rooms',
      sortable: true,
      filter: true,
      valueGetter: (params) => params.data.numberOfRooms || params.data.bedrooms || 0
    },
    { field: 'numberOfBathrooms', headerName: 'Bathrooms', sortable: true, filter: true },
    { field: 'status', headerName: 'Status', sortable: true, filter: true },
    { field: 'pricePerNight', headerName: 'Price/Night', sortable: true, filter: true,
      valueFormatter: (params) => params.value ? `$${params.value}` : 'N/A'
    },
    {
      field: 'amenities',
      headerName: 'Amenities',
      flex: 1,
      valueGetter: (params) => {
        const amenities = params.data.amenities;
        return amenities && amenities.length > 0 ? amenities.join(', ') : 'None';
      }
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
    minWidth: 100,
    flex: 1
  };

  const fetchHouses = useCallback(async () => {
    try {
      console.log('Fetching houses...');
      setIsLoading(true);
      const response = await housesApi.getAll();
      console.log('Houses data:', response.data);
      setHouses(response.data || []);
    } catch (error: any) {
      console.error('Error fetching houses:', error);
      setHouses([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHouses();
  }, [fetchHouses]);

  const handleGridReady = (params: GridReadyEvent) => {
    gridApiRef.current = params.api;
    params.api.sizeColumnsToFit();
  };

  const handleAdd = () => {
    setEditingHouse(null);
    setFormData({
      status: 'available',
      amenities: []
    });
    setIsModalOpen(true);
  };

  const handleEdit = (house: House) => {
    setEditingHouse(house);
    // Convert legacy format to new format for editing
    const formattedHouse = {
      ...house,
      name: house.name || house.city || '',
      capacity: house.capacity || house.guestCapacity || 0,
      numberOfRooms: house.numberOfRooms || house.bedrooms || 0,
      amenities: house.amenities || []
    };
    setFormData(formattedHouse);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this house?')) {
      try {
        await housesApi.delete(id);
        fetchHouses();
      } catch (error: any) {
        console.error('Error deleting house:', error);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      console.log('Submitting house with data:', formData);

      // Clean and prepare data for submission
      const cleanData: any = {};

      if (formData.name?.trim()) cleanData.name = formData.name.trim();
      if (formData.address?.trim()) cleanData.address = formData.address.trim();
      if (formData.capacity && formData.capacity > 0) cleanData.capacity = Number(formData.capacity);
      if (formData.numberOfRooms && formData.numberOfRooms > 0) cleanData.numberOfRooms = Number(formData.numberOfRooms);
      if (formData.numberOfBathrooms && formData.numberOfBathrooms > 0) cleanData.numberOfBathrooms = Number(formData.numberOfBathrooms);
      if (formData.amenities) cleanData.amenities = formData.amenities;
      if (formData.description?.trim()) cleanData.description = formData.description.trim();
      if (formData.status) cleanData.status = formData.status;
      if (formData.pricePerNight && formData.pricePerNight > 0) cleanData.pricePerNight = Number(formData.pricePerNight);

      console.log('Cleaned house data:', cleanData);

      if (editingHouse) {
        await housesApi.update(editingHouse._id!, cleanData);
      } else {
        await housesApi.create(cleanData);
      }
      setIsModalOpen(false);
      setFormData({});
      setEditingHouse(null);
      fetchHouses();
    } catch (error: any) {
      console.error('Error saving house:', error);
      console.error('Error response:', error.response?.data);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'amenities') {
      // Handle amenities as comma-separated values
      setFormData(prev => ({
        ...prev,
        [name]: value.split(',').map(item => item.trim()).filter(item => item)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: ['capacity', 'numberOfRooms', 'numberOfBathrooms', 'pricePerNight'].includes(name) ? parseInt(value) : value
      }));
    }
  };

  console.log('Current houses state:', houses);
  console.log('Is loading:', isLoading);

  return (
    <div className="houses-container">
      <div className="houses-header">
        <h2>Houses Management</h2>
        <button onClick={handleAdd} className="add-btn">Add New House</button>
        <div style={{ marginLeft: '20px', fontSize: '14px', color: '#666' }}>
          Status: {isLoading ? 'Loading...' : `${houses.length} houses loaded`}
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: '20px', textAlign: 'center' }}>Loading houses...</div>
      ) : (
        <div className="ag-theme-alpine" style={{ height: 600, width: '100%' }}>
          <AgGridReact
            rowData={houses}
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
            <h3>{editingHouse ? 'Edit House' : 'Add New House'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="name">House Name:</label>
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
                <label htmlFor="address">Address:</label>
                <input
                  type="text"
                  id="address"
                  name="address"
                  value={formData.address || ''}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="capacity">Guest Capacity:</label>
                <input
                  type="number"
                  id="capacity"
                  name="capacity"
                  value={formData.capacity || ''}
                  onChange={handleInputChange}
                  min="1"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="numberOfRooms">Number of Rooms:</label>
                <input
                  type="number"
                  id="numberOfRooms"
                  name="numberOfRooms"
                  value={formData.numberOfRooms || ''}
                  onChange={handleInputChange}
                  min="1"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="numberOfBathrooms">Number of Bathrooms:</label>
                <input
                  type="number"
                  id="numberOfBathrooms"
                  name="numberOfBathrooms"
                  value={formData.numberOfBathrooms || ''}
                  onChange={handleInputChange}
                  min="1"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="pricePerNight">Price per Night ($):</label>
                <input
                  type="number"
                  id="pricePerNight"
                  name="pricePerNight"
                  value={formData.pricePerNight || ''}
                  onChange={handleInputChange}
                  min="0"
                  step="0.01"
                />
              </div>

              <div className="form-group">
                <label htmlFor="status">Status:</label>
                <select
                  id="status"
                  name="status"
                  value={formData.status || 'available'}
                  onChange={handleInputChange}
                >
                  <option value="available">Available</option>
                  <option value="occupied">Occupied</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="amenities">Amenities (comma-separated):</label>
                <input
                  type="text"
                  id="amenities"
                  name="amenities"
                  value={formData.amenities?.join(', ') || ''}
                  onChange={handleInputChange}
                  placeholder="WiFi, Pool, Gym, Parking"
                />
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

export default HousesGrid;