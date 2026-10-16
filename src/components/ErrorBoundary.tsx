import { Component, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  title: string;
  message: string;
}

// Generic, reusable error boundary. RouteContentBoundary wraps one of these
// around each route's content (re-mounted per pathname, so navigation clears
// a failed page); AppErrorBoundary wraps one around the whole app shell
// (nav, banners, everything outside any specific route) so a bug in a
// persistent element like EnvironmentBanner can't blank the entire page.
export class ErrorBoundary extends Component<ErrorBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return <section role="alert" className="rounded-lg bg-white p-6 text-slate-800">
        <h2 className="text-lg font-semibold">{this.props.title}</h2>
        <p className="mt-2">{this.props.message}</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white">Reload page</button>
      </section>;
    }
    return this.props.children;
  }
}
