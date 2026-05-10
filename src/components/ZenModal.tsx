import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import ZenButton from './ZenButton';

interface ZenModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnOverlayClick?: boolean;
  showCloseButton?: boolean;
}

const ZenModal: React.FC<ZenModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnOverlayClick = true,
  showCloseButton = true
}) => {
  // Check if mobile device
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
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
    full: 'max-w-full mx-4'
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex ${isMobile ? 'items-end' : 'items-center'} justify-center ${isMobile ? '' : 'p-4'}`}
      role="dialog"
      aria-modal="true"
    >
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-zen-900/20 backdrop-blur-sm animate-fade-in"
        onClick={closeOnOverlayClick ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Modal Content */}
      <div
        className={`
          relative bg-white ${isMobile ? 'rounded-t-2xl' : 'rounded-softer'} shadow-xl
          ${isMobile ? 'animate-slide-up' : 'animate-slide-in'}
          w-full ${isMobile ? 'max-w-full' : sizeClasses[size]}
          ${isMobile ? 'h-[100vh]' : 'max-h-[90vh]'} flex flex-col
        `}
        style={isMobile ? { maxHeight: '100vh', height: '100vh' } : {}}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-6 border-b border-zen-100">
            {title && (
              <h2 className="text-xl font-light text-zen-900">
                {title}
              </h2>
            )}

            {showCloseButton && (
              <button
                onClick={onClose}
                className="
                  p-2 rounded-soft
                  text-zen-400 hover:text-zen-600 hover:bg-zen-50
                  transition-all duration-200
                  ml-auto
                "
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
          <div className="p-6 border-t border-zen-100">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default ZenModal;