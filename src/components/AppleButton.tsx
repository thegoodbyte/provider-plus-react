/* apple button   */
import React from 'react';

interface AppleButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
}

const AppleButton: React.FC<AppleButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  loading = false,
  onClick,
  type = 'button',
  className = ''
}) => {
  const baseStyles = `
    inline-flex items-center justify-center
    font-medium rounded-apple
    whitespace-nowrap
    transition-all duration-200 transform
    active:scale-[0.98]
    focus:outline-none focus:ring-2 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
  `;

  const variantStyles = {
    primary: `
      bg-apple-blue text-white
      hover:bg-blue-600 active:bg-blue-700
      focus:ring-apple-blue/50
      shadow-apple-sm hover:shadow-apple
    `,
    secondary: `
      bg-apple-gray-50 text-apple-gray-600
      border border-apple-gray-200
      hover:bg-white active:bg-apple-gray-100
      focus:ring-apple-gray-200
      shadow-none hover:shadow-apple-sm
    `,
    ghost: `
      bg-transparent text-apple-gray-600
      hover:bg-apple-gray-100 active:bg-apple-gray-200
      focus:ring-apple-gray-200
    `,
    danger: `
      bg-apple-red text-white
      hover:bg-red-600 active:bg-red-700
      focus:ring-apple-red/50
      shadow-apple-sm hover:shadow-apple
    `
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-2.5 text-base gap-2.5'
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        ${baseStyles}
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
    >
      {loading ? (
        <>
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Loading...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
};

export default AppleButton;
