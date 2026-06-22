import React, { useState, useEffect } from 'react';
import { Modal, Input, Spin, Button, message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { clientsApi } from '../services/api';
import { Client } from '../types';

interface SearchableClientSelectorProps {
  isVisible: boolean;
  onClose: () => void;
  onSelectClient: (client: Client) => void;
  title?: string;
}

const SearchableClientSelector: React.FC<SearchableClientSelectorProps> = ({
  isVisible,
  onClose,
  onSelectClient,
  title = "Select Existing Client"
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(false);

  // Load all clients when modal opens
  useEffect(() => {
    if (isVisible && !initialLoad) {
      loadClients();
      setInitialLoad(true);
    }
  }, [isVisible, initialLoad]);

  // Filter clients based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredClients(clients);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = clients.filter(client => {
        const fullName = `${client.firstName || ''} ${client.lastName || ''}`.toLowerCase();
        const phone = client.phone?.toLowerCase() || '';
        const displayId = client.display_id?.toString() || '';

        return (
          fullName.includes(term) ||
          phone.includes(term) ||
          displayId.includes(term)
        );
      });
      setFilteredClients(filtered);
    }
  }, [searchTerm, clients]);

  const loadClients = async () => {
    try {
      setLoading(true);
      const response = await clientsApi.getAll();
      setClients(response.data);
      setFilteredClients(response.data);
    } catch (error) {
      console.error('Error loading clients:', error);
      message.error('Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectClient = (client: Client) => {
    onSelectClient(client);
    handleClose();
  };

  const handleClose = () => {
    setSearchTerm('');
    onClose();
  };

  const formatClientDisplay = (client: Client) => {
    const fullName = `${client.firstName || ''} ${client.lastName || ''}`.trim();
    const displayId = client.display_id ? `#${client.display_id}` : '';
    const phone = client.phone ? ` • ${client.phone}` : '';
    return `${displayId} ${fullName}${phone}`;
  };

  return (
    <Modal
      title={`🔍 ${title}`}
      open={isVisible}
      onCancel={handleClose}
      footer={[
        <Button key="cancel" onClick={handleClose}>
          Cancel
        </Button>
      ]}
      width={700}
    >
      <div style={{ marginBottom: '16px' }}>
        <Input
          placeholder="Search by name, phone, or display ID..."
          prefix={<SearchOutlined />}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          size="large"
          autoFocus
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spin size="large" />
          <div style={{ marginTop: '16px' }}>Loading clients...</div>
        </div>
      ) : (
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {filteredClients.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              {searchTerm ? 'No clients found matching your search' : 'No clients available'}
            </div>
          ) : (
            <div>
              {filteredClients.map((client) => (
                <div
                  key={client._id}
                  onClick={() => handleSelectClient(client)}
                  style={{
                    padding: '12px',
                    border: '1px solid #e8e8e8',
                    borderRadius: '6px',
                    marginBottom: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: '#fff'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f9fafb';
                    e.currentTarget.style.borderColor = '#1890ff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#fff';
                    e.currentTarget.style.borderColor = '#e8e8e8';
                  }}
                >
                  <div style={{
                    fontWeight: '500',
                    fontSize: '14px',
                    marginBottom: '4px',
                    color: '#333'
                  }}>
                    {formatClientDisplay(client)}
                  </div>
                  {client.email && (
                    <div style={{
                      fontSize: '12px',
                      color: '#666',
                      marginBottom: '2px'
                    }}>
                      📧 {client.email}
                    </div>
                  )}
                  <div style={{
                    fontSize: '12px',
                    color: '#999'
                  }}>
                    Status: {client.workflowStatus || 'unknown'} •
                    {client.country && ` ${client.country}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {filteredClients.length > 0 && (
        <div style={{
          marginTop: '16px',
          padding: '8px',
          background: '#f8f9fa',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#666',
          textAlign: 'center'
        }}>
          Showing {filteredClients.length} of {clients.length} clients
        </div>
      )}
    </Modal>
  );
};

export default SearchableClientSelector;