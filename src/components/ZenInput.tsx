import React from 'react';
import { LucideIcon } from 'lucide-react';

interface ZenInputProps {
  label?: string;
  placeholder?: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'date';
  icon?: LucideIcon;
  error?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
}

const ZenInput: React.FC<ZenInputProps> = ({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
  icon: Icon,
  error,
  hint,
  required = false,
  disabled = false,
  fullWidth = true,
  className = ''
}) => {
  return (
    <div className={`${fullWidth ? 'w-full' : ''} ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-zen-700 mb-1">
          {label}
          {required && <span className="text-status-error ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zen-400" />
        )}

        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`
            w-full
            ${Icon ? 'pl-10' : 'pl-4'} pr-4 py-2
            bg-white border rounded-soft
            placeholder-zen-400
            transition-all duration-200
            focus:outline-none focus:ring-2
            disabled:bg-zen-50 disabled:text-zen-400 disabled:cursor-not-allowed
            ${error
              ? 'border-status-error text-zen-900 focus:ring-status-error/20 focus:border-status-error'
              : 'border-zen-200 text-zen-700 focus:ring-accent-sky/20 focus:border-accent-sky'
            }
          `}
        />
      </div>

      {error && (
        <p className="mt-1 text-sm text-status-error">{error}</p>
      )}

      {hint && !error && (
        <p className="mt-1 text-sm text-zen-500">{hint}</p>
      )}
    </div>
  );
};

export default ZenInput;