import React, { useEffect, useRef, useState } from 'react';
import { ClientLanguageCode } from '../utils/countries';

export const LANGUAGE_OPTIONS: Array<{ code: ClientLanguageCode; label: string }> = [
  { code: 'EN', label: 'English' },
  { code: 'CZ', label: 'Czech' },
  { code: 'PL', label: 'Polish' },
  { code: 'RU', label: 'Russian' },
  { code: 'OTHER', label: 'Other' },
];

interface SearchableLanguageSelectorProps {
  value?: string;
  onChange: (languageCode: ClientLanguageCode) => void;
  label?: string;
  placeholder?: string;
  id?: string;
}

const SearchableLanguageSelector: React.FC<SearchableLanguageSelectorProps> = ({
  value,
  onChange,
  label,
  placeholder = 'Select language',
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selected = LANGUAGE_OPTIONS.find((option) => option.code === value);
  const query = searchQuery.trim().toLowerCase();
  const filtered = query
    ? LANGUAGE_OPTIONS.filter((option) => option.label.toLowerCase().includes(query) || option.code.toLowerCase().includes(query))
    : LANGUAGE_OPTIONS;

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
        {selected ? <span>{selected.label}</span> : <span className="text-gray-500">{placeholder}</span>}
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
              placeholder="Search languages..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length > 0 ? (
              filtered.map((option) => (
                <button
                  key={option.code}
                  type="button"
                  onClick={() => { onChange(option.code); setIsOpen(false); setSearchQuery(''); }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${option.code === value ? 'bg-blue-50 text-blue-700' : ''}`}
                >
                  {option.label}
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">No languages found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableLanguageSelector;
