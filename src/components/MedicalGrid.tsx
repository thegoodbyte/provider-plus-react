import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams, ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { clientMedicalApi } from '../services/api';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import './ClientsGrid.css';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

interface MedicalGridData {
  _id: string;
  clientName: string;
  retreatName: string;
  retreatLocation: string;
  retreatStartDate: string;

  // EKG Data
  ekgStatus: string;
  ekgReceivedDate: string | null;
  ekgSentToAdvisorDate: string | null;
  ekgFileName: string | null;
  ekgAdvisorNotes: string | null;

  // Liver Panel Data
  liverPanelStatus: string;
  liverPanelReceivedDate: string | null;
  liverPanelSentToAdvisorDate: string | null;
  liverPanelFileName: string | null;
  liverPanelAdvisorNotes: string | null;

  // Medical Clearance
  finalMedicalClearance: boolean;
  medicalClearanceDate: string | null;
  medicalClearanceNotes: string | null;
  medicalAdvisorName: string | null;
  medicalAdvisorEmail: string | null;
}

const MedicalGrid: React.FC = () => {
  const [medicalData, setMedicalData] = useState<MedicalGridData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filteredData, setFilteredData] = useState<MedicalGridData[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const gridApiRef = useRef<GridApi | null>(null);

  const fetchMedicalData = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await clientMedicalApi.getAll();
      const transformedData: MedicalGridData[] = response.data.map((record: any) => ({
        _id: record._id,
        clientName: record.clientId
          ? `${record.clientId.firstName || record.clientId.fname || ''} ${record.clientId.lastName || record.clientId.lname || ''}`.trim()
          : 'Unknown Client',
        retreatName: record.retreatId?.name || 'Unknown Retreat',
        retreatLocation: record.retreatId?.location || '',
        retreatStartDate: record.retreatId?.startDate || record.retreatId?.dates?.startDate || '',

        // EKG Data
        ekgStatus: record.ekgStatus || 'pending',
        ekgReceivedDate: record.ekgReceivedDate,
        ekgSentToAdvisorDate: record.ekgSentToAdvisorDate,
        ekgFileName: record.ekgFileName,
        ekgAdvisorNotes: record.ekgAdvisorNotes,

        // Liver Panel Data
        liverPanelStatus: record.liverPanelStatus || 'pending',
        liverPanelReceivedDate: record.liverPanelReceivedDate,
        liverPanelSentToAdvisorDate: record.liverPanelSentToAdvisorDate,
        liverPanelFileName: record.liverPanelFileName,
        liverPanelAdvisorNotes: record.liverPanelAdvisorNotes,

        // Medical Clearance
        finalMedicalClearance: record.finalMedicalClearance || false,
        medicalClearanceDate: record.medicalClearanceDate,
        medicalClearanceNotes: record.medicalClearanceNotes,
        medicalAdvisorName: record.medicalAdvisorName,
        medicalAdvisorEmail: record.medicalAdvisorEmail
      }));

      setMedicalData(transformedData);
      setFilteredData(transformedData);
    } catch (error) {
      console.error('Error fetching medical data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMedicalData();
  }, [fetchMedicalData]);

  useEffect(() => {
    let filtered = medicalData;

    if (filterStatus !== 'all') {
      filtered = medicalData.filter(record => {
        switch (filterStatus) {
          case 'pending':
            return record.ekgStatus === 'pending' || record.liverPanelStatus === 'pending';
          case 'received':
            return record.ekgStatus === 'received' || record.liverPanelStatus === 'received';
          case 'reviewed':
            return record.ekgStatus === 'reviewed' || record.liverPanelStatus === 'reviewed';
          case 'approved':
            return record.ekgStatus === 'approved' || record.liverPanelStatus === 'approved';
          case 'cleared':
            return record.finalMedicalClearance === true;
          case 'not-cleared':
            return record.finalMedicalClearance === false;
          default:
            return true;
        }
      });
    }

    setFilteredData(filtered);
  }, [medicalData, filterStatus]);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    gridApiRef.current = params.api;
    params.api.sizeColumnsToFit();
  }, []);

  const statusRenderer = useCallback((params: ICellRendererParams) => {
    const status = params.value?.toLowerCase() || 'pending';
    const statusClass = `status-${status}`;
    return `<span class="status-badge ${statusClass}">${params.value || 'Pending'}</span>`;
  }, []);

  const dateRenderer = useCallback((params: ICellRendererParams) => {
    if (!params.value) return '<span style="color: #999;">Not set</span>';
    return new Date(params.value).toLocaleDateString();
  }, []);

  const booleanRenderer = useCallback((params: ICellRendererParams) => {
    const isTrue = params.value === true;
    return `<span class="status-badge ${isTrue ? 'status-approved' : 'status-pending'}">${isTrue ? 'Yes' : 'No'}</span>`;
  }, []);

  const notesRenderer = useCallback((params: ICellRendererParams) => {
    if (!params.value) return '<span style="color: #999;">No notes</span>';
    const truncated = params.value.length > 50 ? `${params.value.substring(0, 50)}...` : params.value;
    return `<span title="${params.value}">${truncated}</span>`;
  }, []);

  const columnDefs: ColDef[] = [
    {
      headerName: 'Client',
      field: 'clientName',
      width: 180,
      pinned: 'left',
      cellStyle: { fontWeight: 'bold' }
    },
    {
      headerName: 'Retreat',
      field: 'retreatName',
      width: 200,
      pinned: 'left'
    },
    {
      headerName: 'Location',
      field: 'retreatLocation',
      width: 150
    },
    {
      headerName: 'Start Date',
      field: 'retreatStartDate',
      width: 120,
      cellRenderer: dateRenderer
    },
    {
      headerName: 'EKG Status',
      field: 'ekgStatus',
      width: 120,
      cellRenderer: statusRenderer
    },
    {
      headerName: 'EKG Received',
      field: 'ekgReceivedDate',
      width: 130,
      cellRenderer: dateRenderer
    },
    {
      headerName: 'EKG Sent to Advisor',
      field: 'ekgSentToAdvisorDate',
      width: 150,
      cellRenderer: dateRenderer
    },
    {
      headerName: 'EKG File',
      field: 'ekgFileName',
      width: 150,
      cellRenderer: (params: ICellRendererParams) => {
        if (!params.value) return '<span style="color: #999;">No file</span>';
        return `<span title="${params.value}">📄 ${params.value}</span>`;
      }
    },
    {
      headerName: 'EKG Notes',
      field: 'ekgAdvisorNotes',
      width: 200,
      cellRenderer: notesRenderer
    },
    {
      headerName: 'Liver Panel Status',
      field: 'liverPanelStatus',
      width: 140,
      cellRenderer: statusRenderer
    },
    {
      headerName: 'Liver Received',
      field: 'liverPanelReceivedDate',
      width: 130,
      cellRenderer: dateRenderer
    },
    {
      headerName: 'Liver Sent to Advisor',
      field: 'liverPanelSentToAdvisorDate',
      width: 160,
      cellRenderer: dateRenderer
    },
    {
      headerName: 'Liver File',
      field: 'liverPanelFileName',
      width: 150,
      cellRenderer: (params: ICellRendererParams) => {
        if (!params.value) return '<span style="color: #999;">No file</span>';
        return `<span title="${params.value}">📄 ${params.value}</span>`;
      }
    },
    {
      headerName: 'Liver Notes',
      field: 'liverPanelAdvisorNotes',
      width: 200,
      cellRenderer: notesRenderer
    },
    {
      headerName: 'Medical Clearance',
      field: 'finalMedicalClearance',
      width: 140,
      cellRenderer: booleanRenderer
    },
    {
      headerName: 'Clearance Date',
      field: 'medicalClearanceDate',
      width: 130,
      cellRenderer: dateRenderer
    },
    {
      headerName: 'Clearance Notes',
      field: 'medicalClearanceNotes',
      width: 200,
      cellRenderer: notesRenderer
    },
    {
      headerName: 'Medical Advisor',
      field: 'medicalAdvisorName',
      width: 150,
      cellRenderer: (params: ICellRendererParams) => {
        if (!params.value) return '<span style="color: #999;">Not assigned</span>';
        return params.value;
      }
    },
    {
      headerName: 'Advisor Email',
      field: 'medicalAdvisorEmail',
      width: 200,
      cellRenderer: (params: ICellRendererParams) => {
        if (!params.value) return '<span style="color: #999;">No email</span>';
        return `<a href="mailto:${params.value}">${params.value}</a>`;
      }
    }
  ];

  const defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
  };

  const handleExport = useCallback(() => {
    if (gridApiRef.current) {
      gridApiRef.current.exportDataAsCsv({
        fileName: `medical-tracking-${new Date().toISOString().split('T')[0]}.csv`
      });
    }
  }, []);

  return (
    <div className="grid-container">
      <div className="grid-header">
        <div className="header-left">
          <h1>🏥 Medical Tracking</h1>
          <p>Monitor EKG and liver panel status across all retreats and clients</p>
        </div>
        <div className="header-actions">
          <div className="filter-group">
            <label htmlFor="status-filter">Filter by Status:</label>
            <select
              id="status-filter"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Records</option>
              <option value="pending">Pending Items</option>
              <option value="received">Received Items</option>
              <option value="reviewed">Reviewed Items</option>
              <option value="approved">Approved Items</option>
              <option value="cleared">Medical Cleared</option>
              <option value="not-cleared">Not Cleared</option>
            </select>
          </div>
          <button onClick={handleExport} className="export-btn">
            📊 Export CSV
          </button>
          <button onClick={fetchMedicalData} className="refresh-btn">
            🔄 Refresh
          </button>
        </div>
      </div>

      <div className="summary-stats" style={{ marginBottom: '20px', display: 'flex', gap: '16px' }}>
        <div className="stat-card">
          <div className="stat-number">{filteredData.length}</div>
          <div className="stat-label">Total Records</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{filteredData.filter(r => r.ekgStatus === 'pending' || r.liverPanelStatus === 'pending').length}</div>
          <div className="stat-label">Pending Items</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{filteredData.filter(r => r.finalMedicalClearance).length}</div>
          <div className="stat-label">Cleared</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{filteredData.filter(r => (r.ekgStatus === 'received' || r.liverPanelStatus === 'received') && !r.finalMedicalClearance).length}</div>
          <div className="stat-label">Needs Review</div>
        </div>
      </div>

      <div className="ag-theme-alpine grid-wrapper">
        <AgGridReact
          rowData={filteredData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          onGridReady={onGridReady}
          rowSelection="multiple"
          suppressRowClickSelection={true}
          loading={isLoading}
          pagination={true}
          paginationPageSize={50}
          enableBrowserTooltips={true}
          headerHeight={40}
          rowHeight={45}
        />
      </div>
    </div>
  );
};

export default MedicalGrid;