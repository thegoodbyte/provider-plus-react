import React, { ReactNode, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { ErrorBoundary } from './ErrorBoundary';

// Key by pathname so navigation clears a failed page and immediately presents
// the loading state. Keep the application shell and permission guards intact.
export default function RouteContentBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return <ErrorBoundary key={pathname} title="This page couldn’t load" message="Check your connection and reload to try again. You can also choose another page from the menu.">
    <Suspense fallback={<div role="status" aria-live="polite" className="flex min-h-[160px] items-center justify-center gap-3 p-6 text-slate-600">
      <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
      Loading page…
    </div>}>
      {children}
    </Suspense>
  </ErrorBoundary>;
}
