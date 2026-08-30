export type AppMode = 'normal' | 'retreat' | 'shopping';

export type StoredAppMode = {
  mode: AppMode;
  retreatId?: string;
  retreatLabel?: string;
};

export const APP_MODE_STORAGE_KEY = 'providerPlusAppMode:v1';

export const readStoredAppMode = (): StoredAppMode => {
  try {
    const parsed = JSON.parse(localStorage.getItem(APP_MODE_STORAGE_KEY) || '{}');
    if (parsed.mode === 'retreat' || parsed.mode === 'shopping') return parsed;
  } catch {
    // Ignore invalid or old local state.
  }
  return { mode: 'normal' };
};

export const clearStoredAppMode = () => localStorage.removeItem(APP_MODE_STORAGE_KEY);
