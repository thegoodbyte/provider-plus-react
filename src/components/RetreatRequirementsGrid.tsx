import React, { useState, useEffect, useCallback } from 'react';
import { clientRequirementsApi, retreatsApi, requirementsApi } from '../services/api';
import { Retreat, ClientRequirement, Requirement } from '../types';
import { FiCheck, FiX, FiClock } from 'react-icons/fi';
import './RetreatsGrid.css';

// Simple wrapper to fix TypeScript icon issues
const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

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


  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#28a745';
      case 'received': case 'reviewed': return '#007bff';
      case 'pending': return '#ffc107';
      case 'rejected': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const getRequirementStatusDisplay = (requirement: ClientRequirement | null) => {
    if (!requirement) {
      return (
        <span className="text-gray-500 text-xs italic">
          Not initialized
        </span>
      );
    }

    const status = requirement.status || 'pending';
    const color = getStatusColor(status);

    return (
      <div className="flex items-center gap-1">
        <span
          className="inline-block w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span
          className="text-xs font-medium capitalize"
          style={{ color }}
        >
          {status}
        </span>
        {requirement.fileName && (
          <span className="text-xs text-gray-600">📄</span>
        )}
        {requirement.amount && (
          <span className="text-xs text-gray-600">💰</span>
        )}
      </div>
    );
  };

  const getProgressDisplay = (clientData: RetreatRequirementsOverview) => {
    const totalRequirements = allRequirements.filter(req => req.isActive).length;
    const completedRequirements = clientData.requirements?.filter((req: ClientRequirement) =>
      req.status === 'approved'
    ).length || 0;

    const percentage = totalRequirements > 0 ? Math.round((completedRequirements / totalRequirements) * 100) : 0;
    const color = percentage === 100 ? '#28a745' : percentage >= 50 ? '#ffc107' : '#dc3545';

    return (
      <div className="flex items-center gap-2">
        <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-300 ease-in-out"
            style={{
              width: `${percentage}%`,
              backgroundColor: color
            }}
          />
        </div>
        <span
          className="text-xs font-semibold"
          style={{ color }}
        >
          {completedRequirements}/{totalRequirements}
        </span>
      </div>
    );
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
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Client
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Progress
                      </th>
                      {allRequirements
                        .filter(req => req.isActive)
                        .sort((a, b) => (a.order || 0) - (b.order || 0))
                        .map(requirement => (
                          <th
                            key={requirement._id}
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            title={requirement.description}
                          >
                            {requirement.name}
                          </th>
                        ))
                      }
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {clientRequirements.map((clientData: RetreatRequirementsOverview) => (
                      <tr key={clientData.client._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-gray-900">
                            {clientData.client.firstName} {clientData.client.lastName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {clientData.client.email}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getProgressDisplay(clientData)}
                        </td>
                        {allRequirements
                          .filter(req => req.isActive)
                          .sort((a, b) => (a.order || 0) - (b.order || 0))
                          .map(requirement => {
                            const clientRequirement = clientData.requirements?.find(
                              (req: ClientRequirement) =>
                                (req.requirementId as any)?._id === requirement._id ||
                                (req.requirementId as any)?.name === requirement.name
                            );
                            return (
                              <td key={requirement._id} className="px-6 py-4 whitespace-nowrap">
                                {getRequirementStatusDisplay(clientRequirement || null)}
                              </td>
                            );
                          })
                        }
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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