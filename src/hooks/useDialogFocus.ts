import { RefObject, useEffect, useRef } from 'react';

/** Keep keyboard navigation inside an open dialog and restore the trigger. */
export function useDialogFocus(active: boolean, root: RefObject<HTMLElement | null>, onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement as HTMLElement | null;
    const controls = () => Array.from(root.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]') || []).filter(element => element.getClientRects().length > 0);
    let focused = false;
    const focusFirst = () => {
      if (focused) return;
      const first = controls()[0];
      if (first) { first.focus(); focused = true; }
    };
    focusFirst();
    const observer = new MutationObserver(focusFirst);
    if (root.current) observer.observe(root.current, { childList: true, subtree: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const elements = controls(); const first = elements[0]; const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { observer.disconnect(); document.removeEventListener('keydown', onKeyDown); if (previous?.isConnected) previous.focus(); };
  }, [active, root]);
}
