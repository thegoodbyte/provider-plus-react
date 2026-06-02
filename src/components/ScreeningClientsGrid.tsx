import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { clientsApi } from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import AppleButton from './AppleButton';
import { FiPlus, FiEdit2, FiTrash2, FiUser, FiPhone, FiMail, FiEye } from 'react-icons/fi';

// Simple wrapper to fix TypeScript icon issues
const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

const ScreeningClientsGrid: React.FC = () => {
  const navigate = useNavigate();
  const [screeningClients, setScreeningClients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const fetchScreeningClients = useCallback(async () => {
    try {
      setIsLoading(true);
      setApiError(false);
      const response = await clientsApi.getAll();
      // Filter for clients that are in the screening workflow
      const allClients = response.data || [];
      const screeningClients = allClients.filter((client: any) =>
        client.workflowStatus &&
        ['potential', 'screening', 'approved', 'rejected'].includes(client.workflowStatus)
      );
      setScreeningClients(screeningClients);
    } catch (error: any) {
      console.error('Error fetching screening clients:', error);
      setScreeningClients([]);
      setApiError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScreeningClients();
  }, [fetchScreeningClients]);

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this screening client?')) {
      try {
        await clientsApi.delete(id);
        fetchScreeningClients();
      } catch (error) {
        console.error('Error deleting screening client:', error);
      }
    }
  };

  const handlePromote = async (id: string) => {
    if (window.confirm('Are you sure you want to promote this screening client to a full client?')) {
      try {
        // Update the client's workflowStatus to 'active' to promote them
        await clientsApi.update(id, { workflowStatus: 'completed' } as any);
        alert('Successfully promoted to active client!');
        fetchScreeningClients();
      } catch (error: any) {
        console.error('Error promoting screening client:', error);
        alert('Error promoting client: ' + (error.response?.data?.message || error.message));
      }
    }
  };

  const filteredClients = screeningClients.filter(client => {
    if (filterStatus === 'all') return true;
    return client.workflowStatus === filterStatus;
  });

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading screening clients..." />;
  }

  return (
    <div className="p-6 h-full">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Screening Clients</h1>
        <AppleButton onClick={() => navigate('/admin/clients/add?workflowStatus=screening')} className="apple-button-primary">
          <Icon icon={FiPlus} className="w-4 h-4 mr-2" />
          Add New Screening
        </AppleButton>
      </div>

      {/* Filter Controls */}
      <div className="mb-4 flex space-x-4">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="potential">Potential</option>
          <option value="screening">Screening</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {apiError && (
        <div className="mb-4 p-4 text-red-700 bg-red-100 rounded-md">
          API Error: Unable to load screening clients data
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1480px] divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Country
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  First Contact
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Completed
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Motivation
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredClients.map((client) => (
                <tr key={client._id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button
                      onClick={() => navigate(`/clients/${client._id}`)}
                      className="!inline-flex max-w-[220px] !items-center !justify-start gap-2 truncate !rounded-none !border-0 !bg-transparent !p-0 !text-left text-sm font-medium !text-blue-600 !shadow-none hover:!bg-transparent hover:!text-blue-800 hover:underline"
                    >
                      <Icon icon={FiUser} className="h-4 w-4 shrink-0 text-gray-400" />
                      <span className="truncate">{client.firstName} {client.lastName}</span>
                    </button>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600">
                    {client.display_id ? `#${client.display_id}` : 'No ID'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600">
                    {client.country || 'N/A'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                    <span className="inline-flex max-w-[170px] items-center gap-1 truncate">
                      <Icon icon={FiPhone} className="h-4 w-4 shrink-0 text-gray-400" />
                      <span className="truncate">{client.phone || 'N/A'}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                    {client.email ? (
                      <span className="inline-flex max-w-[230px] items-center gap-1 truncate">
                        <Icon icon={FiMail} className="h-4 w-4 shrink-0 text-gray-400" />
                        <span className="truncate">{client.email}</span>
                      </span>
                    ) : 'N/A'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      client.status === 'approved' ? 'bg-green-100 text-green-800' :
                      client.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      client.status === 'converted' ? 'bg-blue-100 text-blue-800' :
                      client.status === 'completed' ? 'bg-purple-100 text-purple-800' :
                      client.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {client.status || 'initial'}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      client.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                      client.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                      client.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {client.priority || 'normal'}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(client.firstContactDate)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(client.screeningCompletedDate)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="max-w-[260px] truncate text-sm text-gray-900">
                      {client.whySeekingIboga ?
                        (client.whySeekingIboga.length > 50 ?
                          client.whySeekingIboga.substring(0, 50) + '...' :
                          client.whySeekingIboga) :
                        'No details'
                      }
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <div title="View Details">
                        <AppleButton
                          onClick={() => {/* TODO: View details */}}
                          className="apple-button-secondary p-1.5"
                        >
                          <Icon icon={FiEye} className="w-4 h-4" />
                        </AppleButton>
                      </div>
                      <div title="Edit">
                        <AppleButton
                          onClick={() => {/* TODO: Edit client */}}
                          className="apple-button-secondary p-1.5"
                        >
                          <Icon icon={FiEdit2} className="w-4 h-4" />
                        </AppleButton>
                      </div>
                      {client.status === 'approved' && (
                        <div title="Promote to Client">
                          <AppleButton
                            onClick={() => handlePromote(client._id!)}
                            className="apple-button-primary p-1.5"
                          >
                            ↗
                          </AppleButton>
                        </div>
                      )}
                      <div title="Delete">
                        <AppleButton
                          onClick={() => handleDelete(client._id!)}
                          className="apple-button-danger p-1.5"
                        >
                          <Icon icon={FiTrash2} className="w-4 h-4" />
                        </AppleButton>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredClients.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <Icon icon={FiUser} className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No screening clients</h3>
            <p className="mt-1 text-sm text-gray-500">
              {filterStatus === 'all' ?
                'Get started by adding a new screening client.' :
                `No clients found with status "${filterStatus}".`
              }
            </p>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {screeningClients.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Icon icon={FiUser} className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total</dt>
                    <dd className="text-lg font-medium text-gray-900">{screeningClients.length}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Icon icon={FiUser} className="h-6 w-6 text-yellow-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">In Progress</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {screeningClients.filter(c => c.status === 'in_progress').length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Icon icon={FiUser} className="h-6 w-6 text-green-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Approved</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {screeningClients.filter(c => c.status === 'approved').length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Icon icon={FiUser} className="h-6 w-6 text-blue-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Converted</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {screeningClients.filter(c => c.status === 'converted').length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScreeningClientsGrid;
