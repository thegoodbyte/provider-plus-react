const API_DEBUG_KEY = 'retreatengine_api_debug';

const productionDebugEnabled = () => process.env.REACT_APP_ENABLE_API_DEBUG === 'true';

export const canUseApiDebug = (user?: any) =>
  user?.role === 'admin'
  || user?.originalRole === 'admin';

export const initializeApiDebug = (user?: any) => {
  if (typeof window === 'undefined') return false;
  const allowed = process.env.NODE_ENV !== 'production' || (productionDebugEnabled() && canUseApiDebug(user));
  const requested = new URLSearchParams(window.location.search).get('apiDebug');
  if (allowed && requested === '1') sessionStorage.setItem(API_DEBUG_KEY, 'true');
  if (allowed && requested === '0') sessionStorage.removeItem(API_DEBUG_KEY);
  if (!allowed) sessionStorage.removeItem(API_DEBUG_KEY);
  return process.env.NODE_ENV !== 'production' || (allowed && sessionStorage.getItem(API_DEBUG_KEY) === 'true');
};

export const setApiDebugEnabled = (enabled: boolean, user?: any) => {
  if ((process.env.NODE_ENV === 'production' && (!productionDebugEnabled() || !canUseApiDebug(user))) || typeof window === 'undefined') return false;
  if (enabled) sessionStorage.setItem(API_DEBUG_KEY, 'true');
  else sessionStorage.removeItem(API_DEBUG_KEY);
  window.dispatchEvent(new CustomEvent('api-debug-change', { detail: enabled }));
  return enabled;
};
