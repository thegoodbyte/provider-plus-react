import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Client } from '../types';
import { FiChevronDown, FiSearch, FiX } from 'react-icons/fi';

// Icon wrapper to fix TypeScript issues
const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

interface SearchableClientSelectProps {
  clients: Client[];
  value?: string;
  selectedClientId?: string;
  onChange?: (clientId: string) => void;
  onClientSelect?: (clientId: string) => void;
  placeholder?: string;
  className?: string;
}

const SearchableClientSelect: React.FC<SearchableClientSelectProps> = ({
  clients,
  value,
  selectedClientId,
  onChange,
  onClientSelect,
  placeholder = "Search clients by name or number...",
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Find selected client - support both prop patterns
  const currentValue = selectedClientId || value || '';
  const selectedClient = clients.find(client => client._id === currentValue);

  // Helper to call the appropriate handler
  const handleSelection = (clientId: string) => {
    if (onClientSelect) {
      onClientSelect(clientId);
    } else if (onChange) {
      onChange(clientId);
    }
  };

  // Filter clients based on search term
  const filteredClients = useMemo(() => {
    if (!searchTerm) return clients;

    const term = searchTerm.toLowerCase();
    return clients.filter(client => {
      const fullName = `${client.firstName} ${client.lastName}`.toLowerCase();
      const displayId = client.display_id?.toString() || '';
      const email = client.email.toLowerCase();

      return fullName.includes(term) ||
             displayId.includes(term) ||
             email.includes(term);
    });
  }, [clients, searchTerm]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        setIsOpen(true);
        setHighlightedIndex(0);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < filteredClients.length - 1 ? prev + 1 : prev
        );
        break;

      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;

      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredClients.length) {
          const selectedClient = filteredClients[highlightedIndex];
          handleSelection(selectedClient._id || '');
          setIsOpen(false);
          setSearchTerm('');
          setHighlightedIndex(-1);
        }
        break;

      case 'Escape':
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
        break;
    }
  };

  const handleClientSelect = (client: Client) => {
    handleSelection(client._id || '');
    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(-1);
  };

  const clearSelection = () => {
    handleSelection('');
    setSearchTerm('');
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  const formatClientDisplay = (client: Client) => {
    const displayId = client.display_id ? `#${client.display_id}` : '';
    return `${client.firstName} ${client.lastName} ${displayId}`;
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? searchTerm : (selectedClient ? formatClientDisplay(selectedClient) : '')}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) {
              setIsOpen(true);
              setHighlightedIndex(0);
            }
          }}
          onFocus={() => {
            if (!isOpen) {
              setIsOpen(true);
              setHighlightedIndex(0);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        <div className="absolute inset-y-0 right-0 flex items-center pr-2">
          {selectedClient && !isOpen && (
            <button
              type="button"
              onClick={clearSelection}
              className="p-1 text-gray-400 hover:text-gray-600 focus:outline-none"
            >
              <Icon icon={FiX} className="w-4 h-4" />
            </button>
          )}

          {!isOpen && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(true);
                setHighlightedIndex(0);
                inputRef.current?.focus();
              }}
              className="p-1 text-gray-400 hover:text-gray-600 focus:outline-none ml-1"
            >
              <Icon icon={FiChevronDown} className="w-4 h-4" />
            </button>
          )}

          {isOpen && (
            <Icon icon={FiSearch} className="w-4 h-4 text-gray-400 ml-1" />
          )}
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {filteredClients.length === 0 ? (
            <div className="px-3 py-2 text-gray-500 text-sm">
              No clients found matching "{searchTerm}"
            </div>
          ) : (
            <div className="py-1">
              {filteredClients.map((client, index) => {
                const displayId = client.display_id ? `#${client.display_id}` : 'No ID';

                return (
                  <div
                    key={client._id}
                    onClick={() => handleClientSelect(client)}
                    className={`px-3 py-2 cursor-pointer transition-colors duration-150 ${
                      index === highlightedIndex
                        ? 'bg-blue-100 text-blue-900'
                        : 'hover:bg-gray-100'
                    }`}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium text-gray-900">
                          {client.firstName} {client.lastName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {client.email}
                        </div>
                      </div>
                      <div className="text-sm font-mono text-blue-600">
                        {displayId}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableClientSelect;