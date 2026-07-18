import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MedicalItem } from '../types';
import { FiChevronDown, FiSearch, FiX } from 'react-icons/fi';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

interface Props {
  items: EnrichedMedicalItem[];
  value?: string;
  onChange: (id: string) => void;
  placeholder?: string;
  className?: string;
}

export type EnrichedMedicalItem = MedicalItem & { retreatName?: string };

export const getMedicalTrackingOptionLabels = (item: EnrichedMedicalItem) => {
  const clientName = [item.firstName, item.lastName].filter(Boolean).join(' ') || item.clientName || '';
  const client = [item.clientDisplayId ? `#${item.clientDisplayId}` : '', clientName].filter(Boolean).join(' ') || `Client ${String(item.client_id || '').slice(-6)}`;
  const record = item.ekgFileName || item.liverPanelFileName || (item.display_id ? `Medical record #${item.display_id}` : `Medical record ${String(item._id || '').slice(-6)}`);
  const context = item.retreatName || item.source || 'No retreat linked';
  return { primary: `${client} · ${item.type || 'Medical'}`, secondary: `${record} · ${context}` };
};

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
    ? getMedicalTrackingOptionLabels(selectedItem).primary
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
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 pr-10 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-2">
          {selectedItem && (
            <button
              type="button"
              onClick={() => { onChange(''); setSearchTerm(''); }}
              className="inline-flex h-7 w-7 items-center justify-center rounded bg-transparent p-0 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <Icon icon={FiX} className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="inline-flex h-7 w-7 items-center justify-center rounded bg-transparent p-0 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <Icon icon={isOpen ? FiSearch : FiChevronDown} className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {filteredItems.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">No records found</div>
          ) : (
            filteredItems.map((item) => {
              const labels = getMedicalTrackingOptionLabels(item);
              return (
              <button
                key={item._id}
                type="button"
                onClick={() => {
                  onChange(item._id || '');
                  setIsOpen(false);
                  setSearchTerm('');
                }}
                className="block w-full border-b border-gray-100 bg-white px-3 py-2 text-left text-gray-900 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none last:border-b-0"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-gray-900">
                      {labels.primary}
                    </div>
                    <div className="truncate text-xs text-gray-500">
                      {labels.secondary}
                    </div>
                  </div>
                  <div className="text-xs font-mono text-blue-600">{item.display_id ? `#${item.display_id}` : ''}</div>
                </div>
              </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableMedicalTrackingSelect;
