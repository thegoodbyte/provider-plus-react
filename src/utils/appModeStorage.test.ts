import { APP_MODE_STORAGE_KEY, clearStoredAppMode, readStoredAppMode } from './appModeStorage';

describe('appModeStorage', () => {
  beforeEach(() => localStorage.clear());

  it('restores supported admin modes', () => {
    localStorage.setItem(APP_MODE_STORAGE_KEY, JSON.stringify({ mode: 'shopping' }));
    expect(readStoredAppMode()).toEqual({ mode: 'shopping' });
    localStorage.setItem(APP_MODE_STORAGE_KEY, JSON.stringify({ mode: 'retreat', retreatId: 'r1' }));
    expect(readStoredAppMode()).toEqual({ mode: 'retreat', retreatId: 'r1' });
  });

  it('falls back safely and clears mode state', () => {
    expect(readStoredAppMode()).toEqual({ mode: 'normal' });
    localStorage.setItem(APP_MODE_STORAGE_KEY, '{invalid');
    expect(readStoredAppMode()).toEqual({ mode: 'normal' });
    localStorage.setItem(APP_MODE_STORAGE_KEY, JSON.stringify({ mode: 'unknown' }));
    expect(readStoredAppMode()).toEqual({ mode: 'normal' });
    clearStoredAppMode();
    expect(localStorage.getItem(APP_MODE_STORAGE_KEY)).toBeNull();
  });
});
