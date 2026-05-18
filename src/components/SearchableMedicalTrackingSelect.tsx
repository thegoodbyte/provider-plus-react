import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MedicalItem } from '../types';
import { FiChevronDown, FiSearch, FiX } from 'react-icons/fi';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

interface Props {
  items: MedicalItem[];
  value?: string;
  onChange: (id: string) => void;
  placeholder?: string;
  className?: string;
}

const SearchableMedicalTrackingSelect: React.FC<Props> = ({
  items,
  value,
  onChange,
  placeholder = 'Search medical tracking records...',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedItem = items.find((item) => item._id === value);

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => {
      const client = `${item.clientDisplayId || ''} ${item.client_id || ''}`.toLowerCase();
      const name = `${item.clientName || ''} ${item.firstName || ''} ${item.lastName || ''}`.toLowerCase();
      const fileName = `${item.ekgFileName || ''} ${item.liverPanelFileName || ''}`.toLowerCase();
      const type = (item.type || '').toLowerCase();
      const source = (item.source || '').toLowerCase();
      return [client, name, fileName, type, source].some((value) => value.includes(term));
    });
  }, [items, searchTerm]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayValue = selectedItem
    ? `${selectedItem.clientDisplayId ? `#${selectedItem.clientDisplayId} ` : ''}${selectedItem.type} • ${selectedItem.source || 'Unknown source'}`
    : '';

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? searchTerm : displayValue}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full rounded-md border border-gray-300 px-3 py-2 pr-10 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-2">
          {selectedItem && (
            <button type="button" onClick={() => { onChange(''); setSearchTerm(''); }} className="text-gray-400 hover:text-gray-600">
              <Icon icon={FiX} className="h-4 w-4" />
            </button>
          )}
          <button type="button" onClick={() => setIsOpen((prev) => !prev)} className="text-gray-400 hover:text-gray-600">
            <Icon icon={isOpen ? FiSearch : FiChevronDown} className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {filteredItems.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">No records found</div>
          ) : (
            filteredItems.map((item) => (
              <button
                key={item._id}
                type="button"
                onClick={() => {
                  onChange(item._id || '');
                  setIsOpen(false);
                  setSearchTerm('');
                }}
                className="block w-full border-b border-gray-100 px-3 py-2 text-left hover:bg-blue-50 last:border-b-0"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-gray-900">
                      {item.clientDisplayId ? `#${item.clientDisplayId} ` : ''}
                      {item.type}
                    </div>
                    <div className="truncate text-xs text-gray-500">
                      {item.ekgFileName || item.liverPanelFileName || 'No file name'} • {item.source || 'Unknown'}
                    </div>
                  </div>
                  <div className="text-xs font-mono text-blue-600">{item.display_id ? `#${item.display_id}` : ''}</div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableMedicalTrackingSelect;
