import React, { useState, useEffect, useRef } from 'react';
import './SearchableSelect.css';

interface Option {
  id: string;
  label: string;
  sublabel?: string;
}

interface SearchableSelectProps {
  id: string;
  name: string;
  value: string;
  options: Option[];
  placeholder: string;
  onChange: (value: string) => void;
  required?: boolean;
  loading?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  id,
  name,
  value,
  options,
  placeholder,
  onChange,
  required = false,
  loading = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState<Option[]>(options);
  const [selectedOption, setSelectedOption] = useState<Option | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Update filtered options when options or search term changes
  useEffect(() => {
    if (!searchTerm) {
      setFilteredOptions(options);
    } else {
      setFilteredOptions(
        options.filter(option =>
          option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
          option.sublabel?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }
  }, [options, searchTerm]);

  // Update selected option when value changes
  useEffect(() => {
    const selected = options.find(option => option.id === value);
    setSelectedOption(selected || null);
    if (selected) {
      setSearchTerm(selected.label);
    } else if (!isOpen) {
      setSearchTerm('');
    }
  }, [value, options, isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        // Reset search term to selected option's label if something is selected
        if (selectedOption) {
          setSearchTerm(selectedOption.label);
        } else {
          setSearchTerm('');
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [selectedOption]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setIsOpen(true);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleOptionClick = (option: Option) => {
    setSelectedOption(option);
    setSearchTerm(option.label);
    setIsOpen(false);
    onChange(option.id);
  };

  const handleClear = () => {
    setSelectedOption(null);
    setSearchTerm('');
    onChange('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className="searchable-select">
      <div className="searchable-select-input-container">
        <input
          ref={inputRef}
          type="text"
          id={id}
          name={name}
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          required={required}
          className={`searchable-select-input ${selectedOption ? 'has-value' : ''}`}
          autoComplete="off"
        />

        {loading && (
          <div className="searchable-select-spinner">
            ⟳
          </div>
        )}

        {selectedOption && !loading && (
          <button
            type="button"
            className="searchable-select-clear"
            onClick={handleClear}
            aria-label="Clear selection"
          >
            ×
          </button>
        )}

        <div className="searchable-select-arrow">
          ▼
        </div>
      </div>

      {isOpen && (
        <div ref={dropdownRef} className="searchable-select-dropdown">
          {filteredOptions.length === 0 ? (
            <div className="searchable-select-no-options">
              {loading ? 'Loading...' : 'No options found'}
            </div>
          ) : (
            <ul className="searchable-select-options">
              {filteredOptions.map((option) => (
                <li
                  key={option.id}
                  className={`searchable-select-option ${
                    selectedOption?.id === option.id ? 'selected' : ''
                  }`}
                  onClick={() => handleOptionClick(option)}
                >
                  <div className="option-label">{option.label}</div>
                  {option.sublabel && (
                    <div className="option-sublabel">{option.sublabel}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};