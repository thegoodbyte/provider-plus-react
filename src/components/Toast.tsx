import React, { useEffect } from 'react';
import { FiAlertCircle, FiCheckCircle, FiX } from 'react-icons/fi';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

export type ToastMessage = { type: 'success' | 'error'; text: string } | null;

interface ToastProps {
  toast: ToastMessage;
  onDismiss: () => void;
  durationMs?: number;
}

const Toast: React.FC<ToastProps> = ({ toast, onDismiss, durationMs = 6000 }) => {
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss, durationMs]);

  if (!toast) return null;
  const isError = toast.type === 'error';

  return (
    <div className="fixed top-4 right-4 z-50 w-full max-w-sm">
      <div
        role={isError ? 'alert' : 'status'}
        className={`flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg ${isError ? 'border-red-200 bg-red-50 text-red-800' : 'border-green-200 bg-green-50 text-green-800'}`}
      >
        <Icon icon={isError ? FiAlertCircle : FiCheckCircle} className={`mt-0.5 h-5 w-5 flex-shrink-0 ${isError ? 'text-red-500' : 'text-green-500'}`} />
        <p className="flex-1 text-sm font-medium">{toast.text}</p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className={`flex-shrink-0 rounded-md p-0.5 hover:bg-black/5 ${isError ? 'text-red-500' : 'text-green-500'}`}
        >
          <Icon icon={FiX} className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default Toast;
