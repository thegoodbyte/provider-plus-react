export const apiErrorMessage = (error: any, fallback: string): string => {
  const value = error?.response?.data?.message ?? error?.response?.data?.error ?? error?.message;
  if (Array.isArray(value)) return value.filter(Boolean).join(' ');
  if (typeof value === 'string' && value.trim()) return value;
  return fallback;
};
