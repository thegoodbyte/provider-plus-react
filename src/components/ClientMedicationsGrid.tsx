import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { clientMedicationsApi, ClientMedication } from '../services/clientMedicationsApi';
import { clientsApi, Client } from '../services/api';
import AppleButton from './AppleButton';
import { FiPlus, FiEdit2, FiEye, FiTrash2, FiFileText, FiCalendar } from 'react-icons/fi';

// Icon wrapper to fix TypeScript issues
const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

const ClientMedicationsGrid: React.FC = () => {
  const [medications, setMedications] = useState<ClientMedication[]>([]);
  const [clients, setClients] = useState<Record<string, Client>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [medicationsResponse, clientsResponse] = await Promise.all([
        clientMedicationsApi.getAll(),
        clientsApi.getAll()
      ]);

      setMedications(medicationsResponse.data);

      // Create clients lookup map
      const clientsMap: Record<string, Client> = {};
      clientsResponse.data.forEach((client: Client) => {
        if (client._id) {
          clientsMap[client._id] = client;
        }
      });
      setClients(clientsMap);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (id: string) => {
    navigate(`/admin/client-medications/edit/${id}`);
  };

  const handleView = (id: string) => {
    navigate(`/admin/client-medications/view/${id}`);
  };

  const handleDelete = async (id: string, displayId: number) => {
    if (window.confirm(`Are you sure you want to delete medication record #${displayId}?`)) {
      try {
        await clientMedicationsApi.delete(id);
        await fetchData(); // Refresh the list
      } catch (error) {
        console.error('Error deleting medication:', error);
        alert('Error deleting medication record. Please try again.');
      }
    }
  };

  const handleClientClick = (clientId: string) => {
    const client = clients[clientId];
    if (client) {
      // Navigate using hash ID, not display ID
      navigate(`/admin/clients?id=${client._id}`);
    }
  };

  const getClientName = (clientId: string) => {
    const client = clients[clientId];
    return client ? `${client.firstName} ${client.lastName}` : 'Unknown Client';
  };

  const getClientDisplayId = (clientId: string) => {
    const client = clients[clientId];
    return client?.display_id ? `#${client.display_id}` : '';
  };

  const filteredMedications = medications.filter(med => {
    const clientName = getClientName(med.client_id).toLowerCase();
    const displayId = med.display_id?.toString() || '';
    const searchLower = searchTerm.toLowerCase();

    return clientName.includes(searchLower) ||
           displayId.includes(searchLower) ||
           med.admin_notes?.toLowerCase().includes(searchLower) ||
           med.medstaff_review_notes?.toLowerCase().includes(searchLower);
  });

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading client medications...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Client Medications</h1>
          <p className="text-gray-600 mt-1">Manage client medication documents and records</p>
        </div>
        <AppleButton onClick={() => navigate('/admin/client-medications/create')}>
          <Icon icon={FiPlus} className="w-4 h-4 mr-2" />
          Add New Record
        </AppleButton>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by client name, record ID, or notes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Statistics */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Icon icon={FiFileText} className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total Records</p>
              <p className="text-2xl font-bold text-gray-900">{medications.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Icon icon={FiCalendar} className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">This Month</p>
              <p className="text-2xl font-bold text-gray-900">
                {medications.filter(med => {
                  const date = new Date(med.date_collected);
                  const now = new Date();
                  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                }).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Icon icon={FiFileText} className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">With PDF</p>
              <p className="text-2xl font-bold text-gray-900">
                {medications.filter(med => med.pdf_file).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Record ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date Collected
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  PDF Document
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Admin Notes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  MedStaff Review
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredMedications.map((medication) => (
                <tr key={medication._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleView(medication._id)}
                      className="text-blue-600 hover:text-blue-800 font-semibold hover:underline"
                    >
                      #{medication.display_id}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleClientClick(medication.client_id)}
                      className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                    >
                      {getClientName(medication.client_id)}
                      <span className="text-gray-500 text-sm ml-1">
                        {getClientDisplayId(medication.client_id)}
                      </span>
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(medication.date_collected)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {medication.pdf_file ? (
                      <a
                        href={`${process.env.REACT_APP_API_URL || 'http://localhost:3005'}${medication.pdf_file}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-green-600 hover:text-green-800"
                      >
                        <Icon icon={FiFileText} className="w-4 h-4 mr-1" />
                        View PDF
                      </a>
                    ) : (
                      <span className="text-gray-400 text-sm">No file</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 max-w-xs truncate" title={medication.admin_notes}>
                      {medication.admin_notes || <span className="text-gray-400">No notes</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 max-w-xs truncate" title={medication.medstaff_review_notes}>
                      {medication.medstaff_review_notes || <span className="text-gray-400">No review</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleView(medication._id)}
                        className="text-blue-600 hover:text-blue-800 p-1 rounded"
                        title="View"
                      >
                        <Icon icon={FiEye} className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(medication._id)}
                        className="text-yellow-600 hover:text-yellow-800 p-1 rounded"
                        title="Edit"
                      >
                        <Icon icon={FiEdit2} className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(medication._id, medication.display_id)}
                        className="text-red-600 hover:text-red-800 p-1 rounded"
                        title="Delete"
                      >
                        <Icon icon={FiTrash2} className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredMedications.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    {searchTerm ? 'No medications found matching your search.' : 'No medication records found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ClientMedicationsGrid;