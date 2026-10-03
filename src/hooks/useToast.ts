import { useCallback, useState } from 'react';
import { ToastMessage } from '../components/Toast';

export const useToast = () => {
  const [toast, setToast] = useState<ToastMessage>(null);

  const showSuccess = useCallback((text: string) => setToast({ type: 'success', text }), []);
  const showError = useCallback((text: string) => setToast({ type: 'error', text }), []);
  const dismiss = useCallback(() => setToast(null), []);

  return { toast, showSuccess, showError, dismiss };
};
