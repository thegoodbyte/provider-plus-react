import { canUseApiDebug, initializeApiDebug, setApiDebugEnabled } from './apiDebug';

describe('API debug access', () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('allows administrators to enable a session-only debug view', () => {
    const admin = { role: 'admin' };
    expect(canUseApiDebug(admin)).toBe(true);
    expect(setApiDebugEnabled(true, admin)).toBe(true);
    expect(initializeApiDebug(admin)).toBe(true);
  });

  it('does not allow ordinary production users to enable API debugging', () => {
    const user = { role: 'user' };
    expect(canUseApiDebug(user)).toBe(false);
  });
});
