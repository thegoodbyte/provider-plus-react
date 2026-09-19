import React, { Component, ReactNode, Suspense } from 'react';
import { useLocation } from 'react-router-dom';

class PageLoadErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return <section role="alert" className="rounded-lg bg-white p-6 text-slate-800">
        <h2 className="text-lg font-semibold">This page couldn’t load</h2>
        <p className="mt-2">Check your connection and reload to try again. You can also choose another page from the menu.</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white">Reload page</button>
      </section>;
    }
    return this.props.children;
  }
}

// Key by pathname so navigation clears a failed page and immediately presents
// the loading state. Keep the application shell and permission guards intact.
export default function RouteContentBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return <PageLoadErrorBoundary key={pathname}>
    <Suspense fallback={<div role="status" aria-live="polite" className="flex min-h-[160px] items-center justify-center gap-3 p-6 text-slate-600">
      <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
      Loading page…
    </div>}>
      {children}
    </Suspense>
  </PageLoadErrorBoundary>;
}
