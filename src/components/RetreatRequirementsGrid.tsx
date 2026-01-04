import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams, ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { clientRequirementsApi, retreatsApi, requirementsApi } from '../services/api';
import { Retreat, ClientRequirement, Requirement } from '../types';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import './RetreatsGrid.css';

ModuleRegistry.registerModules([AllCommunityModule]);

interface RetreatRequirementsOverview {
  client: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  requirements: ClientRequirement[];
}

const RetreatRequirementsGrid: React.FC = () => {
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [selectedRetreatId, setSelectedRetreatId] = useState<string>('');
  const [clientRequirements, setClientRequirements] = useState<RetreatRequirementsOverview[]>([]);
  const [allRequirements, setAllRequirements] = useState<Requirement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const gridApiRef = useRef<GridApi | null>(null);

  const fetchRetreats = useCallback(async () => {
    try {
      const response = await retreatsApi.getAll();
      setRetreats(response.data || []);

      // Set first retreat as selected by default
      if (response.data && response.data.length > 0) {
        setSelectedRetreatId(response.data[0]._id!);
      }
    } catch (error: any) {
      console.error('Error fetching retreats:', error);
      setRetreats([]);
    }
  }, []);

  const fetchRequirements = useCallback(async () => {
    try {
      const response = await requirementsApi.getAll();
      setAllRequirements(response.data || []);
    } catch (error: any) {
      console.error('Error fetching requirements:', error);
      setAllRequirements([]);
    }
  }, []);

  const fetchRetreatRequirementsOverview = useCallback(async (retreatId: string) => {
    if (!retreatId) return;

    try {
      setIsLoading(true);
      const response = await clientRequirementsApi.getRetreatOverview(retreatId);
      setClientRequirements(response.data || []);
    } catch (error: any) {
      console.error('Error fetching retreat requirements overview:', error);
      setClientRequirements([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRetreats();
    fetchRequirements();
  }, [fetchRetreats, fetchRequirements]);

  useEffect(() => {
    if (selectedRetreatId) {
      fetchRetreatRequirementsOverview(selectedRetreatId);
    }
  }, [selectedRetreatId, fetchRetreatRequirementsOverview]);

  const handleGridReady = (params: GridReadyEvent) => {
    gridApiRef.current = params.api;
    params.api.sizeColumnsToFit();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#28a745';
      case 'received': case 'reviewed': return '#007bff';
      case 'pending': return '#ffc107';
      case 'rejected': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const RequirementStatusCellRenderer = (params: ICellRendererParams) => {
    const { data, colDef } = params;
    const requirementName = colDef?.headerName;

    // Find the requirement for this client
    const requirement = data.requirements?.find((req: ClientRequirement) =>
      (req.requirementId as any)?.name === requirementName
    );

    if (!requirement) {
      return (
        <span style={{
          color: '#6c757d',
          fontSize: '12px',
          fontStyle: 'italic'
        }}>
          Not initialized
        </span>
      );
    }

    const status = requirement.status || 'pending';
    const color = getStatusColor(status);

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span
          style={{
            display: 'inline-block',
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: color
          }}
        />
        <span style={{
          fontSize: '12px',
          color: color,
          fontWeight: '500',
          textTransform: 'capitalize'
        }}>
          {status}
        </span>
        {requirement.fileName && (
          <span style={{ fontSize: '10px', color: '#666' }}>📄</span>
        )}
        {requirement.amount && (
          <span style={{ fontSize: '10px', color: '#666' }}>💰</span>
        )}
      </div>
    );
  };

  const ClientCellRenderer = (params: ICellRendererParams) => {
    const { data } = params;
    return (
      <div>
        <div style={{ fontWeight: '600', fontSize: '14px' }}>
          {data.client.firstName} {data.client.lastName}
        </div>
        <div style={{ fontSize: '12px', color: '#666' }}>
          {data.client.email}
        </div>
      </div>
    );
  };

  const ProgressCellRenderer = (params: ICellRendererParams) => {
    const { data } = params;
    const totalRequirements = allRequirements.filter(req => req.isActive).length;
    const completedRequirements = data.requirements?.filter((req: ClientRequirement) =>
      req.status === 'approved'
    ).length || 0;

    const percentage = totalRequirements > 0 ? Math.round((completedRequirements / totalRequirements) * 100) : 0;
    const color = percentage === 100 ? '#28a745' : percentage >= 50 ? '#ffc107' : '#dc3545';

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          width: '80px',
          height: '6px',
          backgroundColor: '#e9ecef',
          borderRadius: '3px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${percentage}%`,
            height: '100%',
            backgroundColor: color,
            transition: 'width 0.3s ease'
          }} />
        </div>
        <span style={{
          fontSize: '12px',
          fontWeight: '600',
          color: color
        }}>
          {completedRequirements}/{totalRequirements}
        </span>
      </div>
    );
  };

  // Create dynamic columns based on requirements
  const createColumns = (): ColDef[] => {
    const baseColumns: ColDef[] = [
      {
        field: 'client',
        headerName: 'Client',
        cellRenderer: ClientCellRenderer,
        width: 200,
        pinned: 'left',
        sortable: true,
        filter: true
      },
      {
        field: 'progress',
        headerName: 'Progress',
        cellRenderer: ProgressCellRenderer,
        width: 150,
        pinned: 'left',
        sortable: false
      }
    ];

    // Add columns for each active requirement
    const requirementColumns: ColDef[] = allRequirements
      .filter(req => req.isActive)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map(req => ({
        field: `requirement_${req._id}`,
        headerName: req.name,
        cellRenderer: RequirementStatusCellRenderer,
        width: 120,
        sortable: false,
        tooltipField: req.description
      }));

    return [...baseColumns, ...requirementColumns];
  };

  const columnDefs = createColumns();

  const defaultColDef = {
    resizable: true,
    minWidth: 100,
    suppressMovable: true
  };

  const selectedRetreat = retreats.find(r => r._id === selectedRetreatId);

  const handleInitializeAllRequirements = async () => {
    if (!selectedRetreatId) return;

    if (window.confirm('This will initialize requirements for all clients in this retreat who don\'t have them yet. Continue?')) {
      try {
        setIsLoading(true);
        // This would require a backend endpoint to initialize requirements for all clients in a retreat
        // For now, we'll show a message
        alert('This feature requires a backend endpoint to initialize requirements for all clients. Please implement the endpoint first.');

        // After implementation, refresh the data
        // await fetchRetreatRequirementsOverview(selectedRetreatId);
      } catch (error) {
        console.error('Error initializing requirements:', error);
        alert('Error initializing requirements for all clients');
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="retreats-container">
      <div className="retreats-header">
        <h2>📋 Retreat Requirements Overview</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div className="retreat-selector">
            <label htmlFor="retreat-select" style={{ marginRight: '8px', fontWeight: '600' }}>
              Retreat:
            </label>
            <select
              id="retreat-select"
              value={selectedRetreatId}
              onChange={(e) => setSelectedRetreatId(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '2px solid #e1e5e9',
                fontSize: '14px',
                minWidth: '200px'
              }}
            >
              <option value="">Select a retreat...</option>
              {retreats.map((retreat) => (
                <option key={retreat._id} value={retreat._id}>
                  {retreat.name} - {retreat.location}
                </option>
              ))}
            </select>
          </div>
          {selectedRetreatId && (
            <button
              onClick={handleInitializeAllRequirements}
              className="add-btn"
              style={{ backgroundColor: '#17a2b8' }}
            >
              🏗️ Initialize All Requirements
            </button>
          )}
          <div style={{ fontSize: '14px', color: '#666' }}>
            {isLoading ? 'Loading...' : `${clientRequirements.length} clients`}
          </div>
        </div>
      </div>

      {selectedRetreat && (
        <div className="retreat-info" style={{
          marginBottom: '20px',
          padding: '16px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #dee2e6'
        }}>
          <h3 style={{ margin: '0 0 8px 0' }}>
            🏃‍♂️ {selectedRetreat.name}
          </h3>
          <div style={{ fontSize: '14px', color: '#666' }}>
            📍 {selectedRetreat.location} |
            📅 {selectedRetreat.startDate ? new Date(selectedRetreat.startDate).toLocaleDateString() : 'Date TBD'} |
            👥 {clientRequirements.length} clients
          </div>
        </div>
      )}

      {selectedRetreatId ? (
        <>
          {isLoading ? (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              fontSize: '18px',
              color: '#666'
            }}>
              Loading requirements overview...
            </div>
          ) : (
            <div className="ag-theme-alpine" style={{ height: 600, width: '100%' }}>
              <AgGridReact
                rowData={clientRequirements}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                onGridReady={handleGridReady}
                animateRows={true}
                suppressNoRowsOverlay={false}
                tooltipShowDelay={300}
                enableCellTextSelection={true}
              />
            </div>
          )}

          {!isLoading && clientRequirements.length === 0 && (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              fontSize: '16px',
              color: '#666',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              border: '1px solid #dee2e6'
            }}>
              <h3>📋 No Client Requirements Found</h3>
              <p>This retreat has no clients with initialized requirements.</p>
              <p>Make sure clients are booked for this retreat and their requirements are initialized.</p>
            </div>
          )}
        </>
      ) : (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          fontSize: '16px',
          color: '#666',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #dee2e6'
        }}>
          <h3>🏃‍♂️ Select a Retreat</h3>
          <p>Choose a retreat from the dropdown above to view client requirements overview.</p>
        </div>
      )}
    </div>
  );
};

export default RetreatRequirementsGrid;