import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'util';

Object.assign(globalThis, { TextDecoder, TextEncoder });

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
