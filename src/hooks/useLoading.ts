import { useState, useCallback } from 'react';

interface LoadingState {
  isLoading: boolean;
  loadingMessage?: string;
}

export const useLoading = (initialState: boolean = false) => {
  const [state, setState] = useState<LoadingState>({
    isLoading: initialState
  });

  const setLoading = useCallback((loading: boolean, message?: string) => {
    setState({
      isLoading: loading,
      loadingMessage: message
    });
  }, []);

  const withLoading = useCallback(async <T>(
    operation: () => Promise<T>,
    message?: string
  ): Promise<T> => {
    try {
      setLoading(true, message);
      return await operation();
    } finally {
      setLoading(false);
    }
  }, [setLoading]);

  return {
    isLoading: state.isLoading,
    loadingMessage: state.loadingMessage,
    setLoading,
    withLoading
  };
};