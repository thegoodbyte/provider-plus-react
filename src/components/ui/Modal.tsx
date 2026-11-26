import React, { useRef } from 'react';
import { X } from 'lucide-react';
import { useDialogFocus } from '../../hooks/useDialogFocus';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const SIZE: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
};

/**
 * The one dialog chrome every page should use instead of hand-rolling its own overlay/panel.
 * Full-screen on mobile, centered card on larger screens; Escape and focus trap come from the
 * same useDialogFocus hook the former hand-rolled client-editor modal already relied on.
 */
const Modal: React.FC<ModalProps> = ({ open, onClose, title, children, footer, size = 'md' }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(open, dialogRef, onClose);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-white sm:items-center sm:bg-black/50 sm:p-4"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div
        data-re-modal=""
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={`flex h-full w-full flex-col overflow-hidden bg-apple-surface sm:h-auto sm:max-h-[90vh] sm:w-full sm:rounded-apple-lg sm:border sm:border-apple-gray-200 sm:shadow-apple-xl ${SIZE[size]}`}
      >
        {title && (
          <div className="flex items-center justify-between gap-3 border-b border-apple-gray-200 px-5 py-4">
            <h2 className="text-base font-bold text-apple-gray-900">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-apple-gray-400 hover:bg-apple-gray-100 hover:text-apple-gray-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-apple-gray-200 px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
};

export default Modal;
