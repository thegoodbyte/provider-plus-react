import React, { useState, useEffect, useCallback } from 'react';
import { clientMedicalApi } from '../services/api';
import AppleButton from './AppleButton';
import { FiRefreshCw, FiDownload, FiMail, FiFileText, FiCheck, FiX } from 'react-icons/fi';

// Simple wrapper to fix TypeScript icon issues
const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

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

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      received: 'bg-blue-100 text-blue-800',
      reviewed: 'bg-purple-100 text-purple-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Not set';
    return new Date(date).toLocaleDateString();
  };

  const formatNotes = (notes: string | null, maxLength = 50) => {
    if (!notes) return 'No notes';
    return notes.length > maxLength ? `${notes.substring(0, maxLength)}...` : notes;
  };


  const handleExport = useCallback(() => {
    const csvContent = [
      ['Client', 'Retreat', 'Location', 'Start Date', 'EKG Status', 'EKG Received', 'EKG Sent', 'EKG File', 'EKG Notes', 'Liver Status', 'Liver Received', 'Liver Sent', 'Liver File', 'Liver Notes', 'Medical Clearance', 'Clearance Date', 'Clearance Notes', 'Medical Advisor', 'Advisor Email'].join(','),
      ...filteredData.map(record => [
        record.clientName,
        record.retreatName,
        record.retreatLocation,
        formatDate(record.retreatStartDate),
        record.ekgStatus,
        formatDate(record.ekgReceivedDate),
        formatDate(record.ekgSentToAdvisorDate),
        record.ekgFileName || '',
        record.ekgAdvisorNotes || '',
        record.liverPanelStatus,
        formatDate(record.liverPanelReceivedDate),
        formatDate(record.liverPanelSentToAdvisorDate),
        record.liverPanelFileName || '',
        record.liverPanelAdvisorNotes || '',
        record.finalMedicalClearance ? 'Yes' : 'No',
        formatDate(record.medicalClearanceDate),
        record.medicalClearanceNotes || '',
        record.medicalAdvisorName || '',
        record.medicalAdvisorEmail || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medical-tracking-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }, [filteredData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading medical data...</div>
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
          <p className="text-gray-600">Monitor EKG and liver panel status across all retreats and clients</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="status-filter" className="text-sm font-medium text-gray-700">
              Filter by Status:
            </label>
            <select
              id="status-filter"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
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
          <AppleButton onClick={handleExport} className="apple-button-secondary">
            <Icon icon={FiDownload} className="w-4 h-4 mr-2" />
            Export CSV
          </AppleButton>
          <AppleButton onClick={fetchMedicalData} className="apple-button-primary">
            <Icon icon={FiRefreshCw} className="w-4 h-4 mr-2" />
            Refresh
          </AppleButton>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-2xl font-bold text-gray-900">{filteredData.length}</div>
          <div className="text-sm text-gray-600">Total Records</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-2xl font-bold text-yellow-600">
            {filteredData.filter(r => r.ekgStatus === 'pending' || r.liverPanelStatus === 'pending').length}
          </div>
          <div className="text-sm text-gray-600">Pending Items</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-2xl font-bold text-green-600">
            {filteredData.filter(r => r.finalMedicalClearance).length}
          </div>
          <div className="text-sm text-gray-600">Cleared</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-2xl font-bold text-blue-600">
            {filteredData.filter(r => (r.ekgStatus === 'received' || r.liverPanelStatus === 'received') && !r.finalMedicalClearance).length}
          </div>
          <div className="text-sm text-gray-600">Needs Review</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Retreat
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Start Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  EKG Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  EKG Received
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Liver Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Liver Received
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Medical Clearance
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Advisor
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredData.map((record) => (
                <tr key={record._id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{record.clientName}</div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{record.retreatName}</div>
                    <div className="text-xs text-gray-500">{record.retreatLocation}</div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(record.retreatStartDate)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(record.ekgStatus)}`}>
                      {record.ekgStatus}
                    </span>
                    {record.ekgFileName && (
                      <div className="text-xs text-gray-500 mt-1 flex items-center">
                        <Icon icon={FiFileText} className="w-3 h-3 mr-1" />
                        {record.ekgFileName}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(record.ekgReceivedDate)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(record.liverPanelStatus)}`}>
                      {record.liverPanelStatus}
                    </span>
                    {record.liverPanelFileName && (
                      <div className="text-xs text-gray-500 mt-1 flex items-center">
                        <Icon icon={FiFileText} className="w-3 h-3 mr-1" />
                        {record.liverPanelFileName}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(record.liverPanelReceivedDate)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {record.finalMedicalClearance ? (
                        <Icon icon={FiCheck} className="w-5 h-5 text-green-500" />
                      ) : (
                        <Icon icon={FiX} className="w-5 h-5 text-red-500" />
                      )}
                      <span className="ml-2 text-sm text-gray-900">
                        {record.finalMedicalClearance ? 'Cleared' : 'Not Cleared'}
                      </span>
                    </div>
                    {record.medicalClearanceDate && (
                      <div className="text-xs text-gray-500">
                        {formatDate(record.medicalClearanceDate)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{record.medicalAdvisorName || 'Not assigned'}</div>
                    {record.medicalAdvisorEmail && (
                      <div className="text-xs text-gray-500">
                        <a href={`mailto:${record.medicalAdvisorEmail}`} className="text-blue-600 hover:text-blue-900">
                          {record.medicalAdvisorEmail}
                        </a>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      {record.medicalAdvisorEmail && (
                        <button
                          onClick={() => window.location.href = `mailto:${record.medicalAdvisorEmail}`}
                          className="text-blue-600 hover:text-blue-900"
                          title="Email Advisor"
                        >
                          <Icon icon={FiMail} className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredData.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No medical records found
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-gray-700">
          Showing {filteredData.length} record{filteredData.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
};

export default MedicalGrid;