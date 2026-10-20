import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'util';

Object.assign(globalThis, { TextDecoder, TextEncoder });

// jsdom doesn't implement ResizeObserver. antd's dropdowns (Select, Tooltip,
// etc, via rc-resize-observer) construct one on mount, which otherwise
// throws "ResizeObserver is not defined" inside React's render -- surfacing
// as an opaque AggregateError from act() with no usable message. A no-op
// stub is the standard fix; real resize callbacks aren't meaningfully
// testable in jsdom regardless.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// jsdom doesn't implement MessageChannel. rc-select's internal open/close
// scheduler (useOpen.js) posts its macrotask through a MessageChannel port
// instead of setTimeout; without it, selecting an option throws "MessageChannel
// is not defined" inside that scheduler, silently aborting the close -- the
// dropdown is left open and its (unfiltered) option list stays in the DOM.
// Node's own MessageChannel implementation is a drop-in polyfill here.
// Node's real worker_threads MessageChannel works too, but its ports are
// backed by actual OS handles that keep Jest's process alive after tests
// finish -- a minimal setTimeout-based stand-in avoids that hang.
if (typeof globalThis.MessageChannel === 'undefined') {
  class FakeMessagePort {
    onmessage: ((event: { data: unknown }) => void) | null = null;
    private other: FakeMessagePort | null = null;
    postMessage(data: unknown) {
      const target = this.other;
      setTimeout(() => target?.onmessage?.({ data }), 0);
    }
    start() {}
    close() {}
  }
  globalThis.MessageChannel = class MessageChannel {
    port1 = new FakeMessagePort();
    port2 = new FakeMessagePort();
    constructor() {
      (this.port1 as any).other = this.port2;
      (this.port2 as any).other = this.port1;
    }
  } as any;
}

// Tests that render <MemoryRouter> directly (rather than the app's real
// <BrowserRouter future={{...}}>) can't inherit the v7 future flags set in
// App.tsx, so React Router repeats these two known, non-actionable warnings
// on every such render. Filtering just these two messages keeps real
// console.warn output visible instead of drowning it in expected noise.
const REACT_ROUTER_FUTURE_FLAG_WARNING = /React Router Future Flag Warning/;
const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && REACT_ROUTER_FUTURE_FLAG_WARNING.test(args[0])) return;
  originalWarn(...args);
};
