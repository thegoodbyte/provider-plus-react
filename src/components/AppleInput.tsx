import React from 'react';

interface AppleInputProps {
  label?: string;
  placeholder?: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'date' | 'search';
  error?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
  icon?: React.ReactNode;
  min?: string;
  max?: string;
}

const AppleInput: React.FC<AppleInputProps> = ({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
  error,
  hint,
  required = false,
  disabled = false,
  fullWidth = true,
  className = '',
  icon,
  min,
  max
}) => {
  return (
    <div className={`${fullWidth ? 'w-full' : ''} ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-apple-gray-700 mb-1.5">
          {label}
          {required && <span className="text-apple-red ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-apple-gray-400">
            {icon}
          </div>
        )}

        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          min={min}
          max={max}
          className={`
            w-full
            ${icon ? 'pl-10' : 'pl-4'} pr-4 py-2
            bg-white border rounded-apple
            text-apple-gray-900 placeholder-apple-gray-400
            transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-offset-1
            disabled:bg-apple-gray-50 disabled:text-apple-gray-400 disabled:cursor-not-allowed
            ${error
              ? 'border-apple-red focus:ring-apple-red/20 focus:border-apple-red'
              : 'border-apple-gray-200 hover:border-apple-gray-300 focus:ring-apple-blue/20 focus:border-apple-blue'
            }
          `}
        />

        {type === 'search' && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg className="w-4 h-4 text-apple-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-1 text-xs text-apple-red flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}

      {hint && !error && (
        <p className="mt-1 text-xs text-apple-gray-500">{hint}</p>
      )}
    </div>
  );
};

export default AppleInput;