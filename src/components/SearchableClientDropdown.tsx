import React, { useState, useEffect, useRef } from 'react';
import { Client } from '../types';

interface SearchableClientDropdownProps {
  clients: Client[];
  selectedClientId: string;
  onClientSelect: (clientId: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export const SearchableClientDropdown: React.FC<SearchableClientDropdownProps> = ({
  clients,
  selectedClientId,
  onClientSelect,
  placeholder = "Select a client",
  required = false,
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredClients, setFilteredClients] = useState<Client[]>(clients);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedClient = clients.find(client => client._id === selectedClientId);
  const displayValue = selectedClient
    ? `${selectedClient.firstName} ${selectedClient.lastName}${selectedClient.display_id ? ` - #${selectedClient.display_id}` : ''}`
    : '';

  useEffect(() => {
    const filtered = clients.filter(client => {
      if (!client || !client.firstName || !client.lastName) return false;

      const fullName = `${client.firstName} ${client.lastName}`.toLowerCase();
      const displayId = client.display_id != null ? client.display_id.toString() : '';
      const search = searchTerm.toLowerCase();

      return fullName.includes(search) ||
             displayId.includes(search) ||
             (client.email && client.email.toLowerCase().includes(search)) ||
             (client.phone && client.phone.includes(search));
    });
    setFilteredClients(filtered);
  }, [clients, searchTerm]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleInputClick = () => {
    setIsOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setIsOpen(true);
  };

  const handleClientSelect = (client: Client) => {
    onClientSelect(client._id!);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = () => {
    onClientSelect('');
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div className="relative">
        <input
          type="text"
          value={isOpen ? searchTerm : displayValue}
          onChange={handleInputChange}
          onClick={handleInputClick}
          placeholder={placeholder}
          required={required}
          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          autoComplete="off"
        />
        <div className="absolute inset-y-0 right-0 flex items-center px-2">
          {selectedClientId && (
            <button
              type="button"
              onClick={handleClear}
              className="text-gray-400 hover:text-gray-600 mr-1"
            >
              ×
            </button>
          )}
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
          {filteredClients.length > 0 ? (
            filteredClients.map((client) => (
              <div
                key={client._id}
                onClick={() => handleClientSelect(client)}
                className="px-3 py-2 cursor-pointer hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
              >
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      {client.firstName} {client.lastName}{client.display_id ? ` - #${client.display_id}` : ''}
                    </div>
                    <div className="text-sm text-gray-500">
                      {client.email && (
                        <span className="mr-3">{client.email}</span>
                      )}
                      {client.phone && (
                        <span>{client.phone}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 capitalize">
                    {client.workflowStatus || 'potential'}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-gray-500 text-center">
              No clients found
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableClientDropdown;