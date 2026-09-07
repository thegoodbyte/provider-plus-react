import React, { useEffect, useRef, useState } from 'react';
import { getCountryByCode, searchCountries } from '../utils/countries';

interface SearchableCountryNameSelectorProps {
  value?: string; // ISO country code, e.g. "PL"
  onChange: (countryCode: string) => void;
  label?: string;
  placeholder?: string;
  id?: string;
}

const SearchableCountryNameSelector: React.FC<SearchableCountryNameSelectorProps> = ({
  value,
  onChange,
  label,
  placeholder = 'Select country',
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selected = value ? getCountryByCode(value) : undefined;
  const filtered = searchCountries(searchQuery);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) searchInputRef.current.focus();
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      {label && <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <button
        type="button"
        id={id}
        onClick={() => setIsOpen((current) => !current)}
        className="w-full px-3 py-2 text-left bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center justify-between"
      >
        {selected ? (
          <span><span className="mr-2">{selected.flag}</span>{selected.name}</span>
        ) : (
          <span className="text-gray-500">{placeholder}</span>
        )}
        <span className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-64 overflow-hidden">
          <div className="p-2 border-b border-gray-200">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search countries..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length > 0 ? (
              filtered.map((country) => (
                <button
                  key={country.code}
                  type="button"
                  onClick={() => { onChange(country.code); setIsOpen(false); setSearchQuery(''); }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 ${country.code === value ? 'bg-blue-50 text-blue-700' : ''}`}
                >
                  <span>{country.flag}</span>
                  <span className="flex-1">{country.name}</span>
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">No countries found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableCountryNameSelector;
