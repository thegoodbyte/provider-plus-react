import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';

interface ResponsiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnOverlayClick?: boolean;
  showCloseButton?: boolean;
  className?: string;
}

const ResponsiveModal: React.FC<ResponsiveModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnOverlayClick = true,
  showCloseButton = true,
  className = ''
}) => {
  const isMobile = useIsMobile(768);

  // Handle ESC key press
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-full'
  };

  if (isMobile) {
    // Mobile: Full-screen modal sliding up from bottom
    return (
      <div className="fixed inset-0 z-50 flex items-end">
        {/* Overlay */}
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={closeOnOverlayClick ? onClose : undefined}
        />

        {/* Modal Content */}
        <div
          className={`relative bg-white w-full h-screen flex flex-col animate-slide-up ${className}`}
          style={{ animation: 'slideUp 0.3s ease-out' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white sticky top-0 z-10">
            {title && (
              <h2 className="text-lg font-semibold text-gray-900">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="p-4 border-t border-gray-200 bg-white sticky bottom-0">
              {footer}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Desktop: Centered modal
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={closeOnOverlayClick ? onClose : undefined}
      />

      {/* Modal Content */}
      <div
        className={`
          relative bg-white rounded-xl shadow-2xl
          animate-modal-in
          w-full ${sizeClasses[size]}
          max-h-[90vh] flex flex-col
          ${className}
        `}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            {title && (
              <h2 className="text-xl font-semibold text-gray-900">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors ml-auto"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-6 border-t border-gray-200">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResponsiveModal;