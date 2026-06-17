import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Retreat } from '../types';
import { FiChevronDown, FiSearch, FiX } from 'react-icons/fi';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

interface SearchableRetreatSelectProps {
  retreats: Retreat[];
  selectedRetreatId: string;
  onRetreatSelect: (retreatId: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

const SearchableRetreatSelect: React.FC<SearchableRetreatSelectProps> = ({
  retreats,
  selectedRetreatId,
  onRetreatSelect,
  placeholder = 'Select a retreat',
  required = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredRetreats, setFilteredRetreats] = useState<Retreat[]>(retreats);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedRetreat = retreats.find(retreat => retreat._id === selectedRetreatId);
  const displayValue = selectedRetreat
    ? `${selectedRetreat.name}${selectedRetreat.location ? ` - ${selectedRetreat.location}` : ''}`
    : '';

  useEffect(() => {
    const filtered = retreats.filter(retreat => {
      const name = (retreat.name || '').toLowerCase();
      const location = (retreat.location || '').toLowerCase();
      const id = (retreat._id || '').toLowerCase();
      const search = searchTerm.toLowerCase();

      return name.includes(search) || location.includes(search) || id.includes(search);
    });
    setFilteredRetreats(filtered);
  }, [retreats, searchTerm]);

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

  const handleRetreatSelect = (retreat: Retreat) => {
    onRetreatSelect(retreat._id!);
    setIsOpen(false);
    setSearchTerm('');
  };

  const clearSelection = () => {
    onRetreatSelect('');
    setSearchTerm('');
  };

  const currentValue = useMemo(() => {
    return isOpen ? searchTerm : displayValue;
  }, [isOpen, searchTerm, displayValue]);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div className="relative">
        <input
          type="text"
          value={currentValue}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onClick={() => setIsOpen(true)}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
        <div className="absolute inset-y-0 right-0 flex items-center px-2">
          {selectedRetreatId && (
            <button type="button" onClick={clearSelection} className="text-gray-400 hover:text-gray-600 mr-1">
              <Icon icon={FiX} className="w-4 h-4" />
            </button>
          )}
          <button type="button" onClick={() => setIsOpen(prev => !prev)} className="text-gray-400 hover:text-gray-600">
            {isOpen ? <Icon icon={FiSearch} className="w-4 h-4" /> : <Icon icon={FiChevronDown} className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
          {filteredRetreats.length > 0 ? (
            filteredRetreats.map((retreat) => (
              <div
                key={retreat._id}
                onClick={() => handleRetreatSelect(retreat)}
                className="px-3 py-2 cursor-pointer hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
              >
                <div className="font-medium text-gray-900">
                  {retreat.name}
                  {(retreat.retreatCode || retreat.code) ? ` (${retreat.retreatCode || retreat.code})` : ''}
                </div>
                <div className="text-sm text-gray-500">
                  {retreat.location_town || retreat.locationTown || retreat.location || 'No location town'}
                </div>
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-gray-500 text-center">No retreats found</div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableRetreatSelect;
